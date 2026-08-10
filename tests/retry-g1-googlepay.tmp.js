/**
 * Retry Group 1: RFPL bill attachments with "VCH NNN" filename pattern
 * These are Google Pay / newer Federal Bank PDF payment confirmations.
 * Improved prompt adds Google Pay transaction ID labels.
 * Dry-run only — add --write to commit.
 *
 *   node tests/retry-g1-googlepay.tmp.js [--write]
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

// ─── Group 1 serial numbers (RFPL-att, 51KB Google Pay / newer Federal) ──────
// "Payee VCH NNN.pdf" and "Transaction Summary - Payee VCH NNN.pdf" files
// Excludes VCH-441–461 (105KB pre-credit advice, Group 3 — do not retry)
// Excludes VCH-436 (Matha Sanitary Centre vendor bill)
const G1_RFPL_SERIALS = new Set([
  'VCH-2026-27-00462','VCH-2026-27-00463','VCH-2026-27-00464',
  'VCH-2026-27-00465','VCH-2026-27-00466','VCH-2026-27-00467',
  'VCH-2026-27-00468','VCH-2026-27-00469','VCH-2026-27-00470',
  'VCH-2026-27-00471','VCH-2026-27-00472','VCH-2026-27-00473',
  'VCH-2026-27-00474','VCH-2026-27-00475','VCH-2026-27-00478',
  'VCH-2026-27-00479','VCH-2026-27-00480','VCH-2026-27-00482',
  'VCH-2026-27-00483','VCH-2026-27-00484','VCH-2026-27-00485',
  'VCH-2026-27-00486','VCH-2026-27-00487','VCH-2026-27-00488',
  'VCH-2026-27-00489','VCH-2026-27-00490',
  'VCH-2026-27-00503','VCH-2026-27-00504','VCH-2026-27-00505',
]);

// ─── Validator (same as v3, includes HDFC + SBI short refs) ──────────────────
function isValidUTR(ref) {
  if (!ref) return false;
  const s = String(ref).trim().replace(/\s+/g, '');
  if (s.length < 7) return false;
  if (/^[A-Z0-9]{7,16}$/i.test(s)) return true;   // standard UTR + 7-char SBI/DD
  if (/^HDFC[A-Z][A-Z0-9]{9,20}$/i.test(s)) return true; // HDFC RTGS up to 25 chars
  return false;
}

// ─── Improved prompt — adds Google Pay labels ────────────────────────────────
const PROMPT_G1 =
  'Extract from this payment receipt and return JSON with these keys:\n' +
  '- utr_number: the payment reference. Look under ALL of these labels:\n' +
  '  UTR, Transaction ID, UPI Transaction ID, RRN Number, Reference Number,\n' +
  '  IMPS Ref No, Ref No, Google Pay Transaction ID, Google transaction ID,\n' +
  '  UPI Ref No, Transaction Ref, Txn ID, Approval Code.\n' +
  '  Also accept: a standalone 9–16 digit number appearing prominently without a label,\n' +
  '  any HDFC RTGS/NEFT reference starting with HDFC (e.g. HDFCR... up to 22 chars).\n' +
  '  Return the first valid reference found. Return null if none visible.\n' +
  '- amount: payment amount as plain number (no currency symbol or commas)\n' +
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
            { type: 'input_text', text: PROMPT_G1 }
          ]}], text: { format: { type: 'json_object' } } }),
      });
    } else {
      resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { Authorization: 'Bearer ' + OPENAI_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o', max_tokens: 400,
          messages: [{ role: 'user', content: [
            { type: 'text', text: PROMPT_G1 },
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
  console.log('\nRetry Group 1 — Google Pay / newer Federal PDFs');
  console.log('Mode:', DRY_RUN ? 'DRY-RUN' : '⚠️ WRITE');

  // Query RFPL paid vouchers that are in G1 and still have no payment_reference
  const vch = await fetchAll('vouchers', q => q
    .select('id, serial_number, amount, payment_reference')
    .eq('company_id', 'relish-foods').eq('status', 'paid').is('payment_reference', null)
    .neq('payment_mode', 'Cash'));
  const eligible = vch.filter(v => G1_RFPL_SERIALS.has(v.serial_number));
  const vchById = Object.fromEntries(eligible.map(v => [v.id, v]));
  const eligIds = eligible.map(v => v.id);

  // Fetch attachments for eligible vouchers
  let att = [];
  for (let i = 0; i < eligIds.length; i += 400) {
    const rows = await fetchAll('voucher_attachments', q => q
      .select('id, voucher_id, file_name, public_url, mime_type')
      .eq('company_id', 'relish-foods').in('voucher_id', eligIds.slice(i, i + 400))
      .not('public_url', 'is', null));
    att = att.concat(rows);
  }

  // Skip vendor bill files by name
  const vendorBillKeywords = ['Matha Sanitary', 'Parayil Timber', 'PTI C'];
  const targets = att.filter(a => !vendorBillKeywords.some(k => (a.file_name || '').includes(k)));

  console.log('Eligible vouchers (no UTR yet):', eligible.length);
  console.log('Attachment files to retry:', targets.length, '\n');

  const results = [];
  for (let i = 0; i < targets.length; i++) {
    const a = targets[i];
    const v = vchById[a.voucher_id] || {};
    process.stdout.write('[' + String(i+1).padStart(2) + '/' + targets.length + '] ' + v.serial_number + ' ' + (a.file_name || '').slice(0, 50).padEnd(50) + ' ');

    let utr = null, ocrAmt = null, action = 'skip-no-utr', err = null;
    try {
      const hardTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('hard-timeout')), 40000));
      const ocr = await Promise.race([
        (async () => { const buf = await download(a.public_url); return ocrFile(buf, a.mime_type, a.file_name); })(),
        hardTimeout
      ]);
      ocrAmt = ocr.amount ?? null;
      const rawUtr = ocr.utr_number ? String(ocr.utr_number).trim().replace(/\s+/g, '') : null;
      if (!rawUtr || !isValidUTR(rawUtr)) {
        action = rawUtr ? 'skip-invalid-utr (' + rawUtr + ')' : 'skip-no-utr';
      } else {
        const ocrAmtN = parseFloat(ocrAmt), vchAmtN = parseFloat(v.amount);
        if (!isNaN(ocrAmtN) && !isNaN(vchAmtN) && Math.abs(ocrAmtN - vchAmtN) > 1) {
          action = 'hold-amount-mismatch vch=Rs.' + vchAmtN + ' ocr=Rs.' + ocrAmtN;
        } else {
          utr = rawUtr; action = 'write-candidate';
        }
      }
    } catch (e) { err = e.message; action = 'error-' + e.message.slice(0, 40); }

    console.log('→', action + (utr ? '  UTR:' + utr : ''));
    results.push({ serial: v.serial_number, amount: v.amount, fileName: a.file_name, utr, ocrAmt, action, err });

    if (!DRY_RUN && action === 'write-candidate' && utr) {
      await sb.from('vouchers').update({ payment_reference: utr }).eq('id', a.voucher_id).is('payment_reference', null);
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
    console.log('\n' + '═'.repeat(80));
    console.log('PROPOSED WRITES:');
    console.log('Serial              | Voucher ₹  | OCR ₹      | UTR');
    console.log('─'.repeat(80));
    writes.forEach(r => console.log(r.serial.padEnd(20), '|', String(r.amount).padEnd(11), '|', String(r.ocrAmt||'—').padEnd(11), '|', r.utr));
  }

  const outFile = path.join(__dirname, 'retry-g1-' + new Date().toISOString().slice(0,10) + '.json');
  fs.writeFileSync(outFile, JSON.stringify({ runAt: new Date().toISOString(), dryRun: DRY_RUN, results }, null, 2));
  console.log('\nSaved →', path.basename(outFile));
  console.log(DRY_RUN ? '✅ Dry-run done. Add --write to commit.' : '✅ Write pass done.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
