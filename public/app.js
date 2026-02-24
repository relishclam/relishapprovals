const { useState, useEffect, createContext, useContext, useCallback } = React;

const API_BASE = '/api';
const APP_VERSION = 'v12'; // Version marker for cache debugging
console.log('[Relish App] Version:', APP_VERSION);

// Simple SVG Icons
const Icons = {
  building: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>,
  fileText: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  bell: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  bellOff: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.7 3A6 6 0 0 1 18 8c0 2.6.7 4.8 1.7 6.5"/><path d="M6 17H3s3-2 3-9a4.6 4.6 0 0 1 .3-1.7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="M17 17H6"/><line x1="2" x2="22" y1="2" y2="22"/></svg>,
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
  upload: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>,
  camera: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>,
  image: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>,
  fileCheck: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>,
  lock: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  fingerprint: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/><path d="M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2"/></svg>,
  unlock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>,
};

// Number to Words Converter for Indian Rupees
const numberToWordsIndian = (num) => {
  if (num === 0) return 'Rupees Zero Only';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  const convertLessThan100 = (n) => {
    if (n < 10) return ones[n];
    if (n >= 10 && n < 20) return teens[n - 10];
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
  };
  
  const convertLessThan1000 = (n) => {
    if (n < 100) return convertLessThan100(n);
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThan100(n % 100) : '');
  };
  
  const [rupeesStr, paiseStr] = num.toFixed(2).split('.');
  let remainingRupees = parseInt(rupeesStr, 10);
  const paise = parseInt(paiseStr, 10);
  let words = '';
  
  if (remainingRupees >= 10000000) {
    const crores = Math.floor(remainingRupees / 10000000);
    words += convertLessThan1000(crores) + ' Crore ';
    remainingRupees %= 10000000;
  }
  
  if (remainingRupees >= 100000) {
    const lakhs = Math.floor(remainingRupees / 100000);
    words += convertLessThan1000(lakhs) + ' Lakh ';
    remainingRupees %= 100000;
  }
  
  if (remainingRupees >= 1000) {
    const thousands = Math.floor(remainingRupees / 1000);
    words += convertLessThan1000(thousands) + ' Thousand ';
    remainingRupees %= 1000;
  }
  
  if (remainingRupees > 0) {
    words += convertLessThan1000(remainingRupees);
  }
  
  words = 'Rupees ' + words.trim();
  
  if (paise > 0) {
    words += ' and ' + convertLessThan100(paise) + ' Paise';
  }
  
  return words.trim() + ' Only';
};

// API Functions
const api = {
  getCompanies: () => fetch(`${API_BASE}/companies`).then(r => r.json()),
  registerUser: (data) => fetch(`${API_BASE}/users/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  verifyUserMobile: (userId) => fetch(`${API_BASE}/users/${userId}/verify-mobile`, { method: 'POST' }).then(r => r.json()),
  login: (data) => fetch(`${API_BASE}/users/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  switchCompany: (userId, companyId) => fetch(`${API_BASE}/users/${userId}/switch-company`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId }) }).then(r => r.json()),
  getCompanyUsers: (companyId) => fetch(`${API_BASE}/companies/${companyId}/users`).then(r => r.json()),
  onboardUser: (data) => fetch(`${API_BASE}/admin/onboard-user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  updateUser: (userId, data) => fetch(`${API_BASE}/users/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  getUserCompanies: (userId) => fetch(`${API_BASE}/users/${userId}/companies`).then(r => r.json()),
  updateUserCompanies: (userId, companyAccess, requesterId) => fetch(`${API_BASE}/users/${userId}/companies`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyAccess, requesterId }) }).then(r => r.json()),
  deleteUser: (userId, requesterId) => fetch(`${API_BASE}/users/${userId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requesterId }) }).then(r => r.json()),
  sendOtp: (mobile, purpose) => fetch(`${API_BASE}/otp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile, purpose }) }).then(r => r.json()),
  verifyOtp: (mobile, code) => fetch(`${API_BASE}/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile, code }) }).then(r => r.json()),
  addPayee: (data) => fetch(`${API_BASE}/payees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  createPayee: (data) => fetch(`${API_BASE}/payees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  getPayees: (companyId) => fetch(`${API_BASE}/companies/${companyId}/payees`).then(r => r.json()),
  updatePayee: (payeeId, data) => fetch(`${API_BASE}/payees/${payeeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  deletePayee: (payeeId) => fetch(`${API_BASE}/payees/${payeeId}`, { method: 'DELETE' }).then(r => r.json()),
  createVoucher: (data) => fetch(`${API_BASE}/vouchers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  getVouchers: (companyId) => fetch(`${API_BASE}/companies/${companyId}/vouchers`).then(r => r.json()),
  getVoucher: (voucherId) => fetch(`${API_BASE}/vouchers/${voucherId}`).then(r => r.json()),
  approveVoucher: (voucherId, approvedBy) => fetch(`${API_BASE}/vouchers/${voucherId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvedBy }) }).then(r => r.json()),
  rejectVoucher: (voucherId, rejectedBy, reason) => fetch(`${API_BASE}/vouchers/${voucherId}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rejectedBy, reason }) }).then(r => r.json()),
  completeVoucher: (voucherId, otp) => fetch(`${API_BASE}/vouchers/${voucherId}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp }) }).then(r => r.json()),
  resendPayeeOtp: (voucherId) => fetch(`${API_BASE}/vouchers/${voucherId}/resend-otp`, { method: 'POST' }).then(r => r.json()),
  deleteVoucher: (voucherId, deletedBy) => fetch(`${API_BASE}/vouchers/${voucherId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deletedBy }) }).then(r => r.json()),
  updateVoucher: (voucherId, data) => fetch(`${API_BASE}/vouchers/${voucherId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  submitVoucher: (voucherId) => fetch(`${API_BASE}/vouchers/${voucherId}/submit`, { method: 'POST' }).then(r => r.json()),
  // Document verification APIs
  uploadVoucherDocument: (voucherId, documentData, mimeType, uploadedBy) => fetch(`${API_BASE}/vouchers/${voucherId}/upload-document`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentData, mimeType, uploadedBy }) }).then(r => r.json()),
  approveWithAttestation: (voucherId, approvedBy, attestationNotes) => fetch(`${API_BASE}/vouchers/${voucherId}/approve-with-attestation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvedBy, attestationNotes }) }).then(r => r.json()),
  getVoucherDocument: (voucherId) => fetch(`${API_BASE}/vouchers/${voucherId}/document`).then(r => r.json()),
  getNotifications: (userId) => fetch(`${API_BASE}/users/${userId}/notifications`).then(r => r.json()),
  markAllNotificationsRead: (userId) => fetch(`${API_BASE}/users/${userId}/notifications/read-all`, { method: 'POST' }).then(r => r.json()),
  getHeadsOfAccount: (companyId) => fetch(`${API_BASE}/heads-of-account?companyId=${companyId}`).then(r => r.json()),
  addHeadOfAccount: (companyId, name, isGlobal) => fetch(`${API_BASE}/heads-of-account`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, name, isGlobal }) }).then(r => r.json()),
  updateHeadOfAccount: (id, name, isGlobal) => fetch(`${API_BASE}/heads-of-account/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, isGlobal }) }).then(r => r.json()),
  deleteHeadOfAccount: (id) => fetch(`${API_BASE}/heads-of-account/${id}`, { method: 'DELETE' }).then(r => r.json()),
  importHeadsOfAccount: (companyId, names) => fetch(`${API_BASE}/heads-of-account/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, names }) }).then(r => r.json()),
  // Sub-heads of account
  getSubHeadsOfAccount: (headId) => fetch(`${API_BASE}/sub-heads-of-account?headId=${headId}`).then(r => r.json()),
  getSubHeadsByCompany: (companyId) => fetch(`${API_BASE}/sub-heads-of-account?companyId=${companyId}`).then(r => r.json()),
  getGroupedSubHeads: (companyId) => fetch(`${API_BASE}/sub-heads-of-account/grouped?companyId=${companyId}`).then(r => r.json()),
  addSubHeadOfAccount: (headId, companyId, name) => fetch(`${API_BASE}/sub-heads-of-account`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ headId, companyId, name }) }).then(r => r.json()),
  updateSubHeadOfAccount: (id, name) => fetch(`${API_BASE}/sub-heads-of-account/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(r => r.json()),
  deleteSubHeadOfAccount: (id) => fetch(`${API_BASE}/sub-heads-of-account/${id}`, { method: 'DELETE' }).then(r => r.json()),
};

// Format number in Indian style with commas (without Unicode NBSP gaps)
const formatIndianNumber = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  const fixed = parseFloat(num).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  // Indian number system: last 3 digits, then groups of 2
  let result = '';
  const len = intPart.length;
  for (let i = 0; i < len; i++) {
    if (i > 0 && (len - i) === 3) result += ',';
    else if (i > 0 && (len - i) > 3 && (len - i) % 2 === 1) result += ',';
    result += intPart[i];
  }
  return decimals > 0 ? result + '.' + decPart : result;
};

