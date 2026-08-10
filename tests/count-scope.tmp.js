'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const pairs = [['RFPL', 'relish-foods'], ['RHHF', 'relish-hhc']];
  for (const [label, cid] of pairs) {
    const { data: vch } = await sb.from('vouchers')
      .select('id, payment_reference')
      .eq('company_id', cid)
      .eq('status', 'paid')
      .is('payment_receipt_url', null)
      .neq('payment_mode', 'Cash');
    const ids = (vch || []).map(v => v.id);
    const noUtr = (vch || []).filter(v => v.payment_reference === null).length;
    const hasUtr = ids.length - noUtr;
    const sentinel = ['00000000-0000-0000-0000-000000000000'];
    const { data: att } = await sb.from('voucher_attachments')
      .select('id, voucher_id, mime_type')
      .in('voucher_id', ids.length ? ids : sentinel);
    const total = (att || []).length;
    const imgs = (att || []).filter(a => a.mime_type && a.mime_type.startsWith('image/')).length;
    const pdfs = (att || []).filter(a => a.mime_type === 'application/pdf').length;
    const vchWithAtt = new Set((att || []).map(a => a.voucher_id)).size;
    console.log(label + ' —');
    console.log('  Paid non-Cash, no receipt URL:', ids.length, 'vouchers');
    console.log('    no UTR either:', noUtr, '  UTR already set:', hasUtr);
    console.log('  Bill attachments on those:', total, '(images:', imgs, ', pdfs:', pdfs, ')');
    console.log('  Vouchers WITH attachment:', vchWithAtt, '  Vouchers with NO attachment:', ids.length - vchWithAtt);
    console.log('');
  }
})();
