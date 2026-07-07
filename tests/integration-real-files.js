/**
 * Integration test runner for matchReceiptToVoucher.
 *
 * Runs against REAL files, REAL OpenAI API, and REAL Supabase DB.
 * Requires .env to be populated (OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY).
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 *   node tests/integration-real-files.js <file-path> <company-id> [--bad-api-key]
 *
 * ── Examples ─────────────────────────────────────────────────────────────────
 *
 *   # HDFC NEFT/RTGS PDF (checklist item 1)
 *   node tests/integration-real-files.js "C:\Downloads\receipt_1783150239180.pdf" RFPL
 *
 *   # Non-HDFC bank PDF — Canara or Federal (checklist item 2)
 *   node tests/integration-real-files.js "C:\Downloads\receipt_canara.pdf" RFPL
 *
 *   # Receipt image / screenshot (checklist item 3)
 *   node tests/integration-real-files.js "C:\Downloads\screenshot.png" RFPL
 *
 *   # Confirm error-vs-none distinction (checklist item 5):
 *   # Pass --bad-api-key to override the API key with an intentionally invalid
 *   # value.  This works on ALL shells (bash, PowerShell, cmd.exe) because the
 *   # override happens inside the script, not via a shell env-var prefix.
 *   node tests/integration-real-files.js "C:\Downloads\screenshot.png" RFPL --bad-api-key
 *
 *   NOTE for Windows users: the inline `OPENAI_API_KEY=bad node ...` syntax
 *   works in bash only.  On PowerShell use:
 *     $env:OPENAI_API_KEY='bad'; node tests/integration-real-files.js ...
 *   On cmd.exe use:
 *     set OPENAI_API_KEY=bad && node tests/integration-real-files.js ...
 *   Or just use the --bad-api-key flag above, which works everywhere.
 *
 * ── What it checks ────────────────────────────────────────────────────────────
 *
 *   Step 1 — Raw text extraction (pdf-parse or GPT-4o Vision)
 *     For PDFs: prints the FULL extracted text so you can visually confirm the
 *     VCH reference is intact and not scrambled by two-column layout.
 *     Empty result → image-based PDF confirmed; note for fast-follow.
 *   Step 2 — VCH reference detection in extracted text
 *   Step 3 — matchReceiptToVoucher() live Supabase query + full result
 *
 *   With --bad-api-key: confirms the OpenAI error is thrown as an Error
 *   (not silently swallowed as confidence:'none').
 *
 * Exit code 0 = all checks passed.  Exit code 1 = one or more failed.
 */

'use strict';

// Prevent server-supabase.js from calling app.listen() when required as a module.
process.env.NODE_ENV = 'production';

const fs   = require('fs');
const path = require('path');

const { _testHelpers, matchReceiptToVoucher } = require('../server-supabase');
const { extractVchNumbers, _extractPdfText, _extractImageText } = _testHelpers;

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
const args        = process.argv.slice(2);
const badApiKey   = args.includes('--bad-api-key');
const positional  = args.filter(a => !a.startsWith('--'));
const [filePath, companyId] = positional;

if (!filePath || !companyId) {
  console.error('Usage: node tests/integration-real-files.js <file-path> <company-id> [--bad-api-key]');
  process.exit(1);
}

const absPath = path.resolve(
  filePath.replace(/^~/, process.env.HOME || process.env.USERPROFILE || ''),
);

if (!fs.existsSync(absPath)) {
  console.error(`File not found: ${absPath}`);
  process.exit(1);
}

// Override API key BEFORE any module caches it at call-time.
// _extractImageText reads process.env.OPENAI_API_KEY on every invocation,
// so setting it here is sufficient.
if (badApiKey) {
  process.env.OPENAI_API_KEY = 'bad-key-intentionally-invalid-for-testing';
  console.log('\n⚠️  --bad-api-key set: OPENAI_API_KEY overridden with an invalid value.');
  console.log('   Expected result: OpenAI call throws an Error (NOT confidence:\'none\').\n');
}

