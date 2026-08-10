'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // Step 1: do these voucher serial numbers exist?
  const serials = [
    'VCH-2026-27-00643','VCH-2026-27-00644','VCH-2026-27-00645',
    'VCH-2026-27-00646','VCH-2026-27-00647','VCH-2026-27-00648',
    'VCH-2026-27-00653','VCH-2026-27-00654','VCH-2026-27-00655',
    'VCH-2026-27-00656','VCH-2026-27-00657'
  ];
  const { data: vch, error: vErr } = await sb.from('vouchers')
    .select('id, serial_number, company_id, status')
    .in('serial_number', serials);
  console.log('Voucher lookup:', vErr ? 'ERROR: ' + vErr.message : (vch||[]).length + ' found');
  for (const v of (vch||[])) console.log(' ', v.serial_number, v.company_id, v.status, v.id.slice(0,8));

  if (!vch || vch.length === 0) { console.log('No vouchers found — wrong serial numbers or wrong DB?'); return; }

  // Step 2: check voucher_attachments schema (what columns exist?)
  const { data: sample, error: sErr } = await sb.from('voucher_attachments')
    .select('*')
    .eq('voucher_id', vch[0].id)
    .limit(1);
  console.log('\nSample row for', vch[0].serial_number, ':', sErr ? 'ERROR: '+sErr.message : (sample||[]).length + ' rows');
  if (sample && sample[0]) console.log('Columns:', Object.keys(sample[0]).join(', '));

  // Step 3: raw count via counting all attachment rows for these IDs
  const ids = vch.map(v => v.id);
  let total = 0, from = 0;
  while (true) {
    const { data, error } = await sb.from('voucher_attachments')
      .select('id, voucher_id, attachment_category')
      .in('voucher_id', ids)
      .range(from, from + 999);
    if (error) { console.log('Error:', error.message); break; }
    total += (data||[]).length;
    if ((data||[]).length < 1000) break;
    from += 1000;
  }
  console.log('\nTotal attachment rows for these', ids.length, 'vouchers:', total);

  // Step 4: also check by company directly
  const { data: companyAtts } = await sb.from('voucher_attachments')
    .select('id, voucher_id, attachment_category')
    .eq('company_id', 'relish-hhc')
    .eq('attachment_category', 'transfer_receipt')
    .limit(10);
  console.log('\nSample RHHF transfer_receipt rows (any voucher):', (companyAtts||[]).length);
})();
