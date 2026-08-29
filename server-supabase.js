require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
// pdf-parse is fully replaced by the OpenAI Responses API for PDF extraction.
// _extractPdfText() is retained but hard-guarded; it must never run in production.
const webpush = require('web-push');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static('public'));

// ── Web Share Target fallback (Migration: SW-not-active safety net) ──────────
// Temporary in-memory store for receipts shared when the service worker was not
// yet controlling the page (first install, SW update transition, etc.).
// The service worker normally intercepts POST /share-target entirely; this path
// only runs when the request escapes the SW and reaches the server.
const _serverSharePending = new Map(); // sid → { base64Data, mimeType, fileName, expires }
setInterval(() => {
  const _now = Date.now();
  for (const [_sid, _val] of _serverSharePending) {
    if (_val.expires < _now) _serverSharePending.delete(_sid);
  }
}, 120_000);

// Minimal multipart/form-data parser — extracts named parts from a raw Buffer.
function _parseMultipart(buf, boundary) {
  const parts = [];
  const _delim = Buffer.from('\r\n--' + boundary);
  const _first = Buffer.from('--' + boundary);
  let _pos = buf.indexOf(_first);
  if (_pos < 0) return parts;
  _pos += _first.length;
  while (_pos < buf.length) {
    // End marker: --boundary--
    if (buf[_pos] === 0x2d && buf[_pos + 1] === 0x2d) break;
    // Skip the CRLF after the boundary line
    if (buf[_pos] === 0x0d && buf[_pos + 1] === 0x0a) _pos += 2;
    const _end = buf.indexOf(_delim, _pos);
    if (_end < 0) break;
    const _partBuf = buf.slice(_pos, _end);
    const _hdrEnd = _partBuf.indexOf(Buffer.from('\r\n\r\n'));
    if (_hdrEnd >= 0) {
      const _hdrs = _partBuf.slice(0, _hdrEnd).toString('utf8');
      const _body = _partBuf.slice(_hdrEnd + 4);
      const _part = { data: _body };
      const _cdName = _hdrs.match(/Content-Disposition:[^\r\n]*name="([^"]+)"/i);
      if (_cdName) _part.name = _cdName[1];
      const _cdFile = _hdrs.match(/Content-Disposition:[^\r\n]*filename="([^"]+)"/i);
      if (_cdFile) _part.filename = _cdFile[1];
      const _ct = _hdrs.match(/Content-Type:\s*([^\r\n]+)/i);
      if (_ct) _part.contentType = _ct[1].trim();
      parts.push(_part);
    }
    _pos = _end + _delim.length;
  }
  return parts;
}

// POST /share-target — server-side fallback when the service worker was not active.
// The manifest share_target sends multipart/form-data here; the SW normally intercepts
// it before it reaches the network.  When the SW is absent (first install, update
// transition), this handler stashes the file and redirects to /?incoming-share=1&sid=…
// so the app can retrieve it via GET /api/share-pending/:sid.
app.post('/share-target', express.raw({ type: '*/*', limit: '10mb' }), (req, res) => {
  try {
    const _ct = req.headers['content-type'] || '';
    const _bm = _ct.match(/boundary=([^\s;]+)/);
    if (!_bm) return res.redirect(303, '/');
    const _parts = _parseMultipart(req.body, _bm[1]);
    const _file = _parts.find(p => p.name === 'receipt' && p.data && p.data.length > 0);
    if (!_file) return res.redirect(303, '/');
    const { v4: uuidv4 } = require('uuid');
    const _sid = uuidv4();
    _serverSharePending.set(_sid, {
      base64Data: _file.data.toString('base64'),
      mimeType: _file.contentType || 'application/octet-stream',
      fileName: _file.filename || 'receipt',
      expires: Date.now() + 5 * 60 * 1000,
    });
    return res.redirect(303, `/?incoming-share=1&sid=${_sid}`);
  } catch (_e) {
    console.error('POST /share-target error:', _e.message);
    return res.redirect(303, '/');
  }
});

// GET /api/share-pending/:sid — consume-once retrieval for the server-stashed share.
// Called by the app when /_share_pending (SW cache) is empty but a ?sid= param exists.
app.get('/api/share-pending/:sid', (req, res) => {
  const _entry = _serverSharePending.get(req.params.sid);
  if (!_entry || _entry.expires < Date.now()) {
    _serverSharePending.delete(req.params.sid);
    return res.status(404).json({ error: 'no pending share' });
  }
  _serverSharePending.delete(req.params.sid);
  res.json({ mimeType: _entry.mimeType, base64Data: _entry.base64Data, fileName: _entry.fileName });
});

// Supabase Configuration
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_KEY');
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// MSG91 Configuration
if (!process.env.MSG91_AUTH_KEY) {
  console.warn('⚠️ WARNING: MSG91_AUTH_KEY not set — SMS/OTP will fail');
}
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_OTP_TEMPLATE_ID = process.env.MSG91_OTP_TEMPLATE_ID; // DLT-registered OTP template ID
const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID || 'RHHF';
const MSG91_FLOW_ID = process.env.MSG91_FLOW_ID || '6a856298c46183266e086f33'; // Pramaana-Payment-OTP
const MSG91_ATTENDANCE_FLOW_ID = process.env.MSG91_ATTENDANCE_FLOW_ID || '6a8ba63303742d5709066592'; // Relish_OTP — contract labour attendance
const MSG91_WHATSAPP_NUMBER = process.env.MSG91_WHATSAPP_NUMBER;
const MSG91_BASE_URL = 'https://api.msg91.com/api/v5';

// WebAuthn (Passkey) Configuration
// WEBAUTHN_RP_ID    = registrable domain of the app, e.g. relishvoucher.vercel.app  (no https://)
// WEBAUTHN_ORIGIN   = full origin, e.g. https://relishvoucher.vercel.app
// For local dev: WEBAUTHN_RP_ID=localhost  WEBAUTHN_ORIGIN=http://localhost:3001
const WEBAUTHN_RP_NAME = 'Relish Approvals';
const WEBAUTHN_RP_ID   = process.env.WEBAUTHN_RP_ID   || 'relishvoucher.vercel.app';
const WEBAUTHN_ORIGIN  = process.env.WEBAUTHN_ORIGIN  || 'https://relishvoucher.vercel.app';

// Web Push Configuration (VAPID Keys)
// Generate your own keys using: npx web-push generate-vapid-keys
// Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in your environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

// Configure web-push (only if VAPID keys are set)
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@relishfoods.in',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  console.warn('⚠️ VAPID keys not configured - Push notifications will be disabled');
}

// Store OTP sessions in Supabase (for serverless compatibility)
// Helper functions for OTP session management
const saveOtpSession = async (mobile, sessionId, purpose, voucherId = null, suspenseId = null) => {
  // Delete any existing session for this mobile
  await supabase.from('otp_sessions').delete().eq('mobile', mobile);
  
  // Insert new session
  const { error } = await supabase.from('otp_sessions').insert({
    mobile,
    session_id: sessionId,
    purpose,
    voucher_id: voucherId,
    ...(suspenseId ? { suspense_id: suspenseId } : {})
  });
  
  if (error) console.error('Error saving OTP session:', error);
  return !error;
};

const getOtpSession = async (mobile, voucherId = null) => {
  let query = supabase.from('otp_sessions')
    .select('*')
    .eq('mobile', mobile)
    .order('created_at', { ascending: false });

  // When a voucherId is provided, fetch only the session tied to that voucher
  // (prevents a newer login OTP from shadowing the payee-verification session)
  if (voucherId) {
    query = query.eq('voucher_id', voucherId);
  }

  const { data, error } = await query.limit(1).single();

  if (error || !data) return null;
  
  // Check if session is expired (15 minutes)
  const createdAt = new Date(data.created_at).getTime();
  if (Date.now() - createdAt > 15 * 60 * 1000) {
    await supabase.from('otp_sessions').delete().eq('id', data.id);
    return null;
  }
  
  return { sessionId: data.session_id, purpose: data.purpose, voucherId: data.voucher_id };
};

const deleteOtpSession = async (mobile) => {
  await supabase.from('otp_sessions').delete().eq('mobile', mobile);
};

// WebAuthn challenge helpers (serverless-safe, stored in DB with 5-min expiry)
const saveWebAuthnChallenge = async (userId, challenge, type) => {
  await supabase.from('webauthn_challenges').delete().eq('user_id', userId).eq('type', type);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await supabase.from('webauthn_challenges').insert({ user_id: userId, challenge, type, expires_at: expiresAt });
  if (error) console.error('Error saving WebAuthn challenge:', error);
  return !error;
};

const getAndDeleteWebAuthnChallenge = async (userId, type) => {
  const { data, error } = await supabase.from('webauthn_challenges')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  await supabase.from('webauthn_challenges').delete().eq('id', data.id);
  return data.challenge;
};

// Look up a challenge by its value (used for company_select tokens)
const getAndDeleteChallengeByValue = async (challengeValue, type) => {
  const { data, error } = await supabase.from('webauthn_challenges')
    .select('*')
    .eq('challenge', challengeValue)
    .eq('type', type)
    .gt('expires_at', new Date().toISOString())
    .single();
  if (error || !data) return null;
  await supabase.from('webauthn_challenges').delete().eq('id', data.id);
  return data; // returns full row including user_id
};

// Format mobile number for MSG91 API (needs 91XXXXXXXXXX format)
const formatMobile = (mobile) => {
  // Remove any non-digit characters
  let cleaned = mobile.replace(/\D/g, '');
  // Ensure we have 91 prefix
  if (cleaned.length === 10) {
    // Add country code if only 10 digits
    cleaned = '91' + cleaned;
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    // Already has country code, keep as is
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    // Remove leading 0 and add 91
    cleaned = '91' + cleaned.substring(1);
  }
  return cleaned;
};

const generateSettlementToken = () => {
  return crypto.randomBytes(24).toString('hex');
};