// ---------------------------------------------------------------------------
// MIME type detection (by extension)
// ---------------------------------------------------------------------------
function detectMimeType(fp) {
  const ext = path.extname(fp).toLowerCase();
  return { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
           '.png': 'image/png', '.webp': 'image/webp' }[ext] ?? null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅  ${label}${detail ? '  →  ' + detail : ''}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${detail ? '  →  ' + detail : ''}`);
    failed++;
  }
}

async function assertThrowsCheck(label, fn, fragment) {
  try {
    await fn();
    console.error(`  ❌  ${label} — expected Error to be thrown but nothing was thrown`);
    failed++;
  } catch (err) {
    const msgOk = !fragment || err.message.includes(fragment);
    check(label, msgOk, `threw: "${err.message}"`);
  }
}

function section(title) {
  const pad = '─'.repeat(Math.max(0, 52 - title.length));
  console.log(`\n── ${title} ${pad}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  const fileBuffer = fs.readFileSync(absPath);
  const mimeType   = detectMimeType(absPath);

  console.log(`\nFile    : ${absPath}`);
  console.log(`Size    : ${fileBuffer.length.toLocaleString()} bytes`);
  console.log(`MIME    : ${mimeType ?? '(unknown extension)'}`);
  console.log(`Company : ${companyId}`);

  check('File is non-empty', fileBuffer.length > 0);
  check('MIME type recognised', mimeType !== null, mimeType ?? 'unrecognised extension');

  if (!mimeType) {
    console.error('\nCannot continue — unsupported file extension.');
    summarize();
    return;
  }

  // ── Step 1: Raw text extraction ──────────────────────────────────────────
  section('Step 1: Raw text extraction');

  let extractedText = '';

  if (mimeType === 'application/pdf') {
    try {
      extractedText = await _extractPdfText(fileBuffer);
      check('pdf-parse succeeded (valid PDF)', true);

      if (!extractedText) {
        check(
          'PDF has a selectable text layer',
          false,
          'EMPTY — image-based PDF confirmed.\n' +
          '        pdf-parse cannot extract text from this file.\n' +
          '        → Scope a first-page-render-to-JPEG fallback as a fast-follow.',
        );
        console.log('\n[integration] No VCH detection possible for image-based PDF.');
        summarize();
        return;
      }

      check('PDF text layer non-empty', true, `${extractedText.length} chars`);
      console.log('\n── Raw extracted text (full — check VCH reference is intact) ─');
      console.log(extractedText);
      console.log('── End of extracted text ─────────────────────────────────────');

    } catch (err) {
      check('pdf-parse succeeded', false, err.message);
      console.error('\n[integration] PDF parse failed — cannot continue.');
      summarize();
      return;
    }

  } else {
    // Image → GPT-4o Vision
    if (badApiKey) {
      // With a bad key we only want to confirm an Error is thrown, not succeed.
      await assertThrowsCheck(
        'Bad API key → _extractImageText throws Error (not confidence:\'none\')',
        () => _extractImageText(fileBuffer, mimeType),
        'OpenAI API error',
      );
      console.log('\n[integration] --bad-api-key check complete. Skipping further steps.');
      summarize();
      return;
    }

    try {
      console.log('\n  Calling GPT-4o Vision API… (may take 5–15 s)');
      extractedText = await _extractImageText(fileBuffer, mimeType);
      check('GPT-4o Vision call succeeded', true);
      check('GPT-4o returned non-empty text', extractedText.length > 0, `${extractedText.length} chars`);

      console.log('\n── GPT-4o extracted text ─────────────────────────────────────');
      console.log(extractedText);
      console.log('── End of extracted text ─────────────────────────────────────');

    } catch (err) {
      check('GPT-4o Vision call succeeded', false, err.message);
      console.error('\n[integration] Image OCR failed — cannot continue.');
      summarize();
      return;
    }
  }

  // ── Step 2: VCH reference detection ──────────────────────────────────────
  section('Step 2: VCH reference detection');

  const vchHits = extractVchNumbers(extractedText);
  check(
    'At least one VCH reference found in extracted text',
    vchHits.length > 0,
    vchHits.length > 0
      ? vchHits.map(h => `${h.raw} (seq=${h.seq})`).join(', ')
      : 'None — inspect raw text above; check Note/Remarks/Narration field',
  );

  if (vchHits.length > 1) {
    console.log(`  ℹ️   Multiple refs: ${vchHits.map(h => h.raw).join(', ')} — first will be used as primary`);
  }

  // ── Step 3: Full matchReceiptToVoucher (live DB) ──────────────────────────
  section('Step 3: matchReceiptToVoucher — live Supabase query');
  console.log(`  Querying vouchers for company "${companyId}"…`);

  let result;
  try {
    result = await matchReceiptToVoucher(fileBuffer, mimeType, companyId);
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
      'extractedReference' in result &&
      Array.isArray(result.candidateVouchers),
    `confidence=${result.confidence} matchedVoucherId=${result.matchedVoucherId ?? '(none)'}`,
  );
  check(
    'confidence is high / low / none',
    ['high', 'low', 'none'].includes(result.confidence),
    result.confidence,
  );

  console.log('\n── matchReceiptToVoucher result ──────────────────────────────');
  console.log('  confidence        :', result.confidence);
  console.log('  matchedVoucherId  :', result.matchedVoucherId ?? '(none)');
  console.log('  extractedReference:', result.extractedReference ?? '(none)');
  console.log('  candidateVouchers :', result.candidateVouchers.length, 'in queue');
  result.candidateVouchers.forEach(v =>
    console.log(`    • ${v.serial_number}  status=${v.status}  amount=${v.amount}`),
  );

  if (result.confidence === 'high' && result.matchedVoucherId) {
    check('high confidence → matchedVoucherId is set', true, result.matchedVoucherId);
  } else if (result.confidence === 'none' && vchHits.length === 0) {
    console.log('  ℹ️   confidence:none expected — no VCH reference in extracted text.');
  } else if (result.confidence === 'low') {
    if (result.candidateVouchers.length === 0) {
      console.log('  ℹ️   confidence:low — VCH ref found but no vouchers currently in awaiting_payment/completed queue.');
    } else {
      console.log('  ℹ️   confidence:low — VCH ref found but matched 0 or >1 vouchers.');
    }
  }

  summarize();
})();

function summarize() {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  ${passed} passed  |  ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}