// Format currency with ₹ symbol
const formatRupees = (num, decimals = 2) => '₹' + formatIndianNumber(num, decimals);

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
  const formatCurrency = (a) => formatRupees(a);
  
  // Parse narration_items if it's a string
  const narrationItems = typeof voucher.narration_items === 'string' 
    ? JSON.parse(voucher.narration_items || '[]') 
    : (voucher.narration_items || []);
  
  // Signature block renderer
  const SignatureBlock = ({ name, role, timestamp, label, verified }) => (
    <div className="voucher-signature">
      <div className="voucher-signature-line">
        {name ? (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',fontSize:'0.75rem'}}>
            <span style={{fontWeight:600}}>{name}</span>
            <span style={{color:'#666',fontSize:'0.7rem'}}>{role === 'admin' ? '🛡️ Approver' : '👤 Accounts'}</span>
            <span style={{color:'#888',fontSize:'0.65rem'}}>{timestamp ? formatDate(timestamp) : ''}</span>
          </div>
        ) : verified ? (
          <span className="signature-verified">✓ OTP Verified</span>
        ) : '-'}
      </div>
      <div className="voucher-signature-label">{label}</div>
    </div>
  );
  
  // Render narration items table with enhanced styling
  const NarrationTable = () => {
    if (!narrationItems || narrationItems.length === 0) return null;
    
    // Filter items that have at least a description or amount
    const validItems = narrationItems.filter(item => item.description || item.amount);
    if (validItems.length === 0) return null;
    
    // Calculate total from items
    const total = validItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    
    return (
      <div className="voucher-narration-table" style={{margin: '1rem 0'}}>
        <div style={{fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: '#333', borderBottom: '2px solid #f59e0b', paddingBottom: '0.5rem'}}>Particulars</div>
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', border: '1px solid #ddd'}}>
          <thead>
            <tr style={{background: '#f59e0b', color: 'white'}}>
              <th style={{padding: '10px 12px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)', width: '60px'}}>S.No.</th>
              <th style={{padding: '10px 12px', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.2)'}}>Description</th>
              <th style={{padding: '10px 12px', textAlign: 'right', width: '140px'}}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {validItems.map((item, idx) => (
              <tr key={idx} style={{borderBottom: '1px solid #eee', background: idx % 2 === 0 ? '#fff' : '#fafafa'}}>
                <td style={{padding: '10px 12px', textAlign: 'center', borderRight: '1px solid #eee', fontWeight: 600, color: '#666'}}>{idx + 1}</td>
                <td style={{padding: '10px 12px', borderRight: '1px solid #eee'}}>{item.description || '-'}</td>
                <td style={{padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace'}}>
                  {item.amount ? formatRupees(item.amount) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{background: '#fef3c7', fontWeight: 700}}>
              <td colSpan="2" style={{padding: '12px', textAlign: 'right', fontSize: '0.95rem', borderTop: '2px solid #f59e0b'}}>TOTAL:</td>
              <td style={{padding: '12px', textAlign: 'right', fontSize: '1rem', fontFamily: 'monospace', color: '#f59e0b', borderTop: '2px solid #f59e0b'}}>
                {formatRupees(total)}
              </td>
            </tr>
            <tr style={{background: '#fffbeb'}}>
              <td colSpan="3" style={{padding: '10px 12px', fontSize: '0.8rem', fontStyle: 'italic', color: '#92400e'}}>
                <strong>Amount in Words:</strong> {numberToWordsIndian(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };
  
  return (
    <div className="voucher-preview">
      <div className="voucher-header">
        <div className="voucher-company">{voucher.company_name}</div>
        <div className="voucher-address">{voucher.company_address}</div>
        <div className="voucher-title">PAYMENT VOUCHER</div>
        {voucher.status === 'draft' && (
          <div style={{background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, marginTop: '8px'}}>
            📝 DRAFT - Not Submitted
          </div>
        )}
      </div>
      <div className="voucher-meta">
        <div className="voucher-meta-item"><span className="voucher-meta-label">Voucher No:</span><span className="voucher-meta-value">{voucher.serial_number}</span></div>
        <div className="voucher-meta-item"><span className="voucher-meta-label">Date:</span><span className="voucher-meta-value">{formatDate(voucher.created_at)}</span></div>
        <div className="voucher-meta-item"><span className="voucher-meta-label">Payee:</span><span className="voucher-meta-value">{voucher.payee_name} {voucher.payee_alias && `(${voucher.payee_alias})`}</span></div>
        <div className="voucher-meta-item"><span className="voucher-meta-label">Mode:</span><span className="voucher-meta-value">{voucher.payment_mode}</span></div>
        {voucher.invoice_reference && <div className="voucher-meta-item"><span className="voucher-meta-label">Invoice Ref:</span><span className="voucher-meta-value">{voucher.invoice_reference}</span></div>}
      </div>
      <div className="voucher-meta-item mb-1"><span className="voucher-meta-label">Head:</span><span className="voucher-meta-value">{voucher.head_of_account}{voucher.sub_head_of_account && ` → ${voucher.sub_head_of_account}`}</span></div>
      {voucher.narration && <div className="voucher-meta-item mb-1"><span className="voucher-meta-label">Narration:</span><span className="voucher-meta-value">{voucher.narration}</span></div>}
      <NarrationTable />
      {/* Only show TOTAL section if there are no narration items (table already shows total) */}
      {(!narrationItems || narrationItems.filter(item => item.description || item.amount).length === 0) && (
        <>
          <div className="voucher-total">TOTAL: {formatCurrency(voucher.amount)}</div>
          <div style={{fontSize: '0.85rem', fontStyle: 'italic', color: '#666', marginTop: '0.5rem', marginBottom: '1rem', background: '#fffbeb', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fcd34d'}}>
            <strong style={{color: '#92400e'}}>In Words:</strong> {numberToWordsIndian(voucher.amount)}
          </div>
        </>
      )}
      <div className="voucher-signatures">
        <SignatureBlock 
          name={voucher.preparer_name} 
          role="accounts" 
          timestamp={voucher.created_at} 
          label="Prepared By" 
        />
        <SignatureBlock 
          name={voucher.approver_name} 
          role="admin" 
          timestamp={voucher.approved_at} 
          label="Approved By" 
        />
        <div className="voucher-signature">
          <div className="voucher-signature-line">
            {voucher.verification_type === 'document' && voucher.status === 'completed' ? (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',fontSize:'0.75rem'}}>
                <span className="signature-verified" style={{background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '4px'}}>📄 Document Verified</span>
                <span style={{color:'#888',fontSize:'0.65rem'}}>{voucher.completed_at ? formatDate(voucher.completed_at) : ''}</span>
              </div>
            ) : voucher.payee_otp_verified ? (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',fontSize:'0.75rem'}}>
                <span className="signature-verified">✓ OTP Verified</span>
                <span style={{color:'#888',fontSize:'0.65rem'}}>{voucher.completed_at ? formatDate(voucher.completed_at) : ''}</span>
              </div>
            ) : '-'}
          </div>
          <div className="voucher-signature-label">Payee</div>
        </div>
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
  const [requiresCompanySelection, setRequiresCompanySelection] = useState(false);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [pendingUserId, setPendingUserId] = useState('');
  const [pendingUserName, setPendingUserName] = useState('');
  const [reg, setReg] = useState({ companyId: '', name: '', mobile: '', aadhar: '', role: 'accounts', step: 1, userId: '', otp: '' });

  useEffect(() => { api.getCompanies().then(setCompanies).catch(console.error); }, []);

  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      const result = await api.login({ 
        username, 
        otp: requiresOtp ? otp : undefined,
        companyId: selectedCompanyId || undefined
      });
      
      if (result.requiresCompanySelection) {
        // User has access to multiple companies - show selection
        setRequiresCompanySelection(true);
        setAvailableCompanies(result.companies);
        setPendingUserId(result.userId);
        setPendingUserName(result.userName);
      } else if (result.requiresOtp) {
        setRequiresOtp(true);
      } else if (result.success) {
        onLogin(result.user);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch { setError('Connection error'); }
    setLoading(false);
  };

  const handleCompanySelect = async (companyId) => {
    setSelectedCompanyId(companyId);
    setLoading(true); setError('');
    try {
      const result = await api.login({ username, companyId });
      if (result.success) {
        onLogin(result.user);
      } else {
        setError(result.error || 'Login failed');
      }
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

  // Company Selection Screen
  if (requiresCompanySelection) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo"><img src="logo.png" alt="Relish" /></div>
          <h1 className="login-title">Select Company</h1>
          <p className="login-subtitle">Welcome, {pendingUserName}! Choose which company to work with:</p>
          {error && <div className="alert alert-error">{error}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
            {availableCompanies.map(company => (
              <button 
                key={company.id}
                className="btn btn-secondary" 
                style={{ 
                  width: '100%', 
                  padding: '16px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  textAlign: 'left'
                }}
                onClick={() => handleCompanySelect(company.id)}
                disabled={loading}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{company.name}</div>
                  <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                    Role: {company.role === 'admin' ? '🛡️ Admin / Approver' : '👤 Accounts'}
                  </div>
                </div>
                <span style={{ fontSize: '20px' }}>→</span>
              </button>
            ))}
          </div>
          <button 
            className="btn" 
            style={{ width: '100%', marginTop: '20px', background: 'transparent', border: '1px solid #ddd' }}
            onClick={() => {
              setRequiresCompanySelection(false);
              setAvailableCompanies([]);
              setSelectedCompanyId('');
              setUsername('');
            }}
          >
            ← Back to Login
          </button>
        </div>
      </div>
    );
  }

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
  const stats = { 
    draft: vouchers.filter(v => v.status === 'draft').length,
    pending: vouchers.filter(v => v.status === 'pending').length, 
    approved: vouchers.filter(v => ['approved', 'awaiting_payee_otp'].includes(v.status)).length, 
    completed: vouchers.filter(v => v.status === 'completed').length, 
    total: vouchers.filter(v => v.status !== 'draft').length 
  };
  return (
    <div>
      <div className="page-header"><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Welcome back, {user.name}</p></div>
      <div className="stats-grid">
        {(user.role === 'accounts' || user.isSuperAdmin) && stats.draft > 0 && (
          <div className="stat-card" style={{borderColor: '#fcd34d', background: '#fffbeb'}}><div className="stat-icon" style={{background: '#fef3c7', color: '#92400e'}}>📝</div><div className="stat-value">{stats.draft}</div><div className="stat-label">Saved Drafts</div></div>
        )}
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
              {vouchers.slice(0, 5).map(v => (<tr key={v.id}><td className="text-mono fw-600">{v.serial_number}</td><td>{v.payee_name}</td><td className="fw-600">{formatRupees(v.amount, 0)}</td><td><span className={`status-badge status-${v.status}`}>{v.status.replace(/_/g, ' ')}</span></td><td>{new Date(v.created_at).toLocaleDateString('en-IN')}</td></tr>))}
            </tbody></table></div>
          )}
        </div>
      </div>
    </div>
  );
};

// Narration Items Table Component with Sequential Entry
const NarrationItemsTable = ({ items, onChange, disabled }) => {
  const [currentItem, setCurrentItem] = useState({ description: '', amount: '' });

  const addItem = () => {
    if (!currentItem.description.trim() || !currentItem.amount || parseFloat(currentItem.amount) <= 0) {
      return;
    }
    
    onChange([...items, { 
      description: currentItem.description.trim(), 
      amount: parseFloat(currentItem.amount).toFixed(2) 
    }]);
    
    setCurrentItem({ description: '', amount: '' });
    setTimeout(() => document.getElementById('narration-desc-input')?.focus(), 100);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const getTotal = () => {
    return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  const handleKeyPress = (e, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'description' && currentItem.description.trim()) {
        document.getElementById('narration-amt-input')?.focus();
      } else if (field === 'amount' && currentItem.amount) {
        addItem();
      }
    }
  };

  return (
    <div className="narration-table-container" style={{border: '2px solid #f59e0b', borderRadius: '8px', padding: '1rem', background: '#fffbeb'}}>
      <div style={{marginBottom: '1rem'}}>
        <h4 style={{fontSize: '0.95rem', fontWeight: 600, color: '#92400e', marginBottom: '0.75rem'}}>📋 Add Line Items (Sequential Entry)</h4>
        
        {!disabled && (
          <div style={{background: 'white', padding: '1rem', borderRadius: '6px', border: '1px solid #fcd34d', marginBottom: '1rem'}}>
            <div className="form-group" style={{marginBottom: '0.75rem'}}>
              <label className="form-label" style={{fontSize: '0.85rem', color: '#92400e'}}>
                1️⃣ Description / Item Name * <span style={{fontSize: '0.75rem', fontWeight: 'normal'}}>(Press Enter to continue)</span>
              </label>
              <input 
                id="narration-desc-input"
                type="text" 
                className="form-input" 
                placeholder="Enter item description..."
                value={currentItem.description} 
                onChange={(e) => setCurrentItem({...currentItem, description: e.target.value})}
                onKeyPress={(e) => handleKeyPress(e, 'description')}
                disabled={disabled}
                autoFocus
                style={{borderColor: '#f59e0b', fontSize: '1rem'}}
              />
            </div>
            
            {currentItem.description.trim() && (
              <div className="form-group" style={{marginBottom: '0.75rem'}}>
                <label className="form-label" style={{fontSize: '0.85rem', color: '#92400e'}}>
                  2️⃣ Amount (₹) * <span style={{fontSize: '0.75rem', fontWeight: 'normal'}}>(Press Enter to add)</span>
                </label>
                <input 
                  id="narration-amt-input"
                  type="number" 
                  className="form-input" 
                  placeholder="0.00"
                  value={currentItem.amount} 
                  onChange={(e) => setCurrentItem({...currentItem, amount: e.target.value})}
                  onKeyPress={(e) => handleKeyPress(e, 'amount')}
                  disabled={disabled}
                  step="0.01"
                  min="0"
                  style={{borderColor: '#f59e0b', fontSize: '1rem'}}
                />
              </div>
            )}
            
            {currentItem.description.trim() && currentItem.amount && (
              <button 
                type="button" 
                className="btn btn-primary btn-sm" 
                onClick={addItem}
                style={{width: '100%', background: '#f59e0b', borderColor: '#f59e0b', padding: '0.75rem'}}
              >
                ➕ Add Item to List
              </button>
            )}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', background: 'white', borderRadius: '6px', overflow: 'hidden'}}>
            <thead>
              <tr style={{background: '#f59e0b', color: 'white'}}>
                <th style={{padding: '10px 12px', textAlign: 'center', width: '60px'}}>S.No.</th>
                <th style={{padding: '10px 12px', textAlign: 'left'}}>Description</th>
                <th style={{padding: '10px 12px', textAlign: 'right', width: '140px'}}>Amount (₹)</th>
                {!disabled && <th style={{padding: '10px 12px', textAlign: 'center', width: '60px'}}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} style={{borderBottom: '1px solid #fcd34d', background: index % 2 === 0 ? 'white' : '#fffbeb'}}>
                  <td style={{padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#92400e'}}>{index + 1}</td>
                  <td style={{padding: '10px 12px'}}>{item.description}</td>
                  <td style={{padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace'}}>
                    {formatRupees(item.amount)}
                  </td>
                  {!disabled && (
                    <td style={{padding: '10px 12px', textAlign: 'center'}}>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-danger" 
                        onClick={() => removeItem(index)}
                        title="Remove item"
                        style={{padding: '4px 10px', fontSize: '0.85rem'}}
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{background: '#fef3c7', fontWeight: 700}}>
                <td colSpan={!disabled ? "3" : "2"} style={{padding: '12px', textAlign: 'right', fontSize: '0.95rem'}}>TOTAL:</td>
                <td style={{padding: '12px', textAlign: 'right', fontSize: '1rem', fontFamily: 'monospace', color: '#f59e0b'}}>
                  {formatRupees(getTotal())}
                </td>
                {!disabled && <td></td>}
              </tr>
              <tr style={{background: '#fffbeb'}}>
                <td colSpan={!disabled ? "4" : "3"} style={{padding: '10px 12px', fontSize: '0.8rem', fontStyle: 'italic', color: '#92400e'}}>
                  <strong>In Words:</strong> {numberToWordsIndian(getTotal())}
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
      
      {items.length === 0 && disabled && (
        <div style={{textAlign: 'center', padding: '2rem', color: '#92400e', fontSize: '0.9rem'}}>
          No line items added
        </div>
      )}
    </div>
  );
};

// Legacy Narration Items Table Component (for backwards compatibility)
const LegacyNarrationItemsTable = ({ items, onChange, disabled }) => {
  const addItem = () => {
    onChange([...items, { description: '', quantity: '', rate: '', amount: '' }]);
  };

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-calculate amount if both quantity and rate are provided
    if (field === 'quantity' || field === 'rate') {
      const qty = parseFloat(newItems[index].quantity) || 0;
      const rate = parseFloat(newItems[index].rate) || 0;
      if (qty > 0 && rate > 0) {
        newItems[index].amount = (qty * rate).toFixed(2);
      }
    }
    
    onChange(newItems);
  };

  const getTotal = () => {
    return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  return (
    <div className="narration-table-container">
      <table className="narration-table">
        <thead>
          <tr>
            <th style={{width: '40%'}}>Description / Name</th>
            <th style={{width: '15%'}}>Quantity</th>
            <th style={{width: '18%'}}>Rate (₹)</th>
            <th style={{width: '18%'}}>Amount (₹)</th>
            <th style={{width: '9%'}}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>
                <input 
                  type="text" 
                  className="form-input narration-input" 
                  placeholder="Item or person name"
                  value={item.description} 
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  disabled={disabled}
                />
              </td>
              <td>
                <input 
                  type="text" 
                  className="form-input narration-input" 
                  placeholder="e.g., 2 days"
                  value={item.quantity} 
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  disabled={disabled}
                />
              </td>
              <td>
                <input 
                  type="number" 
                  className="form-input narration-input" 
                  placeholder="0.00"
                  value={item.rate} 
                  onChange={(e) => updateItem(index, 'rate', e.target.value)}
                  disabled={disabled}
                />
              </td>
              <td>
                <input 
                  type="number" 
                  className="form-input narration-input" 
                  placeholder="0.00"
                  value={item.amount} 
                  onChange={(e) => updateItem(index, 'amount', e.target.value)}
                  disabled={disabled}
                />
              </td>
              <td>
                {!disabled && (
                  <button 
                    type="button" 
                    className="btn btn-sm btn-danger" 
                    onClick={() => removeItem(index)}
                    title="Remove item"
                    style={{padding: '4px 8px'}}
                  >
                    ×
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        {items.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan="3" style={{textAlign: 'right', fontWeight: 600}}>Total:</td>
              <td style={{fontWeight: 600}}>₹{getTotal().toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
              <td></td>
            </tr>
          </tfoot>
        )}
      </table>
      {!disabled && (
        <button type="button" className="btn btn-sm btn-secondary" onClick={addItem} style={{marginTop: '0.5rem'}}>
          + Add Line Item
        </button>
      )}
    </div>
  );
};

// Create Voucher
const CreateVoucher = () => {
  const { user, addToast, refreshVouchers } = useApp();
  const [loading, setLoading] = useState(false);
  const [payees, setPayees] = useState([]);
  const [heads, setHeads] = useState([]);
  const [headsData, setHeadsData] = useState([]); // Full data with IDs
  const [subHeads, setSubHeads] = useState([]); // Sub-heads for selected head
  const [allSubHeads, setAllSubHeads] = useState([]); // All sub-heads by company
  const [showPayeeModal, setShowPayeeModal] = useState(false);
  const [showCustomAccount, setShowCustomAccount] = useState(false);
  const [showAddSubCategory, setShowAddSubCategory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [newSubCategory, setNewSubCategory] = useState('');
  const [customAccount, setCustomAccount] = useState('');
  const [form, setForm] = useState({ headOfAccount: '', subHeadOfAccount: '', narration: '', narrationItems: [], payeeId: '', paymentMode: 'UPI', amount: '', invoiceReference: '' });
  const [newPayee, setNewPayee] = useState({ name: '', alias: '', mobile: '', bankAccount: '', ifsc: '', upiId: '' });
  const [useNarrationTable, setUseNarrationTable] = useState(true);  // Default to TRUE for tabulated format

  const refreshSubHeads = async () => {
    // This now returns sub-heads for the company's own heads + sub-heads of global heads from other companies
    const data = await api.getSubHeadsByCompany(user.company.id);
    if (Array.isArray(data)) {
      setAllSubHeads(data);
    }
  };

  useEffect(() => { 
    // Load payees for user's company
    api.getPayees(user.company.id).then(setPayees);
    // Load heads from database based on user's company
    api.getHeadsOfAccount(user.company.id).then(data => {
      if (Array.isArray(data)) {
        setHeadsData(data);
        setHeads(data.map(h => h.name));
      }
    });
    // Load all sub-heads for the company
    refreshSubHeads();
  }, [user.company.id]);

  // Update sub-heads when head of account changes
  useEffect(() => {
    if (form.headOfAccount) {
      const selectedHead = headsData.find(h => h.name === form.headOfAccount);
      if (selectedHead) {
        const filtered = allSubHeads.filter(sh => sh.head_id === selectedHead.id);
        setSubHeads(filtered);
      } else {
        setSubHeads([]);
      }
    } else {
      setSubHeads([]);
    }
  }, [form.headOfAccount, headsData, allSubHeads]);

  // Clear sub-head selection when head changes (separate effect)
  useEffect(() => {
    setForm(f => ({ ...f, subHeadOfAccount: '' }));
  }, [form.headOfAccount]);

  // Calculate total from narration items
  const calculateNarrationTotal = () => {
    return form.narrationItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  // Auto-update amount when narration items change (if using table)
  useEffect(() => {
    if (useNarrationTable && form.narrationItems.length > 0) {
      const total = calculateNarrationTotal();
      if (total > 0) {
        setForm(f => ({ ...f, amount: total.toFixed(2) }));
      }
    }
  }, [form.narrationItems, useNarrationTable]);

  const handleAddPayee = async () => {
    setLoading(true);
    try { const result = await api.addPayee({ companyId: user.company.id, ...newPayee }); if (result.success) { addToast('Payee added', 'success'); setShowPayeeModal(false); setNewPayee({ name: '', alias: '', mobile: '', bankAccount: '', ifsc: '', upiId: '' }); api.getPayees(user.company.id).then(setPayees); } } catch { addToast('Failed', 'error'); }
    setLoading(false);
  };

  const handleUseCustomAccount = () => {
    if (customAccount.trim()) {
      setForm({ ...form, headOfAccount: customAccount.trim() });
      setShowCustomAccount(false);
      setCustomAccount('');
    }
  };

  const handleAddSubCategory = async () => {
    if (!newSubCategory.trim()) {
      addToast('Sub-category name cannot be empty', 'error');
      return;
    }
    if (!form.headOfAccount) {
      addToast('Please select a Head of Account first', 'error');
      return;
    }
    const selectedHead = headsData.find(h => h.name === form.headOfAccount);
    if (!selectedHead) {
      addToast('Invalid Head of Account', 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await api.addSubHeadOfAccount(selectedHead.id, user.company.id, newSubCategory.trim());
      if (result.error) {
        addToast(result.error, 'error');
      } else {
        addToast('Sub-category added successfully', 'success');
        setNewSubCategory('');
        setShowAddSubCategory(false);
        // Refresh sub-heads and auto-select the new one
        await refreshSubHeads();
        setForm(f => ({ ...f, subHeadOfAccount: newSubCategory.trim() }));
      }
    } catch (error) {
      addToast('Failed to add sub-category', 'error');
    }
    setLoading(false);
  };

  const handleSaveOrSubmit = async (saveAsDraft = false) => {
    if (!form.headOfAccount || !form.payeeId || !form.amount) { 
      addToast('Fill all required fields (Head of Account, Payee, Amount)', 'error'); 
      return; 
    }
    setLoading(true);
    try { 
      const result = await api.createVoucher({ 
        companyId: user.company.id, 
        headOfAccount: form.headOfAccount,
        subHeadOfAccount: form.subHeadOfAccount || null,
        narration: form.narration, 
        narrationItems: form.narrationItems,
        amount: parseFloat(form.amount), 
        paymentMode: form.paymentMode, 
        payeeId: form.payeeId, 
        preparedBy: user.id,
        saveAsDraft: saveAsDraft,
        invoiceReference: form.invoiceReference || null
      }); 
      if (result.success) { 
        addToast(saveAsDraft ? `Draft ${result.serialNumber} saved` : `Voucher ${result.serialNumber} submitted`, 'success'); 
        setForm({ headOfAccount: '', subHeadOfAccount: '', narration: '', narrationItems: [], payeeId: '', paymentMode: 'UPI', amount: '', invoiceReference: '' }); 
        setUseNarrationTable(false);
        refreshVouchers(); 
      } else {
        addToast(result.error || 'Failed', 'error');
      }
    } catch { addToast('Failed', 'error'); }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Create Payment Voucher</h1><p className="page-subtitle">Prepare a new payment voucher for approval</p></div>
      <div className="card">
        <div className="card-header"><h3 className="card-title">{Icons.fileText} Voucher Details</h3></div>
        <div className="card-body">
          <div style={{marginBottom: '1.5rem', padding: '1rem', background: 'var(--relish-cream)', borderRadius: '8px', border: '2px solid var(--relish-orange)'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem'}}>
              {Icons.building}
              <span style={{fontSize: '1.1rem', fontWeight: 600, color: 'var(--relish-dark)'}}>{user.company.name}</span>
            </div>
            <div style={{fontSize: '0.85rem', color: '#666'}}>{user.company.address}</div>
            <div style={{fontSize: '0.85rem', color: '#666'}}>GST: {user.company.gst}</div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label form-label-row">
                Head of Account *
                <button className="btn btn-sm btn-secondary" onClick={() => setShowCustomAccount(true)} style={{fontSize: '0.75rem'}}>✏️ Enter Custom</button>
              </label>
              <select className="form-select" value={form.headOfAccount} onChange={(e) => setForm({ ...form, headOfAccount: e.target.value })}>
                <option value="">Select</option>
                {heads.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              {form.headOfAccount && !heads.includes(form.headOfAccount) && (
                <div style={{marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--relish-orange)', fontStyle: 'italic'}}>
                  Custom account: {form.headOfAccount}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label form-label-row">
                Sub-Category
                <button 
                  className="btn btn-sm btn-secondary" 
                  onClick={() => setShowAddSubCategory(true)} 
                  style={{fontSize: '0.75rem'}}
                  disabled={!form.headOfAccount}
                  title={!form.headOfAccount ? 'Select Head of Account first' : 'Add new sub-category'}
                >
                  ➕ Add New
                </button>
              </label>
              <select 
                className="form-select" 
                value={form.subHeadOfAccount} 
                onChange={(e) => setForm({ ...form, subHeadOfAccount: e.target.value })}
                disabled={!form.headOfAccount}
              >
                <option value="">{!form.headOfAccount ? 'Select Head first' : subHeads.length === 0 ? 'No sub-categories (optional)' : 'Select Sub-Category (optional)'}</option>
                {subHeads.map(sh => <option key={sh.id} value={sh.name}>{sh.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Payment Mode *</label><select className="form-select" value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}><option value="UPI">UPI</option><option value="Account Transfer">Account Transfer</option><option value="Cash">Cash</option></select></div>
            <div className="form-group"><label className="form-label">Invoice Reference</label><input type="text" className="form-input" placeholder="e.g., INV-2026-001 (optional)" value={form.invoiceReference} onChange={(e) => setForm({ ...form, invoiceReference: e.target.value })} /></div>
          </div>
          <div className="form-group"><label className="form-label form-label-row">Payee *<button className="btn btn-sm btn-secondary" onClick={() => setShowPayeeModal(true)}>{Icons.plus} Add Payee</button></label><select className="form-select" value={form.payeeId} onChange={(e) => setForm({ ...form, payeeId: e.target.value })}><option value="">Select Payee</option>{payees.map(p => <option key={p.id} value={p.id}>{p.name} {p.alias && `(${p.alias})`}</option>)}</select></div>
          
          <div className="form-group">
            <label className="form-label form-label-row">
              Narration / Line Items
              <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', background: useNarrationTable ? '#f59e0b' : '#888', color: 'white', padding: '0.35rem 0.75rem', borderRadius: '6px'}}>
                <input 
                  type="checkbox" 
                  checked={useNarrationTable} 
                  onChange={(e) => {
                    setUseNarrationTable(e.target.checked);
                    if (!e.target.checked) {
                      // Switching to simple mode - clear items
                      setForm({ ...form, narrationItems: [] });
                    }
                  }} 
                />
                {useNarrationTable ? '📋 Multiple Items Mode' : '📝 Simple Text Mode'}
              </label>
            </label>
            
            {useNarrationTable ? (
              <NarrationItemsTable 
                items={form.narrationItems} 
                onChange={(items) => setForm({ ...form, narrationItems: items })}
              />
            ) : (
              <textarea className="form-input" rows={2} placeholder="Enter payment description" value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} />
            )}
          </div>
          
          <div className="form-group">
            <label className="form-label">
              Amount (₹) * 
              {useNarrationTable && form.narrationItems.length > 0 && <span style={{color: '#f59e0b', fontWeight: 'normal', marginLeft: '0.5rem'}}>(auto-calculated from items)</span>}
            </label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="Enter amount" 
              value={form.amount} 
              onChange={(e) => setForm({ ...form, amount: e.target.value })} 
              readOnly={useNarrationTable && form.narrationItems.some(i => parseFloat(i.amount) > 0)}
              style={useNarrationTable && form.narrationItems.some(i => parseFloat(i.amount) > 0) ? {background: '#f5f5f5', fontWeight: 600, fontSize: '1.1rem'} : {}}
            />
            {form.amount > 0 && (
              <div style={{marginTop: '0.5rem', fontSize: '0.85rem', color: '#666', fontStyle: 'italic', background: '#fffbeb', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fcd34d'}}>
                <strong style={{color: '#92400e'}}>In Words:</strong> {numberToWordsIndian(parseFloat(form.amount))}
              </div>
            )}
          </div>
          
          <div className="btn-group" style={{display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem'}}>
            <button className="btn btn-outline" onClick={() => setShowPreview(true)} disabled={!form.headOfAccount || !form.payeeId || !form.amount} style={{border: '2px solid #f59e0b', color: '#f59e0b'}}>
              👁️ Preview
            </button>
            <button className="btn btn-secondary" onClick={() => handleSaveOrSubmit(true)} disabled={loading}>
              {loading && Icons.loader}💾 Save as Draft
            </button>
            <button className="btn btn-primary" onClick={() => handleSaveOrSubmit(false)} disabled={loading}>
              {loading && Icons.loader}{Icons.send} Submit for Approval
            </button>
          </div>
          <p style={{fontSize: '0.8rem', color: '#888', marginTop: '0.75rem'}}>
            💡 Tip: Preview your voucher before submitting. Save as Draft if the payee isn't ready to receive the OTP yet.
          </p>
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
      {showCustomAccount && (
        <div className="modal-overlay" onClick={() => setShowCustomAccount(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">✏️ Enter Custom Head of Account</h3><button className="modal-close" onClick={() => setShowCustomAccount(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Account Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={customAccount} 
                  onChange={(e) => setCustomAccount(e.target.value)}
                  placeholder="Enter account name (e.g., Equipment Purchase)"
                  onKeyPress={e => e.key === 'Enter' && handleUseCustomAccount()}
                />
              </div>
              <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '1rem'}}>
                This will be used for this voucher only. To add it permanently, go to Heads of Account management.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCustomAccount(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUseCustomAccount} disabled={!customAccount.trim()}>Use This Account</button>
            </div>
          </div>
        </div>
      )}
      {showAddSubCategory && (
        <div className="modal-overlay" onClick={() => setShowAddSubCategory(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">➕ Add Sub-Category</h3><button className="modal-close" onClick={() => setShowAddSubCategory(false)}>×</button></div>
            <div className="modal-body">
              <div style={{background: '#fef3c7', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem'}}>
                <strong>Parent Head:</strong> {form.headOfAccount}
              </div>
              <div className="form-group">
                <label className="form-label">Sub-Category Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newSubCategory} 
                  onChange={(e) => setNewSubCategory(e.target.value)}
                  placeholder="e.g., Labour Charges - Civil Work"
                  onKeyPress={e => e.key === 'Enter' && handleAddSubCategory()}
                />
              </div>
              <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '1rem'}}>
                This sub-category will be saved permanently under "{form.headOfAccount}" and can be reused in future vouchers.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddSubCategory(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddSubCategory} disabled={loading || !newSubCategory.trim()}>{loading && Icons.loader}Add Sub-Category</button>
            </div>
          </div>
        </div>
      )}
      {showPreview && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{background: '#f59e0b', color: 'white'}}>
              <h3 className="modal-title" style={{color: 'white'}}>👁️ Voucher Preview</h3>
              <button className="modal-close" onClick={() => setShowPreview(false)} style={{color: 'white'}}>×</button>
            </div>
            <div className="modal-body" style={{padding: 0}}>
              <PreviewVoucher 
                formData={form}
                payees={payees}
                user={user}
              />
            </div>
            <div className="modal-footer" style={{display: 'flex', gap: '1rem', justifyContent: 'space-between'}}>
              <button className="btn btn-secondary" onClick={() => setShowPreview(false)}>← Back to Edit</button>
              <div style={{display: 'flex', gap: '0.75rem'}}>
                <button className="btn btn-secondary" onClick={() => { setShowPreview(false); handleSaveOrSubmit(true); }} disabled={loading}>
                  💾 Save as Draft
                </button>
                <button className="btn btn-primary" onClick={() => { setShowPreview(false); handleSaveOrSubmit(false); }} disabled={loading}>
                  {Icons.send} Submit for Approval
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Preview Voucher Component (for Create Voucher preview)
const PreviewVoucher = ({ formData, payees, user }) => {
  const selectedPayee = payees.find(p => p.id === formData.payeeId);
  const narrationItems = formData.narrationItems || [];
  const validItems = narrationItems.filter(item => item.description || item.amount);
  const total = validItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) || parseFloat(formData.amount) || 0;
  
  return (
    <div className="voucher-preview" style={{margin: 0, boxShadow: 'none'}}>
      <div className="voucher-header">
        <div className="voucher-company">{user.company.name}</div>
        <div className="voucher-address">{user.company.address}</div>
        <div className="voucher-title">PAYMENT VOUCHER</div>
        <div style={{background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, marginTop: '8px'}}>
          👁️ PREVIEW - Not Yet Saved
        </div>
      </div>
      <div className="voucher-meta">
        <div className="voucher-meta-item"><span className="voucher-meta-label">Voucher No:</span><span className="voucher-meta-value" style={{color: '#888', fontStyle: 'italic'}}>Will be assigned</span></div>
        <div className="voucher-meta-item"><span className="voucher-meta-label">Date:</span><span className="voucher-meta-value">{new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
        <div className="voucher-meta-item"><span className="voucher-meta-label">Payee:</span><span className="voucher-meta-value">{selectedPayee?.name || 'Not selected'} {selectedPayee?.alias && `(${selectedPayee.alias})`}</span></div>
        <div className="voucher-meta-item"><span className="voucher-meta-label">Mode:</span><span className="voucher-meta-value">{formData.paymentMode}</span></div>
        {formData.invoiceReference && <div className="voucher-meta-item"><span className="voucher-meta-label">Invoice Ref:</span><span className="voucher-meta-value">{formData.invoiceReference}</span></div>}
      </div>
      <div className="voucher-meta-item mb-1"><span className="voucher-meta-label">Head:</span><span className="voucher-meta-value">{formData.headOfAccount || 'Not selected'}{formData.subHeadOfAccount && ` → ${formData.subHeadOfAccount}`}</span></div>
      {formData.narration && <div className="voucher-meta-item mb-1"><span className="voucher-meta-label">Narration:</span><span className="voucher-meta-value">{formData.narration}</span></div>}
      
      {validItems.length > 0 ? (
        <div style={{marginTop: '1rem', marginBottom: '1rem'}}>
          <div style={{fontWeight: 600, marginBottom: '0.5rem', color: '#92400e'}}>Particulars</div>
          <table style={{width: '100%', borderCollapse: 'collapse', border: '2px solid #f59e0b', borderRadius: '8px', overflow: 'hidden'}}>
            <thead>
              <tr style={{background: '#f59e0b', color: 'white'}}>
                <th style={{padding: '10px', textAlign: 'center', width: '60px'}}>S.No.</th>
                <th style={{padding: '10px', textAlign: 'left'}}>Description</th>
                <th style={{padding: '10px', textAlign: 'right', width: '120px'}}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {validItems.map((item, idx) => (
                <tr key={idx} style={{borderBottom: '1px solid #fcd34d', background: idx % 2 === 0 ? 'white' : '#fffbeb'}}>
                  <td style={{padding: '8px', textAlign: 'center', fontWeight: 600}}>{idx + 1}</td>
                  <td style={{padding: '8px'}}>{item.description}</td>
                  <td style={{padding: '8px', textAlign: 'right', fontFamily: 'monospace'}}>{formatRupees(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{background: '#fef3c7', fontWeight: 700}}>
                <td colSpan="2" style={{padding: '10px', textAlign: 'right'}}>TOTAL:</td>
                <td style={{padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#f59e0b'}}>{formatRupees(total)}</td>
              </tr>
              <tr style={{background: '#fffbeb'}}>
                <td colSpan="3" style={{padding: '8px', fontSize: '0.85rem', fontStyle: 'italic', color: '#92400e'}}>
                  <strong>Amount in Words:</strong> {numberToWordsIndian(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <>
          <div className="voucher-total">TOTAL: {formatRupees(total)}</div>
          <div style={{fontSize: '0.85rem', fontStyle: 'italic', color: '#666', marginTop: '0.5rem', marginBottom: '1rem', background: '#fffbeb', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fcd34d'}}>
            <strong style={{color: '#92400e'}}>In Words:</strong> {numberToWordsIndian(total)}
          </div>
        </>
      )}
      
      <div className="voucher-signatures" style={{marginTop: '1.5rem'}}>
        <div className="voucher-signature">
          <div className="voucher-signature-line" style={{borderBottom: '1px dashed #ccc', height: '40px'}}></div>
          <div className="voucher-signature-role">Prepared By</div>
          <div className="voucher-signature-name">{user.name}</div>
        </div>
        <div className="voucher-signature">
          <div className="voucher-signature-line" style={{borderBottom: '1px dashed #ccc', height: '40px'}}></div>
          <div className="voucher-signature-role">Approved By</div>
          <div className="voucher-signature-name" style={{color: '#888', fontStyle: 'italic'}}>Pending</div>
        </div>
        <div className="voucher-signature">
          <div className="voucher-signature-line" style={{borderBottom: '1px dashed #ccc', height: '40px'}}></div>
          <div className="voucher-signature-role">Received By</div>
          <div className="voucher-signature-name" style={{color: '#888', fontStyle: 'italic'}}>Pending</div>
        </div>
      </div>
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printDateFrom, setPrintDateFrom] = useState('');
  const [printDateTo, setPrintDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Document verification state
  const [showAttestationModal, setShowAttestationModal] = useState(false);
  const [attestationNotes, setAttestationNotes] = useState('');
  
  // Edit Draft state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ headOfAccount: '', subHeadOfAccount: '', narration: '', narrationItems: [], payeeId: '', paymentMode: 'UPI', amount: '', invoiceReference: '' });
  const [payees, setPayees] = useState([]);
  const [heads, setHeads] = useState([]);
  const [headsData, setHeadsData] = useState([]);
  const [subHeads, setSubHeads] = useState([]);
  const [allSubHeads, setAllSubHeads] = useState([]);
  const [useNarrationTable, setUseNarrationTable] = useState(false);

  // Load payees and heads for edit modal
  useEffect(() => {
    api.getPayees(user.company.id).then(setPayees);
    api.getHeadsOfAccount(user.company.id).then(data => {
      if (Array.isArray(data)) {
        setHeadsData(data);
        setHeads(data.map(h => h.name));
      }
    });
    api.getSubHeadsByCompany(user.company.id).then(data => {
      if (Array.isArray(data)) setAllSubHeads(data);
    });
  }, [user.company.id]);

  // Update sub-heads when head of account changes in edit form
  useEffect(() => {
    if (editForm.headOfAccount) {
      const selectedHead = headsData.find(h => h.name === editForm.headOfAccount);
      if (selectedHead) {
        const filtered = allSubHeads.filter(sh => sh.head_id === selectedHead.id);
        setSubHeads(filtered);
      } else {
        setSubHeads([]);
      }
    } else {
      setSubHeads([]);
    }
  }, [editForm.headOfAccount, headsData, allSubHeads]);

  // Auto-update amount when narration items change in edit form
  useEffect(() => {
    if (useNarrationTable && editForm.narrationItems.length > 0) {
      const total = editForm.narrationItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      if (total > 0) {
        setEditForm(f => ({ ...f, amount: total.toFixed(2) }));
      }
    }
  }, [editForm.narrationItems, useNarrationTable]);

  const filtered = vouchers.filter(v => { 
    if (filter === 'draft') return v.status === 'draft';
    if (filter === 'pending') return v.status === 'pending'; 
    if (filter === 'approved') return ['approved', 'awaiting_payee_otp'].includes(v.status); 
    if (filter === 'completed') return v.status === 'completed'; 
    return true; 
  });
  
  const openVoucher = async (v) => { const full = await api.getVoucher(v.id); setSelectedVoucher(full); setShowModal(true); };

  const handleEditDraft = (voucher) => {
    const narrationItems = typeof voucher.narration_items === 'string' 
      ? JSON.parse(voucher.narration_items || '[]') 
      : (voucher.narration_items || []);
    const hasItems = narrationItems.length > 0 && narrationItems.some(item => item.description || item.amount);
    
    setEditForm({
      headOfAccount: voucher.head_of_account || '',
      subHeadOfAccount: voucher.sub_head_of_account || '',
      narration: voucher.narration || '',
      narrationItems: narrationItems,
      payeeId: voucher.payee_id || '',
      paymentMode: voucher.payment_mode || 'UPI',
      amount: voucher.amount?.toString() || '',
      invoiceReference: voucher.invoice_reference || ''
    });
    setUseNarrationTable(hasItems);
    setShowModal(false);
    setShowEditModal(true);
  };

  const handleUpdateDraft = async (saveAsDraft = true) => {
    if (!editForm.headOfAccount || !editForm.payeeId || !editForm.amount) {
      addToast('Fill all required fields (Head of Account, Payee, Amount)', 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await api.updateVoucher(selectedVoucher.id, {
        headOfAccount: editForm.headOfAccount,
        subHeadOfAccount: editForm.subHeadOfAccount || null,
        narration: editForm.narration,
        narrationItems: editForm.narrationItems,
        amount: parseFloat(editForm.amount),
        paymentMode: editForm.paymentMode,
        payeeId: editForm.payeeId,
        saveAsDraft: saveAsDraft,
        invoiceReference: editForm.invoiceReference || null
      });
      if (result.success) {
        addToast(saveAsDraft ? 'Draft updated successfully' : 'Voucher submitted for approval', 'success');
        refreshVouchers();
        setShowEditModal(false);
      } else {
        addToast(result.error || 'Failed to update', 'error');
      }
    } catch {
      addToast('Failed to update voucher', 'error');
    }
    setLoading(false);
  };
  
  const handleSubmitDraft = async (voucher) => {
    setLoading(true);
    try {
      const result = await api.submitVoucher(voucher.id);
      if (result.success) {
        addToast('Voucher submitted for approval', 'success');
        refreshVouchers();
        setShowModal(false);
      } else {
        addToast(result.error || 'Failed to submit', 'error');
      }
    } catch {
      addToast('Failed to submit voucher', 'error');
    }
    setLoading(false);
  };
  
  const handlePrintSingle = async (voucher) => {
    const full = voucher.company_name ? voucher : await api.getVoucher(voucher.id);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(generateVoucherHTML([full], `Voucher ${full.voucher_number || voucher.voucher_number || ''}`));
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
    const formatCurrency = (a) => formatRupees(a);
    const totalAmount = vouchers.reduce((sum, v) => sum + v.amount, 0);
    
    // Helper to convert number to words for print
    const numToWords = (num) => {
      if (num === 0) return 'Rupees Zero Only';
      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const convertLessThan100 = (n) => { if (n < 10) return ones[n]; if (n >= 10 && n < 20) return teens[n - 10]; return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : ''); };
      const convertLessThan1000 = (n) => { if (n < 100) return convertLessThan100(n); return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThan100(n % 100) : ''); };
      const [rupeesStr, paiseStr] = num.toFixed(2).split('.'); let remainingRupees = parseInt(rupeesStr, 10); const paise = parseInt(paiseStr, 10); let words = '';
      if (remainingRupees >= 10000000) { const crores = Math.floor(remainingRupees / 10000000); words += convertLessThan1000(crores) + ' Crore '; remainingRupees %= 10000000; }
      if (remainingRupees >= 100000) { const lakhs = Math.floor(remainingRupees / 100000); words += convertLessThan1000(lakhs) + ' Lakh '; remainingRupees %= 100000; }
      if (remainingRupees >= 1000) { const thousands = Math.floor(remainingRupees / 1000); words += convertLessThan1000(thousands) + ' Thousand '; remainingRupees %= 1000; }
      if (remainingRupees > 0) { words += convertLessThan1000(remainingRupees); }
      words = 'Rupees ' + words.trim(); if (paise > 0) { words += ' and ' + convertLessThan100(paise) + ' Paise'; }
      return words.trim() + ' Only';
    };
    
    // Helper to render narration items table with enhanced styling
    const renderNarrationItems = (v) => {
      const items = typeof v.narration_items === 'string' 
        ? JSON.parse(v.narration_items || '[]') 
        : (v.narration_items || []);
      const validItems = items.filter(item => item.description || item.amount);
      
      if (validItems.length === 0) return '';
      
      const itemsTotal = validItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      
      return `
        <div class="particulars-section">
          <div class="particulars-title">Particulars</div>
          <table class="particulars-table">
            <thead>
              <tr style="background: #f59e0b; color: white;">
                <th style="text-align:center;width:10%">S.No.</th>
                <th style="text-align:left;width:60%">Description</th>
                <th style="text-align:right;width:30%">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${validItems.map((item, idx) => `
                <tr style="background: ${idx % 2 === 0 ? '#fff' : '#fafafa'}">
                  <td style="text-align:center;font-weight:600;color:#666">${idx + 1}</td>
                  <td style="text-align:left">${item.description || '-'}</td>
                  <td style="text-align:right;font-weight:600;font-family:monospace">${item.amount ? formatCurrency(item.amount) : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#fef3c7;font-weight:700">
                <td colspan="2" style="text-align:right;padding:10px;border-top:2px solid #f59e0b">TOTAL:</td>
                <td style="text-align:right;padding:10px;font-family:monospace;color:#f59e0b;border-top:2px solid #f59e0b">${formatCurrency(itemsTotal)}</td>
              </tr>
              <tr style="background:#fffbeb">
                <td colspan="3" style="padding:8px;font-size:10px;font-style:italic;color:#92400e">
                  <strong>In Words:</strong> ${numToWords(itemsTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    };
    
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
    .draft-badge { background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 4px; font-size: 10px; font-weight: 600; display: inline-block; margin-top: 8px; }
    .voucher-meta { display: table; width: 100%; margin-bottom: 15px; }
    .meta-row { display: table-row; }
    .meta-label { display: table-cell; font-weight: bold; width: 150px; padding: 4px 0; }
    .meta-value { display: table-cell; padding: 4px 0; }
    .particulars-section { margin: 15px 0; }
    .particulars-title { font-weight: bold; margin-bottom: 8px; font-size: 11px; color: #666; }
    .particulars-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .particulars-table th { background: #f5f5f5; padding: 6px 8px; border: 1px solid #ddd; font-weight: 600; }
    .particulars-table td { padding: 6px 8px; border: 1px solid #eee; }
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
  ${title ? `
  <div class="report-header">
    <div class="report-title">${title}</div>
    <div class="report-subtitle">Generated on ${new Date().toLocaleString('en-IN')}</div>
  </div>
  ` : ''}
  ${vouchers.map(v => `
    <div class="voucher">
      <div class="voucher-header">
        <div class="company-name">${v.company_name}</div>
        <div class="company-address">${v.company_address}</div>
        <div class="company-address">GST: ${v.company_gst}</div>
        <div class="voucher-title">PAYMENT VOUCHER</div>
        ${v.status === 'draft' ? '<div class="draft-badge">📝 DRAFT - Not Submitted</div>' : ''}
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
        ${v.invoice_reference ? `
        <div class="meta-row">
          <div class="meta-label">Invoice Ref:</div>
          <div class="meta-value">${v.invoice_reference}</div>
        </div>` : ''}
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
      
      ${renderNarrationItems(v)}
      
      <div class="voucher-amount">AMOUNT: ${formatCurrency(v.amount)}</div>
      <div style="font-size:11px;font-style:italic;color:#666;margin-bottom:15px;background:#fffbeb;padding:8px;border-radius:4px;border:1px solid #fcd34d">
        <strong style="color:#92400e">In Words:</strong> ${numToWords(v.amount)}
      </div>
      
      <div class="voucher-signatures">
        <div class="signature-box">
          <div class="signature-line">
            ${v.preparer_name || v.preparer_username}<br/>
            <span style="font-size:9px;color:#666">👤 Accounts</span><br/>
            <span style="font-size:8px;color:#888">${formatDate(v.created_at)}</span>
          </div>
          <div class="signature-label">Prepared By</div>
        </div>
        <div class="signature-box">
          <div class="signature-line">
            ${v.approver_name ? `
              ${v.approver_name}<br/>
              <span style="font-size:9px;color:#666">🛡️ Approver</span><br/>
              <span style="font-size:8px;color:#888">${v.approved_at ? formatDate(v.approved_at) : ''}</span>
            ` : '___________'}
          </div>
          <div class="signature-label">Approved By</div>
        </div>
        <div class="signature-box">
          <div class="signature-line">
            ${v.payee_otp_verified ? `
              ✓ OTP Verified<br/>
              <span style="font-size:8px;color:#888">${v.completed_at ? formatDate(v.completed_at) : ''}</span>
            ` : '___________'}
          </div>
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
  
  const handleApprove = async () => { 
    setLoading(true); 
    try { 
      const result = await api.approveVoucher(selectedVoucher.id, user.id); 
      if (result.success) { 
        if (result.requiresDocument) {
          // Ad-hoc payee - needs document upload
          addToast('Voucher pre-approved. Document upload required.', 'info');
          refreshVouchers();
          setShowModal(false);
        } else if (result.requiresAttestation) {
          // Document already uploaded - show attestation UI
          addToast('Document found. Please review and attest.', 'info');
          refreshVouchers();
        } else {
          // Standard OTP flow
          addToast('Voucher approved. OTP sent to payee.', 'success'); 
          refreshVouchers(); 
          setShowModal(false);
        }
      } else addToast(result.error, 'error'); 
    } catch { addToast('Failed', 'error'); } 
    setLoading(false); 
  };
  const handleApproveWithAttestation = async () => {
    if (!attestationNotes.trim()) {
      addToast('Please add attestation notes', 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await api.approveWithAttestation(selectedVoucher.id, user.id, attestationNotes);
      if (result.success) {
        addToast('Voucher approved with document attestation!', 'success');
        refreshVouchers();
        setShowModal(false);
        setShowAttestationModal(false);
        setAttestationNotes('');
      } else {
        addToast(result.error, 'error');
      }
    } catch {
      addToast('Failed', 'error');
    }
    setLoading(false);
  };
  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      addToast('Please upload a JPG, PNG, WebP or PDF file', 'error');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      addToast('File size must be less than 5MB', 'error');
      return;
    }
    
    setLoading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result;
        const result = await api.uploadVoucherDocument(selectedVoucher.id, base64Data, file.type, user.id);
        if (result.success) {
          addToast('Document uploaded! Awaiting approver attestation.', 'success');
          refreshVouchers();
          // Update local voucher state
          setSelectedVoucher({...selectedVoucher, document_url: result.documentUrl, verification_type: 'document'});
        } else {
          addToast(result.error || 'Upload failed', 'error');
        }
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      addToast('Upload failed', 'error');
      setLoading(false);
    }
  };
  const handleReject = async () => { setLoading(true); try { await api.rejectVoucher(selectedVoucher.id, user.id, rejectReason); addToast('Voucher rejected', 'info'); refreshVouchers(); setShowRejectModal(false); setShowModal(false); } catch { addToast('Failed', 'error'); } setLoading(false); };
  const handleComplete = async () => { if (payeeOtp.length < 6) { addToast('Enter complete OTP', 'error'); return; } setLoading(true); try { const result = await api.completeVoucher(selectedVoucher.id, payeeOtp); if (result.success) { addToast('Voucher completed!', 'success'); refreshVouchers(); setShowModal(false); setPayeeOtp(''); } else addToast(result.error, 'error'); } catch { addToast('Failed', 'error'); } setLoading(false); };
  const handleResend = async () => { try { await api.resendPayeeOtp(selectedVoucher.id); addToast('OTP resent', 'success'); } catch { addToast('Failed', 'error'); } };
  const handleDelete = async () => { setLoading(true); try { const result = await api.deleteVoucher(selectedVoucher.id, user.id); if (result.success) { addToast('Voucher deleted', 'success'); refreshVouchers(); setShowDeleteModal(false); setShowModal(false); } else addToast(result.error || 'Failed to delete', 'error'); } catch { addToast('Failed to delete voucher', 'error'); } setLoading(false); };
  const titles = { all: 'All Vouchers', draft: 'Saved Drafts', pending: 'Pending Approval', approved: 'Approved / Awaiting OTP', completed: 'Completed Vouchers' };

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
            {filtered.map(v => (<tr key={v.id}><td className="text-mono fw-600">{v.serial_number}</td><td>{v.head_of_account}</td><td>{v.payee_name}</td><td className="fw-600">{formatRupees(v.amount, 0)}</td><td>{v.payment_mode}</td><td><span className={`status-badge status-${v.status}`}>{v.status.replace(/_/g, ' ')}</span></td><td>{new Date(v.created_at).toLocaleDateString('en-IN')}</td><td><button className="btn btn-sm btn-secondary" onClick={() => openVoucher(v)}>{Icons.eye} View</button></td></tr>))}
          </tbody></table></div>
        )}
      </div></div>
      {showModal && selectedVoucher && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}><div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header" style={{background: '#f5841f', color: 'white'}}>
            <h3 className="modal-title" style={{color: 'white'}}>Voucher Details</h3>
            <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
              {(user.role === 'admin' || user.isSuperAdmin) && (
                <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true); }}>
                  🗑️ <span className="btn-text">Delete</span>
                </button>
              )}
              <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); handlePrintSingle(selectedVoucher); }}>
                {Icons.printer} <span className="btn-text">Print</span>
              </button>
              <button className="modal-close" style={{color: 'white'}} onClick={() => setShowModal(false)}>×</button>
            </div>
          </div>
          <div className="modal-body">
            <VoucherPreview voucher={selectedVoucher} />
            {/* Document Upload Section - for awaiting_document status */}
            {selectedVoucher.status === 'awaiting_document' && (selectedVoucher.prepared_by === user.id || user.role === 'admin' || user.isSuperAdmin) && !selectedVoucher.document_url && (
              <div className="document-upload-section" style={{background: '#fef3c7', padding: '1.5rem', borderRadius: '8px', marginTop: '1rem', textAlign: 'center'}}>
                <div style={{fontSize: '2rem', marginBottom: '0.5rem'}}>📄</div>
                <p style={{fontWeight: 600, color: '#92400e', marginBottom: '0.5rem'}}>Invoice/Receipt Upload Required</p>
                <p style={{fontSize: '0.85rem', color: '#a16207', marginBottom: '1rem'}}>This payment requires document verification. Please upload the invoice or receipt.</p>
                <label className="btn btn-primary" style={{cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem'}}>
                  {Icons.upload} Choose File
                  <input type="file" accept="image/*,.pdf" style={{display: 'none'}} onChange={handleDocumentUpload} disabled={loading} />
                </label>
                <p style={{fontSize: '0.75rem', color: '#a16207', marginTop: '0.5rem'}}>Accepts: JPG, PNG, WebP, PDF (max 5MB)</p>
              </div>
            )}
            {/* Document Preview - when document is uploaded */}
            {selectedVoucher.document_url && (
              <div className="document-preview-section" style={{background: '#ecfdf5', padding: '1rem', borderRadius: '8px', marginTop: '1rem', border: '1px solid #10b981'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem'}}>
                  {Icons.fileCheck}
                  <span style={{fontWeight: 600, color: '#059669'}}>Document Uploaded</span>
                  {selectedVoucher.verification_type === 'document' && selectedVoucher.status === 'completed' && (
                    <span style={{background: '#10b981', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', marginLeft: 'auto'}}>ATTESTED</span>
                  )}
                </div>
                <a href={selectedVoucher.document_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary" style={{marginTop: '0.5rem'}}>
                  {Icons.eye} View Document
                </a>
                {selectedVoucher.attestation_notes && (
                  <div style={{marginTop: '0.75rem', padding: '0.5rem', background: '#d1fae5', borderRadius: '4px', fontSize: '0.85rem'}}>
                    <strong>Attestation Notes:</strong> {selectedVoucher.attestation_notes}
                  </div>
                )}
              </div>
            )}
            {/* Awaiting Attestation - Admin can now attest after document upload */}
            {(user.role === 'admin' || user.isSuperAdmin) && selectedVoucher.status === 'awaiting_document' && selectedVoucher.document_url && (
              <div className="attestation-section" style={{background: '#eff6ff', padding: '1rem', borderRadius: '8px', marginTop: '1rem', border: '1px solid #3b82f6'}}>
                <p style={{fontWeight: 600, color: '#1d4ed8', marginBottom: '0.5rem'}}>📋 Document Ready for Attestation</p>
                <p style={{fontSize: '0.85rem', color: '#3b82f6', marginBottom: '1rem'}}>Review the uploaded document and attest to complete this voucher.</p>
                <button className="btn btn-primary" onClick={() => setShowAttestationModal(true)}>{Icons.fileCheck} Review & Attest</button>
              </div>
            )}
            {/* OTP Section - for registered payees */}
            {selectedVoucher.status === 'awaiting_payee_otp' && (selectedVoucher.prepared_by === user.id || user.role === 'admin' || user.isSuperAdmin) && (
              <div className="otp-section">
                {Icons.smartphone}<p style={{fontWeight:500,margin:'0.5rem 0'}}>Enter Payee OTP</p><p style={{fontSize:'0.85rem',color:'#666',marginBottom:'1rem'}}>OTP sent to payee: {selectedVoucher.payee_mobile?.replace(/\d(?=\d{4})/g, '*')}</p>
                <OTPInput value={payeeOtp} onChange={setPayeeOtp} />
                <div className="otp-actions" style={{display:'flex',flexDirection:'row',flexWrap:'wrap',gap:'0.75rem',justifyContent:'center',marginTop:'1rem'}}><button className="btn btn-secondary btn-sm" style={{flex:'1 1 auto',minWidth:'140px'}} onClick={handleResend}>{Icons.refresh} Resend OTP</button><button className="btn btn-success" style={{flex:'1 1 auto',minWidth:'160px'}} onClick={handleComplete} disabled={loading || payeeOtp.length < 6}>{loading && Icons.loader}{Icons.checkCircle} Complete Voucher</button></div>
              </div>
            )}
          </div>
          {(user.role === 'admin' || user.isSuperAdmin) && selectedVoucher.status === 'pending' && (
            <div className="modal-footer"><button className="btn btn-danger" onClick={() => setShowRejectModal(true)}>{Icons.x} Reject</button><button className="btn btn-success" onClick={handleApprove} disabled={loading}>{loading && Icons.loader}{Icons.check} Approve & Send Payee OTP</button></div>
          )}
          {selectedVoucher.status === 'draft' && selectedVoucher.prepared_by === user.id && (
            <div className="modal-footer" style={{background: '#fef3c7'}}>
              <div style={{flex: 1, fontSize: '0.85rem', color: '#92400e'}}>
                💡 This voucher is saved as a draft. Edit or submit when ready.
              </div>
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button className="btn btn-secondary" onClick={() => handleEditDraft(selectedVoucher)} disabled={loading}>
                  ✏️ Edit Draft
                </button>
                <button className="btn btn-primary" onClick={() => handleSubmitDraft(selectedVoucher)} disabled={loading}>
                  {loading && Icons.loader}{Icons.send} Submit for Approval
                </button>
              </div>
            </div>
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
      {/* Attestation Modal for Document Verification */}
      {showAttestationModal && selectedVoucher && (
        <div className="modal-overlay" onClick={() => setShowAttestationModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header" style={{background: '#3b82f6', color: 'white'}}>
            <h3 className="modal-title" style={{color: 'white'}}>📋 Document Attestation</h3>
            <button className="modal-close" style={{color: 'white'}} onClick={() => setShowAttestationModal(false)}>×</button>
          </div>
          <div className="modal-body">
            <div style={{background: '#eff6ff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem'}}>
              <p style={{fontWeight: 600, color: '#1d4ed8', marginBottom: '0.5rem'}}>Document Verification</p>
              <p style={{fontSize: '0.85rem', color: '#3b82f6'}}>
                You are attesting that you have reviewed the uploaded invoice/receipt and confirm it is valid for this payment.
              </p>
            </div>
            {selectedVoucher.document_url && (
              <div style={{marginBottom: '1rem'}}>
                <a href={selectedVoucher.document_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{width: '100%', justifyContent: 'center'}}>
                  {Icons.eye} View Uploaded Document
                </a>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Attestation Notes <span style={{color: '#dc2626'}}>*</span></label>
              <textarea 
                className="form-input" 
                rows={3} 
                placeholder="I have verified the attached invoice/receipt and confirm..." 
                value={attestationNotes} 
                onChange={(e) => setAttestationNotes(e.target.value)} 
              />
              <p style={{fontSize: '0.75rem', color: '#666', marginTop: '0.25rem'}}>Describe what you verified (invoice number, amount match, vendor details, etc.)</p>
            </div>
            <div style={{background: '#fef3c7', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', color: '#92400e'}}>
              ⚠️ By attesting, you confirm that you have physically verified the invoice/receipt and authorize this payment.
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowAttestationModal(false)}>Cancel</button>
            <button className="btn btn-success" onClick={handleApproveWithAttestation} disabled={loading || !attestationNotes.trim()}>
              {loading && Icons.loader}{Icons.fileCheck} Attest & Complete Voucher
            </button>
          </div>
        </div></div>
      )}
      {showDeleteModal && selectedVoucher && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3 className="modal-title">🗑️ Delete Voucher</h3><button className="modal-close" onClick={() => setShowDeleteModal(false)}>×</button></div>
          <div className="modal-body">
            <p style={{marginBottom: '1rem', color: '#dc2626', fontWeight: 500}}>⚠️ This action cannot be undone!</p>
            <p>Are you sure you want to delete voucher <strong>{selectedVoucher.serial_number}</strong>?</p>
            <div style={{background: '#fef2f2', padding: '1rem', borderRadius: '8px', marginTop: '1rem', fontSize: '0.9rem'}}>
              <strong>Voucher Details:</strong><br/>
              Payee: {selectedVoucher.payee_name}<br/>
              Amount: ₹{selectedVoucher.amount?.toLocaleString('en-IN')}<br/>
              Status: {selectedVoucher.status?.replace(/_/g, ' ')}
            </div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button><button className="btn btn-danger" onClick={handleDelete} disabled={loading}>{loading && Icons.loader}Delete Voucher</button></div>
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
      {showEditModal && selectedVoucher && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}><div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header" style={{background: '#f59e0b', color: 'white'}}>
            <h3 className="modal-title" style={{color: 'white'}}>✏️ Edit Draft - {selectedVoucher.voucher_number}</h3>
            <button className="modal-close" style={{color: 'white'}} onClick={() => setShowEditModal(false)}>×</button>
          </div>
          <div className="modal-body">
            <div style={{marginBottom: '1.5rem', padding: '1rem', background: '#fffbeb', borderRadius: '8px', border: '2px solid #f59e0b'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem'}}>
                {Icons.building}
                <span style={{fontSize: '1.1rem', fontWeight: 600}}>{user.company.name}</span>
              </div>
              <div style={{fontSize: '0.85rem', color: '#666'}}>{user.company.address}</div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Head of Account *</label>
                <select className="form-select" value={editForm.headOfAccount} onChange={(e) => setEditForm({ ...editForm, headOfAccount: e.target.value, subHeadOfAccount: '' })}>
                  <option value="">Select</option>
                  {heads.map(h => <option key={h} value={h}>{h}</option>)}
                  {editForm.headOfAccount && !heads.includes(editForm.headOfAccount) && (
                    <option value={editForm.headOfAccount}>{editForm.headOfAccount} (custom)</option>
                  )}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Sub-Category</label>
                <select className="form-select" value={editForm.subHeadOfAccount} onChange={(e) => setEditForm({ ...editForm, subHeadOfAccount: e.target.value })} disabled={!editForm.headOfAccount}>
                  <option value="">{!editForm.headOfAccount ? 'Select Head first' : subHeads.length === 0 ? 'No sub-categories (optional)' : 'Select (optional)'}</option>
                  {subHeads.map(sh => <option key={sh.id} value={sh.name}>{sh.name}</option>)}
                  {editForm.subHeadOfAccount && !subHeads.find(sh => sh.name === editForm.subHeadOfAccount) && (
                    <option value={editForm.subHeadOfAccount}>{editForm.subHeadOfAccount}</option>
                  )}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Mode *</label>
                <select className="form-select" value={editForm.paymentMode} onChange={(e) => setEditForm({ ...editForm, paymentMode: e.target.value })}>
                  <option value="UPI">UPI</option>
                  <option value="Account Transfer">Account Transfer</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Reference</label>
                <input type="text" className="form-input" placeholder="e.g., INV-2026-001 (optional)" value={editForm.invoiceReference} onChange={(e) => setEditForm({ ...editForm, invoiceReference: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Payee *</label>
              <select className="form-select" value={editForm.payeeId} onChange={(e) => setEditForm({ ...editForm, payeeId: e.target.value })}>
                <option value="">Select Payee</option>
                {payees.map(p => <option key={p.id} value={p.id}>{p.name} {p.alias && `(${p.alias})`}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label form-label-row">
                Narration / Line Items
                <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', background: useNarrationTable ? '#f59e0b' : '#888', color: 'white', padding: '0.35rem 0.75rem', borderRadius: '6px'}}>
                  <input type="checkbox" checked={useNarrationTable} onChange={(e) => {
                    setUseNarrationTable(e.target.checked);
                    if (!e.target.checked) setEditForm({ ...editForm, narrationItems: [] });
                  }} />
                  {useNarrationTable ? '📋 Multiple Items' : '📝 Simple Text'}
                </label>
              </label>
              {useNarrationTable ? (
                <NarrationItemsTable items={editForm.narrationItems} onChange={(items) => setEditForm({ ...editForm, narrationItems: items })} />
              ) : (
                <textarea className="form-input" rows={2} placeholder="Enter payment description" value={editForm.narration} onChange={(e) => setEditForm({ ...editForm, narration: e.target.value })} />
              )}
            </div>
            <div className="form-group">
              <label className="form-label">
                Amount (₹) *
                {useNarrationTable && editForm.narrationItems.length > 0 && <span style={{color: '#f59e0b', fontWeight: 'normal', marginLeft: '0.5rem'}}>(auto-calculated)</span>}
              </label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="Enter amount" 
                value={editForm.amount} 
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                readOnly={useNarrationTable && editForm.narrationItems.some(i => parseFloat(i.amount) > 0)}
                style={useNarrationTable && editForm.narrationItems.some(i => parseFloat(i.amount) > 0) ? {background: '#f5f5f5', fontWeight: 600, fontSize: '1.1rem'} : {}}
              />
              {editForm.amount > 0 && (
                <div style={{marginTop: '0.5rem', fontSize: '0.85rem', color: '#666', fontStyle: 'italic', background: '#fffbeb', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fcd34d'}}>
                  <strong style={{color: '#92400e'}}>In Words:</strong> {numberToWordsIndian(parseFloat(editForm.amount))}
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer" style={{display: 'flex', gap: '0.5rem', justifyContent: 'space-between'}}>
            <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button className="btn btn-secondary" onClick={() => handleUpdateDraft(true)} disabled={loading}>
                {loading && Icons.loader}💾 Save Draft
              </button>
              <button className="btn btn-primary" onClick={() => handleUpdateDraft(false)} disabled={loading}>
                {loading && Icons.loader}{Icons.send} Submit for Approval
              </button>
            </div>
          </div>
        </div></div>
      )}
    </div>
  );
};

// Users Management (Admin Dashboard)
const UsersManagement = () => {
  const { user, addToast } = useApp();
  const [users, setUsers] = useState([]);
  const [allCompanies, setAllCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', mobile: '', aadhar: '', role: 'accounts', companyAccess: [] });
  const [editUser, setEditUser] = useState({ name: '', mobile: '', aadhar: '', role: 'accounts', companyAccess: [] });
  const [loadingCompanyAccess, setLoadingCompanyAccess] = useState(false);
  const [onboardStep, setOnboardStep] = useState(1); // 1=form, 2=otp, 3=success
  const [otp, setOtp] = useState('');
  const [verifyOtp, setVerifyOtp] = useState('');
  const [pendingUserId, setPendingUserId] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [verifyingUser, setVerifyingUser] = useState(null);
  
  const refreshUsers = () => {
    api.getCompanyUsers(user.company.id).then(setUsers).finally(() => setLoading(false));
  };
  
  useEffect(() => { 
    refreshUsers(); 
    // Load all companies for multi-company access selection
    api.getCompanies().then(companies => {
      setAllCompanies(companies);
      // Pre-select current company with current role
      setNewUser(prev => ({
        ...prev,
        companyAccess: [{
          companyId: user.company.id,
          companyName: user.company.name,
          role: 'accounts',
          isPrimary: true
        }]
      }));
    }).catch(console.error);
  }, [user.company.id]);
  
  const handleCompanyAccessChange = (companyId, companyName, checked) => {
    setNewUser(prev => {
      let newAccess = [...prev.companyAccess];
      if (checked) {
        // Add company with default role
        newAccess.push({
          companyId,
          companyName,
          role: prev.role, // Use current selected role
          isPrimary: newAccess.length === 0
        });
      } else {
        // Remove company
        newAccess = newAccess.filter(ca => ca.companyId !== companyId);
        // If removed the primary, make first one primary
        if (newAccess.length > 0 && !newAccess.some(ca => ca.isPrimary)) {
          newAccess[0].isPrimary = true;
        }
      }
      return { ...prev, companyAccess: newAccess };
    });
  };
  
  const handleCompanyRoleChange = (companyId, newRole) => {
    setNewUser(prev => ({
      ...prev,
      companyAccess: prev.companyAccess.map(ca => 
        ca.companyId === companyId ? { ...ca, role: newRole } : ca
      )
    }));
  };
  
  const handleOnboardSubmit = async () => {
    if (!newUser.name?.trim() || !newUser.mobile?.trim() || !newUser.aadhar?.trim()) {
      addToast('All fields are required', 'error');
      console.log('Validation failed:', newUser);
      return;
    }
    
    if (newUser.companyAccess.length === 0) {
      addToast('Please select at least one company', 'error');
      return;
    }
    
    // Find primary company
    const primaryCompany = newUser.companyAccess.find(ca => ca.isPrimary) || newUser.companyAccess[0];
    
    const payload = {
      adminId: user.id,
      adminMobile: user.mobile,
      companyId: primaryCompany.companyId,
      name: newUser.name.trim(),
      mobile: newUser.mobile.trim(),
      aadhar: newUser.aadhar.trim(),
      role: primaryCompany.role,
      companyAccess: newUser.companyAccess.map(ca => ({
        companyId: ca.companyId,
        role: ca.role,
        isPrimary: ca.isPrimary
      }))
    };
    
    console.log('Onboard payload:', payload);
    
    setSubmitting(true);
    try {
      // Call admin onboard endpoint
      const result = await api.onboardUser(payload);
      
      if (result.success) {
        setPendingUserId(result.userId);
        setGeneratedUsername(result.username);
        // Send OTP to new user's mobile
        await api.sendOtp(newUser.mobile, 'registration');
        addToast('User created. OTP sent for verification.', 'success');
        setOnboardStep(2);
      } else {
        console.error('Onboard error:', result);
        addToast(result.error || 'Failed to onboard user', 'error');
      }
    } catch (error) {
      console.error('Onboard exception:', error);
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
    setNewUser({ 
      name: '', 
      mobile: '', 
      aadhar: '', 
      role: 'accounts',
      companyAccess: [{
        companyId: user.company.id,
        companyName: user.company.name,
        role: 'accounts',
        isPrimary: true
      }]
    });
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
  
  const handleResendVerification = async (userId, mobile, userName) => {
    if (!mobile) {
      addToast('Mobile number not found for this user', 'error');
      console.error('Missing mobile for user:', userId);
      return;
    }
    
    console.log('Sending OTP to mobile:', mobile);
    try {
      const result = await api.sendOtp(mobile, 'verification');
      if (result.success) {
        addToast(`Verification OTP sent to ${mobile.replace(/\d(?=\d{4})/g, '*')}`, 'success');
        setVerifyingUser({ id: userId, mobile, name: userName });
        setVerifyOtp('');
        setShowVerifyModal(true);
      } else {
        addToast(result.error || 'Failed to send OTP', 'error');
      }
    } catch (error) {
      console.error('OTP send error:', error);
      addToast('Failed to send OTP', 'error');
    }
  };
  
  const handleVerifyExistingUserOtp = async () => {
    if (verifyOtp.length !== 6) {
      addToast('Please enter 6-digit OTP', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      const verifyResult = await api.verifyOtp(verifyingUser.mobile, verifyOtp);
      if (verifyResult.success && verifyResult.status === 'approved') {
        const updateResult = await api.verifyUserMobile(verifyingUser.id);
        if (updateResult.success) {
          addToast('User verified successfully', 'success');
          setShowVerifyModal(false);
          setVerifyingUser(null);
          setVerifyOtp('');
          refreshUsers();
          if (selectedUser?.id === verifyingUser.id) {
            setSelectedUser({ ...selectedUser, mobile_verified: true });
          }
        } else {
          addToast(updateResult.error || 'Failed to update verification status', 'error');
        }
      } else {
        addToast('Invalid OTP', 'error');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      addToast('Failed to verify OTP', 'error');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleManualVerify = async (userId, userName) => {
    if (!confirm(`Manually verify ${userName}? This will mark their account as verified without OTP.`)) return;
    
    try {
      const result = await api.verifyUserMobile(userId);
      if (result.success) {
        addToast('User verified successfully', 'success');
        refreshUsers();
        if (selectedUser?.id === userId) {
          setSelectedUser({ ...selectedUser, mobile_verified: true });
        }
      } else {
        addToast(result.error || 'Failed to verify user', 'error');
      }
    } catch {
      addToast('Connection error', 'error');
    }
  };
  
  const handleEditUser = async (userToEdit) => {
    setSelectedUser(userToEdit);
    setEditUser({ 
      name: userToEdit.name, 
      mobile: userToEdit.mobile, 
      aadhar: userToEdit.aadhar, 
      role: userToEdit.role,
      companyAccess: []
    });
    setShowEditModal(true);
    
    // Load user's current company access
    setLoadingCompanyAccess(true);
    try {
      const companyAccess = await api.getUserCompanies(userToEdit.id);
      setEditUser(prev => ({ 
        ...prev, 
        companyAccess: companyAccess.map(ca => ({
          companyId: ca.companyId,
          role: ca.role,
          isPrimary: ca.isPrimary
        }))
      }));
    } catch (err) {
      console.error('Failed to load company access:', err);
      // Fallback to current company
      setEditUser(prev => ({ 
        ...prev, 
        companyAccess: [{
          companyId: user.company.id,
          role: userToEdit.role,
          isPrimary: true
        }]
      }));
    }
    setLoadingCompanyAccess(false);
  };
  
  const handleUpdateUser = async () => {
    if (!editUser.name?.trim() || !editUser.mobile?.trim() || !editUser.aadhar?.trim()) {
      addToast('All fields are required', 'error');
      return;
    }
    
    if (!editUser.companyAccess || editUser.companyAccess.length === 0) {
      addToast('At least one company access is required', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      // Update user basic info
      const result = await api.updateUser(selectedUser.id, {
        name: editUser.name,
        mobile: editUser.mobile,
        aadhar: editUser.aadhar,
        role: editUser.companyAccess.find(ca => ca.isPrimary)?.role || editUser.companyAccess[0].role,
        requesterId: user.id
      });
      
      if (result.success) {
        // Update company access
        const companyResult = await api.updateUserCompanies(selectedUser.id, editUser.companyAccess, user.id);
        if (companyResult.success) {
          addToast('User and company access updated successfully', 'success');
        } else {
          addToast('User updated but company access failed', 'warning');
        }
        setShowEditModal(false);
        refreshUsers();
      } else {
        addToast(result.error || 'Failed to update user', 'error');
      }
    } catch {
      addToast('Connection error', 'error');
    }
    setSubmitting(false);
  };
  
  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Delete user "${userName}"? This action cannot be undone.`)) return;
    
    try {
      const result = await api.deleteUser(userId, user.id);
      if (result.success) {
        addToast('User deleted successfully', 'success');
        refreshUsers();
      } else {
        addToast(result.error || 'Failed to delete user', 'error');
      }
    } catch {
      addToast('Connection error', 'error');
    }
  };
  
  const handleViewDetails = (userToView) => {
    setSelectedUser(userToView);
    setShowDetailsModal(true);
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
                  <th style={{textAlign: 'center'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{cursor: 'pointer'}} onClick={() => handleViewDetails(u)}>
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
                    <td style={{textAlign: 'center'}} onClick={(e) => e.stopPropagation()}>
                      <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'center'}}>
                        <button 
                          className="btn btn-sm btn-secondary" 
                          onClick={() => handleEditUser(u)}
                          title="Edit User"
                        >
                          ✏️
                        </button>
                        {!u.mobile_verified && (
                          <button 
                            className="btn btn-sm btn-primary" 
                            onClick={() => handleResendVerification(u.id, u.mobile, u.name)}
                            title="Resend Verification OTP"
                          >
                            📤
                          </button>
                        )}
                        <button 
                          className="btn btn-sm btn-danger" 
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          title="Delete User"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
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
                    <label className="form-label">Company Access *</label>
                    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '12px', background: '#fafafa' }}>
                      {allCompanies.map(company => {
                        const access = newUser.companyAccess.find(ca => ca.companyId === company.id);
                        const isChecked = !!access;
                        return (
                          <div key={company.id} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            padding: '10px',
                            marginBottom: '8px',
                            background: isChecked ? '#e8f5e9' : '#fff',
                            borderRadius: '6px',
                            border: isChecked ? '1px solid #4caf50' : '1px solid #ddd'
                          }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}>
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => handleCompanyAccessChange(company.id, company.name, e.target.checked)}
                                style={{ width: '18px', height: '18px' }}
                              />
                              <span style={{ fontWeight: 500 }}>{company.name}</span>
                            </label>
                            {isChecked && (
                              <select 
                                value={access.role}
                                onChange={(e) => handleCompanyRoleChange(company.id, e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px' }}
                              >
                                <option value="accounts">👤 Accounts</option>
                                <option value="admin">🛡️ Admin</option>
                              </select>
                            )}
                          </div>
                        );
                      })}
                      {allCompanies.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#666', padding: '10px' }}>Loading companies...</div>
                      )}
                    </div>
                    <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '6px', display: 'block' }}>
                      Select companies this user can access and their role in each
                    </small>
                  </div>
                  
                  <div style={{background: '#f8f9fa', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', color: '#666'}}>
                    <strong>ℹ️ Note:</strong> Username will be auto-generated as:<br/>
                    <code style={{background: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px', marginTop: '0.5rem', display: 'inline-block'}}>
                      {(newUser.companyAccess[0]?.role || 'accounts') === 'admin' ? 'Approve' : 'Accounts'}-{newUser.name.split(' ')[0] || 'FirstName'}
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
                    style={{marginTop: '1rem', width: '100%', maxWidth: '200px'}}
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
                    disabled={submitting || !newUser.name || !newUser.mobile || !newUser.aadhar || newUser.companyAccess.length === 0}
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
      
      {/* Edit User Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ Edit User</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editUser.name} 
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} 
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Mobile Number *</label>
                <input 
                  type="tel" 
                  className="form-input" 
                  value={editUser.mobile} 
                  onChange={(e) => setEditUser({ ...editUser, mobile: e.target.value })} 
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Aadhar Number *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editUser.aadhar} 
                  onChange={(e) => setEditUser({ ...editUser, aadhar: e.target.value })} 
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">🏢 Company Access *</label>
                {loadingCompanyAccess ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#666' }}>{Icons.loader} Loading...</div>
                ) : (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                    {allCompanies.map(company => {
                      const access = editUser.companyAccess?.find(ca => ca.companyId === company.id);
                      const isEnabled = !!access;
                      
                      return (
                        <div key={company.id} style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #e5e7eb',
                          background: isEnabled ? '#f0f9ff' : '#fff'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  // Add company access
                                  setEditUser(prev => ({
                                    ...prev,
                                    companyAccess: [...(prev.companyAccess || []), {
                                      companyId: company.id,
                                      role: 'accounts',
                                      isPrimary: prev.companyAccess?.length === 0
                                    }]
                                  }));
                                } else {
                                  // Remove company access (but keep at least one)
                                  if (editUser.companyAccess?.length <= 1) {
                                    addToast('At least one company is required', 'error');
                                    return;
                                  }
                                  const newAccess = editUser.companyAccess.filter(ca => ca.companyId !== company.id);
                                  // If removed was primary, make first one primary
                                  if (access?.isPrimary && newAccess.length > 0) {
                                    newAccess[0].isPrimary = true;
                                  }
                                  setEditUser(prev => ({ ...prev, companyAccess: newAccess }));
                                }
                              }}
                              style={{ width: '18px', height: '18px' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500 }}>{company.name}</div>
                              {isEnabled && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                  <select
                                    className="form-select"
                                    style={{ fontSize: '13px', padding: '4px 8px', width: 'auto' }}
                                    value={access.role}
                                    onChange={(e) => {
                                      setEditUser(prev => ({
                                        ...prev,
                                        companyAccess: prev.companyAccess.map(ca => 
                                          ca.companyId === company.id ? { ...ca, role: e.target.value } : ca
                                        )
                                      }));
                                    }}
                                  >
                                    <option value="accounts">👤 Accounts</option>
                                    <option value="admin">🛡 Admin</option>
                                  </select>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#666' }}>
                                    <input
                                      type="radio"
                                      name="primaryCompanyEdit"
                                      checked={access.isPrimary}
                                      onChange={() => {
                                        setEditUser(prev => ({
                                          ...prev,
                                          companyAccess: prev.companyAccess.map(ca => ({
                                            ...ca,
                                            isPrimary: ca.companyId === company.id
                                          }))
                                        }));
                                      }}
                                    />
                                    Primary
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                  Select which companies this user can access and their role in each
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleUpdateUser} 
                disabled={submitting || loadingCompanyAccess || !editUser.companyAccess?.length}
              >
                {submitting && Icons.loader}
                {Icons.check} Update User
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* User Details Modal */}
      {showDetailsModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">👤 User Details</h3>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{display: 'grid', gap: '1.5rem'}}>
                <div>
                  <label style={{display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem'}}>Full Name</label>
                  <div style={{fontSize: '1.1rem', fontWeight: 600}}>{selectedUser.name}</div>
                </div>
                
                <div>
                  <label style={{display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem'}}>Username</label>
                  <div style={{fontSize: '1rem', fontFamily: 'monospace', background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px'}}>{selectedUser.username}</div>
                </div>
                
                <div>
                  <label style={{display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem'}}>Mobile Number</label>
                  <div style={{fontSize: '1rem'}}>{selectedUser.mobile}</div>
                </div>
                
                <div>
                  <label style={{display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem'}}>Aadhar Number</label>
                  <div style={{fontSize: '1rem', fontFamily: 'monospace'}}>{selectedUser.aadhar}</div>
                </div>
                
                <div>
                  <label style={{display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem'}}>Role</label>
                  <span className={`status-badge ${selectedUser.role === 'admin' ? 'status-approved' : 'status-pending'}`}>
                    {selectedUser.role === 'admin' ? '🛡 Admin' : '👤 Accounts'}
                  </span>
                </div>
                
                <div>
                  <label style={{display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem'}}>Verification Status</label>
                  {selectedUser.mobile_verified ? 
                    <span className="status-badge status-completed">✅ Verified</span> : 
                    <span className="status-badge status-rejected">⚠ Unverified</span>
                  }
                </div>
                
                <div>
                  <label style={{display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem'}}>Last Login</label>
                  <div style={{fontSize: '1rem'}}>{selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString('en-IN') : 'Never logged in'}</div>
                </div>
                
                <div>
                  <label style={{display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem'}}>User ID</label>
                  <div style={{fontSize: '0.85rem', fontFamily: 'monospace', color: '#999'}}>{selectedUser.id}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
              {!selectedUser.mobile_verified && (
                <>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => {
                      handleResendVerification(selectedUser.id, selectedUser.mobile, selectedUser.name);
                      setShowDetailsModal(false);
                    }}
                  >
                    📤 Resend OTP
                  </button>
                  <button 
                    className="btn btn-success" 
                    onClick={() => {
                      handleManualVerify(selectedUser.id, selectedUser.name);
                      setShowDetailsModal(false);
                    }}
                  >
                    ✓ Verify Manually
                  </button>
                </>
              )}
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setShowDetailsModal(false);
                  handleEditUser(selectedUser);
                }}
              >
                ✏️ Edit User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Verification Modal */}
      {showVerifyModal && verifyingUser && (
        <div className="modal-overlay" onClick={() => setShowVerifyModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '400px'}}>
            <div className="modal-header">
              <h2 className="modal-title">Verify User Mobile</h2>
              <button className="modal-close" onClick={() => setShowVerifyModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{marginBottom: '1rem', color: '#666'}}>
                OTP sent to {verifyingUser.mobile.replace(/\d(?=\d{4})/g, '*')} for <strong>{verifyingUser.name}</strong>
              </p>
              <div className="form-group">
                <label className="form-label">Enter 6-digit OTP</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter OTP"
                  value={verifyOtp}
                  onChange={(e) => setVerifyOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  style={{fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.5rem'}}
                />
              </div>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => handleResendVerification(verifyingUser.id, verifyingUser.mobile, verifyingUser.name)}
                style={{marginTop: '0.5rem', width: '100%'}}
              >
                {Icons.refresh} Resend OTP
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowVerifyModal(false)}>Cancel</button>
              <button 
                className="btn btn-success" 
                onClick={handleVerifyExistingUserOtp} 
                disabled={submitting || verifyOtp.length !== 6}
              >
                {submitting && Icons.loader}
                ✓ Verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Payees Management Component
const PayeesManagement = () => {
  const { user, addToast } = useApp();
  const [payees, setPayees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPayee, setNewPayee] = useState({ name: '', alias: '', mobile: '', bankAccount: '', ifsc: '', upiId: '', isGlobal: false, payeeType: 'registered', requiresOtp: true });
  const [editPayee, setEditPayee] = useState({ id: '', name: '', alias: '', mobile: '', bankAccount: '', ifsc: '', upiId: '', is_global: false, payee_type: 'registered', requires_otp: true });
  const [importData, setImportData] = useState('');
  const [importMethod, setImportMethod] = useState('excel'); // 'paste' or 'excel'

  const refreshPayees = () => {
    api.getPayees(user.company.id).then(setPayees).finally(() => setLoading(false));
  };

  useEffect(() => { refreshPayees(); }, [user.company.id]);

  const handleAddPayee = async () => {
    if (!newPayee.name?.trim() || !newPayee.mobile?.trim()) {
      addToast('Name and Mobile are required', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      await api.createPayee({ ...newPayee, companyId: user.company.id });
      addToast('Payee added successfully', 'success');
      setShowAddModal(false);
      setNewPayee({ name: '', alias: '', mobile: '', bankAccount: '', ifsc: '', upiId: '', isGlobal: false, payeeType: 'registered', requiresOtp: true });
      refreshPayees();
    } catch (error) {
      addToast('Failed to add payee: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPayee = async () => {
    if (!editPayee.name?.trim() || !editPayee.mobile?.trim()) {
      addToast('Name and Mobile are required', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      await api.updatePayee(editPayee.id, editPayee);
      addToast('Payee updated successfully', 'success');
      setShowEditModal(false);
      refreshPayees();
    } catch (error) {
      addToast('Failed to update payee: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayee = async (id) => {
    if (!confirm('Are you sure you want to delete this payee?')) return;
    
    try {
      await api.deletePayee(id);
      addToast('Payee deleted successfully', 'success');
      refreshPayees();
    } catch (error) {
      addToast('Failed to delete payee: ' + error.message, 'error');
    }
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      addToast('Please paste CSV data to import', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const lines = importData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const imported = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const payee = {
          companyId: user.company.id,
          name: values[headers.indexOf('name')] || values[0],
          alias: values[headers.indexOf('alias')] || '',
          mobile: values[headers.indexOf('mobile')] || values[1],
          bankAccount: values[headers.indexOf('bank_account')] || values[headers.indexOf('bankaccount')] || '',
          ifsc: values[headers.indexOf('ifsc')] || '',
          upiId: values[headers.indexOf('upi')] || values[headers.indexOf('upi_id')] || ''
        };
        if (payee.name && payee.mobile) {
          await api.createPayee(payee);
          imported.push(payee.name);
        }
      }
      
      addToast(`Imported ${imported.length} payees successfully`, 'success');
      setShowImportModal(false);
      setImportData('');
      refreshPayees();
    } catch (error) {
      addToast('Import failed: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setSubmitting(true);
    try {
      // Use SheetJS (XLSX) library loaded from CDN
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const imported = [];
      for (const row of jsonData) {
        // Map common column names to our fields
        const payee = {
          companyId: user.company.id,
          name: row['Name'] || row['name'] || row['Payee Name'] || row['payee_name'] || row['PAYEE NAME'] || '',
          alias: row['Alias'] || row['alias'] || row['Short Name'] || '',
          mobile: String(row['Mobile'] || row['mobile'] || row['Phone'] || row['phone'] || row['Mobile Number'] || row['MOBILE'] || ''),
          bankAccount: row['Bank Account'] || row['bank_account'] || row['Account Number'] || row['Account No'] || row['ACCOUNT NO'] || '',
          ifsc: row['IFSC'] || row['ifsc'] || row['IFSC Code'] || row['ifsc_code'] || '',
          upiId: row['UPI'] || row['upi'] || row['UPI ID'] || row['upi_id'] || row['VPA'] || ''
        };
        
        if (payee.name && payee.mobile) {
          await api.createPayee(payee);
          imported.push(payee.name);
        }
      }
      
      if (imported.length === 0) {
        addToast('No valid payees found. Ensure Name and Mobile columns are present.', 'error');
      } else {
        addToast(`Imported ${imported.length} payees from Excel`, 'success');
        setShowImportModal(false);
        refreshPayees();
      }
    } catch (error) {
      addToast('Failed to parse Excel file: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportPayees = () => {
    if (payees.length === 0) {
      addToast('No payees to export', 'error');
      return;
    }
    
    try {
      // Create worksheet data with headers
      const wsData = [
        ['Payee Records - ' + user.company.name],
        ['Exported on: ' + new Date().toLocaleString('en-IN')],
        [],
        ['S.No.', 'Name', 'Alias', 'Mobile', 'Bank Account', 'IFSC Code', 'UPI ID']
      ];
      
      // Add payee rows
      payees.forEach((p, idx) => {
        wsData.push([
          idx + 1,
          p.name || '',
          p.alias || '',
          p.mobile || '',
          p.bank_account || '',
          p.ifsc || '',
          p.upi_id || ''
        ]);
      });
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 6 },   // S.No.
        { wch: 30 },  // Name
        { wch: 15 },  // Alias
        { wch: 15 },  // Mobile
        { wch: 20 },  // Bank Account
        { wch: 15 },  // IFSC
        { wch: 25 }   // UPI ID
      ];
      
      // Merge title cell
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Payees');
      
      // Generate filename with date
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Payees_${user.company.name.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.xlsx`;
      
      // Download file
      XLSX.writeFile(wb, filename);
      addToast('Payees exported successfully', 'success');
    } catch (error) {
      addToast('Failed to export: ' + error.message, 'error');
    }
  };

  const handleDownloadPayeeTemplate = () => {
    try {
      // Create template with headers and sample data
      const wsData = [
        ['PAYEE IMPORT TEMPLATE'],
        ['Instructions: Fill in the data starting from row 4. Name and Mobile are required fields.'],
        [],
        ['Name', 'Alias', 'Mobile', 'Bank Account', 'IFSC Code', 'UPI ID'],
        ['ABC Suppliers Pvt Ltd', 'ABC Suppliers', '9876543210', '1234567890123', 'SBIN0001234', 'abc@upi'],
        ['Kumar Electricals', 'Kumar Elec', '9876543211', '9876543210987', 'HDFC0001234', 'kumar@ybl'],
        ['', '', '', '', '', ''],
        ['', '', '', '', '', ''],
        ['', '', '', '', '', '']
      ];
      
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 30 },  // Name
        { wch: 20 },  // Alias
        { wch: 15 },  // Mobile
        { wch: 20 },  // Bank Account
        { wch: 15 },  // IFSC
        { wch: 25 }   // UPI ID
      ];
      
      // Merge header rows
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Payee Template');
      XLSX.writeFile(wb, 'Payee_Import_Template.xlsx');
      addToast('Template downloaded', 'success');
    } catch (error) {
      addToast('Failed to download template', 'error');
    }
  };

  if (loading) return <div className="loading-state"><div className="spinner"></div><p>Loading payees...</p></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manage Payees</h1>
          <p className="page-subtitle">Manage vendor and payee details</p>
        </div>
        <div style={{display: 'flex', gap: '0.75rem'}}>
          <button className="btn btn-secondary" onClick={handleExportPayees} disabled={payees.length === 0}>📤 Export Excel</button>
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>📥 Import</button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>➕ Add Payee</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Alias</th>
                  <th>Mobile</th>
                  <th>Bank Account</th>
                  <th>IFSC</th>
                  <th>UPI ID</th>
                  <th style={{textAlign: 'center'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payees.length === 0 ? (
                  <tr><td colSpan="8" style={{textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)'}}>No payees added yet. Click "Add Payee" to get started.</td></tr>
                ) : (
                  payees.map(p => (
                    <tr key={p.id} style={p.is_global && p.company_id !== user.company.id ? {background: '#f0f9ff'} : {}}>
                      <td className="fw-600">
                        {p.name}
                        {p.is_global && <span style={{marginLeft: '0.5rem', fontSize: '0.7rem', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '4px'}}>🌐 Global</span>}
                        {p.is_global && p.company_id !== user.company.id && <span style={{marginLeft: '0.25rem', fontSize: '0.65rem', color: '#666'}}>(from other company)</span>}
                      </td>
                      <td>
                        {p.payee_type === 'adhoc' ? (
                          <span style={{fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px'}}>📄 Ad-hoc</span>
                        ) : (
                          <span style={{fontSize: '0.75rem', background: '#d1fae5', color: '#059669', padding: '2px 8px', borderRadius: '4px'}}>✅ Registered</span>
                        )}
                      </td>
                      <td>{p.alias || '-'}</td>
                      <td>{p.mobile}</td>
                      <td>{p.bank_account || '-'}</td>
                      <td>{p.ifsc || '-'}</td>
                      <td>{p.upi_id || '-'}</td>
                      <td style={{textAlign: 'center'}}>
                        {p.company_id === user.company.id ? (
                          <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'center'}}>
                            <button className="btn btn-sm btn-secondary" onClick={() => { setEditPayee(p); setShowEditModal(true); }}>✏️</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeletePayee(p.id)}>🗑️</button>
                          </div>
                        ) : (
                          <span style={{fontSize: '0.75rem', color: '#888'}}>View Only</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">➕ Add Payee</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Payee Type Selector */}
              <div className="form-group" style={{background: '#fef3c7', padding: '1rem', borderRadius: '8px', border: '1px solid #fcd34d', marginBottom: '1rem'}}>
                <label className="form-label" style={{marginBottom: '0.75rem', fontWeight: 600, color: '#92400e'}}>📋 Payee Type</label>
                <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                  <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: '6px', background: newPayee.payeeType === 'registered' ? '#10b981' : '#e5e7eb', color: newPayee.payeeType === 'registered' ? 'white' : '#374151'}}>
                    <input type="radio" name="payeeType" checked={newPayee.payeeType === 'registered'} onChange={() => setNewPayee({...newPayee, payeeType: 'registered', requiresOtp: true})} style={{display: 'none'}} />
                    ✅ Registered Vendor
                  </label>
                  <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: '6px', background: newPayee.payeeType === 'adhoc' ? '#3b82f6' : '#e5e7eb', color: newPayee.payeeType === 'adhoc' ? 'white' : '#374151'}}>
                    <input type="radio" name="payeeType" checked={newPayee.payeeType === 'adhoc'} onChange={() => setNewPayee({...newPayee, payeeType: 'adhoc', requiresOtp: false})} style={{display: 'none'}} />
                    📄 Ad-hoc / One-time
                  </label>
                </div>
                <p style={{fontSize: '0.8rem', color: '#92400e', marginTop: '0.75rem'}}>
                  {newPayee.payeeType === 'registered' 
                    ? '✓ OTP verification will be sent to payee mobile for payment confirmation.' 
                    : '📄 Document upload required instead of OTP (for random shops, one-time vendors, etc.)'}
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input type="text" className="form-input" value={newPayee.name} onChange={e => setNewPayee({...newPayee, name: e.target.value})} placeholder="Vendor/Payee Name" />
              </div>
              <div className="form-group">
                <label className="form-label">Alias</label>
                <input type="text" className="form-input" value={newPayee.alias} onChange={e => setNewPayee({...newPayee, alias: e.target.value})} placeholder="Short Name" />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile {newPayee.payeeType === 'registered' ? '*' : '(for records)'}</label>
                <input type="tel" className="form-input" value={newPayee.mobile} onChange={e => setNewPayee({...newPayee, mobile: e.target.value})} placeholder="10-digit mobile" />
              </div>
              <div className="form-group">
                <label className="form-label">Bank Account</label>
                <input type="text" className="form-input" value={newPayee.bankAccount} onChange={e => setNewPayee({...newPayee, bankAccount: e.target.value})} placeholder="Account Number" />
              </div>
              <div className="form-group">
                <label className="form-label">IFSC Code</label>
                <input type="text" className="form-input" value={newPayee.ifsc} onChange={e => setNewPayee({...newPayee, ifsc: e.target.value})} placeholder="IFSC Code" />
              </div>
              <div className="form-group">
                <label className="form-label">UPI ID</label>
                <input type="text" className="form-input" value={newPayee.upiId} onChange={e => setNewPayee({...newPayee, upiId: e.target.value})} placeholder="user@bank" />
              </div>
              <div className="form-group" style={{background: '#f0f9ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bfdbfe'}}>
                <label style={{display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer'}}>
                  <input type="checkbox" checked={newPayee.isGlobal} onChange={e => setNewPayee({...newPayee, isGlobal: e.target.checked})} style={{width: '18px', height: '18px'}} />
                  <span style={{fontWeight: 500}}>🌐 Available for All Companies</span>
                </label>
                <p style={{fontSize: '0.8rem', color: '#666', marginTop: '0.5rem', marginLeft: '2rem'}}>
                  If checked, this payee will be visible and selectable across all companies.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddPayee} disabled={submitting}>{submitting ? 'Adding...' : 'Add Payee'}</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ Edit Payee</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input type="text" className="form-input" value={editPayee.name} onChange={e => setEditPayee({...editPayee, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Alias</label>
                <input type="text" className="form-input" value={editPayee.alias || ''} onChange={e => setEditPayee({...editPayee, alias: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile *</label>
                <input type="tel" className="form-input" value={editPayee.mobile} onChange={e => setEditPayee({...editPayee, mobile: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Bank Account</label>
                <input type="text" className="form-input" value={editPayee.bank_account || ''} onChange={e => setEditPayee({...editPayee, bank_account: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">IFSC Code</label>
                <input type="text" className="form-input" value={editPayee.ifsc || ''} onChange={e => setEditPayee({...editPayee, ifsc: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">UPI ID</label>
                <input type="text" className="form-input" value={editPayee.upi_id || ''} onChange={e => setEditPayee({...editPayee, upi_id: e.target.value})} />
              </div>
              <div className="form-group" style={{background: '#f0f9ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bfdbfe'}}>
                <label style={{display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer'}}>
                  <input type="checkbox" checked={editPayee.is_global || false} onChange={e => setEditPayee({...editPayee, is_global: e.target.checked})} style={{width: '18px', height: '18px'}} />
                  <span style={{fontWeight: 500}}>🌐 Available for All Companies</span>
                </label>
                <p style={{fontSize: '0.8rem', color: '#666', marginTop: '0.5rem', marginLeft: '2rem'}}>
                  If checked, this payee will be visible and selectable across all companies.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditPayee} disabled={submitting}>{submitting ? 'Updating...' : 'Update'}</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📥 Import Payees</h3>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{background: '#e0f2fe', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #0ea5e9'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div>
                    <strong style={{color: '#0369a1'}}>📋 Download Template First!</strong>
                    <p style={{fontSize: '0.85rem', color: '#0369a1', margin: '0.25rem 0 0'}}>Use our standard format for error-free import</p>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={handleDownloadPayeeTemplate}>📥 Download Template</button>
                </div>
              </div>
              <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem'}}>
                <button className={`btn ${importMethod === 'excel' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setImportMethod('excel')} style={{flex: 1}}>📊 Import from Excel</button>
                <button className={`btn ${importMethod === 'paste' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setImportMethod('paste')} style={{flex: 1}}>📋 Paste CSV</button>
              </div>
              {importMethod === 'excel' ? (
                <div>
                  <p style={{marginBottom: '1rem', color: 'var(--text-secondary)'}}>Upload an Excel file (.xlsx, .xls) with payee details</p>
                  <div className="form-group">
                    <input type="file" accept=".xlsx,.xls,.csv" className="form-input" onChange={handleExcelImport} style={{padding: '0.75rem'}} />
                  </div>
                  <div style={{background: '#fef3c7', padding: '1rem', borderRadius: '8px', marginTop: '1rem', fontSize: '0.85rem', border: '1px solid #f59e0b'}}>
                    <strong style={{color: '#92400e'}}>📋 Standard Format (Row 4 onwards):</strong>
                    <table style={{width: '100%', marginTop: '0.5rem', fontSize: '0.8rem', borderCollapse: 'collapse'}}>
                      <thead><tr style={{background: '#f59e0b', color: 'white'}}>
                        <th style={{padding: '4px', border: '1px solid #d97706'}}>Name *</th>
                        <th style={{padding: '4px', border: '1px solid #d97706'}}>Alias</th>
                        <th style={{padding: '4px', border: '1px solid #d97706'}}>Mobile *</th>
                        <th style={{padding: '4px', border: '1px solid #d97706'}}>Bank Account</th>
                        <th style={{padding: '4px', border: '1px solid #d97706'}}>IFSC Code</th>
                        <th style={{padding: '4px', border: '1px solid #d97706'}}>UPI ID</th>
                      </tr></thead>
                      <tbody><tr>
                        <td style={{padding: '4px', border: '1px solid #fcd34d'}}>ABC Suppliers</td>
                        <td style={{padding: '4px', border: '1px solid #fcd34d'}}>ABC</td>
                        <td style={{padding: '4px', border: '1px solid #fcd34d'}}>9876543210</td>
                        <td style={{padding: '4px', border: '1px solid #fcd34d'}}>123456789</td>
                        <td style={{padding: '4px', border: '1px solid #fcd34d'}}>SBIN0001234</td>
                        <td style={{padding: '4px', border: '1px solid #fcd34d'}}>abc@upi</td>
                      </tr></tbody>
                    </table>
                    <p style={{marginTop: '0.5rem', color: '#92400e'}}>* Required fields</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{marginBottom: '1rem', color: 'var(--text-secondary)'}}>Paste CSV data below. First row should be headers.</p>
                  <div className="form-group">
                    <textarea className="form-input" rows="10" value={importData} onChange={e => setImportData(e.target.value)} placeholder="Name,Alias,Mobile,Bank Account,IFSC Code,UPI ID&#10;ABC Suppliers,ABC,9876543210,123456789,SBIN0001234,abc@upi" style={{fontFamily: 'monospace', fontSize: '0.875rem'}} />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
              {importMethod === 'paste' && <button className="btn btn-primary" onClick={handleImport} disabled={submitting}>{submitting ? 'Importing...' : 'Import'}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Accounts/Heads of Account Management Component
const AccountsManagement = () => {
  const { user, addToast } = useApp();
  const [accounts, setAccounts] = useState([]);
  const [subHeadsMap, setSubHeadsMap] = useState({}); // Map of headId -> subHeads array
  const [expandedHeads, setExpandedHeads] = useState({}); // Track which heads are expanded
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditSubModal, setShowEditSubModal] = useState(false);
  const [selectedHeadForSub, setSelectedHeadForSub] = useState(null);
  const [editAccount, setEditAccount] = useState({ id: '', name: '', is_global: false });
  const [editSubAccount, setEditSubAccount] = useState({ id: '', name: '' });
  const [showImportModal, setShowImportModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newAccount, setNewAccount] = useState('');
  const [newAccountIsGlobal, setNewAccountIsGlobal] = useState(false);
  const [newSubAccount, setNewSubAccount] = useState('');
  const [importData, setImportData] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importMethod, setImportMethod] = useState('paste'); // 'paste' or 'excel'

  // Load accounts and sub-heads from database (includes global heads + their sub-heads)
  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await api.getHeadsOfAccount(user.company.id);
      if (Array.isArray(data)) {
        setAccounts(data.sort((a, b) => a.name.localeCompare(b.name)));
        // Load sub-heads for own company + sub-heads of global heads from other companies
        const subData = await api.getSubHeadsByCompany(user.company.id);
        if (Array.isArray(subData)) {
          const grouped = {};
          subData.forEach(sh => {
            if (!grouped[sh.head_id]) grouped[sh.head_id] = [];
            grouped[sh.head_id].push(sh);
          });
          setSubHeadsMap(grouped);
        }
      } else if (data.error) {
        addToast('Failed to load accounts: ' + data.error, 'error');
      }
    } catch (error) {
      addToast('Failed to load accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [user.company.id]);

  const toggleExpand = (headId) => {
    setExpandedHeads(prev => ({ ...prev, [headId]: !prev[headId] }));
  };

  const handleAddAccount = async () => {
    if (!newAccount.trim()) {
      addToast('Account name cannot be empty', 'error');
      return;
    }
    
    if (accounts.some(a => a.name === newAccount.trim())) {
      addToast('Account already exists', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.addHeadOfAccount(user.company.id, newAccount.trim(), newAccountIsGlobal);
      if (result.error) {
        addToast(result.error, 'error');
      } else {
        addToast('Account added successfully', 'success');
        setNewAccount('');
        setNewAccountIsGlobal(false);
        setShowAddModal(false);
        loadAccounts();
      }
    } catch (error) {
      addToast('Failed to add account', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSubAccount = async () => {
    if (!newSubAccount.trim()) {
      addToast('Sub-category name cannot be empty', 'error');
      return;
    }
    
    const existingSubs = subHeadsMap[selectedHeadForSub.id] || [];
    if (existingSubs.some(s => s.name === newSubAccount.trim())) {
      addToast('Sub-category already exists', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.addSubHeadOfAccount(selectedHeadForSub.id, user.company.id, newSubAccount.trim());
      if (result.error) {
        addToast(result.error, 'error');
      } else {
        addToast('Sub-category added successfully', 'success');
        setNewSubAccount('');
        setShowAddSubModal(false);
        setExpandedHeads(prev => ({ ...prev, [selectedHeadForSub.id]: true }));
        loadAccounts();
      }
    } catch (error) {
      addToast('Failed to add sub-category', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubAccount = async (subHead) => {
    if (!confirm(`Delete sub-category "${subHead.name}"?`)) return;
    
    try {
      const result = await api.deleteSubHeadOfAccount(subHead.id);
      if (result.error) {
        addToast(result.error, 'error');
      } else {
        addToast('Sub-category deleted successfully', 'success');
        loadAccounts();
      }
    } catch (error) {
      addToast('Failed to delete sub-category', 'error');
    }
  };

  const handleEditAccount = async () => {
    if (!editAccount.name?.trim()) {
      addToast('Account name cannot be empty', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      const result = await api.updateHeadOfAccount(editAccount.id, editAccount.name.trim(), editAccount.is_global);
      if (result.error) {
        addToast(result.error, 'error');
      } else {
        addToast('Account updated successfully', 'success');
        setShowEditModal(false);
        loadAccounts();
      }
    } catch (error) {
      addToast('Failed to update account', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubAccount = async () => {
    if (!editSubAccount.name?.trim()) {
      addToast('Sub-category name cannot be empty', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      const result = await api.updateSubHeadOfAccount(editSubAccount.id, editSubAccount.name.trim());
      if (result.error) {
        addToast(result.error, 'error');
      } else {
        addToast('Sub-category updated successfully', 'success');
        setShowEditSubModal(false);
        loadAccounts();
      }
    } catch (error) {
      addToast('Failed to update sub-category', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async (account) => {
    if (!confirm(`Delete "${account.name}"?`)) return;
    
    try {
      const result = await api.deleteHeadOfAccount(account.id);
      if (result.error) {
        addToast(result.error, 'error');
      } else {
        addToast('Account deleted successfully', 'success');
        loadAccounts();
      }
    } catch (error) {
      addToast('Failed to delete account', 'error');
    }
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      addToast('Please paste account names to import', 'error');
      return;
    }

    const lines = importData.trim().split('\n').map(l => l.trim()).filter(l => l);
    
    setSubmitting(true);
    try {
      const result = await api.importHeadsOfAccount(user.company.id, lines);
      if (result.error) {
        addToast(result.error, 'error');
      } else {
        addToast(`Imported ${result.imported || lines.length} accounts`, 'success');
        setImportData('');
        setShowImportModal(false);
        loadAccounts();
      }
    } catch (error) {
      addToast('Failed to import accounts', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setSubmitting(true);
    try {
      // Use SheetJS (XLSX) library loaded from CDN
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Extract account names from first column, skip header if present
      const startRow = jsonData[0] && (jsonData[0][0]?.toString().toLowerCase().includes('account') || jsonData[0][0]?.toString().toLowerCase().includes('head')) ? 1 : 0;
      const importedAccounts = jsonData.slice(startRow).map(row => row[0]?.toString().trim()).filter(name => name && name.length > 0);
      
      if (importedAccounts.length === 0) {
        addToast('No accounts found in Excel file. Ensure account names are in the first column.', 'error');
        return;
      }
      
      const result = await api.importHeadsOfAccount(user.company.id, importedAccounts);
      if (result.error) {
        addToast(result.error, 'error');
      } else {
        addToast(`Imported ${result.imported || importedAccounts.length} accounts from Excel`, 'success');
        setShowImportModal(false);
        setImportFile(null);
        loadAccounts();
      }
    } catch (error) {
      addToast('Failed to parse Excel file: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportAccounts = () => {
    if (accounts.length === 0) {
      addToast('No accounts to export', 'error');
      return;
    }
    
    try {
      // Create worksheet data with headers
      const wsData = [
        ['Heads of Account - ' + user.company.name],
        ['Exported on: ' + new Date().toLocaleString('en-IN')],
        [],
        ['S.No.', 'Head of Account', 'Sub-Categories']
      ];
      
      // Add account rows with sub-categories
      accounts.forEach((acc, idx) => {
        const subs = subHeadsMap[acc.id] || [];
        const subNames = subs.map(s => s.name).join(', ');
        wsData.push([
          idx + 1,
          acc.name,
          subNames || '-'
        ]);
      });
      
      // Add summary
      wsData.push([]);
      wsData.push(['Total Heads of Account:', accounts.length]);
      const totalSubs = Object.values(subHeadsMap).reduce((sum, arr) => sum + arr.length, 0);
      wsData.push(['Total Sub-Categories:', totalSubs]);
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 6 },   // S.No.
        { wch: 35 },  // Head of Account
        { wch: 60 }   // Sub-Categories
      ];
      
      // Merge title cells
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Heads of Account');
      
      // Also create a detailed sheet with sub-categories
      const detailData = [
        ['Detailed Heads & Sub-Categories - ' + user.company.name],
        [],
        ['S.No.', 'Head of Account', 'Sub-Category']
      ];
      
      let rowNum = 1;
      accounts.forEach(acc => {
        const subs = subHeadsMap[acc.id] || [];
        if (subs.length === 0) {
          detailData.push([rowNum++, acc.name, '-']);
        } else {
          subs.forEach((sub, subIdx) => {
            detailData.push([
              rowNum++,
              subIdx === 0 ? acc.name : '',
              sub.name
            ]);
          });
        }
      });
      
      const ws2 = XLSX.utils.aoa_to_sheet(detailData);
      ws2['!cols'] = [
        { wch: 6 },
        { wch: 35 },
        { wch: 40 }
      ];
      ws2['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }
      ];
      
      XLSX.utils.book_append_sheet(wb, ws2, 'Detailed View');
      
      // Generate filename with date
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `HeadsOfAccount_${user.company.name.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.xlsx`;
      
      // Download file
      XLSX.writeFile(wb, filename);
      addToast('Accounts exported successfully', 'success');
    } catch (error) {
      addToast('Failed to export: ' + error.message, 'error');
    }
  };

  const handleDownloadAccountTemplate = () => {
    try {
      // Create template with headers and sample data
      const wsData = [
        ['HEADS OF ACCOUNT IMPORT TEMPLATE'],
        ['Instructions: Enter one account name per row in Column A, starting from row 4.'],
        [],
        ['Head of Account'],
        ['Salaries & Wages'],
        ['Office Supplies'],
        ['Transportation'],
        ['Maintenance & Repairs'],
        ['Professional Fees'],
        ['Utilities'],
        [''],
        [''],
        ['']
      ];
      
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column width
      ws['!cols'] = [{ wch: 40 }];
      
      // Merge header rows
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 0 } }
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Account Template');
      XLSX.writeFile(wb, 'HeadsOfAccount_Import_Template.xlsx');
      addToast('Template downloaded', 'success');
    } catch (error) {
      addToast('Failed to download template', 'error');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Heads of Account</h1>
          <p className="page-subtitle">Manage expense and payment categories with sub-categories</p>
        </div>
        <div style={{display: 'flex', gap: '0.75rem'}}>
          <button className="btn btn-secondary" onClick={handleExportAccounts} disabled={accounts.length === 0}>📤 Export Excel</button>
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>📥 Import</button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>➕ Add Account</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div style={{textAlign: 'center', padding: '2rem'}}>Loading accounts...</div>
          ) : accounts.length === 0 ? (
            <div style={{textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)'}}>No accounts found. Add your first head of account.</div>
          ) : (
            <div style={{display: 'grid', gap: '0.5rem'}}>
              {accounts.map(account => {
                const subs = subHeadsMap[account.id] || [];
                const isExpanded = expandedHeads[account.id];
                const isFromOtherCompany = account.is_global && account.company_id !== user.company.id;
                return (
                  <div key={account.id} style={{border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', background: isFromOtherCompany ? '#f0f9ff' : 'white'}}>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: subs.length > 0 ? '#fef3c7' : (isFromOtherCompany ? '#f0f9ff' : 'white')}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, cursor: subs.length > 0 ? 'pointer' : 'default'}} onClick={() => subs.length > 0 && toggleExpand(account.id)}>
                        {subs.length > 0 && <span style={{fontSize: '0.8rem'}}>{isExpanded ? '▼' : '▶'}</span>}
                        <span style={{fontWeight: 500}}>{account.name}</span>
                        {account.is_global && <span style={{fontSize: '0.7rem', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '4px'}}>🌐 Global</span>}
                        {isFromOtherCompany && <span style={{fontSize: '0.65rem', color: '#666'}}>(from other company)</span>}
                        {subs.length > 0 && <span style={{fontSize: '0.75rem', color: '#666', background: '#e5e7eb', padding: '0.1rem 0.4rem', borderRadius: '10px'}}>{subs.length} sub</span>}
                      </div>
                      {account.company_id === user.company.id ? (
                        <div style={{display: 'flex', gap: '0.5rem'}}>
                          <button className="btn btn-sm btn-secondary" onClick={() => { setSelectedHeadForSub(account); setShowAddSubModal(true); }} title="Add Sub-Category">➕ Sub</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => { setEditAccount({ id: account.id, name: account.name, is_global: account.is_global || false }); setShowEditModal(true); }} title="Edit">✏️</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteAccount(account)} title="Delete">🗑️</button>
                        </div>
                      ) : (
                        <span style={{fontSize: '0.75rem', color: '#888', padding: '0.25rem 0.5rem'}}>View Only</span>
                      )}
                    </div>
                    {isExpanded && subs.length > 0 && (
                      <div style={{background: '#f9fafb', borderTop: '1px solid var(--border-color)'}}>
                        {subs.map(sub => (
                          <div key={sub.id} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem 0.5rem 2rem', borderBottom: '1px solid #eee'}}>
                            <span style={{fontSize: '0.9rem', color: '#555'}}>↳ {sub.name}</span>
                            <div style={{display: 'flex', gap: '0.25rem'}}>
                              <button className="btn btn-sm" onClick={() => { setEditSubAccount({ id: sub.id, name: sub.name }); setShowEditSubModal(true); }} style={{padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: '#f59e0b'}}>✏️</button>
                              <button className="btn btn-sm" onClick={() => handleDeleteSubAccount(sub)} style={{padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: '#dc2626'}}>🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">➕ Add Head of Account</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Account Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newAccount} 
                  onChange={e => setNewAccount(e.target.value)}
                  placeholder="e.g., Equipment Purchase"
                  onKeyPress={e => e.key === 'Enter' && handleAddAccount()}
                />
              </div>
              <div className="form-group" style={{background: '#f0f9ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bfdbfe'}}>
                <label style={{display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer'}}>
                  <input type="checkbox" checked={newAccountIsGlobal} onChange={e => setNewAccountIsGlobal(e.target.checked)} style={{width: '18px', height: '18px'}} />
                  <span style={{fontWeight: 500}}>🌐 Available for All Companies</span>
                </label>
                <p style={{fontSize: '0.8rem', color: '#666', marginTop: '0.5rem', marginLeft: '2rem'}}>
                  If checked, this account will be visible and selectable across all companies.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddAccount}>Add</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📥 Import Accounts</h3>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{background: '#e0f2fe', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #0ea5e9'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div>
                    <strong style={{color: '#0369a1'}}>📋 Download Template First!</strong>
                    <p style={{fontSize: '0.85rem', color: '#0369a1', margin: '0.25rem 0 0'}}>Use our standard format for error-free import</p>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={handleDownloadAccountTemplate}>📥 Download Template</button>
                </div>
              </div>
              <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem'}}>
                <button 
                  className={`btn ${importMethod === 'excel' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setImportMethod('excel')}
                  style={{flex: 1}}
                >
                  📊 Import from Excel
                </button>
                <button 
                  className={`btn ${importMethod === 'paste' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setImportMethod('paste')}
                  style={{flex: 1}}
                >
                  📋 Paste Text
                </button>
              </div>
              
              {importMethod === 'excel' ? (
                <div>
                  <p style={{marginBottom: '1rem', color: 'var(--text-secondary)'}}>
                    Upload an Excel file (.xlsx, .xls) with account names in Column A
                  </p>
                  <div className="form-group">
                    <input 
                      type="file" 
                      accept=".xlsx,.xls,.csv" 
                      className="form-input" 
                      onChange={handleExcelImport}
                      style={{padding: '0.75rem'}}
                    />
                  </div>
                  <div style={{background: '#fef3c7', padding: '1rem', borderRadius: '8px', marginTop: '1rem', border: '1px solid #f59e0b'}}>
                    <strong style={{color: '#92400e'}}>📋 Standard Format (Column A, Row 4 onwards):</strong>
                    <table style={{width: '100%', marginTop: '0.5rem', fontSize: '0.85rem', borderCollapse: 'collapse'}}>
                      <thead><tr style={{background: '#f59e0b', color: 'white'}}>
                        <th style={{padding: '6px', border: '1px solid #d97706', textAlign: 'left'}}>Head of Account</th>
                      </tr></thead>
                      <tbody>
                        <tr><td style={{padding: '6px', border: '1px solid #fcd34d'}}>Salaries & Wages</td></tr>
                        <tr><td style={{padding: '6px', border: '1px solid #fcd34d'}}>Office Supplies</td></tr>
                        <tr><td style={{padding: '6px', border: '1px solid #fcd34d'}}>Transportation</td></tr>
                        <tr><td style={{padding: '6px', border: '1px solid #fcd34d'}}>Maintenance & Repairs</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{marginBottom: '1rem', color: 'var(--text-secondary)'}}>
                    Paste account names below (one per line)
                  </p>
                  <div className="form-group">
                    <textarea 
                      className="form-input" 
                      rows="10" 
                      value={importData} 
                      onChange={e => setImportData(e.target.value)}
                      placeholder="Salaries & Wages&#10;Office Supplies&#10;Transportation&#10;Maintenance & Repairs&#10;Professional Fees"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
              {importMethod === 'paste' && <button className="btn btn-primary" onClick={handleImport} disabled={submitting}>{submitting ? 'Importing...' : 'Import'}</button>}
            </div>
          </div>
        </div>
      )}

      {showAddSubModal && selectedHeadForSub && (
        <div className="modal-overlay" onClick={() => { setShowAddSubModal(false); setSelectedHeadForSub(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">➕ Add Sub-Category</h3>
              <button className="modal-close" onClick={() => { setShowAddSubModal(false); setSelectedHeadForSub(null); }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{background: '#fef3c7', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem'}}>
                <strong>Parent:</strong> {selectedHeadForSub.name}
              </div>
              <div className="form-group">
                <label className="form-label">Sub-Category Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newSubAccount} 
                  onChange={e => setNewSubAccount(e.target.value)}
                  placeholder="e.g., Labour Charges - Civil Work"
                  onKeyPress={e => e.key === 'Enter' && handleAddSubAccount()}
                />
              </div>
              <p style={{fontSize: '0.85rem', color: '#666', marginTop: '0.5rem'}}>
                Example: For "Salaries & Wages", you might add "Labour Charges - Civil Work", "Labour Charges - Electrical", etc.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowAddSubModal(false); setSelectedHeadForSub(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddSubAccount} disabled={submitting}>{submitting ? 'Adding...' : 'Add Sub-Category'}</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ Edit Head of Account</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Account Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editAccount.name} 
                  onChange={e => setEditAccount({...editAccount, name: e.target.value})}
                  placeholder="Account name"
                  onKeyPress={e => e.key === 'Enter' && handleEditAccount()}
                />
              </div>
              <div className="form-group" style={{background: '#f0f9ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bfdbfe'}}>
                <label style={{display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer'}}>
                  <input type="checkbox" checked={editAccount.is_global || false} onChange={e => setEditAccount({...editAccount, is_global: e.target.checked})} style={{width: '18px', height: '18px'}} />
                  <span style={{fontWeight: 500}}>🌐 Available for All Companies</span>
                </label>
                <p style={{fontSize: '0.8rem', color: '#666', marginTop: '0.5rem', marginLeft: '2rem'}}>
                  If checked, this account will be visible and selectable across all companies.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditAccount} disabled={submitting}>{submitting ? 'Updating...' : 'Update'}</button>
            </div>
          </div>
        </div>
      )}

      {showEditSubModal && (
        <div className="modal-overlay" onClick={() => setShowEditSubModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ Edit Sub-Category</h3>
              <button className="modal-close" onClick={() => setShowEditSubModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Sub-Category Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editSubAccount.name} 
                  onChange={e => setEditSubAccount({...editSubAccount, name: e.target.value})}
                  placeholder="Sub-category name"
                  onKeyPress={e => e.key === 'Enter' && handleEditSubAccount()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditSubModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditSubAccount} disabled={submitting}>{submitting ? 'Updating...' : 'Update'}</button>
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
  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);
  const [switchingCompany, setSwitchingCompany] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const lastNotificationCount = React.useRef(0);

  // Notification sound (using Web Audio API for better compatibility)
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Pleasant notification chime
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1); // C#6
      oscillator.frequency.setValueAtTime(1318.51, audioContext.currentTime + 0.2); // E6
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } catch (e) {
      console.log('Audio not supported:', e);
    }
  }, []);

  // Request push notification permission and subscribe to push
  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.log('Push notifications not supported');
      return false;
    }
    
    try {
      // Request permission
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Notification permission denied');
          return false;
        }
      }
      
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Get VAPID public key from server
      const vapidResponse = await fetch(`${API_BASE}/push/vapid-public-key`);
      const { publicKey } = await vapidResponse.json();
      
      // Convert VAPID key to Uint8Array
      const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };
      
      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
      
      // Send subscription to server
      if (user) {
        await fetch(`${API_BASE}/users/${user.id}/push-subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON())
        });
        console.log('Push subscription saved to server');
      }
      
      setPushEnabled(true);
      addToast('Push notifications enabled!', 'success');
      return true;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      addToast('Failed to enable push notifications', 'error');
      return false;
    }
  }, [user, addToast]);

  // Disable push notifications
  const disablePushNotifications = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      return false;
    }
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe from push
        await subscription.unsubscribe();
        
        // Remove subscription from server
        if (user) {
          await fetch(`${API_BASE}/users/${user.id}/push-subscription`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      setPushEnabled(false);
      addToast('Push notifications disabled', 'info');
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      addToast('Failed to disable push notifications', 'error');
      return false;
    }
  }, [user, addToast]);

  // Toggle push notifications
  const togglePushNotifications = useCallback(async () => {
    if (pushEnabled) {
      await disablePushNotifications();
    } else {
      await requestPushPermission();
    }
  }, [pushEnabled, disablePushNotifications, requestPushPermission]);

  // Check push status on component mount
  useEffect(() => {
    const checkPushStatus = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setPushEnabled(!!subscription);
      } catch (e) {
        console.log('Could not check push status:', e);
      }
    };
    checkPushStatus();
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback((title, body, url = '/') => {
    if (Notification.permission === 'granted' && document.hidden) {
      const notification = new Notification(title, {
        body,
        icon: '/android-launchericon-192-192.png',
        badge: '/android-launchericon-96-96.png',
        vibrate: [200, 100, 200],
        tag: 'relish-notification',
        renotify: true
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, []);

  const addToast = useCallback((message, type = 'info') => { const id = Date.now(); setToasts(prev => [...prev, { id, message, type }]); setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000); }, []);
  const refreshVouchers = useCallback(async () => { if (user) { const data = await api.getVouchers(user.company.id); setVouchers(data); } }, [user]);
  const refreshNotifications = useCallback(async () => { 
    if (user) { 
      const data = await api.getNotifications(user.id); 
      const newUnread = data.filter(n => !n.read).length;
      
      // Check if there are new notifications
      if (newUnread > lastNotificationCount.current && lastNotificationCount.current !== 0) {
        // Play sound
        playNotificationSound();
        
        // Show browser notification if app is in background
        const latestUnread = data.find(n => !n.read);
        if (latestUnread) {
          showBrowserNotification(latestUnread.title, latestUnread.message);
        }
        
        // Show toast
        addToast(`${newUnread - lastNotificationCount.current} new notification(s)`, 'info');
      }
      
      lastNotificationCount.current = newUnread;
      setNotifications(data); 
    } 
  }, [user, playNotificationSound, showBrowserNotification, addToast]);

  // Request permission on login
  useEffect(() => {
    if (user) {
      requestPushPermission();
    }
  }, [user, requestPushPermission]);

  useEffect(() => { if (user) { refreshVouchers(); refreshNotifications(); const interval = setInterval(() => { refreshVouchers(); refreshNotifications(); }, 30000); return () => clearInterval(interval); } }, [user, refreshVouchers, refreshNotifications]);

  const handleLogin = (userData) => {
    setUser(userData);
    setCurrentPage('dashboard');
  };
  const handleLogout = () => {
    setUser(null); setVouchers([]); setNotifications([]); setCurrentPage('dashboard');
  };
  const handleSwitchCompany = async (companyId) => {
    setSwitchingCompany(true);
    try {
      const result = await api.switchCompany(user.id, companyId);
      if (result.success) {
        setUser(result.user);
        setVouchers([]);
        setCurrentPage('dashboard');
        setShowCompanySwitcher(false);
        // Refresh data for new company
        const newVouchers = await api.getVouchers(result.user.company.id);
        setVouchers(newVouchers);
      }
    } catch (error) {
      console.error('Failed to switch company:', error);
    }
    setSwitchingCompany(false);
  };
  const unreadCount = notifications.filter(n => !n.read).length;
  const markAllRead = async () => { await api.markAllNotificationsRead(user.id); refreshNotifications(); };
  const hasMultipleCompanies = user?.companies?.length > 1;

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const contextValue = { user, vouchers, notifications, addToast, refreshVouchers, refreshNotifications };
  const renderPage = () => { switch(currentPage) { case 'dashboard': return <Dashboard />; case 'create': return (user.role === 'accounts' || user.isSuperAdmin) ? <CreateVoucher /> : <Dashboard />; case 'drafts': return (user.role === 'accounts' || user.isSuperAdmin) ? <VoucherList filter="draft" /> : <Dashboard />; case 'pending': return <VoucherList filter="pending" />; case 'approved': return <VoucherList filter="approved" />; case 'completed': return <VoucherList filter="completed" />; case 'all': return <VoucherList filter="all" />; case 'users': return user.isSuperAdmin ? <UsersManagement /> : <Dashboard />; case 'payees': return (user.role === 'accounts' || user.isSuperAdmin) ? <PayeesManagement /> : <Dashboard />; case 'accounts': return (user.role === 'accounts' || user.isSuperAdmin) ? <AccountsManagement /> : <Dashboard />; default: return <Dashboard />; } };

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
            <div 
              className="company-badge" 
              onClick={() => hasMultipleCompanies && setShowCompanySwitcher(!showCompanySwitcher)}
              style={{ cursor: hasMultipleCompanies ? 'pointer' : 'default', position: 'relative' }}
            >
              {Icons.building} {user.company.name}
              {hasMultipleCompanies && <span style={{ marginLeft: '6px', fontSize: '10px' }}>▼</span>}
              
              {showCompanySwitcher && hasMultipleCompanies && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '8px',
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  minWidth: '280px',
                  zIndex: 1000,
                  border: '1px solid #eee'
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontWeight: 600, color: '#333' }}>
                    Switch Company
                  </div>
                  {user.companies.map(company => (
                    <div 
                      key={company.id}
                      onClick={(e) => { e.stopPropagation(); handleSwitchCompany(company.id); }}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: company.id === user.company.id ? '#f0f7ff' : 'white',
                        borderLeft: company.id === user.company.id ? '3px solid #2196f3' : '3px solid transparent'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, color: '#333' }}>{company.name}</div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                          {company.role === 'admin' ? '🛡️ Admin' : '👤 Accounts'}
                        </div>
                      </div>
                      {company.id === user.company.id && (
                        <span style={{ color: '#4caf50', fontSize: '16px' }}>✓</span>
                      )}
                    </div>
                  ))}
                  {switchingCompany && (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#666' }}>
                      Switching...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="header-right">
            <div className="user-badge">{user.isSuperAdmin ? '👑' : user.role === 'admin' ? Icons.shield : Icons.user} {user.username}</div>
            <button className="notification-btn" onClick={() => setShowNotifications(!showNotifications)}>{Icons.bell}{unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}</button>
            <button className="logout-btn" onClick={handleLogout}>{Icons.logOut} Sign Out</button>
          </div>
        </header>
        {showCompanySwitcher && (
          <div 
            onClick={() => setShowCompanySwitcher(false)} 
            style={{ position: 'fixed', inset: 0, zIndex: 999 }} 
          />
        )}
        <div className="main-layout">
          <aside className="sidebar">
            <div className="nav-section"><div className="nav-section-title">Main</div><div className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard')}>{Icons.home} Dashboard</div></div>
            <div className="nav-section"><div className="nav-section-title">Vouchers</div>
              {(user.role === 'accounts' || user.isSuperAdmin) && <div className={`nav-item ${currentPage === 'create' ? 'active' : ''}`} onClick={() => handleNavClick('create')}>{Icons.plus} Create Voucher</div>}
              {(user.role === 'accounts' || user.isSuperAdmin) && <div className={`nav-item ${currentPage === 'drafts' ? 'active' : ''}`} onClick={() => handleNavClick('drafts')}>📝 Drafts</div>}
              <div className={`nav-item ${currentPage === 'pending' ? 'active' : ''}`} onClick={() => handleNavClick('pending')}>{Icons.clock} Pending Approval</div>
              <div className={`nav-item ${currentPage === 'approved' ? 'active' : ''}`} onClick={() => handleNavClick('approved')}>{Icons.smartphone} Awaiting OTP</div>
              <div className={`nav-item ${currentPage === 'completed' ? 'active' : ''}`} onClick={() => handleNavClick('completed')}>{Icons.checkCircle} Completed</div>
              <div className={`nav-item ${currentPage === 'all' ? 'active' : ''}`} onClick={() => handleNavClick('all')}>{Icons.fileText} All Vouchers</div>
            </div>
            {(user.role === 'accounts' || user.isSuperAdmin) && <div className="nav-section"><div className="nav-section-title">Master Data</div>
              <div className={`nav-item ${currentPage === 'payees' ? 'active' : ''}`} onClick={() => handleNavClick('payees')}>{Icons.users} Manage Payees</div>
              <div className={`nav-item ${currentPage === 'accounts' ? 'active' : ''}`} onClick={() => handleNavClick('accounts')}>{Icons.fileText} Heads of Account</div>
            </div>}
            {user.isSuperAdmin && <div className="nav-section"><div className="nav-section-title">Admin Dashboard</div><div className={`nav-item ${currentPage === 'users' ? 'active' : ''}`} onClick={() => handleNavClick('users')}>{Icons.users} User Management</div></div>}
          </aside>
          
          {showMobileMenu && (
            <>
              <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)} />
              <aside className="mobile-menu">
                <div className="mobile-menu-header">
                  <h3>Menu</h3>
                  <button className="mobile-menu-close" onClick={() => setShowMobileMenu(false)}>{Icons.x}</button>
                </div>
                {hasMultipleCompanies && (
                  <div className="nav-section">
                    <div className="nav-section-title">{Icons.building} Company</div>
                    {user.companies.map(company => (
                      <div
                        key={company.id}
                        className="nav-item"
                        onClick={() => { handleSwitchCompany(company.id); setShowMobileMenu(false); }}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: company.id === user.company.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                          borderLeft: company.id === user.company.id ? '3px solid white' : '3px solid transparent',
                          opacity: switchingCompany ? 0.6 : 1
                        }}
                      >
                        <span>{company.name}</span>
                        {company.id === user.company.id && <span style={{fontSize:'12px'}}>✓ Active</span>}
                      </div>
                    ))}
                    {switchingCompany && <div style={{padding:'8px 16px', fontSize:'0.8rem', opacity:0.7}}>Switching...</div>}
                  </div>
                )}
                <div className="nav-section"><div className="nav-section-title">Main</div><div className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard')}>{Icons.home} Dashboard</div></div>
                <div className="nav-section"><div className="nav-section-title">Vouchers</div>
                  {(user.role === 'accounts' || user.isSuperAdmin) && <div className={`nav-item ${currentPage === 'create' ? 'active' : ''}`} onClick={() => handleNavClick('create')}>{Icons.plus} Create Voucher</div>}
                  {(user.role === 'accounts' || user.isSuperAdmin) && <div className={`nav-item ${currentPage === 'drafts' ? 'active' : ''}`} onClick={() => handleNavClick('drafts')}>📝 Drafts</div>}
                  <div className={`nav-item ${currentPage === 'pending' ? 'active' : ''}`} onClick={() => handleNavClick('pending')}>{Icons.clock} Pending Approval</div>
                  <div className={`nav-item ${currentPage === 'approved' ? 'active' : ''}`} onClick={() => handleNavClick('approved')}>{Icons.smartphone} Awaiting OTP</div>
                  <div className={`nav-item ${currentPage === 'completed' ? 'active' : ''}`} onClick={() => handleNavClick('completed')}>{Icons.checkCircle} Completed</div>
                  <div className={`nav-item ${currentPage === 'all' ? 'active' : ''}`} onClick={() => handleNavClick('all')}>{Icons.fileText} All Vouchers</div>
                </div>
                {(user.role === 'accounts' || user.isSuperAdmin) && <div className="nav-section"><div className="nav-section-title">Master Data</div>
                  <div className={`nav-item ${currentPage === 'payees' ? 'active' : ''}`} onClick={() => handleNavClick('payees')}>{Icons.users} Manage Payees</div>
                  <div className={`nav-item ${currentPage === 'accounts' ? 'active' : ''}`} onClick={() => handleNavClick('accounts')}>{Icons.fileText} Heads of Account</div>
                </div>}
                {user.isSuperAdmin && <div className="nav-section"><div className="nav-section-title">Admin Dashboard</div><div className={`nav-item ${currentPage === 'users' ? 'active' : ''}`} onClick={() => handleNavClick('users')}>{Icons.users} User Management</div></div>}
              </aside>
            </>
          )}
          <main className="main-content">{renderPage()}</main>
          {showNotifications && (
            <div className="notifications-panel">
              <div className="notifications-header">
                <h3 style={{fontSize:'1rem',fontWeight:600}}>Notifications</h3>
                <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                  <button 
                    className={`btn btn-sm ${pushEnabled ? 'btn-success' : 'btn-secondary'}`}
                    onClick={togglePushNotifications}
                    title={pushEnabled ? 'Push notifications enabled - click to disable' : 'Push notifications disabled - click to enable'}
                    style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 8px'}}
                  >
                    {pushEnabled ? Icons.bell : Icons.bellOff}
                    <span style={{fontSize:'0.75rem'}}>{pushEnabled ? 'On' : 'Off'}</span>
                  </button>
                  {unreadCount > 0 && <button className="btn btn-sm btn-secondary" onClick={markAllRead}>Mark all read</button>}
                </div>
              </div>
              {notifications.length === 0 ? <div className="empty-state">{Icons.bell}<p>No notifications</p></div> : notifications.map(n => (<div key={n.id} className={`notification-item ${!n.read ? 'unread' : ''}`}><div className="notification-title">{n.title}</div><div className="notification-message">{n.message}</div><div className="notification-time">{new Date(n.created_at).toLocaleString('en-IN')}</div></div>))}
            </div>
          )}
        </div>
        <Toast toasts={toasts} />
      </div>
    </AppContext.Provider>
  );
};

// Mark app as loaded successfully
window.__appLoaded = true;
const loadingEl = document.getElementById('app-loading');
if (loadingEl) loadingEl.style.display = 'none';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
