require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
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
const saveOtpSession = async (mobile, sessionId, purpose, voucherId = null) => {
  // Delete any existing session for this mobile
  await supabase.from('otp_sessions').delete().eq('mobile', mobile);
  
  // Insert new session
  const { error } = await supabase.from('otp_sessions').insert({
    mobile,
    session_id: sessionId,
    purpose,
    voucher_id: voucherId
  });
  
  if (error) console.error('Error saving OTP session:', error);
  return !error;
};

const getOtpSession = async (mobile) => {
  const { data, error } = await supabase.from('otp_sessions')
    .select('*')
    .eq('mobile', mobile)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
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
  if (!adminMobile || !companyId || !name || !mobile || !aadhar || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  try {
    // Verify admin privileges
    const { data: admin, error: adminError } = await supabase.from('users')
      .select('role')
      .eq('mobile', formatMobile(adminMobile))
      .eq('role', 'admin')
      .single();
    
    if (adminError || !admin) {
      return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }
    
    const firstName = name.split(' ')[0];
    const rolePrefix = role === 'admin' ? 'Approve' : 'Accounts';
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
  const { name, mobile, aadhar, role } = req.body;
  
  if (!name || !mobile || !aadhar || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  try {
    const firstName = name.split(' ')[0];
    const rolePrefix = role === 'admin' ? 'Approve' : 'Accounts';
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
  const { companyAccess } = req.body;
  
  if (!companyAccess || !Array.isArray(companyAccess) || companyAccess.length === 0) {
    return res.status(400).json({ error: 'At least one company access is required' });
  }
  
  try {
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

// Delete user (Admin only)
app.delete('/api/users/:userId', async (req, res) => {
  try {
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
    if (!companyId) {
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
    // User must have selected a company at this point
    const match = companies.find(uc => uc.company_id === companyId);
    if (!match) {
      return res.status(403).json({ error: 'User does not have access to this company' });
    }
    const selectedCompany = match.companies;
    const selectedRole = match.role;
    
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
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        mobile: user.mobile,
        role: selectedRole,
        company: selectedCompany,
        companies: companies.map(uc => ({
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
      .select('id, name, username, mobile')
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
  const { companyId, name, alias, mobile, bankAccount, ifsc, upiId, isGlobal, payeeType, requiresOtp } = req.body;
  if (!companyId || !name || !mobile) {
    return res.status(400).json({ error: 'Company, name, and mobile are required' });
  }
  
  const formattedMobile = formatMobile(mobile);
  
  // Determine if OTP is required based on payee type
  const isAdhoc = payeeType === 'adhoc';
  const otpRequired = requiresOtp !== undefined ? requiresOtp : !isAdhoc;
  
  try {
    const { data, error } = await supabase.from('payees').insert({
      company_id: companyId,
      name,
      alias: alias || null,
      mobile: formattedMobile,
      bank_account: bankAccount || null,
      ifsc: ifsc || null,
      upi_id: upiId || null,
      is_global: isGlobal || false,
      payee_type: payeeType || 'registered',
      requires_otp: otpRequired
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
  const { name, alias, mobile, bank_account, ifsc, upi_id, is_global, payee_type, requires_otp } = req.body;
  
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

// Get next voucher number
const getNextVoucherNumber = async (companyId) => {
  const { data, error } = await supabase.rpc('get_next_voucher_number', { p_company_id: companyId });
  if (error) throw error;
  return data;
};

// Create voucher (submit for approval) or save as draft
app.post('/api/vouchers', async (req, res) => {
  const { companyId, headOfAccount, subHeadOfAccount, narration, narrationItems, amount, paymentMode, payeeId, preparedBy, saveAsDraft, invoiceReference } = req.body;
  
  if (!companyId || !headOfAccount || !amount || !paymentMode || !payeeId || !preparedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const serialNumber = await getNextVoucherNumber(companyId);
    const status = saveAsDraft ? 'draft' : 'pending';
    
    const { data: voucher, error } = await supabase.from('vouchers').insert({
      company_id: companyId,
      serial_number: serialNumber,
      head_of_account: headOfAccount,
      sub_head_of_account: subHeadOfAccount || null,
      narration: narration || '',
      narration_items: narrationItems || [],
      amount,
      payment_mode: paymentMode,
      payee_id: payeeId,
      prepared_by: preparedBy,
      status: status,
      submitted_at: saveAsDraft ? null : new Date().toISOString(),
      invoice_reference: invoiceReference || null
    }).select().single();
    
    if (error) throw error;
    
    // Only notify admins if submitting (not drafts)
    if (!saveAsDraft) {
      const { data: admins } = await supabase.from('users')
        .select('id')
        .eq('company_id', companyId)
        .eq('role', 'admin');
      
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
  const { headOfAccount, subHeadOfAccount, narration, narrationItems, amount, paymentMode, payeeId, invoiceReference } = req.body;
  
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
    if (amount !== undefined) updateData.amount = amount;
    if (paymentMode !== undefined) updateData.payment_mode = paymentMode;
    if (payeeId !== undefined) updateData.payee_id = payeeId;
    if (invoiceReference !== undefined) updateData.invoice_reference = invoiceReference;
    
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
    const { data: admins } = await supabase.from('users')
      .select('id')
      .eq('company_id', voucher.company_id)
      .eq('role', 'admin');
    
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
        payee:payees(name, alias, mobile),
        preparer:users!vouchers_prepared_by_fkey(name, username),
        approver:users!vouchers_approved_by_fkey(name, username),
        company:companies(name, address, gst)
      `)
      .eq('company_id', req.params.companyId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Flatten the response
    const formattedVouchers = vouchers.map(v => ({
      ...v,
      payee_name: v.payee?.name,
      payee_alias: v.payee?.alias,
      payee_mobile: v.payee?.mobile,
      preparer_name: v.preparer?.name,
      preparer_username: v.preparer?.username,
      approver_name: v.approver?.name,
      approver_username: v.approver?.username,
      company_name: v.company?.name,
      company_address: v.company?.address,
      company_gst: v.company?.gst
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
        payee:payees(name, alias, mobile, bank_account, ifsc, upi_id),
        preparer:users!vouchers_prepared_by_fkey(name, username),
        approver:users!vouchers_approved_by_fkey(name, username),
        company:companies(name, address, gst)
      `)
      .eq('id', req.params.voucherId)
      .single();
    
    if (error) throw error;
    
    res.json({
      ...voucher,
      payee_name: voucher.payee?.name,
      payee_alias: voucher.payee?.alias,
      payee_mobile: voucher.payee?.mobile,
      preparer_name: voucher.preparer?.name,
      preparer_username: voucher.preparer?.username,
      approver_name: voucher.approver?.name,
      approver_username: voucher.approver?.username,
      company_name: voucher.company?.name,
      company_address: voucher.company?.address,
      company_gst: voucher.company?.gst
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
    
    const session = await getOtpSession(formattedMobile);
    
    if (!session) {
      console.log(`   ❌ No OTP session found in DB for payee: ${formattedMobile}`);
      return res.status(400).json({ error: 'No OTP session found. Please click "Resend OTP" first.' });
    }
    
    console.log(`   📝 Session found: ${session.sessionId.substring(0, 8)}...`);
    
    const result = await call2FactorAPI(`/SMS/VERIFY/${session.sessionId}/${otp}`, `Verify Payee OTP for voucher ${req.params.voucherId}`);
    
    if (!result.success || result.data.Details !== 'OTP Matched') {
      console.log(`   ❌ OTP verification failed: ${result.data?.Details || result.error}`);
      return res.status(400).json({ error: 'Invalid OTP', details: result.data?.Details });
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

// Delete voucher (Admin only)
app.delete('/api/vouchers/:voucherId', async (req, res) => {
  try {
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
    
    // Delete existing subscriptions for this endpoint
    await supabase.from('push_subscriptions')
      .delete()
      .eq('endpoint', subscription.endpoint);
    
    // Insert new subscription
    const { error } = await supabase.from('push_subscriptions').insert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      subscription_json: JSON.stringify(subscription)
    });
    
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

// Get sub-heads of account for a head or company
app.get('/api/sub-heads-of-account', async (req, res) => {
  try {
    const { headId, companyId } = req.query;
    
    let query = supabase.from('sub_heads_of_account')
      .select('id, head_id, name, created_at')
      .order('name');
    
    if (headId) {
      query = query.eq('head_id', headId);
    } else if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      return res.status(400).json({ error: 'headId or companyId is required' });
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching sub-heads of account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all sub-heads grouped by head for a company
app.get('/api/sub-heads-of-account/grouped', async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    // Get all heads with their sub-heads
    const { data: heads, error: headsError } = await supabase.from('heads_of_account')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name');
    
    if (headsError) throw headsError;

    const { data: subHeads, error: subHeadsError } = await supabase.from('sub_heads_of_account')
      .select('id, head_id, name')
      .eq('company_id', companyId)
      .order('name');
    
    if (subHeadsError) throw subHeadsError;

    // Group sub-heads by head_id
    const grouped = heads.map(head => ({
      ...head,
      subHeads: (subHeads || []).filter(sh => sh.head_id === head.id)
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

    const { data, error } = await supabase.from('sub_heads_of_account')
      .insert({ head_id: headId, company_id: companyId, name: name.trim() })
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
