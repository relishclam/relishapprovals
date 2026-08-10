'use strict';
// Apply the 4 approved writes from the v3 dry-run directly — no re-OCR needed.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const APPROVED = [
  { serial: 'VCH-2026-27-00497', utr: '616150244330',          source: 'RFPL-att' },
  { serial: 'VCH-2026-27-00502', utr: '616317910866',          source: 'RFPL-att' },
  { serial: 'VCH-2026-27-00507', utr: '616316908975',          source: 'RFPL-att' },
  { serial: 'VCH-2026-27-00478', utr: 'HDFCR52026070177940911', source: 'RHHF-url' },
];

(async () => {
  console.log('Writing 4 approved UTRs...\n');
  for (const row of APPROVED) {
    // Pre-check: verify payment_reference is still null (never-overwrite)
    const { data: vch } = await sb.from('vouchers')
      .select('id, serial_number, payment_reference, amount')
      .eq('serial_number', row.serial).single();

    if (!vch) { console.log('  SKIP', row.serial, '— voucher not found'); continue; }
    if (vch.payment_reference) {
      console.log('  SKIP', row.serial, '— already has ref:', vch.payment_reference);
      continue;
    }

    const { error } = await sb.from('vouchers')
      .update({ payment_reference: row.utr })
      .eq('serial_number', row.serial)
      .is('payment_reference', null);

    if (error) { console.log('  ERROR', row.serial, error.message); continue; }
    console.log('  WRITTEN', row.serial, '| UTR:', row.utr, '| ₹' + vch.amount + ' |', row.source);
  }

  // Verify
  console.log('\nVerification SELECT:');
  for (const row of APPROVED) {
    const { data } = await sb.from('vouchers')
      .select('serial_number, payment_reference').eq('serial_number', row.serial).single();
    console.log(' ', data?.serial_number, '→', data?.payment_reference || 'NULL (write failed)');
  }
})().catch(e => { console.error(e.message); process.exit(1); });
