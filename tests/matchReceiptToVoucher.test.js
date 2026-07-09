/**
 * Unit tests for matchReceiptToVoucher helpers.
 *
 * Tests the three confirmed real-world receipt formats:
 *   1. "VCH-2026-27-00507"  — full dash-separated
 *   2. "VCH 2026 27 00478"  — full space-separated
 *   3. "VCH 510"            — abbreviated
 *
 * Also covers the API-failure-vs-no-match error path distinction.
 *
 * Coverage boundary (pure-function tests, no network or DB):
 *   ✅  extractVchNumbers     — string parsing, all formats + edge cases
 *   ✅  parseDbSerialSeq      — DB serial → integer, leading zeros, non-VCH
 *   ✅  simulateMatch         — end-to-end match/confidence logic (no I/O)
 *   ✅  _extractPdfText       — throws on corrupt buffer (real pdf-parse call)
 *   ✅  alphanumOnly          — normalization helper
 *
 * NOT covered here (require real network + credentials — see integration
 * checklist at the bottom of this file):
 *   ⬜  _extractImageText live GPT-4o Vision call
 *   ⬜  matchReceiptToVoucher with real Supabase voucher table
 *   ⬜  full end-to-end: real HDFC / Canara / Federal Bank PDF buffers
 *
 * Run with: node tests/matchReceiptToVoucher.test.js
 * (no test framework needed — pure Node, zero extra dependencies)
 */

'use strict';

// Prevent server-supabase.js from calling app.listen() when required as a module.
process.env.NODE_ENV = 'production';

const { _testHelpers } = require('../server-supabase');
const { extractVchNumbers, parseDbSerialSeq, alphanumOnly, _extractPdfText, _parseVchCapture } = _testHelpers;

let passed = 0;
let failed = 0;

