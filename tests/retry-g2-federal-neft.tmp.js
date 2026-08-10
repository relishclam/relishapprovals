/**
 * Retry Group 2: RFPL payment_receipt_url Federal NEFT receipts (21 files)
 * These are post-settlement receipts — the UTR exists but the v3 prompt
 * missed the Federal Bank label "Transaction Reference" / "Ref No".
 * Dry-run only — add --write to commit.
 *
 *   node tests/retry-g2-federal-neft.tmp.js [--write]
 */
'use strict';
process.env.NODE_ENV = 'production';
require('dotenv').config();
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const DRY_RUN = !process.argv.includes('--write');

// ─── Group 2 serial numbers (RFPL payment_receipt_url, Federal NEFT) ─────────
const G2_RFPL_SERIALS = new Set([
  'VCH-2026-27-00608','VCH-2026-27-00574','VCH-2026-27-00539',
  'VCH-2026-27-00552','VCH-2026-27-00591','VCH-2026-27-00500',
  'VCH-2026-27-00477','VCH-2026-27-00501','VCH-2026-27-00594',
  'VCH-2026-27-00596','VCH-2026-27-00606','VCH-2026-27-00437',
  'VCH-2026-27-00433','VCH-2026-27-00611','VCH-2026-27-00609',
  'VCH-2026-27-00610','VCH-2026-27-00598','VCH-2026-27-00434',
  'VCH-2026-27-00432','VCH-2026-27-00499','VCH-2026-27-00476',
  // Also retry the RHHF skip from Group 2: VCH-00540
]);

// ─── Validator ────────────────────────────────────────────────────────────────
function isValidUTR(ref) {
  if (!ref) return false;
  const s = String(ref).trim().replace(/\s+/g, '');
  if (s.length < 7) return false;
  if (/^[A-Z0-9]{7,16}$/i.test(s)) return true;
  if (/^HDFC[A-Z][A-Z0-9]{9,20}$/i.test(s)) return true;
  return false;
}

// ─── Improved prompt — adds Federal Bank NEFT labels ──────────────────────────
const PROMPT_G2 =
  'Extract from this bank payment receipt and return JSON with these keys:\n' +
  '- utr_number: the payment reference. Look under ALL of these labels:\n' +
  '  UTR, Transaction ID, UPI Transaction ID, RRN Number, Reference Number,\n' +
  '  Transaction Reference, Ref No, Transaction No, NEFT Reference,\n' +
  '  IMPS Ref No, Ref No, Google Pay Transaction ID, Google transaction ID,\n' +
  '  UPI Ref No, Txn ID, Approval Code, Acknowledgement No.\n' +
  '  Also accept: any HDFC RTGS/NEFT reference starting with HDFC (e.g. HDFCR...).\n' +
  '  Return the first valid reference found (7–25 alphanumeric chars). Return null if none visible.\n' +
  '- amount: payment amount as plain number\n' +
  '- transaction_date: YYYY-MM-DD if visible\n' +
  'Return JSON only.';

function download(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return download(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve(Buffer.concat(c))); res.on('error', reject);
    });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('dl timeout')); });
    req.on('error', reject);
  });
}

