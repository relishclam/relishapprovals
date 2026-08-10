'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const serials = [
    'VCH-2026-27-00643','VCH-2026-27-00644','VCH-2026-27-00645',
    'VCH-2026-27-00646','VCH-2026-27-00647','VCH-2026-27-00648',
    'VCH-2026-27-00653','VCH-2026-27-00654','VCH-2026-27-00655',
    'VCH-2026-27-00656','VCH-2026-27-00657'
  ];
  const { data: vch } = await sb.from('vouchers')
    .select('id, serial_number').in('serial_number', serials);
  const ids = (vch||[]).map(v => v.id);
  const vchMap = Object.fromEntries((vch||[]).map(v => [v.id, v.serial_number]));

  let all = [], from = 0;
  while (true) {
    const { data } = await sb.from('voucher_attachments')
      .select('id, voucher_id, attachment_category, uploaded_at')
      .in('voucher_id', ids).range(from, from + 999);
    all = all.concat(data||[]);
    if ((data||[]).length < 1000) break;
    from += 1000;
  }

  const now = Date.now();
  const perVch = {};
  for (const a of all) {
    if (!perVch[a.voucher_id]) perVch[a.voucher_id] = [];
    perVch[a.voucher_id].push(a);
  }

  console.log('\nVoucher          | Total |  TR copies | oldest TR (UTC)     | newest TR (UTC)     | growing?');
  console.log('─'.repeat(110));
  for (const s of serials) {
    const v = (vch||[]).find(x => x.serial_number === s);
    if (!v) continue;
    const atts = perVch[v.id] || [];
    const tr = atts.filter(a => a.attachment_category === 'transfer_receipt');
    const dates = tr.map(a => a.uploaded_at).filter(Boolean).sort();
    const oldest = dates[0] ? dates[0].slice(0,19) : '—';
    const newest = dates[dates.length-1] ? dates[dates.length-1].slice(0,19) : '—';
    const newestMs = dates[dates.length-1] ? new Date(dates[dates.length-1]).getTime() : 0;
    const minsAgo = newestMs ? Math.floor((now - newestMs)/60000) : 999999;
    const flag = minsAgo < 60 ? '🔴 <1h ago — LIVE' : minsAgo < 1440 ? `⚠️  ${Math.floor(minsAgo/60)}h ago` : `✅ ${Math.floor(minsAgo/1440)}d ago`;
    console.log(`${s} | ${atts.length.toString().padStart(5)} | ${tr.length.toString().padStart(10)} | ${oldest} | ${newest} | ${flag}`);
  }
  console.log('\nTotal phantom TR rows:', all.filter(a=>a.attachment_category==='transfer_receipt').length);
  console.log('Total attachment rows:', all.length);
})();
