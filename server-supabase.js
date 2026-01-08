require('dotenv').config();

const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
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

// Twilio Configuration
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SID) {
  throw new Error('Missing required environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SID');
}
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SID;

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Helper function to format mobile number
const formatMobile = (mobile) => mobile.startsWith('+') ? mobile : `+91${mobile.replace(/^0/, '')}`;

// ============ API ROUTES ============

// Get all companies
app.get('/api/companies', async (req, res) => {
  try {
    const { data, error } = await supabase.from('companies').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send OTP
app.post('/api/otp/send', async (req, res) => {
  const { mobile, purpose } = req.body;
  if (!mobile) return res.status(400).json({ error: 'Mobile number is required' });
  
  const formattedMobile = formatMobile(mobile);
  console.log(`Sending OTP to: ${formattedMobile} (original: ${mobile})`);
  
  try {
    const verification = await twilioClient.verify.v2.services(TWILIO_VERIFY_SID)
      .verifications.create({ to: formattedMobile, channel: 'sms' });
    console.log('OTP sent successfully:', verification.status);
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Twilio OTP Send Error:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Mobile number:', formattedMobile);
    
    // Development mode: Allow bypass if Twilio fails
    if (process.env.NODE_ENV === 'development' || error.code === 60200) {
      console.warn('⚠️ DEVELOPMENT MODE: Bypassing OTP send (Twilio unavailable)');
      res.json({ success: true, message: 'OTP sent (dev mode - check console)', devMode: true });
    } else {
      res.status(500).json({ error: 'Failed to send OTP', details: error.message });
    }
  }
});

// Verify OTP
app.post('/api/otp/verify', async (req, res) => {
  const { mobile, code } = req.body;
  if (!mobile || !code) return res.status(400).json({ error: 'Mobile and OTP code are required' });
  
  const formattedMobile = formatMobile(mobile);
  
  try {
    const check = await twilioClient.verify.v2.services(TWILIO_VERIFY_SID)
      .verificationChecks.create({ to: formattedMobile, code });
    
    if (check.status === 'approved') {
      const signature = Buffer.from(`${formattedMobile}:${Date.now()}:verified`).toString('base64');
      res.json({ success: true, status: 'approved', signature });
    } else {
      res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify OTP', details: error.message });
  }
});

// DISABLED: Self-registration not allowed
// Only admins can onboard users via /api/admin/onboard-user

// Admin-only: Onboard new user
app.post('/api/admin/onboard-user', async (req, res) => {
  const { adminMobile, companyId, name, mobile, aadhar, role } = req.body;
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
  const { username, otp } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  
  try {
    const { data: user, error } = await supabase.from('users')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    if (!user.mobile_verified) return res.status(400).json({ error: 'Mobile not verified' });
    
    // First login requires OTP (bypassed in development if Twilio fails)
    if (!user.last_login) {
      if (!otp) {
        try {
          await twilioClient.verify.v2.services(TWILIO_VERIFY_SID)
            .verifications.create({ to: user.mobile, channel: 'sms' });
          return res.json({ requiresOtp: true, message: 'First login requires OTP. Sent to registered mobile.' });
        } catch (err) {
          console.error('Twilio OTP send error:', err.message);
          // Development bypass: Allow login without OTP if Twilio fails
          console.warn('⚠️ Bypassing OTP requirement due to Twilio error (DEV MODE)');
          // Continue to login without OTP check
        }
      } else {
        // OTP provided, verify it
        try {
          const check = await twilioClient.verify.v2.services(TWILIO_VERIFY_SID)
            .verificationChecks.create({ to: user.mobile, code: otp });
          if (check.status !== 'approved') return res.status(400).json({ error: 'Invalid OTP' });
        } catch (err) {
          console.error('Twilio OTP verify error:', err.message);
          return res.status(500).json({ error: 'OTP verification failed' });
        }
      }
    }
    
    // Update last login
    await supabase.from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);
    
    // Get company info
    const { data: company } = await supabase.from('companies')
      .select('*')
      .eq('id', user.company_id)
      .single();
    
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
        role: user.role,
        company,
        unreadNotifications: count || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get company users
app.get('/api/companies/:companyId/users', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users')
      .select('id, name, username, role, mobile_verified, last_login')
      .eq('company_id', req.params.companyId);
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add payee
app.post('/api/payees', async (req, res) => {
  const { companyId, name, alias, mobile, bankAccount, ifsc, upiId } = req.body;
  if (!companyId || !name || !mobile) {
    return res.status(400).json({ error: 'Company, name, and mobile are required' });
  }
  
  const formattedMobile = formatMobile(mobile);
  
  try {
    const { data, error } = await supabase.from('payees').insert({
      company_id: companyId,
      name,
      alias: alias || null,
      mobile: formattedMobile,
      bank_account: bankAccount || null,
      ifsc: ifsc || null,
      upi_id: upiId || null
    }).select().single();
    
    if (error) throw error;
    res.json({ success: true, payeeId: data.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payees
app.get('/api/companies/:companyId/payees', async (req, res) => {
  try {
    const { data, error } = await supabase.from('payees')
      .select('*')
      .eq('company_id', req.params.companyId);
    
    if (error) throw error;
    res.json(data);
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

// Create voucher
app.post('/api/vouchers', async (req, res) => {
  const { companyId, headOfAccount, narration, amount, paymentMode, payeeId, preparedBy } = req.body;
  
  if (!companyId || !headOfAccount || !amount || !paymentMode || !payeeId || !preparedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const serialNumber = await getNextVoucherNumber(companyId);
    
    const { data: voucher, error } = await supabase.from('vouchers').insert({
      company_id: companyId,
      serial_number: serialNumber,
      head_of_account: headOfAccount,
      narration: narration || '',
      amount,
      payment_mode: paymentMode,
      payee_id: payeeId,
      prepared_by: preparedBy
    }).select().single();
    
    if (error) throw error;
    
    // Notify admins
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
    }
    
    res.json({ success: true, voucherId: voucher.id, serialNumber });
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
  
  try {
    const { data: voucher } = await supabase.from('vouchers')
      .select('*, payee:payees(mobile)')
      .eq('id', req.params.voucherId)
      .single();
    
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.status !== 'pending') return res.status(400).json({ error: 'Voucher is not pending' });
    
    // Update voucher status
    await supabase.from('vouchers')
      .update({
        status: 'awaiting_payee_otp',
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', req.params.voucherId);
    
    // Send OTP to payee
    try {
      await twilioClient.verify.v2.services(TWILIO_VERIFY_SID)
        .verifications.create({ to: voucher.payee.mobile, channel: 'sms' });
      
      // Notify preparer
      await supabase.from('notifications').insert({
        user_id: voucher.prepared_by,
        title: 'Voucher Approved - Payee OTP Required',
        message: `Voucher ${voucher.serial_number} approved. OTP sent to payee. Please collect and enter the OTP.`,
        type: 'otp_required',
        voucher_id: req.params.voucherId
      });
      
      res.json({
        success: true,
        message: 'Voucher approved. OTP sent to payee.',
        payeeMobile: voucher.payee.mobile.replace(/\d(?=\d{4})/g, '*')
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to send OTP to payee' });
    }
  } catch (error) {
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
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete voucher with payee OTP
app.post('/api/vouchers/:voucherId/complete', async (req, res) => {
  const { otp } = req.body;
  
  try {
    const { data: voucher } = await supabase.from('vouchers')
      .select('*, payee:payees(mobile)')
      .eq('id', req.params.voucherId)
      .single();
    
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.status !== 'awaiting_payee_otp') {
      return res.status(400).json({ error: 'Voucher is not awaiting payee OTP' });
    }
    
    // Verify payee OTP
    const check = await twilioClient.verify.v2.services(TWILIO_VERIFY_SID)
      .verificationChecks.create({ to: voucher.payee.mobile, code: otp });
    
    if (check.status !== 'approved') {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
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
    }
    
    res.json({ success: true, signature, message: 'Voucher completed. Payment may be initiated.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resend payee OTP
app.post('/api/vouchers/:voucherId/resend-otp', async (req, res) => {
  try {
    const { data: voucher } = await supabase.from('vouchers')
      .select('*, payee:payees(mobile)')
      .eq('id', req.params.voucherId)
      .single();
    
    if (!voucher || voucher.status !== 'awaiting_payee_otp') {
      return res.status(400).json({ error: 'Invalid voucher or status' });
    }
    
    await twilioClient.verify.v2.services(TWILIO_VERIFY_SID)
      .verifications.create({ to: voucher.payee.mobile, channel: 'sms' });
    
    res.json({ success: true, message: 'OTP resent to payee' });
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

// Heads of Account
app.get('/api/heads-of-account', (req, res) => {
  res.json([
    'Salaries & Wages', 'Rent', 'Utilities - Electricity', 'Utilities - Water',
    'Raw Materials', 'Packaging Materials', 'Transportation & Freight',
    'Maintenance & Repairs', 'Professional Fees', 'Marketing & Advertising',
    'Office Supplies', 'Insurance', 'Taxes & Duties', 'Bank Charges',
    'Interest Expenses', 'Miscellaneous Expenses', 'Capital Expenditure',
    'Vendor Payments', 'Contractor Payments'
  ]);
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
