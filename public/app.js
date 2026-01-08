const { useState, useEffect, createContext, useContext, useCallback } = React;

const API_BASE = '/api';

// Simple SVG Icons
const Icons = {
  building: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>,
  fileText: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  bell: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  logOut: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>,
  check: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>,
  x: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  clock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  checkCircle: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>,
  eye: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  smartphone: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>,
  shield: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>,
  home: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  user: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  users: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  loader: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  refresh: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>,
  send: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  download: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
  printer: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>,
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
  menu: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="18" y2="18"/></svg>,
};

// API Functions
const api = {
  getCompanies: () => fetch(`${API_BASE}/companies`).then(r => r.json()),
  registerUser: (data) => fetch(`${API_BASE}/users/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  verifyUserMobile: (userId) => fetch(`${API_BASE}/users/${userId}/verify-mobile`, { method: 'POST' }).then(r => r.json()),
  login: (data) => fetch(`${API_BASE}/users/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  getCompanyUsers: (companyId) => fetch(`${API_BASE}/companies/${companyId}/users`).then(r => r.json()),
  onboardUser: (data) => fetch(`${API_BASE}/admin/onboard-user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  sendOtp: (mobile, purpose) => fetch(`${API_BASE}/otp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile, purpose }) }).then(r => r.json()),
  verifyOtp: (mobile, code) => fetch(`${API_BASE}/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile, code }) }).then(r => r.json()),
  addPayee: (data) => fetch(`${API_BASE}/payees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  getPayees: (companyId) => fetch(`${API_BASE}/companies/${companyId}/payees`).then(r => r.json()),
  createVoucher: (data) => fetch(`${API_BASE}/vouchers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  getVouchers: (companyId) => fetch(`${API_BASE}/companies/${companyId}/vouchers`).then(r => r.json()),
  getVoucher: (voucherId) => fetch(`${API_BASE}/vouchers/${voucherId}`).then(r => r.json()),
  approveVoucher: (voucherId, approvedBy) => fetch(`${API_BASE}/vouchers/${voucherId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvedBy }) }).then(r => r.json()),
  rejectVoucher: (voucherId, rejectedBy, reason) => fetch(`${API_BASE}/vouchers/${voucherId}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rejectedBy, reason }) }).then(r => r.json()),
  completeVoucher: (voucherId, otp) => fetch(`${API_BASE}/vouchers/${voucherId}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp }) }).then(r => r.json()),
  resendPayeeOtp: (voucherId) => fetch(`${API_BASE}/vouchers/${voucherId}/resend-otp`, { method: 'POST' }).then(r => r.json()),
  getNotifications: (userId) => fetch(`${API_BASE}/users/${userId}/notifications`).then(r => r.json()),
  markAllNotificationsRead: (userId) => fetch(`${API_BASE}/users/${userId}/notifications/read-all`, { method: 'POST' }).then(r => r.json()),
  getHeadsOfAccount: () => fetch(`${API_BASE}/heads-of-account`).then(r => r.json()),
};

// Context
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

// Toast Component
const Toast = ({ toasts }) => (
  <div className="toast-container">
    {toasts.map(t => (
      <div key={t.id} className={`toast ${t.type}`}>
        <span>{t.message}</span>
      </div>
    ))}
  </div>
);

// PWA Install Prompt
const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if user dismissed before
      if (!localStorage.getItem('pwa-install-dismissed')) {
        setShowPrompt(true);
      }
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowPrompt(false);
    }
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="pwa-install-banner">
      <div className="pwa-install-content">
        <div className="pwa-install-icon">{Icons.download}</div>
        <div>
          <div className="pwa-install-title">Install App</div>
          <div className="pwa-install-text">Add to home screen for quick access</div>
        </div>
      </div>
      <div className="pwa-install-actions">
        <button className="btn btn-sm btn-secondary" onClick={handleDismiss}>Later</button>
        <button className="btn btn-sm btn-primary" onClick={handleInstall}>Install</button>
      </div>
    </div>
  );
};

// OTP Input
const OTPInput = ({ length = 6, value = '', onChange }) => {
  const handleChange = (index, digit) => {
    if (!/^\d*$/.test(digit)) return;
    const newValue = value.split('');
    newValue[index] = digit;
    onChange(newValue.join(''));
    if (digit && index < length - 1) document.getElementById(`otp-${index + 1}`)?.focus();
  };
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) document.getElementById(`otp-${index - 1}`)?.focus();
  };
  return (
    <div className="otp-container">
      {Array.from({ length }, (_, i) => (
        <input key={i} id={`otp-${i}`} type="text" maxLength={1} className="otp-input"
          value={value[i] || ''} onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)} />
      ))}
    </div>
  );
};

