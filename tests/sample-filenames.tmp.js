'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // RFPL: sample 20 filenames
  const { data: rfplVch } = await sb.from('vouchers')
    .select('id, serial_number, amount')
    .eq('company_id', 'relish-foods').eq('status', 'paid')
    .is('payment_reference', null).neq('payment_mode', 'Cash').limit(500);
  const rfplIds = (rfplVch||[]).map(v=>v.id);
  const rfplById = Object.fromEntries((rfplVch||[]).map(v=>[v.id,v]));

  const { data: rfplAtt } = await sb.from('voucher_attachments')
    .select('voucher_id, file_name, mime_type, storage_path, public_url')
    .eq('company_id','relish-foods')
    .in('voucher_id', rfplIds.slice(0,400))
    .not('public_url','is',null).limit(30);

  console.log('--- RFPL: 20-row filename sample ---');
  for (const a of (rfplAtt||[]).slice(0,20)) {
    const v = rfplById[a.voucher_id]||{};
    console.log('  '+v.serial_number+' | Rs.'+v.amount+' | '+a.mime_type+' | '+a.file_name);
  }

  // Also check payment_receipt_url scope (alternate definition of "files to OCR")
  console.log('\n--- RFPL: vouchers WITH payment_receipt_url but NO payment_reference ---');
  const { data: withUrl } = await sb.from('vouchers')
    .select('id, serial_number, amount, payment_mode, payment_receipt_url')
    .eq('company_id','relish-foods').eq('status','paid')
    .not('payment_receipt_url','is',null)
    .is('payment_reference',null).neq('payment_mode','Cash').limit(10);
  console.log('Count: '+(withUrl||[]).length+' (showing up to 10)');
  for (const v of (withUrl||[])) {
    const url = (v.payment_receipt_url||'').split('/').slice(-1)[0];
    console.log('  '+v.serial_number+' | Rs.'+v.amount+' | '+v.payment_mode+' | ...'+url.slice(-40));
  }

  const { data: withUrlTotal } = await sb.from('vouchers')
    .select('id', {count:'exact',head:true})
    .eq('company_id','relish-foods').eq('status','paid')
    .not('payment_receipt_url','is',null)
    .is('payment_reference',null).neq('payment_mode','Cash');
  console.log('Total RFPL with receipt URL, no UTR:', withUrlTotal);

  console.log('\n--- RHHF: vouchers WITH payment_receipt_url but NO payment_reference ---');
  const { count: rhhfUrlCount } = await sb.from('vouchers')
    .select('id', {count:'exact',head:true})
    .eq('company_id','relish-hhc').eq('status','paid')
    .not('payment_receipt_url','is',null)
    .is('payment_reference',null).neq('payment_mode','Cash');
  console.log('Total RHHF with receipt URL, no UTR:', rhhfUrlCount);
}

main().catch(e=>{ console.error(e.message||e); process.exit(1); });
