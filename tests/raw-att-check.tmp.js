'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Raw RFPL attachment counts regardless of voucher status
  const { data: raw } = await sb.from('voucher_attachments')
    .select('id, voucher_id, file_name, mime_type, attachment_category, public_url')
    .eq('company_id','relish-foods').limit(30);
  console.log('RFPL voucher_attachments total sample:', (raw||[]).length);
  for (const a of (raw||[])) {
    console.log(' ', a.attachment_category||'null', '|', a.mime_type, '|', a.file_name);
  }

  // What IS the correct scope the user means?
  // Check: paid + payment_receipt_url NOT NULL + payment_reference NULL (the payment receipt files)
  const { data: urlRows } = await sb.from('vouchers')
    .select('id, serial_number, amount, payment_mode, payment_receipt_url')
    .eq('company_id','relish-foods').eq('status','paid')
    .not('payment_receipt_url','is',null)
    .is('payment_reference',null).neq('payment_mode','Cash');
  console.log('\nRFPL: paid + has receipt_url + no UTR:', (urlRows||[]).length, 'vouchers');
  for (const v of (urlRows||[]).slice(0,5)) {
    const fname = (v.payment_receipt_url||'').split('/').pop();
    console.log(' ', v.serial_number, v.payment_mode, 'Rs.'+v.amount, '|', fname.slice(-50));
  }

  const { data: rhhfUrlRows } = await sb.from('vouchers')
    .select('id, serial_number, amount, payment_mode, payment_receipt_url')
    .eq('company_id','relish-hhc').eq('status','paid')
    .not('payment_receipt_url','is',null)
    .is('payment_reference',null).neq('payment_mode','Cash');
  console.log('\nRHHF: paid + has receipt_url + no UTR:', (rhhfUrlRows||[]).length, 'vouchers');
  for (const v of (rhhfUrlRows||[]).slice(0,5)) {
    const fname = (v.payment_receipt_url||'').split('/').pop();
    console.log(' ', v.serial_number, v.payment_mode, 'Rs.'+v.amount, '|', fname.slice(-50));
  }
}
main().catch(e=>{ console.error(e.message||e); process.exit(1); });