function assert(description, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅  ${description}`);
    passed++;
  } else {
    console.error(`  ❌  ${description}`);
    console.error(`       expected: ${JSON.stringify(expected)}`);
    console.error(`       actual  : ${JSON.stringify(actual)}`);
    failed++;
  }
}

async function assertThrows(description, fn) {
  try {
    await fn();
    console.error(`  ❌  ${description} — expected an error to be thrown but none was`);
    failed++;
  } catch (_err) {
    console.log(`  ✅  ${description}`);
    passed++;
  }
}

// ---------------------------------------------------------------------------
// 1. extractVchNumbers — the three real formats
// ---------------------------------------------------------------------------
console.log('\n── extractVchNumbers ──────────────────────────────────────');

// Single-dash format — appears in GPay/UPI receipts because the app's tn= field
// uses serial_number (e.g. tn=Voucher VCH-2026-27-00507). Single dashes between
// digit groups are supported; double-dash page markers (-- 1 of 1) are blocked.
{
  const text = 'Remarks: VCH-2026-27-00507 NEFT payment';
  const hits = extractVchNumbers(text);
  assert('dash-separated: returns one hit', hits.length, 1);
  assert('dash-separated: seq === 507', hits[0]?.seq, 507);
  assert('dash-separated: raw preserved', hits[0]?.raw, 'VCH-2026-27-00507');
}

// Exact tn= field literal as rendered in GPay (the confirmed screenshot format)
{
  const text = 'Voucher VCH-2026-27-00507';
  const hits = extractVchNumbers(text);
  assert('GPay tn= literal: returns one hit', hits.length, 1);
  assert('GPay tn= literal: seq === 507', hits[0]?.seq, 507);
}

// Format 2: full space-separated
{
  const text = 'Note: VCH 2026 27 00478 payment received';
  const hits = extractVchNumbers(text);
  assert('space-separated: returns one hit', hits.length, 1);
  assert('space-separated: seq === 478', hits[0]?.seq, 478);
}

// Format 3: abbreviated (only sequence, no financial-year segment)
{
  const text = 'Note VCH 510 Transfer';
  const hits = extractVchNumbers(text);
  assert('abbreviated: returns one hit', hits.length, 1);
  assert('abbreviated: seq === 510', hits[0]?.seq, 510);
  assert('abbreviated: raw preserved', hits[0]?.raw, 'VCH 510');
}

// Case-insensitivity (using dash format which mirrors real UPI/GPay receipts)
{
  const text = 'voucher vch-2026-27-00507 payment';
  const hits = extractVchNumbers(text);
  assert('case-insensitive match', hits[0]?.seq, 507);
}

// No VCH in text at all
{
  const text = 'NEFT transfer complete. Amount: ₹5000. UTR: 12345678';
  const hits = extractVchNumbers(text);
  assert('no VCH → empty array', hits.length, 0);
}

// Multiple VCH references — function returns all, first is primary
{
  const text = 'VCH 100 and VCH 200 mentioned';
  const hits = extractVchNumbers(text);
  assert('multiple refs: returns both', hits.length, 2);
  assert('multiple refs: first seq === 100', hits[0]?.seq, 100);
  assert('multiple refs: second seq === 200', hits[1]?.seq, 200);
}

// Scrambled two-column PDF layout (worst-case interleaving)
{
  const text = 'To Current A/C From Savings\nNote VCH 510 Amount 5000\nBank: HDFC';
  const hits = extractVchNumbers(text);
  assert('two-column scrambled: still finds VCH 510', hits[0]?.seq, 510);
}

// HDFC receipts append "-- 1 of 1 --" page markers — must NOT bleed into VCH seq
{
  const text = 'Remark:\tVCH 437\n\n-- 1 of 1 --';
  const hits = extractVchNumbers(text);
  assert('HDFC page marker: seq === 437 (not 1)', hits[0]?.seq, 437);
  assert('HDFC page marker: raw is VCH 437', hits[0]?.raw, 'VCH 437');
}

// Dash format matches but page marker must not bleed
{
  const text = 'Note: VCH-2026-27-00507 -- 1 of 2 --';
  const hits = extractVchNumbers(text);
  assert('dash-format + page marker: seq === 507 (not 1 or 2)', hits[0]?.seq, 507);
}

// Generated alphanumeric key — no separator (what accounts staff paste from the app)
{
  const text = 'Remark: VCH437 bank transfer';
  const hits = extractVchNumbers(text);
  assert('alphanumeric key VCH437: returns one hit', hits.length, 1);
  assert('alphanumeric key VCH437: seq === 437', hits[0]?.seq, 437);
  assert('alphanumeric key VCH437: raw is VCH437', hits[0]?.raw, 'VCH437');
}

// Multi-space separator (column-aligned PDF text artifact from two-column layouts)
{
  const text = 'VCH   2026   27   00478';
  const hits = extractVchNumbers(text);
  assert('multi-space: returns one hit', hits.length, 1);
  assert('multi-space: seq === 478', hits[0]?.seq, 478);
}

// ── _parseVchCapture direct tests (year-compound vs multi-seq)
console.log('\n\u2500\u2500 _parseVchCapture \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
assert('compound with year: [478] only',                 JSON.stringify(_parseVchCapture(' 2026 27 00478')),                       JSON.stringify([478]));
assert('single seq 548: [548]',                          JSON.stringify(_parseVchCapture(' 548')),                                  JSON.stringify([548]));
assert('multi-seq 476 477 499: [476,477,499]',           JSON.stringify(_parseVchCapture(' 476 477 499')),                          JSON.stringify([476,477,499]));
assert('9-seq AK Musaliyar: length 9',                   _parseVchCapture(' 476 477 499 500 501 539 552 574 591').length,           9);

// ── extractVchNumbers multi-VCH remark (AK Musaliyar format)
console.log('\n\u2500\u2500 extractVchNumbers multi-VCH remark \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
{
  const text = 'Remark: VCH 476 477 499 500 501 539 552 574 591';
  const hits = extractVchNumbers(text);
  assert('multi-VCH: returns 9 hits', hits.length, 9);
  assert('multi-VCH: first seq === 476', hits[0]?.seq, 476);
  assert('multi-VCH: last seq === 591', hits[hits.length - 1]?.seq, 591);
  assert('multi-VCH: raw preserved on every hit', hits[3]?.raw, 'VCH 476 477 499 500 501 539 552 574 591');
}
{
  const text = 'Purpose: VCH 548 IMPS';
  const hits = extractVchNumbers(text);
  assert('Sibi format VCH 548: 1 hit, seq 548', hits.length === 1 && hits[0].seq === 548, true);
}
{
  const text = 'VCH 2026 27 00478 payment';
  const hits = extractVchNumbers(text);
  assert('year-compound: 1 hit, seq 478 (not 2026)', hits.length === 1 && hits[0].seq === 478, true);
}

// ---------------------------------------------------------------------------
// 2. parseDbSerialSeq — DB serial_number → integer
// ---------------------------------------------------------------------------
console.log('\n── parseDbSerialSeq ───────────────────────────────────────');

assert('VCH-2026-27-00507 → 507', parseDbSerialSeq('VCH-2026-27-00507'), 507);
assert('VCH-2026-27-00478 → 478', parseDbSerialSeq('VCH-2026-27-00478'), 478);
assert('VCH-2026-27-00510 → 510', parseDbSerialSeq('VCH-2026-27-00510'), 510);
assert('VCH-2026-27-00001 → 1   (leading zeros stripped)', parseDbSerialSeq('VCH-2026-27-00001'), 1);
assert('SUS-2026-27-00001 → null (not a VCH serial)', parseDbSerialSeq('SUS-2026-27-00001'), null);
assert('null input → null', parseDbSerialSeq(null), null);
assert('empty string → null', parseDbSerialSeq(''), null);

// ---------------------------------------------------------------------------
// 3. End-to-end matching logic (pure, no DB/API)
//    Simulates what matchReceiptToVoucher does after text extraction.
// ---------------------------------------------------------------------------
console.log('\n── end-to-end matching (pure logic, no DB/API) ────────────');

function simulateMatch(receiptText, candidateSerials) {
  const vchMatches = extractVchNumbers(receiptText);
  const primary = vchMatches[0] ?? null;
  if (!primary) return { confidence: 'none', matchedSerial: null };

  const allSeqs = [...new Set(vchMatches.map(m => m.seq))];
  const exactHits = candidateSerials.filter(s => allSeqs.includes(parseDbSerialSeq(s)));

  if (exactHits.length === 1) return { confidence: 'high', matchedSerial: exactHits[0] };
  return { confidence: 'low', matchedSerial: null };
}

// Dash format match (GPay/UPI receipts use this format)
{
  const candidates = ['VCH-2026-27-00505', 'VCH-2026-27-00507', 'VCH-2026-27-00510'];
  const result = simulateMatch('Voucher VCH-2026-27-00507', candidates);
  assert('dash-format → high confidence', result.confidence, 'high');
  assert('dash-format → correct serial', result.matchedSerial, 'VCH-2026-27-00507');
}

// Generated alphanumeric key (accounts staff pastes VCH437 into bank notes)
{
  const candidates = ['VCH-2026-27-00505', 'VCH-2026-27-00507', 'VCH-2026-27-00510'];
  const result = simulateMatch('Remark: VCH507', candidates);
  assert('alphanumeric key → high confidence', result.confidence, 'high');
  assert('alphanumeric key → correct serial', result.matchedSerial, 'VCH-2026-27-00507');
}

// Format 2 match
{
  const candidates = ['VCH-2026-27-00478', 'VCH-2026-27-00480'];
  const result = simulateMatch('Note: VCH 2026 27 00478', candidates);
  assert('format-2 → high confidence', result.confidence, 'high');
  assert('format-2 → correct serial', result.matchedSerial, 'VCH-2026-27-00478');
}

// Format 3 match (abbreviated)
{
  const candidates = ['VCH-2026-27-00508', 'VCH-2026-27-00510', 'VCH-2026-27-00512'];
  const result = simulateMatch('Note VCH 510 Transfer', candidates);
  assert('format-3 abbreviated → high confidence', result.confidence, 'high');
  assert('format-3 abbreviated → correct serial', result.matchedSerial, 'VCH-2026-27-00510');
}

// No match in candidate list → low (ref found, no DB hit)
{
  const candidates = ['VCH-2026-27-00100', 'VCH-2026-27-00200'];
  const result = simulateMatch('VCH 507', candidates);
  assert('ref found, not in queue → low', result.confidence, 'low');
}

// No VCH ref at all → none
{
  const candidates = ['VCH-2026-27-00507'];
  const result = simulateMatch('NEFT transfer UTR 123456789012', candidates);
  assert('no VCH ref in text → none', result.confidence, 'none');
}

// Multi-voucher remark → low confidence (multiple exact hits, user picks from list)
{
  const candidates = ['VCH-2026-27-00476', 'VCH-2026-27-00477', 'VCH-2026-27-00499', 'VCH-2026-27-00600'];
  const result = simulateMatch('Remark: VCH 476 477 499', candidates);
  assert('multi-VCH 3-way match → low (combined payment)', result.confidence, 'low');
  assert('multi-VCH 3-way match → no single matchedSerial', result.matchedSerial, null);
}

// ---------------------------------------------------------------------------
// 4. alphanumOnly sanity checks
// ---------------------------------------------------------------------------
console.log('\n── alphanumOnly ───────────────────────────────────────────');

assert('strips dashes', alphanumOnly('VCH-2026-27-00507'), 'VCH20262700507');
assert('strips spaces', alphanumOnly('VCH 2026 27 00478'), 'VCH20262700478');
assert('uppercase', alphanumOnly('vch510'), 'VCH510');

// ---------------------------------------------------------------------------
// 5. _extractPdfText error-path distinction (real pdf-parse, no network)
//
//    KEY INVARIANT: corrupt/unreadable PDFs must THROW — not return '' —
//    so matchReceiptToVoucher surfaces them as errors rather than silently
//    degrading to confidence:'none'.
//
//    An image-based PDF (valid parse, empty text) legitimately returns ''.
//    That case is only verifiable with a real image-based PDF file, so it
//    is listed in the integration checklist below rather than tested here.
// ---------------------------------------------------------------------------
console.log('\n── _extractPdfText error-path (corrupt buffers must throw) ');

(async () => {
  // 5a. Random garbage bytes — must throw
  await assertThrows(
    'corrupt bytes → throws (not silent confidence:none)',
    () => _extractPdfText(Buffer.from('this is definitely not a pdf')),
  );

  // 5b. Empty buffer — must throw
  await assertThrows(
    'empty buffer → throws',
    () => _extractPdfText(Buffer.alloc(0)),
  );

  // 5c. Plausible-looking PDF header but truncated — must throw
  await assertThrows(
    'truncated PDF header → throws',
    () => _extractPdfText(Buffer.from('%PDF-1.4 truncated garbage here')),
  );

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  ${passed} passed  |  ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }

  // ---------------------------------------------------------------------------
  // 6. Live integration tests (require OPENAI_API_KEY + running server)
  //    Run with: LIVE=1 node tests/matchReceiptToVoucher.test.js
  // ---------------------------------------------------------------------------
  if (process.env.LIVE !== '1') {
    console.log('\n── Integration tests skipped (set LIVE=1 to run) ────────\n');
    return;
  }

  console.log('\n── Live integration tests ────────────────────────────────');

  // 6a. OpenAI key present
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('  ❌  OPENAI_API_KEY not set — image OCR will always fail in production');
    process.exitCode = 1;
    return;
  }
  console.log('  ✅  OPENAI_API_KEY present (starts with', apiKey.slice(0, 10) + '...)');

  // 6b. pdf-parse loads and extracts text from a minimal text-based PDF
  {
    const minPdf = [
      '%PDF-1.4',
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj',
      '4 0 obj<</Length 44>>',
      'stream',
      'BT /F1 12 Tf 100 700 Td (VCH-2026-27-00123) Tj ET',
      'endstream',
      'endobj',
      '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
      'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000360 00000 n ',
      'trailer<</Size 6/Root 1 0 R>>',
      'startxref\n441',
      '%%EOF',
    ].join('\n');

    try {
      const text = await _extractPdfText(Buffer.from(minPdf));
      const hits = extractVchNumbers(text);
      if (hits.length === 1 && hits[0].seq === 123) {
        console.log('  ✅  pdf-parse: text-based PDF → extracted VCH-2026-27-00123 correctly');
      } else {
        console.error('  ❌  pdf-parse: extracted text did not contain VCH ref. Got:', JSON.stringify(text.slice(0, 100)));
        process.exitCode = 1;
      }
    } catch (e) {
      console.error('  ❌  pdf-parse threw on valid PDF:', e.message);
      process.exitCode = 1;
    }
  }

  // 6c. OpenAI Vision: send a minimal valid PNG and verify API connectivity
  //     (blank image is expected — this test just confirms key + network + model access)
  {
    // Known-good 1×1 white PNG (base64)
    const whitePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    try {
      const text = await require('../server-supabase')._testHelpers._extractImageText(whitePng, 'image/png');
      console.log('  ✅  OpenAI Vision API reachable — returned', text.length, 'chars for white PNG');
    } catch (e) {
      console.error('  ❌  OpenAI Vision call failed:', e.message);
      if (/api key/i.test(e.message) || /401/.test(e.message)) {
        console.error('       → OPENAI_API_KEY is invalid or not set in Vercel environment variables');
      }
      if (/timed out/i.test(e.message)) {
        console.error('       → Function timeout — check Vercel maxDuration setting in vercel.json');
      }
      process.exitCode = 1;
    }
  }

  console.log('\n─────────────────────────────────────────────────────────\n');
})();
