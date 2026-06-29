require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const webpush = require('web-push');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static('public'));

// Supabase Configuration
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_KEY');
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 2Factor.in Configuration
if (!process.env.TWOFACTOR_API_KEY) {
  throw new Error('Missing required environment variable: TWOFACTOR_API_KEY');
}
const TWOFACTOR_API_KEY = process.env.TWOFACTOR_API_KEY;
const TWOFACTOR_BASE_URL = 'https://2factor.in/API/V1';
const TWOFACTOR_TEMPLATE_NAME = process.env.TWOFACTOR_TEMPLATE_NAME || 'Relish-Approvals';
// Template: "Dear #VAR1#, Your ClamFlow OTP is #VAR2#." - Sender ID: Relish

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

// Helper function to format mobile number for 2Factor API (needs 91XXXXXXXXXX format)
const formatMobile = (mobile) => {
  // Remove any non-digit characters
  let cleaned = mobile.replace(/\D/g, '');
  // Ensure we have 91 prefix for 2Factor API
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

const send2FactorSms = async (mobile, message) => {
  if (!mobile) return { success: false, error: 'No mobile number provided' };
  const formattedMobile = formatMobile(mobile);
  const encodedMessage = encodeURIComponent(message);
  const url = `${TWOFACTOR_BASE_URL}/${TWOFACTOR_API_KEY}/SMS/${formattedMobile}/${encodedMessage}`;
  console.log(`\n📩 Sending custom SMS to ${formattedMobile}`);
  console.log(`   URL: ${url}`);

  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log(`   SMS Response: ${JSON.stringify(data)}`);
    return { success: data.Status === 'Success', data };
  } catch (error) {
    console.log(`   SMS Error: ${error.message}`);
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

// Helper function to call 2Factor API with logging
const call2FactorAPI = async (endpoint, description) => {
  const url = `${TWOFACTOR_BASE_URL}/${TWOFACTOR_API_KEY}${endpoint}`;
  console.log(`\n📱 2FACTOR API CALL: ${description}`);
  console.log(`   Full Endpoint: ${endpoint}`);
  console.log(`   Using: Default Transactional SMS OTP`);
  console.log(`   Time: ${new Date().toISOString()}`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`   Response Status: ${data.Status}`);
    console.log(`   Response Details: ${JSON.stringify(data.Details)}`);
    
    // Check if Voice was used (indicates template issue)
    if (data.Details && typeof data.Details === 'string' && data.Details.includes('Voice')) {
      console.log(`   ⚠️ WARNING: Voice OTP was triggered - possible template mismatch!`);
    }
    
    if (data.Status === 'Success') {
      console.log(`   ✅ SUCCESS`);
    } else {
      console.log(`   ❌ FAILED: ${JSON.stringify(data)}`);
    }
    
    return { success: data.Status === 'Success', data };
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

// Debug endpoint to test 2Factor.in API connection
app.get('/api/debug/test-2factor', async (req, res) => {
  try {
    // Test API balance check (doesn't send SMS)
    const url = `${TWOFACTOR_BASE_URL}/${TWOFACTOR_API_KEY}/BAL/SMS`;
    console.log(`\n🔍 TESTING 2FACTOR.IN API`);
    console.log(`   URL: ${url.replace(TWOFACTOR_API_KEY, 'API_KEY_HIDDEN')}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`   Response: ${JSON.stringify(data)}`);
    
    res.json({
      apiKeyConfigured: !!TWOFACTOR_API_KEY,
      apiKeyLength: TWOFACTOR_API_KEY ? TWOFACTOR_API_KEY.length : 0,
      apiKeyPrefix: TWOFACTOR_API_KEY ? TWOFACTOR_API_KEY.substring(0, 8) + '...' : 'NOT SET',
      baseUrl: TWOFACTOR_BASE_URL,
      balanceCheck: data
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      apiKeyConfigured: !!TWOFACTOR_API_KEY,
      apiKeyLength: TWOFACTOR_API_KEY ? TWOFACTOR_API_KEY.length : 0
    });
  }
});

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

// Send OTP using 2Factor.in
app.post('/api/otp/send', async (req, res) => {
  const { mobile, purpose } = req.body;
  if (!mobile) return res.status(400).json({ error: 'Mobile number is required' });
  
  const formattedMobile = formatMobile(mobile);
  console.log(`\n📤 SEND OTP REQUEST`);
  console.log(`   Original: ${mobile}`);
  console.log(`   Formatted: ${formattedMobile}`);
  console.log(`   Purpose: ${purpose}`);
  console.log(`   Template: ${TWOFACTOR_TEMPLATE_NAME}`);
  
  const result = await call2FactorAPI(`/SMS/${formattedMobile}/AUTOGEN/${TWOFACTOR_TEMPLATE_NAME}`, `Send OTP to ${formattedMobile}`);
  
  if (result.success) {
    // Store session in Supabase
    await saveOtpSession(formattedMobile, result.data.Details, purpose);
    console.log(`   📝 Session stored in DB for: ${formattedMobile}`);
    console.log(`   📝 Session ID: ${result.data.Details}`);
    res.json({ success: true, message: 'OTP sent successfully' });
  } else {
    res.status(500).json({ error: 'Failed to send OTP', details: result.data?.Details || result.error });
  }
});

// Verify OTP using 2Factor.in
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
  
  console.log(`   📝 Session found: ${session.sessionId.substring(0, 8)}...`);
  
  const result = await call2FactorAPI(`/SMS/VERIFY/${session.sessionId}/${code}`, `Verify OTP for ${formattedMobile}`);
  
  if (result.success && result.data.Details === 'OTP Matched') {
    // Clear the session
    await deleteOtpSession(formattedMobile);
    console.log(`   ✅ OTP Verified! Session cleared.`);
    const signature = Buffer.from(`${formattedMobile}:${Date.now()}:verified`).toString('base64');
    res.json({ success: true, status: 'approved', signature });
  } else {
    console.log(`   ❌ OTP verification failed: ${result.data?.Details || result.error}`);
    res.status(400).json({ success: false, message: 'Invalid OTP', details: result.data?.Details });
  }
});

// DISABLED: Self-registration not allowed
// Only admins can onboard users via /api/admin/onboard-user

// Admin-only: Onboard new user
app.post('/api/admin/onboard-user', async (req, res) => {
  const { adminMobile, companyId, name, mobile, aadhar, role, companyAccess } = req.body;
  if (!adminMobile || !companyId || !name || !mobile || !role || (role !== 'auditor' && role !== 'staff' && !aadhar)) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  try {
    // Verify Super Admin privileges
    const admin = await getActorRole(req.body.adminId);
    if (!admin.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Super Admin access required' });
    }
    
    const firstName = name.split(' ')[0];
    const rolePrefix = role === 'admin' ? 'Approve' : role === 'auditor' ? 'Audit' : role === 'staff' ? 'Staff' : 'Accounts';
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
  
  if (!name || !mobile || !role || (role !== 'auditor' && role !== 'staff' && !aadhar)) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  try {
    const actor = await getActorRole(requesterId);
    if (!actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Super Admin access required' });
    }
    
    const firstName = name.split(' ')[0];
    const rolePrefix = role === 'admin' ? 'Approve' : role === 'auditor' ? 'Audit' : role === 'staff' ? 'Staff' : 'Accounts';
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
    
    // Check if user has any vouchers
    const { data: vouchers } = await supabase.from('vouchers')
      .select('id')
      .or(`created_by.eq.${req.params.userId},approved_by.eq.${req.params.userId}`)
      .limit(1);
    
    if (vouchers && vouchers.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete user with existing vouchers. Archive user instead.' 
      });
    }
    
    const { error } = await supabase.from('users')
      .delete()
      .eq('id', req.params.userId);
    
    if (error) throw error;
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user', details: error.message });
  }
});

// Session refresh — returns current user profile (used on app load to hydrate stored session)
app.get('/api/users/:userId/session', async (req, res) => {
  const { userId } = req.params;
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

    const primaryOrFirst = companies.find(uc => uc.is_primary) || companies[0];
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
  const { username, otp, companyId } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  
  try {
    // Case-insensitive username search - trim whitespace
    const cleanUsername = username.trim();
    const { data: user, error } = await supabase.from('users')
      .select('*')
      .ilike('username', cleanUsername)
      .single();
    
    if (error) {
      console.error('Login query error:', error.message, 'for username:', cleanUsername);
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.mobile_verified) return res.status(400).json({ error: 'Mobile not verified' });
    
    // Get all companies this user has access to
    const { data: userCompanies, error: ucError } = await supabase
      .from('user_companies')
      .select(`
        company_id,
        role,
        is_primary,
        companies:company_id (id, name, address, gst)
      `)
      .eq('user_id', user.id);
    
    // Fallback to legacy single company if user_companies table is empty
    let companies = userCompanies || [];
    if (companies.length === 0) {
      // User hasn't been migrated yet, use legacy company_id
      const { data: legacyCompany } = await supabase.from('companies')
        .select('*')
        .eq('id', user.company_id)
        .single();
      
      if (legacyCompany) {
        companies = [{
          company_id: legacyCompany.id,
          role: user.role,
          is_primary: true,
          companies: legacyCompany
        }];
      }
    }
    
    if (companies.length === 0) {
      return res.status(400).json({ error: 'User has no company access' });
    }
    
    // Always require company selection if no company selected yet
    // EXCEPT for staff users — they only have one company and go straight to their settlement page
    if (!companyId && user.role !== 'staff') {
      return res.json({
        requiresCompanySelection: true,
        companies: companies.map(uc => ({
          id: uc.companies.id,
          name: uc.companies.name,
          role: uc.role
        })),
        userId: user.id,
        userName: user.name
      });
    }
    
    // Determine which company to log into
    // Staff users auto-select their single company; others must have sent companyId
    let selectedCompany, selectedRole;
    if (user.role === 'staff') {
      const primaryMatch = companies.find(uc => uc.is_primary) || companies[0];
      if (!primaryMatch) return res.status(400).json({ error: 'Staff user has no company access' });
      selectedCompany = primaryMatch.companies;
      selectedRole = primaryMatch.role;
    } else {
      const match = companies.find(uc => uc.company_id === companyId);
      if (!match) {
        return res.status(403).json({ error: 'User does not have access to this company' });
      }
      selectedCompany = match.companies;
      selectedRole = match.role;
    }
    
    // First login requires OTP
    if (!user.last_login) {
      if (!otp) {
        try {
          const formattedMobile = formatMobile(user.mobile);
          const response = await fetch(`${TWOFACTOR_BASE_URL}/${TWOFACTOR_API_KEY}/SMS/${formattedMobile}/AUTOGEN`);
          const data = await response.json();
          
          if (data.Status === 'Success') {
            await saveOtpSession(formattedMobile, data.Details, 'first_login');
            return res.json({ requiresOtp: true, message: 'First login requires OTP. Sent to registered mobile.' });
          } else {
            console.error('2Factor OTP send error:', data.Details);
            return res.status(500).json({ error: 'Failed to send OTP' });
          }
        } catch (err) {
          console.error('2Factor OTP send error:', err.message);
          return res.status(500).json({ error: 'Failed to send OTP' });
        }
      } else {
        // OTP provided, verify it
        try {
          const formattedMobile = formatMobile(user.mobile);
          const session = await getOtpSession(formattedMobile);
          
          if (!session) {
            return res.status(400).json({ error: 'No OTP session found. Please request a new OTP.' });
          }
          
          const response = await fetch(`${TWOFACTOR_BASE_URL}/${TWOFACTOR_API_KEY}/SMS/VERIFY/${session.sessionId}/${otp}`);
          const data = await response.json();
          
          if (data.Status !== 'Success' || data.Details !== 'OTP Matched') {
            return res.status(400).json({ error: 'Invalid OTP' });
          }
          
          // Clear the session
          await deleteOtpSession(formattedMobile);
        } catch (err) {
          console.error('2Factor OTP verify error:', err.message);
          return res.status(500).json({ error: 'OTP verification failed' });
        }
      }
    }
    
    // Update last login
    await supabase.from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);
    
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
    .eq('attachment_category', 'transfer_receipt')  // only disbursement proofs, never expense bills

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
    const { data: vouchers, error } = await supabase.from('vouchers')
      .select(`
        *,
        payee:payees(name, alias, mobile, upi_id, bank_account, ifsc, bank_name),
        preparer:users!vouchers_prepared_by_fkey(name, username),
        approver:users!vouchers_approved_by_fkey(name, username),
        company:companies(name, address, gst)
      `)
      .eq('company_id', req.params.companyId)
      .order('created_at', { ascending: false });
    
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
      attachment_count: attCounts[v.id] || 0
    }));
    
    res.json(formattedVouchers);
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
    if (voucher.is_suspense_settlement) {
      const { data: linkedSettlements } = await supabase
        .from('suspense_settlements')
        .select('suspense_id')
        .eq('voucher_id', req.params.voucherId)
        .limit(1);
      const suspenseId = linkedSettlements?.[0]?.suspense_id;
      if (suspenseId) {
        const { data: sv } = await supabase.from('suspense_vouchers')
          .select('serial_number').eq('id', suspenseId).single();
        suspenseSerial = sv?.serial_number || null;
      }
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
      suspense_serial: suspenseSerial
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
      .select('*, payee:payees(mobile, requires_otp, payee_type)')
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
    // are immediately marked completed; no OTP or document step is triggered.
    if (voucher.is_suspense_settlement) {
      const now = new Date().toISOString();
      await supabase.from('vouchers')
        .update({
          status: 'completed',
          approved_by: approvedBy,
          approved_at: now,
          payee_otp_verified: true,
          completed_at: now
        })
        .eq('id', req.params.voucherId);

      // Notify the Accounts user who prepared the voucher
      await supabase.from('notifications').insert({
        user_id: voucher.prepared_by,
        title: 'Suspense Voucher Approved & Completed',
        message: `Voucher ${voucher.serial_number} (suspense settlement) has been approved and marked completed.`,
        type: 'info',
        voucher_id: req.params.voucherId
      });

      return res.json({ success: true, suspenseSettlement: true, message: 'Suspense-settlement voucher approved and completed.' });
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
    
    // Send OTP to payee using 2Factor.in (default transactional SMS)
    try {
      const formattedMobile = formatMobile(voucher.payee.mobile);
      console.log(`   Sending OTP to: ${formattedMobile}`);
      console.log(`   Using Template: ${TWOFACTOR_TEMPLATE_NAME}`);
      
      const response = await fetch(`${TWOFACTOR_BASE_URL}/${TWOFACTOR_API_KEY}/SMS/${formattedMobile}/AUTOGEN/${TWOFACTOR_TEMPLATE_NAME}`);
      const data = await response.json();
      console.log(`   2Factor Response: ${JSON.stringify(data)}`);
      
      if (data.Status === 'Success') {
        // Store session for payee verification in Supabase
        await saveOtpSession(formattedMobile, data.Details, 'payee_verification', req.params.voucherId);
        console.log(`   ✅ OTP sent successfully, session: ${data.Details}`);
        
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
        console.error('   ❌ 2Factor Error:', data);
        res.status(500).json({ error: 'Failed to send OTP to payee', details: data.Details });
      }
    } catch (err) {
      console.error('   ❌ 2Factor Exception:', err.message);
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
    
    // Verify payee OTP using 2Factor.in
    const formattedMobile = formatMobile(voucher.payee.mobile);
    console.log(`   Payee Mobile: ${formattedMobile}`);
    
    const session = await getOtpSession(formattedMobile, req.params.voucherId);
    
    if (!session) {
      console.log(`   ❌ No OTP session found in DB for payee: ${formattedMobile}, voucher: ${req.params.voucherId}`);
      return res.status(400).json({ error: 'No OTP session found. Please click "Resend OTP" to send a fresh OTP.' });
    }
    
    console.log(`   📝 Session found: ${session.sessionId.substring(0, 8)}... (purpose: ${session.purpose})`);
    
    const result = await call2FactorAPI(`/SMS/VERIFY/${session.sessionId}/${otp}`, `Verify Payee OTP for voucher ${req.params.voucherId}`);
    
    if (!result.success || result.data.Details !== 'OTP Matched') {
      const detail = result.data?.Details || result.error || 'Unknown error';
      console.log(`   ❌ OTP verification failed: ${detail}`);
      return res.status(400).json({ error: 'Invalid OTP', details: detail });
    }
    
    // Clear the session
    console.log(`   ✅ OTP Verified! Completing voucher...`);
    await deleteOtpSession(formattedMobile);
    
    const signature = Buffer.from(
      `${voucher.payee.mobile}:${req.params.voucherId}:${Date.now()}:verified`
    ).toString('base64');
    
    await supabase.from('vouchers')
      .update({
        status: 'completed',
        payee_otp_verified: true,
        payee_signature: signature,
        completed_at: new Date().toISOString()
      })
      .eq('id', req.params.voucherId);
    
    // Notify approver
    if (voucher.approved_by) {
      await supabase.from('notifications').insert({
        user_id: voucher.approved_by,
        title: 'Voucher Completed - Ready for Payment',
        message: `Voucher ${voucher.serial_number} is complete. Payment may be initiated.`,
        type: 'completed',
        voucher_id: req.params.voucherId
      });
      
      // Send push notification to approver
      sendPushNotification(
        voucher.approved_by,
        '💰 Voucher Ready for Payment',
        `Voucher ${voucher.serial_number} is complete and ready for payment.`,
        '/'
      );
    }
    
    res.json({ success: true, signature, message: 'Voucher completed. Payment may be initiated.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resend payee OTP using 2Factor.in
app.post('/api/vouchers/:voucherId/resend-otp', async (req, res) => {
  console.log(`\n🔄 RESEND PAYEE OTP REQUEST`);
  console.log(`   Voucher ID: ${req.params.voucherId}`);
  
  try {
    const { data: voucher, error: voucherError } = await supabase.from('vouchers')
      .select('*, payee:payees(mobile)')
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
    console.log(`   Using Template: ${TWOFACTOR_TEMPLATE_NAME}`);
    
    const result = await call2FactorAPI(`/SMS/${formattedMobile}/AUTOGEN/${TWOFACTOR_TEMPLATE_NAME}`, `Resend Payee OTP for voucher ${req.params.voucherId}`);
    
    if (result.success) {
      // Store session ID in Supabase for verification
      await saveOtpSession(formattedMobile, result.data.Details, 'payee_verification', req.params.voucherId);
      console.log(`   📝 Session stored in Supabase for: ${formattedMobile}`);
      console.log(`   📝 Session ID: ${result.data.Details}`);
      res.json({ success: true, message: 'OTP resent to payee' });
    } else {
      res.status(500).json({ error: 'Failed to resend OTP', details: result.data?.Details || result.error });
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
  const { companyId, label } = req.body;
  if (!companyId || !label?.trim()) {
    return res.status(400).json({ error: 'companyId and label are required' });
  }
  try {
    const { data, error } = await supabase
      .from('company_payment_accounts')
      .insert({ company_id: companyId, label: label.trim() })
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
      .select(`*, staff:users!staff_user_id(id,name,first_name,mobile), staff_payee:payees!staff_payee_id(id,name,mobile), creator:users!created_by(id,name), approver:users!approved_by(id,name)`)
      .eq('id', req.params.id)
      .single();
    if (error || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });

    const { data: settlements } = await supabase.from('suspense_settlements')
      .select(`*, submitter:users!submitted_by(id,name)`)
      .eq('suspense_id', req.params.id)
      .order('created_at', { ascending: true });

    const { data: attachments } = await supabase.from('voucher_attachments')
      .select('*').eq('suspense_id', req.params.id).order('uploaded_at', { ascending: false });

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
    const otpResponse = await fetch(
      `${TWOFACTOR_BASE_URL}/${TWOFACTOR_API_KEY}/SMS/${formattedMobile}/AUTOGEN/${TWOFACTOR_TEMPLATE_NAME}`
    );
    const otpData = await otpResponse.json();
    if (otpData.Status !== 'Success') {
      // Roll back status so Admin can retry
      await supabase.from('suspense_vouchers').update({ status: 'pending_approval', approved_by: null, approved_at: null }).eq('id', sv.id);
      return res.status(500).json({ error: 'Failed to send OTP to payee', details: otpData.Details });
    }
    await saveOtpSession(formattedMobile, otpData.Details, 'suspense_advance', null, sv.id);

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

    // Verify OTP via 2Factor
    const formattedMobile = formatMobile(payee.mobile);
    const session = await getOtpSession(formattedMobile);
    if (!session) {
      return res.status(400).json({ error: 'No active OTP session found. Please resend OTP first.' });
    }
    const result = await call2FactorAPI(
      `/SMS/VERIFY/${session.sessionId}/${otp}`,
      `Verify advance OTP for suspense ${sv.serial_number}`
    );
    if (!result.success || result.data.Details !== 'OTP Matched') {
      return res.status(400).json({ error: 'Invalid OTP', details: result.data?.Details });
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
    const smsMessage = `Your settlement form for suspense voucher ${sv.serial_number} is ready. Open it here: ${settlementUrl}`;
    const smsSent = await send2FactorSms(payee.mobile, smsMessage);

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
    const otpResponse = await fetch(
      `${TWOFACTOR_BASE_URL}/${TWOFACTOR_API_KEY}/SMS/${formattedMobile}/AUTOGEN/${TWOFACTOR_TEMPLATE_NAME}`
    );
    const otpData = await otpResponse.json();
    if (otpData.Status !== 'Success') {
      return res.status(500).json({ error: 'Failed to resend OTP', details: otpData.Details });
    }
    await saveOtpSession(formattedMobile, otpData.Details, 'suspense_advance', null, sv.id);

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
    const smsMessage = `Your settlement form for suspense voucher ${sv.serial_number} is ready. Open it here: ${settlementUrl}`;
    const smsResult = await send2FactorSms(payee.mobile, smsMessage);

    res.json({
      success: true,
      smsSent: smsResult.success === true,
      smsError: smsResult.success ? undefined : (smsResult.error || smsResult.data?.Details || 'SMS delivery failed'),
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

// Manually close a suspense voucher (Accounts only)
app.post('/api/suspense-vouchers/:id/close', async (req, res) => {
  const { closedBy } = req.body;
  if (!closedBy) return res.status(400).json({ error: 'closedBy is required' });
  try {
    const actor = await getActorRole(closedBy);
    if (actor.role !== 'accounts' && !actor.is_super_admin) {
      return res.status(403).json({ error: 'Unauthorized: Only Accounts users can close a suspense voucher' });
    }
    const { data: sv, error } = await supabase.from('suspense_vouchers')
      .select('id, status, serial_number')
      .eq('id', req.params.id)
      .single();
    if (error || !sv) return res.status(404).json({ error: 'Suspense voucher not found' });
    if (sv.status === 'closed') return res.status(400).json({ error: 'Voucher is already closed' });
    if (sv.status === 'pending_approval' || sv.status === 'rejected') {
      return res.status(400).json({ error: `Cannot close a voucher in "${sv.status}" state` });
    }
    await supabase.from('suspense_vouchers')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', sv.id);
    // Invalidate all active settlement sessions so SMS links stop working
    await supabase.from('settlement_sessions')
      .update({ expires_at: new Date().toISOString() })
      .eq('suspense_id', sv.id);
    res.json({ success: true });
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

    // Notify staff via SMS
    if (sv.staff_payee_id) {
      const { data: payee } = await supabase.from('payees').select('name, mobile').eq('id', sv.staff_payee_id).single();
      if (payee?.mobile) {
        const { data: approver } = await supabase.from('users').select('name').eq('id', approvedBy).single();
        const smsMessage = `Hi ${payee.name}, your suspense account ${sv.serial_number} has been topped up by ₹${parseFloat(settlement.amount).toFixed(2)}. New balance: ₹${balance.toFixed(2)}. - ${approver?.name || 'Admin'}`;
        await send2FactorSms(payee.mobile, smsMessage);
      }
    }

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
  const { paidBy, paymentReference, paymentNotes, receiptData, receiptMimeType } = req.body;
  if (!paidBy) return res.status(400).json({ error: 'paidBy is required' });
  if (!paymentReference && !receiptData)
    return res.status(400).json({ error: 'Please enter a UTR reference or upload a receipt — at least one is required' });

  try {
    const actor = await getActorRole(paidBy);
    if (actor.role !== 'accounts' && !actor.is_super_admin)
      return res.status(403).json({ error: 'Only Accounts users can confirm payment' });

    const { data: voucher, error: vErr } = await supabase.from('vouchers')
      .select('*, preparer:users!vouchers_prepared_by_fkey(name)')
      .eq('id', req.params.voucherId).single();

    if (vErr || !voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (!['awaiting_payment', 'completed'].includes(voucher.status))
      return res.status(400).json({ error: `Voucher must be awaiting_payment or completed to mark as paid (current: ${voucher.status})` });

    // Upload receipt if provided
    let receiptUrl = null;
    if (receiptData && receiptMimeType) {
      const ext = receiptMimeType === 'application/pdf' ? 'pdf'
        : receiptMimeType.startsWith('image/') ? receiptMimeType.split('/')[1]
        : 'jpg';
      const fileName = `payment-receipts/${req.params.voucherId}/receipt_${Date.now()}.${ext}`;
      const buffer = Buffer.from(receiptData, 'base64');
      const { error: storageErr } = await supabase.storage
        .from('voucher-bills')
        .upload(fileName, buffer, { contentType: receiptMimeType, upsert: true });
      if (storageErr) {
        console.warn('Receipt upload failed (storage):', storageErr.message, '— continuing without receipt URL');
      } else {
        const { data: urlData } = supabase.storage.from('voucher-bills').getPublicUrl(fileName);
        receiptUrl = urlData.publicUrl;
      }
    }

    const { error: upErr } = await supabase.from('vouchers').update({
      status: 'paid',
      payment_reference: paymentReference || null,
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

    console.log(`   ✅ Voucher ${voucher.serial_number} marked paid by ${paidBy} — UTR: ${paymentReference || 'N/A'} | Receipt: ${receiptUrl ? 'uploaded' : 'none'}`);
    res.json({ success: true, message: 'Voucher marked as paid.' });
  } catch (error) {
    console.error('mark-paid error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Dequeue voucher: awaiting_payment → completed (defer payment)
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export the Express app for Vercel serverless deployment
module.exports = app;

// Only start server if running locally (not in Vercel)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🚀 Relish Approval Server running on http://localhost:${PORT}`));
}
