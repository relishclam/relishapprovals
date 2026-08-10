/**
 * Dry-run UTR extraction pass — 75 files (RFPL + RHHF)
 * Task L prompt, HDFC-extended validator, amount guard ±₹1.
 * Writes nothing — outputs proposal JSON only.
 *
 *   node tests/utr-extraction-dryrun.tmp.js [--write]
 *
 * Add --write flag ONLY after approving the dry-run output.
 */
'use strict';
process.env.NODE_ENV = 'production';
require('dotenv').config();

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const DRY_RUN = !process.argv.includes('--write');
const OUT_FILE = path.join(__dirname, `utr-dryrun-${new Date().toISOString().slice(0,10)}-v4.json`);

// ─── Validator ────────────────────────────────────────────────────────────────
function isValidUTR(ref) {
  if (!ref) return false;
  const s = String(ref).trim().replace(/\s+/g, '');
  if (s.length < 7) return false;
  // Standard 7–16 alphanumeric (IMPS/NEFT/UPI/RRN/SBI)
  if (/^[A-Z0-9]{7,16}$/i.test(s)) return true;
  // HDFC RTGS/NEFT/IMPS: HDFC + type-letter + alphanumeric tail, total 15–25 chars
  if (/^HDFC[A-Z][A-Z0-9]{9,20}$/i.test(s)) return true;
  return false;
}

// ─── HTTP download with 30s socket timeout ───────────────────────────────────
function download(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0)
        return download(res.headers.location, redirects - 1).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('download timeout 30s')); });
    req.on('error', reject);
  });
}

// ─── Task L OCR prompt ────────────────────────────────────────────────────────
const TASK_L_PROMPT =
  'Extract from this bank/UPI transfer receipt and return a JSON object with these exact keys:\n' +
  '- raw_text: all visible text verbatim (preserve line breaks as \\n)\n' +
  '- utr_number: the payment reference number. Search exhaustively — every bank prints it differently:\n' +
  '  • NEFT/RTGS banks: "UTR", "UTR No", "UTR Number", "NEFT UTR"\n' +
  '  • Any bank: "Transaction Reference", "Transaction Ref", "Transaction No",\n' +
  '    "Ref No", "Reference No", "Reference Number", "Ref Number"\n' +
  '  • IMPS: "IMPS Ref No", "IMPS Reference", "RRN", "RRN Number"\n' +
  '  • UPI apps (Google Pay, PhonePe, Paytm, BHIM):\n' +
  '    "UPI Transaction ID", "Transaction ID", "Google Transaction ID",\n' +
  '    "UPI Ref", "UPI Reference", a standalone 12-digit number\n' +
  '  • HDFC Bank: starts with HDFC then a letter (e.g. HDFCR5202607…)\n' +
  '  • SBI: may be 7–10 alphanumeric chars, sometimes "S" + digits\n' +
  '  • Federal Bank: "Transaction Reference", "Ref", a bare alphanumeric code\n' +
  '  Accept: 7–25 alphanumeric characters, OR any HDFC-prefixed ref.\n' +
  '  Return the FIRST valid reference found. Return null only if truly absent.\n' +
  '- amount: payment amount as a plain number (e.g. 15000.00)\n' +
  '- beneficiary_name: who the payment was sent to\n' +
  '- initiator_account_number: sender account number or UPI ID\n' +
  '- bank_name: bank that processed the transaction\n' +
  '- transaction_date: YYYY-MM-DD if visible\n' +
  'Set each field to null if not visible. Return JSON only.';

