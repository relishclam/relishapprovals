'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fetchAll(table, query_fn) {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const { data, error } = await query_fn(sb.from(table)).range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if ((data || []).length < PAGE) break;
    from += PAGE;
  }
  return all;
}

(async () => {
  for (const [label, cid] of [['RFPL', 'relish-foods'], ['RHHF', 'relish-hhc']]) {
    // All voucher_attachments for this company
    const allAtt = await fetchAll('voucher_attachments',
      q => q.select('id, voucher_id, mime_type, public_url').eq('company_id', cid));

    // All paid non-Cash vouchers, split by receipt URL and UTR
    const allVch = await fetchAll('vouchers',
      q => q.select('id, payment_reference, payment_receipt_url')
            .eq('company_id', cid).eq('status', 'paid').neq('payment_mode', 'Cash'));

    const noReceiptUrl = allVch.filter(v => !v.payment_receipt_url);
    const noReceiptUrlIds = new Set(noReceiptUrl.map(v => v.id));
    const noUtrNoReceipt = noReceiptUrl.filter(v => !v.payment_reference).length;
    const hasUtrNoReceipt = noReceiptUrl.filter(v => v.payment_reference).length;

    const withReceiptNoUtr = allVch.filter(v => v.payment_receipt_url && !v.payment_reference);

    const attOnNoReceipt = allAtt.filter(a => noReceiptUrlIds.has(a.voucher_id));
    const imgs = attOnNoReceipt.filter(a => a.mime_type && a.mime_type.startsWith('image/')).length;
    const pdfs = attOnNoReceipt.filter(a => a.mime_type === 'application/pdf').length;
    const vchWithAtt = new Set(attOnNoReceipt.map(a => a.voucher_id)).size;

    console.log('=== ' + label + ' ===');
    console.log('Paid non-Cash total:', allVch.length);
    console.log('  No receipt URL:', noReceiptUrl.length, '  (no UTR either:', noUtrNoReceipt, '| UTR set:', hasUtrNoReceipt + ')');
    console.log('  Has receipt URL but no UTR:', withReceiptNoUtr.length);
    console.log('Bill attachments on no-receipt-URL vouchers:', attOnNoReceipt.length, '(imgs:', imgs, 'pdfs:', pdfs + ')');
    console.log('  Distinct vouchers with >=1 attachment:', vchWithAtt);
    console.log('');
  }
})();
