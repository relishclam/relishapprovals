'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Load dry-run JSON
const dryRunFile = path.join(__dirname, 'utr-dryrun-2026-08-10-v3.json');
const { results } = JSON.parse(fs.readFileSync(dryRunFile));
const skips = results.filter(r => r.action === 'skip-no-utr');
console.log(`\nTotal skip-no-utr rows: ${skips.length}\n`);

// Vendor bill filename patterns (supplier invoices, not payment receipts)
const VENDOR_BILL_PATTERNS = [
  /matha\s*sanitary/i, /jacob\s*john/i, /mahadeva/i, /mullasseri/i,
  /thiruvonnam/i, /parayil\s*timber/i, /b2b/i,
  /\..*-\s*\d{2,5}\s*[-–]\s*26/i,   // "Invoice 1530 -26.pdf" style
  /\d{4,}\s*[-–]\s*26-27/i,          // "HA 1012 26-27" style
  /\d{2}[-/.]\d{2}[-/.]\d{2,4}/i,    // date-in-name supplier docs
];
const VCH_RECEIPT_PATTERNS = [
  /vch[-\s]+\d{3,}/i,                // "Anil VCH 470.pdf"
  /transaction\s*summary/i,           // "Transaction Summary - VCH 471 Manu.pdf"
  /pmt[-\s]+\d{2}/i,                 // "VCH-2026-27-00608-PMT-31-Jul-2026.pdf"
  /^\d{16,}\.jpg$/i,                 // pure number screenshot filename
];

function classifyByName(fileName, source) {
  if (!fileName) return 'ocr_returned_null';
  const f = fileName.toLowerCase();
  // RFPL-att vendor bills: supplier-named files in bill attachment pool
  if (source === 'RFPL-att') {
    for (const p of VENDOR_BILL_PATTERNS) if (p.test(f)) return 'vendor_bill';
    // If filename matches a receipt pattern, it's an OCR failure
    for (const p of VCH_RECEIPT_PATTERNS) if (p.test(fileName)) return 'ocr_returned_null';
    // No clear pattern — could be vendor or receipt
    return 'ocr_returned_null';
  }
  return 'ocr_returned_null';
}

async function main() {
  // Fetch enrichment from DB: paid_at, file_size_bytes, storage_path
  // We need these from both voucher_attachments (RFPL-att) and vouchers (RFPL-url, RHHF-url)

  // Build serial → voucher map for paid_at and amount
  const serials = [...new Set(skips.map(r => r.serial))];
  const vchMap = {};
  for (let i = 0; i < serials.length; i += 400) {
    const { data } = await sb.from('vouchers')
      .select('serial_number, paid_at, amount, payment_mode')
      .in('serial_number', serials.slice(i, i + 400));
    for (const v of (data || [])) vchMap[v.serial_number] = v;
  }

  // Fetch file_size_bytes from voucher_attachments for RFPL-att rows
  const attFileNames = skips.filter(r => r.source === 'RFPL-att').map(r => r.fileName).filter(Boolean);
  const attMap = {};
  if (attFileNames.length > 0) {
    for (let i = 0; i < attFileNames.length; i += 400) {
      const { data } = await sb.from('voucher_attachments')
        .select('file_name, file_size_bytes, storage_path, mime_type')
        .in('file_name', attFileNames.slice(i, i + 400));
      for (const a of (data || [])) attMap[a.file_name] = a;
    }
  }

  // Enrich and classify
  const rows = skips.map(r => {
    const v = vchMap[r.serial] || {};
    const att = attMap[r.fileName] || {};
    const fileSizeBytes = att.file_size_bytes || null;
    const storagePath = att.storage_path || null;
    const paidAt = v.paid_at ? v.paid_at.slice(0, 10) : null;

    let reason;
    if (r.error) {
      reason = 'ocr_error';
    } else if (r.source === 'RFPL-att') {
      reason = classifyByName(r.fileName, 'RFPL-att');
    } else {
      // RFPL-url / RHHF-url: these are genuine payment receipts that failed OCR
      // Check if it might be a pre-acceptance Federal PDF by size (~95-115 KB)
      if (r.fileName && /\.pdf$/i.test(r.fileName) && fileSizeBytes && fileSizeBytes >= 90000 && fileSizeBytes <= 120000) {
        reason = 'pre_acceptance_pdf';
      } else {
        reason = 'ocr_returned_null';
      }
    }

    return {
      serial: r.serial,
      paid_at: paidAt,
      amount: r.amount,
      source: r.source,
      file_name: (r.fileName || '').slice(0, 55),
      file_size_kb: fileSizeBytes ? Math.round(fileSizeBytes / 1024) + ' KB' : '—',
      mime_type: (r.mimeType || att.mime_type || '').replace('application/', '').replace('image/', ''),
      reason,
    };
  });

  // Print table
  console.log('serial               | paid_at    | Rs.     | source   | file_name                                             | size    | type | reason');
  console.log('─'.repeat(175));
  for (const r of rows) {
    console.log(
      r.serial.padEnd(21) + '| ' +
      (r.paid_at || '—').padEnd(11) + '| ' +
      String(r.amount).padEnd(8) + '| ' +
      r.source.padEnd(9) + '| ' +
      r.file_name.padEnd(56) + '| ' +
      r.file_size_kb.padEnd(8) + '| ' +
      r.mime_type.padEnd(5) + '| ' +
      r.reason
    );
  }

  // Summary by reason
  const counts = {};
  for (const r of rows) counts[r.reason] = (counts[r.reason] || 0) + 1;
  console.log('\n── Breakdown by reason ──');
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(25)} ${v}`);
  }

  // Actionable subset: paid_at >= 2026-04-01, not vendor_bill, not pre_acceptance_pdf
  const actionable = rows.filter(r =>
    r.reason === 'ocr_returned_null' &&
    r.paid_at && r.paid_at >= '2026-04-01'
  );
  console.log(`\n── Actionable (ocr_returned_null, post-1-Apr-2026): ${actionable.length} rows ──`);
  for (const r of actionable) {
    console.log(`  ${r.serial}  paid ${r.paid_at}  Rs.${r.amount}  ${r.source}  ${r.file_name}`);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
