/**
 * Fetch a real payment receipt from Supabase storage and run it through the
 * full matchReceiptToVoucher pipeline.
 *
 * This covers integration checklist items 1 (HDFC PDF text extraction) and
 * 4 (live Supabase voucher query) in a single command — no manual file
 * download required.
 *
 * Usage:
 *   node tests/integration-fetch-from-db.js [companyId]
 *
 * companyId is optional — if omitted, the script queries all companies and
 * uses the first paid voucher with a PDF receipt it finds.
 *
 * Examples:
 *   node tests/integration-fetch-from-db.js
 *   node tests/integration-fetch-from-db.js RFPL
 */

'use strict';

// Prevent server-supabase.js from calling app.listen() when required as a module.
process.env.NODE_ENV = 'production';

require('dotenv').config();
const https   = require('https');
const http    = require('http');
const path    = require('path');
const { createClient } = require('@supabase/supabase-js');

const { _testHelpers, matchReceiptToVoucher } = require('../server-supabase');
const { extractVchNumbers, _extractPdfText } = _testHelpers;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const [, , companyArg] = process.argv;

let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) { console.log(`  ✅  ${label}${detail ? '  →  ' + detail : ''}`); passed++; }
  else    { console.error(`  ❌  ${label}${detail ? '  →  ' + detail : ''}`); failed++; }
}
function section(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 52 - t.length))}`); }
function summarize() {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  ${passed} passed  |  ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

/** Download a URL into a Buffer. */
function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow one redirect
        return downloadUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  section('Find a paid voucher with a PDF payment receipt');

  let query = supabase
    .from('vouchers')
    .select('id, serial_number, company_id, payment_receipt_url, status')
    .eq('status', 'paid')
    .not('payment_receipt_url', 'is', null)
    .ilike('payment_receipt_url', '%.pdf')
    .order('paid_at', { ascending: false })
    .limit(5);

  if (companyArg) query = query.eq('company_id', companyArg);

  const { data: vouchers, error: dbErr } = await query;

  if (dbErr) { check('Supabase query succeeded', false, dbErr.message); summarize(); return; }
  check('Supabase query succeeded', true, `${(vouchers || []).length} paid PDF receipt(s) found`);

  if (!vouchers || vouchers.length === 0) {
    console.log('\n  No paid vouchers with a .pdf payment_receipt_url found.');
    if (!companyArg) console.log('  Tip: try passing a specific companyId: node tests/integration-fetch-from-db.js RFPL');
    summarize();
    return;
  }

  const voucher = vouchers[0];
  console.log(`\n  Using voucher : ${voucher.serial_number} (${voucher.company_id})`);
  console.log(`  Receipt URL   : ${voucher.payment_receipt_url}`);

  // ── Step 1: Download the PDF ─────────────────────────────────────────────
  section('Step 1: Download PDF from storage');

  let pdfBuffer;
  try {
    pdfBuffer = await downloadUrl(voucher.payment_receipt_url);
    check('PDF downloaded', true, `${pdfBuffer.length.toLocaleString()} bytes`);
  } catch (err) {
    check('PDF downloaded', false, err.message);
    summarize();
    return;
  }

  // ── Step 2: Raw text extraction via pdf-parse ────────────────────────────
  section('Step 2: pdf-parse text extraction');

  let extractedText = '';
  try {
    extractedText = await _extractPdfText(pdfBuffer);
    check('pdf-parse succeeded (valid PDF)', true);

    if (!extractedText) {
      check(
        'PDF has a selectable text layer',
        false,
        'EMPTY — image-based PDF confirmed.\n' +
        '        This bank\'s portal embeds the receipt as an image rather than\n' +
        '        real text.  pdf-parse cannot help here.\n' +
        '        → Scope a first-page-render-to-JPEG fallback as a fast-follow.',
      );
      summarize();
      return;
    }

    check('PDF text layer non-empty', true, `${extractedText.length} chars`);
    console.log('\n── Raw extracted text (full) ──────────────────────────────');
    console.log(extractedText);
    console.log('── End of extracted text ──────────────────────────────────');

  } catch (err) {
    check('pdf-parse succeeded', false, err.message);
    summarize();
    return;
  }

  // ── Step 3: VCH reference detection ─────────────────────────────────────
  section('Step 3: VCH reference detection in extracted text');

  const vchHits = extractVchNumbers(extractedText);
  check(
    'VCH reference found',
    vchHits.length > 0,
    vchHits.length > 0
      ? vchHits.map(h => `${h.raw} (seq=${h.seq})`).join(', ')
      : 'None — inspect raw text above for the Note/Remarks/Narration field',
  );

  // ── Step 4: Full matchReceiptToVoucher — live DB query ───────────────────
  section('Step 4: matchReceiptToVoucher — live Supabase query');
  console.log(`  Company: ${voucher.company_id}`);

  let result;
  try {
    result = await matchReceiptToVoucher(pdfBuffer, 'application/pdf', voucher.company_id);
  } catch (err) {
    check('matchReceiptToVoucher completed without throwing', false, err.message);
    summarize();
    return;
  }

  check('matchReceiptToVoucher completed without throwing', true);
  check(
    'Result has all required fields',
    typeof result.confidence === 'string' &&
      'matchedVoucherId' in result &&
      Array.isArray(result.candidateVouchers),
    `confidence=${result.confidence}`,
  );

  console.log('\n── matchReceiptToVoucher result ───────────────────────────');
  console.log('  confidence        :', result.confidence);
  console.log('  matchedVoucherId  :', result.matchedVoucherId ?? '(none)');
  console.log('  extractedReference:', result.extractedReference ?? '(none)');
  console.log('  candidateVouchers :', result.candidateVouchers.length, 'in awaiting_payment/completed queue');
  result.candidateVouchers.forEach(v =>
    console.log(`    • ${v.serial_number}  status=${v.status}  amount=${v.amount}`),
  );

  if (result.confidence === 'high' && result.matchedVoucherId) {
    const matchedSerial = result.candidateVouchers.find(v => v.id === result.matchedVoucherId)?.serial_number;
    check('confidence:high with a matched voucher', true, matchedSerial ?? result.matchedVoucherId);
  } else if (result.confidence === 'none') {
    console.log(
      '\n  ℹ️   confidence:none — VCH reference was not found in the extracted text, OR',
      '\n       this voucher\'s serial_number is not currently in the payment queue.',
      '\n       The receipt for', voucher.serial_number, 'is already "paid"; it won\'t appear',
      '\n       in the candidateVouchers list (which filters for awaiting_payment/completed only).',
      '\n       This is expected for historical receipts — see note below.',
    );
  } else if (result.confidence === 'low') {
    console.log('  ℹ️   confidence:low — VCH ref found but either matched 0 or >1 candidates in queue.');
  }

  // ── Interpreting confidence:none on a historical receipt ─────────────────
  if (result.confidence === 'none' || result.candidateVouchers.length === 0) {
    console.log(`
── Note on testing against historical (already-paid) receipts ─────
  The receipt for ${voucher.serial_number} belongs to a voucher that is
  already 'paid'. matchReceiptToVoucher queries ONLY vouchers with status
  'awaiting_payment' or 'completed' (the live payment queue).

  For a full end-to-end confidence:high result, you need a receipt
  whose voucher is CURRENTLY in the payment queue (awaiting_payment or
  completed with no receipt yet). 

  What this run DOES prove:
    • pdf-parse correctly extracted text from the PDF  ${extractedText ? '✅' : '❌'}
    • extractVchNumbers found (or did not find) a VCH reference  
    • The Supabase query ran successfully (no DB errors)
  That covers items 1 and partial 4. Item 4 (confidence:high against a
  live queue entry) requires a receipt for a voucher in the live queue.
────────────────────────────────────────────────────────────────────`);
  }

  summarize();
})();