// Voucher Preview
const VoucherPreview = ({ voucher }) => {
  const formatDate = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatCurrency = (a) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(a);
  return (
    <div className="voucher-preview">
      <div className="voucher-header">
        <div className="voucher-company">{voucher.company_name}</div>
        <div className="voucher-address">{voucher.company_address}</div>
        <div className="voucher-title">PAYMENT VOUCHER</div>
      </div>
      <div className="voucher-meta">
        <div className="voucher-meta-item"><span className="voucher-meta-label">Voucher No:</span><span className="voucher-meta-value">{voucher.serial_number}</span></div>
        <div className="voucher-meta-item"><span className="voucher-meta-label">Date:</span><span className="voucher-meta-value">{formatDate(voucher.created_at)}</span></div>
        <div className="voucher-meta-item"><span className="voucher-meta-label">Payee:</span><span className="voucher-meta-value">{voucher.payee_name} {voucher.payee_alias && `(${voucher.payee_alias})`}</span></div>
        <div className="voucher-meta-item"><span className="voucher-meta-label">Mode:</span><span className="voucher-meta-value">{voucher.payment_mode}</span></div>
      </div>
      <div className="voucher-meta-item mb-1"><span className="voucher-meta-label">Head:</span><span className="voucher-meta-value">{voucher.head_of_account}</span></div>
      {voucher.narration && <div className="voucher-meta-item mb-1"><span className="voucher-meta-label">Narration:</span><span className="voucher-meta-value">{voucher.narration}</span></div>}
      <div className="voucher-total">TOTAL: {formatCurrency(voucher.amount)}</div>
      <div className="voucher-signatures">
        <div className="voucher-signature"><div className="voucher-signature-line">{voucher.preparer_username}</div><div className="voucher-signature-label">Prepared By</div></div>
        <div className="voucher-signature"><div className="voucher-signature-line">{voucher.approver_username || '-'}</div><div className="voucher-signature-label">Approved By</div></div>
        <div className="voucher-signature"><div className="voucher-signature-line">{voucher.payee_otp_verified ? <span className="signature-verified">✓ OTP Verified</span> : '-'}</div><div className="voucher-signature-label">Payee</div></div>
      </div>
    </div>
  );
};

// Login Page
const LoginPage = ({ onLogin }) => {
  const [tab, setTab] = useState('login');
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [reg, setReg] = useState({ companyId: '', name: '', mobile: '', aadhar: '', role: 'accounts', step: 1, userId: '', otp: '' });

  useEffect(() => { api.getCompanies().then(setCompanies).catch(console.error); }, []);

  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      const result = await api.login({ username, otp: requiresOtp ? otp : undefined });
      if (result.requiresOtp) setRequiresOtp(true);
      else if (result.success) onLogin(result.user);
      else setError(result.error || 'Login failed');
    } catch { setError('Connection error'); }
    setLoading(false);
  };

  const handleRegister = async () => {
    setLoading(true); setError('');
    try {
      if (reg.step === 1) {
        const result = await api.registerUser({ companyId: reg.companyId, name: reg.name, mobile: reg.mobile, aadhar: reg.aadhar, role: reg.role });
        if (result.success) { await api.sendOtp(reg.mobile, 'registration'); setReg({ ...reg, step: 2, userId: result.userId }); }
        else setError(result.error || 'Registration failed');
      } else {
        const result = await api.verifyOtp(reg.mobile, reg.otp);
        if (result.success) { await api.verifyUserMobile(reg.userId); setReg({ ...reg, step: 3 }); }
        else setError(result.error || 'OTP verification failed');
      }
    } catch { setError('Connection error'); }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo"><img src="logo.png" alt="Relish" /></div>
        <h1 className="login-title">Payment Approval System</h1>
        <p className="login-subtitle">Secure voucher management with OTP verification</p>
        {error && <div className="alert alert-error">{error}</div>}
        <div>
          <div className="form-group"><label className="form-label">Username</label><input type="text" className="form-input" placeholder="e.g., Accounts-John or Approve-Jane" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          {requiresOtp && <div className="form-group"><label className="form-label">Enter OTP sent to your mobile</label><OTPInput value={otp} onChange={setOtp} /></div>}
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleLogin} disabled={loading || !username}>{loading && Icons.loader}{requiresOtp ? 'Verify & Sign In' : 'Sign In'}</button>
        </div>
      </div>
    </div>
  );
};

// Dashboard
const Dashboard = () => {
  const { user, vouchers } = useApp();
  const stats = { pending: vouchers.filter(v => v.status === 'pending').length, approved: vouchers.filter(v => ['approved', 'awaiting_payee_otp'].includes(v.status)).length, completed: vouchers.filter(v => v.status === 'completed').length, total: vouchers.length };
  return (
    <div>
      <div className="page-header"><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Welcome back, {user.name}</p></div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon orange">⏱</div><div className="stat-value">{stats.pending}</div><div className="stat-label">Pending Approval</div></div>
        <div className="stat-card"><div className="stat-icon purple">📋</div><div className="stat-value">{stats.approved}</div><div className="stat-label">Approved / Awaiting OTP</div></div>
        <div className="stat-card"><div className="stat-icon green">✓</div><div className="stat-value">{stats.completed}</div><div className="stat-label">Completed</div></div>
        <div className="stat-card"><div className="stat-icon teal">📄</div><div className="stat-value">{stats.total}</div><div className="stat-label">Total Vouchers</div></div>
      </div>
      <div className="card">
        <div className="card-header"><h3 className="card-title">{Icons.fileText} Recent Vouchers</h3></div>
        <div className="card-body" style={{ padding: 0 }}>
          {vouchers.length === 0 ? <div className="empty-state">{Icons.fileText}<p>No vouchers yet</p></div> : (
            <div className="table-container"><table className="table"><thead><tr><th>Serial No.</th><th>Payee</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>
              {vouchers.slice(0, 5).map(v => (<tr key={v.id}><td className="text-mono fw-600">{v.serial_number}</td><td>{v.payee_name}</td><td className="fw-600">₹{v.amount.toLocaleString('en-IN')}</td><td><span className={`status-badge status-${v.status}`}>{v.status.replace(/_/g, ' ')}</span></td><td>{new Date(v.created_at).toLocaleDateString('en-IN')}</td></tr>))}
            </tbody></table></div>
          )}
        </div>
      </div>
    </div>
  );
};

