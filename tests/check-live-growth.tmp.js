'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const targets = [
    'VCH-2026-27-00643','VCH-2026-27-00644','VCH-2026-27-00645',
    'VCH-2026-27-00646','VCH-2026-27-00647','VCH-2026-27-00648',
    'VCH-2026-27-00653','VCH-2026-27-00654','VCH-2026-27-00655',
    'VCH-2026-27-00656','VCH-2026-27-00657'
  ];

  const { data: vch } = await sb.from('vouchers')
    .select('id, serial_number, created_at')
    .in('serial_number', targets);

  const ids = (vch || []).map(v => v.id);
  const vchMap = Object.fromEntries((vch || []).map(v => [v.id, v]));

  // Paginate to get true counts
  const PAGE = 1000; let all = [], from = 0;
  while (true) {
    const { data } = await sb.from('voucher_attachments')
      .select('id, voucher_id, attachment_category, created_at')
      .in('voucher_id', ids)
      .range(from, from + PAGE - 1);
    all = all.concat(data || []);
    if ((data || []).length < PAGE) break;
    from += PAGE;
  }

  // Group
  const perVch = {};
  for (const a of all) {
    if (!perVch[a.voucher_id]) perVch[a.voucher_id] = [];
    perVch[a.voucher_id].push(a);
  }

  const now = Date.now();
  console.log('\nVoucher | Total | transfer_receipt | oldest_att | newest_att | still-growing?');
  console.log('─'.repeat(110));
  for (const v of (vch || []).sort((a,b) => a.serial_number.localeCompare(b.serial_number))) {
    const atts = perVch[v.id] || [];
    const tr = atts.filter(a => a.attachment_category === 'transfer_receipt');
    const dates = tr.map(a => a.created_at).sort();
    const oldest = dates[0] ? new Date(dates[0]).toISOString().slice(0,19) : '—';
    const newest = dates[dates.length-1] ? new Date(dates[dates.length-1]).toISOString().slice(0,19) : '—';
    const newestMs = dates[dates.length-1] ? new Date(dates[dates.length-1]).getTime() : 0;
    const minutesAgo = newestMs ? Math.floor((now - newestMs) / 60000) : 999999;
    const live = minutesAgo < 60 ? '🔴 LIVE (<1h ago)' : minutesAgo < 1440 ? `⚠️  ${Math.floor(minutesAgo/60)}h ago` : `✅ ${Math.floor(minutesAgo/1440)}d ago`;
    console.log(`${v.serial_number} | ${atts.length.toString().padStart(5)} | ${tr.length.toString().padStart(16)} | ${oldest} | ${newest} | ${live}`);
  }
  console.log('\nTotal phantom transfer_receipt rows:', all.filter(a=>a.attachment_category==='transfer_receipt').length);
})();
