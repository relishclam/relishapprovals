'use strict';
require('dotenv').config();
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function download(url) {
  return new Promise((res, rej) => {
    const req = https.get(url, r => {
      const c = []; r.on('data', d => c.push(d)); r.on('end', () => res(Buffer.concat(c))); r.on('error', rej);
    });
    req.setTimeout(20000, () => { req.destroy(); rej(new Error('timeout')); });
    req.on('error', rej);
  });
}

async function rawOcr(buffer, fileName) {
  const resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      input: [{ role: 'user', content: [
        { type: 'input_file', filename: fileName, file_data: 'data:application/pdf;base64,' + buffer.toString('base64') },
        { type: 'input_text', text: 'Return the complete verbatim text visible in this document as JSON: {"text": "..."}' }
      ]}],
      text: { format: { type: 'json_object' } }
    })
  });
  const j = await resp.json();
  return JSON.parse(j.output?.[0]?.content?.[0]?.text || '{}').text || '(empty response)';
}

(async () => {
  // Sample 1: G1 type — Robin VCH 469.pdf from RFPL-att
  const { data: v1arr } = await sb.from('vouchers').select('id, serial_number, amount')
    .eq('serial_number', 'VCH-2026-27-00469').eq('company_id', 'relish-foods');
  const v1 = (v1arr || [])[0];
  const { data: att1 } = await sb.from('voucher_attachments').select('public_url, file_name, file_size_bytes').eq('voucher_id', v1.id).limit(1);
  const a1 = att1[0];
  console.log('\n=== SAMPLE 1: G1 (RFPL-att) ===');
  console.log('Voucher:', v1.serial_number, 'Rs.' + v1.amount);
  console.log('File:', a1.file_name, '|', a1.file_size_bytes, 'bytes');
  const buf1 = await download(a1.public_url);
  console.log('Downloaded:', buf1.length, 'bytes');
  const text1 = await rawOcr(buf1, a1.file_name);
  console.log('--- OCR text (first 700 chars) ---\n' + text1.slice(0, 700));

  // Sample 2: G2 type — receipt_1783158575255.pdf from RFPL-url (VCH-574)
  const { data: v2arr } = await sb.from('vouchers').select('id, serial_number, amount, payment_receipt_url')
    .eq('serial_number', 'VCH-2026-27-00574').eq('company_id', 'relish-foods');
  const v2 = (v2arr || [])[0];
  const fname2 = (v2.payment_receipt_url || '').split('/').pop();
  console.log('\n=== SAMPLE 2: G2 (RFPL-url) ===');
  console.log('Voucher:', v2.serial_number, 'Rs.' + v2.amount);
  console.log('File:', fname2);
  const buf2 = await download(v2.payment_receipt_url);
  console.log('Downloaded:', buf2.length, 'bytes');
  const text2 = await rawOcr(buf2, fname2);
  console.log('--- OCR text (first 700 chars) ---\n' + text2.slice(0, 700));

  // Sample 3: the 4x-reused receipt_1785498308215.pdf (VCH-606/609/610/611)
  const { data: v3arr } = await sb.from('vouchers').select('id, serial_number, amount, payment_receipt_url')
    .eq('serial_number', 'VCH-2026-27-00606').eq('company_id', 'relish-foods');
  const v3 = (v3arr || [])[0];
  const fname3 = (v3.payment_receipt_url || '').split('/').pop();
  console.log('\n=== SAMPLE 3: multiply-referenced file (VCH-606/609/610/611) ===');
  console.log('Voucher:', v3.serial_number, 'Rs.' + v3.amount);
  console.log('File:', fname3);
  const buf3 = await download(v3.payment_receipt_url);
  console.log('Downloaded:', buf3.length, 'bytes');
  const text3 = await rawOcr(buf3, fname3);
  console.log('--- OCR text (first 700 chars) ---\n' + text3.slice(0, 700));
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
