'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fetchAll(table, qfn) {
  const PAGE = 1000; let all = [], from = 0;
  while (true) {
    const { data, error } = await qfn(sb.from(table)).range(from, from + PAGE - 1);
    if (error) { console.error('fetchAll error:', error.message); return all; }
    all = all.concat(data || []);
    if ((data || []).length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// Phantom voucher serials to exclude (copyTransferReceiptsToVoucher bug)
const PHANTOM_SERIALS = new Set([
  'VCH-2026-27-00643','VCH-2026-27-00644','VCH-2026-27-00645',
  'VCH-2026-27-00646','VCH-2026-27-00647','VCH-2026-27-00648',
  'VCH-2026-27-00653','VCH-2026-27-00654','VCH-2026-27-00655',
  'VCH-2026-27-00656','VCH-2026-27-00657'
]);

async function main() {
  for (const [label, cid] of [['RFPL','relish-foods'], ['RHHF','relish-hhc']]) {
    const vch = await fetchAll('vouchers', q => q
      .select('id, serial_number, amount, payment_mode')
      .eq('company_id', cid)
      .eq('status', 'paid')
      .is('payment_reference', null)
      .neq('payment_mode', 'Cash'));

    const eligible = vch.filter(v => !PHANTOM_SERIALS.has(v.serial_number));
    const eligibleIds = eligible.map(v => v.id);
    const vchById = Object.fromEntries(eligible.map(v => [v.id, v]));

    let att = [];
    for (let i = 0; i < eligibleIds.length; i += 400) {
      const chunk = eligibleIds.slice(i, i + 400);
      const rows = await fetchAll('voucher_attachments', q => q
        .select('id, voucher_id, file_name, public_url, mime_type, attachment_category')
        .eq('company_id', cid)
        .in('voucher_id', chunk)
        .not('public_url', 'is', null));
      att = att.concat(rows);
    }

    const imgs = att.filter(a => a.mime_type && a.mime_type.startsWith('image/')).length;
    const pdfs = att.filter(a => a.mime_type === 'application/pdf').length;
    const distinctVch = new Set(att.map(a => a.voucher_id)).size;

    console.log('\n=== ' + label + ' ===');
    console.log('Eligible paid non-Cash no-UTR vouchers: ' + eligible.length);
    console.log('Bill attachments:                       ' + att.length + '  (imgs: ' + imgs + ', pdfs: ' + pdfs + ')');
    console.log('Distinct vouchers with attachment:      ' + distinctVch);
    console.log('Estimated OCR cost @ $0.009/file:       $' + (att.length * 0.009).toFixed(2));

    if (label === 'RHHF') {
      console.log('\n--- RHHF: 10-row filename sample ---');
      for (const a of att.slice(0, 10)) {
        const v = vchById[a.voucher_id] || {};
        console.log('  ' + (v.serial_number || '?') + ' | Rs.' + v.amount + ' | ' + a.mime_type + ' | ' + a.file_name);
      }
    }
  }
}

main().catch(e => { console.error('Fatal:', e.message || e); process.exit(1); });