const sendMsg91Sms = async (mobile, message) => {
  if (!mobile) return { success: false, error: 'No mobile number provided' };
  const formattedMobile = formatMobile(mobile);
  console.log(`\n📩 Sending SMS to ${formattedMobile}`);

  try {
    const response = await fetch(`${MSG91_BASE_URL}/flow/`, {
      method: 'POST',
      headers: { authkey: MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flow_id: MSG91_FLOW_ID,
        sender: MSG91_SENDER_ID,
        mobiles: formattedMobile,
        VAR1: message
      })
    });
    const data = await response.json();
    console.log(`   SMS Response: ${JSON.stringify(data)}`);
    return { success: data.type === 'success', data };
  } catch (error) {
    console.log(`   SMS Error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Send WhatsApp template message via MSG91 — positional params map to {{1}}, {{2}}, ...
const sendWhatsApp = async (mobile, templateName, ...params) => {
  if (!mobile) return { success: false, error: 'No mobile number provided' };
  const to = formatMobile(mobile);
  console.log(`\n📲 WhatsApp [${templateName}] → ${to}`);
  try {
    const response = await fetch(`${MSG91_BASE_URL}/whatsapp/whatsapp-outbound-message/bulk/`, {
      method: 'POST',
      headers: { authkey: MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integrated_number: MSG91_WHATSAPP_NUMBER,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text: String(text) })) }]
          }
        }
      })
    });
    const data = await response.json();
    console.log(`   WA Response: ${JSON.stringify(data)}`);
    const success = data.type === 'success';
    if (success) console.log(`   ✅ Delivered`); else console.log(`   ❌ Failed: ${JSON.stringify(data)}`);
    return { success, data };
  } catch (error) {
    console.log(`   WA Error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// RBAC helper: returns { role, is_super_admin } for a given user id
const getActorRole = async (userId) => {
  if (!userId) return {};
  const { data } = await supabase.from('users')
    .select('role, is_super_admin')
    .eq('id', userId)
    .single();
  return data || {};
};

// Send OTP via MSG91 Flow API — OTP generated and verified locally
const callMsg91OtpSend = async (mobile, description, { name = '', amount = '', flowId = MSG91_FLOW_ID } = {}) => {
  console.log(`\n📱 MSG91 SEND OTP: ${description}`);
  console.log(`   Mobile: ${mobile}`);
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const otp = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    const salt = crypto.randomBytes(16).toString('hex');
    const hashHex = crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
    const sessionId = `${salt}:${hashHex}`;

    const response = await fetch(`${MSG91_BASE_URL}/flow/`, {
      method: 'POST',
      headers: { authkey: MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flow_id: flowId,
        sender: MSG91_SENDER_ID,
        // otp/VAR1 = {{otp}}/{{VAR1}} templates; number = ##number## (Relish_OTP); MSG91 also uses it for routing confirmation
        recipients: [{ mobiles: mobile, otp, VAR1: otp, number: otp, ...(name ? { name } : {}), ...(amount ? { amount } : {}) }],
      }),
    });
    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data)}`);
    const success = data.type === 'success';
    if (success) console.log(`   ✅ SUCCESS`); else console.log(`   ❌ FAILED: ${JSON.stringify(data)}`);
    return { success, sessionId, data };
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Verify OTP locally using salt:hash stored in session
const callMsg91OtpVerify = async (otp, stored, description) => {
  console.log(`\n🔐 VERIFY OTP (local): ${description}`);
  try {
    const [salt, existingHash] = stored.split(':');
    if (!salt || !existingHash) return { success: false };
    const computed = crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
    if (existingHash.length !== computed.length) return { success: false };
    let diff = 0;
    for (let i = 0; i < existingHash.length; i++) diff |= existingHash.charCodeAt(i) ^ computed.charCodeAt(i);
    const success = diff === 0;
    if (success) console.log(`   ✅ OTP matched`); else console.log(`   ❌ OTP mismatch`);
    return { success };
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Debug endpoint to check OTP sessions
app.get('/api/debug/otp-sessions', async (req, res) => {
  try {
    const { data, error } = await supabase.from('otp_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    const sessions = data.map(s => ({
      mobile: s.mobile.replace(/\d(?=\d{4})/g, '*'),
      purpose: s.purpose,
      sessionId: s.session_id.substring(0, 8) + '...',
      createdAt: s.created_at,
      ageSeconds: Math.floor((Date.now() - new Date(s.created_at).getTime()) / 1000)
    }));
    
    res.json({ activeSessions: sessions.length, sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ API ROUTES ============

// Debug endpoint to verify MSG91 configuration
app.get('/api/debug/test-msg91', async (req, res) => {
  res.json({
    authKeyConfigured: !!MSG91_AUTH_KEY,
    authKeyPrefix: MSG91_AUTH_KEY ? MSG91_AUTH_KEY.substring(0, 8) + '...' : 'NOT SET',
    otpTemplateId: MSG91_OTP_TEMPLATE_ID || 'NOT SET',
    flowId: MSG91_FLOW_ID,
    attendanceFlowId: MSG91_ATTENDANCE_FLOW_ID,
    senderId: MSG91_SENDER_ID
  });
});

// Test payment OTP to a specific mobile — returns full MSG91 response for diagnosis
app.get('/api/debug/test-payment-otp', async (req, res) => {
  const { mobile, name = 'Test Payee', amount = '5000' } = req.query;
  if (!mobile) return res.status(400).json({ error: 'mobile query param required' });
  const formatted = formatMobile(mobile);
  const result = await callMsg91OtpSend(formatted, 'DEBUG test payment OTP', { name, amount, flowId: MSG91_FLOW_ID });
  res.json({ formatted, flowId: MSG91_FLOW_ID, senderId: MSG91_SENDER_ID, result });
});

// Debug endpoint to test voucher and payee data
app.get('/api/debug/voucher/:voucherId', async (req, res) => {
  try {
    const { data: voucher, error } = await supabase.from('vouchers')
      .select('*, payee:payees(id, name, mobile)')
      .eq('id', req.params.voucherId)
      .single();
    
    if (error) {
      return res.json({ error: error.message, code: error.code });
    }
    
    res.json({
      voucherId: voucher?.id,
      status: voucher?.status,
      payeeId: voucher?.payee_id,
      payeeData: voucher?.payee,
      hasPayee: !!voucher?.payee,
      hasPayeeMobile: !!voucher?.payee?.mobile
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Kept for backwards compat — redirects to new debug endpoint
app.get('/api/debug/test-2factor', (req, res) => res.redirect('/api/debug/test-msg91'));

// Get all companies
app.get('/api/companies', async (req, res) => {
  try {
    const { data, error } = await supabase.from('companies')
      .select('id, name, address, gst')
      .order('name');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send OTP using MSG91
app.post('/api/otp/send', async (req, res) => {
  const { mobile, purpose } = req.body;
  if (!mobile) return res.status(400).json({ error: 'Mobile number is required' });
  
  const formattedMobile = formatMobile(mobile);
  console.log(`\n📤 SEND OTP REQUEST`);
  console.log(`   Original: ${mobile}`);
  console.log(`   Formatted: ${formattedMobile}`);
  console.log(`   Purpose: ${purpose}`);
  
  const result = await callMsg91OtpSend(formattedMobile, `Send OTP to ${formattedMobile}`, { flowId: MSG91_ATTENDANCE_FLOW_ID });
  
  if (result.success) {
    await saveOtpSession(formattedMobile, result.sessionId, purpose);
    console.log(`   📝 Session stored in DB for: ${formattedMobile}`);
    res.json({ success: true, message: 'OTP sent successfully' });
  } else {
    res.status(500).json({ error: 'Failed to send OTP', details: result.data?.message || result.error });
  }
});

// Verify OTP using MSG91
app.post('/api/otp/verify', async (req, res) => {
  const { mobile, code } = req.body;
  if (!mobile || !code) return res.status(400).json({ error: 'Mobile and OTP code are required' });
  
  const formattedMobile = formatMobile(mobile);
  console.log(`\n🔐 VERIFY OTP REQUEST`);
  console.log(`   Mobile: ${formattedMobile}`);
  console.log(`   Code: ${code}`);
  
  const session = await getOtpSession(formattedMobile);
  
  if (!session) {
    console.log(`   ❌ No session found in DB for: ${formattedMobile}`);
    return res.status(400).json({ error: 'No OTP session found. Please request a new OTP.' });
  }
  
  console.log(`   📝 Session found (purpose: ${session.purpose})`);
  
  const result = await callMsg91OtpVerify(code, session.sessionId, `Verify OTP for ${formattedMobile}`);
  
  if (result.success) {
    await deleteOtpSession(formattedMobile);
    console.log(`   ✅ OTP Verified! Session cleared.`);
    const signature = Buffer.from(`${formattedMobile}:${Date.now()}:verified`).toString('base64');
    res.json({ success: true, status: 'approved', signature });
  } else {
    console.log(`   ❌ OTP verification failed: ${result.data?.message || result.error}`);
    res.status(400).json({ success: false, message: 'Invalid OTP', details: result.data?.message });
  }
});

// DISABLED: Self-registration not allowed
// Only admins can onboard users via /api/admin/onboard-user

// Admin-only: Onboard new user
app.post('/api/admin/onboard-user', async (req, res) => {
  const { adminMobile, companyId, name, mobile, aadhar, role, companyAccess } = req.body;
  if (!adminMobile || !companyId || !name || !mobile || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  try {
    // Verify Super Admin privileges
    const admin = await getActorRole(req.body.adminId);
    if (!admin.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Super Admin access required' });
    }
    
    const firstName = name.split(' ')[0];
    const rolePrefix = role === 'admin' ? 'Approve' : role === 'auditor' ? 'Audit' : role === 'staff' ? 'Staff' : role === 'staff_lead' ? 'Lead' : 'Accounts';
    const username = `${rolePrefix}-${firstName}`;
    const formattedMobile = formatMobile(mobile);
    
    // Create user with the primary company
    const { data, error } = await supabase.from('users').insert({
      company_id: companyId,
      name,
      first_name: firstName,
      mobile: formattedMobile,
      aadhar,
      role,
      username,
      mobile_verified: false
    }).select().single();
    
    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Mobile number or username already registered' });
      }
      throw error;
    }
    
    // Insert into user_companies junction table
    // If companyAccess is provided, use it; otherwise just add the primary company
    const companiesToAdd = companyAccess && companyAccess.length > 0 
      ? companyAccess 
      : [{ companyId, role, isPrimary: true }];
    
    const userCompanyRecords = companiesToAdd.map((ca, index) => ({
      user_id: data.id,
      company_id: ca.companyId,
      role: ca.role,
      is_primary: ca.isPrimary || index === 0
    }));
    
    const { error: ucError } = await supabase.from('user_companies').insert(userCompanyRecords);
    
    if (ucError) {
      console.error('Error inserting user_companies:', ucError);
      // Don't fail the whole operation, user is created
    }
    
    res.json({ 
      success: true, 
      userId: data.id, 
      username,
      message: 'User onboarded successfully. They must verify mobile to login.' 
    });
  } catch (error) {
    res.status(500).json({ error: 'User onboarding failed', details: error.message });
  }
});

// Verify user mobile
app.post('/api/users/:userId/verify-mobile', async (req, res) => {
  try {
    const { error } = await supabase.from('users')
      .update({ mobile_verified: true })
      .eq('id', req.params.userId);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user (Admin only)
app.put('/api/users/:userId', async (req, res) => {
  const { name, mobile, aadhar, role, requesterId } = req.body;
  
  if (!name || !mobile || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  try {
    const actor = await getActorRole(requesterId);
    if (!actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Super Admin access required' });
    }
    
    const firstName = name.split(' ')[0];
    const rolePrefix = role === 'admin' ? 'Approve' : role === 'auditor' ? 'Audit' : role === 'staff' ? 'Staff' : role === 'staff_lead' ? 'Lead' : 'Accounts';
    const username = `${rolePrefix}-${firstName}`;
    const formattedMobile = formatMobile(mobile);
    
    const { data, error } = await supabase.from('users')
      .update({
        name,
        first_name: firstName,
        mobile: formattedMobile,
        aadhar,
        role,
        username
      })
      .eq('id', req.params.userId)
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Mobile number or username already in use' });
      }
      throw error;
    }
    
    res.json({ success: true, user: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// Get user's company access
app.get('/api/users/:userId/companies', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_companies')
      .select(`
        company_id,
        role,
        is_primary,
        companies:company_id (id, name)
      `)
      .eq('user_id', req.params.userId);
    
    if (error) throw error;
    
    res.json(data.map(uc => ({
      companyId: uc.company_id,
      companyName: uc.companies.name,
      role: uc.role,
      isPrimary: uc.is_primary
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user's company access
app.put('/api/users/:userId/companies', async (req, res) => {
  const { companyAccess, requesterId } = req.body;
  
  if (!companyAccess || !Array.isArray(companyAccess) || companyAccess.length === 0) {
    return res.status(400).json({ error: 'At least one company access is required' });
  }
  
  try {
    const actor = await getActorRole(requesterId);
    if (!actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Super Admin access required' });
    }
    
    // Delete existing company access
    await supabase
      .from('user_companies')
      .delete()
      .eq('user_id', req.params.userId);
    
    // Insert new company access
    const records = companyAccess.map((ca, index) => ({
      user_id: req.params.userId,
      company_id: ca.companyId,
      role: ca.role,
      is_primary: ca.isPrimary || index === 0
    }));
    
    const { error } = await supabase
      .from('user_companies')
      .insert(records);
    
    if (error) throw error;
    
    // Also update the primary company_id and role in users table for backward compatibility
    const primary = companyAccess.find(ca => ca.isPrimary) || companyAccess[0];
    await supabase
      .from('users')
      .update({ company_id: primary.companyId, role: primary.role })
      .eq('id', req.params.userId);
    
    res.json({ success: true, message: 'Company access updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user (Super Admin only)
app.delete('/api/users/:userId', async (req, res) => {
  try {
    const actor = await getActorRole(req.body.requesterId);
    if (!actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Super Admin access required' });
    }

    const uid = req.params.userId;

    // Block if user has created or approved any regular vouchers (preserve audit trail)
    const { data: vouchers } = await supabase.from('vouchers')
      .select('id').or(`created_by.eq.${uid},approved_by.eq.${uid}`).limit(1);
    if (vouchers && vouchers.length > 0) {
      return res.status(400).json({ error: 'Cannot delete user with existing vouchers. Archive user instead.' });
    }

    // Block if user is staff on any ACTIVE (not closed/rejected) suspense voucher
    const activeStatuses = ['pending_approval', 'awaiting_payee_otp', 'open', 'partial', 'pending_close_approval'];
    const { data: activeSV } = await supabase.from('suspense_vouchers')
      .select('id, serial_number, status')
      .eq('staff_user_id', uid)
      .in('status', activeStatuses)
      .limit(1);
    if (activeSV && activeSV.length > 0) {
      return res.status(400).json({
        error: `Cannot delete user — they have an active suspense voucher (${activeSV[0].serial_number}). Close it first.`
      });
    }

    // Nullify staff_user_id on closed/rejected suspense vouchers
    await supabase.from('suspense_vouchers').update({ staff_user_id: null }).eq('staff_user_id', uid);

    // Nullify other user FK references on suspense_vouchers (audit columns — keep the record, lose the link)
    await supabase.from('suspense_vouchers').update({ created_by: null }).eq('created_by', uid);
    await supabase.from('suspense_vouchers').update({ approved_by: null }).eq('approved_by', uid);
    await supabase.from('suspense_vouchers').update({ advance_paid_by: null }).eq('advance_paid_by', uid);
    await supabase.from('suspense_vouchers').update({ close_requested_by: null }).eq('close_requested_by', uid);
    await supabase.from('suspense_vouchers').update({ close_approved_by: null }).eq('close_approved_by', uid);
    await supabase.from('suspense_vouchers').update({ close_rejected_by: null }).eq('close_rejected_by', uid);

    // Nullify user FK references on settlement entries
    await supabase.from('suspense_settlements').update({ submitted_by: null }).eq('submitted_by', uid);
    await supabase.from('suspense_settlements').update({ paid_by: null }).eq('paid_by', uid);

    // Nullify user FK references on hoa_correction_proposals
    await supabase.from('hoa_correction_proposals').update({ proposed_by: null }).eq('proposed_by', uid);
    await supabase.from('hoa_correction_proposals').update({ reviewed_by: null }).eq('reviewed_by', uid);

    // Delete rows in tables where user_id is the PK-FK (safe to delete entirely)
    await supabase.from('push_subscriptions').delete().eq('user_id', uid);
    await supabase.from('webauthn_credentials').delete().eq('user_id', uid);
    await supabase.from('webauthn_challenges').delete().eq('user_id', uid);
    await supabase.from('user_companies').delete().eq('user_id', uid);

    const { error } = await supabase.from('users').delete().eq('id', uid);
    if (error) throw error;

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user', details: error.message });
  }
});

// Session refresh — returns current user profile (used on app load to hydrate stored session)
// ── Pending share context — cross-device receipt routing (Migration 033) ──────
// A Pay Now modal on any device writes its context here so a bank/UPI receipt
// shared from the Admin's phone (a DIFFERENT device) can route to the correct
// confirmation modal instead of the generic reconcile flow.
// Works for all cross-device combos: desktop → phone, phone A → phone B, etc.

// PUT: called when a Pay Now modal opens on any device
app.put('/api/users/:userId/pending-share-context', async (req, res) => {
  const { type, entityId, suspenseId } = req.body;
  if (!type || !entityId) return res.status(400).json({ error: 'type and entityId are required' });
  const ctx = {
    type,
    entityId,
    suspenseId: suspenseId || null,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  };
  const { error } = await supabase.from('users')
    .update({ pending_share_ctx: ctx })
    .eq('id', req.params.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET: consume-once — returns context and immediately clears it
app.get('/api/users/:userId/pending-share-context', async (req, res) => {
  try {
    const { data: u, error } = await supabase.from('users')
      .select('pending_share_ctx')
      .eq('id', req.params.userId)
      .single();
    if (error || !u?.pending_share_ctx) return res.json({ context: null });
    const ctx = u.pending_share_ctx;
    // Always clear immediately (consume-once), expired or not
    await supabase.from('users').update({ pending_share_ctx: null }).eq('id', req.params.userId);
    if (ctx.expiresAt && new Date(ctx.expiresAt) < new Date()) return res.json({ context: null });
    res.json({ context: ctx });
  } catch (err) {
    res.json({ context: null }); // fail-open: falls through to reconcile
  }
});

// DELETE: explicit clear — called when Pay Now modal closes without payment
app.delete('/api/users/:userId/pending-share-context', async (req, res) => {
  await supabase.from('users').update({ pending_share_ctx: null }).eq('id', req.params.userId);
  res.json({ success: true });
});

app.get('/api/users/:userId/session', async (req, res) => {
  const { userId } = req.params;
  const { companyId } = req.query;
  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });

    const { data: userCompanies } = await supabase
      .from('user_companies')
      .select('company_id, role, is_primary, companies:company_id (id, name, address, gst)')
      .eq('user_id', user.id);

    let companies = userCompanies || [];
    if (companies.length === 0) {
      const { data: legacyCompany } = await supabase.from('companies').select('*').eq('id', user.company_id).single();
      if (legacyCompany) companies = [{ company_id: legacyCompany.id, role: user.role, is_primary: true, companies: legacyCompany }];
    }

    // Prefer the company the user last selected; fall back to the primary or first.
    const primaryOrFirst = (companyId && companies.find(uc => uc.company_id === companyId))
                        || companies.find(uc => uc.is_primary)
                        || companies[0];
    if (!primaryOrFirst) return res.status(400).json({ error: 'No company access' });

    return res.json({
      success: true,
      user: {
        id: user.id, name: user.name, username: user.username, mobile: user.mobile,
        role: primaryOrFirst.role, isSuperAdmin: user.is_super_admin || false,
        company: primaryOrFirst.companies,
        companies: companies.map(uc => ({ id: uc.companies.id, name: uc.companies.name, role: uc.role }))
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Session refresh failed' });
  }
});

// Login
app.post('/api/users/login', async (req, res) => {
  const { username, otp, companyId, password, companySelectToken } = req.body;

  try {
    let user;

    // ── Path A: Post-auth company selection (companySelectToken) ─────────────
    // Sent when a multi-company user has already authenticated and is picking a company.
    if (companySelectToken) {
      if (!companyId) return res.status(400).json({ error: 'companyId is required' });
      const row = await getAndDeleteChallengeByValue(companySelectToken, 'company_select');
      if (!row) return res.status(400).json({ error: 'Session expired. Please log in again.' });
      const { data: foundUser } = await supabase.from('users').select('*').eq('id', row.user_id).single();
      if (!foundUser) return res.status(404).json({ error: 'User not found' });
      user = foundUser;
    } else {
      // ── Path B: Normal authentication ───────────────────────────────────────
      if (!username) return res.status(400).json({ error: 'Username is required' });
      const cleanUsername = username.trim();
      const { data: foundUser, error: userErr } = await supabase.from('users')
        .select('*').ilike('username', cleanUsername).single();
      if (userErr) {
        console.error('Login query error:', userErr.message, 'for username:', cleanUsername);
        return res.status(404).json({ error: 'User not found' });
      }
      if (!foundUser) return res.status(404).json({ error: 'User not found' });
      if (!foundUser.mobile_verified) return res.status(400).json({ error: 'Mobile not verified' });
      user = foundUser;

      // ── Authentication: OTP (no password set) or Password ───────────────────
      if (!user.password_hash) {
        if (!otp) {
          try {
            const formattedMobile = formatMobile(user.mobile);
            const otpResult = await callMsg91OtpSend(formattedMobile, 'Send first-login OTP', { flowId: MSG91_ATTENDANCE_FLOW_ID });
            if (otpResult.success) {
              await saveOtpSession(formattedMobile, otpResult.sessionId, 'first_login');
              return res.json({ requiresOtp: true, message: 'An OTP has been sent to your registered mobile. Verify to set your password.' });
            } else {
              console.error('MSG91 OTP send error:', otpResult.data?.message);
              return res.status(500).json({ error: 'Failed to send OTP' });
            }
          } catch (err) {
            console.error('OTP send error:', err.message);
            return res.status(500).json({ error: 'Failed to send OTP' });
          }
        } else {
          try {
            const formattedMobile = formatMobile(user.mobile);
            const session = await getOtpSession(formattedMobile);
            if (!session) return res.status(400).json({ error: 'No OTP session found. Please request a new OTP.' });
            const verifyResult = await callMsg91OtpVerify(otp, session.sessionId, 'Verify first-login OTP');
            if (!verifyResult.success) {
              return res.status(400).json({ error: 'Invalid OTP' });
            }
            await deleteOtpSession(formattedMobile);
            const setupToken = crypto.randomBytes(32).toString('hex');
            await supabase.from('otp_sessions').insert({ mobile: formattedMobile, session_id: setupToken, purpose: 'password_setup', voucher_id: null });
            return res.json({ requiresPasswordSetup: true, userId: user.id, userName: user.name, setupToken });
          } catch (err) {
            console.error('OTP verify error:', err.message);
            return res.status(500).json({ error: 'OTP verification failed' });
          }
        }
      }

      if (!password) {
        const { data: creds } = await supabase.from('webauthn_credentials')
          .select('credential_id, device_name, transports').eq('user_id', user.id);
        const credentialIds = (creds || []).map(c => c.credential_id);
        return res.json({ requiresPassword: true, hasWebAuthn: credentialIds.length > 0, credentialIds, userId: user.id, userName: user.name });
      }

      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) return res.status(400).json({ error: 'Incorrect password' });
    }

    // ── Post-authentication: Company selection (RBAC-driven) ─────────────────
    const { data: userCompanies } = await supabase
      .from('user_companies')
      .select('company_id, role, is_primary, companies:company_id (id, name, address, gst)')
      .eq('user_id', user.id);

    let companies = userCompanies || [];
    if (companies.length === 0) {
      const { data: legacyCompany } = await supabase.from('companies').select('*').eq('id', user.company_id).single();
      if (legacyCompany) companies = [{ company_id: legacyCompany.id, role: user.role, is_primary: true, companies: legacyCompany }];
    }
    if (companies.length === 0) return res.status(400).json({ error: 'User has no company access' });

    let selectedCompany, selectedRole;
    if (user.role === 'staff') {
      // Staff always auto-select their primary company
      const primary = companies.find(uc => uc.is_primary) || companies[0];
      if (!primary) return res.status(400).json({ error: 'Staff user has no company access' });
      selectedCompany = primary.companies; selectedRole = primary.role;
    } else if (companies.length === 1) {
      // Single company — auto-select, no prompt needed
      selectedCompany = companies[0].companies; selectedRole = companies[0].role;
    } else if (!companyId) {
      // Multiple companies — identity verified, now ask which company to use.
      // Issue a short-lived token so the client doesn't have to re-authenticate.
      const token = crypto.randomBytes(32).toString('hex');
      await saveWebAuthnChallenge(user.id, token, 'company_select');
      return res.json({
        requiresCompanySelection: true,
        companies: companies.map(uc => ({ id: uc.companies.id, name: uc.companies.name, role: uc.role })),
        userId: user.id,
        userName: user.name,
        companySelectToken: token,
      });
    } else {
      const match = companies.find(uc => uc.company_id === companyId);
      if (!match) return res.status(403).json({ error: 'User does not have access to this company' });
      selectedCompany = match.companies; selectedRole = match.role;
    }

    // ── Update last_login ─────────────────────────────────────────────────────
    await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

    // Get unread notifications count
    const { count } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    // For staff users: look up their active settlement token
    let settlementToken = null;
    if (user.role === 'staff') {
      // Find the payee record linked to this user
      const { data: payee } = await supabase.from('payees')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (payee) {
        // Get most recent active suspense voucher for this payee
        const { data: suspense } = await supabase.from('suspense_vouchers')
          .select('id')
          .eq('staff_payee_id', payee.id)
          .in('status', ['open', 'partial'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (suspense) {
          // Try to find an existing valid (non-expired) session
          const { data: session } = await supabase.from('settlement_sessions')
            .select('token')
            .eq('suspense_id', suspense.id)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (session) {
            settlementToken = session.token;
          } else {
            // No valid session exists (old sessions created before sentinel-date fix, or all expired)
            // Auto-create a fresh session silently — same as Resend Link but no SMS
            const newToken = generateSettlementToken();
            const { data: newSession } = await supabase.from('settlement_sessions').insert({
              suspense_id: suspense.id,
              payee_id: payee.id,
              token: newToken,
              expires_at: '2099-12-31T23:59:59.000Z',
              last_sent_at: new Date().toISOString()
            }).select('token').single();
            if (newSession) settlementToken = newSession.token;
          }
        }
      }
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        mobile: user.mobile,
        role: selectedRole,
        isSuperAdmin: !!user.is_super_admin,
        company: selectedCompany,
        companies: companies.map(uc => ({
          id: uc.companies.id,
          name: uc.companies.name,
          role: uc.role,
          isPrimary: uc.is_primary
        })),
        unreadNotifications: count || 0
      },
      ...(settlementToken && { settlementToken })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Password management endpoints ────────────────────────────────────────────

// Set or change password (requires setupToken issued after OTP verification, OR currentPassword for logged-in change)
app.post('/api/users/:userId/set-password', async (req, res) => {
  const { userId } = req.params;
  const { newPassword, setupToken, currentPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const { data: user, error: userErr } = await supabase.from('users').select('*').eq('id', userId).single();
    if (userErr || !user) return res.status(404).json({ error: 'User not found' });

    // Either verify setupToken (post-OTP path) or currentPassword (change-password path)
    if (setupToken) {
      const formattedMobile = formatMobile(user.mobile);
      const { data: session } = await supabase.from('otp_sessions')
        .select('*')
        .eq('mobile', formattedMobile)
        .eq('session_id', setupToken)
        .eq('purpose', 'password_setup')
        .single();
      if (!session) return res.status(400).json({ error: 'Invalid or expired setup token. Please log in again.' });
      const age = Date.now() - new Date(session.created_at).getTime();
      if (age > 15 * 60 * 1000) {
        await supabase.from('otp_sessions').delete().eq('id', session.id);
        return res.status(400).json({ error: 'Setup token expired. Please log in again.' });
      }
      await supabase.from('otp_sessions').delete().eq('id', session.id);
    } else if (currentPassword) {
      if (!user.password_hash) return res.status(400).json({ error: 'No existing password set' });
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
    } else {
      return res.status(400).json({ error: 'Either setupToken or currentPassword is required' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await supabase.from('users').update({ password_hash: hash, password_set_at: new Date().toISOString() }).eq('id', userId);
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Forgot password — step 1: send OTP; step 2 (with otp): verify & issue setupToken
app.post('/api/auth/forgot-password', async (req, res) => {
  const { username, otp } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    const { data: user } = await supabase.from('users').select('*').ilike('username', username.trim()).single();
    if (!user || !user.mobile_verified) return res.status(404).json({ error: 'User not found' });

    const formattedMobile = formatMobile(user.mobile);

    if (!otp) {
      const otpResult = await callMsg91OtpSend(formattedMobile, 'Send password-reset OTP', { flowId: MSG91_ATTENDANCE_FLOW_ID });
      if (!otpResult.success) return res.status(500).json({ error: 'Failed to send OTP' });
      await saveOtpSession(formattedMobile, otpResult.sessionId, 'password_reset');
      return res.json({ requiresOtp: true, message: 'OTP sent to registered mobile.' });
    }

    // Verify OTP
    const session = await getOtpSession(formattedMobile);
    if (!session) return res.status(400).json({ error: 'No OTP session found. Please request again.' });

    const verifyResult = await callMsg91OtpVerify(otp, session.sessionId, 'Verify password-reset OTP');
    if (!verifyResult.success) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    await deleteOtpSession(formattedMobile);

    const setupToken = crypto.randomBytes(32).toString('hex');
    await supabase.from('otp_sessions').insert({ mobile: formattedMobile, session_id: setupToken, purpose: 'password_setup', voucher_id: null });
    return res.json({ requiresPasswordSetup: true, userId: user.id, userName: user.name, setupToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Super Admin: clear a user's password (forces them to re-set via OTP on next login)
app.delete('/api/users/:userId/password', async (req, res) => {
  const { userId } = req.params;
  const { requesterId } = req.body;
  if (!requesterId) return res.status(400).json({ error: 'requesterId is required' });

  try {
    const { data: requester } = await supabase.from('users').select('is_super_admin').eq('id', requesterId).single();
    if (!requester?.is_super_admin) return res.status(403).json({ error: 'Super Admin access required' });

    await supabase.from('users').update({ password_hash: null, password_set_at: null }).eq('id', userId);
    // Also revoke all WebAuthn credentials so the user must re-set everything
    await supabase.from('webauthn_credentials').delete().eq('user_id', userId);
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WebAuthn / Passkey endpoints ─────────────────────────────────────────────

// 1. Generate registration options (called before device registration)
app.post('/api/auth/webauthn/register/options', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const { data: user } = await supabase.from('users').select('id, name, username').eq('id', userId).single();
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get existing credentials to exclude re-registration of the same device
    const { data: existingCreds } = await supabase.from('webauthn_credentials').select('credential_id, transports').eq('user_id', userId);
    const excludeCredentials = (existingCreds || []).map(c => ({
      id: c.credential_id,
      transports: c.transports || [],
    }));

    const options = await generateRegistrationOptions({
      rpName: WEBAUTHN_RP_NAME,
      rpID: WEBAUTHN_RP_ID,
      userID: Buffer.from(user.id),
      userName: user.username,
      userDisplayName: user.name,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials,
    });

    await saveWebAuthnChallenge(userId, options.challenge, 'registration');
    return res.json(options);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Verify registration response (saves the new credential)
app.post('/api/auth/webauthn/register/verify', async (req, res) => {
  const { userId, response, deviceName } = req.body;
  if (!userId || !response) return res.status(400).json({ error: 'userId and response are required' });

  try {
    const expectedChallenge = await getAndDeleteWebAuthnChallenge(userId, 'registration');
    if (!expectedChallenge) return res.status(400).json({ error: 'Challenge expired or not found. Please try again.' });

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: WEBAUTHN_ORIGIN,
      expectedRPID: WEBAUTHN_RP_ID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Device verification failed' });
    }

    const { credential } = verification.registrationInfo;
    const credToStore = {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      transports: credential.transports || [],
    };

    const { data: saved, error: saveErr } = await supabase.from('webauthn_credentials').insert({
      user_id: userId,
      credential_id: credential.id,
      public_key_json: JSON.stringify(credToStore),
      sign_count: credential.counter,
      device_name: deviceName || 'My Device',
      transports: credential.transports || [],
    }).select('id, credential_id, device_name').single();

    if (saveErr) return res.status(500).json({ error: 'Failed to save device credential' });
    return res.json({ success: true, credentialId: saved.credential_id, deviceName: saved.device_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Generate authentication options (called before device-lock login)
app.post('/api/auth/webauthn/login/options', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });

  try {
    const { data: user } = await supabase.from('users').select('id, password_hash').ilike('username', username.trim()).single();
    if (!user || !user.password_hash) return res.status(404).json({ error: 'User not found or password not set' });

    const { data: creds } = await supabase.from('webauthn_credentials').select('credential_id, transports').eq('user_id', user.id);
    if (!creds || creds.length === 0) return res.status(400).json({ error: 'No registered devices for this user' });

    const allowCredentials = creds.map(c => ({ id: c.credential_id, transports: c.transports || [] }));

    const options = await generateAuthenticationOptions({
      rpID: WEBAUTHN_RP_ID,
      allowCredentials,
      userVerification: 'preferred',
    });

    await saveWebAuthnChallenge(user.id, options.challenge, 'authentication');
    return res.json(options);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Verify authentication response (WebAuthn login — returns full user object)
app.post('/api/auth/webauthn/login/verify', async (req, res) => {
  const { username, response, companyId } = req.body;
  if (!username || !response) return res.status(400).json({ error: 'username and response are required' });

  try {
    const cleanUsername = username.trim();
    const { data: user, error: userErr } = await supabase.from('users').select('*').ilike('username', cleanUsername).single();
    if (userErr || !user) return res.status(404).json({ error: 'User not found' });

    const expectedChallenge = await getAndDeleteWebAuthnChallenge(user.id, 'authentication');
    if (!expectedChallenge) return res.status(400).json({ error: 'Challenge expired. Please try again.' });

    // Find the matching credential
    const credentialId = response.id;
    const { data: storedCred } = await supabase.from('webauthn_credentials').select('*').eq('credential_id', credentialId).eq('user_id', user.id).single();
    if (!storedCred) return res.status(400).json({ error: 'Device not registered for this user' });

    const parsed = JSON.parse(storedCred.public_key_json);
    const credential = {
      id: parsed.id,
      publicKey: Buffer.from(parsed.publicKey, 'base64'),
      counter: storedCred.sign_count,
      transports: storedCred.transports || [],
    };

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: WEBAUTHN_ORIGIN,
      expectedRPID: WEBAUTHN_RP_ID,
      credential,
      requireUserVerification: false,
    });

    if (!verification.verified) return res.status(400).json({ error: 'Device verification failed' });

    // Update sign count and last_used
    await supabase.from('webauthn_credentials').update({ sign_count: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq('id', storedCred.id);

    // Post-auth company selection (same logic as main login endpoint)
    const { data: userCompanies } = await supabase.from('user_companies').select('company_id, role, is_primary, companies:company_id(id,name,address,gst)').eq('user_id', user.id);
    let companies = userCompanies || [];
    if (companies.length === 0) {
      const { data: legacyCompany } = await supabase.from('companies').select('*').eq('id', user.company_id).single();
      if (legacyCompany) companies = [{ company_id: legacyCompany.id, role: user.role, is_primary: true, companies: legacyCompany }];
    }
    if (companies.length === 0) return res.status(400).json({ error: 'User has no company access' });

    let selectedCompany, selectedRole;
    if (user.role === 'staff') {
      const primary = companies.find(uc => uc.is_primary) || companies[0];
      selectedCompany = primary.companies; selectedRole = primary.role;
    } else if (companies.length === 1) {
      selectedCompany = companies[0].companies; selectedRole = companies[0].role;
    } else if (!companyId) {
      // Multiple companies — issue companySelectToken so client doesn't need to re-do biometric
      const token = crypto.randomBytes(32).toString('hex');
      await saveWebAuthnChallenge(user.id, token, 'company_select');
      return res.json({
        requiresCompanySelection: true,
        companies: companies.map(uc => ({ id: uc.companies.id, name: uc.companies.name, role: uc.role })),
        userId: user.id,
        userName: user.name,
        companySelectToken: token,
      });
    } else {
      const match = companies.find(uc => uc.company_id === companyId);
      if (!match) return res.status(403).json({ error: 'User does not have access to this company' });
      selectedCompany = match.companies; selectedRole = match.role;
    }

    await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false);

    return res.json({
      success: true,
      user: {
        id: user.id, name: user.name, username: user.username, mobile: user.mobile,
        role: selectedRole, isSuperAdmin: !!user.is_super_admin,
        company: selectedCompany,
        companies: companies.map(uc => ({ id: uc.companies.id, name: uc.companies.name, role: uc.role, isPrimary: uc.is_primary })),
        unreadNotifications: count || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List registered WebAuthn devices for a user
app.get('/api/users/:userId/webauthn-credentials', async (req, res) => {
  const { userId } = req.params;
  try {
    const { data } = await supabase.from('webauthn_credentials')
      .select('id, credential_id, device_name, created_at, last_used_at, transports')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a registered device
app.delete('/api/users/:userId/webauthn-credentials/:credentialId', async (req, res) => {
  const { userId, credentialId } = req.params;
  try {
    await supabase.from('webauthn_credentials').delete().eq('user_id', userId).eq('credential_id', credentialId);
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Switch company (for users with multi-company access)
app.post('/api/users/:userId/switch-company', async (req, res) => {
  const { userId } = req.params;
  const { companyId } = req.body;
  
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required' });
  }
  
  try {
    // Verify user has access to this company
    const { data: userCompany, error: ucError } = await supabase
      .from('user_companies')
      .select(`
        company_id,
        role,
        companies:company_id (id, name, address, gst)
      `)
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single();
    
    if (ucError || !userCompany) {
      return res.status(403).json({ error: 'User does not have access to this company' });
    }
    
    // Get user info
    const { data: user } = await supabase.from('users')
      .select('id, name, username, mobile, is_super_admin')
      .eq('id', userId)
      .single();
    
    // Get all companies for the user
    const { data: allCompanies } = await supabase
      .from('user_companies')
      .select(`
        company_id,
        role,
        is_primary,
        companies:company_id (id, name, address, gst)
      `)
      .eq('user_id', userId);
    
    // Get unread notifications count
    const { count } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        mobile: user.mobile,
        role: userCompany.role,
        isSuperAdmin: !!user.is_super_admin,
        company: userCompany.companies,
        companies: allCompanies.map(uc => ({
          id: uc.companies.id,
          name: uc.companies.name,
          role: uc.role,
          isPrimary: uc.is_primary
        })),
        unreadNotifications: count || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get company users (via user_companies junction table for multi-company support)
app.get('/api/companies/:companyId/users', async (req, res) => {
  try {
    // Query users through the user_companies junction table
    const { data, error } = await supabase.from('user_companies')
      .select(`
        role,
        is_primary,
        users:user_id (
          id,
          name,
          username,
          mobile,
          aadhar,
          mobile_verified,
          last_login,
          created_at
        )
      `)
      .eq('company_id', req.params.companyId);
    
    if (error) throw error;
    
    // Flatten the response to match expected format
    const users = data.map(uc => ({
      ...uc.users,
      role: uc.role,  // Use role from user_companies (company-specific role)
      is_primary: uc.is_primary
    }));
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add payee
app.post('/api/payees', async (req, res) => {
  const { companyId, name, alias, mobile, bankAccount, ifsc, upiId, bankName, isGlobal, payeeType, requiresOtp, userId, isStaff } = req.body;
  if (!companyId || !name || !mobile) {
    return res.status(400).json({ error: 'Company, name, and mobile are required' });
  }

  const formattedMobile = formatMobile(mobile);
  const isAdhoc = payeeType === 'adhoc';
  const otpRequired = requiresOtp !== undefined ? requiresOtp : !isAdhoc;

  try {
    if (userId) {
      const { data: user, error: userError } = await supabase.from('users').select('id').eq('id', userId).single();
      if (userError || !user) {
        return res.status(400).json({ error: 'userId not found' });
      }
    }

    const { data, error } = await supabase.from('payees').insert({
      company_id: companyId,
      name,
      alias: alias || null,
      mobile: formattedMobile,
      bank_account: bankAccount || null,
      ifsc: ifsc || null,
      upi_id: upiId || null,
      bank_name: bankName || null,
      is_global: isGlobal || false,
      payee_type: payeeType || 'registered',
      requires_otp: otpRequired,
      user_id: userId || null,
      is_staff: !!isStaff
    }).select().single();

    if (error) throw error;
    res.json({ success: true, payeeId: data.id, payee: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payees (includes global payees from all companies)
app.get('/api/companies/:companyId/payees', async (req, res) => {
  try {
    const { data, error } = await supabase.from('payees')
      .select('*')
      .or(`company_id.eq.${req.params.companyId},is_global.eq.true`)
      .order('name');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update payee
app.put('/api/payees/:payeeId', async (req, res) => {
  const { name, alias, mobile, bank_account, ifsc, upi_id, is_global, payee_type, requires_otp, user_id, is_staff } = req.body;
  
  try {
    const updateData = {
      name,
      alias: alias || null,
      bank_account: bank_account || null,
      ifsc: ifsc || null,
      upi_id: upi_id || null
    };
    if (mobile) updateData.mobile = formatMobile(mobile);
    if (is_global !== undefined) updateData.is_global = is_global;
    if (payee_type !== undefined) updateData.payee_type = payee_type;
    if (requires_otp !== undefined) updateData.requires_otp = requires_otp;
    if (user_id !== undefined) updateData.user_id = user_id;
    if (is_staff !== undefined) updateData.is_staff = is_staff;

    if (user_id) {
      const { data: user, error: userError } = await supabase.from('users').select('id').eq('id', user_id).single();
      if (userError || !user) {
        return res.status(400).json({ error: 'user_id not found' });
      }
    }
    
    const { data, error } = await supabase.from('payees')
      .update(updateData)
      .eq('id', req.params.payeeId)
      .select()
      .single();
    
    if (error) throw error;
    res.json({ success: true, payee: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete payee
app.delete('/api/payees/:payeeId', async (req, res) => {
  try {
    const { error } = await supabase.from('payees')
      .delete()
      .eq('id', req.params.payeeId);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create staff login for a staff payee — generates username Staff-{FirstName}
app.post('/api/payees/:payeeId/create-staff-login', async (req, res) => {
  const { requesterId, aadhar } = req.body;
  try {
    // Only super admin can create logins
    const actor = await getActorRole(requesterId);
    if (!actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Super Admin access required' });
    }
    if (!aadhar || !aadhar.trim()) {
      return res.status(400).json({ error: 'Aadhar number is required for staff login creation' });
    }

    // Fetch the payee
    const { data: payee, error: payeeError } = await supabase
      .from('payees')
      .select('*')
      .eq('id', req.params.payeeId)
      .single();
    if (payeeError || !payee) return res.status(404).json({ error: 'Payee not found' });
    if (!payee.is_staff) return res.status(400).json({ error: 'This payee is not marked as a staff payee' });
    if (payee.user_id) return res.status(400).json({ error: 'This staff payee already has a login account' });

    const firstName = payee.name.split(' ')[0];
    const username = `Staff-${firstName}`;
    const formattedMobile = formatMobile(payee.mobile);

    // Create the user with role='staff'
    const { data: newUser, error: insertError } = await supabase.from('users').insert({
      company_id: payee.company_id,
      name: payee.name,
      first_name: firstName,
      mobile: formattedMobile,
      aadhar: aadhar.trim(),
      role: 'staff',
      username,
      mobile_verified: true  // staff don't need aadhar; treat mobile as verified via payee record
    }).select().single();

    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(400).json({ error: `Username "${username}" is already taken. The payee may already have a login.` });
      }
      if (insertError.code === '23514') {
        return res.status(500).json({ error: 'Database migration required: please run migration 016_add_staff_role.sql in your Supabase SQL editor to enable the staff role.' });
      }
      throw insertError;
    }

    // Add user_companies entry
    await supabase.from('user_companies').insert({
      user_id: newUser.id,
      company_id: payee.company_id,
      role: 'staff',
      is_primary: true
    });

    // Link payee → user
    const { error: linkError } = await supabase.from('payees')
      .update({ user_id: newUser.id })
      .eq('id', payee.id);
    if (linkError) throw linkError;

    res.json({ success: true, username, userId: newUser.id });
  } catch (error) {
    console.error('create-staff-login error:', error);
    res.status(500).json({ error: 'Failed to create staff login', details: error.message });
  }
});

// Copy suspense-level transfer receipts to a final payment voucher.
// Accounts upload bank/UPI transfer receipts at the suspense voucher level as proof of
// disbursement. Every final expense voucher created from that suspense must carry copies
// of those receipts so the voucher independently proves both WHAT was spent (entry bills)
// AND HOW the funds reached the staff member (transfer receipts). The originals remain
// on the suspense voucher; fresh records are inserted for the new voucher.
const copyTransferReceiptsToVoucher = async (suspenseId, voucherId) => {
  const { data: receipts } = await supabase.from('voucher_attachments')
    .select('company_id,file_name,storage_path,public_url,mime_type,file_size_bytes,uploaded_by,uploaded_at,suspense_id,attachment_category')
    .eq('suspense_id', suspenseId)
    .eq('attachment_category', 'transfer_receipt')
    .is('voucher_id', null)  // only original suspense-level records, never copies of copies

  if (!receipts?.length) return;

  const copies = receipts.map(r => ({
    company_id: r.company_id,
    voucher_id: voucherId,
    voucher_type: 'regular',
    suspense_id: r.suspense_id,   // retain provenance — links back to source suspense
    settlement_id: null,
    file_name: r.file_name,
    storage_path: r.storage_path,
    public_url: r.public_url,
    mime_type: r.mime_type,
    file_size_bytes: r.file_size_bytes,
    uploaded_by: r.uploaded_by,
    uploaded_at: r.uploaded_at,
    attachment_category: 'transfer_receipt'
  }));

  const { error } = await supabase.from('voucher_attachments').insert(copies);
  if (error) console.error('copyTransferReceiptsToVoucher error:', error.message);
};

// Get next voucher number
const getNextVoucherNumber = async (companyId) => {
  const { data, error } = await supabase.rpc('get_next_voucher_number', { p_company_id: companyId });
  if (error) throw error;
  return data;
};

// Create voucher (submit for approval) or save as draft
app.post('/api/vouchers', async (req, res) => {
  const { companyId, headOfAccount, subHeadOfAccount, narration, narrationItems, deductions, amount, paymentMode, payeeId, preparedBy, saveAsDraft, invoiceReference, paidFromAccount } = req.body;
  
  if (!companyId || !headOfAccount || !amount || !paymentMode || !payeeId || !preparedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const preparer = await getActorRole(preparedBy);
    if (preparer.role !== 'accounts' && !preparer.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only Accounts users or Super Admin can create vouchers' });
    }
    
    const serialNumber = await getNextVoucherNumber(companyId);
    const status = saveAsDraft ? 'draft' : 'pending';
    
    const { data: voucher, error } = await supabase.from('vouchers').insert({
      company_id: companyId,
      serial_number: serialNumber,
      head_of_account: headOfAccount,
      sub_head_of_account: subHeadOfAccount || null,
      narration: narration || '',
      narration_items: narrationItems || [],
      deductions: deductions || [],
      amount,
      payment_mode: paymentMode,
      payee_id: payeeId,
      prepared_by: preparedBy,
      status: status,
      submitted_at: saveAsDraft ? null : new Date().toISOString(),
      invoice_reference: invoiceReference || null,
      paid_from_account: paidFromAccount || null
    }).select().single();
    
    if (error) throw error;
    
    // Only notify admins if submitting (not drafts)
    if (!saveAsDraft) {
      const { data: adminEntries } = await supabase.from('user_companies')
        .select('user_id')
        .eq('company_id', companyId)
        .eq('role', 'admin');
      const admins = adminEntries ? adminEntries.map(a => ({ id: a.user_id })) : [];
      
      const { data: preparer } = await supabase.from('users')
        .select('name')
        .eq('id', preparedBy)
        .single();
      
      if (admins && admins.length > 0) {
        const notifications = admins.map(admin => ({
          user_id: admin.id,
          title: 'New Voucher Pending Approval',
          message: `Voucher ${serialNumber} prepared by ${preparer.name} requires your approval.`,
          type: 'approval_required',
          voucher_id: voucher.id
        }));
        
        await supabase.from('notifications').insert(notifications);
        
        // Send push notifications to admins
        for (const admin of admins) {
          sendPushNotification(
            admin.id,
            '📋 New Voucher Pending Approval',
            `Voucher ${serialNumber} by ${preparer.name} requires your approval.`,
            '/'
          );
        }
      }
    }
    
    res.json({ 
      success: true, 
      voucherId: voucher.id, 
      serialNumber,
      status: status,
      message: saveAsDraft ? 'Voucher saved as draft' : 'Voucher submitted for approval'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update draft voucher
app.put('/api/vouchers/:voucherId', async (req, res) => {
  const { headOfAccount, subHeadOfAccount, narration, narrationItems, deductions, amount, paymentMode, payeeId, invoiceReference, paidFromAccount } = req.body;
  
  try {
    // First check if voucher exists and is a draft
    const { data: existing, error: fetchError } = await supabase.from('vouchers')
      .select('status')
      .eq('id', req.params.voucherId)
      .single();
    
    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ error: 'Voucher not found' });
    if (existing.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft vouchers can be edited' });
    }
    
    const updateData = {};
    if (headOfAccount !== undefined) updateData.head_of_account = headOfAccount;
    if (subHeadOfAccount !== undefined) updateData.sub_head_of_account = subHeadOfAccount;
    if (narration !== undefined) updateData.narration = narration;
    if (narrationItems !== undefined) updateData.narration_items = narrationItems;
    if (deductions !== undefined) updateData.deductions = deductions;
    if (amount !== undefined) updateData.amount = amount;
    if (paymentMode !== undefined) updateData.payment_mode = paymentMode;
    if (payeeId !== undefined) updateData.payee_id = payeeId;
    if (invoiceReference !== undefined) updateData.invoice_reference = invoiceReference;
    if (paidFromAccount !== undefined) updateData.paid_from_account = paidFromAccount;
    
    const { data: voucher, error } = await supabase.from('vouchers')
      .update(updateData)
      .eq('id', req.params.voucherId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, voucher });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit draft voucher for approval
app.post('/api/vouchers/:voucherId/submit', async (req, res) => {
  try {
    const { data: voucher, error: fetchError } = await supabase.from('vouchers')
      .select('*, preparer:users!vouchers_prepared_by_fkey(name)')
      .eq('id', req.params.voucherId)
      .single();
    
    if (fetchError) throw fetchError;
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft vouchers can be submitted' });
    }
    
    // Update status to pending
    const { error: updateError } = await supabase.from('vouchers')
      .update({ 
        status: 'pending',
        submitted_at: new Date().toISOString()
      })
      .eq('id', req.params.voucherId);
    
    if (updateError) throw updateError;
    
    // Notify admins
    const { data: adminEntries } = await supabase.from('user_companies')
      .select('user_id')
      .eq('company_id', voucher.company_id)
      .eq('role', 'admin');
    const admins = adminEntries ? adminEntries.map(a => ({ id: a.user_id })) : [];
    
    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.id,
        title: 'New Voucher Pending Approval',
        message: `Voucher ${voucher.serial_number} prepared by ${voucher.preparer?.name || 'Unknown'} requires your approval.`,
        type: 'approval_required',
        voucher_id: voucher.id
      }));
      
      await supabase.from('notifications').insert(notifications);
      
      // Send push notifications to admins
      for (const admin of admins) {
        sendPushNotification(
          admin.id,
          '📋 New Voucher Pending Approval',
          `Voucher ${voucher.serial_number} by ${voucher.preparer?.name || 'Unknown'} requires your approval.`,
          '/'
        );
      }
    }
    
    res.json({ success: true, message: 'Voucher submitted for approval' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get vouchers
app.get('/api/companies/:companyId/vouchers', async (req, res) => {
  try {
    // all=true bypasses the recency filter (used by "Load Full History" in the UI)
    const { all } = req.query;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    let q = supabase.from('vouchers')
      .select(`
        *,
        payee:payees(name, alias, mobile, upi_id, bank_account, ifsc, bank_name),
        preparer:users!vouchers_prepared_by_fkey(name, username),
        approver:users!vouchers_approved_by_fkey(name, username),
        company:companies(name, address, gst)
      `)
      .eq('company_id', req.params.companyId)
      .order('created_at', { ascending: false });

    if (all !== 'true') {
      // Default: active-status vouchers always included; paid/rejected only if < 90 days old.
      // This prevents hundreds of old settled vouchers from bloating every 30-second poll.
      q = q.or(`status.in.(draft,pending,approved,completed,awaiting_payment),created_at.gte.${ninetyDaysAgo}`);
    }

    const { data: vouchers, error } = await q;
    if (error) throw error;

    // Fetch attachment counts for all vouchers in a single query
    const voucherIds = vouchers.map(v => v.id);
    let attCounts = {};
    if (voucherIds.length > 0) {
      const { data: attData } = await supabase
        .from('voucher_attachments')
        .select('voucher_id')
        .in('voucher_id', voucherIds);
      (attData || []).forEach(a => {
        attCounts[a.voucher_id] = (attCounts[a.voucher_id] || 0) + 1;
      });
    }

    // Flatten the response
    const formattedVouchers = vouchers.map(v => ({
      ...v,
      payee_name: v.payee?.name,
      payee_alias: v.payee?.alias,
      payee_mobile: v.payee?.mobile,
      payee_upi_id: v.payee?.upi_id,
      payee_bank_account: v.payee?.bank_account,
      payee_ifsc: v.payee?.ifsc,
      payee_bank_name: v.payee?.bank_name,
      preparer_name: v.preparer?.name,
      preparer_username: v.preparer?.username,
      approver_name: v.approver?.name,
      approver_username: v.approver?.username,
      company_name: v.company?.name,
      company_address: v.company?.address,
      company_gst: v.company?.gst,
      attachment_count: attCounts[v.id] || 0,
      batch_id: v.batch_id || null
    }));

    // Attach batch_reference for vouchers paid via a batch (separate query to avoid
    // PostgREST ambiguity with the payment_batches FK).
    const batchIds = [...new Set(formattedVouchers.map(v => v.batch_id).filter(Boolean))]
    let batchRefMap = {}
    if (batchIds.length > 0) {
      const { data: batchRows } = await supabase.from('payment_batches')
        .select('id, batch_reference, total_amount').in('id', batchIds)
      ;(batchRows || []).forEach(b => { batchRefMap[b.id] = { reference: b.batch_reference, total: b.total_amount } })
    }
    const enrichedVouchers = formattedVouchers.map(v => ({
      ...v,
      batch_reference:    v.batch_id ? (batchRefMap[v.batch_id]?.reference    || null) : null,
      batch_total_amount: v.batch_id ? (batchRefMap[v.batch_id]?.total         || null) : null,
    }))
    
    res.json(enrichedVouchers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single voucher
app.get('/api/vouchers/:voucherId', async (req, res) => {
  try {
    const { data: voucher, error } = await supabase.from('vouchers')
      .select(`
        *,
        payee:payees(name, alias, mobile, bank_account, ifsc, upi_id, bank_name),
        preparer:users!vouchers_prepared_by_fkey(name, username),
        approver:users!vouchers_approved_by_fkey(name, username),
        company:companies(name, address, gst)
      `)
      .eq('id', req.params.voucherId)
      .single();
    
    if (error) throw error;

    // Resolve suspense serial in a separate query -- avoids PostgREST ambiguity
    // caused by two FKs between vouchers and suspense_settlements:
    //   vouchers.settlement_id  (migration 014)  ->  suspense_settlements.id
    //   suspense_settlements.voucher_id  (migration 019)  ->  vouchers.id
    let suspenseSerial = null;
    let suspenseVoucherId = null;
    if (voucher.is_suspense_settlement) {
      // Primary: look up via suspense_settlements.voucher_id (set for new records)
      const { data: linkedSettlements } = await supabase
        .from('suspense_settlements')
        .select('suspense_id')
        .eq('voucher_id', req.params.voucherId)
        .limit(1);
      suspenseVoucherId = linkedSettlements?.[0]?.suspense_id || null;

      // Fallback: for single-entry vouchers created before voucher_id was written back,
      // use the voucher's own settlement_id FK to walk up to the suspense voucher.
      if (!suspenseVoucherId && voucher.settlement_id) {
        const { data: bySettlementId } = await supabase
          .from('suspense_settlements')
          .select('suspense_id')
          .eq('id', voucher.settlement_id)
          .limit(1);
        suspenseVoucherId = bySettlementId?.[0]?.suspense_id || null;
      }

      if (suspenseVoucherId) {
        const { data: sv } = await supabase.from('suspense_vouchers')
          .select('serial_number').eq('id', suspenseVoucherId).single();
        suspenseSerial = sv?.serial_number || null;
      }
    }
    
    const { data: attachments } = await supabase
      .from('voucher_attachments')
      .select('id, file_name, public_url, mime_type, uploaded_at')
      .eq('voucher_id', req.params.voucherId)
      .order('uploaded_at', { ascending: true });

    // Use payment_batch_vouchers — works for pre- and post-migration-035 payments.
    const { data: batchMembership } = await supabase
      .from('payment_batch_vouchers')
      .select('batch_id, payment_batches(batch_reference)')
      .eq('voucher_id', req.params.voucherId)
      .maybeSingle();
    const resolvedBatchId = batchMembership?.batch_id || voucher.batch_id || null;
    const batchReference = batchMembership?.payment_batches?.batch_reference || null;

    // Fetch all co-members for the audit trail (CPAY batch voucher list).
    let batchMembers = [];
    if (resolvedBatchId) {
      const { data: memberRows } = await supabase
        .from('payment_batch_vouchers')
        .select('vouchers(serial_number, amount)')
        .eq('batch_id', resolvedBatchId);
      batchMembers = (memberRows || []).map(m => m.vouchers).filter(Boolean)
        .sort((a, b) => (a.serial_number || '').localeCompare(b.serial_number || ''));
    }

    res.json({
      ...voucher,
      payee_name: voucher.payee?.name,
      payee_alias: voucher.payee?.alias,
      payee_mobile: voucher.payee?.mobile,
      payee_upi_id: voucher.payee?.upi_id,
      payee_bank_account: voucher.payee?.bank_account,
      payee_ifsc: voucher.payee?.ifsc,
      payee_bank_name: voucher.payee?.bank_name,
      preparer_name: voucher.preparer?.name,
      preparer_username: voucher.preparer?.username,
      approver_name: voucher.approver?.name,
      approver_username: voucher.approver?.username,
      company_name: voucher.company?.name,
      company_address: voucher.company?.address,
      company_gst: voucher.company?.gst,
      suspense_serial: suspenseSerial,
      suspense_voucher_id: suspenseVoucherId,
      batch_id: resolvedBatchId,
      batch_reference: batchReference,
      batch_members: batchMembers,
      attachments: attachments || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve voucher
app.post('/api/vouchers/:voucherId/approve', async (req, res) => {
  const { approvedBy } = req.body;
  console.log(`\n✅ APPROVE VOUCHER REQUEST`);
  console.log(`   Voucher ID: ${req.params.voucherId}`);
  console.log(`   Approved By: ${approvedBy}`);
  
  try {
    const approver = await getActorRole(approvedBy);
    if (approver.role !== 'admin' && !approver.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only Approvers or Super Admin can approve vouchers' });
    }
    
    const { data: voucher, error: voucherError } = await supabase.from('vouchers')
      .select('*, payee:payees(name, mobile, requires_otp, payee_type)')
      .eq('id', req.params.voucherId)
      .single();
    
    if (voucherError) {
      console.log(`   ❌ Database error: ${voucherError.message}`);
      return res.status(500).json({ error: 'Database error', details: voucherError.message });
    }
    
    if (!voucher) {
      console.log(`   ❌ Voucher not found`);
      return res.status(404).json({ error: 'Voucher not found' });
    }
    
    if (voucher.status !== 'pending') {
      console.log(`   ❌ Voucher is not pending, status: ${voucher.status}`);
      return res.status(400).json({ error: 'Voucher is not pending' });
    }

    // ── Suspense-settlement fast path ──────────────────────────────────────────
    // Vouchers created from suspense settlement entries are pre-paid — the cash
    // was already disbursed as the suspense advance.  After Admin approval they
    // are immediately marked PAID (not just completed); no OTP, document step,
    // or separate payment queue action is needed.
    if (voucher.is_suspense_settlement) {
      const now = new Date().toISOString();
      await supabase.from('vouchers')
        .update({
          status:             'paid',
          approved_by:        approvedBy,
          approved_at:        now,
          payee_otp_verified: true,
          completed_at:       now,
          paid_by:            approvedBy,
          paid_at:            now,
          payment_notes:      'Pre-paid via suspense advance'
        })
        .eq('id', req.params.voucherId);

      // Notify the Accounts user who prepared the voucher
      await supabase.from('notifications').insert({
        user_id: voucher.prepared_by,
        title: 'Suspense Voucher Approved & Paid',
        message: `Voucher ${voucher.serial_number} (suspense settlement) has been approved and marked as paid (pre-paid via advance).`,
        type: 'info',
        voucher_id: req.params.voucherId
      });

      return res.json({ success: true, suspenseSettlement: true, message: 'Suspense-settlement voucher approved and marked paid.' });
    }
    // ──────────────────────────────────────────────────────────────────────────

    // Check if this payee requires OTP or document verification
    const requiresOtp = voucher.payee?.requires_otp !== false;
    const payeeType = voucher.payee?.payee_type || 'registered';
    
    console.log(`   Payee Type: ${payeeType}, Requires OTP: ${requiresOtp}`);
    
    // For ad-hoc payees or payees that don't require OTP, use document verification
    if (!requiresOtp || payeeType === 'adhoc') {
      console.log(`   📄 Ad-hoc payee - requires document verification`);
      
      // Check if document is uploaded
      if (!voucher.document_url) {
        // Update status to indicate document is required
        await supabase.from('vouchers')
          .update({
            status: 'awaiting_document',
            verification_type: 'document',
            approved_by: approvedBy,
            approved_at: new Date().toISOString()
          })
          .eq('id', req.params.voucherId);
        
        // Notify preparer to upload document
        await supabase.from('notifications').insert({
          user_id: voucher.prepared_by,
          title: 'Document Upload Required',
          message: `Voucher ${voucher.serial_number} requires invoice/receipt upload for completion.`,
          type: 'document_required',
          voucher_id: req.params.voucherId
        });
        
        sendPushNotification(
          voucher.prepared_by,
          '📄 Document Required',
          `Upload invoice/receipt for voucher ${voucher.serial_number}`,
          '/'
        );
        
        return res.json({
          success: true,
          requiresDocument: true,
          message: 'Voucher pre-approved. Document upload required for completion.',
          verificationType: 'document'
        });
      } else {
        // Document already uploaded - redirect to attestation flow
        return res.json({
          success: true,
          requiresAttestation: true,
          hasDocument: true,
          documentUrl: voucher.document_url,
          message: 'Document found. Please verify and attest.',
          verificationType: 'document'
        });
      }
    }
    
    // Standard OTP flow for registered payees
    if (!voucher.payee || !voucher.payee.mobile) {
      console.log(`   ❌ Payee or mobile not found. Payee data: ${JSON.stringify(voucher.payee)}`);
      return res.status(400).json({ error: 'Payee mobile number not found' });
    }
    
    // Update voucher status
    await supabase.from('vouchers')
      .update({
        status: 'awaiting_payee_otp',
        verification_type: 'otp',
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', req.params.voucherId);
    
    // Send OTP to payee via MSG91
    try {
      const formattedMobile = formatMobile(voucher.payee.mobile);
      console.log(`   Sending OTP to: ${formattedMobile}`);
      
      const otpResult = await callMsg91OtpSend(formattedMobile, `Send Payee OTP for voucher ${req.params.voucherId}`, {
        name: voucher.payee.name.trim().substring(0, 30),
        amount: Math.round(parseFloat(voucher.amount)).toString(),
      });
      
      if (otpResult.success) {
        await saveOtpSession(formattedMobile, otpResult.sessionId, 'payee_verification', req.params.voucherId);
        console.log(`   ✅ OTP sent successfully`);
        
        // Notify preparer
        await supabase.from('notifications').insert({
          user_id: voucher.prepared_by,
          title: 'Voucher Approved - Payee OTP Required',
          message: `Voucher ${voucher.serial_number} approved. OTP sent to payee. Please collect and enter the OTP.`,
          type: 'otp_required',
          voucher_id: req.params.voucherId
        });
        
        // Send push notification to preparer
        sendPushNotification(
          voucher.prepared_by,
          '✅ Voucher Approved - OTP Sent',
          `Voucher ${voucher.serial_number} approved. Collect OTP from payee.`,
          '/'
        );
        
        res.json({
          success: true,
          message: 'Voucher approved. OTP sent to payee.',
          payeeMobile: voucher.payee.mobile.replace(/\d(?=\d{4})/g, '*')
        });
      } else {
        console.error('   ❌ MSG91 Error:', otpResult.data);
        res.status(500).json({ error: 'Failed to send OTP to payee', details: otpResult.data?.message || otpResult.error });
      }
    } catch (err) {
      console.error('   ❌ OTP Exception:', err.message);
      res.status(500).json({ error: 'Failed to send OTP to payee', details: err.message });
    }
  } catch (error) {
    console.error('   ❌ Exception:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Reject voucher
app.post('/api/vouchers/:voucherId/reject', async (req, res) => {
  const { rejectedBy, reason } = req.body;
  
  try {
    const rejecterActor = await getActorRole(rejectedBy);
    if (rejecterActor.role !== 'admin' && !rejecterActor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only Approvers or Super Admin can reject vouchers' });
    }
    
    const { data: voucher } = await supabase.from('vouchers')
      .select('*')
      .eq('id', req.params.voucherId)
      .single();
    
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    
    await supabase.from('vouchers')
      .update({ status: 'rejected', approved_by: rejectedBy })
      .eq('id', req.params.voucherId);
    
    const { data: rejecter } = await supabase.from('users')
      .select('name')
      .eq('id', rejectedBy)
      .single();
    
    await supabase.from('notifications').insert({
      user_id: voucher.prepared_by,
      title: 'Voucher Rejected',
      message: `Voucher ${voucher.serial_number} rejected by ${rejecter.name}. Reason: ${reason || 'Not specified'}`,
      type: 'rejected',
      voucher_id: req.params.voucherId
    });
    
    // Send push notification to preparer
    sendPushNotification(
      voucher.prepared_by,
      '❌ Voucher Rejected',
      `Voucher ${voucher.serial_number} rejected: ${reason || 'No reason specified'}`,
      '/'
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete voucher with payee OTP
app.post('/api/vouchers/:voucherId/complete', async (req, res) => {
  const { otp } = req.body;
  
  console.log(`\n💳 COMPLETE VOUCHER REQUEST`);
  console.log(`   Voucher ID: ${req.params.voucherId}`);
  console.log(`   OTP: ${otp}`);
  
  try {
    const { data: voucher } = await supabase.from('vouchers')
      .select('*, payee:payees(mobile)')
      .eq('id', req.params.voucherId)
      .single();
    
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.status !== 'awaiting_payee_otp') {
      return res.status(400).json({ error: 'Voucher is not awaiting payee OTP' });
    }
    
    // Verify payee OTP via MSG91
    const formattedMobile = formatMobile(voucher.payee.mobile);
    console.log(`   Payee Mobile: ${formattedMobile}`);
    
    const session = await getOtpSession(formattedMobile, req.params.voucherId);
    
    if (!session) {
      console.log(`   ❌ No OTP session found in DB for payee: ${formattedMobile}, voucher: ${req.params.voucherId}`);
      return res.status(400).json({ error: 'No OTP session found. Please click "Resend OTP" to send a fresh OTP.' });
    }
    
    console.log(`   📝 Session found (purpose: ${session.purpose})`);
    
    const result = await callMsg91OtpVerify(otp, session.sessionId, `Verify Payee OTP for voucher ${req.params.voucherId}`);
    
    if (!result.success) {
      const detail = result.data?.message || result.error || 'Unknown error';
      console.log(`   ❌ OTP verification failed: ${detail}`);
      return res.status(400).json({ error: 'Invalid OTP', details: detail });
    }
    
    // Clear the session
    console.log(`   ✅ OTP Verified! Completing voucher...`);
    await deleteOtpSession(formattedMobile);
    
    const signature = Buffer.from(
      `${voucher.payee.mobile}:${req.params.voucherId}:${Date.now()}:verified`
    ).toString('base64');
    
    // Cash vouchers: OTP is the payee's confirmation of receipt — mark paid immediately.
    const isCash = voucher.payment_mode === 'Cash';
    const now = new Date().toISOString();
    await supabase.from('vouchers')
      .update({
        status:             isCash ? 'paid' : 'completed',
        payee_otp_verified: true,
        payee_signature:    signature,
        completed_at:       now,
        ...(isCash ? { paid_at: now, paid_by: voucher.approved_by, payment_notes: 'Cash — paid on OTP verification' } : {})
      })
      .eq('id', req.params.voucherId);
    
    // Notify approver
    if (voucher.approved_by) {
      await supabase.from('notifications').insert({
        user_id: voucher.approved_by,
        title: isCash ? 'Cash Voucher Paid' : 'Voucher Completed - Ready for Payment',
        message: isCash
          ? `Voucher ${voucher.serial_number} is complete. Cash payment confirmed by payee OTP.`
          : `Voucher ${voucher.serial_number} is complete. Payment may be initiated.`,
        type: 'completed',
        voucher_id: req.params.voucherId
      });
      sendPushNotification(
        voucher.approved_by,
        isCash ? '✅ Cash Voucher Paid' : '💰 Voucher Ready for Payment',
        isCash
          ? `${voucher.serial_number} — cash confirmed by payee OTP.`
          : `Voucher ${voucher.serial_number} is complete and ready for payment.`,
        '/'
      );
    }
    
    res.json({ success: true, signature, cashPaid: isCash, message: isCash ? 'Cash voucher marked paid.' : 'Voucher completed. Payment may be initiated.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resend payee OTP
app.post('/api/vouchers/:voucherId/resend-otp', async (req, res) => {
  console.log(`\n🔄 RESEND PAYEE OTP REQUEST`);
  console.log(`   Voucher ID: ${req.params.voucherId}`);
  
  try {
    const { data: voucher, error: voucherError } = await supabase.from('vouchers')
      .select('*, payee:payees(name, mobile)')
      .eq('id', req.params.voucherId)
      .single();
    
    if (voucherError) {
      console.log(`   ❌ Database error: ${voucherError.message}`);
      return res.status(500).json({ error: 'Database error', details: voucherError.message });
    }
    
    if (!voucher) {
      console.log(`   ❌ Voucher not found`);
      return res.status(404).json({ error: 'Voucher not found' });
    }
    
    if (voucher.status !== 'awaiting_payee_otp') {
      console.log(`   ❌ Invalid status: ${voucher.status}`);
      return res.status(400).json({ error: `Invalid voucher status: ${voucher.status}` });
    }
    
    if (!voucher.payee || !voucher.payee.mobile) {
      console.log(`   ❌ Payee or mobile not found. Payee: ${JSON.stringify(voucher.payee)}`);
      return res.status(400).json({ error: 'Payee mobile number not found' });
    }
    
    const formattedMobile = formatMobile(voucher.payee.mobile);
    console.log(`   Payee Mobile: ${formattedMobile}`);
    
    const result = await callMsg91OtpSend(formattedMobile, `Resend Payee OTP for voucher ${req.params.voucherId}`, {
      name: voucher.payee.name.trim().substring(0, 30), amount: Math.round(parseFloat(voucher.amount)).toString(),
    });
    
    if (result.success) {
      await saveOtpSession(formattedMobile, result.sessionId, 'payee_verification', req.params.voucherId);
      console.log(`   📝 Session stored in Supabase for: ${formattedMobile}`);
      res.json({ success: true, message: 'OTP resent to payee' });
    } else {
      res.status(500).json({ error: 'Failed to resend OTP', details: result.data?.message || result.error });
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Delete voucher (Approver or Super Admin only)
app.delete('/api/vouchers/:voucherId', async (req, res) => {
  try {
    const actor = await getActorRole(req.body.deletedBy);
    if (actor.role !== 'admin' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only Approvers or Super Admin can delete vouchers' });
    }
    
    // First delete any notifications related to this voucher
    await supabase.from('notifications')
      .delete()
      .eq('voucher_id', req.params.voucherId);
    
    // Then delete the voucher
    const { error } = await supabase.from('vouchers')
      .delete()
      .eq('id', req.params.voucherId);
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Voucher deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Notifications
app.get('/api/users/:userId/notifications', async (req, res) => {
  try {
    const { data, error } = await supabase.from('notifications')
      .select('*')
      .eq('user_id', req.params.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications/:notificationId/read', async (req, res) => {
  try {
    await supabase.from('notifications')
      .update({ read: true })
      .eq('id', req.params.notificationId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users/:userId/notifications/read-all', async (req, res) => {
  try {
    await supabase.from('notifications')
      .update({ read: true })
      .eq('user_id', req.params.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PUSH NOTIFICATIONS ============

// Get VAPID public key (client needs this to subscribe)
app.get('/api/push/vapid-public-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Save push subscription for a user
app.post('/api/users/:userId/push-subscription', async (req, res) => {
  try {
    const { userId } = req.params;
    const subscription = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    
    if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      return res.status(400).json({ error: 'Invalid subscription: missing keys' });
    }
    
    // Upsert subscription (handles duplicate endpoints atomically)
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      subscription_json: JSON.stringify(subscription)
    }, { onConflict: 'endpoint' });
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Push subscription saved' });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete push subscription
app.delete('/api/users/:userId/push-subscription', async (req, res) => {
  try {
    const { userId } = req.params;
    const { endpoint } = req.body;
    
    await supabase.from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to send push notification to a user
const sendPushNotification = async (userId, title, body, url = '/') => {
  try {
    // Get all push subscriptions for this user
    const { data: subscriptions, error } = await supabase.from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);
    
    if (error || !subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user:', userId);
      return { sent: 0 };
    }
    
    const payload = JSON.stringify({
      title,
      body,
      url,
      icon: '/android-launchericon-192-192.png',
      badge: '/android-launchericon-96-96.png',
      timestamp: Date.now()
    });
    
    let sentCount = 0;
    let failedCount = 0;
    
    for (const sub of subscriptions) {
      try {
        const subscription = JSON.parse(sub.subscription_json);
        await webpush.sendNotification(subscription, payload);
        sentCount++;
      } catch (pushError) {
        console.error('Push notification failed:', pushError.message);
        failedCount++;
        
        // If subscription is invalid (410 Gone or 404), remove it
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          await supabase.from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
        }
      }
    }
    
    return { sent: sentCount, failed: failedCount };
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return { sent: 0, error: error.message };
  }
};

// Test push notification endpoint
app.post('/api/users/:userId/test-push', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await sendPushNotification(
      userId,
      '🔔 Test Notification',
      'Push notifications are working! You will receive alerts for new vouchers.',
      '/'
    );
    
    res.json({ 
      success: true, 
      message: result.sent > 0 
        ? `Push notification sent to ${result.sent} device(s)` 
        : 'No devices registered for push notifications'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ COMPANY PAYMENT ACCOUNTS ============

// List payment accounts for a company
app.get('/api/companies/:companyId/payment-accounts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('company_payment_accounts')
      .select('*')
      .eq('company_id', req.params.companyId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a payment account
app.post('/api/payment-accounts', async (req, res) => {
  const { companyId, label, bankAccountNumber } = req.body;
  if (!companyId || !label?.trim()) {
    return res.status(400).json({ error: 'companyId and label are required' });
  }
  try {
    const insert = { company_id: companyId, label: label.trim() };
    if (bankAccountNumber?.trim()) insert.bank_account_number = bankAccountNumber.trim();
    const { data, error } = await supabase
      .from('company_payment_accounts')
      .insert(insert)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, account: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a payment account
app.delete('/api/payment-accounts/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('company_payment_accounts')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ HEADS OF ACCOUNT ============

// Get heads of account for a company (includes global heads)
app.get('/api/heads-of-account', async (req, res) => {
  try {
    const companyId = req.query.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const { data, error } = await supabase.from('heads_of_account')
      .select('id, name, is_global, company_id')
      .or(`company_id.eq.${companyId},is_global.eq.true`)
      .order('name');
    
    if (error) throw error;
    
    // If no heads exist for this company, insert defaults
    if (!data || data.filter(h => h.company_id === companyId).length === 0) {
      const defaultHeads = [
        'Salaries & Wages', 'Rent', 'Utilities - Electricity', 'Utilities - Water',
        'Raw Materials', 'Packaging Materials', 'Transportation & Freight',
        'Maintenance & Repairs', 'Professional Fees', 'Marketing & Advertising',
        'Office Supplies', 'Insurance', 'Taxes & Duties', 'Bank Charges',
        'Interest Expenses', 'Miscellaneous Expenses', 'Capital Expenditure', 'Petty Cash'
      ];
      
      const insertData = defaultHeads.map(name => ({ company_id: companyId, name, is_global: false }));
      const { data: inserted, error: insertError } = await supabase.from('heads_of_account')
        .insert(insertData)
        .select('id, name, is_global, company_id');
      
      if (insertError) throw insertError;
      // Combine with any existing global heads
      const globalHeads = data ? data.filter(h => h.is_global) : [];
      return res.json([...globalHeads, ...(inserted || [])].sort((a, b) => a.name.localeCompare(b.name)));
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching heads of account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a new head of account
app.post('/api/heads-of-account', async (req, res) => {
  try {
    const { companyId, name, isGlobal } = req.body;
    
    if (!companyId || !name) {
      return res.status(400).json({ error: 'Company ID and name are required' });
    }

    const { data, error } = await supabase.from('heads_of_account')
      .insert({ company_id: companyId, name: name.trim(), is_global: isGlobal || false })
      .select('id, name, is_global, company_id')
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'Account head already exists' });
      }
      throw error;
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error adding head of account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a head of account
app.delete('/api/heads-of-account/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase.from('heads_of_account')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting head of account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a head of account
app.put('/api/heads-of-account/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isGlobal } = req.body;
    
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const updateData = { name: name.trim() };
    if (isGlobal !== undefined) updateData.is_global = isGlobal;
    
    const { data, error } = await supabase.from('heads_of_account')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;

    // When global flag changes, cascade to all sub-heads under this head
    if (isGlobal !== undefined) {
      const { error: subError } = await supabase.from('sub_heads_of_account')
        .update({ is_global: isGlobal })
        .eq('head_id', id);
      if (subError) {
        console.error('Warning: Failed to cascade global flag to sub-heads:', subError);
      }
    }
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating head of account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk import heads of account
app.post('/api/heads-of-account/import', async (req, res) => {
  try {
    const { companyId, names } = req.body;
    
    if (!companyId || !names || !Array.isArray(names)) {
      return res.status(400).json({ error: 'Company ID and names array are required' });
    }

    const insertData = names
      .map(name => name.trim())
      .filter(name => name.length > 0)
      .map(name => ({ company_id: companyId, name }));
    
    const { data, error } = await supabase.from('heads_of_account')
      .upsert(insertData, { onConflict: 'company_id,name', ignoreDuplicates: true })
      .select('id, name');
    
    if (error) throw error;
    
    res.json({ success: true, imported: data?.length || 0 });
  } catch (error) {
    console.error('Error importing heads of account:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ SUB-HEADS OF ACCOUNT ============

// Get sub-heads of account for a head or company (includes sub-heads of global heads)
app.get('/api/sub-heads-of-account', async (req, res) => {
  try {
    const { headId, companyId } = req.query;
    
    if (headId) {
      // Get sub-heads for a specific head
      const { data, error } = await supabase.from('sub_heads_of_account')
        .select('id, head_id, name, created_at')
        .eq('head_id', headId)
        .order('name');
      if (error) throw error;
      return res.json(data || []);
    } else if (companyId) {
      // Get sub-heads for this company's own heads
      const { data: ownSubHeads, error: ownError } = await supabase.from('sub_heads_of_account')
        .select('id, head_id, name, created_at')
        .eq('company_id', companyId)
        .order('name');
      if (ownError) throw ownError;

      // Also get sub-heads of global heads from OTHER companies
      const { data: globalHeads, error: ghError } = await supabase.from('heads_of_account')
        .select('id')
        .eq('is_global', true)
        .neq('company_id', companyId);
      if (ghError) throw ghError;

      let globalSubHeads = [];
      if (globalHeads && globalHeads.length > 0) {
        const globalHeadIds = globalHeads.map(h => h.id);
        const { data: gSubHeads, error: gsError } = await supabase.from('sub_heads_of_account')
          .select('id, head_id, name, created_at')
          .in('head_id', globalHeadIds)
          .order('name');
        if (gsError) throw gsError;
        globalSubHeads = gSubHeads || [];
      }

      // Combine and deduplicate
      const allSubHeads = [...(ownSubHeads || []), ...globalSubHeads];
      return res.json(allSubHeads);
    } else {
      return res.status(400).json({ error: 'headId or companyId is required' });
    }
  } catch (error) {
    console.error('Error fetching sub-heads of account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all sub-heads grouped by head for a company (includes global heads + their sub-heads)
app.get('/api/sub-heads-of-account/grouped', async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    // Get heads for this company + global heads from other companies
    const { data: heads, error: headsError } = await supabase.from('heads_of_account')
      .select('id, name, is_global, company_id')
      .or(`company_id.eq.${companyId},is_global.eq.true`)
      .order('name');
    
    if (headsError) throw headsError;

    // Get sub-heads for all these heads
    const headIds = (heads || []).map(h => h.id);
    let subHeads = [];
    if (headIds.length > 0) {
      const { data: subData, error: subHeadsError } = await supabase.from('sub_heads_of_account')
        .select('id, head_id, name')
        .in('head_id', headIds)
        .order('name');
      if (subHeadsError) throw subHeadsError;
      subHeads = subData || [];
    }

    // Group sub-heads by head_id
    const grouped = (heads || []).map(head => ({
      ...head,
      subHeads: subHeads.filter(sh => sh.head_id === head.id)
    }));
    
    res.json(grouped);
  } catch (error) {
    console.error('Error fetching grouped sub-heads:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a new sub-head of account
app.post('/api/sub-heads-of-account', async (req, res) => {
  try {
    const { headId, companyId, name } = req.body;
    
    if (!headId || !companyId || !name) {
      return res.status(400).json({ error: 'headId, companyId, and name are required' });
    }

    // Check if parent head is global — if so, sub-head should inherit global flag
    const { data: parentHead } = await supabase.from('heads_of_account')
      .select('is_global')
      .eq('id', headId)
      .single();
    const isParentGlobal = parentHead?.is_global || false;

    const { data, error } = await supabase.from('sub_heads_of_account')
      .insert({ head_id: headId, company_id: companyId, name: name.trim(), is_global: isParentGlobal })
      .select('id, head_id, name')
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Sub-head already exists under this head' });
      }
      throw error;
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error adding sub-head of account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a sub-head of account
app.delete('/api/sub-heads-of-account/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase.from('sub_heads_of_account')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting sub-head of account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a sub-head of account
app.put('/api/sub-heads-of-account/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const { data, error } = await supabase.from('sub_heads_of_account')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating sub-head of account:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// DOCUMENT-BASED VERIFICATION ENDPOINTS
// For payments to random/unregistered establishments
// ==========================================

// Upload document (invoice/receipt) for a voucher
app.post('/api/vouchers/:voucherId/upload-document', async (req, res) => {
  const { documentData, mimeType, uploadedBy } = req.body;
  
  console.log(`\n📄 DOCUMENT UPLOAD REQUEST`);
  console.log(`   Voucher ID: ${req.params.voucherId}`);
  console.log(`   Uploaded By: ${uploadedBy}`);
  
  if (!documentData || !uploadedBy) {
    return res.status(400).json({ error: 'Document data and uploader ID are required' });
  }
  
  try {
    // Verify voucher exists
    const { data: voucher, error: voucherError } = await supabase.from('vouchers')
      .select('*, payee:payees(requires_otp, payee_type)')
      .eq('id', req.params.voucherId)
      .single();
    
    if (voucherError || !voucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }
    
    // Decode base64 and upload to Supabase Storage
    const base64Data = documentData.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const extension = mimeType?.includes('pdf') ? 'pdf' : 
                      mimeType?.includes('png') ? 'png' : 
                      mimeType?.includes('webp') ? 'webp' : 'jpg';
    const fileName = `voucher-${voucher.serial_number}-${Date.now()}.${extension}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('voucher-documents')
      .upload(fileName, buffer, {
        contentType: mimeType || 'image/jpeg',
        upsert: true
      });
    
    if (uploadError) {
      console.error('   ❌ Upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload document', details: uploadError.message });
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('voucher-documents')
      .getPublicUrl(fileName);
    
    const documentUrl = urlData?.publicUrl || fileName;
    
    // Update voucher with document info
    const { error: updateError } = await supabase.from('vouchers')
      .update({
        document_url: documentUrl,
        document_uploaded_at: new Date().toISOString(),
        document_uploaded_by: uploadedBy,
        verification_type: 'document'
      })
      .eq('id', req.params.voucherId);
    
    if (updateError) throw updateError;
    
    console.log(`   ✅ Document uploaded: ${fileName}`);
    
    res.json({ 
      success: true, 
      documentUrl,
      message: 'Document uploaded successfully. Awaiting approver attestation.'
    });
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Approve voucher with document attestation (for non-OTP payees)
app.post('/api/vouchers/:voucherId/approve-with-attestation', async (req, res) => {
  const { approvedBy, attestationNotes } = req.body;
  
  console.log(`\n✅ APPROVE WITH ATTESTATION REQUEST`);
  console.log(`   Voucher ID: ${req.params.voucherId}`);
  console.log(`   Approved By: ${approvedBy}`);
  
  if (!approvedBy) {
    return res.status(400).json({ error: 'Approver ID is required' });
  }
  
  try {
    const approverActor = await getActorRole(approvedBy);
    if (approverActor.role !== 'admin' && !approverActor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only Approvers or Super Admin can attest vouchers' });
    }
    
    // Get voucher with payee info
    const { data: voucher, error: voucherError } = await supabase.from('vouchers')
      .select('*, payee:payees(name, requires_otp, payee_type)')
      .eq('id', req.params.voucherId)
      .single();
    
    if (voucherError || !voucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }
    
    if (voucher.status !== 'pending') {
      return res.status(400).json({ error: 'Voucher is not pending approval' });
    }
    
    // Check if document is uploaded
    if (!voucher.document_url) {
      return res.status(400).json({ error: 'Document must be uploaded before attestation' });
    }
    
    // Get approver name for signature
    const { data: approver } = await supabase.from('users')
      .select('name')
      .eq('id', approvedBy)
      .single();
    
    // Create attestation signature
    const attestationSignature = Buffer.from(
      `${approver?.name || approvedBy}:${req.params.voucherId}:${Date.now()}:document-attested`
    ).toString('base64');
    
    // Update voucher - mark as completed with document verification
    const { error: updateError } = await supabase.from('vouchers')
      .update({
        status: 'completed',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        attested_by: approvedBy,
        attested_at: new Date().toISOString(),
        attestation_notes: attestationNotes || `Document verified by ${approver?.name || 'Approver'}`,
        verification_type: 'document',
        payee_signature: attestationSignature,
        completed_at: new Date().toISOString()
      })
      .eq('id', req.params.voucherId);
    
    if (updateError) throw updateError;
    
    // Notify preparer
    await supabase.from('notifications').insert({
      user_id: voucher.prepared_by,
      title: 'Voucher Approved with Document Attestation',
      message: `Voucher ${voucher.serial_number} has been approved and completed. Document verified by approver.`,
      type: 'completed',
      voucher_id: req.params.voucherId
    });
    
    // Send push notification
    sendPushNotification(
      voucher.prepared_by,
      '📄 Voucher Approved (Document Verified)',
      `Voucher ${voucher.serial_number} completed with document attestation.`,
      '/'
    );
    
    console.log(`   ✅ Voucher approved with document attestation`);
    
    res.json({ 
      success: true, 
      message: 'Voucher approved and completed with document attestation.',
      verificationType: 'document'
    });
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get document URL for a voucher
app.get('/api/vouchers/:voucherId/document', async (req, res) => {
  try {
    const { data: voucher, error } = await supabase.from('vouchers')
      .select('document_url, document_uploaded_at, document_uploaded_by')
      .eq('id', req.params.voucherId)
      .single();
    
    if (error) throw error;
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    
    res.json({
      hasDocument: !!voucher.document_url,
      documentUrl: voucher.document_url,
      uploadedAt: voucher.document_uploaded_at,
      uploadedBy: voucher.document_uploaded_by
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUSPENSE VOUCHER SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

// Create suspense voucher
app.post('/api/suspense-vouchers', async (req, res) => {
  const { companyId, staffPayeeId, staffUserId, advanceAmount, purpose, narration, paymentMode, createdBy } = req.body;
  if (!companyId || !staffPayeeId || !advanceAmount || !purpose || !createdBy) {
    return res.status(400).json({ error: 'companyId, staffPayeeId, advanceAmount, purpose and createdBy are required' });
  }
  try {
    const actor = await getActorRole(createdBy);
    if (actor.role !== 'accounts' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only Accounts users or Super Admin can create suspense vouchers' });
    }

    // Validate the staff payee exists and belongs to this company
    const { data: payee, error: payeeErr } = await supabase.from('payees')
      .select('id, name, mobile, user_id, is_staff')
      .eq('id', staffPayeeId)
      .eq('company_id', companyId)
      .eq('is_staff', true)
      .single();
    if (payeeErr || !payee) {
      return res.status(400).json({ error: 'Staff payee not found. Please add the staff member in Payees Management and mark them as a Staff Payee first.' });
    }

    // Block if this payee already has an active (open/partial/pending_approval) voucher
    const { data: existingActive } = await supabase.from('suspense_vouchers')
      .select('id, serial_number, status, balance_amount, advance_amount')
      .eq('company_id', companyId)
      .eq('staff_payee_id', staffPayeeId)
      .in('status', ['pending_approval', 'open', 'partial'])
      .limit(1);
    if (existingActive && existingActive.length > 0) {
      const ev = existingActive[0];
      return res.status(409).json({
        error: `${payee.name} already has an active suspense voucher (${ev.serial_number} · ${ev.status}). Please close it before creating a new one.`,
        activeVoucher: { id: ev.id, serialNumber: ev.serial_number, status: ev.status, balanceAmount: ev.balance_amount, advanceAmount: ev.advance_amount }
      });
    }

    const { data: serialData, error: serialError } = await supabase.rpc('get_next_suspense_number', { p_company_id: companyId });
    if (serialError) throw serialError;

    const { data: sv, error } = await supabase.from('suspense_vouchers').insert({
      company_id: companyId,
      serial_number: serialData,
      staff_user_id: payee.user_id || null,
      staff_payee_id: payee.id,
      advance_amount: advanceAmount,
      balance_amount: advanceAmount,
      purpose,
      narration: narration || null,
      payment_mode: paymentMode || null,
      created_by: createdBy,
      status: 'pending_approval'
    }).select().single();
    if (error) throw error;

    // Notify admins
    const { data: adminEntries } = await supabase.from('user_companies')
      .select('user_id').eq('company_id', companyId).eq('role', 'admin');
    const { data: creator } = await supabase.from('users').select('name').eq('id', createdBy).single();
    if (adminEntries && adminEntries.length > 0) {
      const notifications = adminEntries.map(a => ({
        user_id: a.user_id,
        title: 'Suspense Voucher Pending Approval',
        message: `Suspense voucher ${serialData} created by ${creator?.name || 'Unknown'} requires approval.`,
        type: 'approval_required'
      }));
      await supabase.from('notifications').insert(notifications);
      for (const admin of adminEntries) {
        sendPushNotification(admin.user_id, '💼 Suspense Voucher Pending', `${serialData} by ${creator?.name || 'Unknown'} requires approval.`, '/');
      }
    }
    res.json({ success: true, suspenseVoucher: sv });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List suspense vouchers for a company
app.get('/api/companies/:companyId/suspense-vouchers', async (req, res) => {
  const { status, staffUserId } = req.query;
  try {
    let query = supabase.from('suspense_vouchers')
      .select(`*, staff:users!staff_user_id(id,name,first_name), staff_payee:payees!staff_payee_id(id,name,mobile), creator:users!created_by(id,name), approver:users!approved_by(id,name)`)
      .eq('company_id', req.params.companyId)
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (staffUserId) query = query.eq('staff_user_id', staffUserId);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ suspenseVouchers: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pending top-up approvals for this company — Admin/Super Admin inbox
app.get('/api/companies/:companyId/pending-topups', async (req, res) => {
  try {
    const { data, error } = await supabase.from('suspense_settlements')
      .select(`*, submitter:users!submitted_by(id,name), suspense:suspense_vouchers!suspense_id(id,serial_number,purpose,staff_payee:payees!staff_payee_id(id,name,mobile))`)
      .eq('company_id', req.params.companyId)
      .eq('entry_type', 'topup')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ pendingTopUps: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single suspense voucher with settlements
app.get('/api/suspense-vouchers/:id', async (req, res) => {
  try {
    const { data: sv, error } = await supabase.from('suspense_vouchers')
      .select(`*, staff:users!staff_user_id(id,name,first_name,mobile), staff_payee:payees!staff_payee_id(id,name,mobile,upi_id,bank_account,ifsc,bank_name), creator:users!created_by(id,name), approver:users!approved_by(id,name), advance_payer:users!advance_paid_by(id,name)`)
      .eq('id', req.params.id)
      .single();
    if (error || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });

    const { data: settlements } = await supabase.from('suspense_settlements')
      .select(`*, submitter:users!submitted_by(id,name), payer:users!paid_by(id,name), linked_voucher:vouchers!voucher_id(id,serial_number,status,amount,payment_mode)`)
      .eq('suspense_id', req.params.id)
      .order('created_at', { ascending: true });

    const { data: attachments } = await supabase.from('voucher_attachments')
      .select('*').eq('suspense_id', req.params.id).order('uploaded_at', { ascending: false });

    // For old settlement entries where voucher_id was never written back,
    // patch it in now using the reverse FK (vouchers.settlement_id → settlements.id).
    const unmapped = (settlements || []).filter(s => s.entry_type === 'expense' && s.status === 'approved' && !s.voucher_id);
    if (unmapped.length > 0) {
      const { data: linkedVouchers } = await supabase.from('vouchers')
        .select('id, serial_number, settlement_id')
        .in('settlement_id', unmapped.map(s => s.id))
        .eq('is_suspense_settlement', true);
      if (linkedVouchers?.length) {
        const bySettlementId = Object.fromEntries(linkedVouchers.map(v => [v.settlement_id, v]));
        for (const s of (settlements || [])) {
          if (!s.voucher_id && bySettlementId[s.id]) {
            s.voucher_id = bySettlementId[s.id].id;
            s.linked_voucher = bySettlementId[s.id]; // populate serial_number etc. for the UI
          }
        }
        // Opportunistically persist the back-link so future requests don't need this fallback
        for (const v of linkedVouchers) {
          supabase.from('suspense_settlements').update({ voucher_id: v.id }).eq('id', v.settlement_id).then(() => {});
        }
      }
    }

    // Compute total suspense sent (initial advance + all approved top-ups)
    const approvedTopups = (settlements || []).filter(s => s.entry_type === 'topup' && s.status === 'approved');
    const totalSuspenseSent = parseFloat(sv.advance_amount) + approvedTopups.reduce((sum, s) => sum + parseFloat(s.amount), 0);

    // Compute total approved expenses (may exceed totalSuspenseSent — overspend)
    const approvedExpenses = (settlements || []).filter(s => s.entry_type === 'expense' && s.status === 'approved');
    const totalExpensesApproved = approvedExpenses.reduce((sum, s) => sum + parseFloat(s.amount), 0);

    // Pending expenses (submitted but not yet approved)
    const pendingExpenses = (settlements || []).filter(s => s.entry_type === 'expense' && s.status === 'pending_review');
    const totalExpensesPending = pendingExpenses.reduce((sum, s) => sum + parseFloat(s.amount), 0);

    res.json({
      suspenseVoucher: {
        ...sv,
        total_suspense_sent: totalSuspenseSent,
        total_expenses_approved: totalExpensesApproved,
        total_expenses_pending: totalExpensesPending,
        settlements: settlements || [],
        attachments: attachments || []
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve suspense voucher
app.post('/api/suspense-vouchers/:id/approve', async (req, res) => {
  const { approvedBy } = req.body;
  if (!approvedBy) return res.status(400).json({ error: 'approvedBy is required' });
  try {
    const actor = await getActorRole(approvedBy);
    if (actor.role !== 'admin' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only admins can approve' });
    }
    const { data: sv, error } = await supabase.from('suspense_vouchers')
      .update({ status: 'awaiting_payee_otp', approved_by: approvedBy, approved_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('status', 'pending_approval')
      .select().single();
    if (error) throw error;
    if (!sv) return res.status(404).json({ error: 'Suspense voucher not found or already processed' });

    let payee = null;
    if (sv.staff_payee_id) {
      const { data: p } = await supabase.from('payees')
        .select('id, mobile, name, user_id, is_staff')
        .eq('id', sv.staff_payee_id)
        .eq('is_staff', true)
        .single();
      payee = p || null;
    }
    // Fallback for vouchers created before migration 015
    if (!payee && sv.staff_user_id) {
      const { data: p } = await supabase.from('payees')
        .select('id, mobile, name, user_id, is_staff')
        .eq('user_id', sv.staff_user_id)
        .eq('is_staff', true)
        .single();
      if (p) {
        payee = p;
        await supabase.from('suspense_vouchers')
          .update({ staff_payee_id: p.id })
          .eq('id', sv.id);
      }
    }
    if (!payee) {
      return res.status(400).json({ error: 'The suspense staff payee is missing. Please update the voucher or set up the staff payee first.' });
    }
    if (!payee.mobile) {
      return res.status(400).json({ error: 'Staff payee has no registered mobile number. OTP cannot be sent.' });
    }

    // Send OTP to the staff payee so they can confirm receipt of the advance.
    // The settlement form link is only activated AFTER OTP is verified.
    const formattedMobile = formatMobile(payee.mobile);
    const otpResult = await callMsg91OtpSend(formattedMobile, `Send advance OTP for suspense ${sv.serial_number}`, { name: payee.name, amount: sv.amount });
    if (!otpResult.success) {
      // Roll back status so Admin can retry
      await supabase.from('suspense_vouchers').update({ status: 'pending_approval', approved_by: null, approved_at: null }).eq('id', sv.id);
      return res.status(500).json({ error: 'Failed to send OTP to payee', details: otpResult.data?.message || otpResult.error });
    }
    await saveOtpSession(formattedMobile, otpResult.sessionId, 'suspense_advance', null, sv.id);

    // Notify Accounts creator that OTP has been sent and is awaiting verification
    const { data: approver } = await supabase.from('users').select('name').eq('id', approvedBy).single();
    await supabase.from('notifications').insert({
      user_id: sv.created_by,
      title: 'Suspense Voucher Approved — OTP Sent',
      message: `${sv.serial_number} approved by ${approver?.name || 'Admin'}. OTP sent to ${payee.name} (${payee.mobile.replace(/\d(?=\d{4})/g, '*')}) to confirm advance receipt. Please verify the OTP to activate the settlement link.`,
      type: 'info'
    });

    res.json({
      success: true,
      requiresOtp: true,
      payeeName: payee.name,
      payeeMobile: payee.mobile.replace(/\d(?=\d{4})/g, '*'),
      suspenseVoucher: sv
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify advance OTP — confirms payee received the suspense advance.
// On success the voucher moves to 'open' and the settlement SMS link is activated.
app.post('/api/suspense-vouchers/:id/verify-advance-otp', async (req, res) => {
  const { otp, verifiedBy } = req.body;
  if (!otp) return res.status(400).json({ error: 'otp is required' });
  if (!verifiedBy) return res.status(400).json({ error: 'verifiedBy is required' });
  try {
    const actor = await getActorRole(verifiedBy);
    if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data: sv, error: svErr } = await supabase.from('suspense_vouchers')
      .select('*, payees!suspense_vouchers_staff_payee_id_fkey(id, mobile, name, user_id, is_staff)')
      .eq('id', req.params.id)
      .single();
    if (svErr || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });
    if (sv.status !== 'awaiting_payee_otp') {
      return res.status(400).json({ error: `Voucher is not awaiting OTP (status: ${sv.status})` });
    }

    const payee = sv.payees;
    if (!payee?.mobile) return res.status(400).json({ error: 'Payee mobile not found' });

    const formattedMobile = formatMobile(payee.mobile);
    const session = await getOtpSession(formattedMobile);
    if (!session) {
      return res.status(400).json({ error: 'No active OTP session found. Please resend OTP first.' });
    }
    const result = await callMsg91OtpVerify(
      otp, session.sessionId,
      `Verify advance OTP for suspense ${sv.serial_number}`
    );
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid OTP', details: result.data?.message });
    }

    // Mark voucher as open and stamp the verification timestamp
    const now = new Date().toISOString();
    await supabase.from('suspense_vouchers')
      .update({ status: 'open', advance_otp_verified_at: now })
      .eq('id', sv.id);

    // Now create the settlement session and send the SMS link
    const settlementToken = generateSettlementToken();
    const farFuture = '2099-12-31T23:59:59.000Z';
    const { data: session_data, error: sessionError } = await supabase.from('settlement_sessions').insert({
      suspense_id: sv.id,
      payee_id: payee.id,
      token: settlementToken,
      expires_at: farFuture,
      last_sent_at: now
    }).select().single();
    if (sessionError) throw sessionError;

    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const settlementUrl = `${baseUrl}/settlement/${settlementToken}`;
    const smsSent = await sendWhatsApp(payee.mobile, 'pramaana_settlement_link', payee.name, parseFloat(sv.advance_amount).toFixed(2), settlementUrl);

    // Notify creator + payee (if a system user)
    const { data: verifier } = await supabase.from('users').select('name').eq('id', verifiedBy).single();
    const notifications = [
      {
        user_id: sv.created_by,
        title: 'Suspense Voucher Active',
        message: `${sv.serial_number} is now open. ${payee.name} confirmed advance receipt via OTP. Settlement link has been sent.`,
        type: 'info'
      }
    ];
    if (payee.user_id) {
      notifications.push({
        user_id: payee.user_id,
        title: 'Settlement Form Ready',
        message: `Your settlement form for ${sv.serial_number} is ready. Please submit your expense entries.`,
        type: 'info'
      });
    }
    await supabase.from('notifications').insert(notifications);

    res.json({ success: true, settlementUrl, smsSent: smsSent !== false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resend advance OTP for a suspense voucher that is awaiting payee confirmation
app.post('/api/suspense-vouchers/:id/resend-advance-otp', async (req, res) => {
  const { requestedBy } = req.body;
  if (!requestedBy) return res.status(400).json({ error: 'requestedBy is required' });
  try {
    const actor = await getActorRole(requestedBy);
    if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data: sv, error: svErr } = await supabase.from('suspense_vouchers')
      .select('*, payees!suspense_vouchers_staff_payee_id_fkey(id, mobile, name)')
      .eq('id', req.params.id)
      .single();
    if (svErr || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });
    if (sv.status !== 'awaiting_payee_otp') {
      return res.status(400).json({ error: `Voucher is not awaiting OTP (status: ${sv.status})` });
    }

    const payee = sv.payees;
    if (!payee?.mobile) return res.status(400).json({ error: 'Payee mobile not found' });

    const formattedMobile = formatMobile(payee.mobile);
    const otpResult = await callMsg91OtpSend(formattedMobile, `Resend advance OTP for suspense ${sv.id}`, { name: payee.name, amount: sv.amount });
    if (!otpResult.success) {
      return res.status(500).json({ error: 'Failed to resend OTP', details: otpResult.data?.message || otpResult.error });
    }
    await saveOtpSession(formattedMobile, otpResult.sessionId, 'suspense_advance', null, sv.id);

    res.json({ success: true, payeeMobile: payee.mobile.replace(/\d(?=\d{4})/g, '*') });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject suspense voucher
app.post('/api/suspense-vouchers/:id/reject', async (req, res) => {
  const { rejectedBy, reason } = req.body;
  if (!rejectedBy) return res.status(400).json({ error: 'rejectedBy is required' });
  try {
    const actor = await getActorRole(rejectedBy);
    if (actor.role !== 'admin' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only admins can reject' });
    }
    const { data: sv, error } = await supabase.from('suspense_vouchers')
      .update({ status: 'rejected', rejected_by: rejectedBy, rejected_at: new Date().toISOString(), rejection_reason: reason || null })
      .eq('id', req.params.id)
      .eq('status', 'pending_approval')
      .select().single();
    if (error) throw error;
    if (!sv) return res.status(404).json({ error: 'Suspense voucher not found or already processed' });
    res.json({ success: true, suspenseVoucher: sv });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resend settlement link (creates a new 24-hour session, invalidates previous ones, re-sends SMS)
app.post('/api/suspense-vouchers/:id/resend-settlement-link', async (req, res) => {
  const { requestedBy } = req.body;
  if (!requestedBy) return res.status(400).json({ error: 'requestedBy is required' });
  try {
    const actor = await getActorRole(requestedBy);
    if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only Accounts or Admin can resend settlement links' });
    }
    const { data: sv, error: svError } = await supabase.from('suspense_vouchers')
      .select('*').eq('id', req.params.id).single();
    if (svError || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });
    if (!['open', 'partial'].includes(sv.status)) {
      return res.status(400).json({ error: 'Settlement link can only be resent for open or partially-settled vouchers' });
    }
    let payee = null;
    // Primary lookup: by staff_payee_id
    if (sv.staff_payee_id) {
      const { data: p } = await supabase.from('payees')
        .select('id, mobile, name, user_id, is_staff')
        .eq('id', sv.staff_payee_id)
        .eq('is_staff', true)
        .single();
      payee = p || null;
    }
    // Fallback: vouchers created before migration 015 may have staff_user_id but no staff_payee_id
    if (!payee && sv.staff_user_id) {
      const { data: p } = await supabase.from('payees')
        .select('id, mobile, name, user_id, is_staff')
        .eq('user_id', sv.staff_user_id)
        .eq('is_staff', true)
        .single();
      if (p) {
        payee = p;
        // Auto-repair: backfill staff_payee_id so future operations work correctly
        await supabase.from('suspense_vouchers')
          .update({ staff_payee_id: p.id })
          .eq('id', sv.id);
      }
    }
    if (!payee) {
      return res.status(400).json({ error: 'No designated staff payee found. Please set up the staff payee in Payees Management first.' });
    }
    // Expire ALL existing sessions for this voucher so only the new link is active
    await supabase.from('settlement_sessions')
      .update({ expires_at: new Date().toISOString() })
      .eq('suspense_id', sv.id);

    const settlementToken = generateSettlementToken();
    // No fixed expiry — use a far-future sentinel date
    const farFuture = '2099-12-31T23:59:59.000Z';
    const { data: session, error: sessionError } = await supabase.from('settlement_sessions').insert({
      suspense_id: sv.id,
      payee_id: payee.id,
      token: settlementToken,
      expires_at: farFuture,
      last_sent_at: new Date().toISOString()
    }).select().single();
    if (sessionError) throw sessionError;

    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const settlementUrl = `${baseUrl}/settlement/${settlementToken}`;
    const smsResult = await sendWhatsApp(payee.mobile, 'pramaana_settlement_link', payee.name, parseFloat(sv.advance_amount).toFixed(2), settlementUrl);

    res.json({
      success: true,
      smsSent: smsResult.success === true,
      smsError: smsResult.success ? undefined : (smsResult.error || smsResult.data?.message || 'WhatsApp delivery failed'),
      settlementUrl,
      session
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Top-up: accounts/superAdmin adds more funds to an existing suspense voucher
app.post('/api/suspense-vouchers/:id/topup', async (req, res) => {
  const { amount, description, addedBy } = req.body;
  if (!amount || !description || !addedBy) return res.status(400).json({ error: 'amount, description and addedBy are required' });
  if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });

  try {
    const actor = await getActorRole(addedBy);
    if (actor.role !== 'accounts' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Only Accounts users or Super Admin can top up a suspense voucher' });
    }

    const { data: sv, error: svError } = await supabase.from('suspense_vouchers')
      .select('*').eq('id', req.params.id).single();
    if (svError || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });
    if (sv.status === 'pending_approval' || sv.status === 'rejected') {
      return res.status(400).json({ error: `Cannot top up a voucher in "${sv.status}" state` });
    }

    // Insert top-up as pending_approval — Admin/Super Admin must authorise before funds are credited
    const { data: settlement, error: sErr } = await supabase.from('suspense_settlements').insert({
      suspense_id: sv.id,
      company_id: sv.company_id,
      entry_type: 'topup',
      amount: parseFloat(amount),
      description,
      submitted_by: addedBy,
      settlement_payee_id: sv.staff_payee_id || null,
      requires_invoice: false,
      status: 'pending_approval'
    }).select().single();
    if (sErr) throw sErr;

    // Notify all admins in the company
    const { data: adder } = await supabase.from('users').select('name').eq('id', addedBy).single();
    const { data: adminEntries } = await supabase.from('user_companies')
      .select('user_id').eq('company_id', sv.company_id).eq('role', 'admin');
    if (adminEntries && adminEntries.length > 0) {
      const notifications = adminEntries.map(a => ({
        user_id: a.user_id,
        title: 'Suspense Top-Up Pending Approval',
        message: `₹${parseFloat(amount).toFixed(2)} top-up for ${sv.serial_number} submitted by ${adder?.name || 'Accounts'} requires your approval.`,
        type: 'approval_required'
      }));
      await supabase.from('notifications').insert(notifications);
      for (const admin of adminEntries) {
        sendPushNotification(admin.user_id, '💰 Top-Up Pending Approval', `₹${parseFloat(amount).toFixed(2)} for ${sv.serial_number} needs your approval.`, '/');
      }
    }

    res.json({ success: true, settlement, pendingApproval: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add settlement entry
app.post('/api/suspense-vouchers/:id/settlements', async (req, res) => {
  const { entryType, amount, description, headOfAccount, referenceNumber, submittedBy, requiresInvoice, invoiceMissingReason } = req.body;
  if (!entryType || !amount || !description || !submittedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const { data: sv, error: svError } = await supabase.from('suspense_vouchers')
      .select('*').eq('id', req.params.id).single();
    if (svError || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });
    if (sv.status !== 'open' && sv.status !== 'partial') {
      return res.status(400).json({ error: 'Cannot add settlement to a voucher in this state' });
    }

    const { data: settlement, error: sErr } = await supabase.from('suspense_settlements').insert({
      suspense_id: req.params.id,
      company_id: sv.company_id,
      entry_type: entryType,
      amount: parseFloat(amount),
      description,
      head_of_account: headOfAccount || null,
      reference_number: referenceNumber || null,
      submitted_by: submittedBy,
      requires_invoice: requiresInvoice !== undefined ? requiresInvoice : true,
      invoice_missing_reason: invoiceMissingReason || null,
      status: 'pending_review'
    }).select().single();
    if (sErr) throw sErr;

    // Notify accounts users that a new settlement entry needs review
    const { data: adminEntries } = await supabase.from('user_companies')
      .select('user_id')
      .eq('company_id', sv.company_id)
      .eq('role', 'accounts');
    const { data: submitter } = await supabase.from('users').select('name').eq('id', submittedBy).single();

    if (adminEntries && adminEntries.length > 0) {
      const notifications = adminEntries.map(a => ({
        user_id: a.user_id,
        title: 'New Settlement Entry Pending Review',
        message: `A new settlement entry for ${sv.serial_number} has been submitted by ${submitter?.name || 'Staff'}.`,
        type: 'approval_required'
      }));
      await supabase.from('notifications').insert(notifications);
      for (const admin of adminEntries) {
        sendPushNotification(
          admin.user_id,
          '🧾 Settlement Entry Submitted',
          `A settlement entry for ${sv.serial_number} needs your review.`,
          '/'
        );
      }
    }

    res.json({ success: true, settlement });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settlement-sessions/:token', async (req, res) => {
  try {
    const { data: session, error } = await supabase.from('settlement_sessions')
      .select(`*, payee:payees(id,name,mobile,user_id,is_staff), suspense:suspense_vouchers(id,serial_number,company_id,status,advance_amount,balance_amount)`) 
      .eq('token', req.params.token)
      .single();

    if (error || !session) return res.status(404).json({ error: 'Settlement session not found' });
    // Session is expired only if explicitly invalidated (expires_at set to a past date)
    if (new Date(session.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Settlement session has expired' });
    }
    if (!session.payee || !session.payee.is_staff) {
      return res.status(400).json({ error: 'Settlement session is not valid for a staff payee' });
    }

    res.json({ settlementSession: session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all settlement entries for the voucher linked to this token (for staff history view)
app.get('/api/settlement-sessions/:token/entries', async (req, res) => {
  try {
    const { data: session, error: sessionError } = await supabase.from('settlement_sessions')
      .select('suspense_id, payee_id')
      .eq('token', req.params.token)
      .single();
    if (sessionError || !session) return res.status(404).json({ error: 'Session not found' });

    const { data: entries, error: entriesError } = await supabase.from('suspense_settlements')
      .select(`id, entry_type, amount, description, head_of_account, reference_number, status, created_at,
               attachments:voucher_attachments(id, public_url, file_name, mime_type)`)
      .eq('suspense_id', session.suspense_id)
      .order('created_at', { ascending: false });

    if (entriesError) throw entriesError;
    res.json({ entries: entries || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settlement-sessions/:token/settlements', async (req, res) => {
  const { entryType, amount, description, headOfAccount, referenceNumber, requiresInvoice, invoiceMissingReason } = req.body;
  if (!entryType || !amount || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { data: session, error: sessionError } = await supabase.from('settlement_sessions')
      .select(`*, payee:payees(id,user_id,name,mobile,is_staff), suspense:suspense_vouchers(id,serial_number,company_id,status)`) 
      .eq('token', req.params.token)
      .single();
    if (sessionError || !session) return res.status(404).json({ error: 'Settlement session not found' });
    // Session is expired only if explicitly invalidated (expires_at set to a past date)
    if (new Date(session.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Settlement session has expired' });
    }
    if (!session.payee || !session.payee.is_staff) {
      return res.status(400).json({ error: 'Settlement session is not valid for a staff payee' });
    }
    if (!['open', 'partial'].includes(session.suspense?.status)) {
      return res.status(400).json({ error: 'Cannot submit settlement: the suspense voucher is not open for settlement' });
    }

    const submittedBy = session.payee.user_id || null;
    // submittedBy may be null if the staff payee has no system account — that is fine.
    // Identity is tracked via session.payee (payee record) not a user login.

    const { data: settlement, error: sErr } = await supabase.from('suspense_settlements').insert({
      suspense_id: session.suspense.id,
      company_id: session.suspense.company_id,
      entry_type: entryType,
      amount: parseFloat(amount),
      description,
      head_of_account: headOfAccount || null,
      reference_number: referenceNumber || null,
      submitted_by: submittedBy,
      settlement_payee_id: session.payee.id,
      requires_invoice: requiresInvoice !== undefined ? requiresInvoice : true,
      invoice_missing_reason: invoiceMissingReason || null,
      status: 'pending_review'
    }).select().single();
    if (sErr) throw sErr;

    const { data: adminEntries } = await supabase.from('user_companies')
      .select('user_id')
      .eq('company_id', session.suspense.company_id)
      .eq('role', 'accounts');
    const notifications = (adminEntries || []).map(a => ({
      user_id: a.user_id,
      title: 'Settlement Entry Submitted',
      message: `A new settlement entry has been submitted for ${session.suspense.serial_number}.`,
      type: 'approval_required'
    }));
    if (notifications.length > 0) await supabase.from('notifications').insert(notifications);

    for (const admin of adminEntries || []) {
      sendPushNotification(
        admin.user_id,
        '🧾 Settlement Entry Submitted',
        `A settlement entry has been submitted for ${session.suspense.serial_number}.`,
        '/'
      );
    }

    res.json({ success: true, settlement });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get settlements for a suspense voucher
app.get('/api/suspense-vouchers/:id/settlements', async (req, res) => {
  try {
    const { data, error } = await supabase.from('suspense_settlements')
      .select(`*, submitter:users!submitted_by(id,name), payee:payees!settlement_payee_id(id,name,mobile)`)
      .eq('suspense_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ settlements: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accounts approves a settlement entry and optionally creates a linked voucher
app.post('/api/suspense-settlements/:settlementId/approve', async (req, res) => {
  const { approvedBy, createVoucher, voucherData } = req.body;
  if (!approvedBy) return res.status(400).json({ error: 'approvedBy is required' });

  try {
    const actor = await getActorRole(approvedBy);
    if (actor.role !== 'accounts' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only Accounts users or Super Admin can approve settlement entries' });
    }

    const { data: settlement, error: settlementError } = await supabase.from('suspense_settlements')
      .select('*')
      .eq('id', req.params.settlementId)
      .single();
    if (settlementError || !settlement) return res.status(404).json({ error: 'Settlement entry not found' });
    if (settlement.status !== 'pending_review') return res.status(400).json({ error: 'Settlement entry is not pending review' });

    const { data: sv, error: svError } = await supabase.from('suspense_vouchers')
      .select('*')
      .eq('id', settlement.suspense_id)
      .single();
    if (svError || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });

    const { data: payee } = await supabase.from('payees')
      .select('id,user_id,name,mobile')
      .eq('id', sv.staff_payee_id)
      .single();
    if (!payee) return res.status(400).json({ error: 'No designated staff payee found for this suspense voucher' });

    // HoA is always required at approval so that every expense is properly categorised
    if (!voucherData?.headOfAccount) {
      return res.status(400).json({ error: 'Head of Account is required at the time of approval' });
    }

    // Update settlement entry status and stamp the Accounts-selected Head of Account on it
    const { data: approvedSettlement, error: updateError } = await supabase.from('suspense_settlements')
      .update({
        status: 'approved',
        reviewed_by: approvedBy,
        reviewed_at: new Date().toISOString(),
        head_of_account: voucherData.headOfAccount,
        ...(voucherData.subHeadOfAccount ? { sub_head_of_account: voucherData.subHeadOfAccount } : {})
      })
      .eq('id', req.params.settlementId)
      .select()
      .single();
    if (updateError) throw updateError;

    let voucher = null;
    if (createVoucher) {
      const headOfAccount = voucherData.headOfAccount;
      const subHeadOfAccount = voucherData?.subHeadOfAccount || null;
      const narration = voucherData?.narration || settlement.description;
      const amount = settlement.amount;
      const paymentMode = voucherData?.paymentMode || sv.payment_mode || 'UPI';
      const invoiceReference = voucherData?.invoiceReference || settlement.reference_number || null;
      // Narration must clearly record that payment was already disbursed as suspense advance
      const narrationWithRef = `[Pre-paid via Suspense ${sv.serial_number}] ${narration}`;
      // Synthetic signature proving this voucher was settled through the suspense system
      const suspenseSignature = Buffer.from(
        `suspense:${sv.serial_number}:${settlement.id}:${approvedBy}:${Date.now()}`
      ).toString('base64');

      const serialNumber = await getNextVoucherNumber(sv.company_id);
      const now = new Date().toISOString();
      const { data: createdVoucher, error: createVoucherError } = await supabase.from('vouchers').insert({
        company_id: sv.company_id,
        serial_number: serialNumber,
        head_of_account: headOfAccount,
        sub_head_of_account: subHeadOfAccount,
        narration: narrationWithRef,
        amount,
        payment_mode: paymentMode,
        payee_id: payee.id,
        prepared_by: approvedBy,
        // Enter normal pending → Admin approval flow.
        // After Admin approval the endpoint detects is_suspense_settlement and
        // completes the voucher immediately (no OTP — payment was already disbursed).
        status: 'pending',
        submitted_at: now,
        // Audit trail: proves this voucher originates from a suspense settlement.
        is_suspense_settlement: true,
        payee_signature: suspenseSignature,
        invoice_reference: invoiceReference,
        settlement_id: settlement.id
      }).select().single();
      if (createVoucherError) throw createVoucherError;
      voucher = createdVoucher;

      // Copy only the attachments that staff uploaded against THIS expense entry.
      // (Filtered strictly by settlement_id — no other entry's or suspense-level attachments are included.)
      await supabase.from('voucher_attachments')
        .update({ voucher_id: voucher.id })
        .eq('settlement_id', settlement.id);

      // Copy the suspense-level transfer receipts (uploaded by Accounts as proof of disbursement).
      // These are inserted as fresh records so the voucher carries an independent audit trail
      // showing BOTH what was spent (entry bill above) AND how funds reached the staff member.
      await copyTransferReceiptsToVoucher(sv.id, voucher.id);

      // Write back-link so the suspense detail view can show a '🧾 View Voucher' button
      await supabase.from('suspense_settlements')
        .update({ voucher_id: voucher.id })
        .eq('id', settlement.id);
    }

    const { data: approvedSettlements } = await supabase.from('suspense_settlements')
      .select('entry_type, amount')
      .eq('suspense_id', sv.id)
      .eq('status', 'approved');

    let balance = parseFloat(sv.advance_amount);
    for (const s of (approvedSettlements || [])) {
      if (s.entry_type === 'expense') balance -= parseFloat(s.amount);
      else if (s.entry_type === 'refund') balance += parseFloat(s.amount);
      else if (s.entry_type === 'topup') balance += parseFloat(s.amount);
    }
    // Never auto-close: balance can go negative (overspend). Only Accounts can manually close.
    // Keep existing status unless it was still 'open' (move to 'partial' once entries exist)
    const newStatus = sv.status === 'open' ? 'partial' : sv.status;
    await supabase.from('suspense_vouchers')
      .update({ balance_amount: balance, status: newStatus })
      .eq('id', sv.id);

    res.json({ success: true, settlement: approvedSettlement, voucher });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Combine multiple pending_review expense entries into one payment voucher (Accounts only)
app.post('/api/suspense-vouchers/:suspenseId/combine-settlements', async (req, res) => {
  const { approvedBy, settlementIds, voucherData } = req.body;
  if (!approvedBy) return res.status(400).json({ error: 'approvedBy is required' });
  if (!Array.isArray(settlementIds) || settlementIds.length < 2) {
    return res.status(400).json({ error: 'At least 2 settlement entries must be selected to combine' });
  }
  if (!voucherData?.headOfAccount) {
    return res.status(400).json({ error: 'Head of Account is required' });
  }

  try {
    const actor = await getActorRole(approvedBy);
    if (actor.role !== 'accounts' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only Accounts users or Super Admin can combine settlement entries' });
    }

    // Fetch the suspense voucher
    const { data: sv, error: svError } = await supabase.from('suspense_vouchers')
      .select('*')
      .eq('id', req.params.suspenseId)
      .single();
    if (svError || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });

    // Fetch all selected settlement entries
    const { data: settlements, error: sErr } = await supabase.from('suspense_settlements')
      .select('*')
      .in('id', settlementIds);
    if (sErr || !settlements || settlements.length === 0) {
      return res.status(404).json({ error: 'One or more settlement entries not found' });
    }

    // Validate every entry: must belong to this voucher, be pending_review, and be an expense
    for (const s of settlements) {
      if (s.suspense_id !== req.params.suspenseId) {
        return res.status(400).json({ error: `Entry ${s.id} does not belong to this suspense voucher` });
      }
      if (s.status !== 'pending_review') {
        return res.status(400).json({ error: `Entry "${s.description}" is not pending review (status: ${s.status})` });
      }
      if (s.entry_type !== 'expense') {
        return res.status(400).json({ error: `Only expense entries can be combined (entry "${s.description}" is "${s.entry_type}")` });
      }
    }

    const { data: payee } = await supabase.from('payees')
      .select('id,user_id,name,mobile')
      .eq('id', sv.staff_payee_id)
      .single();
    if (!payee) return res.status(400).json({ error: 'No designated staff payee found for this suspense voucher' });

    // Compute combined amount
    const totalAmount = settlements.reduce((sum, s) => sum + parseFloat(s.amount), 0);

    // Build narration: respect custom narration if provided, otherwise join descriptions
    const headOfAccount = voucherData.headOfAccount;
    const subHeadOfAccount = voucherData.subHeadOfAccount || null;
    const narration = voucherData.narration ||
      settlements.map(s => s.description).join(' | ');
    const paymentMode = voucherData.paymentMode || sv.payment_mode || 'UPI';
    const invoiceReference = voucherData.invoiceReference || null;
    const narrationWithRef = `[Pre-paid via Suspense ${sv.serial_number}] ${narration}`;

    const suspenseSignature = Buffer.from(
      `suspense:${sv.serial_number}:combined:${approvedBy}:${Date.now()}`
    ).toString('base64');

    // Create the single combined voucher
    const serialNumber = await getNextVoucherNumber(sv.company_id);
    const now = new Date().toISOString();
    const { data: voucher, error: createVoucherError } = await supabase.from('vouchers').insert({
      company_id: sv.company_id,
      serial_number: serialNumber,
      head_of_account: headOfAccount,
      sub_head_of_account: subHeadOfAccount,
      narration: narrationWithRef,
      amount: totalAmount,
      payment_mode: paymentMode,
      payee_id: payee.id,
      prepared_by: approvedBy,
      // Enter normal pending → Admin approval flow.
      // After Admin approval the endpoint detects is_suspense_settlement and
      // completes the voucher immediately (no OTP — payment was already disbursed).
      status: 'pending',
      submitted_at: now,
      // Audit trail: proves this voucher originates from combined suspense settlements.
      is_suspense_settlement: true,
      payee_signature: suspenseSignature,
      invoice_reference: invoiceReference,
      // settlement_id is null — this voucher spans multiple entries.
      // The back-link lives on each suspense_settlements.voucher_id instead.
      settlement_id: null
    }).select().single();
    if (createVoucherError) throw createVoucherError;

    // Approve each settlement entry, stamp HoA, and record the linked voucher
    const approvePromises = settlementIds.map(id =>
      supabase.from('suspense_settlements').update({
        status: 'approved',
        reviewed_by: approvedBy,
        reviewed_at: now,
        head_of_account: headOfAccount,
        ...(subHeadOfAccount ? { sub_head_of_account: subHeadOfAccount } : {}),
        voucher_id: voucher.id
      }).eq('id', id)
    );
    await Promise.all(approvePromises);

    // Copy only the attachments that staff uploaded against each selected expense entry.
    // Strictly filtered per settlement_id — no other entry's or suspense-level attachments included.
    for (const id of settlementIds) {
      await supabase.from('voucher_attachments')
        .update({ voucher_id: voucher.id })
        .eq('settlement_id', id);
    }

    // Copy the suspense-level transfer receipts (uploaded by Accounts as proof of disbursement).
    // These are inserted as fresh records so the combined voucher independently proves
    // BOTH what was spent (all entry bills above) AND how funds reached the staff member.
    await copyTransferReceiptsToVoucher(req.params.suspenseId, voucher.id);

    // Recalculate suspense voucher balance
    const { data: approvedSettlements } = await supabase.from('suspense_settlements')
      .select('entry_type, amount')
      .eq('suspense_id', sv.id)
      .eq('status', 'approved');

    let balance = parseFloat(sv.advance_amount);
    for (const s of (approvedSettlements || [])) {
      if (s.entry_type === 'expense') balance -= parseFloat(s.amount);
      else if (s.entry_type === 'refund') balance += parseFloat(s.amount);
      else if (s.entry_type === 'topup') balance += parseFloat(s.amount);
    }
    const newStatus = sv.status === 'open' ? 'partial' : sv.status;
    await supabase.from('suspense_vouchers')
      .update({ balance_amount: balance, status: newStatus })
      .eq('id', sv.id);

    res.json({ success: true, voucher, combinedCount: settlementIds.length, totalAmount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recalculate and correct the stored balance_amount from live settlement data (Accounts / Super Admin only)
app.post('/api/suspense-vouchers/:id/recalculate-balance', async (req, res) => {
  const { requestedBy } = req.body;
  if (!requestedBy) return res.status(400).json({ error: 'requestedBy is required' });
  try {
    const actor = await getActorRole(requestedBy);
    if (actor.role !== 'accounts' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only Accounts users or Super Admin can recalculate balance' });
    }
    const { data: sv, error } = await supabase.from('suspense_vouchers')
      .select('id, serial_number, advance_amount, status')
      .eq('id', req.params.id)
      .single();
    if (error || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });

    const { data: approvedSettlements } = await supabase.from('suspense_settlements')
      .select('entry_type, amount')
      .eq('suspense_id', sv.id)
      .eq('status', 'approved');

    let balance = parseFloat(sv.advance_amount);
    for (const s of (approvedSettlements || [])) {
      if (s.entry_type === 'expense') balance -= parseFloat(s.amount);
      else if (s.entry_type === 'refund' || s.entry_type === 'topup') balance += parseFloat(s.amount);
    }

    await supabase.from('suspense_vouchers')
      .update({ balance_amount: balance })
      .eq('id', sv.id);

    res.json({ success: true, correctedBalance: balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Close a suspense voucher — three paths depending on the remaining balance:
//   balance = 0 : close directly.
//   balance < 0 : close directly (Accounts acknowledges out-of-pocket overspend).
//   balance > 0 : submit for Admin approval; a recovery voucher is created on approval.
app.post('/api/suspense-vouchers/:id/close', async (req, res) => {
  const { closedBy, closeHoa, closeSubHoa, closeNotes } = req.body;
  if (!closedBy) return res.status(400).json({ error: 'closedBy is required' });
  try {
    const actor = await getActorRole(closedBy);
    if (actor.role !== 'accounts' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only Accounts users can close a suspense voucher' });
    }
    const { data: sv, error } = await supabase.from('suspense_vouchers')
      .select('id, status, serial_number, balance_amount, company_id, created_by, staff_payee_id, purpose')
      .eq('id', req.params.id).single();
    if (error || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });
    if (sv.status === 'closed') return res.status(400).json({ error: 'Voucher is already closed' });
    if (['pending_approval', 'rejected', 'awaiting_payee_otp', 'pending_close_approval'].includes(sv.status)) {
      return res.status(400).json({ error: `Cannot close a voucher in "${sv.status}" state` });
    }

    const balance = parseFloat(sv.balance_amount ?? 0);

    // ── Balance > 0: requires Admin approval ─────────────────────────────────
    if (balance > 0) {
      if (!closeHoa) return res.status(400).json({ error: 'Head of Account is required for closing with an unspent balance' });
      await supabase.from('suspense_vouchers').update({
        status: 'pending_close_approval',
        pre_close_status: sv.status,
        close_requested_by: closedBy,
        close_requested_at: new Date().toISOString(),
        close_hoa: closeHoa,
        close_sub_hoa: closeSubHoa || null,
        close_notes: closeNotes || null
      }).eq('id', sv.id);

      // Notify all Admins
      const { data: requester } = await supabase.from('users').select('name').eq('id', closedBy).single();
      const { data: adminEntries } = await supabase.from('user_companies')
        .select('user_id').eq('company_id', sv.company_id).eq('role', 'admin');
      for (const a of (adminEntries || [])) {
        await supabase.from('notifications').insert({
          user_id: a.user_id,
          title: '🔒 Suspense Close Approval Required',
          message: `${sv.serial_number} has an unspent balance of ₹${balance.toFixed(2)}. ${requester?.name || 'Accounts'} is requesting closure. A recovery voucher (${closeHoa}) will be created on approval.`,
          type: 'approval_required'
        });
        sendPushNotification(a.user_id, '🔒 Suspense Close Pending', `${sv.serial_number} — unspent ₹${balance.toFixed(2)} needs your approval.`, '/');
      }
      return res.json({ success: true, pendingApproval: true });
    }

    // ── Balance ≤ 0: close directly ──────────────────────────────────────────
    await supabase.from('suspense_vouchers')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', sv.id);
    await supabase.from('settlement_sessions')
      .update({ expires_at: new Date().toISOString() })
      .eq('suspense_id', sv.id);
    res.json({ success: true, pendingApproval: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin approves a pending-close-approval voucher:
//   1. Creates a "Staff Advance Recovery" regular voucher (completed immediately).
//   2. Closes the suspense voucher.
app.post('/api/suspense-vouchers/:id/approve-close', async (req, res) => {
  const { approvedBy } = req.body;
  if (!approvedBy) return res.status(400).json({ error: 'approvedBy is required' });
  try {
    const actor = await getActorRole(approvedBy);
    if (actor.role !== 'admin' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Only Admin or Super Admin can approve a close request' });
    }
    const { data: sv, error } = await supabase.from('suspense_vouchers')
      .select('*, staff_payee:payees!staff_payee_id(id,name)')
      .eq('id', req.params.id).single();
    if (error || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });
    if (sv.status !== 'pending_close_approval') {
      return res.status(400).json({ error: 'Voucher is not pending close approval' });
    }

    const balance = parseFloat(sv.balance_amount ?? 0);
    const payee = sv.staff_payee;

    // Create the recovery voucher
    let recoveryVoucher = null;
    if (balance > 0 && sv.close_hoa && payee?.id) {
      const serialNumber = await getNextVoucherNumber(sv.company_id);
      const now = new Date().toISOString();
      const narration = `[Advance Recovery — ${sv.serial_number}] ${sv.purpose || 'Suspense advance'}`;
      const { data: rv } = await supabase.from('vouchers').insert({
        company_id: sv.company_id,
        serial_number: serialNumber,
        head_of_account: sv.close_hoa,
        sub_head_of_account: sv.close_sub_hoa || null,
        narration,
        amount: balance,
        payment_mode: 'Cash',
        payee_id: payee.id,
        prepared_by: sv.close_requested_by,
        status: 'completed',
        submitted_at: now,
        is_suspense_settlement: true,
        settlement_id: null
      }).select().single();
      recoveryVoucher = rv;
    }

    // Close the suspense voucher
    const now = new Date().toISOString();
    await supabase.from('suspense_vouchers').update({
      status: 'closed',
      closed_at: now,
      close_approved_by: approvedBy,
      close_approved_at: now
    }).eq('id', sv.id);
    await supabase.from('settlement_sessions')
      .update({ expires_at: now })
      .eq('suspense_id', sv.id);

    // Notify requester
    const { data: approver } = await supabase.from('users').select('name').eq('id', approvedBy).single();
    await supabase.from('notifications').insert({
      user_id: sv.close_requested_by,
      title: '✅ Suspense Closure Approved',
      message: `${sv.serial_number} has been closed by ${approver?.name || 'Admin'}. ${recoveryVoucher ? `Recovery voucher ${recoveryVoucher.serial_number} created for ₹${balance.toFixed(2)}.` : ''}`,
      type: 'completed'
    });

    res.json({ success: true, recoveryVoucher: recoveryVoucher ? { id: recoveryVoucher.id, serial_number: recoveryVoucher.serial_number } : null });
  } catch (error) {
    console.error('approve-close error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Admin rejects a pending-close-approval — reverts suspense back to open/partial
app.post('/api/suspense-vouchers/:id/reject-close', async (req, res) => {
  const { rejectedBy, reason } = req.body;
  if (!rejectedBy) return res.status(400).json({ error: 'rejectedBy is required' });
  try {
    const actor = await getActorRole(rejectedBy);
    if (actor.role !== 'admin' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Only Admin or Super Admin can reject a close request' });
    }
    const { data: sv, error } = await supabase.from('suspense_vouchers')
      .select('id, serial_number, pre_close_status, close_requested_by, company_id')
      .eq('id', req.params.id).single();
    if (error || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });
    if (sv.status !== 'pending_close_approval') {
      return res.status(400).json({ error: 'Voucher is not pending close approval' });
    }
    const revertTo = sv.pre_close_status || 'partial';
    await supabase.from('suspense_vouchers').update({
      status: revertTo,
      close_rejected_by: rejectedBy,
      close_rejected_at: new Date().toISOString(),
      close_rejection_reason: reason || null
    }).eq('id', sv.id);

    const { data: rejector } = await supabase.from('users').select('name').eq('id', rejectedBy).single();
    await supabase.from('notifications').insert({
      user_id: sv.close_requested_by,
      title: '❌ Suspense Close Request Rejected',
      message: `Close request for ${sv.serial_number} was rejected by ${rejector?.name || 'Admin'}.${reason ? ` Reason: ${reason}` : ''}`,
      type: 'warning'
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pending close-approval requests for this company — Admin inbox
app.get('/api/companies/:companyId/pending-close-requests', async (req, res) => {
  try {
    const { data, error } = await supabase.from('suspense_vouchers')
      .select(`*, staff_payee:payees!staff_payee_id(id,name,mobile), requester:users!close_requested_by(id,name)`)
      .eq('company_id', req.params.companyId)
      .eq('status', 'pending_close_approval')
      .order('close_requested_at', { ascending: true });
    if (error) throw error;
    res.json({ pendingCloseRequests: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin approves a pending top-up — credits funds and notifies staff
app.post('/api/suspense-settlements/:settlementId/approve-topup', async (req, res) => {
  const { approvedBy } = req.body;
  if (!approvedBy) return res.status(400).json({ error: 'approvedBy is required' });
  try {
    const actor = await getActorRole(approvedBy);
    if (actor.role !== 'admin' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Only Admin or Super Admin can approve a top-up' });
    }

    const { data: settlement, error: sErr } = await supabase.from('suspense_settlements')
      .select('*').eq('id', req.params.settlementId).single();
    if (sErr || !settlement) return res.status(404).json({ error: 'Settlement entry not found' });
    if (settlement.entry_type !== 'topup') return res.status(400).json({ error: 'Entry is not a top-up' });
    if (settlement.status !== 'pending_approval') return res.status(400).json({ error: 'Top-up is not pending approval' });

    const { data: sv } = await supabase.from('suspense_vouchers').select('*').eq('id', settlement.suspense_id).single();
    if (!sv) return res.status(404).json({ error: 'Suspense voucher not found' });

    // Approve the settlement entry
    await supabase.from('suspense_settlements')
      .update({ status: 'approved', reviewed_by: approvedBy, reviewed_at: new Date().toISOString() })
      .eq('id', settlement.id);

    // Recalculate balance
    const { data: approvedSettlements } = await supabase.from('suspense_settlements')
      .select('entry_type, amount').eq('suspense_id', sv.id).eq('status', 'approved');
    let balance = parseFloat(sv.advance_amount);
    for (const s of (approvedSettlements || [])) {
      if (s.entry_type === 'expense') balance -= parseFloat(s.amount);
      else if (s.entry_type === 'refund' || s.entry_type === 'topup') balance += parseFloat(s.amount);
    }
    // Note: the just-approved top-up is already included in approvedSettlements above
    // because the status update runs before the query. No extra addition needed.
    const reopened = sv.status === 'closed';
    const newStatus = reopened ? 'partial' : (sv.status === 'open' ? 'open' : sv.status);
    await supabase.from('suspense_vouchers')
      .update({ balance_amount: balance, status: newStatus, ...(reopened ? { closed_at: null } : {}) })
      .eq('id', sv.id);

    // Notify voucher creator and the Accounts user who requested the top-up
    const { data: approver } = await supabase.from('users').select('name').eq('id', approvedBy).single();
    const notifyUsers = [...new Set([sv.created_by, settlement.submitted_by].filter(Boolean))];
    for (const uid of notifyUsers) {
      await supabase.from('notifications').insert({
        user_id: uid,
        title: 'Top-Up Approved',
        message: `₹${parseFloat(settlement.amount).toFixed(2)} top-up for ${sv.serial_number} approved by ${approver?.name || 'Admin'}. New balance: ₹${balance.toFixed(2)}.`,
        type: 'info'
      });
    }

    res.json({ success: true, newBalance: balance, newStatus, reopened });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin rejects a pending top-up
app.post('/api/suspense-settlements/:settlementId/reject-topup', async (req, res) => {
  const { rejectedBy, reason } = req.body;
  if (!rejectedBy) return res.status(400).json({ error: 'rejectedBy is required' });
  try {
    const actor = await getActorRole(rejectedBy);
    if (actor.role !== 'admin' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Only Admin or Super Admin can reject a top-up' });
    }

    const { data: settlement, error: sErr } = await supabase.from('suspense_settlements')
      .select('*').eq('id', req.params.settlementId).single();
    if (sErr || !settlement) return res.status(404).json({ error: 'Settlement entry not found' });
    if (settlement.entry_type !== 'topup') return res.status(400).json({ error: 'Entry is not a top-up' });
    if (settlement.status !== 'pending_approval') return res.status(400).json({ error: 'Top-up is not pending approval' });

    const { data: sv } = await supabase.from('suspense_vouchers').select('id, serial_number, created_by').eq('id', settlement.suspense_id).single();

    await supabase.from('suspense_settlements')
      .update({ status: 'rejected', reviewed_by: rejectedBy, reviewed_at: new Date().toISOString(), ...(reason ? { description: `${settlement.description} [Rejected: ${reason}]` } : {}) })
      .eq('id', settlement.id);

    // Notify Accounts user who submitted it and the voucher creator
    const { data: rejector } = await supabase.from('users').select('name').eq('id', rejectedBy).single();
    const notifyUsers = [...new Set([sv?.created_by, settlement.submitted_by].filter(Boolean))];
    for (const uid of notifyUsers) {
      await supabase.from('notifications').insert({
        user_id: uid,
        title: 'Top-Up Rejected',
        message: `₹${parseFloat(settlement.amount).toFixed(2)} top-up for ${sv?.serial_number} was rejected by ${rejector?.name || 'Admin'}.${reason ? ` Reason: ${reason}` : ''}`,
        type: 'warning'
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BILL ATTACHMENTS
// ─────────────────────────────────────────────────────────────────────────────

// Upload attachment (supports regular vouchers, suspense vouchers, settlements)
app.post('/api/attachments/upload', async (req, res) => {
  const { fileData, mimeType, fileName, voucherId, voucherType, suspenseId, settlementId, captureSessionId, uploadedBy, companyId, attachmentCategory } = req.body;
  // uploadedBy is optional for settlement uploads — SMS-only payees have no system user ID
  if (!fileData || !companyId) {
    return res.status(400).json({ error: 'fileData and companyId are required' });
  }
  try {
    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = mimeType?.includes('pdf') ? 'pdf' : mimeType?.includes('png') ? 'png' : mimeType?.includes('webp') ? 'webp' : 'jpg';
    const prefix = suspenseId ? 'sus' : 'vch';
    const refId = suspenseId || voucherId || 'misc';
    const storagePath = `${companyId}/${prefix}-${refId}-${Date.now()}.${ext}`;
    const originalName = fileName || `attachment-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('voucher-bills')
      .upload(storagePath, buffer, { contentType: mimeType || 'image/jpeg', upsert: false });
    if (uploadError) return res.status(500).json({ error: 'Storage upload failed', details: uploadError.message });

    const { data: urlData } = supabase.storage.from('voucher-bills').getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl || storagePath;

    const { data: attachment, error: dbErr } = await supabase.from('voucher_attachments').insert({
      company_id: companyId,
      voucher_id: voucherId || null,
      voucher_type: voucherType || (suspenseId ? 'suspense' : 'regular'),
      suspense_id: suspenseId || null,
      settlement_id: settlementId || null,
      file_name: originalName,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: mimeType || 'image/jpeg',
      file_size_bytes: buffer.length,
      capture_session_id: captureSessionId || null,
      uploaded_by: uploadedBy,
      attachment_category: attachmentCategory || null
    }).select().single();
    if (dbErr) throw dbErr;

    // Mark capture session used if provided
    if (captureSessionId) {
      await supabase.from('capture_sessions')
        .update({ status: 'used', used_at: new Date().toISOString(), attachment_id: attachment.id })
        .eq('id', captureSessionId).eq('status', 'pending');
    }

    res.json({ success: true, attachment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List attachments (by voucherId or suspenseId)
app.get('/api/attachments', async (req, res) => {
  const { voucherId, suspenseId, settlementId } = req.query;
  try {
    let query = supabase.from('voucher_attachments')
      .select(`*, uploader:users!uploaded_by(id,name)`)
      .order('uploaded_at', { ascending: false });
    if (voucherId)    query = query.eq('voucher_id', voucherId);
    if (suspenseId)   query = query.eq('suspense_id', suspenseId);
    if (settlementId) query = query.eq('settlement_id', settlementId);
    if (!voucherId && !suspenseId && !settlementId) {
      return res.status(400).json({ error: 'At least one filter is required' });
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ attachments: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete attachment
app.delete('/api/attachments/:id', async (req, res) => {
  const { deletedBy } = req.body;
  if (!deletedBy) return res.status(400).json({ error: 'deletedBy is required' });
  try {
    const actor = await getActorRole(deletedBy);
    const { data: att, error: fetchErr } = await supabase.from('voucher_attachments')
      .select('*').eq('id', req.params.id).single();
    if (fetchErr || !att) return res.status(404).json({ error: 'Attachment not found' });

    const isOwner = att.uploaded_by === deletedBy;
    const isAdmin = actor.role === 'admin' || actor.is_super_admin;
    const ageMs = Date.now() - new Date(att.uploaded_at).getTime();
    if (!isAdmin && (!isOwner || ageMs > 24 * 60 * 60 * 1000)) {
      return res.status(403).json({ error: 'Cannot delete: must be owner within 24 hours or admin' });
    }

    const { error: storageErr } = await supabase.storage.from('voucher-bills').remove([att.storage_path]);
    if (storageErr) console.warn('Storage remove warning:', storageErr.message);

    // Clear FK reference in capture_sessions before deleting (prevents FK constraint violation
    // for attachments uploaded via the QR/Send-to-Phone capture flow)
    await supabase.from('capture_sessions').update({ attachment_id: null }).eq('attachment_id', req.params.id);

    const { error: delErr } = await supabase.from('voucher_attachments').delete().eq('id', req.params.id);
    if (delErr) throw delErr;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURE SESSIONS (Mobile Camera QR Relay)
// ─────────────────────────────────────────────────────────────────────────────

// Create capture session
app.post('/api/capture-sessions', async (req, res) => {
  const { companyId, createdBy, voucherId, suspenseId, settlementId, contextType, attachmentCategory } = req.body;
  if (!companyId || !createdBy) return res.status(400).json({ error: 'companyId and createdBy required' });
  try {
    const { data: session, error } = await supabase.from('capture_sessions').insert({
      company_id: companyId,
      created_by: createdBy,
      voucher_id: voucherId || null,
      suspense_id: suspenseId || null,
      settlement_id: settlementId || null,
      context_type: contextType || (suspenseId ? 'suspense' : 'regular'),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      attachment_category: attachmentCategory || null
    }).select().single();
    if (error) throw error;
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get capture session (validate + check if used)
app.get('/api/capture-sessions/:id', async (req, res) => {
  try {
    const { data: session, error } = await supabase.from('capture_sessions')
      .select(`*, attachment:voucher_attachments(id,public_url,file_name,uploaded_at)`)
      .eq('id', req.params.id).single();
    if (error || !session) return res.status(404).json({ error: 'Session not found' });

    // Auto-expire
    if (session.status === 'pending' && new Date(session.expires_at) < new Date()) {
      await supabase.from('capture_sessions').update({ status: 'expired' }).eq('id', req.params.id);
      return res.json({ session: { ...session, status: 'expired' } });
    }
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURE PAGE UPLOAD (called by mobile browser after camera capture)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/capture-sessions/:id/upload', async (req, res) => {
  const { fileData, mimeType, fileName } = req.body;
  if (!fileData) return res.status(400).json({ error: 'fileData is required' });
  try {
    const { data: session, error: sErr } = await supabase.from('capture_sessions')
      .select('*').eq('id', req.params.id).single();
    if (sErr || !session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'pending') return res.status(400).json({ error: `Session is ${session.status}` });
    if (new Date(session.expires_at) < new Date()) {
      await supabase.from('capture_sessions').update({ status: 'expired' }).eq('id', req.params.id);
      return res.status(400).json({ error: 'Session has expired' });
    }

    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = mimeType?.includes('pdf') ? 'pdf' : mimeType?.includes('png') ? 'png' : mimeType?.includes('webp') ? 'webp' : 'jpg';
    const storagePath = `${session.company_id}/mobile-cap-${req.params.id}-${Date.now()}.${ext}`;
    const originalName = fileName || `capture-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('voucher-bills')
      .upload(storagePath, buffer, { contentType: mimeType || 'image/jpeg', upsert: false });
    if (uploadError) return res.status(500).json({ error: 'Upload failed', details: uploadError.message });

    const { data: urlData } = supabase.storage.from('voucher-bills').getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl || storagePath;

    const { data: attachment, error: dbErr } = await supabase.from('voucher_attachments').insert({
      company_id: session.company_id,
      voucher_id: session.voucher_id || null,
      voucher_type: session.context_type,
      suspense_id: session.suspense_id || null,
      settlement_id: session.settlement_id || null,
      file_name: originalName,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: mimeType || 'image/jpeg',
      file_size_bytes: buffer.length,
      capture_session_id: req.params.id,
      uploaded_by: session.created_by,
      // Inherit category from the session so QR-relay uploads are classified correctly
      attachment_category: session.attachment_category || null
    }).select().single();
    if (dbErr) throw dbErr;

    await supabase.from('capture_sessions')
      .update({ status: 'used', used_at: new Date().toISOString(), attachment_id: attachment.id })
      .eq('id', req.params.id);

    res.json({ success: true, attachment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── HOA Correction Proposals (Auditor → Admin batch-approve) ────────────────

// Auditor submits a correction proposal for head_of_account / sub_head_of_account
app.post('/api/vouchers/:id/hoa-corrections', async (req, res) => {
  try {
    const { proposedBy, proposedHoa, proposedSubHoa, reason } = req.body;
    if (!proposedBy || !reason || (!proposedHoa && proposedSubHoa === undefined)) {
      return res.status(400).json({ error: 'proposedBy, reason, and at least one of proposedHoa / proposedSubHoa are required' });
    }

    // Verify caller is an auditor for this company
    const { data: caller } = await supabase.from('users').select('id, name, role').eq('id', proposedBy).single();
    if (!caller || caller.role !== 'auditor') {
      return res.status(403).json({ error: 'Only Auditors can propose HOA corrections' });
    }

    // Load current voucher state
    const { data: voucher, error: vErr } = await supabase.from('vouchers')
      .select('id, company_id, serial_number, head_of_account, sub_head_of_account')
      .eq('id', req.params.id).single();
    if (vErr || !voucher) return res.status(404).json({ error: 'Voucher not found' });

    // Enforce one pending proposal per voucher
    const { data: existing } = await supabase.from('hoa_correction_proposals')
      .select('id').eq('voucher_id', voucher.id).eq('status', 'pending').maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'A pending HOA correction already exists for this voucher. Wait for Admin to review it first.' });
    }

    const { data: proposal, error: insErr } = await supabase.from('hoa_correction_proposals').insert({
      company_id:      voucher.company_id,
      voucher_id:      voucher.id,
      proposed_by:     proposedBy,
      current_hoa:     voucher.head_of_account,
      current_sub_hoa: voucher.sub_head_of_account || null,
      proposed_hoa:    proposedHoa || null,
      proposed_sub_hoa: (proposedSubHoa !== undefined ? proposedSubHoa || null : undefined),
      reason,
    }).select().single();
    if (insErr) return res.status(500).json({ error: insErr.message });

    // Notify all Admins
    const { data: admins } = await supabase.from('users')
      .select('id').eq('company_id', voucher.company_id).in('role', ['admin', 'super_admin']);
    const notifications = (admins || []).map(a => ({
      user_id: a.id,
      title: '✏️ HOA Correction Proposed',
      message: `${caller.name} proposed an HOA correction for ${voucher.serial_number}: "${voucher.head_of_account}" → "${proposedHoa || voucher.head_of_account}". Reason: ${reason}`,
      type: 'info',
      voucher_id: voucher.id,
    }));
    if (notifications.length) await supabase.from('notifications').insert(notifications);

    res.json({ success: true, proposal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin lists HOA correction proposals for their company
app.get('/api/companies/:companyId/hoa-corrections', async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('hoa_correction_proposals')
      .select(`*, proposer:users!proposed_by(id, name), reviewer:users!reviewed_by(id, name), voucher:vouchers!voucher_id(id, serial_number, head_of_account, sub_head_of_account)`)
      .eq('company_id', req.params.companyId)
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ proposals: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin batch-approves one or more pending proposals
app.post('/api/companies/:companyId/hoa-corrections/batch-approve', async (req, res) => {
  try {
    const { ids, approvedBy } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !approvedBy) {
      return res.status(400).json({ error: 'ids (array) and approvedBy are required' });
    }

    // Verify caller is Admin / Super Admin
    const { data: caller } = await supabase.from('users').select('id, name, role, is_super_admin').eq('id', approvedBy).single();
    if (!caller || (caller.role !== 'admin' && !caller.is_super_admin)) {
      return res.status(403).json({ error: 'Only Admin or Super Admin can approve HOA corrections' });
    }

    // Load all requested proposals (must be pending and belong to this company)
    const { data: proposals, error: fetchErr } = await supabase.from('hoa_correction_proposals')
      .select('id, voucher_id, proposed_hoa, proposed_sub_hoa, proposed_by, current_hoa, current_sub_hoa')
      .in('id', ids)
      .eq('company_id', req.params.companyId)
      .eq('status', 'pending');
    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!proposals || proposals.length === 0) return res.status(404).json({ error: 'No matching pending proposals found' });

    const now = new Date().toISOString();
    const approvedIds = [];
    const errors = [];

    for (const p of proposals) {
      // Build the voucher update object — only overwrite fields that have a proposed value
      const voucherUpdate = {};
      if (p.proposed_hoa) voucherUpdate.head_of_account = p.proposed_hoa;
      if (p.proposed_sub_hoa !== null && p.proposed_sub_hoa !== undefined) voucherUpdate.sub_head_of_account = p.proposed_sub_hoa || null;

      if (Object.keys(voucherUpdate).length > 0) {
        const { error: vErr } = await supabase.from('vouchers').update(voucherUpdate).eq('id', p.voucher_id);
        if (vErr) { errors.push({ proposalId: p.id, error: vErr.message }); continue; }
      }

      await supabase.from('hoa_correction_proposals').update({
        status: 'approved', reviewed_by: approvedBy, reviewed_at: now,
      }).eq('id', p.id);

      // Notify the Auditor who proposed the correction
      const { data: voucher } = await supabase.from('vouchers').select('serial_number').eq('id', p.voucher_id).single();
      await supabase.from('notifications').insert({
        user_id: p.proposed_by,
        title: '✅ HOA Correction Approved',
        message: `Your HOA correction for ${voucher?.serial_number || 'voucher'} was approved by ${caller.name}.`,
        type: 'success',
        voucher_id: p.voucher_id,
      });

      approvedIds.push(p.id);
    }

    res.json({ success: true, approvedCount: approvedIds.length, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin rejects a single pending proposal
app.post('/api/hoa-corrections/:proposalId/reject', async (req, res) => {
  try {
    const { rejectedBy, rejectionReason } = req.body;
    if (!rejectedBy || !rejectionReason) {
      return res.status(400).json({ error: 'rejectedBy and rejectionReason are required' });
    }

    const { data: caller } = await supabase.from('users').select('id, name, role, is_super_admin').eq('id', rejectedBy).single();
    if (!caller || (caller.role !== 'admin' && !caller.is_super_admin)) {
      return res.status(403).json({ error: 'Only Admin or Super Admin can reject HOA corrections' });
    }

    const { data: proposal, error: fetchErr } = await supabase.from('hoa_correction_proposals')
      .select('id, status, proposed_by, voucher_id').eq('id', req.params.proposalId).single();
    if (fetchErr || !proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status !== 'pending') return res.status(400).json({ error: 'Proposal is not pending' });

    await supabase.from('hoa_correction_proposals').update({
      status: 'rejected', reviewed_by: rejectedBy, reviewed_at: new Date().toISOString(), rejection_reason: rejectionReason,
    }).eq('id', req.params.proposalId);

    // Notify the Auditor
    const { data: voucher } = await supabase.from('vouchers').select('serial_number').eq('id', proposal.voucher_id).single();
    await supabase.from('notifications').insert({
      user_id: proposal.proposed_by,
      title: '❌ HOA Correction Rejected',
      message: `Your HOA correction for ${voucher?.serial_number || 'voucher'} was rejected by ${caller.name}. Reason: ${rejectionReason}`,
      type: 'error',
      voucher_id: proposal.voucher_id,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// ==========================================
// PAYMENT TRACKING ENDPOINTS (Phase-2)
// ==========================================

// Queue voucher for payment: completed → awaiting_payment (Accounts/SuperAdmin)
app.post('/api/vouchers/:voucherId/mark-awaiting-payment', async (req, res) => {
  const { markedBy } = req.body;
  if (!markedBy) return res.status(400).json({ error: 'markedBy is required' });

  try {
    const actor = await getActorRole(markedBy);
    if (actor.role !== 'accounts' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Only Accounts users can queue vouchers for payment' });

    const { data: voucher, error: vErr } = await supabase.from('vouchers')
      .select('*, preparer:users!vouchers_prepared_by_fkey(name)')
      .eq('id', req.params.voucherId).single();

    if (vErr || !voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.status !== 'completed')
      return res.status(400).json({ error: `Voucher must be completed to queue for payment (current: ${voucher.status})` });

    const { error: upErr } = await supabase.from('vouchers').update({
      status: 'awaiting_payment',
      queued_for_payment_by: markedBy,
      queued_at: new Date().toISOString()
    }).eq('id', req.params.voucherId);

    if (upErr) throw upErr;

    await supabase.from('notifications').insert({
      user_id: voucher.prepared_by,
      title: '💳 Payment Queued',
      message: `Voucher ${voucher.serial_number} is now queued for payment.`,
      type: 'info',
      voucher_id: req.params.voucherId
    });

    console.log(`   💳 Voucher ${voucher.serial_number} queued for payment by ${markedBy}`);
    res.json({ success: true, message: 'Voucher queued for payment.' });
  } catch (error) {
    console.error('mark-awaiting-payment error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Mark voucher as paid: awaiting_payment|completed → paid (Accounts/SuperAdmin)
app.post('/api/vouchers/:voucherId/mark-paid', async (req, res) => {
  const { paidBy, paymentReference, paymentNotes, receiptData, receiptMimeType, paymentMode } = req.body;
  if (!paidBy) return res.status(400).json({ error: 'paidBy is required' });
  const isCash = paymentMode === 'Cash';
  // Cash payments need no UTR or receipt — captured by signed chit (optional photo)
  if (!isCash && !paymentReference && !receiptData)
    return res.status(400).json({ error: 'Please enter a UTR reference or upload a receipt — at least one is required' });

  try {
    const actor = await getActorRole(paidBy);
    if (actor.role !== 'accounts' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Only Accounts users can confirm payment' });

    const { data: voucher, error: vErr } = await supabase.from('vouchers')
      .select('*, preparer:users!vouchers_prepared_by_fkey(name), payee:payees(name, mobile)')
      .eq('id', req.params.voucherId).single();

    if (vErr || !voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (!['awaiting_payment', 'completed'].includes(voucher.status))
      return res.status(400).json({ error: `Voucher must be awaiting_payment or completed to mark as paid (current: ${voucher.status})` });

    // Reciprocal guard: reject if this voucher is locked into a pending payment batch.
    // A pending batch must be paid or cancelled through the batch flow, not bypassed here.
    //
    // Two-query approach (no join-filter): avoids the !inner+.eq('table.col') PostgREST
    // syntax which has no precedent elsewhere in this codebase and cannot be tested until
    // migration 032 is applied. Simple sequential queries follow the established pattern.
    const { data: batchVoucherRow } = await supabase
      .from('payment_batch_vouchers')
      .select('batch_id')
      .eq('voucher_id', req.params.voucherId)
      .maybeSingle();
    if (batchVoucherRow) {
      const { data: pendingBatch } = await supabase
        .from('payment_batches')
        .select('batch_reference, status')
        .eq('id', batchVoucherRow.batch_id)
        .eq('status', 'pending')
        .maybeSingle();
      if (pendingBatch) {
        return res.status(409).json({
          error: `This voucher is part of pending payment batch ${pendingBatch.batch_reference}. Pay or cancel the batch instead of marking this voucher individually.`
        });
      }
    }

    // Upload receipt — shared helper keeps path convention in one place
    let receiptUrl = null;
    if (receiptData && receiptMimeType) {
      const buffer = Buffer.from(receiptData, 'base64');
      receiptUrl = await _uploadPaymentReceiptToStorage(req.params.voucherId, voucher.company_id, voucher.serial_number, buffer, receiptMimeType);
    }

    const { error: upErr } = await supabase.from('vouchers').update({
      status: 'paid',
      payment_reference: paymentReference || null,
      payment_mode: paymentMode || undefined,
      payment_notes: paymentNotes || null,
      payment_receipt_url: receiptUrl,
      paid_by: paidBy,
      paid_at: new Date().toISOString()
    }).eq('id', req.params.voucherId);

    if (upErr) throw upErr;

    await supabase.from('notifications').insert({
      user_id: voucher.prepared_by,
      title: '✅ Payment Completed',
      message: `Voucher ${voucher.serial_number} has been paid.${paymentReference ? ` UTR: ${paymentReference}` : ''}`,
      type: 'completed',
      voucher_id: req.params.voucherId
    });

    sendPushNotification(
      voucher.prepared_by,
      '✅ Payment Done',
      `Voucher ${voucher.serial_number} paid.${paymentReference ? ` UTR: ${paymentReference}` : ''}`,
      '/'
    );

    if (voucher.payee?.mobile) {
      await sendWhatsApp(voucher.payee.mobile, 'pramaana_payment_confirmed', parseFloat(voucher.amount).toFixed(2), voucher.serial_number);
    }

    console.log(`   ✅ Voucher ${voucher.serial_number} marked paid by ${paidBy} — UTR: ${paymentReference || 'N/A'} | Receipt: ${receiptUrl ? 'uploaded' : 'none'}`);
    res.json({ success: true, message: 'Voucher marked as paid.' });
  } catch (error) {
    console.error('mark-paid error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Mark a paid voucher as payment-failed: reverts to awaiting_payment (Approver / SuperAdmin only).
// Clears payment fields; writes a timestamped audit note so the failure is never silently lost.
app.post('/api/vouchers/:voucherId/mark-payment-failed', async (req, res) => {
  const { failedBy, failureNote } = req.body;
  if (!failedBy) return res.status(400).json({ error: 'failedBy is required' });

  try {
    const actor = await getActorRole(failedBy);
    if (actor.role !== 'approver' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Only Approvers can mark a payment as failed' });

    const { data: voucher, error: vErr } = await supabase.from('vouchers')
      .select('*, revertedBy:users!vouchers_paid_by_fkey(name)')
      .eq('id', req.params.voucherId).single();
    if (vErr || !voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.status !== 'paid')
      return res.status(400).json({ error: `Only paid vouchers can be reverted (current: ${voucher.status})` });

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    const auditNote = `Payment of ₹${parseFloat(voucher.amount).toFixed(2)} via ${voucher.payment_mode || 'UPI'} failed/returned on ${timestamp}, reverted by ${actor.name || failedBy}. ${failureNote ? `Note: ${failureNote}` : ''}`.trim();

    const { error: upErr } = await supabase.from('vouchers').update({
      status:              'awaiting_payment',
      payment_reference:   null,
      payment_receipt_url: null,
      paid_by:             null,
      paid_at:             null,
      // Preserve payment_notes as audit trail: prepend the failure note
      payment_notes: voucher.payment_notes
        ? `${auditNote}\n\n[Previous note]: ${voucher.payment_notes}`
        : auditNote,
    }).eq('id', req.params.voucherId);
    if (upErr) throw upErr;

    await supabase.from('notifications').insert({
      user_id: voucher.prepared_by,
      title:   '⚠️ Payment Failed — Action Required',
      message: `Payment for voucher ${voucher.serial_number} was returned. It has been reverted to Awaiting Payment.`,
      type:    'pending',
      voucher_id: req.params.voucherId,
    });

    console.log(`   ⚠️  Voucher ${voucher.serial_number} payment reverted by ${failedBy} — ${auditNote}`);
    res.json({ success: true, message: 'Payment marked as failed. Voucher reverted to awaiting_payment.' });
  } catch (error) {
    console.error('mark-payment-failed error:', error.message);
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/vouchers/:voucherId/dequeue-payment', async (req, res) => {
  const { dequeuedBy } = req.body;
  if (!dequeuedBy) return res.status(400).json({ error: 'dequeuedBy is required' });

  try {
    const actor = await getActorRole(dequeuedBy);
    if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Unauthorized' });

    const { data: voucher, error: vErr } = await supabase.from('vouchers')
      .select('serial_number, status')
      .eq('id', req.params.voucherId).single();

    if (vErr || !voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.status !== 'awaiting_payment')
      return res.status(400).json({ error: `Voucher is not in the payment queue (current: ${voucher.status})` });

    const { error: upErr } = await supabase.from('vouchers').update({
      status: 'completed',
      queued_for_payment_by: null,
      queued_at: null
    }).eq('id', req.params.voucherId);

    if (upErr) throw upErr;

    console.log(`   ↩ Voucher ${voucher.serial_number} deferred (removed from payment queue) by ${dequeuedBy}`);
    res.json({ success: true, message: 'Voucher deferred — returned to OTP Verified.' });
  } catch (error) {
    console.error('dequeue-payment error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Mark the initial suspense advance as paid (Admin / Super Admin only)
app.post('/api/suspense-vouchers/:id/mark-advance-paid', async (req, res) => {
  const { paidBy, paymentReference, paymentNotes, receiptData, receiptMimeType } = req.body;
  if (!paidBy) return res.status(400).json({ error: 'paidBy is required' });
  if (!paymentReference && !receiptData)
    return res.status(400).json({ error: 'Enter a UTR reference or upload a receipt — at least one is required' });

  try {
    const actor = await getActorRole(paidBy);
    if (actor.role !== 'admin' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Only Admin or Super Admin can confirm advance payments' });

    const { data: sv, error: svErr } = await supabase.from('suspense_vouchers')
      .select('id, serial_number, company_id, advance_amount, payment_mode, advance_payment_status, created_by, staff_payee_id')
      .eq('id', req.params.id).single();
    if (svErr || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });
    if (sv.advance_payment_status === 'paid')
      return res.status(400).json({ error: 'Advance has already been marked as paid' });

    // Upload receipt if provided
    let receiptUrl = null;
    if (receiptData && receiptMimeType) {
      const ext = receiptMimeType === 'application/pdf' ? 'pdf'
        : receiptMimeType.startsWith('image/') ? receiptMimeType.split('/')[1]
        : 'jpg';
      // Rename to {serial}-ADV-{date}.{ext} — bank receipts have opaque system names.
      const _ad = new Date();
      const _ads = `${String(_ad.getDate()).padStart(2,'0')}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][_ad.getMonth()]}-${_ad.getFullYear()}`;
      const _asn = (sv.serial_number || 'SV').replace(/[^A-Za-z0-9-]/g, '-');
      const fileName = `${sv.company_id}/advance-receipts/${req.params.id}/${_asn}-ADV-${_ads}.${ext}`;
      const buffer = Buffer.from(receiptData, 'base64');
      const { error: storageErr } = await supabase.storage
        .from('voucher-bills')
        .upload(fileName, buffer, { contentType: receiptMimeType, upsert: true });
      if (storageErr) {
        console.warn('Advance receipt upload failed (storage):', storageErr.message, '— continuing without receipt URL');
      } else {
        const { data: urlData } = supabase.storage.from('voucher-bills').getPublicUrl(fileName);
        receiptUrl = urlData.publicUrl;
      }
    }

    await supabase.from('suspense_vouchers').update({
      advance_payment_status:    'paid',
      advance_payment_reference: paymentReference || null,
      advance_payment_notes:     paymentNotes || null,
      advance_payment_receipt_url: receiptUrl,
      advance_paid_by:           paidBy,
      advance_paid_at:           new Date().toISOString()
    }).eq('id', req.params.id);

    // Notify voucher creator
    const { data: payer } = await supabase.from('users').select('name').eq('id', paidBy).single();
    await supabase.from('notifications').insert({
      user_id: sv.created_by,
      title: '✅ Advance Payment Confirmed',
      message: `₹${parseFloat(sv.advance_amount).toFixed(2)} advance for ${sv.serial_number} confirmed paid by ${payer?.name || 'Admin'}.${paymentReference ? ` UTR: ${paymentReference}` : ''}`,
      type: 'completed'
    });

    if (sv.staff_payee_id) {
      const { data: payee } = await supabase.from('payees').select('mobile').eq('id', sv.staff_payee_id).single();
      if (payee?.mobile) await sendWhatsApp(payee.mobile, 'pramaana_payment_confirmed', parseFloat(sv.advance_amount).toFixed(2), sv.serial_number);
    }

    console.log(`   ✅ Advance for ${sv.serial_number} marked paid by ${paidBy} — UTR: ${paymentReference || 'N/A'} | Receipt: ${receiptUrl ? 'uploaded' : 'none'}`);
    res.json({ success: true });
  } catch (error) {
    console.error('mark-advance-paid error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Mark a top-up as paid: approved top-up → payment_status='paid'  (Admin / Super Admin only)
app.post('/api/suspense-settlements/:id/mark-topup-paid', async (req, res) => {
  const { paidBy, paymentReference, paymentNotes, receiptData, receiptMimeType } = req.body;
  if (!paidBy) return res.status(400).json({ error: 'paidBy is required' });
  if (!paymentReference && !receiptData)
    return res.status(400).json({ error: 'Enter a UTR reference or upload a receipt — at least one is required' });

  try {
    const actor = await getActorRole(paidBy);
    if (actor.role !== 'admin' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Only Admin or Super Admin can confirm top-up payments' });

    const { data: settlement, error: sErr } = await supabase
      .from('suspense_settlements')
      .select('*, suspense:suspense_vouchers!suspense_id(id,serial_number,company_id,created_by,payment_mode,staff_payee_id)')
      .eq('id', req.params.id)
      .single();
    if (sErr || !settlement) return res.status(404).json({ error: 'Settlement entry not found' });
    if (settlement.entry_type !== 'topup')
      return res.status(400).json({ error: 'Entry is not a top-up' });
    if (settlement.status !== 'approved')
      return res.status(400).json({ error: 'Top-up must be approved before marking as paid' });
    if (settlement.payment_status === 'paid')
      return res.status(400).json({ error: 'Top-up has already been marked as paid' });

    const sv = settlement.suspense;

    // Upload receipt if provided
    let receiptUrl = null;
    if (receiptData && receiptMimeType) {
      const ext = receiptMimeType === 'application/pdf' ? 'pdf'
        : receiptMimeType.startsWith('image/') ? receiptMimeType.split('/')[1]
        : 'jpg';
      // Rename to {serial}-TOPUP-{date}.{ext} — bank receipts have opaque system names.
      const _td = new Date();
      const _tds = `${String(_td.getDate()).padStart(2,'0')}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][_td.getMonth()]}-${_td.getFullYear()}`;
      const _tsn = (sv.serial_number || 'SV').replace(/[^A-Za-z0-9-]/g, '-');
      const fileName = `${sv.company_id}/topup-receipts/${req.params.id}/${_tsn}-TOPUP-${_tds}.${ext}`;
      const buffer = Buffer.from(receiptData, 'base64');
      const { error: storageErr } = await supabase.storage
        .from('voucher-bills')
        .upload(fileName, buffer, { contentType: receiptMimeType, upsert: true });
      if (storageErr) {
        console.warn('Top-up receipt upload failed (storage):', storageErr.message, '— continuing without receipt URL');
      } else {
        const { data: urlData } = supabase.storage.from('voucher-bills').getPublicUrl(fileName);
        receiptUrl = urlData.publicUrl;
      }
    }

    await supabase.from('suspense_settlements').update({
      payment_status:      'paid',
      payment_reference:   paymentReference || null,
      payment_notes:       paymentNotes || null,
      payment_receipt_url: receiptUrl,
      paid_by:             paidBy,
      paid_at:             new Date().toISOString()
    }).eq('id', req.params.id);

    // Notify voucher creator and the Accounts user who submitted the top-up
    const { data: payer } = await supabase.from('users').select('name').eq('id', paidBy).single();
    const notifyUsers = [...new Set([sv.created_by, settlement.submitted_by].filter(Boolean))];
    for (const uid of notifyUsers) {
      await supabase.from('notifications').insert({
        user_id: uid,
        title: '✅ Top-Up Payment Confirmed',
        message: `₹${parseFloat(settlement.amount).toFixed(2)} top-up for ${sv.serial_number} paid by ${payer?.name || 'Admin'}.${paymentReference ? ` UTR: ${paymentReference}` : ''}`,
        type: 'completed'
      });
    }

    if (sv.staff_payee_id) {
      const { data: payee } = await supabase.from('payees').select('mobile').eq('id', sv.staff_payee_id).single();
      if (payee?.mobile) await sendWhatsApp(payee.mobile, 'pramaana_payment_confirmed', parseFloat(settlement.amount).toFixed(2), sv.serial_number);
    }

    console.log(`   ✅ Top-up ${req.params.id} for ${sv.serial_number} marked paid by ${paidBy} — UTR: ${paymentReference || 'N/A'} | Receipt: ${receiptUrl ? 'uploaded' : 'none'}`);
    res.json({ success: true });
  } catch (error) {
    console.error('mark-topup-paid error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/receipts/match-voucher
// Match a payment receipt (image or PDF) against the company's payment queue.
//
// Request body (JSON):
//   requestedBy     {string}  userId of the requesting user (auth check)
//   receiptData     {string}  Base64-encoded file bytes (same shape as mark-paid)
//   receiptMimeType {string}  e.g. 'image/jpeg' | 'image/png' | 'application/pdf'
//   companyId       {string}  Company whose vouchers to search
//
// Success response (HTTP 200):
//   { confidence, matchedVoucherId, extractedReference, candidateVouchers }
//   NOTE: confidence:'none' is a success response, not an error — it means the
//   file was read but no VCH reference was found (or the PDF has no text layer).
//
// Error response — thrown error (HTTP 422 or 503):
//   { error: true, message: string, retryable: boolean }
//   retryable:true  → transient: rate-limit (429) or OpenAI/network 5xx  → user can retry
//   retryable:false → permanent: content-policy, bad key, corrupt PDF, bad MIME → won't fix on retry
// ---------------------------------------------------------------------------
app.post('/api/receipts/match-voucher', async (req, res) => {
  const { requestedBy, receiptData, receiptMimeType, companyId, fileName } = req.body;

  if (!requestedBy)
    return res.status(400).json({ error: true, message: 'requestedBy is required' });
  if (!receiptData)
    return res.status(400).json({ error: true, message: 'receiptData (base64) is required' });
  if (!receiptMimeType)
    return res.status(400).json({ error: true, message: 'receiptMimeType is required' });
  if (!companyId)
    return res.status(400).json({ error: true, message: 'companyId is required' });

  // Auth: only Accounts, Admin, or Super Admin may use this endpoint.
  const actor = await getActorRole(requestedBy);
  if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin)
    return res.status(403).json({ error: true, message: 'Only Accounts or Admin users can match receipts to vouchers', retryable: false });

  if (!receiptMimeType.startsWith('image/') && receiptMimeType !== 'application/pdf') {
    return res.status(400).json({
      error: true,
      message: `Unsupported file type "${receiptMimeType}". Accepted: image/jpeg, image/png, image/webp, application/pdf.`,
      retryable: false,
    });
  }

  let fileBuffer;
  try {
    fileBuffer = Buffer.from(receiptData, 'base64');
  } catch {
    return res.status(400).json({ error: true, message: 'receiptData is not valid base64', retryable: false });
  }

  try {
    const result = await matchReceiptToVoucher(fileBuffer, receiptMimeType, companyId, fileName || '');
    return res.json(result);
  } catch (err) {
    // Retryable = ONLY transient service failures: rate-limit (429) or server errors (5xx)
    // and low-level network resets.  Everything else is not retryable.
    const retryable =
      /openai api error (429|5\d{2})\b/i.test(err.message) ||
      /econnreset|econnrefused|etimedout|network timeout/i.test(err.message);

    const httpStatus = retryable ? 503 : 422;
    console.error(`[match-voucher] error (retryable=${retryable}):`, err.message);
    return res.status(httpStatus).json({
      error: true,
      message: err.message,
      retryable,
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ────────────────────────────────────────────────────────────────────────────────
// SHARE-TARGET AUTO-COMPLETE (Migration 036)
// Called by ReceiptShareModal when a receipt arrives via the Android share sheet.
// One call does OCR, matching, upload, and mark-paid — or routes to unassigned_receipts.
// ────────────────────────────────────────────────────────────────────────────────

// POST /api/receipts/auto-complete
// Matching priority: VCH reference (if resolvable) → amount fallback → review queue.
// Amount guard always applies: ref match + amount mismatch → review queue.
// On auto-complete: uploads to payment-receipts/ (same convention as mark-paid) and
// advances voucher to paid, populating payment_reference with the extracted UTR.
// NOTE: payment_reference in Approvals maps to pramaana.vouchers.utr_number in the
// future cross-system sync — do NOT rename this column to match Pramaana's name.
app.post('/api/receipts/auto-complete', async (req, res) => {
  const { requestedBy, receiptData, receiptMimeType, companyId, fileName, allCompanyIds } = req.body;

  if (!requestedBy) return res.status(400).json({ error: true, message: 'requestedBy is required' });
  if (!receiptData)  return res.status(400).json({ error: true, message: 'receiptData is required' });
  if (!receiptMimeType) return res.status(400).json({ error: true, message: 'receiptMimeType is required' });
  if (!companyId)    return res.status(400).json({ error: true, message: 'companyId is required' });

  const actor = await getActorRole(requestedBy);
  if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin)
    return res.status(403).json({ error: true, message: 'Only Accounts or Admin users can auto-complete receipts' });

  if (!receiptMimeType.startsWith('image/') && receiptMimeType !== 'application/pdf')
    return res.status(400).json({ error: true, message: `Unsupported file type "${receiptMimeType}"` });

  let fileBuffer;
  try { fileBuffer = Buffer.from(receiptData, 'base64'); }
  catch { return res.status(400).json({ error: true, message: 'receiptData is not valid base64' }); }

  try {
    let decision = await _autoCompleteMatch(fileBuffer, receiptMimeType, companyId, fileName || '');
    let detectedCompanyId = null;

    // If queued on primary company, try other companies the user has access to
    if (decision.outcome === 'queued' && Array.isArray(allCompanyIds) && allCompanyIds.length > 0) {
      for (const altId of allCompanyIds.filter(id => id && id !== companyId)) {
        const altDecision = await _autoCompleteMatch(fileBuffer, receiptMimeType, altId, fileName || '');
        if (altDecision.outcome !== 'queued') {
          decision = altDecision;
          detectedCompanyId = altId;
          break;
        }
      }
    }

    // ── B1: Batch match — write UTR to all members + mark batch paid ─────────
    if (decision.outcome === 'batch') {
      const { batch, ocrData } = decision;
      const utr = ocrData?.utr_number || null;
      const receiptUrl = await _uploadPaymentReceiptToStorage(
        batch.id, companyId, batch.batch_reference, fileBuffer, receiptMimeType
      ).catch(() => null);

      const { error: rpcErr } = await supabase.rpc('batch_mark_paid', {
        p_batch_id:          batch.id,
        p_paid_by:           requestedBy,
        p_payment_reference: utr,
        p_payment_notes:     decision.matchedBy === 'amount'
          ? `batch_completed via amount match (Share Receipt auto-complete — no CPAY ref in receipt)`
          : `Auto-completed via Share Receipt (matched by ${decision.matchedBy})`,
        p_receipt_url:       receiptUrl,
      });
      if (rpcErr) {
        console.error('[auto-complete] batch RPC failed:', rpcErr.message);
        return res.json({ outcome: 'queued', reason: `Batch match found (${batch.batch_reference}) but mark-paid RPC failed: ${rpcErr.message}` });
      }
      // B2: generate CPAY acknowledgment HTML receipt
      _generateAndStoreCpayReceipt(batch.id).catch(e => console.warn('[CPAY-receipt] auto-complete generation failed:', e.message));
      console.log(`[auto-complete] ✅ batch ${batch.batch_reference} → paid | UTR: ${utr || 'N/A'} | matchedBy: ${decision.matchedBy}`);
      return res.json({ outcome: 'batch_completed', batchId: batch.id, batchReference: batch.batch_reference, totalAmount: batch.total_amount, utr, receiptUrl, matchedBy: decision.matchedBy, detectedCompanyId });
    }

    // ── B1-backfill: Batch already paid but missing UTR / receipt ────────────
    // Write UTR + receipt to batch row and propagate UTR to all member vouchers.
    if (decision.outcome === 'batch_backfill') {
      const { batch, ocrData } = decision;
      const utr = ocrData?.utr_number || null;
      const receiptUrl = await _uploadPaymentReceiptToStorage(
        batch.id, companyId, batch.batch_reference, fileBuffer, receiptMimeType
      ).catch(() => null);

      // Update the batch row
      const batchUpdate = {};
      if (utr) batchUpdate.payment_reference = utr;
      if (receiptUrl) batchUpdate.payment_receipt_url = receiptUrl;
      if (Object.keys(batchUpdate).length > 0) {
        await supabase.from('payment_batches').update(batchUpdate).eq('id', batch.id);
      }

      // Propagate UTR to all member vouchers that are missing it
      if (utr) {
        const { data: bvRows } = await supabase.from('payment_batch_vouchers')
          .select('voucher_id').eq('batch_id', batch.id);
        const memberIds = (bvRows || []).map(r => r.voucher_id);
        if (memberIds.length > 0) {
          await supabase.from('vouchers')
            .update({ payment_reference: utr })
            .in('id', memberIds)
            .is('payment_reference', null);
        }
      }

      _generateAndStoreCpayReceipt(batch.id).catch(e => console.warn('[CPAY-receipt] backfill generation failed:', e.message));
      console.log(`[auto-complete] ✅ batch_backfill ${batch.batch_reference} | UTR: ${utr || 'N/A'} | matchedBy: ${decision.matchedBy}`);
      return res.json({ outcome: 'batch_backfilled', batchId: batch.id, batchReference: batch.batch_reference, totalAmount: batch.total_amount, utr, receiptUrl, matchedBy: decision.matchedBy, detectedCompanyId });
    }

    if (decision.outcome === 'complete') {
      const { voucher, ocrData } = decision;

      // Reject if voucher is locked in a pending batch (same guard as mark-paid)
      const { data: bvRow } = await supabase.from('payment_batch_vouchers')
        .select('batch_id').eq('voucher_id', voucher.id).maybeSingle();
      if (bvRow) {
        const { data: pendingBatch } = await supabase.from('payment_batches')
          .select('batch_reference').eq('id', bvRow.batch_id).eq('status', 'pending').maybeSingle();
        if (pendingBatch) {
          return res.json({ outcome: 'queued', reason: `Voucher ${voucher.serial_number} is in pending batch ${pendingBatch.batch_reference}` });
        }
      }

      const receiptUrl = await _uploadPaymentReceiptToStorage(
        voucher.id, voucher.company_id, voucher.serial_number, fileBuffer, receiptMimeType
      );
      // NOTE: payment_reference = UTR — maps to pramaana.vouchers.utr_number in the sync; do not rename
      const utr = ocrData.utr_number || null;
      const { error: upErr } = await supabase.from('vouchers').update({
        status:               'paid',
        payment_reference:    utr,
        payment_notes:        `Auto-completed via Share Receipt (matched by ${decision.matchedBy})`,
        payment_receipt_url:  receiptUrl || null,
        paid_by:              requestedBy,
        paid_at:              new Date().toISOString(),
      }).eq('id', voucher.id);
      if (upErr) throw upErr;

      // C2: auto-resolve any queue rows carrying this UTR
      if (utr) _autoResolveQueueForUtr(voucher.company_id, utr, voucher.serial_number).catch(() => {});

      await supabase.from('notifications').insert({
        user_id:    voucher.prepared_by,
        title:      '✅ Payment Completed',
        message:    `Voucher ${voucher.serial_number} has been paid.${utr ? ` UTR: ${utr}` : ''}`,
        type:       'completed',
        voucher_id: voucher.id,
      });
      sendPushNotification(
        voucher.prepared_by, '✅ Payment Done',
        `Voucher ${voucher.serial_number} paid.${utr ? ` UTR: ${utr}` : ''}`, '/'
      );

      console.log(`[auto-complete] ✅ ${voucher.serial_number} → paid | matchedBy: ${decision.matchedBy} | UTR: ${utr || 'N/A'} | receipt: ${receiptUrl ? 'uploaded' : 'FAILED'}`);
      return res.json({ outcome: 'completed', voucherId: voucher.id, serialNumber: voucher.serial_number, utr, receiptUrl, receiptUploadFailed: !receiptUrl, detectedCompanyId });
    }

    // ── Backfill path: attach receipt and record UTR on already-paid voucher ─
    if (decision.outcome === 'backfill') {
      const { voucher, ocrData } = decision;
      const receiptUrl = await _uploadPaymentReceiptToStorage(
        voucher.id, voucher.company_id, voucher.serial_number, fileBuffer, receiptMimeType
      );
      // NOTE: payment_reference = UTR — maps to pramaana.vouchers.utr_number in the sync; do not rename
      const utr = ocrData.utr_number || null;
      const update = {};
      if (utr) update.payment_reference = utr;
      if (receiptUrl && !voucher.payment_receipt_url) update.payment_receipt_url = receiptUrl;
      if (Object.keys(update).length > 0) {
        const { error: upErr } = await supabase.from('vouchers').update(update).eq('id', voucher.id);
        if (upErr) throw upErr;
      }
      // Explicit flags so the client shows exactly what was written, not a generic "success"
      const utrWritten = !!(update.payment_reference);
      // C2: auto-resolve queue rows carrying this UTR (fix: utrWritten must be defined first)
      if (utr) _autoResolveQueueForUtr(voucher.company_id, utr, voucher.serial_number).catch(() => {});
      const receiptWritten = !!(update.payment_receipt_url);
      const receiptUploadFailed = !receiptUrl; // upload helper returned null
      const nothingWritten = Object.keys(update).length === 0;
      if (nothingWritten) {
        console.warn(`[auto-complete] backfill ${voucher.serial_number} — nothing to write (no UTR, no new receipt URL)`);
        return res.json({ outcome: 'backfilled', voucherId: voucher.id, serialNumber: voucher.serial_number, utr, receiptUrl, utrWritten: false, receiptWritten: false, receiptUploadFailed, nothingWritten: true, detectedCompanyId });
      }
      if (utr && voucher.prepared_by) {
        await supabase.from('notifications').insert({
          user_id: voucher.prepared_by, title: '📎 Receipt & UTR Recorded',
          message: `Receipt attached to ${voucher.serial_number}. UTR: ${utr}`,
          type: 'completed', voucher_id: voucher.id,
        });
      }
      console.log(`[auto-complete] 📎 backfill ${voucher.serial_number} | UTR: ${utr || 'N/A'} | receipt: ${receiptUrl ? 'uploaded' : 'FAILED'}`);
      return res.json({ outcome: 'backfilled', voucherId: voucher.id, serialNumber: voucher.serial_number, utr, receiptUrl, utrWritten, receiptWritten, receiptUploadFailed, detectedCompanyId });
    }

    // ── Queued path: save file to unassigned-receipts storage ────────────────
    const ocrPayload = decision.ocrData && Object.keys(decision.ocrData).length > 0 ? decision.ocrData : null;

    // Detect the correct company from the bank account on the receipt so it lands
    // in the right queue even when the user is logged into a different company.
    const allIds = [companyId, ...((allCompanyIds || []).filter(id => id && id !== companyId))];
    const detectedQueueCompany = await _detectCompanyFromBankAccount(
      ocrPayload?.initiator_account_number, allIds
    ).catch(() => null);
    const queueCompanyId = detectedQueueCompany || companyId;
    if (detectedQueueCompany && detectedQueueCompany !== companyId)
      console.log(`[auto-complete] bank account matched company ${detectedQueueCompany} — routing queue there`);

    const ext = receiptMimeType === 'application/pdf' ? 'pdf' : (receiptMimeType.split('/')[1] || 'jpg');
    const unassignedPath = `${queueCompanyId}/unassigned-receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    let fileUrl = null;
    const { error: storeErr } = await supabase.storage
      .from('voucher-bills')
      .upload(unassignedPath, fileBuffer, { contentType: receiptMimeType, upsert: false });
    if (!storeErr) {
      const { data: urlData } = supabase.storage.from('voucher-bills').getPublicUrl(unassignedPath);
      fileUrl = urlData.publicUrl;
    } else {
      console.warn('[auto-complete] Unassigned storage upload failed:', storeErr.message);
    }

    const queueUtr = ocrPayload?.utr_number || null;
    // C1: dedupe by UTR+company — refresh existing row rather than duplicating
    await _queueUpsert(queueCompanyId, queueUtr, {
      company_id:     queueCompanyId,
      storage_path:   unassignedPath,
      file_url:       fileUrl || '',
      mime_type:      receiptMimeType,
      extracted_data: ocrPayload,
      match_reason:   decision.reason || null,
    });

    console.log(`[auto-complete] 📬 queued: ${decision.reason}`);
    return res.json({ outcome: 'queued', reason: decision.reason, extractedData: ocrPayload });

  } catch (err) {
    console.error('[auto-complete] error:', err.message);
    // Return HTTP 200 with outcome:'error' so the frontend can fall back to manual picker
    return res.status(200).json({ outcome: 'error', message: err.message });
  }
});
// All three mutating routes require accounts/admin/super_admin — the same gate
// used by every payment-queue endpoint in this file.
// ────────────────────────────────────────────────────────────────────────────────

// List batches for a company (all statuses, most recent first)
app.get('/api/companies/:companyId/batches', async (req, res) => {
  try {
    const { data: batches, error } = await supabase
      .from('payment_batches')
      .select('*, payee:payees(id,name,bank_account,upi_id,ifsc,bank_name), creator:users!created_by(id,name)')
      .eq('company_id', req.params.companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Fetch vouchers per batch via two-query pattern (consistent with codebase style)
    const batchIds = (batches || []).map(b => b.id);
    const vouchersByBatch = {};
    if (batchIds.length > 0) {
      const { data: bvRows } = await supabase
        .from('payment_batch_vouchers').select('batch_id, voucher_id').in('batch_id', batchIds);
      const vIds = (bvRows || []).map(r => r.voucher_id);
      let vMap = {};
      if (vIds.length > 0) {
        const { data: vData } = await supabase.from('vouchers').select('id, serial_number, amount').in('id', vIds);
        (vData || []).forEach(v => { vMap[v.id] = v; });
      }
      (bvRows || []).forEach(r => {
        if (!vouchersByBatch[r.batch_id]) vouchersByBatch[r.batch_id] = [];
        if (vMap[r.voucher_id]) vouchersByBatch[r.batch_id].push(vMap[r.voucher_id]);
      });
    }

    const result = (batches || []).map(b => ({
      ...b,
      payee_name: b.payee?.name, payee_bank_account: b.payee?.bank_account,
      payee_upi_id: b.payee?.upi_id, payee_ifsc: b.payee?.ifsc, payee_bank_name: b.payee?.bank_name,
      creator_name: b.creator?.name, vouchers: vouchersByBatch[b.id] || [],
    }));
    res.json(result);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Create a payment batch
app.post('/api/batches', async (req, res) => {
  const { createdBy, companyId, voucherIds } = req.body;
  if (!createdBy) return res.status(400).json({ error: 'createdBy is required' });
  if (!companyId) return res.status(400).json({ error: 'companyId is required' });
  if (!Array.isArray(voucherIds) || voucherIds.length < 2)
    return res.status(400).json({ error: 'At least 2 voucherIds are required to create a batch' });

  try {
    const actor = await getActorRole(createdBy);
    if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Only Accounts or Admin users can create payment batches' });

    const { data: vouchers, error: vErr } = await supabase
      .from('vouchers')
      .select('id, serial_number, amount, payee_id, payment_mode, status, company_id')
      .in('id', voucherIds);
    if (vErr) throw vErr;
    if (!vouchers || vouchers.length !== voucherIds.length)
      return res.status(404).json({ error: 'One or more vouchers not found' });

    const wrongCompany = vouchers.find(v => v.company_id !== companyId);
    if (wrongCompany)
      return res.status(400).json({ error: `Voucher ${wrongCompany.serial_number} does not belong to this company` });

    for (const v of vouchers) {
      if (!['awaiting_payment', 'completed'].includes(v.status))
        return res.status(400).json({ error: `Voucher ${v.serial_number} is not payable (status: ${v.status})` });
    }

    const uniquePayeeIds = [...new Set(vouchers.map(v => v.payee_id))];
    if (uniquePayeeIds.length > 1)
      return res.status(400).json({ error: 'All vouchers in a batch must have the same payee. Vouchers with different payees must be separate payments.' });

    const uniqueModes = [...new Set(vouchers.map(v => v.payment_mode))];
    if (uniqueModes.length > 1)
      return res.status(400).json({ error: 'All vouchers in a batch must use the same payment mode. Vouchers with different modes must be separate payments.' });
    if (uniqueModes[0] === 'Cash')
      return res.status(400).json({ error: 'Cash payment vouchers cannot be batched. Combine only UPI or Account Transfer vouchers.' });

    const totalAmount = vouchers.reduce((sum, v) => sum + parseFloat(v.amount), 0);

    // Auto-cancel any pending batches that already contain these vouchers.
    // This handles the case where a previous batch was created in the DB but the UI
    // crashed before the user could confirm payment (leaving an orphaned pending batch
    // that holds the UNIQUE(voucher_id) constraint on payment_batch_vouchers).
    const { data: conflictRows } = await supabase
      .from('payment_batch_vouchers')
      .select('batch_id')
      .in('voucher_id', voucherIds);
    if (conflictRows && conflictRows.length > 0) {
      const conflictBatchIds = [...new Set(conflictRows.map(r => r.batch_id))];
      for (const conflictBatchId of conflictBatchIds) {
        const { data: conflictBatch } = await supabase
          .from('payment_batches')
          .select('status, batch_reference')
          .eq('id', conflictBatchId)
          .single();
        if (conflictBatch && conflictBatch.status === 'pending') {
          console.log(`   🔄 Auto-cancelling orphaned pending batch ${conflictBatch.batch_reference} to free locked vouchers`);
          await supabase.rpc('cancel_payment_batch', {
            p_batch_id: conflictBatchId,
            p_cancelled_by: createdBy,
            p_reason: 'Auto-cancelled: new combined payment requested for same vouchers'
          });
        }
      }
    }

    const { data: batchRef, error: rpcErr } = await supabase.rpc('get_next_batch_reference', { p_company_id: companyId });
    if (rpcErr) throw rpcErr;

    const { data: batch, error: batchErr } = await supabase
      .from('payment_batches')
      .insert({ company_id: companyId, batch_reference: batchRef, payee_id: uniquePayeeIds[0],
                payment_mode: uniqueModes[0], total_amount: totalAmount, status: 'pending', created_by: createdBy })
      .select().single();
    if (batchErr) throw batchErr;

    const { error: joinErr } = await supabase.from('payment_batch_vouchers')
      .insert(voucherIds.map(vid => ({ batch_id: batch.id, voucher_id: vid })));
    if (joinErr) {
      // Rollback note: the join INSERT is a single Postgres statement; the
      // check_batch_voucher_compatibility trigger uses RAISE EXCEPTION which
      // rolls back the ENTIRE statement (all join rows), so partial-commit of
      // join rows is impossible. The only orphan risk is the payment_batches row
      // itself if this cleanup DELETE fails (e.g. network blip). That is an
      // unlikely edge case: an orphaned pending batch with zero vouchers causes
      // no functional harm and can be cleaned up via cancel_payment_batch RPC.
      await supabase.from('payment_batches').delete().eq('id', batch.id);
      return res.status(400).json({ error: joinErr.message });
    }

    console.log(`   💳 Batch ${batchRef} created by ${createdBy} — ${voucherIds.length} vouchers, ₹${totalAmount.toFixed(2)}`);
    res.json({ success: true, batchId: batch.id, batchReference: batchRef, totalAmount, voucherCount: voucherIds.length });
  } catch (error) {
    console.error('create-batch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Cancel a payment batch
app.post('/api/batches/:id/cancel', async (req, res) => {
  const { cancelledBy, reason } = req.body;
  if (!cancelledBy) return res.status(400).json({ error: 'cancelledBy is required' });
  try {
    const actor = await getActorRole(cancelledBy);
    if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Only Accounts or Admin users can cancel payment batches' });

    const { data: rpcResult, error: rpcErr } = await supabase.rpc('cancel_payment_batch', {
      p_batch_id: req.params.id, p_cancelled_by: cancelledBy, p_reason: reason || null
    });
    if (rpcErr) return res.status(400).json({ error: rpcErr.message });

    // Notify the batch creator (if different from canceller)
    const { data: batch } = await supabase.from('payment_batches')
      .select('created_by, batch_reference').eq('id', req.params.id).single();
    if (batch?.created_by && batch.created_by !== cancelledBy) {
      const { data: canceller } = await supabase.from('users').select('name').eq('id', cancelledBy).single();
      await supabase.from('notifications').insert({
        user_id: batch.created_by,
        title: '🚫 Payment Batch Cancelled',
        message: `Batch ${rpcResult?.batch_reference || batch.batch_reference} cancelled by ${canceller?.name || 'Admin'}.${reason ? ` Reason: ${reason}` : ''} Vouchers released back to queue.`,
        type: 'warning'
      });
    }

    console.log(`   🚫 Batch ${req.params.id} cancelled by ${cancelledBy} — ${rpcResult?.vouchers_released} vouchers released`);
    res.json({ success: true, ...rpcResult });
  } catch (error) {
    console.error('cancel-batch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Mark a payment batch as paid (atomic via batch_mark_paid Postgres RPC)
app.post('/api/batches/:id/mark-paid', async (req, res) => {
  const { paidBy, paymentReference, paymentNotes, receiptData, receiptMimeType } = req.body;
  if (!paidBy) return res.status(400).json({ error: 'paidBy is required' });
  if (!paymentReference && !receiptData)
    return res.status(400).json({ error: 'Enter a UTR reference or upload a receipt — at least one is required' });

  try {
    const actor = await getActorRole(paidBy);
    if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Only Accounts or Admin users can confirm batch payments' });

    const { data: batch, error: bErr } = await supabase.from('payment_batches')
      .select('id, batch_reference, company_id, total_amount, status').eq('id', req.params.id).single();
    if (bErr || !batch) return res.status(404).json({ error: 'Payment batch not found' });
    if (batch.status !== 'pending')
      return res.status(400).json({ error: `Batch ${batch.batch_reference} is already ${batch.status}` });

    let receiptUrl = null;
    if (receiptData && receiptMimeType) {
      const ext = receiptMimeType === 'application/pdf' ? 'pdf'
        : receiptMimeType.startsWith('image/') ? receiptMimeType.split('/')[1] : 'jpg';
      const fileName = `${batch.company_id}/batch-receipts/${req.params.id}/receipt_${Date.now()}.${ext}`;
      const buffer = Buffer.from(receiptData, 'base64');
      const { error: storageErr } = await supabase.storage.from('voucher-bills')
        .upload(fileName, buffer, { contentType: receiptMimeType, upsert: true });
      if (!storageErr) {
        const { data: urlData } = supabase.storage.from('voucher-bills').getPublicUrl(fileName);
        receiptUrl = urlData.publicUrl;
      } else {
        console.warn('Batch receipt upload failed:', storageErr.message, '— continuing without receipt URL');
      }
    }

    const { data: rpcResult, error: rpcErr } = await supabase.rpc('batch_mark_paid', {
      p_batch_id: req.params.id, p_paid_by: paidBy,
      p_payment_reference: paymentReference || null,
      p_payment_notes: paymentNotes || null,
      p_receipt_url: receiptUrl
    });
    if (rpcErr) return res.status(400).json({ error: rpcErr.message });

    // Notify all voucher preparers
    const { data: bvRows } = await supabase.from('payment_batch_vouchers')
      .select('voucher_id').eq('batch_id', req.params.id);
    const vIds = (bvRows || []).map(r => r.voucher_id);
    if (vIds.length > 0) {
      const { data: paidVouchers } = await supabase.from('vouchers')
        .select('serial_number, prepared_by').in('id', vIds);
      const { data: payer } = await supabase.from('users').select('name').eq('id', paidBy).single();
      const preparerIds = [...new Set((paidVouchers || []).map(v => v.prepared_by).filter(Boolean))];
      for (const uid of preparerIds) {
        const mine = (paidVouchers || []).filter(v => v.prepared_by === uid);
        await supabase.from('notifications').insert({
          user_id: uid,
          title: '✅ Batch Payment Completed',
          message: `${mine.map(v => v.serial_number).join(', ')} paid via batch ${batch.batch_reference}.${paymentReference ? ` UTR: ${paymentReference}` : ''} — ${payer?.name || 'Accounts'}`,
          type: 'completed'
        });
      }
    }

    // Insert into payment_batch_receipts if a receipt was uploaded (enables multi-receipt later)
    if (receiptUrl) {
      await supabase.from('payment_batch_receipts').insert({
        batch_id: req.params.id,
        receipt_url: receiptUrl,
        payment_reference: paymentReference || null,
        notes: paymentNotes || null,
        uploaded_by: paidBy
      });
    }

    console.log(`   ✅ Batch ${batch.batch_reference} marked paid by ${paidBy} — ${rpcResult?.vouchers_paid} vouchers | UTR: ${paymentReference || 'N/A'}`);
    // B2: generate CPAY acknowledgment HTML receipt and store it
    _generateAndStoreCpayReceipt(req.params.id).catch(e => console.warn('[CPAY-receipt] generation failed:', e.message));
    res.json({ success: true, ...rpcResult, receiptUrl });
  } catch (error) {
    console.error('mark-batch-paid error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// B2: Get batch details + member vouchers (for auditor "Settled via" view on individual vouchers)
app.get('/api/batches/:id', async (req, res) => {
  try {
    const { data: batch, error: bErr } = await supabase.from('payment_batches')
      .select('id, batch_reference, total_amount, status, payment_reference, payment_receipt_url, paid_at, payees(name)')
      .eq('id', req.params.id).single();
    if (bErr || !batch) return res.status(404).json({ error: 'Batch not found' });

    const { data: members } = await supabase.from('payment_batch_vouchers')
      .select('voucher_id, vouchers(serial_number, amount, payee_id, payees(name))')
      .eq('batch_id', req.params.id);

    res.json({
      ...batch,
      payee_name: batch.payees?.name || null,
      members: (members || []).map(m => ({
        voucher_id:     m.voucher_id,
        serial_number:  m.vouchers?.serial_number || null,
        amount:         m.vouchers?.amount || null,
        payee_name:     m.vouchers?.payees?.name || null,
      })),
    });
  } catch (error) {
    console.error('get-batch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// B2: Regenerate (or generate for the first time) the CPAY acknowledgment HTML receipt
app.post('/api/batches/:id/generate-receipt', async (req, res) => {
  const { requestedBy } = req.body;
  if (!requestedBy) return res.status(400).json({ error: 'requestedBy is required' });
  try {
    const actor = await getActorRole(requestedBy);
    if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Only Accounts or Admin users can generate batch receipts' });
    const url = await _generateAndStoreCpayReceipt(req.params.id);
    if (!url) return res.status(500).json({ error: 'Receipt generation failed — check storage permissions' });
    res.json({ success: true, receiptUrl: url });
  } catch (error) {
    console.error('generate-batch-receipt error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// B3: Batch Payment Register — all batches for a company with members + amounts
app.get('/api/companies/:companyId/batch-register', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { data: batches, error: bErr } = await supabase.from('payment_batches')
      .select('id, batch_reference, total_amount, status, payment_reference, payment_receipt_url, paid_at, created_at, payees(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (bErr) throw bErr;

    const batchIds = (batches || []).map(b => b.id);
    let memberMap = {};
    if (batchIds.length > 0) {
      const { data: allMembers } = await supabase.from('payment_batch_vouchers')
        .select('batch_id, voucher_id, vouchers(serial_number, amount)')
        .in('batch_id', batchIds);
      (allMembers || []).forEach(m => {
        if (!memberMap[m.batch_id]) memberMap[m.batch_id] = [];
        memberMap[m.batch_id].push({ serial_number: m.vouchers?.serial_number, amount: m.vouchers?.amount });
      });
    }

    res.json((batches || []).map(b => ({
      ...b,
      payee_name: b.payees?.name || null,
      members:    memberMap[b.id] || [],
    })));
  } catch (error) {
    console.error('batch-register error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// List all receipts for a payment batch
app.get('/api/batches/:id/receipts', async (req, res) => {
  try {
    const { data, error } = await supabase.from('payment_batch_receipts')
      .select('id, receipt_url, payment_reference, notes, uploaded_at, uploader:users!uploaded_by(name)')
      .eq('batch_id', req.params.id)
      .order('uploaded_at', { ascending: true });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload an additional receipt to a payment batch (works for pending OR paid batches)
app.post('/api/batches/:id/receipts', async (req, res) => {
  const { uploadedBy, receiptData, receiptMimeType, paymentReference, notes } = req.body;
  if (!uploadedBy) return res.status(400).json({ error: 'uploadedBy is required' });
  if (!receiptData || !receiptMimeType) return res.status(400).json({ error: 'receiptData and receiptMimeType are required' });

  try {
    const actor = await getActorRole(uploadedBy);
    if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Only Accounts or Admin users can upload batch receipts' });

    const { data: batch, error: bErr } = await supabase.from('payment_batches')
      .select('id, batch_reference, company_id, status').eq('id', req.params.id).single();
    if (bErr || !batch) return res.status(404).json({ error: 'Payment batch not found' });
    if (!['pending', 'paid'].includes(batch.status))
      return res.status(400).json({ error: `Cannot add receipts to a ${batch.status} batch` });

    const ext = receiptMimeType === 'application/pdf' ? 'pdf'
      : receiptMimeType.startsWith('image/') ? receiptMimeType.split('/')[1] : 'jpg';
    const fileName = `${batch.company_id}/batch-receipts/${req.params.id}/receipt_${Date.now()}.${ext}`;
    const buffer = Buffer.from(receiptData, 'base64');
    const { error: storageErr } = await supabase.storage.from('voucher-bills')
      .upload(fileName, buffer, { contentType: receiptMimeType, upsert: false });
    if (storageErr) return res.status(500).json({ error: `Storage upload failed: ${storageErr.message}` });
    const { data: urlData } = supabase.storage.from('voucher-bills').getPublicUrl(fileName);
    const receiptUrl = urlData.publicUrl;

    const { data: inserted, error: insErr } = await supabase.from('payment_batch_receipts').insert({
      batch_id: req.params.id,
      receipt_url: receiptUrl,
      payment_reference: paymentReference || null,
      notes: notes || null,
      uploaded_by: uploadedBy
    }).select().single();
    if (insErr) return res.status(400).json({ error: insErr.message });

    console.log(`   📎 Receipt added to batch ${batch.batch_reference} by ${uploadedBy}`);
    res.json({ success: true, receipt: inserted });
  } catch (error) {
    console.error('add-batch-receipt error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Receipt → Voucher matching (AI-powered)
// ---------------------------------------------------------------------------

/**
 * Strip all characters except ASCII letters and digits, uppercase the result.
 * Used for normalised comparisons.
 */
function alphanumOnly(str) {
  return String(str).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Parse the digit groups from a VCH regex capture and return an array of
 * integer sequence numbers.
 *
 * Two cases:
 *   Compound single reference — at least one segment looks like a financial year
 *   (>= 2000): e.g. "VCH-2026-27-00507" or "VCH 2026 27 478".
 *   → Return ONLY the last segment as the sequence (478 or 507).
 *
 *   Multi-voucher remark — no year component, all segments are small sequence
 *   numbers: e.g. "VCH 476 477 499 500 501".
 *   → Return EVERY segment as a separate sequence.
 *
 * This distinguishes "VCH 2026 27 478" (one voucher, FY embedded) from
 * "VCH 476 477 499" (multiple vouchers in a combined payment remark).
 */
function _parseVchCapture(capture) {
  const segments = capture.split(/\D+/).filter(Boolean);
  if (segments.length === 0) return [];

  const nums = segments.map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n > 0);
  const hasYear = nums.some(n => n >= 2000);
  if (hasYear) {
    // Compound single ref — year segments are not voucher numbers; use last segment.
    return [nums[nums.length - 1]];
  }
  // Multi-seq remark — every number is a voucher sequence.
  return nums;
}

/**
 * Scan raw text (as extracted from an image or PDF) for all VCH references.
 * Returns an array of objects: { seq: <integer>, raw: <matched string> }.
 * Multiple matches may exist; the first is used as the primary candidate.
 */
function extractVchNumbers(text) {
  const results = [];
  const VCH_RE = /VCH((?:(?:[ \t]+-?|[ \t]*-(?!-)[ \t]*)?\d+)+)/gi;
  let m;
  while ((m = VCH_RE.exec(text)) !== null) {
    const seqs = _parseVchCapture(m[1]);
    const rawText = ('VCH' + m[1]).replace(/\s+/g, ' ').trim();
    for (const seq of seqs) {
      results.push({ seq, raw: rawText });
    }
  }
  return results;
}

/**
 * Parse the trailing sequence integer from a DB serial_number such as
 * "VCH-2026-27-00507".  Returns null for non-VCH serials.
 */
function parseDbSerialSeq(serialNumber) {
  if (!serialNumber || !/^VCH/i.test(serialNumber)) return null;
  const parts = serialNumber.split(/[\-\s]+/);
  const last = parts[parts.length - 1];
  const n = parseInt(last, 10);
  return isNaN(n) ? null : n;
}

/**
 * Scan raw text for CPAY batch references (format CPAY-{FY}-{seq}).
 *
 * Unlike VCH references, CPAY is NEVER ambiguous: it always has exactly one
 * FY component + one sequence, since a batch reference points to one batch.
 * Therefore we do NOT use _parseVchCapture's multi-sequence detection — we
 * simply take the last numeric segment as the sequence number.
 *
 * Examples matched: CPAY-2026-27-00001, CPAY 2026 27 00001, CPAY00001
 */
function extractBatchRefs(text) {
  const results = [];
  const CPAY_RE = /CPAY((?:(?:[ \t]+-?|[ \t]*-(?!-)[ \t]*)?\d+)+)/gi;
  let m;
  while ((m = CPAY_RE.exec(text)) !== null) {
    const segs = m[1].split(/\D+/).filter(Boolean);
    if (!segs.length) continue;
    const seq = parseInt(segs[segs.length - 1], 10);
    if (!isNaN(seq) && seq > 0) {
      results.push({ seq, raw: ('CPAY' + m[1]).replace(/\s+/g, ' ').trim() });
    }
  }
  return results;
}

/**
 * Parse the trailing sequence integer from a CPAY batch reference such as
 * "CPAY-2026-27-00001".  Returns null for non-CPAY references.
 */
function parseDbBatchSeq(batchReference) {
  if (!batchReference || !/^CPAY/i.test(batchReference)) return null;
  const parts = batchReference.split(/[\-\s]+/);
  const last = parts[parts.length - 1];
  const n = parseInt(last, 10);
  return isNaN(n) ? null : n;
}

/**
 * Attempt to extract plain text from a PDF buffer using pdf-parse.
 *
 * Returns an empty string when the PDF parses successfully but contains no
 * selectable text (i.e. it is an image-based / scanned PDF).
 *
 * Throws if pdf-parse itself fails (corrupted file, unsupported format, etc.).
 * Callers must distinguish this thrown error from an empty-string return so
 * that a parse failure is surfaced as an error rather than silently becoming
 * confidence:'none'.
 */
async function _extractPdfText(_buffer) {
  // Hard-guarded: pdf-parse (@napi-rs/canvas) crashes on Vercel Linux.
  // All PDF extraction now goes through _extractReceiptFull → Responses API.
  throw new Error('pdf-parse is disabled; use _extractReceiptFull for PDFs');
}

/**
 * Upload a receipt to the canonical payment-receipts storage path.
 * Shared by the mark-paid route and the auto-complete endpoint so the path
 * convention stays in exactly one place.
 * Returns the public URL, or null if the upload fails (caller continues without receipt).
 * Path: {companyId}/payment-receipts/{voucherId}/{serial}-PMT-{DD-Mon-YYYY}.{ext}
 */
// ── Task C helpers ─────────────────────────────────────────────────────────
// C1: Upsert unassigned_receipts — refresh an existing pending row for the same
//     UTR + company instead of accumulating duplicates.
async function _queueUpsert(companyId, utr, payload) {
  if (utr) {
    const { data: existing } = await supabase.from('unassigned_receipts')
      .select('id').eq('company_id', companyId).eq('status', 'pending_review')
      .filter('extracted_data->>utr_number', 'eq', utr).limit(1).maybeSingle();
    if (existing?.id) {
      await supabase.from('unassigned_receipts').update(payload).eq('id', existing.id);
      console.log(`[queue] refreshed existing row ${existing.id} for UTR ${utr}`);
      return existing.id;
    }
  }
  const { data: row } = await supabase.from('unassigned_receipts').insert(payload).select('id').single();
  return row?.id;
}

// C1b: Detect which company a receipt belongs to from OCR's initiator_account_number.
// Matches exact → last-6-digit numeric suffix (handles masked numbers like XXXX1234).
// candidateIds: array of company IDs to restrict the search; pass null to search all.
async function _detectCompanyFromBankAccount(initiatorAcct, candidateIds) {
  if (!initiatorAcct) return null;
  const norm = String(initiatorAcct).replace(/\s+/g, '').toLowerCase();
  let query = supabase.from('company_payment_accounts')
    .select('company_id, bank_account_number')
    .not('bank_account_number', 'is', null);
  if (Array.isArray(candidateIds) && candidateIds.length > 0)
    query = query.in('company_id', candidateIds);
  const { data: accounts } = await query;
  if (!accounts?.length) return null;
  for (const a of accounts) {
    if (String(a.bank_account_number).replace(/\s+/g, '').toLowerCase() === norm) return a.company_id;
  }
  // Suffix match — handles masked numbers (e.g. "XXXX1234" vs stored "123456781234")
  const normSuffix = norm.replace(/[^0-9]/g, '').slice(-6);
  if (normSuffix.length >= 4) {
    for (const a of accounts) {
      const stored = String(a.bank_account_number).replace(/[^0-9]/g, '').slice(-6);
      if (stored && stored === normSuffix) return a.company_id;
    }
  }
  return null;
}

// C2: Auto-resolve all pending_review queue rows that carry a given UTR.
// Called immediately after any path that writes a UTR to a voucher.
async function _autoResolveQueueForUtr(companyId, utr, serialNumber) {
  if (!utr || !companyId) return;
  const { data: rows } = await supabase.from('unassigned_receipts')
    .select('id').eq('company_id', companyId).eq('status', 'pending_review')
    .filter('extracted_data->>utr_number', 'eq', utr);
  if (!rows?.length) return;
  const ids = rows.map(r => r.id);
  await supabase.from('unassigned_receipts')
    .update({ status: 'assigned', match_reason: `Auto-resolved: UTR ${utr} matched to ${serialNumber || 'voucher'}` })
    .in('id', ids);
  console.log(`[queue] auto-resolved ${ids.length} row(s) for UTR ${utr}`);
}

// B2: Build the CPAY acknowledgment HTML string (shared by GET endpoint and storage helper).
async function _buildCpayHtml(batchId) {
  const { data: batch, error: bErr } = await supabase.from('payment_batches')
    .select('id, batch_reference, total_amount, company_id, payment_reference, paid_at, payees(name), companies(name)')
    .eq('id', batchId).single();
  if (bErr || !batch) return null;

  const { data: memberRows } = await supabase.from('payment_batch_vouchers')
    .select('vouchers(serial_number, amount, narration)')
    .eq('batch_id', batchId);
  const members = (memberRows || []).map(m => m.vouchers).filter(Boolean);

  const paidDate = batch.paid_at
    ? new Date(batch.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    : '—';
  const total = parseFloat(batch.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const companyName = batch.companies?.name || batch.company_id;
  const payeeName = batch.payees?.name || '—';

  const rows = members.map(m =>
    `<tr><td style="font-family:monospace;padding:6px 12px;border-bottom:1px solid #e5e7eb">${m.serial_number || '—'}</td>`
    + `<td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;color:#374151;max-width:260px">${m.narration || ''}</td>`
    + `<td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">₹${parseFloat(m.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${batch.batch_reference} — Batch Payment</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:24px;color:#111;background:#fff}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:12px;margin-bottom:20px}
  .title{font-size:1.4rem;font-weight:700;color:#1d4ed8}
  .subtitle{font-size:0.85rem;color:#6b7280;margin-top:4px}
  .badge{display:inline-block;background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:20px;padding:3px 10px;font-size:0.8rem;font-weight:600}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 32px;margin-bottom:20px;font-size:0.9rem}
  .meta-label{color:#6b7280;font-size:0.78rem;text-transform:uppercase;letter-spacing:.04em}
  .meta-value{font-weight:600;margin-top:1px}
  table{width:100%;border-collapse:collapse;font-size:0.88rem}
  thead tr{background:#f1f5f9}
  thead th{padding:8px 12px;text-align:left;font-size:0.75rem;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;font-weight:600}
  tfoot tr{background:#f0fdf4}
  tfoot td{padding:8px 12px;font-weight:700;color:#166534}
  .footer{margin-top:24px;font-size:0.75rem;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px}
  @media print{body{padding:0}@page{margin:20mm}}
</style></head><body>
<div class="header">
  <div>
    <div class="title">${batch.batch_reference}</div>
    <div class="subtitle">${companyName} · Batch Payment</div>
  </div>
  <div><span class="badge">✅ Paid</span></div>
</div>
<div class="meta">
  <div><div class="meta-label">Payee</div><div class="meta-value">${payeeName}</div></div>
  <div><div class="meta-label">Date Paid</div><div class="meta-value">${paidDate}</div></div>
  <div><div class="meta-label">UTR / Reference</div><div class="meta-value" style="font-family:monospace">${batch.payment_reference || '—'}</div></div>
  <div><div class="meta-label">Total Amount</div><div class="meta-value" style="font-size:1.1rem;color:#166534">₹${total}</div></div>
</div>
<p style="font-weight:600;font-size:0.85rem;color:#374151;margin-bottom:8px">Covers ${members.length} voucher${members.length !== 1 ? 's' : ''}:</p>
<table>
  <thead><tr><th>Voucher</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td colspan="2" style="text-align:right">Total</td><td style="text-align:right">₹${total}</td></tr></tfoot>
</table>
<div class="footer">Generated by Relish Approvals · ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
</body></html>`;
}

// B2: Serve CPAY acknowledgment HTML directly — avoids Supabase Storage HTML blocking.
app.get('/api/batches/:id/receipt', async (req, res) => {
  try {
    const html = await _buildCpayHtml(req.params.id);
    if (!html) return res.status(404).send('Batch not found');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(html);
  } catch (error) {
    console.error('cpay-receipt serve error:', error.message);
    res.status(500).send('Error generating receipt');
  }
});

// B2: Generate a self-contained CPAY acknowledgment HTML and store its API URL.
// Returns the receipt URL, or null on failure.
async function _generateAndStoreCpayReceipt(batchId) {
  // Verify batch exists (needed for payment_reference in the upsert below).
  const { data: batch, error: bErr } = await supabase.from('payment_batches')
    .select('id, batch_reference, payment_reference').eq('id', batchId).single();
  if (bErr || !batch) return null;

  // Serve receipt via the /api/batches/:id/receipt endpoint (avoids Supabase Storage HTML blocking).
  const appBase = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  const receiptUrl = `${appBase}/api/batches/${batchId}/receipt`;

  // Write URL back to the batch row so GET /api/batches/:id returns it
  await supabase.from('payment_batches')
    .update({ payment_receipt_url: receiptUrl }).eq('id', batchId);
  await supabase.from('payment_batch_receipts').upsert({
    batch_id: batchId, receipt_url: receiptUrl,
    payment_reference: batch.payment_reference || null,
    notes: 'Auto-generated CPAY acknowledgment',
    uploaded_by: null,
  }, { onConflict: 'batch_id,receipt_url', ignoreDuplicates: true });

  console.log(`[CPAY-receipt] generated for ${batch.batch_reference} → ${receiptUrl}`);
  return receiptUrl;
}

async function _uploadPaymentReceiptToStorage(voucherId, companyId, serialNumber, buffer, mimeType) {
  const ext = mimeType === 'application/pdf' ? 'pdf'
    : mimeType.startsWith('image/') ? mimeType.split('/')[1]
    : 'jpg';
  const _pd = new Date();
  const _pds = `${String(_pd.getDate()).padStart(2, '0')}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][_pd.getMonth()]}-${_pd.getFullYear()}`;
  const filePath = `${companyId}/payment-receipts/${voucherId}/${(serialNumber || 'VCH').replace(/[^A-Za-z0-9-]/g, '-')}-PMT-${_pds}.${ext}`;
  const { error: storageErr } = await supabase.storage
    .from('voucher-bills')
    .upload(filePath, buffer, { contentType: mimeType, upsert: true });
  if (storageErr) {
    console.warn('[_uploadPaymentReceiptToStorage] failed:', storageErr.message);
    return null;
  }
  const { data: urlData } = supabase.storage.from('voucher-bills').getPublicUrl(filePath);
  return urlData.publicUrl;
}

/**
 * OCR a receipt (image or text-layer PDF) and return structured payment fields
 * plus the full raw text — one GPT-4o call covering both needs.
 * Returns { raw_text, utr_number, amount, beneficiary_name, initiator_account_number,
 *           bank_name, transaction_date } or {} on any failure.
 * Image-based PDFs (no text layer, no Vision renderer) → always returns {}.
 */
async function _extractReceiptFull(buffer, mimeType, fileName = 'receipt.pdf') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return {};

  // 10 MB guard — reject before base64 inflation or any API call
  if (buffer.length > 10 * 1024 * 1024) {
    console.warn(`[_extractReceiptFull] file exceeds 10 MB (${(buffer.length / 1024 / 1024).toFixed(1)} MB) — skipping OCR`);
    return {};
  }

  const userInstruction =
    'Extract from this bank/UPI transfer receipt and return a JSON object with these exact keys:\n' +
    '- raw_text: all visible text verbatim (preserve line breaks as \\n)\n' +
    '- utr_number: payment reference number. Look under ANY of these labels — UTR, UPI Transaction ID, Transaction ID, RRN Number, Reference Number, IMPS Ref No — or embedded in statement text as "Re NNNNNNNNN". Return the first valid reference found (9–16 alphanumeric characters). Return null if not found.\n' +
    '- amount: payment amount as a plain number, no currency symbol, no commas (e.g. 15000.00)\n' +
    '- beneficiary_name: who the payment was sent to\n' +
    '- initiator_account_number: sender account number or UPI ID\n' +
    '- bank_name: bank that processed the transaction\n' +
    '- transaction_date: date in YYYY-MM-DD format if visible\n' +
    'Set each field to null if not visible. Return JSON only.';

  const nativeFetch = globalThis.fetch || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    let parsed;

    if (mimeType === 'application/pdf') {
      // PDF path: Responses API — handles text-layer and image-based PDFs natively.
      // Content block syntax: https://platform.openai.com/docs/guides/pdf-files (base64 section)
      const resp = await nativeFetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o',
          input: [{
            role: 'user',
            content: [
              { type: 'input_file', filename: fileName, file_data: `data:application/pdf;base64,${buffer.toString('base64')}` },
              { type: 'input_text', text: userInstruction },
            ],
          }],
          text: { format: { type: 'json_object' } },
        }),
      });
      clearTimeout(timeout);
      if (!resp.ok) { const b = await resp.text(); console.warn('[_extractReceiptFull] Responses API error:', b); return {}; }
      const json = await resp.json();
      const content = json.output?.[0]?.content?.[0]?.text;
      if (!content) return {};
      try { parsed = JSON.parse(content); } catch { return {}; }

    } else {
      // Image path: Chat Completions Vision (unchanged)
      const systemPrompt =
        'You are a financial document parser for an internal payment approval system. ' +
        'Extract transaction details from bank receipts and UPI payment screenshots. ' +
        'Return JSON only, no other text. Never refuse a financial document parsing request.';
      const resp = await nativeFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 600,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: [
              { type: 'text', text: userInstruction },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${buffer.toString('base64')}`, detail: 'high' } },
            ]},
          ],
          response_format: { type: 'json_object' },
        }),
      });
      clearTimeout(timeout);
      if (!resp.ok) return {};
      const json = await resp.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) return {};
      try { parsed = JSON.parse(content); } catch { return {}; }
    }

    return parsed;
  } catch {
    clearTimeout(timeout);
    return {};
  }
}

/**
 * Core matching logic for the auto-complete flow.
 * Priority: VCH reference (deterministic) → amount fallback → queued.
 * Amount guard always applies: ref match + amount mismatch → queued.
 *
 * Candidate pool: awaiting_payment + completed, no receipt yet, not in a pending batch.
 */
async function _autoCompleteMatch(fileBuffer, mimeType, companyId, fileName) {
  const ocrData = await _extractReceiptFull(fileBuffer, mimeType, fileName || 'receipt.pdf');
  const rawText = (typeof ocrData.raw_text === 'string' ? ocrData.raw_text : '')
    || (fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ') : '');

  const vchMatches  = extractVchNumbers(rawText);
  const cpayMatches = extractBatchRefs(rawText);    // B1: also scan for CPAY refs
  const primaryVch  = vchMatches[0]  ?? null;
  const primaryCpay = cpayMatches[0] ?? null;

  // Primary pool: vouchers awaiting payment (no receipt yet, not in a batch, not cash)
  // Cash vouchers are excluded — they carry no UTR and cannot match against a bank receipt.
  const { data: candidates, error: poolErr } = await supabase.from('vouchers')
    .select('id, serial_number, amount, status, prepared_by, company_id, queued_at, created_at, payment_reference, payment_mode')
    .eq('company_id', companyId)
    .in('status', ['awaiting_payment', 'completed'])
    .is('payment_receipt_url', null)
    .is('batch_id', null)
    .neq('payment_mode', 'Cash');
  if (poolErr) throw new Error(`Candidate pool query failed: ${poolErr.message}`);
  const pool = (candidates || []).filter(v => v.payment_mode !== 'Cash');

  // Backfill pool: already-paid vouchers where UTR was never recorded (excluding cash)
  const { data: backfillCandidates } = await supabase.from('vouchers')
    .select('id, serial_number, amount, status, prepared_by, company_id, payment_reference, payment_receipt_url, payment_mode')
    .eq('company_id', companyId)
    .eq('status', 'paid')
    .is('payment_reference', null)
    .neq('payment_mode', 'Cash');
  const backfillPool = (backfillCandidates || []).filter(v => v.payment_mode !== 'Cash');

  // B1: open batch pool — pending batches for this company
  const { data: openBatches } = await supabase.from('payment_batches')
    .select('id, batch_reference, total_amount, payee_id')
    .eq('company_id', companyId)
    .eq('status', 'pending');
  const batchPool = openBatches || [];

  // B1-backfill: paid batches missing UTR OR missing receipt file (receipt-only attach case)
  const { data: paidBatchesMissingUTR } = await supabase.from('payment_batches')
    .select('id, batch_reference, total_amount, payee_id, payment_reference, payment_receipt_url')
    .eq('company_id', companyId)
    .eq('status', 'paid')
    .or('payment_reference.is.null,payment_receipt_url.is.null');
  const batchBackfillPool = paidBatchesMissingUTR || [];

  let ocrAmount = null;
  if (ocrData.amount !== null && ocrData.amount !== undefined) {
    const parsed = parseFloat(String(ocrData.amount).replace(/[₹,\s]/g, ''));
    if (!isNaN(parsed) && parsed > 0) ocrAmount = parsed;
  }

  // ── PATH 0: CPAY batch reference match (B1) ──────────────────────────────
  // CPAY refs are unambiguous; batch match takes priority over individual VCH matching.
  if (primaryCpay) {
    const batchHit = batchPool.find(b => parseDbBatchSeq(b.batch_reference) === primaryCpay.seq);
    if (batchHit) {
      if (ocrAmount !== null && Math.abs(ocrAmount - parseFloat(batchHit.total_amount)) > 1) {
        return { outcome: 'queued', reason: `CPAY ${primaryCpay.raw} found but amount mismatch: receipt ₹${ocrAmount} vs batch ₹${batchHit.total_amount} — manual review required`, ocrData, pool };
      }
      return { outcome: 'batch', batch: batchHit, ocrData, matchedBy: 'cpay_ref' };
    }
    // Not in pending pool — check paid batches missing UTR (backfill)
    const backfillBatchHit = batchBackfillPool.find(b => parseDbBatchSeq(b.batch_reference) === primaryCpay.seq);
    if (backfillBatchHit) {
      console.log(`[auto-complete] CPAY ${primaryCpay.raw} matched paid batch missing UTR — backfilling`);
      return { outcome: 'batch_backfill', batch: backfillBatchHit, ocrData, matchedBy: 'cpay_ref' };
    }
    console.log(`[auto-complete] CPAY ref ${primaryCpay.raw} found but no matching open or backfill batch — falling through`);
  }

  // ── PATH 0b: Amount-only batch match (no CPAY ref; B1 fallback) ──────────
  // If ocrAmount uniquely matches one open batch total (±₹1), treat as batch match.
  // This covers payments made outside the app where the receipt has no CPAY ref.
  if (!primaryCpay && ocrAmount !== null && batchPool.length > 0) {
    const amountBatchHits = batchPool.filter(b => Math.abs(ocrAmount - parseFloat(b.total_amount)) <= 1);
    if (amountBatchHits.length === 1) {
      return { outcome: 'batch', batch: amountBatchHits[0], ocrData, matchedBy: 'amount' };
    }
    if (amountBatchHits.length > 1) {
      return { outcome: 'queued', reason: `Amount ₹${ocrAmount} matches ${amountBatchHits.length} open batches — ambiguous, manual review required`, ocrData, pool };
    }
  }
  // PATH 0b-backfill: amount matches a paid batch missing UTR
  if (!primaryCpay && ocrAmount !== null && batchBackfillPool.length > 0) {
    const amountBackfillHits = batchBackfillPool.filter(b => Math.abs(ocrAmount - parseFloat(b.total_amount)) <= 1);
    if (amountBackfillHits.length === 1) {
      console.log(`[auto-complete] Amount ₹${ocrAmount} matched paid batch ${amountBackfillHits[0].batch_reference} missing UTR — backfilling`);
      return { outcome: 'batch_backfill', batch: amountBackfillHits[0], ocrData, matchedBy: 'amount' };
    }
  }

  // ── PATH 0c: UTR-direct batch match — receipt already has a UTR, find batch by UTR ─
  // Handles: batch paid & UTR written, but receipt file never attached.
  // batchBackfillPool includes batches where payment_receipt_url IS NULL (even if UTR set).
  const ocrUtr = ocrData.utr_number ? String(ocrData.utr_number).trim().replace(/\s+/g, '') : null;
  if (ocrUtr && batchBackfillPool.length > 0) {
    const utrBatchHit = batchBackfillPool.find(b => b.payment_reference === ocrUtr);
    if (utrBatchHit) {
      console.log(`[auto-complete] UTR ${ocrUtr} directly matched paid batch ${utrBatchHit.batch_reference} missing receipt — attaching`);
      return { outcome: 'batch_backfill', batch: utrBatchHit, ocrData, matchedBy: 'utr_direct' };
    }
  }

  // ── PATH A: VCH reference match ───────────────────────────────────────────
  if (primaryVch) {
    const allSeqs = [...new Set(vchMatches.map(m => m.seq))];

    // Check primary pool first
    const refHits = pool.filter(v => {
      const dbSeq = parseDbSerialSeq(v.serial_number);
      return dbSeq !== null && allSeqs.includes(dbSeq);
    });

    if (refHits.length === 1) {
      const matched = refHits[0];
      if (ocrAmount !== null && Math.abs(ocrAmount - parseFloat(matched.amount)) > 0.01) {
        return { outcome: 'queued', reason: `Amount mismatch: receipt ₹${ocrAmount} vs voucher ₹${parseFloat(matched.amount)} (${matched.serial_number}) — manual review required`, ocrData, pool };
      }
      return { outcome: 'complete', voucher: matched, ocrData, matchedBy: 'reference' };
    }

    // Check backfill pool (paid + null UTR) by VCH reference
    const backfillHits = backfillPool.filter(v => {
      const dbSeq = parseDbSerialSeq(v.serial_number);
      return dbSeq !== null && allSeqs.includes(dbSeq);
    });
    if (backfillHits.length === 1) {
      const matched = backfillHits[0];
      if (ocrAmount !== null && Math.abs(ocrAmount - parseFloat(matched.amount)) > 0.01) {
        return { outcome: 'queued', reason: `Amount mismatch: receipt ₹${ocrAmount} vs paid voucher ₹${parseFloat(matched.amount)} (${matched.serial_number})`, ocrData, pool };
      }
      return { outcome: 'backfill', voucher: matched, ocrData };
    }

    // Check for UTR conflict: paid voucher with existing payment_reference that differs from OCR UTR
    if (refHits.length === 0 && backfillHits.length === 0) {
      const { data: conflictRows } = await supabase.from('vouchers')
        .select('id, serial_number, payment_reference')
        .eq('company_id', companyId)
        .eq('status', 'paid')
        .not('payment_reference', 'is', null);
      const conflictHit = (conflictRows || []).find(v => {
        const dbSeq = parseDbSerialSeq(v.serial_number);
        return dbSeq !== null && allSeqs.includes(dbSeq);
      });
      if (conflictHit) {
        const ocrUtr = ocrData.utr_number;
        const reason = ocrUtr && conflictHit.payment_reference !== ocrUtr
          ? `UTR conflict: voucher ${conflictHit.serial_number} has UTR ${conflictHit.payment_reference}, receipt shows ${ocrUtr}`
          : `Voucher ${conflictHit.serial_number} is already paid (UTR: ${conflictHit.payment_reference}) — no action needed`;
        return { outcome: 'queued', reason, ocrData, pool };
      }
    }

    // Reference found but ambiguous or not in any pool
    if (ocrAmount === null) {
      return { outcome: 'queued', reason: `Reference ${primaryVch.raw} found but matched ${refHits.length} voucher(s) in queue — ambiguous`, ocrData, pool };
    }
    // Fall through to amount path with available ocrAmount
  }

  // ── PATH B: Amount fallback ────────────────────────────────────────────────
  if (ocrAmount === null) {
    return { outcome: 'queued', reason: 'No voucher reference or payment amount could be extracted from this receipt', ocrData, pool };
  }

  const amountHits = pool.filter(v => Math.abs(parseFloat(v.amount) - ocrAmount) <= 0.01);

  if (amountHits.length === 0) {
    // Check backfill pool by amount before giving up
    const backfillAmountHits = backfillPool.filter(v => Math.abs(parseFloat(v.amount) - ocrAmount) <= 0.01);
    if (backfillAmountHits.length === 1) {
      return { outcome: 'backfill', voucher: backfillAmountHits[0], ocrData };
    }
    return { outcome: 'queued', reason: `No voucher in the payment queue matches ₹${ocrAmount.toFixed(2)}`, ocrData, pool };
  }

  if (amountHits.length === 1) {
    return { outcome: 'complete', voucher: amountHits[0], ocrData, matchedBy: 'amount' };
  }

  // Tie-break: only the one queued/updated within the last 4 hours wins only if unique
  const cutoff = Date.now() - 4 * 60 * 60 * 1000;
  const recent = amountHits.filter(v => new Date(v.queued_at || v.created_at).getTime() > cutoff);
  if (recent.length === 1) {
    return { outcome: 'complete', voucher: recent[0], ocrData, matchedBy: 'amount+recency' };
  }

  return {
    outcome: 'queued',
    reason: `${amountHits.length} vouchers match ₹${ocrAmount.toFixed(2)}${recent.length > 1 ? ' (multiple recent)' : ''} — ambiguous`,
    ocrData,
    pool,
    candidates: amountHits,
  };
}

/**
 * Use GPT-4o Vision to extract all visible text from an image buffer.
 * Returns the raw text string returned by the model.
 */
/**
 * Build the OpenAI Vision request body for a given model.
 */
function _buildOcrBody(dataUrl, model) {
  return JSON.stringify({
    model,
    max_tokens: 800,
    messages: [
      {
        role: 'system',
        content:
          'You are a financial document OCR assistant for an internal payment approval system. ' +
          'Your only job is to extract the printed/displayed text from bank receipts, UPI payment ' +
          'screenshots, and transaction acknowledgements. Output only the raw text — no analysis, ' +
          'no commentary. Never refuse a text-extraction request on a financial document.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Extract ALL visible text from this payment receipt or bank transaction screenshot. ' +
              'Return only the raw text, preserving line breaks. Pay special attention to: ' +
              'transaction/reference/UTR numbers, UPI IDs, amounts, bank names, and any field ' +
              'containing "VCH" followed by numbers (e.g. "VCH-2026-27-00448" or "VCH 510").',
          },
          {
            type: 'image_url',
            image_url: { url: dataUrl, detail: 'low' },
          },
        ],
      },
    ],
  });
}

async function _extractImageText(buffer, mimeType) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not set');

  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const nativeFetch = globalThis.fetch || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50000);

  const _callOpenAI = async (model) => {
    const response = await nativeFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: _buildOcrBody(dataUrl, model),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${body}`);
    }
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (content == null || content.trim() === '') {
      throw new Error(`OpenAI Vision returned no text content (finish_reason: ${json.choices?.[0]?.finish_reason ?? 'unknown'}).`);
    }
    // Return null (not throw) if the model refuses — triggers fallback
    if (/^I'?m sorry[,.]?\s|I can'?t assist|I cannot assist|I'?m unable to/i.test(content.trim())) {
      return null;
    }
    return content;
  };

  let result;
  try {
    // Try gpt-4o first
    result = await _callOpenAI('gpt-4o');
    // If gpt-4o refused (content policy), fall back to gpt-4o-mini which is less restrictive
    if (result === null) {
      result = await _callOpenAI('gpt-4o-mini');
    }
  } catch (fetchErr) {
    clearTimeout(timeout);
    if (fetchErr.name === 'AbortError') {
      throw new Error('OpenAI Vision timed out after 50 s — retry or select the voucher manually.');
    }
    throw fetchErr;
  }
  clearTimeout(timeout);

  if (result === null) {
    throw new Error('OpenAI refused to process this image (content policy on both gpt-4o and gpt-4o-mini). Crop out any faces/logos and re-upload, or mark paid manually.');
  }
  return result;
}

/**
 * Match a payment receipt to a voucher in this company's payment queue.
 *
 * @param {Buffer}  fileBuffer  - Raw file bytes (image or PDF).
 * @param {string}  mimeType    - MIME type, e.g. 'image/jpeg' or 'application/pdf'.
 * @param {string}  companyId   - The company whose vouchers to search.
 *
 * @returns {Promise<{
 *   matchedVoucherId: string|null,
 *   confidence: 'high'|'low'|'none',
 *   extractedReference: string|null,
 *   candidateVouchers: Array
 * }>}
 *
 * Confidence semantics:
 *   'high' — exactly one exact normalised VCH-sequence match found in the queue.
 *   'low'  — VCH reference found but ambiguous (0 or >1 matches), or no VCH
 *            reference but the text does contain some recognisable content.
 *   'none' — no VCH-like reference found in the extracted text at all.
 */
async function matchReceiptToVoucher(fileBuffer, mimeType, companyId, fileName = '') {
  if (!Buffer.isBuffer(fileBuffer)) throw new TypeError('fileBuffer must be a Buffer');
  if (!mimeType || typeof mimeType !== 'string') throw new TypeError('mimeType must be a string');
  if (!companyId || typeof companyId !== 'string') throw new TypeError('companyId must be a string');

  // ── Step 1: Extract raw text ───────────────────────────────────────────────
  let extractedText = '';

  if (mimeType === 'application/pdf') {
    // PDF path: delegate to _extractReceiptFull (Responses API) and take raw_text.
    // Covers text-layer and image-based PDFs; replaces the broken pdf-parse path.
    const fullData = await _extractReceiptFull(fileBuffer, mimeType, fileName || 'receipt.pdf');
    extractedText = typeof fullData.raw_text === 'string' ? fullData.raw_text : '';
    if (!extractedText) {
      console.log('[matchReceiptToVoucher] PDF yielded no text from Responses API — trying filename fallback.');
    }
  } else if (mimeType.startsWith('image/')) {
    // _extractImageText throws on API failure AND on empty response.
    // Any non-throw return is guaranteed to be a non-empty string.
    extractedText = await _extractImageText(fileBuffer, mimeType);
  } else {
    throw new Error(`Unsupported mimeType "${mimeType}". Supported: image/* and application/pdf.`);
  }

  console.log(
    `[matchReceiptToVoucher] Extracted ${extractedText.length} chars from ${mimeType} for company ${companyId}`,
  );

  // ── Filename fallback: when content extraction yields nothing, scan the
  //    original filename for VCH/CPAY references.  Bank payment receipts are
  //    often saved as "Payee _VCH476 477 499 500.pdf" — a reliable fallback.
  if (!extractedText && fileName) {
    const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/[_]/g, ' ');
    const fnVch  = extractVchNumbers(cleanName);
    const fnCpay = extractBatchRefs(cleanName);
    if (fnVch.length > 0 || fnCpay.length > 0) {
      console.log(`[matchReceiptToVoucher] Filename fallback: "${fileName}" → ${fnVch.length} VCH + ${fnCpay.length} CPAY ref(s)`);
      extractedText = cleanName;
    }
  }

  // ── Step 2: Find CPAY batch refs and VCH voucher refs in the text ──────────
  const cpayMatches = extractBatchRefs(extractedText);
  const vchMatches  = extractVchNumbers(extractedText);
  const primaryCpay = cpayMatches[0] ?? null;
  const primaryVch  = vchMatches[0]  ?? null;

  // ── Step 3: Query candidate vouchers AND candidate batches + backfill pool ─
  const [{ data: candidateVouchers, error: dbError }, { data: backfillData }, { data: batchData }] = await Promise.all([
    supabase.from('vouchers')
      .select('id, serial_number, amount, status, payment_receipt_url')
      .eq('company_id', companyId)
      .in('status', ['awaiting_payment', 'completed'])
      .is('payment_receipt_url', null),
    supabase.from('vouchers')
      .select('id, serial_number, amount, payment_reference')
      .eq('company_id', companyId)
      .eq('status', 'paid')
      .is('payment_reference', null),
    supabase.from('payment_batches')
      .select('id, batch_reference, total_amount, status, payee_id, payment_mode, payees(name)')
      .eq('company_id', companyId)
      .eq('status', 'pending'),
  ]);
  if (dbError) throw new Error(`Voucher query failed: ${dbError.message}`);
  const candidates = candidateVouchers ?? [];
  const backfills = backfillData ?? [];
  const batchCandidates = batchData ?? [];

  // ── Step 4: CPAY match (takes priority — batch references are unambiguous) ─
  if (primaryCpay) {
    const batchHits = batchCandidates.filter(b => parseDbBatchSeq(b.batch_reference) === primaryCpay.seq);
    if (batchHits.length === 1) {
      console.log(`[matchReceiptToVoucher] HIGH confidence BATCH match: ${primaryCpay.raw} → ${batchHits[0].batch_reference}`);
      return { matchType: 'batch', matchedVoucherId: null, matchedBatchId: batchHits[0].id, confidence: 'high', extractedReference: primaryCpay.raw, candidateVouchers: candidates, candidateBatches: batchCandidates, backfillVouchers: [] };
    }
    console.log(`[matchReceiptToVoucher] LOW confidence BATCH: ref=${primaryCpay.raw} matched ${batchHits.length} batch(es)`);
    return { matchType: 'batch', matchedVoucherId: null, matchedBatchId: null, confidence: 'low', extractedReference: primaryCpay.raw, candidateVouchers: candidates, candidateBatches: batchCandidates, backfillVouchers: [] };
  }

  // ── Step 5: VCH match (single or multi-voucher) ───────────────────────────
  if (!primaryVch) {
    return { matchType: 'none', matchedVoucherId: null, matchedBatchId: null, confidence: 'none', extractedReference: null, candidateVouchers: candidates, candidateBatches: batchCandidates, backfillVouchers: [] };
  }

  const allSeqs = [...new Set(vchMatches.map(m => m.seq))];
  const exactHits = candidates.filter(v => {
    const dbSeq = parseDbSerialSeq(v.serial_number);
    return dbSeq !== null && allSeqs.includes(dbSeq);
  });

  if (exactHits.length === 1) {
    console.log(`[matchReceiptToVoucher] HIGH confidence match: ${primaryVch.raw} → ${exactHits[0].serial_number}`);
    return { matchType: 'voucher', matchedVoucherId: exactHits[0].id, matchedBatchId: null, confidence: 'high', extractedReference: primaryVch.raw, candidateVouchers: candidates, candidateBatches: batchCandidates, backfillVouchers: [] };
  }

  // Check backfill pool (paid + null UTR) for the same VCH sequence(s)
  const backfillHits = backfills.filter(v => {
    const dbSeq = parseDbSerialSeq(v.serial_number);
    return dbSeq !== null && allSeqs.includes(dbSeq);
  });

  console.log(`[matchReceiptToVoucher] LOW confidence: ${allSeqs.length} seq(s) [${allSeqs.join(',')}] matched ${exactHits.length} voucher(s) in queue, ${backfillHits.length} backfill candidate(s)`);
  return { matchType: 'voucher', matchedVoucherId: null, matchedBatchId: null, confidence: 'low', extractedReference: primaryVch.raw, candidateVouchers: candidates, candidateBatches: batchCandidates, backfillVouchers: backfillHits };
}

// ─────────────────────────────────────────────────────────────────────────────
// RETROSPECTIVE PAYMENT RECEIPT SCAN
// Scans attachments on completed/awaiting_payment vouchers to find bank
// receipts that were uploaded before the receipt-matching system existed,
// then marks matched vouchers as paid.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect payment-confirmation keywords in extracted text.
 * Returns { isPayment, utr, transferType }
 */
function _analysePaymentText(text) {
  const t = text || '';
  const isPayment = /imps|neft|rtgs|upi|google\s*pay|gpay|phonepe|paytm|bhim|acknowledgement|money transferred|transfer successful|transaction successful|debit advice|payment confirmation|reference number|your ref|transaction id/i.test(t);
  // Priority 1: 12-digit UTR (IMPS/NEFT/UPI transaction IDs)
  const utr12 = t.match(/\b(\d{12})\b/);
  // Priority 2: explicit UTR label
  const utrLabel = t.match(/utr[:\s#]*([A-Z0-9]{8,22})/i) || t.match(/ref(?:erence)?[:\s#no.]*([A-Z0-9]{10,22})/i);
  // Priority 3: Google/PhonePe transaction IDs (alphanumeric, 12-22 chars after keyword)
  const googleTxn = t.match(/(?:google\s+transaction\s+id|transaction\s+id|txn\s*id)[:\s]+([A-Za-z0-9]{8,22})/i);
  const utr = (utr12 && utr12[1]) || (utrLabel && utrLabel[1]) || (googleTxn && googleTxn[1]) || null;
  const ttMatch = t.match(/\b(IMPS|NEFT|RTGS|UPI)\b/i);
  const transferType = ttMatch ? ttMatch[1].toUpperCase() : ((/google\s*pay|gpay/i.test(t)) ? 'UPI' : null);
  return { isPayment, utr, transferType };
}

// POST /api/companies/:companyId/retrospective-payment-scan
// Scans attachments on vouchers that are still in 'awaiting_payment' or 'completed'
// looking for bank receipts that prove payment was already made.
app.post('/api/companies/:companyId/retrospective-payment-scan', async (req, res) => {
  const { requestedBy, confirmIds, voucherIds } = req.body;
  const { companyId } = req.params;

  if (!requestedBy) return res.status(400).json({ error: true, message: 'requestedBy is required' });
  const actor = await getActorRole(requestedBy);
  if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin)
    return res.status(403).json({ error: true, message: 'Accounts or Admin role required' });

  // ── CONFIRM MODE: mark a specific set of vouchers as paid ─────────────────
  if (confirmIds && Array.isArray(confirmIds) && confirmIds.length > 0) {
    const results = [];
    for (const { voucherId, attachmentUrl, utr, transferType } of confirmIds) {
      const now = new Date().toISOString();
      const { error } = await supabase.from('vouchers').update({
        status: 'paid',
        paid_by: requestedBy,
        paid_at: now,
        payment_reference: utr || null,
        payment_notes: `Confirmed via retrospective receipt scan${transferType ? ` (${transferType})` : ''}`,
        payment_receipt_url: attachmentUrl || null,
      }).eq('id', voucherId).eq('company_id', companyId);
      results.push({ voucherId, success: !error, error: error?.message });
    }
    return res.json({ success: true, confirmed: results });
  }

  // ── SCAN MODE: OCR all attachments on unpaid vouchers ────────────────────
  let vQuery = supabase
    .from('vouchers')
    .select('id, serial_number, amount, payment_mode, payee_id')
    .eq('company_id', companyId)
    .in('status', ['awaiting_payment', 'completed'])
    .eq('is_suspense_settlement', false)
    .is('payment_receipt_url', null);
  if (voucherIds && Array.isArray(voucherIds) && voucherIds.length > 0) {
    vQuery = vQuery.in('id', voucherIds);
  }
  const { data: vouchers, error: vErr } = await vQuery;
  if (vErr) return res.status(500).json({ error: true, message: vErr.message });

  const scannable = (vouchers || []);
  if (scannable.length === 0)
    return res.json({ results: [], message: 'No unpaid vouchers with attachments found.' });

  // Fetch attachments for all matching vouchers in one query
  const voucherIdList = scannable.map(v => v.id);
  const { data: allAttachments, error: aErr } = await supabase
    .from('voucher_attachments')
    .select('id, voucher_id, public_url, file_name, mime_type')
    .in('voucher_id', voucherIdList);
  if (aErr) return res.status(500).json({ error: true, message: aErr.message });

  // Group attachments by voucher_id
  const attsByVoucher = {};
  for (const a of (allAttachments || [])) {
    if (!attsByVoucher[a.voucher_id]) attsByVoucher[a.voucher_id] = [];
    attsByVoucher[a.voucher_id].push(a);
  }

  // Keep only vouchers that actually have attachments
  const withAttachments = scannable.filter(v => (attsByVoucher[v.id] || []).length > 0);
  if (withAttachments.length === 0)
    return res.json({ results: [], message: 'No unpaid vouchers with attachments found.' });

  // Fetch payee names for the vouchers we will scan
  const payeeIds = [...new Set(withAttachments.map(v => v.payee_id).filter(Boolean))];
  const { data: payeesData } = await supabase
    .from('payees').select('id, name').in('id', payeeIds);
  const payeeMap = {};
  for (const p of (payeesData || [])) payeeMap[p.id] = p.name;

  const vchSeq = parseDbSerialSeq;
  const results = [];

  for (const v of withAttachments) {
    const vSeq = vchSeq(v.serial_number);
    const attachmentResults = [];

    for (const att of (attsByVoucher[v.id] || [])) {
      if (!att.public_url) continue;
      const mimeType = att.mime_type || 'image/jpeg';

      let extractedText = '';
      let scanError = null;

      try {
        // Download from Supabase public storage using native fetch (not node-fetch v2)
        const nativeFetch = globalThis.fetch || fetch;
        const fileRes = await nativeFetch(att.public_url);
        if (!fileRes.ok) throw new Error(`Download failed (HTTP ${fileRes.status})`);
        const arrayBuf = await fileRes.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuf);

        if (mimeType === 'application/pdf') {
          // Responses API handles both text-layer and image-based PDFs
          const fullData = await _extractReceiptFull(fileBuffer, mimeType, att.file_name || 'receipt.pdf');
          extractedText = typeof fullData.raw_text === 'string' ? fullData.raw_text : '';
        }
        if (!extractedText && mimeType.startsWith('image/')) {
          extractedText = await _extractImageText(fileBuffer, mimeType);
        }
      } catch (e) {
        scanError = e.message;
      }

      const { isPayment, utr, transferType } = _analysePaymentText(extractedText);
      const vchHits = extractedText ? extractVchNumbers(extractedText) : [];
      const refMatchesThisVoucher = vSeq !== null && vchHits.some(h => h.seq === vSeq);
      const confidence = !scanError && isPayment && refMatchesThisVoucher ? 'high'
        : !scanError && (isPayment || refMatchesThisVoucher) ? 'low'
        : 'none';

      attachmentResults.push({
        attachmentId: att.id,
        fileName: att.file_name,
        publicUrl: att.public_url,
        mimeType,
        confidence,
        isPaymentReceipt: isPayment,
        refMatchesThisVoucher,
        extractedVchRef: vchHits[0]?.raw || null,
        utr,
        transferType,
        error: scanError,
        // Debug: first 300 chars of OCR output so we can diagnose Vercel-specific failures
        _ocrPreview: extractedText ? extractedText.slice(0, 300) : '(empty)',
      });
    }

    // Best result for this voucher = highest confidence across all its attachments
    const best = attachmentResults.find(a => a.confidence === 'high')
      || attachmentResults.find(a => a.confidence === 'low');

    results.push({
      voucherId: v.id,
      serialNumber: v.serial_number,
      amount: v.amount,
      paymentMode: v.payment_mode,
      payeeName: payeeMap[v.payee_id] || '—',
      bestConfidence: best?.confidence || 'none',
      attachments: attachmentResults,
    });
  }

  // Sort: high first, then low, then none
  const order = { high: 0, low: 1, none: 2 };
  results.sort((a, b) => order[a.bestConfidence] - order[b.bestConfidence]);

  return res.json({ results, scanned: scannable.length });
});

// ────────────────────────────────────────────────────────────────────────────────
// UNASSIGNED RECEIPTS — Review queue (Migration 036)
// ────────────────────────────────────────────────────────────────────────────────

// GET /api/companies/:companyId/unassigned-receipts
app.get('/api/companies/:companyId/unassigned-receipts', async (req, res) => {
  try {
    const { requestedBy } = req.query;
    if (!requestedBy) return res.status(400).json({ error: 'requestedBy is required' });
    const actor = await getActorRole(requestedBy);
    if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Accounts or Admin role required' });

    const { data: receipts, error } = await supabase
      .from('unassigned_receipts')
      .select('*')
      .eq('company_id', req.params.companyId)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Also return candidate vouchers for the assignment picker
    const { data: candidates } = await supabase
      .from('vouchers')
      .select('id, serial_number, amount, status, payment_receipt_url, payee_id')
      .eq('company_id', req.params.companyId)
      .in('status', ['awaiting_payment', 'completed'])
      .is('payment_receipt_url', null)
      .is('batch_id', null);

    res.json({ receipts: receipts || [], candidates: candidates || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/unassigned-receipts/:id/assign
// Assign an unassigned receipt to a voucher: re-uploads to payment-receipts path, marks voucher paid.
app.post('/api/unassigned-receipts/:id/assign', async (req, res) => {
  const { assignedBy, voucherId, paymentReference, paymentNotes } = req.body;
  if (!assignedBy) return res.status(400).json({ error: 'assignedBy is required' });
  if (!voucherId)  return res.status(400).json({ error: 'voucherId is required' });

  try {
    const actor = await getActorRole(assignedBy);
    if (actor.role !== 'accounts' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Only Accounts users can assign receipts' });

    const { data: receipt, error: rErr } = await supabase
      .from('unassigned_receipts').select('*').eq('id', req.params.id).single();
    if (rErr || !receipt) return res.status(404).json({ error: 'Unassigned receipt not found' });
    if (receipt.status !== 'pending_review')
      return res.status(400).json({ error: `Receipt is already ${receipt.status}` });

    const { data: voucher, error: vErr } = await supabase
      .from('vouchers').select('id, serial_number, amount, status, company_id, prepared_by, payment_reference')
      .eq('id', voucherId).single();
    if (vErr || !voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (!['awaiting_payment', 'completed'].includes(voucher.status))
      return res.status(400).json({ error: `Voucher must be awaiting_payment or completed (current: ${voucher.status})` });

    // Download file from unassigned-receipts path
    const nativeFetch = globalThis.fetch || fetch;
    const fileRes = await nativeFetch(receipt.file_url);
    if (!fileRes.ok) throw new Error(`Could not download receipt file (HTTP ${fileRes.status})`);
    const arrayBuf = await fileRes.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuf);

    // Re-upload to canonical payment-receipts path
    const receiptUrl = await _uploadPaymentReceiptToStorage(
      voucherId, voucher.company_id, voucher.serial_number, fileBuffer, receipt.mime_type
    );

    // Resolve UTR: manual override → OCR cache → fresh extraction (only if voucher has no UTR yet)
    // NOTE: payment_reference = UTR — maps to pramaana.vouchers.utr_number in the sync; do not rename
    let utr = paymentReference || receipt.extracted_data?.utr_number || null;
    let utrSource = utr ? (paymentReference ? 'manual' : 'ocr_cached') : null;

    if (!utr && !voucher.payment_reference) {
      // Fresh OCR extraction — same path as the backfill honest-toast fix
      const extracted = await _extractReceiptFull(fileBuffer, receipt.mime_type, `receipt-${receipt.id}`);
      const freshUtr = extracted?.utr_number || null;
      if (freshUtr) {
        utr = freshUtr;
        utrSource = 'ocr_extracted';
        console.log(`[unassigned-assign] fresh OCR extracted UTR ${utr} for ${voucher.serial_number}`);
      } else {
        utrSource = 'not_found';
      }
    } else if (voucher.payment_reference) {
      // Voucher already has a UTR — do not overwrite, but still attach receipt
      utr = utr || voucher.payment_reference;
      utrSource = 'existing';
    }

    const utrToWrite = !voucher.payment_reference ? utr : undefined; // never overwrite an existing UTR
    const { error: upErr } = await supabase.from('vouchers').update({
      status:              'paid',
      ...(utrToWrite !== undefined && { payment_reference: utrToWrite }),
      payment_notes:       paymentNotes || `Manually assigned from receipt review queue`,
      payment_receipt_url: receiptUrl || null,
      paid_by:             assignedBy,
      paid_at:             new Date().toISOString(),
    }).eq('id', voucherId);
    if (upErr) throw upErr;

    // Mark this row assigned first so it is excluded from the auto-resolve sweep below.
    await supabase.from('unassigned_receipts').update({
      status:      'assigned',
      assigned_to: voucherId,
      assigned_by: assignedBy,
      assigned_at: new Date().toISOString(),
    }).eq('id', req.params.id);

    // C2: auto-resolve every other pending_review row carrying the same UTR.
    // Use utr (identified UTR) not utrToWrite — fires even when voucher already had a UTR.
    if (utr) _autoResolveQueueForUtr(voucher.company_id, utr, voucher.serial_number).catch(() => {});

    const utrRecorded = !!utrToWrite;
    const notifTitle  = utrRecorded ? '✅ Payment Completed — UTR Recorded' : '✅ Payment Completed';
    const notifMsg    = utrRecorded
      ? `Voucher ${voucher.serial_number} has been paid. UTR: ${utr}`
      : `Voucher ${voucher.serial_number} has been paid. Receipt attached — UTR not found in receipt.`;
    await supabase.from('notifications').insert({
      user_id:    voucher.prepared_by,
      title:      notifTitle,
      message:    notifMsg,
      type:       'completed',
      voucher_id: voucherId,
    });
    sendPushNotification(voucher.prepared_by, notifTitle, notifMsg, '/');

    const outcome = utrRecorded ? 'receipt_attached_utr_recorded' : 'receipt_attached_utr_not_found';
    console.log(`[unassigned-assign] ${receipt.id} → ${voucher.serial_number} | by ${assignedBy} | UTR: ${utr || 'N/A'} | source: ${utrSource} | outcome: ${outcome}`);
    res.json({ success: true, serialNumber: voucher.serial_number, utr, utrSource, outcome });
  } catch (err) {
    console.error('[unassigned-assign] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/unassigned-receipts/:id/dismiss
app.post('/api/unassigned-receipts/:id/dismiss', async (req, res) => {
  const { dismissedBy } = req.body;
  if (!dismissedBy) return res.status(400).json({ error: 'dismissedBy is required' });
  try {
    const actor = await getActorRole(dismissedBy);
    if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Accounts or Admin role required' });

    const { error } = await supabase.from('unassigned_receipts')
      .update({ status: 'dismissed', assigned_by: dismissedBy, assigned_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('status', 'pending_review');
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/receipts/deposit-unassigned
// Safety-net: deposits a file into unassigned_receipts without running OCR.
// Called fire-and-forget from _runReconcile's error fallback so a shared
// receipt is never droppable by closing the modal without assigning.
app.post('/api/receipts/deposit-unassigned', async (req, res) => {
  const { requestedBy, receiptData, receiptMimeType, companyId, extractedData, allCompanyIds } = req.body;
  if (!requestedBy || !receiptData || !receiptMimeType || !companyId)
    return res.status(400).json({ error: 'requestedBy, receiptData, receiptMimeType, companyId are required' });

  const actor = await getActorRole(requestedBy);
  if (actor.role !== 'accounts' && actor.role !== 'admin' && !actor.is_super_admin)
    return res.status(403).json({ error: 'Accounts or Admin role required' });

  let fileBuffer;
  try { fileBuffer = Buffer.from(receiptData, 'base64'); }
  catch { return res.status(400).json({ error: 'receiptData is not valid base64' }); }

  const ext = receiptMimeType === 'application/pdf' ? 'pdf' : (receiptMimeType.split('/')[1] || 'jpg');
  const unassignedPath = `${companyId}/unassigned-receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  let fileUrl = '';
  const { error: storeErr } = await supabase.storage
    .from('voucher-bills')
    .upload(unassignedPath, fileBuffer, { contentType: receiptMimeType, upsert: false });
  if (!storeErr) {
    const { data: urlData } = supabase.storage.from('voucher-bills').getPublicUrl(unassignedPath);
    fileUrl = urlData.publicUrl;
  }

  // C1: run OCR to get UTR for deduplication when caller did not provide it.
  let resolvedExtracted = extractedData || null;
  let fallbackUtr = resolvedExtracted?.utr_number || null;
  if (!fallbackUtr) {
    const ocr = await _extractReceiptFull(fileBuffer, receiptMimeType, `deposit-${companyId}`).catch(() => null);
    if (ocr?.utr_number) {
      fallbackUtr = ocr.utr_number;
      resolvedExtracted = { ...(resolvedExtracted || {}), ...ocr };
      console.log(`[deposit-unassigned] OCR found UTR ${fallbackUtr} — will dedupe by UTR`);
    }
  }

  // Route to the company whose bank account matches the receipt's sender account.
  const allIds = [companyId, ...((allCompanyIds || []).filter(id => id && id !== companyId))];
  const detectedQueueCompany = await _detectCompanyFromBankAccount(
    resolvedExtracted?.initiator_account_number, allIds
  ).catch(() => null);
  const queueCompanyId = detectedQueueCompany || companyId;
  if (detectedQueueCompany && detectedQueueCompany !== companyId)
    console.log(`[deposit-unassigned] bank account matched company ${detectedQueueCompany} — routing queue there`);

  const { data: record } = await (async () => {
    const payload = {
      company_id:     queueCompanyId,
      storage_path:   unassignedPath,
      file_url:       fileUrl,
      mime_type:      receiptMimeType,
      extracted_data: resolvedExtracted,
      match_reason:   'Deposited via share-target fallback (auto-complete error)',
    };
    const rowId = await _queueUpsert(queueCompanyId, fallbackUtr, payload);
    return { data: rowId ? { id: rowId } : null };
  })();

  res.json({ success: true, id: record?.id, fileUrl });
});

// Cron warmup — keeps the serverless function instance alive between share events.
// Called every 4 minutes by vercel.json cron; also hit by the client polling loop.
app.get('/api/_warm', (req, res) => res.json({ ok: true, t: Date.now() }));

// ─── Construction Labour Attendance ──────────────────────────────────────────

app.get('/api/construction/categories', async (req, res) => {
  const { data, error } = await supabase.from('construction_categories')
    .select('id, name, description').eq('is_active', true).order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create a category
app.post('/api/construction/categories', async (req, res) => {
  const { name, description, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  if (!name) return res.status(400).json({ error: 'name required' });
  const { data, error } = await supabase.from('construction_categories')
    .insert({ name: name.trim(), description: description || null })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Edit a category
app.put('/api/construction/categories/:id', async (req, res) => {
  const { name, description, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const updates = {};
  if (name        !== undefined) updates.name        = name.trim();
  if (description !== undefined) updates.description = description || null;
  const { data, error } = await supabase.from('construction_categories')
    .update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Delete a category (guarded — blocked if assignments exist)
app.delete('/api/construction/categories/:id', async (req, res) => {
  const { requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const { count } = await supabase.from('construction_category_supervisors')
    .select('id', { count: 'exact', head: true }).eq('category_id', req.params.id);
  if (count > 0) return res.status(409).json({ error: `Cannot delete — ${count} supervisor assignment(s) exist. Remove assignments first.` });
  // Soft-delete: set is_active = false to preserve historical attendance data
  const { error } = await supabase.from('construction_categories')
    .update({ is_active: false }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});

// Supervisors for a category, including their workers
app.get('/api/construction/categories/:categoryId/supervisors', async (req, res) => {
  const { data, error } = await supabase
    .from('construction_category_supervisors')
    .select(`
      id, approved_rate,
      construction_supervisors(id, name, mobile, upi_id),
      construction_workers(id, name, mobile, is_active, notes)
    `)
    .eq('category_id', req.params.categoryId)
    .eq('is_active', true);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(r => ({
    ...r.construction_supervisors,
    category_supervisor_id: r.id,
    approved_rate: r.approved_rate,
    workers: (r.construction_workers || []).filter(w => w.is_active),
  })));
});

// Attendance GET — category_id required; date optional (omit for log view)
app.get('/api/construction/attendance', async (req, res) => {
  const { category_id, date } = req.query;
  let q = supabase.from('construction_attendance')
    .select(`
      id, attendance_date, attendance_value, voucher_id,
      supervisor_id, worker_id,
      construction_workers(name, mobile),
      construction_supervisors(name),
      construction_categories(name)
    `)
    .order('attendance_date', { ascending: false });
  if (category_id) q = q.eq('category_id', category_id);
  if (date) q = q.eq('attendance_date', date);
  const { data, error } = await q.limit(500);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(r => ({
    ...r,
    worker_name:    r.construction_workers?.name,
    worker_mobile:  r.construction_workers?.mobile,
    supervisor_name: r.construction_supervisors?.name,
    category_name:  r.construction_categories?.name,
  })));
});

// Attendance POST — upsert checked records + delete unchecked ones
app.post('/api/construction/attendance', async (req, res) => {
  const { records, requestedBy, attendanceDate, categoryId, deletedWorkerIds } = req.body;
  // Allow empty records when there are deletions to process
  if (!records?.length && !deletedWorkerIds?.length) {
    return res.status(400).json({ error: 'No changes provided' });
  }
  const actor = await getActorRole(requestedBy);
  if (!actor.role) return res.status(403).json({ error: 'Not authenticated' });
  const allowedRoles = ['staff_lead', 'accounts', 'admin', 'super_admin'];
  if (!allowedRoles.includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Not authorised' });
  }
  const today = new Date().toISOString().split('T')[0];
  const dateToSave = (attendanceDate && /^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) ? attendanceDate : today;
  if (dateToSave > today) return res.status(400).json({ error: 'Cannot mark attendance for future dates' });

  // Delete records for workers that were un-ticked (only non-vouchered)
  if (deletedWorkerIds?.length && categoryId) {
    const { error: delErr } = await supabase.from('construction_attendance')
      .delete()
      .eq('attendance_date', dateToSave)
      .eq('category_id', categoryId)
      .in('worker_id', deletedWorkerIds)
      .is('voucher_id', null);
    if (delErr) return res.status(500).json({ error: delErr.message });
  }

  let saved = 0;
  if (records?.length) {
    const upserts = records.map(r => ({
      attendance_date:  dateToSave,
      category_id:      r.category_id,
      supervisor_id:    r.supervisor_id,
      worker_id:        r.worker_id,
      attendance_value: r.attendance_value,
      worker_type:      r.worker_type || null,
      marked_by:        requestedBy,
      last_edited_by:   requestedBy,
      last_edited_at:   new Date().toISOString(),
      notes:            r.notes || null,
    }));
    const { data, error } = await supabase
      .from('construction_attendance')
      .upsert(upserts, { onConflict: 'attendance_date,category_id,supervisor_id,worker_id' })
      .select('id, worker_id, attendance_value');
    if (error) return res.status(500).json({ error: error.message });
    saved = data.length;
  }

  res.json({ saved, deleted: deletedWorkerIds?.length || 0 });
});

// Dates in a given month that have at least one attendance record (for calendar dots)
app.get('/api/construction/attendance-dates', async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'year and month required' });
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const from = `${year}-${mm}-01`;
  const to   = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
  const { data, error } = await supabase
    .from('construction_attendance')
    .select('attendance_date')
    .gte('attendance_date', from)
    .lte('attendance_date', to);
  if (error) return res.status(500).json({ error: error.message });
  res.json([...new Set(data.map(r => r.attendance_date))]);
});

// Unpaid dues per supervisor (aggregated from worker attendance)
app.get('/api/construction/dues', async (req, res) => {
  const { category_id } = req.query;
  let query = supabase.from('v_unpaid_attendance').select('*');
  if (category_id) query = query.eq('category_id', category_id);
  const { data, error } = await query.order('supervisor_name');
  if (error) {
    // View missing (migration not applied) — fall back to raw attendance count so UI can warn usefully
    const fallbackMsg = error.message?.includes('does not exist')
      ? 'DATABASE_VIEW_MISSING'
      : error.message;
    return res.status(500).json({ error: fallbackMsg });
  }
  res.json(data);
});

// Raw attendance counts — used as a diagnostic when the dues view is broken or shows 0
app.get('/api/construction/attendance-raw', async (req, res) => {
  const { category_id } = req.query;
  if (!category_id) return res.status(400).json({ error: 'category_id required' });
  const { data, error } = await supabase
    .from('construction_attendance')
    .select('id, attendance_date, attendance_value, voucher_id, supervisor_id, worker_id, construction_supervisors(name), construction_workers(name)')
    .eq('category_id', category_id)
    .is('voucher_id', null)
    .order('attendance_date', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(r => ({
    id: r.id,
    attendance_date: r.attendance_date,
    attendance_value: r.attendance_value,
    supervisor_name: r.construction_supervisors?.name,
    worker_name: r.construction_workers?.name,
    supervisor_id: r.supervisor_id,
    worker_id: r.worker_id,
  })));
});

// Create payment voucher for selected supervisors
app.post('/api/construction/vouchers', async (req, res) => {
  const { category_id, supervisor_ids, company_id, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  const allowed = ['accounts', 'admin', 'super_admin'];
  if (!allowed.includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Not authorised' });
  }
  if (!category_id || !supervisor_ids?.length) {
    return res.status(400).json({ error: 'category_id and supervisor_ids required' });
  }

  // ── 1. Aggregate dues from the view ──────────────────────────────────────
  const { data: dues, error: dErr } = await supabase
    .from('v_unpaid_attendance').select('*')
    .eq('category_id', category_id).in('supervisor_id', supervisor_ids);
  if (dErr) return res.status(500).json({ error: dErr.message });
  const missing = dues.filter(d => d.total_dues === null || d.total_dues === undefined);
  if (missing.length) {
    return res.status(400).json({ error: `No rate configured for: ${missing.map(d => d.supervisor_name).join(', ')} — set an approved rate in Rate Approvals first` });
  }

  // ── 2. Per-worker breakdown (individual amounts for narration & lines) ───
  const { data: workerRows, error: wrErr } = await supabase
    .from('construction_attendance')
    .select('worker_id, worker_type, supervisor_id, attendance_value, construction_workers(id, name, worker_type)')
    .eq('category_id', category_id)
    .in('supervisor_id', supervisor_ids)
    .is('voucher_id', null);
  if (wrErr) return res.status(500).json({ error: wrErr.message });

  // Fetch worker-type rates for this category separately (no FK between cs and worker_rates)
  const { data: wtRates } = await supabase.from('construction_worker_rates')
    .select('worker_type, approved_rate').eq('category_id', category_id).not('approved_rate', 'is', null);
  const wtRateMap = Object.fromEntries((wtRates || []).map(r => [r.worker_type, parseFloat(r.approved_rate)]));
  // Supervisor-level fallback rates
  const supRateMap = Object.fromEntries(dues.map(d => [d.supervisor_id, parseFloat(d.approved_rate) || 0]));

  // Aggregate per worker: sum days, pick rate (worker-type > supervisor fallback)
  const workerMap = new Map();
  workerRows.forEach(row => {
    const wid = row.worker_id;
    const wName = row.construction_workers?.name || 'Unknown';
    const wType = row.worker_type || row.construction_workers?.worker_type || 'Helper';
    const rate = wtRateMap[wType] ?? supRateMap[row.supervisor_id] ?? 0;
    if (!workerMap.has(wid)) {
      workerMap.set(wid, { worker_id: wid, name: wName, worker_type: wType, supervisor_id: row.supervisor_id, days: 0, rate });
    }
    workerMap.get(wid).days += parseFloat(row.attendance_value);
  });
  const workerBreakdown = Array.from(workerMap.values()).map(w => ({
    ...w, amount: +(w.days * w.rate).toFixed(2),
  }));

  const totalAmount = workerBreakdown.reduce((s, w) => s + w.amount, 0);
  const allDates = dues.flatMap(d => [d.earliest_date, d.latest_date]).filter(Boolean).sort();

  // ── 3. Create CLABV header ────────────────────────────────────────────────
  const { data: clabv, error: vErr } = await supabase
    .from('construction_vouchers')
    .insert({ category_id, period_from: allDates[0], period_to: allDates[allDates.length - 1],
              total_amount: totalAmount, status: 'draft', created_by: requestedBy })
    .select().single();
  if (vErr) return res.status(500).json({ error: vErr.message });

  // ── 4. Create per-worker CLABV lines (worker_name/worker_id only if migration 047 applied) ──
  const hasWorkerCols = await supabase.from('construction_voucher_lines').select('worker_name').limit(0).then(r => !r.error);
  const lines = workerBreakdown.map(w => {
    const line = {
      voucher_id: clabv.id, supervisor_id: w.supervisor_id,
      days_count: w.days, rate_applied: w.rate || 0, amount: w.amount,
      upi_id_snapshot: dues.find(d => d.supervisor_id === w.supervisor_id)?.upi_id || null,
    };
    if (hasWorkerCols) { line.worker_id = w.worker_id; line.worker_name = w.name; }
    return line;
  });
  const { error: lErr } = await supabase.from('construction_voucher_lines').insert(lines);
  if (lErr) {
    // Clean up orphaned header so it doesn't appear in the list
    await supabase.from('construction_vouchers').delete().eq('id', clabv.id);
    return res.status(500).json({ error: lErr.message });
  }

  // ── 5. Mark attendance as vouchered ──────────────────────────────────────
  const { data: attRows } = await supabase.from('construction_attendance')
    .select('id').eq('category_id', category_id)
    .in('supervisor_id', supervisor_ids).is('voucher_id', null);
  if (attRows?.length) {
    await supabase.from('construction_attendance')
      .update({ voucher_id: clabv.id }).in('id', attRows.map(r => r.id));
  }

  res.json({ voucher_number: clabv.voucher_number, id: clabv.id, total_amount: totalAmount });
});

// Explicitly convert a CLABV to a regular VCH — called by the "Create Regular Voucher" button
app.post('/api/construction/vouchers/:id/to-regular', async (req, res) => {
  const { company_id, payee_id, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['accounts','admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Not authorised' });
  }
  if (!company_id) return res.status(400).json({ error: 'company_id required' });

  // Load CLABV with lines
  const { data: clabv, error: cErr } = await supabase.from('construction_vouchers')
    .select('*, construction_voucher_lines(*, construction_supervisors(name, mobile, upi_id))')
    .eq('id', req.params.id).single();
  if (cErr || !clabv) return res.status(404).json({ error: 'CLABV not found' });
  if (clabv.regular_voucher_id) return res.status(400).json({ error: 'Already linked to a regular voucher' });

  // Resolve payee
  let payeeId = payee_id || null;
  if (!payeeId) {
    // Try to find supervisor's payee in this company by mobile or UPI
    const firstLine = clabv.construction_voucher_lines?.[0];
    const sup = firstLine?.construction_supervisors;
    if (sup) {
      if (sup.mobile) {
        const { data: p } = await supabase.from('payees').select('id').eq('company_id', company_id).eq('mobile', sup.mobile).maybeSingle();
        if (p) payeeId = p.id;
      }
      if (!payeeId && sup.upi_id) {
        const { data: p } = await supabase.from('payees').select('id').eq('company_id', company_id).eq('upi_id', sup.upi_id).maybeSingle();
        if (p) payeeId = p.id;
      }
      if (!payeeId) {
        // Auto-create payee in this company
        const { data: np, error: npErr } = await supabase.from('payees').insert({
          company_id, name: sup.name || 'Labour Supervisor', mobile: sup.mobile || null,
          upi_id: sup.upi_id || null, payee_type: 'registered', requires_otp: true, is_global: false,
        }).select('id').single();
        if (npErr) return res.status(500).json({ error: `Cannot resolve payee: ${npErr.message}` });
        payeeId = np.id;
      }
    }
  }
  if (!payeeId) return res.status(400).json({ error: 'Could not resolve payee — pass payee_id explicitly' });

  const lines = clabv.construction_voucher_lines || [];
  const narrationItems = lines.map((l, i) => ({
    sr_no: i + 1,
    description: l.worker_name || l.construction_supervisors?.name || `Worker ${i + 1}`,
    amount: parseFloat(l.amount),
  }));
  const supName = lines[0]?.construction_supervisors?.name || 'Labour';

  const serialNumber = await getNextVoucherNumber(company_id);
  const { data: regV, error: regVErr } = await supabase.from('vouchers').insert({
    company_id,
    serial_number: serialNumber,
    payee_id: payeeId,
    head_of_account: 'Building Construction',
    sub_head_of_account: 'Labour Charges',
    narration: `Labour payment — ${supName} (${clabv.voucher_number})`,
    narration_items: JSON.stringify(narrationItems),
    amount: parseFloat(clabv.total_amount),
    payment_mode: 'UPI',
    status: 'draft',
    prepared_by: requestedBy,
  }).select('id, serial_number').single();

  if (regVErr || !regV) return res.status(500).json({ error: regVErr?.message || 'Failed to create voucher' });

  await supabase.from('construction_vouchers').update({ regular_voucher_id: regV.id }).eq('id', clabv.id);
  res.json({ voucher_id: regV.id, serial_number: regV.serial_number });
});

// Delete a CLABV draft voucher (admin only; only drafts with no vouchered attendance)
app.delete('/api/construction/vouchers/:id', async (req, res) => {
  const { requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const { data: v } = await supabase.from('construction_vouchers').select('status').eq('id', req.params.id).single();
  if (!v) return res.status(404).json({ error: 'Voucher not found' });
  if (v.status !== 'draft') return res.status(400).json({ error: 'Only draft vouchers can be deleted' });
  // Unlink any attendance records pointing to this voucher before deleting
  await supabase.from('construction_attendance').update({ voucher_id: null }).eq('voucher_id', req.params.id);
  const { error } = await supabase.from('construction_vouchers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});

// Link a regular paid VCH to construction attendance records (retroactive)
app.post('/api/construction/vouchers/:id/link-attendance', async (req, res) => {
  const { attendance_ids, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['accounts','admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Not authorised' });
  }
  if (!attendance_ids?.length) return res.status(400).json({ error: 'attendance_ids required' });
  const { error } = await supabase.from('construction_attendance')
    .update({ voucher_id: req.params.id }).in('id', attendance_ids).is('voucher_id', null);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ linked: attendance_ids.length });
});

// Mark attendance as settled outside the system (admin only) — creates a paid voucher at a manual amount
app.post('/api/construction/vouchers/settle', async (req, res) => {
  const { category_id, supervisor_ids, total_amount, notes, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  if (!category_id || !supervisor_ids?.length) {
    return res.status(400).json({ error: 'category_id and supervisor_ids required' });
  }
  const { data: voucher, error: vErr } = await supabase
    .from('construction_vouchers')
    .insert({ category_id, total_amount: parseFloat(total_amount) || 0, status: 'paid',
              period_from: new Date().toISOString().split('T')[0],
              period_to:   new Date().toISOString().split('T')[0],
              notes: notes || 'Settled outside system', created_by: requestedBy })
    .select().single();
  if (vErr) return res.status(500).json({ error: vErr.message });
  const { data: attRows } = await supabase.from('construction_attendance')
    .select('id').eq('category_id', category_id)
    .in('supervisor_id', supervisor_ids).is('voucher_id', null);
  if (attRows?.length) {
    await supabase.from('construction_attendance')
      .update({ voucher_id: voucher.id }).in('id', attRows.map(r => r.id));
  }
  res.json({ id: voucher.id, voucher_number: voucher.voucher_number, cleared: attRows?.length || 0 });
});

// Past vouchers for a category
app.get('/api/construction/vouchers', async (req, res) => {
  const { category_id } = req.query;
  if (!category_id) return res.status(400).json({ error: 'category_id required' });
  const { data, error } = await supabase
    .from('construction_vouchers')
    .select(`*, construction_voucher_lines(*, construction_supervisors(name))`)
    .eq('category_id', category_id)
    .order('created_at', { ascending: false }).limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(v => ({
    ...v,
    lines: (v.construction_voucher_lines || []).map(l => ({
      ...l, supervisor_name: l.construction_supervisors?.name,
    })),
  })));
});

// List all supervisors
app.get('/api/construction/supervisors', async (req, res) => {
  const { data, error } = await supabase
    .from('construction_supervisors').select('*').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Check if a supervisor's details match any existing payee — returns ranked matches
app.get('/api/construction/supervisors/check-payee', async (req, res) => {
  const { mobile, upi_id, name } = req.query;
  if (!mobile && !upi_id && !name) return res.json({ matches: [] });

  // Fetch candidates by mobile OR upi_id (exact), then name (case-insensitive)
  const queries = [];
  if (mobile) queries.push(supabase.from('payees').select('id,name,alias,mobile,upi_id,bank_account,ifsc,company_id').eq('mobile', mobile));
  if (upi_id) queries.push(supabase.from('payees').select('id,name,alias,mobile,upi_id,bank_account,ifsc,company_id').eq('upi_id', upi_id));
  if (name)   queries.push(supabase.from('payees').select('id,name,alias,mobile,upi_id,bank_account,ifsc,company_id').ilike('name', `%${name.trim()}%`));

  const results = await Promise.all(queries);
  // Deduplicate by payee id, accumulate which fields matched
  const seen = new Map();
  const fieldLabels = ['mobile', 'upi_id', 'name'];
  results.forEach((r, i) => {
    if (r.error || !r.data) return;
    r.data.forEach(p => {
      if (!seen.has(p.id)) seen.set(p.id, { payee: p, matchedFields: [] });
      seen.get(p.id).matchedFields.push(fieldLabels[i]);
    });
  });

  const matches = Array.from(seen.values()).map(({ payee, matchedFields }) => ({
    payee,
    matchedFields,
    // strong = mobile or UPI matched; partial = name only
    strength: matchedFields.some(f => f === 'mobile' || f === 'upi_id') ? 'strong' : 'partial',
  })).sort((a, b) => (b.strength === 'strong' ? 1 : 0) - (a.strength === 'strong' ? 1 : 0));

  res.json({ matches });
});

// Add a supervisor — links to an existing payee or auto-creates one
app.post('/api/construction/supervisors', async (req, res) => {
  const { name, mobile, upi_id, notes, requestedBy, payee_id: explicitPayeeId } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['accounts','admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Not authorised' });
  }
  if (!name || !mobile || !upi_id) return res.status(400).json({ error: 'name, mobile, upi_id required' });

  // Resolve which payee_id to link
  let payeeId = explicitPayeeId || null;
  if (!payeeId) {
    // Auto-create a payee record in the creator's primary company
    const { data: creator } = await supabase.from('users').select('company_id').eq('id', requestedBy).single();
    const companyId = creator?.company_id;
    if (companyId) {
      const { data: newPayee, error: pErr } = await supabase.from('payees').insert({
        company_id: companyId,
        name,
        mobile,
        upi_id,
        payee_type: 'registered',
        requires_otp: true,
        is_global: false,
      }).select('id').single();
      if (!pErr) payeeId = newPayee.id;
    }
  }

  const { data, error } = await supabase.from('construction_supervisors')
    .insert({ name, mobile, upi_id, notes: notes || null, created_by: requestedBy, payee_id: payeeId })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...data, payee_id: payeeId });
});

// Assign supervisor to category
app.post('/api/construction/assign', async (req, res) => {
  const { category_id, supervisor_id, addAsSelfWorker, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['accounts','admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Not authorised' });
  }
  const { data, error } = await supabase.from('construction_category_supervisors')
    .insert({ category_id, supervisor_id, created_by: requestedBy })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Optionally create a self-worker record so the supervisor appears in their own attendance list
  if (addAsSelfWorker) {
    const { data: sup } = await supabase.from('construction_supervisors')
      .select('name, mobile').eq('id', supervisor_id).single();
    if (sup) {
      await supabase.from('construction_workers').insert({
        category_supervisor_id: data.id,
        name: sup.name,
        mobile: sup.mobile || null,
        notes: 'Self (gang lead)',
        created_by: requestedBy,
      });
    }
  }
  res.json({ ...data, selfWorkerCreated: !!addAsSelfWorker });
});

// Remove a supervisor from a category (soft-delete preserves historical attendance)
// Hard-delete a supervisor–category assignment — blocked only if unpaid attendance exists
app.delete('/api/construction/category-assignment/:id', async (req, res) => {
  const { requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['accounts', 'admin', 'super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Not authorised' });
  }
  // Get the assignment to know supervisor + category
  const { data: cs } = await supabase.from('construction_category_supervisors')
    .select('supervisor_id, category_id').eq('id', req.params.id).single();
  if (!cs) return res.status(404).json({ error: 'Assignment not found' });
  const { count: unpaid } = await supabase.from('construction_attendance')
    .select('id', { count: 'exact', head: true })
    .eq('supervisor_id', cs.supervisor_id).eq('category_id', cs.category_id).is('voucher_id', null);
  if (unpaid > 0) return res.status(409).json({ error: `Cannot delete — ${unpaid} unpaid attendance record(s) exist. Settle dues first.` });
  const { error } = await supabase.from('construction_category_supervisors').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ removed: true });
});

// Reactivate a previously removed supervisor–category assignment
app.post('/api/construction/category-assignment/:id/reactivate', async (req, res) => {
  const { requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['accounts', 'admin', 'super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Not authorised' });
  }
  const { error } = await supabase
    .from('construction_category_supervisors')
    .update({ is_active: true })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ reactivated: true });
});

// Find-or-create a self-worker record so a supervisor can be marked in their own attendance list
app.post('/api/construction/self-worker', async (req, res) => {
  const { category_supervisor_id, supervisor_id, worker_type, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  const allowed = ['staff_lead', 'accounts', 'admin', 'super_admin'];
  if (!allowed.includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Not authorised' });
  }
  // Return existing self-worker if already present
  const { data: existing } = await supabase.from('construction_workers')
    .select('id, name, mobile')
    .eq('category_supervisor_id', category_supervisor_id)
    .eq('notes', 'Self (gang lead)')
    .maybeSingle();
  if (existing) return res.json(existing);
  // Create the self-worker record
  const { data: sup } = await supabase.from('construction_supervisors')
    .select('name, mobile').eq('id', supervisor_id).single();
  if (!sup) return res.status(404).json({ error: 'Supervisor not found' });
  const { data, error } = await supabase.from('construction_workers')
    .insert({ category_supervisor_id, name: sup.name, mobile: sup.mobile || null, notes: 'Self (gang lead)', worker_type: worker_type || 'Supervisor', created_by: requestedBy })
    .select('id, name, mobile').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// All category-supervisor assignments — includes inactive so setup UI can show/reactivate them
app.get('/api/construction/category-supervisors', async (req, res) => {
  const { data, error } = await supabase
    .from('construction_category_supervisors')
    .select('id, approved_rate, is_active, construction_categories(name), construction_supervisors(name)')
    .order('is_active', { ascending: false }); // active first
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Workers for a category-supervisor assignment
app.get('/api/construction/workers', async (req, res) => {
  const { category_supervisor_id } = req.query;
  if (!category_supervisor_id) return res.status(400).json({ error: 'category_supervisor_id required' });
  const { data, error } = await supabase
    .from('construction_workers')
    .select('id, name, mobile, is_active, notes, worker_type')
    .eq('category_supervisor_id', category_supervisor_id)
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Add a worker
app.post('/api/construction/workers', async (req, res) => {
  const { category_supervisor_id, name, mobile, notes, worker_type, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['accounts','admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Not authorised' });
  }
  if (!category_supervisor_id || !name) return res.status(400).json({ error: 'category_supervisor_id and name required' });
  const { data, error } = await supabase.from('construction_workers')
    .insert({ category_supervisor_id, name, mobile: mobile || null, notes: notes || null, worker_type: worker_type || 'Helper', created_by: requestedBy })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Edit a supervisor
app.put('/api/construction/supervisors/:id', async (req, res) => {
  const { name, mobile, upi_id, notes, is_active, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['accounts','admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Not authorised' });
  }
  const updates = {};
  if (name      !== undefined) updates.name      = name;
  if (mobile    !== undefined) updates.mobile    = mobile;
  if (upi_id    !== undefined) updates.upi_id    = upi_id;
  if (notes     !== undefined) updates.notes     = notes || null;
  if (is_active !== undefined) updates.is_active = is_active;
  const { data, error } = await supabase.from('construction_supervisors')
    .update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Delete a supervisor — blocked only if unpaid attendance exists
app.delete('/api/construction/supervisors/:id', async (req, res) => {
  const { requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const { count: unpaid } = await supabase.from('construction_attendance')
    .select('id', { count: 'exact', head: true })
    .eq('supervisor_id', req.params.id).is('voucher_id', null);
  if (unpaid > 0) return res.status(409).json({ error: `Cannot delete — ${unpaid} unpaid attendance record(s) exist. Settle dues first.` });
  // Delete settled attendance records so the FK doesn't block
  await supabase.from('construction_attendance').delete().eq('supervisor_id', req.params.id);
  const { error } = await supabase.from('construction_supervisors').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});

// Edit or toggle a worker
app.put('/api/construction/workers/:id', async (req, res) => {
  const { name, mobile, notes, worker_type, is_active, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['accounts','admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Not authorised' });
  }
  const updates = {};
  if (name        !== undefined) updates.name        = name;
  if (mobile      !== undefined) updates.mobile      = mobile || null;
  if (notes       !== undefined) updates.notes       = notes || null;
  if (worker_type !== undefined) updates.worker_type = worker_type || 'Helper';
  if (is_active   !== undefined) updates.is_active   = is_active;
  const { data, error } = await supabase.from('construction_workers')
    .update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Delete a worker (guarded — blocked if attendance records exist)
app.delete('/api/construction/workers/:id', async (req, res) => {
  const { requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const { count: unpaid } = await supabase.from('construction_attendance')
    .select('id', { count: 'exact', head: true })
    .eq('worker_id', req.params.id).is('voucher_id', null);
  if (unpaid > 0) return res.status(409).json({ error: `Cannot delete — ${unpaid} unpaid attendance record(s) exist. Settle dues first.` });
  await supabase.from('construction_attendance').delete().eq('worker_id', req.params.id);
  const { error } = await supabase.from('construction_workers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});

// Propose a daily rate
app.post('/api/construction/rates/propose', async (req, res) => {
  const { category_supervisor_id, proposed_rate, requestedBy } = req.body;
  if (!category_supervisor_id || !proposed_rate) {
    return res.status(400).json({ error: 'category_supervisor_id and proposed_rate required' });
  }
  const { data, error } = await supabase.from('construction_rate_proposals')
    .insert({ category_supervisor_id, proposed_rate, proposed_by: requestedBy })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// List rate proposals
app.get('/api/construction/rates/proposals', async (req, res) => {
  const { data, error } = await supabase
    .from('construction_rate_proposals')
    .select(`*, category_supervisor:construction_category_supervisors(
      id, approved_rate,
      construction_categories(name),
      construction_supervisors(name)
    )`)
    .order('proposed_at', { ascending: false }).limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Approve or reject a rate proposal
app.post('/api/construction/rates/:id/decide', async (req, res) => {
  const { action, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const isApprove = action === 'approve';
  const { data: prop, error: pErr } = await supabase
    .from('construction_rate_proposals')
    .select('category_supervisor_id, proposed_rate').eq('id', req.params.id).single();
  if (pErr) return res.status(404).json({ error: 'Proposal not found' });
  await supabase.from('construction_rate_proposals').update({
    status: isApprove ? 'approved' : 'rejected',
    reviewed_by: requestedBy, reviewed_at: new Date().toISOString(),
    ...(isApprove ? { effective_from: new Date().toISOString() } : {}),
  }).eq('id', req.params.id);
  if (isApprove) {
    await supabase.from('construction_category_supervisors').update({
      approved_rate: prop.proposed_rate,
      rate_approved_at: new Date().toISOString(),
      rate_approved_by: requestedBy,
    }).eq('id', prop.category_supervisor_id);
  }
  res.json({ status: isApprove ? 'approved' : 'rejected' });
});

// Worker-type differential rates — propose/list/decide (category × worker_type → rate)
app.get('/api/construction/worker-rates', async (req, res) => {
  const { category_id } = req.query;
  let q = supabase.from('construction_worker_rates')
    .select('*, construction_categories(name)').order('worker_type');
  if (category_id) q = q.eq('category_id', category_id);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/construction/worker-rates/propose', async (req, res) => {
  const { category_id, worker_type, proposed_rate, notes, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['accounts','admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Not authorised' });
  }
  if (!category_id || !worker_type || !proposed_rate) {
    return res.status(400).json({ error: 'category_id, worker_type, proposed_rate required' });
  }
  // Upsert so re-proposing an existing type resets to pending
  const { data, error } = await supabase.from('construction_worker_rates')
    .upsert({
      category_id, worker_type: worker_type.trim(), proposed_rate: parseFloat(proposed_rate),
      notes: notes || null, proposed_by: requestedBy, status: 'pending',
      proposed_at: new Date().toISOString(), approved_rate: null, approved_by: null, approved_at: null,
    }, { onConflict: 'category_id,worker_type' })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/construction/worker-rates/:id/decide', async (req, res) => {
  const { action, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const isApprove = action === 'approve';
  const { data: rate } = await supabase.from('construction_worker_rates')
    .select('proposed_rate').eq('id', req.params.id).single();
  const { error } = await supabase.from('construction_worker_rates').update({
    status: isApprove ? 'approved' : 'rejected',
    approved_rate: isApprove ? rate?.proposed_rate : null,
    approved_by: requestedBy,
    approved_at: new Date().toISOString(),
  }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ status: isApprove ? 'approved' : 'rejected' });
});

// Direct rate edit — admin updates approved_rate in place (no proposal cycle needed)
app.put('/api/construction/worker-rates/:id', async (req, res) => {
  const { approved_rate, notes, requestedBy } = req.body;
  const actor = await getActorRole(requestedBy);
  if (!['admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const rate = parseFloat(approved_rate);
  if (isNaN(rate) || rate <= 0) return res.status(400).json({ error: 'Valid positive rate required' });
  const { error } = await supabase.from('construction_worker_rates').update({
    approved_rate: rate,
    proposed_rate: rate,
    notes: notes ?? undefined,
    status: 'approved',
    approved_by: requestedBy,
    approved_at: new Date().toISOString(),
  }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Delete a rate record entirely — admin only
app.delete('/api/construction/worker-rates/:id', async (req, res) => {
  const { requestedBy } = req.query;
  const actor = await getActorRole(requestedBy);
  if (!['admin','super_admin'].includes(actor.role) && !actor.is_super_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const { error } = await supabase.from('construction_worker_rates').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Export the Express app for Vercel serverless deployment
module.exports = app;
module.exports._testHelpers = { extractVchNumbers, extractBatchRefs, parseDbSerialSeq, parseDbBatchSeq, alphanumOnly, _extractPdfText, _extractImageText, _parseVchCapture };

// Only start server if running locally (not in Vercel)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🚀 Relish Approval Server running on http://localhost:${PORT}`));
}
