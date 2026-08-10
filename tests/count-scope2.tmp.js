'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // Total attachments per company regardless of voucher status
  for (const [label, cid] of [['RFPL', 'relish-foods'], ['RHHF', 'relish-hhc']]) {
    const { data: total, error } = await sb.from('voucher_attachments')
      .select('id, voucher_id, mime_type', { count: 'exact' })
      .eq('company_id', cid)
      .limit(5000);
    if (error) { console.log(label, 'error:', error.message); continue; }
    console.log(label + ' total voucher_attachments:', (total || []).length);

    // Paid vouchers IDs in batches
    const { data: vch } = await sb.from('vouchers')
      .select('id')
      .eq('company_id', cid)
      .eq('status', 'paid')
      .is('payment_receipt_url', null)
      .neq('payment_mode', 'Cash')
      .limit(2000);
    const ids = new Set((vch || []).map(v => v.id));
    console.log('  Paid non-Cash no-receipt-URL vouchers:', ids.size);
    const matched = (total || []).filter(a => ids.has(a.voucher_id));
    console.log('  Of those voucher_attachments that belong to above set:', matched.length);

    // Also count paid vouchers WITH payment_receipt_url that have no payment_reference
    const { data: withUrl } = await sb.from('vouchers')
      .select('id')
      .eq('company_id', cid)
      .eq('status', 'paid')
      .not('payment_receipt_url', 'is', null)
      .is('payment_reference', null)
      .neq('payment_mode', 'Cash')
      .limit(2000);
    console.log('  Paid non-Cash WITH receipt URL but NO UTR (payment_reference NULL):', (withUrl || []).length);
    console.log('');
  }
})();