// ─── OCR call ─────────────────────────────────────────────────────────────────
async function ocrFile(buffer, mimeType, fileName) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set');
  if (buffer.length > 10 * 1024 * 1024) throw new Error('file > 10 MB');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  let parsed;

  try {
    if (mimeType === 'application/pdf') {
      const resp = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',  // gpt-4o is too slow for large PDFs; mini handles in ~3s
          input: [{ role: 'user', content: [
            { type: 'input_file', filename: fileName || 'receipt.pdf', file_data: `data:application/pdf;base64,${buffer.toString('base64')}` },
            { type: 'input_text', text: TASK_L_PROMPT },
          ]}],
          text: { format: { type: 'json_object' } },
        }),
      });
      clearTimeout(timeout);
      if (!resp.ok) { const t = await resp.text(); throw new Error(`Responses API ${resp.status}: ${t.slice(0,200)}`); }
      const json = await resp.json();
      const content = json.output?.[0]?.content?.[0]?.text;
      if (!content) throw new Error('empty API response');
      parsed = JSON.parse(content);
    } else {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o', max_tokens: 600,
          messages: [
            { role: 'system', content: 'You are a financial document parser. Extract transaction details. Return JSON only.' },
            { role: 'user', content: [
              { type: 'text', text: TASK_L_PROMPT },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${buffer.toString('base64')}`, detail: 'high' } },
            ]},
          ],
          response_format: { type: 'json_object' },
        }),
      });
      clearTimeout(timeout);
      if (!resp.ok) { const t = await resp.text(); throw new Error(`Chat API ${resp.status}: ${t.slice(0,200)}`); }
      const json = await resp.json();
      parsed = JSON.parse(json.choices?.[0]?.message?.content || '{}');
    }
  } catch (e) { clearTimeout(timeout); throw e; }

  return parsed;
}

// ─── Amount guard ─────────────────────────────────────────────────────────────
function amountGuard(ocrAmount, voucherAmount) {
  const ocr = parseFloat(ocrAmount);
  const vch = parseFloat(voucherAmount);
  if (isNaN(ocr) || isNaN(vch)) return 'no-ocr-amount';
  return Math.abs(ocr - vch) <= 1 ? 'match' : `MISMATCH vch=Rs.${vch} ocr=Rs.${ocr}`;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`UTR Extraction Dry-Run — ${new Date().toISOString()}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (propose only)' : '⚠️  WRITE MODE'}`);
  console.log(`${'═'.repeat(70)}\n`);

  const PHANTOM = new Set([
    'VCH-2026-27-00643','VCH-2026-27-00644','VCH-2026-27-00645',
    'VCH-2026-27-00646','VCH-2026-27-00647','VCH-2026-27-00648',
    'VCH-2026-27-00653','VCH-2026-27-00654','VCH-2026-27-00655',
    'VCH-2026-27-00656','VCH-2026-27-00657'
  ]);

  // ── Build target list ──────────────────────────────────────────────────────
  const targets = []; // { voucherId, serial, amount, source, url, fileName, mimeType }

  for (const [cid, label] of [['relish-foods','RFPL'],['relish-hhc','RHHF']]) {
    const vch = await fetchAll('vouchers', q => q
      .select('id, serial_number, amount, payment_mode, payment_receipt_url')
      .eq('company_id', cid).eq('status','paid')
      .is('payment_reference', null).neq('payment_mode','Cash'));

    const eligible = vch.filter(v => !PHANTOM.has(v.serial_number));
    const vchById = Object.fromEntries(eligible.map(v => [v.id, v]));

    if (label === 'RFPL') {
      // Pool A: voucher_attachments (payee-named payment receipts)
      const eligIds = eligible.map(v => v.id);
      let att = [];
      for (let i = 0; i < eligIds.length; i += 400) {
        const chunk = eligIds.slice(i, i + 400);
        const rows = await fetchAll('voucher_attachments', q => q
          .select('id, voucher_id, file_name, public_url, mime_type')
          .eq('company_id', cid).in('voucher_id', chunk)
          .not('public_url','is',null));
        att = att.concat(rows);
      }
      for (const a of att) {
        const v = vchById[a.voucher_id];
        if (!v || !a.public_url) continue;
        targets.push({ voucherId: v.id, serial: v.serial_number, amount: v.amount,
          source: 'RFPL-att', url: a.public_url, fileName: a.file_name, mimeType: a.mime_type });
      }
      // Pool B: payment_receipt_url files (PMT/receipt_ named)
      for (const v of eligible.filter(v => v.payment_receipt_url)) {
        const fname = v.payment_receipt_url.split('/').pop();
        const mime = fname.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        targets.push({ voucherId: v.id, serial: v.serial_number, amount: v.amount,
          source: 'RFPL-url', url: v.payment_receipt_url, fileName: fname, mimeType: mime });
      }
    }

    if (label === 'RHHF') {
      // Pool C: payment_receipt_url files only (4 vouchers)
      for (const v of eligible.filter(v => v.payment_receipt_url)) {
        const fname = v.payment_receipt_url.split('/').pop();
        const mime = fname.endsWith('.pdf') ? 'application/pdf'
          : fname.match(/\.(jpg|jpeg)$/i) ? 'image/jpeg' : 'image/png';
        targets.push({ voucherId: v.id, serial: v.serial_number, amount: v.amount,
          source: 'RHHF-url', url: v.payment_receipt_url, fileName: fname, mimeType: mime });
      }
      // RHHF voucher_attachments: confirmed vendor bills — skip
    }
  }

  console.log(`Total targets: ${targets.length}`);
  console.log(`Estimated cost: $${(targets.length * 0.009).toFixed(2)}\n`);

  // ── Process each file ──────────────────────────────────────────────────────
  const results = [];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    process.stdout.write(`[${(i+1).toString().padStart(3)}/${targets.length}] ${t.serial} ${t.source} ${t.fileName?.slice(0,50)?.padEnd(50)} `);

    let row = { serial: t.serial, amount: t.amount, source: t.source,
                fileName: t.fileName, utr: null, ocrAmount: null,
                amtGuard: null, action: null, error: null };

    try {
      const processFile = async () => {
        const buf = await download(t.url);
        const ocr = await ocrFile(buf, t.mimeType, t.fileName);
        return ocr;
      };
      const hardTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('hard-timeout-40s')), 40000));
      const ocr = await Promise.race([processFile(), hardTimeout]);

      row.ocrAmount = ocr.amount ?? null;
      row.amtGuard = amountGuard(ocr.amount, t.amount);

      const rawUtr = ocr.utr_number ?? null;
      const utr = rawUtr ? String(rawUtr).trim().replace(/\s+/g,'') : null;

      if (!utr) {
        row.action = 'skip-no-utr';
      } else if (!isValidUTR(utr)) {
        row.utr = utr;
        row.action = `skip-invalid-utr (${utr})`;
      } else if (row.amtGuard !== 'match' && row.amtGuard !== 'no-ocr-amount') {
        row.utr = utr;
        row.action = 'hold-amount-mismatch';
      } else {
        row.utr = utr;
        row.action = 'write-candidate';
      }
    } catch (err) {
      row.error = err.message;
      row.action = 'error-' + err.message.slice(0, 40);
    }

    console.log(`→ ${row.action}${row.utr ? '  UTR:'+row.utr : ''}`);
    results.push(row);

    // ── Write mode ──────────────────────────────────────────────────────────
    if (!DRY_RUN && row.action === 'write-candidate' && row.utr) {
      const { error } = await sb.from('vouchers')
        .update({ payment_reference: row.utr })
        .eq('serial_number', row.serial)
        .is('payment_reference', null); // never-overwrite guard
      row.written = !error;
      if (error) row.writeError = error.message;
    }

    await sleep(400); // rate-limit: ~2.5 req/s
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const byAction = {};
  for (const r of results) byAction[r.action] = (byAction[r.action]||0)+1;

  console.log(`\n${'─'.repeat(70)}`);
  console.log('Summary:');
  for (const [k,v] of Object.entries(byAction)) console.log(`  ${k.padEnd(35)} ${v}`);
  console.log(`${'─'.repeat(70)}`);

  const writeCount = results.filter(r => r.action === 'write-candidate').length;
  const holdCount  = results.filter(r => r.action === 'hold-amount-mismatch').length;
  console.log(`\nWrite candidates: ${writeCount}`);
  console.log(`Holds (amt mismatch): ${holdCount}`);

  // ── Proposal table ─────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(70)}`);
  console.log('PROPOSED WRITES (write-candidates only):');
  console.log('Serial              | Voucher Rs.  | OCR Rs.      | UTR                     | Source');
  console.log('─'.repeat(95));
  for (const r of results.filter(r => r.action === 'write-candidate')) {
    console.log(
      r.serial.padEnd(20) + '| ' +
      String(r.amount).padEnd(13) + '| ' +
      String(r.ocrAmount??'—').padEnd(13) + '| ' +
      (r.utr||'—').padEnd(25) + '| ' + r.source
    );
  }

  if (holdCount > 0) {
    console.log(`\n${'─'.repeat(95)}`);
    console.log('HOLDS (amount mismatch — review manually):');
    for (const r of results.filter(r => r.action === 'hold-amount-mismatch')) {
      console.log(
        r.serial.padEnd(20) + '| ' +
        String(r.amount).padEnd(13) + '| ' +
        String(r.ocrAmount??'—').padEnd(13) + '| ' +
        (r.utr||'—').padEnd(25) + '| ' + r.amtGuard
      );
    }
  }

  // ── Save JSON ──────────────────────────────────────────────────────────────
  fs.writeFileSync(OUT_FILE, JSON.stringify({ runAt: new Date().toISOString(), dryRun: DRY_RUN, results }, null, 2));
  console.log(`\nFull results saved → ${path.basename(OUT_FILE)}`);
  console.log(DRY_RUN ? '\n✅ Dry-run complete. Add --write flag to commit.' : '\n✅ Write pass complete.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