// Create Voucher
const CreateVoucher = () => {
  const { user, addToast, refreshVouchers } = useApp();
  const [loading, setLoading] = useState(false);
  const [payees, setPayees] = useState([]);
  const [heads, setHeads] = useState([]);
  const [showPayeeModal, setShowPayeeModal] = useState(false);
  const [form, setForm] = useState({ headOfAccount: '', narration: '', payeeId: '', paymentMode: 'UPI', amount: '' });
  const [newPayee, setNewPayee] = useState({ name: '', alias: '', mobile: '', bankAccount: '', ifsc: '', upiId: '' });

  useEffect(() => { api.getPayees(user.company.id).then(setPayees); api.getHeadsOfAccount().then(setHeads); }, [user.company.id]);

  const handleAddPayee = async () => {
    setLoading(true);
    try { const result = await api.addPayee({ companyId: user.company.id, ...newPayee }); if (result.success) { addToast('Payee added', 'success'); setShowPayeeModal(false); setNewPayee({ name: '', alias: '', mobile: '', bankAccount: '', ifsc: '', upiId: '' }); api.getPayees(user.company.id).then(setPayees); } } catch { addToast('Failed', 'error'); }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.headOfAccount || !form.payeeId || !form.amount) { addToast('Fill all required fields', 'error'); return; }
    setLoading(true);
    try { const result = await api.createVoucher({ companyId: user.company.id, headOfAccount: form.headOfAccount, narration: form.narration, amount: parseFloat(form.amount), paymentMode: form.paymentMode, payeeId: form.payeeId, preparedBy: user.id }); if (result.success) { addToast(`Voucher ${result.serialNumber} created`, 'success'); setForm({ headOfAccount: '', narration: '', payeeId: '', paymentMode: 'UPI', amount: '' }); refreshVouchers(); } } catch { addToast('Failed', 'error'); }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Create Payment Voucher</h1><p className="page-subtitle">Prepare a new payment voucher for approval</p></div>
      <div className="card">
        <div className="card-header"><h3 className="card-title">{Icons.fileText} Voucher Details</h3></div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group"><label className="form-label">Head of Account *</label><select className="form-select" value={form.headOfAccount} onChange={(e) => setForm({ ...form, headOfAccount: e.target.value })}><option value="">Select</option>{heads.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Payment Mode *</label><select className="form-select" value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}><option value="UPI">UPI</option><option value="Account Transfer">Account Transfer</option><option value="Cash">Cash</option></select></div>
          </div>
          <div className="form-group"><label className="form-label form-label-row">Payee *<button className="btn btn-sm btn-secondary" onClick={() => setShowPayeeModal(true)}>{Icons.plus} Add Payee</button></label><select className="form-select" value={form.payeeId} onChange={(e) => setForm({ ...form, payeeId: e.target.value })}><option value="">Select Payee</option>{payees.map(p => <option key={p.id} value={p.id}>{p.name} {p.alias && `(${p.alias})`}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Amount (₹) *</label><input type="number" className="form-input" placeholder="Enter amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Narration</label><textarea className="form-input" rows={2} placeholder="Enter payment description" value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} /></div>
          <div className="btn-group"><button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading && Icons.loader}{Icons.send} Submit for Approval</button></div>
        </div>
      </div>
      {showPayeeModal && (
        <div className="modal-overlay" onClick={() => setShowPayeeModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3 className="modal-title">Add New Payee</h3><button className="modal-close" onClick={() => setShowPayeeModal(false)}>×</button></div>
          <div className="modal-body">
            <div className="form-group"><label className="form-label">Name (as in Bank Account) *</label><input type="text" className="form-input" value={newPayee.name} onChange={(e) => setNewPayee({ ...newPayee, name: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Alias</label><input type="text" className="form-input" value={newPayee.alias} onChange={(e) => setNewPayee({ ...newPayee, alias: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Mobile Number *</label><input type="tel" className="form-input" value={newPayee.mobile} onChange={(e) => setNewPayee({ ...newPayee, mobile: e.target.value })} /></div>
            <div className="form-row"><div className="form-group"><label className="form-label">Bank Account</label><input type="text" className="form-input" value={newPayee.bankAccount} onChange={(e) => setNewPayee({ ...newPayee, bankAccount: e.target.value })} /></div><div className="form-group"><label className="form-label">IFSC Code</label><input type="text" className="form-input" value={newPayee.ifsc} onChange={(e) => setNewPayee({ ...newPayee, ifsc: e.target.value })} /></div></div>
            <div className="form-group"><label className="form-label">UPI ID</label><input type="text" className="form-input" value={newPayee.upiId} onChange={(e) => setNewPayee({ ...newPayee, upiId: e.target.value })} /></div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowPayeeModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAddPayee} disabled={loading || !newPayee.name || !newPayee.mobile}>{loading && Icons.loader}Add Payee</button></div>
        </div></div>
      )}
    </div>
  );
};

// Voucher List
const VoucherList = ({ filter }) => {
  const { user, vouchers, addToast, refreshVouchers } = useApp();
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [payeeOtp, setPayeeOtp] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printDateFrom, setPrintDateFrom] = useState('');
  const [printDateTo, setPrintDateTo] = useState('');
  const [loading, setLoading] = useState(false);

  const filtered = vouchers.filter(v => { if (filter === 'pending') return v.status === 'pending'; if (filter === 'approved') return ['approved', 'awaiting_payee_otp'].includes(v.status); if (filter === 'completed') return v.status === 'completed'; return true; });
  
  const openVoucher = async (v) => { const full = await api.getVoucher(v.id); setSelectedVoucher(full); setShowModal(true); };
  
  const handlePrintSingle = async (voucher) => {
    const full = voucher.company_name ? voucher : await api.getVoucher(voucher.id);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(generateVoucherHTML([full], 'Single Voucher'));
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };
  
  const handlePrintPeriod = () => {
    if (!printDateFrom || !printDateTo) {
      addToast('Select date range', 'error');
      return;
    }
    
    const from = new Date(printDateFrom);
    const to = new Date(printDateTo);
    to.setHours(23, 59, 59);
    
    const periodVouchers = vouchers.filter(v => {
      const vDate = new Date(v.created_at);
      return vDate >= from && vDate <= to && (filter === 'all' || 
        (filter === 'pending' && v.status === 'pending') ||
        (filter === 'approved' && ['approved', 'awaiting_payee_otp'].includes(v.status)) ||
        (filter === 'completed' && v.status === 'completed'));
    });
    
    if (periodVouchers.length === 0) {
      addToast('No vouchers in selected period', 'error');
      return;
    }
    
    // Fetch full details for all vouchers
    Promise.all(periodVouchers.map(v => api.getVoucher(v.id)))
      .then(fullVouchers => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(generateVoucherHTML(fullVouchers, `Vouchers Report: ${printDateFrom} to ${printDateTo}`));
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
        setShowPrintModal(false);
      })
      .catch(() => addToast('Failed to generate report', 'error'));
  };
  
  const generateVoucherHTML = (vouchers, title) => {
    const formatDate = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const formatCurrency = (a) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(a);
    const totalAmount = vouchers.reduce((sum, v) => sum + v.amount, 0);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 12px; }
    .report-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .report-title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
    .report-subtitle { font-size: 12px; color: #666; }
    .voucher { page-break-inside: avoid; margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; }
    .voucher-header { background: #f5f5f5; padding: 10px; margin: -15px -15px 15px; border-bottom: 2px solid #333; }
    .company-name { font-size: 16px; font-weight: bold; }
    .company-address { font-size: 10px; color: #666; margin-top: 3px; }
    .voucher-title { font-size: 14px; font-weight: bold; text-align: center; margin-top: 8px; }
    .voucher-meta { display: table; width: 100%; margin-bottom: 15px; }
    .meta-row { display: table-row; }
    .meta-label { display: table-cell; font-weight: bold; width: 150px; padding: 4px 0; }
    .meta-value { display: table-cell; padding: 4px 0; }
    .voucher-amount { font-size: 16px; font-weight: bold; text-align: right; margin: 15px 0; border-top: 1px solid #333; padding-top: 10px; }
    .voucher-signatures { display: flex; justify-content: space-between; margin-top: 40px; }
    .signature-box { text-align: center; flex: 1; }
    .signature-line { border-top: 1px solid #000; padding-top: 5px; margin: 30px 10px 5px; font-weight: bold; }
    .signature-label { font-size: 10px; color: #666; }
    .summary { margin-top: 30px; padding: 15px; background: #f5f5f5; border: 1px solid #ddd; }
    .summary-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; }
    .summary-item { display: flex; justify-content: space-between; padding: 5px 0; }
    .summary-total { font-size: 16px; font-weight: bold; border-top: 2px solid #333; margin-top: 10px; padding-top: 10px; }
    @media print {
      .no-print { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="report-title">${title}</div>
    <div class="report-subtitle">Generated on ${new Date().toLocaleString('en-IN')}</div>
  </div>
  
  ${vouchers.map(v => `
    <div class="voucher">
      <div class="voucher-header">
        <div class="company-name">${v.company_name}</div>
        <div class="company-address">${v.company_address}</div>
        <div class="voucher-title">PAYMENT VOUCHER</div>
      </div>
      
      <div class="voucher-meta">
        <div class="meta-row">
          <div class="meta-label">Voucher No:</div>
          <div class="meta-value">${v.serial_number}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">Date:</div>
          <div class="meta-value">${formatDate(v.created_at)}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">Payee:</div>
          <div class="meta-value">${v.payee_name}${v.payee_alias ? ` (${v.payee_alias})` : ''}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">Payment Mode:</div>
          <div class="meta-value">${v.payment_mode}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">Head of Account:</div>
          <div class="meta-value">${v.head_of_account}</div>
        </div>
        ${v.narration ? `
        <div class="meta-row">
          <div class="meta-label">Narration:</div>
          <div class="meta-value">${v.narration}</div>
        </div>` : ''}
        <div class="meta-row">
          <div class="meta-label">Status:</div>
          <div class="meta-value">${v.status.replace(/_/g, ' ').toUpperCase()}</div>
        </div>
      </div>
      
      <div class="voucher-amount">AMOUNT: ${formatCurrency(v.amount)}</div>
      
      <div class="voucher-signatures">
        <div class="signature-box">
          <div class="signature-line">${v.preparer_username}</div>
          <div class="signature-label">Prepared By</div>
        </div>
        <div class="signature-box">
          <div class="signature-line">${v.approver_username || '___________'}</div>
          <div class="signature-label">Approved By</div>
        </div>
        <div class="signature-box">
          <div class="signature-line">${v.payee_otp_verified ? '✓ OTP Verified' : '___________'}</div>
          <div class="signature-label">Payee Signature</div>
        </div>
      </div>
    </div>
  `).join('')}
  
  ${vouchers.length > 1 ? `
    <div class="summary">
      <div class="summary-title">Summary</div>
      <div class="summary-item">
        <span>Total Vouchers:</span>
        <span>${vouchers.length}</span>
      </div>
      <div class="summary-item">
        <span>Completed:</span>
        <span>${vouchers.filter(v => v.status === 'completed').length}</span>
      </div>
      <div class="summary-item">
        <span>Pending:</span>
        <span>${vouchers.filter(v => v.status === 'pending').length}</span>
      </div>
      <div class="summary-item summary-total">
        <span>TOTAL AMOUNT:</span>
        <span>${formatCurrency(totalAmount)}</span>
      </div>
    </div>
  ` : ''}
  
  <button class="no-print" onclick="window.print()" style="position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #F59E0B; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Print</button>
</body>
</html>`;
  };
  
  const handleApprove = async () => { setLoading(true); try { const result = await api.approveVoucher(selectedVoucher.id, user.id); if (result.success) { addToast('Voucher approved. OTP sent to payee.', 'success'); refreshVouchers(); setShowModal(false); } else addToast(result.error, 'error'); } catch { addToast('Failed', 'error'); } setLoading(false); };
  const handleReject = async () => { setLoading(true); try { await api.rejectVoucher(selectedVoucher.id, user.id, rejectReason); addToast('Voucher rejected', 'info'); refreshVouchers(); setShowRejectModal(false); setShowModal(false); } catch { addToast('Failed', 'error'); } setLoading(false); };
  const handleComplete = async () => { if (payeeOtp.length < 6) { addToast('Enter complete OTP', 'error'); return; } setLoading(true); try { const result = await api.completeVoucher(selectedVoucher.id, payeeOtp); if (result.success) { addToast('Voucher completed!', 'success'); refreshVouchers(); setShowModal(false); setPayeeOtp(''); } else addToast(result.error, 'error'); } catch { addToast('Failed', 'error'); } setLoading(false); };
  const handleResend = async () => { try { await api.resendPayeeOtp(selectedVoucher.id); addToast('OTP resent', 'success'); } catch { addToast('Failed', 'error'); } };
  const titles = { all: 'All Vouchers', pending: 'Pending Approval', approved: 'Approved / Awaiting OTP', completed: 'Completed Vouchers' };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{titles[filter]}</h1>
          <p className="page-subtitle">{filtered.length} voucher(s)</p>
        </div>
        {filtered.length > 0 && (
          <button className="btn btn-secondary" onClick={() => setShowPrintModal(true)}>
            {Icons.printer} Print Report
          </button>
        )}
      </div>
      <div className="card"><div className="card-body" style={{ padding: 0 }}>
        {filtered.length === 0 ? <div className="empty-state">{Icons.fileText}<p>No vouchers found</p></div> : (
          <div className="table-container"><table className="table"><thead><tr><th>Serial No.</th><th>Head of Account</th><th>Payee</th><th>Amount</th><th>Mode</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
            {filtered.map(v => (<tr key={v.id}><td className="text-mono fw-600">{v.serial_number}</td><td>{v.head_of_account}</td><td>{v.payee_name}</td><td className="fw-600">₹{v.amount.toLocaleString('en-IN')}</td><td>{v.payment_mode}</td><td><span className={`status-badge status-${v.status}`}>{v.status.replace(/_/g, ' ')}</span></td><td>{new Date(v.created_at).toLocaleDateString('en-IN')}</td><td><button className="btn btn-sm btn-secondary" onClick={() => openVoucher(v)}>{Icons.eye} View</button></td></tr>))}
          </tbody></table></div>
        )}
      </div></div>
      {showModal && selectedVoucher && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}><div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">Voucher Details</h3>
            <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
              <button className="btn btn-sm btn-secondary" onClick={() => handlePrintSingle(selectedVoucher)}>
                {Icons.printer} Print
              </button>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
          </div>
          <div className="modal-body">
            <VoucherPreview voucher={selectedVoucher} />
            {selectedVoucher.status === 'awaiting_payee_otp' && selectedVoucher.prepared_by === user.id && (
              <div className="otp-section">
                {Icons.smartphone}<p style={{fontWeight:500,margin:'0.5rem 0'}}>Enter Payee OTP</p><p style={{fontSize:'0.85rem',color:'#666',marginBottom:'1rem'}}>OTP sent to payee: {selectedVoucher.payee_mobile?.replace(/\d(?=\d{4})/g, '*')}</p>
                <OTPInput value={payeeOtp} onChange={setPayeeOtp} />
                <div style={{display:'flex',gap:'1rem',justifyContent:'center',marginTop:'1rem'}}><button className="btn btn-secondary btn-sm" onClick={handleResend}>{Icons.refresh} Resend OTP</button><button className="btn btn-success" onClick={handleComplete} disabled={loading || payeeOtp.length < 6}>{loading && Icons.loader}{Icons.checkCircle} Complete Voucher</button></div>
              </div>
            )}
          </div>
          {user.role === 'admin' && selectedVoucher.status === 'pending' && (
            <div className="modal-footer"><button className="btn btn-danger" onClick={() => setShowRejectModal(true)}>{Icons.x} Reject</button><button className="btn btn-success" onClick={handleApprove} disabled={loading}>{loading && Icons.loader}{Icons.check} Approve & Send Payee OTP</button></div>
          )}
        </div></div>
      )}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3 className="modal-title">Reject Voucher</h3><button className="modal-close" onClick={() => setShowRejectModal(false)}>×</button></div>
          <div className="modal-body"><div className="form-group"><label className="form-label">Reason for Rejection</label><textarea className="form-input" rows={3} placeholder="Enter reason..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} /></div></div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button><button className="btn btn-danger" onClick={handleReject} disabled={loading}>{loading && Icons.loader}Confirm Rejection</button></div>
        </div></div>
      )}
      {showPrintModal && (
        <div className="modal-overlay" onClick={() => setShowPrintModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3 className="modal-title">{Icons.calendar} Print Vouchers Report</h3><button className="modal-close" onClick={() => setShowPrintModal(false)}>×</button></div>
          <div className="modal-body">
            <p style={{marginBottom: '1rem', color: '#666'}}>Select date range for consolidated voucher report</p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">From Date</label>
                <input type="date" className="form-input" value={printDateFrom} onChange={(e) => setPrintDateFrom(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">To Date</label>
                <input type="date" className="form-input" value={printDateTo} onChange={(e) => setPrintDateTo(e.target.value)} />
              </div>
            </div>
            <div style={{background: '#f8f9fa', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem'}}>
              <strong>ℹ️ Report will include:</strong>
              <ul style={{margin: '0.5rem 0 0', paddingLeft: '1.5rem'}}>
                <li>All vouchers in selected date range</li>
                <li>Detailed voucher information</li>
                <li>Summary with total amounts</li>
                <li>Print-optimized layout</li>
              </ul>
            </div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowPrintModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handlePrintPeriod} disabled={!printDateFrom || !printDateTo}>{Icons.printer} Generate & Print</button></div>
        </div></div>
      )}
    </div>
  );
};

// Users Management (Admin Dashboard)
const UsersManagement = () => {
  const { user, addToast } = useApp();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', mobile: '', aadhar: '', role: 'accounts' });
  const [onboardStep, setOnboardStep] = useState(1); // 1=form, 2=otp, 3=success
  const [otp, setOtp] = useState('');
  const [pendingUserId, setPendingUserId] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  
  const refreshUsers = () => {
    api.getCompanyUsers(user.company.id).then(setUsers).finally(() => setLoading(false));
  };
  
  useEffect(() => { refreshUsers(); }, [user.company.id]);
  
  const handleOnboardSubmit = async () => {
    if (!newUser.name || !newUser.mobile || !newUser.aadhar) {
      addToast('All fields are required', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      // Call admin onboard endpoint
      const result = await api.onboardUser({
        adminMobile: user.mobile,
        companyId: user.company.id,
        name: newUser.name,
        mobile: newUser.mobile,
        aadhar: newUser.aadhar,
        role: newUser.role
      });
      
      if (result.success) {
        setPendingUserId(result.userId);
        setGeneratedUsername(result.username);
        // Send OTP to new user's mobile
        await api.sendOtp(newUser.mobile, 'registration');
        addToast('User created. OTP sent for verification.', 'success');
        setOnboardStep(2);
      } else {
        addToast(result.error || 'Failed to onboard user', 'error');
      }
    } catch (error) {
      addToast('Connection error', 'error');
    }
    setSubmitting(false);
  };
  
  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      addToast('Enter complete OTP', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      const result = await api.verifyOtp(newUser.mobile, otp);
      if (result.success) {
        await api.verifyUserMobile(pendingUserId);
        addToast('User verified successfully!', 'success');
        setOnboardStep(3);
        refreshUsers();
        setTimeout(() => {
          setShowOnboardModal(false);
          resetOnboardForm();
        }, 2000);
      } else {
        addToast('Invalid OTP', 'error');
      }
    } catch (error) {
      addToast('Verification failed', 'error');
    }
    setSubmitting(false);
  };
  
  const resetOnboardForm = () => {
    setNewUser({ name: '', mobile: '', aadhar: '', role: 'accounts' });
    setOnboardStep(1);
    setOtp('');
    setPendingUserId('');
    setGeneratedUsername('');
  };
  
  const handleResendOtp = async () => {
    try {
      await api.sendOtp(newUser.mobile, 'registration');
      addToast('OTP resent', 'success');
    } catch {
      addToast('Failed to resend', 'error');
    }
  };
  
  if (loading) return <div className="empty-state">{Icons.loader}</div>;
  
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{Icons.users} User Management</h1>
          <p className="page-subtitle">Onboard and manage team members</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowOnboardModal(true)}>
          {Icons.plus} Onboard New User
        </button>
      </div>
      
      <div className="stats-grid" style={{marginBottom: '2rem'}}>
        <div className="stat-card">
          <div className="stat-icon purple">👥</div>
          <div className="stat-value">{users.length}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">🛡</div>
          <div className="stat-value">{users.filter(u => u.role === 'admin').length}</div>
          <div className="stat-label">Admins</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">👤</div>
          <div className="stat-value">{users.filter(u => u.role === 'accounts').length}</div>
          <div className="stat-label">Accounts Staff</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon teal">✓</div>
          <div className="stat-value">{users.filter(u => u.mobile_verified).length}</div>
          <div className="stat-label">Verified</div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-header"><h3 className="card-title">Team Members</h3></div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Mobile</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="fw-600">{u.name}</td>
                    <td className="text-mono">{u.username}</td>
                    <td>{u.mobile?.replace(/\d(?=\d{4})/g, '*')}</td>
                    <td>
                      <span className={`status-badge ${u.role === 'admin' ? 'status-approved' : 'status-pending'}`}>
                        {u.role === 'admin' ? '🛡 Admin' : '👤 Accounts'}
                      </span>
                    </td>
                    <td>
                      {u.mobile_verified ? 
                        <span className="status-badge status-completed">✅ Verified</span> : 
                        <span className="status-badge status-rejected">⚠ Unverified</span>
                      }
                    </td>
                    <td>{u.last_login ? new Date(u.last_login).toLocaleString('en-IN') : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {showOnboardModal && (
        <div className="modal-overlay" onClick={() => { if (onboardStep !== 2) { setShowOnboardModal(false); resetOnboardForm(); } }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {onboardStep === 1 && '👤 Onboard New User'}
                {onboardStep === 2 && '📱 Verify Mobile Number'}
                {onboardStep === 3 && '✅ User Onboarded Successfully'}
              </h3>
              {onboardStep !== 2 && <button className="modal-close" onClick={() => { setShowOnboardModal(false); resetOnboardForm(); }}>×</button>}
            </div>
            
            <div className="modal-body">
              {onboardStep === 1 && (
                <>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g., John Doe"
                      value={newUser.name} 
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Mobile Number *</label>
                    <input 
                      type="tel" 
                      className="form-input" 
                      placeholder="e.g., 9876543210"
                      value={newUser.mobile} 
                      onChange={(e) => setNewUser({ ...newUser, mobile: e.target.value })} 
                    />
                    <small style={{color: '#666', fontSize: '0.85rem'}}>User will receive OTP on this number</small>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Aadhar Number *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g., 1234 5678 9012"
                      value={newUser.aadhar} 
                      onChange={(e) => setNewUser({ ...newUser, aadhar: e.target.value })} 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select 
                      className="form-select" 
                      value={newUser.role} 
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      <option value="accounts">👤 Accounts (Can create vouchers)</option>
                      <option value="admin">🛡 Admin (Can approve vouchers)</option>
                    </select>
                  </div>
                  
                  <div style={{background: '#f8f9fa', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', color: '#666'}}>
                    <strong>ℹ️ Note:</strong> Username will be auto-generated as:<br/>
                    <code style={{background: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px', marginTop: '0.5rem', display: 'inline-block'}}>
                      {newUser.role === 'admin' ? 'Approve' : 'Accounts'}-{newUser.name.split(' ')[0] || 'FirstName'}
                    </code>
                  </div>
                </>
              )}
              
              {onboardStep === 2 && (
                <div className="otp-section">
                  {Icons.smartphone}
                  <p style={{fontWeight: 500, margin: '1rem 0'}}>Verify New User's Mobile</p>
                  <p style={{fontSize: '0.9rem', color: '#666', marginBottom: '1rem'}}>
                    OTP sent to: {newUser.mobile?.replace(/\d(?=\d{4})/g, '*')}<br/>
                    Username created: <strong>{generatedUsername}</strong>
                  </p>
                  <OTPInput value={otp} onChange={setOtp} />
                  <button 
                    className="btn btn-sm btn-secondary" 
                    onClick={handleResendOtp}
                    style={{marginTop: '1rem'}}
                  >
                    {Icons.refresh} Resend OTP
                  </button>
                </div>
              )}
              
              {onboardStep === 3 && (
                <div style={{textAlign: 'center', padding: '2rem'}}>
                  <div style={{fontSize: '4rem', marginBottom: '1rem'}}>✅</div>
                  <h3 style={{marginBottom: '0.5rem'}}>User Onboarded Successfully!</h3>
                  <p style={{color: '#666', marginBottom: '1.5rem'}}>
                    <strong>{newUser.name}</strong> can now login with username:<br/>
                    <code style={{background: '#f0f0f0', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '1.1rem', marginTop: '0.5rem', display: 'inline-block'}}>
                      {generatedUsername}
                    </code>
                  </p>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              {onboardStep === 1 && (
                <>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => { setShowOnboardModal(false); resetOnboardForm(); }}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleOnboardSubmit} 
                    disabled={submitting || !newUser.name || !newUser.mobile || !newUser.aadhar}
                  >
                    {submitting && Icons.loader}
                    {Icons.send} Create User & Send OTP
                  </button>
                </>
              )}
              
              {onboardStep === 2 && (
                <button 
                  className="btn btn-success" 
                  onClick={handleVerifyOtp} 
                  disabled={submitting || otp.length < 6}
                  style={{width: '100%'}}
                >
                  {submitting && Icons.loader}
                  {Icons.check} Verify & Complete Onboarding
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main App
const App = () => {
  const [user, setUser] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => { const id = Date.now(); setToasts(prev => [...prev, { id, message, type }]); setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000); }, []);
  const refreshVouchers = useCallback(async () => { if (user) { const data = await api.getVouchers(user.company.id); setVouchers(data); } }, [user]);
  const refreshNotifications = useCallback(async () => { if (user) { const data = await api.getNotifications(user.id); setNotifications(data); } }, [user]);

  useEffect(() => { if (user) { refreshVouchers(); refreshNotifications(); const interval = setInterval(() => { refreshVouchers(); refreshNotifications(); }, 30000); return () => clearInterval(interval); } }, [user, refreshVouchers, refreshNotifications]);

  const handleLogin = (userData) => { setUser(userData); setCurrentPage('dashboard'); };
  const handleLogout = () => { setUser(null); setVouchers([]); setNotifications([]); setCurrentPage('dashboard'); };
  const unreadCount = notifications.filter(n => !n.read).length;
  const markAllRead = async () => { await api.markAllNotificationsRead(user.id); refreshNotifications(); };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const contextValue = { user, vouchers, notifications, addToast, refreshVouchers, refreshNotifications };
  const renderPage = () => { switch(currentPage) { case 'dashboard': return <Dashboard />; case 'create': return <CreateVoucher />; case 'pending': return <VoucherList filter="pending" />; case 'approved': return <VoucherList filter="approved" />; case 'completed': return <VoucherList filter="completed" />; case 'all': return <VoucherList filter="all" />; case 'users': return <UsersManagement />; default: return <Dashboard />; } };

  const handleNavClick = (page) => {
    setCurrentPage(page);
    setShowMobileMenu(false);
  };

  return (
    <AppContext.Provider value={contextValue}>
      <PWAInstallPrompt />
      <div className="app-container">
        <header className="header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setShowMobileMenu(!showMobileMenu)}>
              {Icons.menu}
            </button>
            <div className="logo-container"><img src="logo.png" alt="Relish" style={{height:'40px'}} /></div>
            <div className="company-badge">{Icons.building} {user.company.name}</div>
          </div>
          <div className="header-right">
            <div className="user-badge">{user.role === 'admin' ? Icons.shield : Icons.user} {user.username}</div>
            <button className="notification-btn" onClick={() => setShowNotifications(!showNotifications)}>{Icons.bell}{unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}</button>
            <button className="logout-btn" onClick={handleLogout}>{Icons.logOut} Sign Out</button>
          </div>
        </header>
        <div className="main-layout">
          <aside className="sidebar">
            <div className="nav-section"><div className="nav-section-title">Main</div><div className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard')}>{Icons.home} Dashboard</div></div>
            <div className="nav-section"><div className="nav-section-title">Vouchers</div>
              {user.role === 'accounts' && <div className={`nav-item ${currentPage === 'create' ? 'active' : ''}`} onClick={() => handleNavClick('create')}>{Icons.plus} Create Voucher</div>}
              <div className={`nav-item ${currentPage === 'pending' ? 'active' : ''}`} onClick={() => handleNavClick('pending')}>{Icons.clock} Pending Approval</div>
              <div className={`nav-item ${currentPage === 'approved' ? 'active' : ''}`} onClick={() => handleNavClick('approved')}>{Icons.smartphone} Awaiting OTP</div>
              <div className={`nav-item ${currentPage === 'completed' ? 'active' : ''}`} onClick={() => handleNavClick('completed')}>{Icons.checkCircle} Completed</div>
              <div className={`nav-item ${currentPage === 'all' ? 'active' : ''}`} onClick={() => handleNavClick('all')}>{Icons.fileText} All Vouchers</div>
            </div>
            {user.role === 'admin' && <div className="nav-section"><div className="nav-section-title">Admin Dashboard</div><div className={`nav-item ${currentPage === 'users' ? 'active' : ''}`} onClick={() => handleNavClick('users')}>{Icons.users} User Management</div></div>}
          </aside>
          
          {showMobileMenu && (
            <>
              <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)} />
              <aside className="mobile-menu">
                <div className="mobile-menu-header">
                  <h3>Menu</h3>
                  <button className="mobile-menu-close" onClick={() => setShowMobileMenu(false)}>{Icons.x}</button>
                </div>
                <div className="nav-section"><div className="nav-section-title">Main</div><div className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard')}>{Icons.home} Dashboard</div></div>
                <div className="nav-section"><div className="nav-section-title">Vouchers</div>
                  {user.role === 'accounts' && <div className={`nav-item ${currentPage === 'create' ? 'active' : ''}`} onClick={() => handleNavClick('create')}>{Icons.plus} Create Voucher</div>}
                  <div className={`nav-item ${currentPage === 'pending' ? 'active' : ''}`} onClick={() => handleNavClick('pending')}>{Icons.clock} Pending Approval</div>
                  <div className={`nav-item ${currentPage === 'approved' ? 'active' : ''}`} onClick={() => handleNavClick('approved')}>{Icons.smartphone} Awaiting OTP</div>
                  <div className={`nav-item ${currentPage === 'completed' ? 'active' : ''}`} onClick={() => handleNavClick('completed')}>{Icons.checkCircle} Completed</div>
                  <div className={`nav-item ${currentPage === 'all' ? 'active' : ''}`} onClick={() => handleNavClick('all')}>{Icons.fileText} All Vouchers</div>
                </div>
                {user.role === 'admin' && <div className="nav-section"><div className="nav-section-title">Admin Dashboard</div><div className={`nav-item ${currentPage === 'users' ? 'active' : ''}`} onClick={() => handleNavClick('users')}>{Icons.users} User Management</div></div>}
              </aside>
            </>
          )}
          <main className="main-content">{renderPage()}</main>
          {showNotifications && (
            <div className="notifications-panel">
              <div className="notifications-header"><h3 style={{fontSize:'1rem',fontWeight:600}}>Notifications</h3>{unreadCount > 0 && <button className="btn btn-sm btn-secondary" onClick={markAllRead}>Mark all read</button>}</div>
              {notifications.length === 0 ? <div className="empty-state">{Icons.bell}<p>No notifications</p></div> : notifications.map(n => (<div key={n.id} className={`notification-item ${!n.read ? 'unread' : ''}`}><div className="notification-title">{n.title}</div><div className="notification-message">{n.message}</div><div className="notification-time">{new Date(n.created_at).toLocaleString('en-IN')}</div></div>))}
            </div>
          )}
        </div>
        <Toast toasts={toasts} />
      </div>
    </AppContext.Provider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
