'use strict';
require('dotenv').config();
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data } = await sb.from('voucher_attachments')
    .select('public_url,file_name').eq('company_id','relish-foods')
    .eq('file_name','Matha Sanitary Centre 1530 -26.pdf').limit(1);
  const url = data?.[0]?.public_url;

  // Download PDF
  const buf = await new Promise((res, rej) => {
    const req = https.get(url, r => {
      const c = [];
      r.on('data', d => c.push(d));
      r.on('end', () => res(Buffer.concat(c)));
      r.on('error', rej);
    });
    req.setTimeout(15000, () => { req.destroy(); rej(new Error('dl timeout')); });
    req.on('error', rej);
  });
  console.log('Downloaded:', buf.length, 'bytes');

  // Test Chat Completions API (NOT Responses API) — send PDF as base64 text, ask for JSON
  const start = Date.now();
  console.log('Calling Chat Completions API...');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  const pdfB64 = buf.toString('base64');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', signal: controller.signal,
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Is this a bank payment receipt (containing a UTR/transaction ID)? Answer only: YES or NO, and the transaction ID if found.' },
          { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfB64}`, detail: 'low' } }
        ]
      }],
    }),
  });
  clearTimeout(timer);
  console.log('API response status:', resp.status, 'in', Date.now()-start, 'ms');
  const j = await resp.json();
  console.log('Answer:', j.choices?.[0]?.message?.content || j.error?.message || JSON.stringify(j).slice(0,200));
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
