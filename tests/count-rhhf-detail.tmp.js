'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fetchAll(table, query_fn) {
  const PAGE = 1000; let all = [], from = 0;
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
  const [label, cid] = ['RHHF', 'relish-hhc'];
  const vch = await fetchAll('vouchers',
    q => q.select('id, serial_number, payment_reference, payment_receipt_url')
          .eq('company_id', cid).eq('status', 'paid').neq('payment_mode', 'Cash').is('payment_receipt_url', null));
  const noReceiptIds = new Set(vch.map(v => v.id));
  const vchById = Object.fromEntries(vch.map(v => [v.id, v]));

  const att = await fetchAll('voucher_attachments',
    q => q.select('id, voucher_id, mime_type, file_name, public_url').eq('company_id', cid));
  const onTarget = att.filter(a => noReceiptIds.has(a.voucher_id));

  // Count per voucher
  const perVch = {};
  for (const a of onTarget) {
    if (!perVch[a.voucher_id]) perVch[a.voucher_id] = [];
    perVch[a.voucher_id].push(a);
  }

  const sorted = Object.entries(perVch).sort((a, b) => b[1].length - a[1].length);
  console.log('Top 20 RHHF vouchers by attachment count:');
  for (const [vid, atts] of sorted.slice(0, 20)) {
    const v = vchById[vid] || {};
    const imgs = atts.filter(a => a.mime_type && a.mime_type.startsWith('image/')).length;
    const pdfs = atts.filter(a => a.mime_type === 'application/pdf').length;
    console.log(' ', v.serial_number || vid.slice(0, 8), '|', atts.length, 'total (imgs:', imgs, 'pdfs:', pdfs + ')');
  }

  // Overall size distribution
  const buckets = { '1': 0, '2-5': 0, '6-20': 0, '21+': 0 };
  for (const [, atts] of Object.entries(perVch)) {
    const n = atts.length;
    if (n === 1) buckets['1']++;
    else if (n <= 5) buckets['2-5']++;
    else if (n <= 20) buckets['6-20']++;
    else buckets['21+']++;
  }
  console.log('\nVoucher attachment count distribution:', JSON.stringify(buckets));
  console.log('Total RHHF attachments in target set:', onTarget.length);
  console.log('Images:', onTarget.filter(a => a.mime_type && a.mime_type.startsWith('image/')).length);
  console.log('PDFs:', onTarget.filter(a => a.mime_type === 'application/pdf').length);
})();