async function ocrFile(buffer, mimeType, fileName) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    let resp, parsed;
    if (mimeType === 'application/pdf') {
      resp = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', signal: ctrl.signal,
        headers: { Authorization: 'Bearer ' + OPENAI_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini',
          input: [{ role: 'user', content: [
            { type: 'input_file', filename: fileName || 'receipt.pdf', file_data: 'data:application/pdf;base64,' + buffer.toString('base64') },
            { type: 'input_text', text: PROMPT_G2 }
          ]}], text: { format: { type: 'json_object' } } }),
      });
    } else {
      resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { Authorization: 'Bearer ' + OPENAI_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o', max_tokens: 400,
          messages: [{ role: 'user', content: [
            { type: 'text', text: PROMPT_G2 },
            { type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + buffer.toString('base64'), detail: 'high' } }
          ]}], response_format: { type: 'json_object' } }),
      });
    }
    clearTimeout(t);
    if (!resp.ok) { const b = await resp.text(); throw new Error('API ' + resp.status + ': ' + b.slice(0, 100)); }
    const json = await resp.json();
    if (mimeType === 'application/pdf') {
      parsed = JSON.parse(json.output?.[0]?.content?.[0]?.text || '{}');
    } else {
      parsed = JSON.parse(json.choices?.[0]?.message?.content || '{}');
    }
    return parsed;
  } catch (e) { clearTimeout(t); throw e; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchAll(table, qfn) {
  const PAGE = 1000; let all = [], from = 0;
  while (true) {
    const { data, error } = await qfn(sb.from(table)).range(from, from + PAGE - 1);
    if (error) { console.error('fetchAll:', error.message); return all; }
    all = all.concat(data || []);
    if ((data || []).length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log('\nRetry Group 2 — RFPL Federal NEFT payment_receipt_url files');
  console.log('Mode:', DRY_RUN ? 'DRY-RUN' : '⚠️ WRITE');

  // Query RFPL + RHHF paid vouchers that are in G2 and still have no payment_reference
  const targets = [];
  for (const [cid, label] of [['relish-foods','RFPL'],['relish-hhc','RHHF']]) {
    const vch = await fetchAll('vouchers', q => q
      .select('id, serial_number, amount, payment_reference, payment_receipt_url')
      .eq('company_id', cid).eq('status', 'paid').is('payment_reference', null)
      .neq('payment_mode', 'Cash').not('payment_receipt_url', 'is', null));
    const g2 = vch.filter(v => G2_RFPL_SERIALS.has(v.serial_number));
    for (const v of g2) {
      const fname = (v.payment_receipt_url || '').split('/').pop();
      const mime = fname.match(/\.(jpg|jpeg)$/i) ? 'image/jpeg'
        : fname.endsWith('.png') ? 'image/png' : 'application/pdf';
      targets.push({ voucherId: v.id, serial: v.serial_number, amount: v.amount,
        url: v.payment_receipt_url, fileName: fname, mimeType: mime, company: label });
    }
  }

  console.log('Eligible files to retry:', targets.length, '\n');

  const results = [];
  for (let i = 0; i < targets.length; i++) {
    const t2 = targets[i];
    process.stdout.write('[' + String(i+1).padStart(2) + '/' + targets.length + '] ' +
      t2.serial + ' ' + t2.company + ' ' + (t2.fileName || '').slice(0, 45).padEnd(45) + ' ');

    let utr = null, ocrAmt = null, action = 'skip-no-utr', err = null;
    try {
      const hardTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('hard-timeout')), 40000));
      const ocr = await Promise.race([
        (async () => { const buf = await download(t2.url); return ocrFile(buf, t2.mimeType, t2.fileName); })(),
        hardTimeout
      ]);
      ocrAmt = ocr.amount ?? null;
      const rawUtr = ocr.utr_number ? String(ocr.utr_number).trim().replace(/\s+/g, '') : null;
      if (!rawUtr || !isValidUTR(rawUtr)) {
        action = rawUtr ? 'skip-invalid-utr (' + rawUtr + ')' : 'skip-no-utr';
      } else {
        const ocrAmtN = parseFloat(ocrAmt), vchAmtN = parseFloat(t2.amount);
        if (!isNaN(ocrAmtN) && !isNaN(vchAmtN) && Math.abs(ocrAmtN - vchAmtN) > 1) {
          action = 'hold-amount-mismatch vch=Rs.' + vchAmtN + ' ocr=Rs.' + ocrAmtN;
        } else {
          utr = rawUtr; action = 'write-candidate';
        }
      }
    } catch (e) { err = e.message; action = 'error-' + e.message.slice(0, 40); }

    console.log('→', action + (utr ? '  UTR:' + utr : ''));
    results.push({ serial: t2.serial, company: t2.company, amount: t2.amount, fileName: t2.fileName, utr, ocrAmt, action, err });

    if (!DRY_RUN && action === 'write-candidate' && utr) {
      await sb.from('vouchers').update({ payment_reference: utr }).eq('id', t2.voucherId).is('payment_reference', null);
    }
    await sleep(400);
  }

  const writes = results.filter(r => r.action === 'write-candidate');
  const byAction = {};
  results.forEach(r => { byAction[r.action] = (byAction[r.action] || 0) + 1; });

  console.log('\n' + '─'.repeat(70));
  console.log('Summary:', JSON.stringify(byAction));
  console.log('Write candidates:', writes.length);

  if (writes.length > 0) {
    console.log('\n' + '═'.repeat(90));
    console.log('PROPOSED WRITES:');
    console.log('Serial              | Co   | Voucher ₹  | OCR ₹      | UTR');
    console.log('─'.repeat(90));
    writes.forEach(r => console.log(r.serial.padEnd(20), '|', r.company.padEnd(5), '|',
      String(r.amount).padEnd(11), '|', String(r.ocrAmt||'—').padEnd(11), '|', r.utr));
  }

  const outFile = path.join(__dirname, 'retry-g2-' + new Date().toISOString().slice(0,10) + '.json');
  fs.writeFileSync(outFile, JSON.stringify({ runAt: new Date().toISOString(), dryRun: DRY_RUN, results }, null, 2));
  console.log('\nSaved →', path.basename(outFile));
  console.log(DRY_RUN ? '✅ Dry-run done. Add --write to commit.' : '✅ Write pass done.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
