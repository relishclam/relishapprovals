const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Twilio Configuration
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SID) {
  throw new Error('Missing required environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SID');
}
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SID;

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Database Setup
const db = new Database(path.join(__dirname, 'relish_approval.db'));

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    aadhar TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('accounts', 'admin')),
    mobile_verified INTEGER DEFAULT 0,
    username TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS payees (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    alias TEXT,
    mobile TEXT NOT NULL,
    bank_account TEXT,
    ifsc TEXT,
    upi_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS voucher_series (
    id TEXT PRIMARY KEY,
    company_id TEXT UNIQUE NOT NULL,
    current_number INTEGER DEFAULT 0,
    prefix TEXT DEFAULT 'VCH',
    financial_year TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    head_of_account TEXT NOT NULL,
    narration TEXT,
    amount REAL NOT NULL,
    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('UPI', 'Account Transfer', 'Cash')),
    payee_id TEXT NOT NULL,
    prepared_by TEXT NOT NULL,
    approved_by TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'awaiting_payee_otp', 'completed', 'rejected')),
    payee_otp_verified INTEGER DEFAULT 0,
    payee_signature TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (payee_id) REFERENCES payees(id),
    FOREIGN KEY (prepared_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    read INTEGER DEFAULT 0,
    voucher_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Seed Companies
const companies = [
  { id: 'relish-foods', name: 'Relish Foods Pvt Ltd', address: '17/9 B, Madhavapuram, Kanyakumari 629704. TN; India.' },
  { id: 'relish-hhc', name: 'Relish Hao Hao Chi Foods', address: '26/599, M.O.Ward, Alappuzha 688001. KL; India.' }
];

const insertCompany = db.prepare('INSERT OR IGNORE INTO companies (id, name, address) VALUES (?, ?, ?)');
const insertVoucherSeries = db.prepare('INSERT OR IGNORE INTO voucher_series (id, company_id, current_number, prefix, financial_year) VALUES (?, ?, 0, \'VCH\', \'2024-25\')');

companies.forEach(c => {
  insertCompany.run(c.id, c.name, c.address);
  insertVoucherSeries.run(uuidv4(), c.id);
});

// Get all companies
app.get('/api/companies', (req, res) => {
  res.json(db.prepare('SELECT * FROM companies').all());
});

// Send OTP
app.post('/api/otp/send', async (req, res) => {
  const { mobile, purpose } = req.body;
  if (!mobile) return res.status(400).json({ error: 'Mobile number is required' });
  
  const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile.replace(/^0/, '')}`;
  
  try {
    await twilioClient.verify.v2.services(TWILIO_VERIFY_SID).verifications.create({ to: formattedMobile, channel: 'sms' });
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Twilio Error:', error);
    res.status(500).json({ error: 'Failed to send OTP', details: error.message });
  }
});

// Verify OTP
app.post('/api/otp/verify', async (req, res) => {
  const { mobile, code } = req.body;
  if (!mobile || !code) return res.status(400).json({ error: 'Mobile and OTP code are required' });
  
  const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile.replace(/^0/, '')}`;
  
  try {
    const check = await twilioClient.verify.v2.services(TWILIO_VERIFY_SID).verificationChecks.create({ to: formattedMobile, code });
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

// Register user
app.post('/api/users/register', (req, res) => {
  const { companyId, name, mobile, aadhar, role } = req.body;
  if (!companyId || !name || !mobile || !aadhar || !role) return res.status(400).json({ error: 'All fields are required' });
  
  const firstName = name.split(' ')[0];
  const rolePrefix = role === 'admin' ? 'Approve' : 'Accounts';
  const username = `${rolePrefix}-${firstName}`;
  const userId = uuidv4();
  const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile.replace(/^0/, '')}`;
  
  try {
    db.prepare('INSERT INTO users (id, company_id, name, first_name, mobile, aadhar, role, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(userId, companyId, name, firstName, formattedMobile, aadhar, role, username);
    res.json({ success: true, userId, username });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) return res.status(400).json({ error: 'Mobile number already registered' });
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// Verify user mobile
app.post('/api/users/:userId/verify-mobile', (req, res) => {
  db.prepare('UPDATE users SET mobile_verified = 1 WHERE id = ?').run(req.params.userId);
  res.json({ success: true });
});

// Login
app.post('/api/users/login', async (req, res) => {
  const { username, otp } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.mobile_verified) return res.status(400).json({ error: 'Mobile not verified' });
  
  // First login requires OTP
  if (!user.last_login) {
    if (!otp) {
      try {
        await twilioClient.verify.v2.services(TWILIO_VERIFY_SID).verifications.create({ to: user.mobile, channel: 'sms' });
        return res.json({ requiresOtp: true, message: 'First login requires OTP. Sent to registered mobile.' });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to send OTP' });
      }
    }
    try {
      const check = await twilioClient.verify.v2.services(TWILIO_VERIFY_SID).verificationChecks.create({ to: user.mobile, code: otp });
      if (check.status !== 'approved') return res.status(400).json({ error: 'Invalid OTP' });
    } catch (error) {
      return res.status(500).json({ error: 'OTP verification failed' });
    }
  }
  
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(user.company_id);
  const notifCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(user.id);
  
  res.json({
    success: true,
    user: { id: user.id, name: user.name, username: user.username, role: user.role, company, unreadNotifications: notifCount.count }
  });
});

// Get company users
app.get('/api/companies/:companyId/users', (req, res) => {
  res.json(db.prepare('SELECT id, name, username, role, mobile_verified, last_login FROM users WHERE company_id = ?').all(req.params.companyId));
});

// Add payee
app.post('/api/payees', (req, res) => {
  const { companyId, name, alias, mobile, bankAccount, ifsc, upiId } = req.body;
  if (!companyId || !name || !mobile) return res.status(400).json({ error: 'Company, name, and mobile are required' });
  
  const payeeId = uuidv4();
  const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile.replace(/^0/, '')}`;
  
  db.prepare('INSERT INTO payees (id, company_id, name, alias, mobile, bank_account, ifsc, upi_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(payeeId, companyId, name, alias || null, formattedMobile, bankAccount || null, ifsc || null, upiId || null);
  res.json({ success: true, payeeId });
});

// Get payees
app.get('/api/companies/:companyId/payees', (req, res) => {
  res.json(db.prepare('SELECT * FROM payees WHERE company_id = ?').all(req.params.companyId));
});

// Get next voucher number
const getNextVoucherNumber = (companyId) => {
  const series = db.prepare('SELECT * FROM voucher_series WHERE company_id = ?').get(companyId);
  const nextNumber = series.current_number + 1;
  db.prepare('UPDATE voucher_series SET current_number = ? WHERE company_id = ?').run(nextNumber, companyId);
  return `${series.prefix}-${series.financial_year}-${String(nextNumber).padStart(5, '0')}`;
};

// Create voucher
app.post('/api/vouchers', (req, res) => {
  const { companyId, headOfAccount, narration, amount, paymentMode, payeeId, preparedBy } = req.body;
  if (!companyId || !headOfAccount || !amount || !paymentMode || !payeeId || !preparedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const voucherId = uuidv4();
  const serialNumber = getNextVoucherNumber(companyId);
  
  db.prepare('INSERT INTO vouchers (id, company_id, serial_number, head_of_account, narration, amount, payment_mode, payee_id, prepared_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(voucherId, companyId, serialNumber, headOfAccount, narration || '', amount, paymentMode, payeeId, preparedBy);
  
  // Notify admins
  const admins = db.prepare('SELECT id FROM users WHERE company_id = ? AND role = ?').all(companyId, 'admin');
  const preparer = db.prepare('SELECT name FROM users WHERE id = ?').get(preparedBy);
  
  admins.forEach(admin => {
    db.prepare('INSERT INTO notifications (id, user_id, title, message, type, voucher_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), admin.id, 'New Voucher Pending Approval', `Voucher ${serialNumber} prepared by ${preparer.name} requires your approval.`, 'approval_required', voucherId);
  });
  
  res.json({ success: true, voucherId, serialNumber });
});

// Get vouchers
app.get('/api/companies/:companyId/vouchers', (req, res) => {
  const vouchers = db.prepare(`
    SELECT v.*, p.name as payee_name, p.alias as payee_alias, p.mobile as payee_mobile,
           u1.name as preparer_name, u1.username as preparer_username,
           u2.name as approver_name, u2.username as approver_username,
           c.name as company_name, c.address as company_address
    FROM vouchers v
    LEFT JOIN payees p ON v.payee_id = p.id
    LEFT JOIN users u1 ON v.prepared_by = u1.id
    LEFT JOIN users u2 ON v.approved_by = u2.id
    LEFT JOIN companies c ON v.company_id = c.id
    WHERE v.company_id = ?
    ORDER BY v.created_at DESC
  `).all(req.params.companyId);
  
  res.json(vouchers);
});

// Get single voucher
app.get('/api/vouchers/:voucherId', (req, res) => {
  const voucher = db.prepare(`
    SELECT v.*, p.name as payee_name, p.alias as payee_alias, p.mobile as payee_mobile,
           u1.name as preparer_name, u1.username as preparer_username,
           u2.name as approver_name, u2.username as approver_username,
           c.name as company_name, c.address as company_address
    FROM vouchers v
    LEFT JOIN payees p ON v.payee_id = p.id
    LEFT JOIN users u1 ON v.prepared_by = u1.id
    LEFT JOIN users u2 ON v.approved_by = u2.id
    LEFT JOIN companies c ON v.company_id = c.id
    WHERE v.id = ?
  `).get(req.params.voucherId);
  
  if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
  res.json(voucher);
});

// Approve voucher
app.post('/api/vouchers/:voucherId/approve', async (req, res) => {
  const { approvedBy } = req.body;
  const voucher = db.prepare('SELECT * FROM vouchers WHERE id = ?').get(req.params.voucherId);
  
  if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
  if (voucher.status !== 'pending') return res.status(400).json({ error: 'Voucher is not pending' });
  
  const payee = db.prepare('SELECT * FROM payees WHERE id = ?').get(voucher.payee_id);
  
  db.prepare('UPDATE vouchers SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('awaiting_payee_otp', approvedBy, req.params.voucherId);
  
  try {
    await twilioClient.verify.v2.services(TWILIO_VERIFY_SID).verifications.create({ to: payee.mobile, channel: 'sms' });
    
    db.prepare('INSERT INTO notifications (id, user_id, title, message, type, voucher_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), voucher.prepared_by, 'Voucher Approved - Payee OTP Required', `Voucher ${voucher.serial_number} approved. OTP sent to payee. Please collect and enter the OTP.`, 'otp_required', req.params.voucherId);
    
    res.json({ success: true, message: 'Voucher approved. OTP sent to payee.', payeeMobile: payee.mobile.replace(/\d(?=\d{4})/g, '*') });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send OTP to payee' });
  }
});

// Reject voucher
app.post('/api/vouchers/:voucherId/reject', (req, res) => {
  const { rejectedBy, reason } = req.body;
  const voucher = db.prepare('SELECT * FROM vouchers WHERE id = ?').get(req.params.voucherId);
  
  if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
  
  db.prepare('UPDATE vouchers SET status = ?, approved_by = ? WHERE id = ?').run('rejected', rejectedBy, req.params.voucherId);
  
  const rejecter = db.prepare('SELECT name FROM users WHERE id = ?').get(rejectedBy);
  db.prepare('INSERT INTO notifications (id, user_id, title, message, type, voucher_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), voucher.prepared_by, 'Voucher Rejected', `Voucher ${voucher.serial_number} rejected by ${rejecter.name}. Reason: ${reason || 'Not specified'}`, 'rejected', req.params.voucherId);
  
  res.json({ success: true });
});

// Complete voucher with payee OTP
app.post('/api/vouchers/:voucherId/complete', async (req, res) => {
  const { otp } = req.body;
  const voucher = db.prepare('SELECT v.*, p.mobile as payee_mobile FROM vouchers v JOIN payees p ON v.payee_id = p.id WHERE v.id = ?').get(req.params.voucherId);
  
  if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
  if (voucher.status !== 'awaiting_payee_otp') return res.status(400).json({ error: 'Voucher is not awaiting payee OTP' });
  
  try {
    const check = await twilioClient.verify.v2.services(TWILIO_VERIFY_SID).verificationChecks.create({ to: voucher.payee_mobile, code: otp });
    
    if (check.status !== 'approved') return res.status(400).json({ error: 'Invalid OTP' });
    
    const signature = Buffer.from(`${voucher.payee_mobile}:${req.params.voucherId}:${Date.now()}:verified`).toString('base64');
    
    db.prepare('UPDATE vouchers SET status = ?, payee_otp_verified = 1, payee_signature = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('completed', signature, req.params.voucherId);
    
    if (voucher.approved_by) {
      db.prepare('INSERT INTO notifications (id, user_id, title, message, type, voucher_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), voucher.approved_by, 'Voucher Completed - Ready for Payment', `Voucher ${voucher.serial_number} is complete. Payment may be initiated.`, 'completed', req.params.voucherId);
    }
    
    res.json({ success: true, signature, message: 'Voucher completed. Payment may be initiated.' });
  } catch (error) {
    res.status(500).json({ error: 'OTP verification failed' });
  }
});

// Resend payee OTP
app.post('/api/vouchers/:voucherId/resend-otp', async (req, res) => {
  const voucher = db.prepare('SELECT v.*, p.mobile as payee_mobile FROM vouchers v JOIN payees p ON v.payee_id = p.id WHERE v.id = ?').get(req.params.voucherId);
  
  if (!voucher || voucher.status !== 'awaiting_payee_otp') return res.status(400).json({ error: 'Invalid voucher or status' });
  
  try {
    await twilioClient.verify.v2.services(TWILIO_VERIFY_SID).verifications.create({ to: voucher.payee_mobile, channel: 'sms' });
    res.json({ success: true, message: 'OTP resent to payee' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

// Notifications
app.get('/api/users/:userId/notifications', (req, res) => {
  res.json(db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.params.userId));
});

app.post('/api/notifications/:notificationId/read', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.notificationId);
  res.json({ success: true });
});

app.post('/api/users/:userId/notifications/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.params.userId);
  res.json({ success: true });
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Relish Approval Server running on http://localhost:${PORT}`));
