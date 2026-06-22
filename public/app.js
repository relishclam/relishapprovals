const { useState, useEffect, createContext, useContext, useCallback } = React;

// Register protocol handler so the installed PWA can be launched via web+relishapprovals://
if ('registerProtocolHandler' in navigator) {
  navigator.registerProtocolHandler('web+relishapprovals', '/?from=%s');
}

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
  wallet: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>,
  paperclip: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  qrCode: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>,
};

// Number to Words Converter for Indian Rupees
const numberToWordsIndian = (num) => {
  if (num === undefined || num === null || isNaN(num)) return '';
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
  refreshSession: (userId) => fetch(`${API_BASE}/users/${userId}/session`).then(r => r.json()),
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
  createStaffLogin: (payeeId, requesterId, aadhar) => fetch(`${API_BASE}/payees/${payeeId}/create-staff-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requesterId, aadhar }) }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || d.details || 'Request failed'); return d; }),
  getSettlementEntries: (token) => fetch(`${API_BASE}/settlement-sessions/${token}/entries`).then(r => r.json()),
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
  // Suspense vouchers
  getSuspenseVouchers: (companyId, params) => { const q = new URLSearchParams(params || {}).toString(); return fetch(`${API_BASE}/companies/${companyId}/suspense-vouchers${q ? '?' + q : ''}`).then(r => r.json()); },
  getPendingTopUps: (companyId) => fetch(`${API_BASE}/companies/${companyId}/pending-topups`).then(r => r.json()),
  createSuspenseVoucher: (data) => fetch(`${API_BASE}/suspense-vouchers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  getSuspenseVoucher: (id) => fetch(`${API_BASE}/suspense-vouchers/${id}`).then(r => r.json()),
  approveSuspenseVoucher: (id, approvedBy) => fetch(`${API_BASE}/suspense-vouchers/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvedBy }) }).then(r => r.json()),
  verifyAdvanceOtp: (id, otp, verifiedBy) => fetch(`${API_BASE}/suspense-vouchers/${id}/verify-advance-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp, verifiedBy }) }).then(r => r.json()),
  resendAdvanceOtp: (id, requestedBy) => fetch(`${API_BASE}/suspense-vouchers/${id}/resend-advance-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestedBy }) }).then(r => r.json()),
  rejectSuspenseVoucher: (id, rejectedBy, reason) => fetch(`${API_BASE}/suspense-vouchers/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rejectedBy, reason }) }).then(r => r.json()),
  addSuspenseSettlement: (suspenseId, data) => fetch(`${API_BASE}/suspense-vouchers/${suspenseId}/settlements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  getSuspenseSettlements: (suspenseId) => fetch(`${API_BASE}/suspense-vouchers/${suspenseId}/settlements`).then(r => r.json()),
  getSettlementSession: (token) => fetch(`${API_BASE}/settlement-sessions/${token}`).then(r => r.json()),
  submitSettlementSession: (token, data) => fetch(`${API_BASE}/settlement-sessions/${token}/settlements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  approveSettlementEntry: (settlementId, data) => fetch(`${API_BASE}/suspense-settlements/${settlementId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  combineSettlements: (suspenseId, data) => fetch(`${API_BASE}/suspense-vouchers/${suspenseId}/combine-settlements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  resendSettlementLink: (suspenseId, requestedBy) => fetch(`${API_BASE}/suspense-vouchers/${suspenseId}/resend-settlement-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestedBy }) }).then(r => r.json()),
  topUpSuspenseVoucher: (suspenseId, data) => fetch(`${API_BASE}/suspense-vouchers/${suspenseId}/topup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  approveTopUp: (settlementId, approvedBy) => fetch(`${API_BASE}/suspense-settlements/${settlementId}/approve-topup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvedBy }) }).then(r => r.json()),
  rejectTopUp: (settlementId, rejectedBy, reason) => fetch(`${API_BASE}/suspense-settlements/${settlementId}/reject-topup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rejectedBy, reason }) }).then(r => r.json()),
  closeSuspenseVoucher: (suspenseId, closedBy) => fetch(`${API_BASE}/suspense-vouchers/${suspenseId}/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ closedBy }) }).then(r => r.json()),
  // Attachments
  uploadAttachment: (data) => fetch(`${API_BASE}/attachments/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  getAttachments: (params) => fetch(`${API_BASE}/attachments?${new URLSearchParams(params)}`).then(r => r.json()),
  deleteAttachment: (id, deletedBy) => fetch(`${API_BASE}/attachments/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deletedBy }) }).then(r => r.json()),
  // Capture sessions
  createCaptureSession: (data) => fetch(`${API_BASE}/capture-sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  getCaptureSession: (id) => fetch(`${API_BASE}/capture-sessions/${id}`).then(r => r.json()),
  uploadToCapture: (id, data) => fetch(`${API_BASE}/capture-sessions/${id}/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
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

// ─── Mobile device detection ─────────────────────────────────────────────────
const isMobileDevice = () => {
  const ua = navigator.userAgent;
  // Only match genuine mobile user agents — desktop PWA installs have desktop UA strings
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
};

// ─── Simple PIN hash (salted, non-reversible) ────────────────────────────────
const hashPin = (pin) => {
  let hash = 0;
  const str = 'relish_salt_' + pin + '_2026';
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'p_' + Math.abs(hash).toString(36);
};

// ─── Shared numpad used by both SetPinModal and MobileLockScreen ─────────────
const PinNumpad = ({ value, onChange, disabled }) => {
  const handle = (key) => {
    if (disabled) return;
    if (key === '⌫') { onChange(value.slice(0, -1)); return; }
    if (value.length < 4) onChange(value + key);
  };

  // Accept keyboard input (digits + Backspace)
  useEffect(() => {
    const onKey = (e) => {
      if (disabled) return;
      if (e.key === 'Backspace') { e.preventDefault(); handle('⌫'); }
      else if (/^[0-9]$/.test(e.key)) { e.preventDefault(); handle(e.key); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [value, disabled]);

  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',maxWidth:'252px',margin:'0 auto'}}>
      {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k,i) => (
        <button key={i} type="button" disabled={k===''||disabled}
          onPointerDown={(e) => { e.preventDefault(); handle(String(k)); }}
          style={{height:'54px',border:k===''?'none':'1.5px solid #ddd',borderRadius:'14px',
            background:k===''?'transparent':'#fafafa',fontSize:k==='⌫'?'1.2rem':'1.4rem',
            fontWeight:600,cursor:k===''?'default':'pointer',fontFamily:'inherit',color:'#222',
            WebkitTapHighlightColor:'transparent',touchAction:'manipulation'}}>
          {k}
        </button>
      ))}
    </div>
  );
};

// ─── PIN dots display ────────────────────────────────────────────────────────
const PinDots = ({ length, filled, shake }) => (
  <div className={`pin-dots${shake?' pin-shake':''}`}>
    {Array.from({length},(_,i)=>(
      <div key={i} className={`pin-dot${i<filled?' filled':''}`}/>
    ))}
  </div>
);

// ─── Set PIN modal (shown once after first mobile login) ─────────────────────
const SetPinModal = ({ onPinSet, onSkip }) => {
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handlePin = (v) => {
    setPin(v); setError('');
    if (v.length === 4) setTimeout(() => setStep(2), 280);
  };
  const handleConfirm = (v) => {
    setConfirm(v); setError('');
    if (v.length === 4) {
      if (v === pin) { onPinSet(v); }
      else {
        setError('PINs do not match — try again');
        setShake(true); setTimeout(() => setShake(false), 500);
        setConfirm(''); setStep(1); setPin('');
      }
    }
  };

  const cur = step === 1 ? pin : confirm;
  return (
    <div className="modal-overlay">
      <div className="modal" style={{maxWidth:'360px'}}>
        <div className="modal-header"><h3 className="modal-title">🔒 Set App PIN</h3></div>
        <div className="modal-body" style={{textAlign:'center',padding:'1.5rem'}}>
          <p style={{fontSize:'0.88rem',color:'#555',marginBottom:'1.25rem'}}>
            {step===1 ? 'Enter a 4-digit PIN to lock this app when not in use.' : 'Re-enter your PIN to confirm.'}
          </p>
          {error && <div className="alert alert-error" style={{marginBottom:'1rem',fontSize:'0.82rem'}}>{error}</div>}
          <PinDots length={4} filled={cur.length} shake={shake}/>
          <div style={{marginTop:'1.25rem'}}>
            <PinNumpad value={cur} onChange={step===1?handlePin:handleConfirm}/>
          </div>
          <p style={{fontSize:'0.75rem',color:'#aaa',marginTop:'1rem'}}>Step {step} of 2</p>
        </div>
        <div className="modal-footer" style={{justifyContent:'center'}}>
          <button className="btn btn-secondary" style={{fontSize:'0.82rem'}} onClick={onSkip}>Skip for now</button>
        </div>
      </div>
    </div>
  );
};

// ─── Mobile Lock Screen (biometric first → PIN fallback) ─────────────────────
const MobileLockScreen = ({ savedUser, onUnlock, onSignOut }) => {
  const hasPin   = !!localStorage.getItem('relish_mobile_pin');
  const hasBio   = !!localStorage.getItem('relish_mobile_bio_id');
  const [mode, setMode]     = useState(hasBio ? 'bio' : 'pin');
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState('');
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake]   = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  // Auto-trigger biometric on mount
  useEffect(() => { if (mode === 'bio') attemptBio(); }, []);

  const attemptBio = async () => {
    setBioLoading(true); setError('');
    try {
      const credIdB64 = localStorage.getItem('relish_mobile_bio_id');
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const credIdBytes = Uint8Array.from(atob(credIdB64), c => c.charCodeAt(0));
      await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: credIdBytes, type: 'public-key', transports: ['internal'] }],
          userVerification: 'required',
          timeout: 60000
        }
      });
      onUnlock(savedUser);
    } catch (e) {
      setBioLoading(false);
      if (e.name === 'NotAllowedError') setError('Biometric cancelled. Try again or use PIN.');
      else { setError('Biometric unavailable. Use PIN.'); setMode('pin'); }
    }
  };

  const handlePinChange = (v) => {
    setPin(v); setError('');
    if (v.length === 4) {
      const stored = localStorage.getItem('relish_mobile_pin');
      if (stored && hashPin(v) === stored) {
        onUnlock(savedUser);
      } else {
        const att = attempts + 1;
        setAttempts(att);
        setShake(true); setTimeout(() => setShake(false), 500);
        setPin('');
        if (att >= 5) {
          setError('Too many attempts — please sign in again.');
          setTimeout(() => { localStorage.removeItem('relish_session'); localStorage.removeItem('relish_mobile_pin'); localStorage.removeItem('relish_mobile_bio_id'); localStorage.removeItem('relish_page'); onSignOut(); }, 2000);
        } else {
          setError(`Incorrect PIN — ${5-att} attempt${5-att===1?'':'s'} left`);
        }
      }
    }
  };

  return (
    <div className="lock-screen-container">
      <div className="lock-screen-card">
        <div className="lock-screen-avatar">{savedUser.name ? savedUser.name[0].toUpperCase() : '?'}</div>
        <h2 className="lock-screen-name">{savedUser.name}</h2>
        <p className="lock-screen-company">{savedUser.company?.name || ''}</p>

        {mode === 'bio' ? (
          <div style={{textAlign:'center'}}>
            <button
              onClick={attemptBio} disabled={bioLoading}
              style={{background:'var(--relish-orange)',border:'none',borderRadius:'50%',
                width:'80px',height:'80px',fontSize:'2.2rem',cursor:'pointer',margin:'1.5rem auto',
                display:'flex',alignItems:'center',justifyContent:'center',
                boxShadow:'0 0 0 8px rgba(245,132,31,0.18)',transition:'transform 0.1s'}}
              title="Unlock with Face / Fingerprint">
              {bioLoading ? '⏳' : '🔐'}
            </button>
            <p style={{fontSize:'0.85rem',color:'#888',marginBottom:'0.5rem'}}>
              {bioLoading ? 'Waiting for biometric…' : 'Tap to unlock with Face / Fingerprint'}
            </p>
            {error && <div className="alert alert-error" style={{fontSize:'0.82rem',marginBottom:'0.75rem'}}>{error}</div>}
            {hasPin && (
              <button className="lock-screen-signout" style={{color:'var(--relish-orange)'}} onClick={() => { setMode('pin'); setError(''); }}>
                Use PIN instead
              </button>
            )}
          </div>
        ) : (
          <div style={{width:'100%'}}>
            <p className="lock-screen-subtitle">Enter your 4-digit PIN</p>
            {error && <div className="alert alert-error" style={{fontSize:'0.82rem',marginBottom:'0.75rem'}}>{error}</div>}
            <PinDots length={4} filled={pin.length} shake={shake}/>
            <div style={{marginTop:'1.25rem'}}><PinNumpad value={pin} onChange={handlePinChange} disabled={attempts>=5}/></div>
            {hasBio && (
              <button className="lock-screen-signout" style={{color:'var(--relish-orange)',marginTop:'0.75rem'}} onClick={() => { setMode('bio'); setError(''); setPin(''); attemptBio(); }}>
                Use Face / Fingerprint instead
              </button>
            )}
          </div>
        )}

        <button className="lock-screen-signout" onClick={onSignOut}>{Icons.logOut} Sign in with a different account</button>
      </div>
    </div>
  );
};

// ─── Register mobile biometric (called once after login on mobile) ────────────
const registerMobileBiometric = async (userData) => {
  if (!window.PublicKeyCredential) return false;
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) return false;
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Relish Approvals', id: location.hostname },
        user: {
          id: new TextEncoder().encode(String(userData.id)),
          name: userData.username || userData.name,
          displayName: userData.name || userData.username
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged'
        },
        timeout: 60000,
        attestation: 'none'
      }
    });
    if (credential) {
      const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem('relish_mobile_bio_id', credId);
      return true;
    }
  } catch (e) {
    console.log('Mobile biometric setup skipped:', e.name);
  }
  return false;
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

  // Parse deductions
  const deductions = typeof voucher.deductions === 'string'
    ? JSON.parse(voucher.deductions || '[]')
    : (voucher.deductions || []);
  const validDeductions = deductions.filter(d => d.description || d.amount);
  const deductionTotal = validDeductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  
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
          {validDeductions.length === 0 && (
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
          )}
        </table>
      </div>
    );
  };

  // Render deductions table
  const DeductionsDisplay = () => {
    if (validDeductions.length === 0) return null;
    return (
      <div style={{margin: '1rem 0'}}>
        <div style={{fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: '#3730a3', borderBottom: '2px solid #6366f1', paddingBottom: '0.5rem'}}>Less: Advance / Part Payments Deducted</div>
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', border: '1px solid #c7d2fe'}}>
          <thead>
            <tr style={{background: '#6366f1', color: 'white'}}>
              <th style={{padding: '10px 12px', textAlign: 'center', width: '60px'}}>S.No.</th>
              <th style={{padding: '10px 12px', textAlign: 'left'}}>Description</th>
              <th style={{padding: '10px 12px', textAlign: 'right', width: '140px'}}>Deduction (₹)</th>
            </tr>
          </thead>
          <tbody>
            {validDeductions.map((d, idx) => (
              <tr key={idx} style={{borderBottom: '1px solid #e0e7ff', background: idx % 2 === 0 ? '#fff' : '#f5f3ff'}}>
                <td style={{padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#6366f1'}}>{idx + 1}</td>
                <td style={{padding: '10px 12px'}}>{d.description || '-'}</td>
                <td style={{padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', color: '#6366f1'}}>- {formatRupees(d.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{marginTop: '0.75rem', padding: '0.75rem 1rem', background: '#eef2ff', borderRadius: '8px', border: '2px solid #6366f1'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#6366f1', marginBottom: '0.3rem'}}>
            <span>Total Deductions:</span>
            <span style={{fontFamily: 'monospace', fontWeight: 600}}>- {formatRupees(deductionTotal)}</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', borderTop: '2px solid #6366f1', paddingTop: '0.4rem'}}>
            <span style={{color: '#3730a3'}}>NET PAYABLE:</span>
            <span style={{fontFamily: 'monospace', color: '#3730a3'}}>{formatCurrency(voucher.amount)}</span>
          </div>
          <div style={{marginTop: '0.4rem', fontSize: '0.8rem', color: '#6366f1', fontStyle: 'italic'}}>
            <strong>In Words:</strong> {numberToWordsIndian(voucher.amount)}
          </div>
        </div>
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
        {voucher.suspense_serial && <div className="voucher-meta-item" style={{background:'#fffbeb',borderRadius:'4px',padding:'2px 6px'}}><span className="voucher-meta-label">Suspense Ref:</span><span className="voucher-meta-value" style={{fontWeight:700,color:'#92400e'}}>{voucher.suspense_serial}</span></div>}
      </div>
      <div className="voucher-meta-item mb-1"><span className="voucher-meta-label">Head:</span><span className="voucher-meta-value">{voucher.head_of_account}{voucher.sub_head_of_account && ` → ${voucher.sub_head_of_account}`}</span></div>
      {voucher.narration && <div className="voucher-meta-item mb-1"><span className="voucher-meta-label">Narration:</span><span className="voucher-meta-value">{voucher.narration}</span></div>}
      <NarrationTable />
      <DeductionsDisplay />
      {/* Only show TOTAL section if there are no narration items AND no deductions */}
      {(!narrationItems || narrationItems.filter(item => item.description || item.amount).length === 0) && validDeductions.length === 0 && (
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
        onLogin(result.user, result.settlementToken || null);
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
        onLogin(result.user, result.settlementToken || null);
      } else if (result.requiresOtp) {
        // First-time login: server already sent OTP — go back to login form with OTP input
        setRequiresCompanySelection(false);
        setRequiresOtp(true);
        // selectedCompanyId is already set; next login() call will include it
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
                    Role: {company.role === 'admin' ? '🛡️ Admin / Approver' : company.role === 'auditor' ? '🔍 Auditor' : '👤 Accounts'}
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
              {vouchers.slice(0, 5).map(v => (<tr key={v.id}><td className="text-mono fw-600">{v.serial_number}{v.attachment_count > 0 && <span title={`${v.attachment_count} attachment${v.attachment_count > 1 ? 's' : ''}`} style={{marginLeft: '6px', color: '#f5841f', verticalAlign: 'middle', display: 'inline-flex'}}>{Icons.paperclip}</span>}</td><td>{v.payee_name}</td><td className="fw-600">{formatRupees(v.amount, 0)}</td><td><span className={`status-badge status-${v.status}`}>{v.status.replace(/_/g, ' ')}</span></td><td>{new Date(v.created_at).toLocaleDateString('en-IN')}</td></tr>))}
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

// Deductions Table Component (Advance / Part Payment Deductions)
const DeductionsTable = ({ items, onChange, disabled }) => {
  const [currentItem, setCurrentItem] = useState({ description: '', amount: '' });

  const addItem = () => {
    if (!currentItem.description.trim() || !currentItem.amount || parseFloat(currentItem.amount) <= 0) return;
    onChange([...items, { description: currentItem.description.trim(), amount: parseFloat(currentItem.amount).toFixed(2) }]);
    setCurrentItem({ description: '', amount: '' });
    setTimeout(() => document.getElementById('deduction-desc-input')?.focus(), 100);
  };

  const removeItem = (index) => onChange(items.filter((_, i) => i !== index));
  const getTotal = () => items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  const handleKeyPress = (e, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'description' && currentItem.description.trim()) document.getElementById('deduction-amt-input')?.focus();
      else if (field === 'amount' && currentItem.amount) addItem();
    }
  };

  return (
    <div style={{border: '2px solid #6366f1', borderRadius: '8px', padding: '1rem', background: '#eef2ff'}}>
      <h4 style={{fontSize: '0.95rem', fontWeight: 600, color: '#3730a3', marginBottom: '0.75rem'}}>💰 Advance / Part Payments to Deduct</h4>
      {!disabled && (
        <div style={{background: 'white', padding: '1rem', borderRadius: '6px', border: '1px solid #c7d2fe', marginBottom: '1rem'}}>
          <div className="form-group" style={{marginBottom: '0.75rem'}}>
            <label className="form-label" style={{fontSize: '0.85rem', color: '#3730a3'}}>
              1️⃣ Description * <span style={{fontSize: '0.75rem', fontWeight: 'normal'}}>(e.g., Advance paid on 15-Apr-26 · Ref: VCH-2025-00042)</span>
            </label>
            <input id="deduction-desc-input" type="text" className="form-input" placeholder="Describe the advance / part payment..."
              value={currentItem.description} onChange={(e) => setCurrentItem({...currentItem, description: e.target.value})}
              onKeyPress={(e) => handleKeyPress(e, 'description')} disabled={disabled} style={{borderColor: '#6366f1'}} />
          </div>
          {currentItem.description.trim() && (
            <div className="form-group" style={{marginBottom: '0.75rem'}}>
              <label className="form-label" style={{fontSize: '0.85rem', color: '#3730a3'}}>
                2️⃣ Amount to Deduct (₹) * <span style={{fontSize: '0.75rem', fontWeight: 'normal'}}>(Press Enter to add)</span>
              </label>
              <input id="deduction-amt-input" type="number" className="form-input" placeholder="0.00"
                value={currentItem.amount} onChange={(e) => setCurrentItem({...currentItem, amount: e.target.value})}
                onKeyPress={(e) => handleKeyPress(e, 'amount')} disabled={disabled} step="0.01" min="0"
                style={{borderColor: '#6366f1'}} />
            </div>
          )}
          {currentItem.description.trim() && currentItem.amount && (
            <button type="button" onClick={addItem}
              style={{width: '100%', background: '#6366f1', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem'}}>
              ➕ Add Deduction
            </button>
          )}
        </div>
      )}
      {items.length > 0 && (
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', background: 'white', borderRadius: '6px', overflow: 'hidden'}}>
          <thead>
            <tr style={{background: '#6366f1', color: 'white'}}>
              <th style={{padding: '10px 12px', textAlign: 'center', width: '60px'}}>S.No.</th>
              <th style={{padding: '10px 12px', textAlign: 'left'}}>Description</th>
              <th style={{padding: '10px 12px', textAlign: 'right', width: '150px'}}>Deduction (₹)</th>
              {!disabled && <th style={{padding: '10px 12px', textAlign: 'center', width: '60px'}}></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} style={{borderBottom: '1px solid #e0e7ff', background: index % 2 === 0 ? 'white' : '#f5f3ff'}}>
                <td style={{padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#6366f1'}}>{index + 1}</td>
                <td style={{padding: '10px 12px'}}>{item.description}</td>
                <td style={{padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', color: '#6366f1'}}>- {formatRupees(item.amount)}</td>
                {!disabled && (
                  <td style={{padding: '10px 12px', textAlign: 'center'}}>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(index)} title="Remove" style={{padding: '4px 10px', fontSize: '0.85rem'}}>×</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{background: '#e0e7ff', fontWeight: 700}}>
              <td colSpan={!disabled ? "3" : "2"} style={{padding: '12px', textAlign: 'right', color: '#3730a3'}}>TOTAL DEDUCTIONS:</td>
              <td style={{padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: '#6366f1'}}>- {formatRupees(getTotal())}</td>
              {!disabled && <td></td>}
            </tr>
          </tfoot>
        </table>
      )}
      {items.length === 0 && disabled && (
        <div style={{textAlign: 'center', padding: '1.5rem', color: '#6366f1', fontSize: '0.9rem'}}>No deductions recorded</div>
      )}
    </div>
  );
};

// Create Voucher
const CreateVoucher = () => {
  const { user, addToast, refreshVouchers } = useApp();
  const [loading, setLoading] = useState(false);
  const [createdVoucher, setCreatedVoucher] = useState(null);
  const [payees, setPayees] = useState([]);
  const [heads, setHeads] = useState([]);
  const [headsData, setHeadsData] = useState([]); // Full data with IDs
  const [subHeads, setSubHeads] = useState([]); // Sub-heads for selected head
  const [allSubHeads, setAllSubHeads] = useState([]); // All sub-heads by company
  const [showPayeeModal, setShowPayeeModal] = useState(false);
  const [showCustomAccount, setShowCustomAccount] = useState(false);
  const [showAddSubCategory, setShowAddSubCategory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeductions, setShowDeductions] = useState(() => {
    try { const s = localStorage.getItem('cv_draft'); return s ? (JSON.parse(s).showDeductions || false) : false; } catch { return false; }
  });
  const [newSubCategory, setNewSubCategory] = useState('');
  const [customAccount, setCustomAccount] = useState('');
  const [form, setForm] = useState(() => {
    try {
      const s = localStorage.getItem('cv_draft');
      if (s) {
        const saved = JSON.parse(s);
        return saved.form || { headOfAccount: '', subHeadOfAccount: '', narration: '', narrationItems: [], deductions: [], payeeId: '', paymentMode: 'UPI', amount: '', invoiceReference: '' };
      }
    } catch {}
    return { headOfAccount: '', subHeadOfAccount: '', narration: '', narrationItems: [], deductions: [], payeeId: '', paymentMode: 'UPI', amount: '', invoiceReference: '' };
  });
  const [newPayee, setNewPayee] = useState({ name: '', alias: '', mobile: '', bankAccount: '', ifsc: '', upiId: '' });
  const [useNarrationTable, setUseNarrationTable] = useState(() => {
    try { const s = localStorage.getItem('cv_draft'); return s ? (JSON.parse(s).useNarrationTable ?? true) : true; } catch { return true; }
  });  // Default to TRUE for tabulated format

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

  // Calculate total deductions
  const calculateDeductionTotal = () => {
    return form.deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  };

  // Net payable = gross amount - total deductions
  const calculateNetAmount = () => {
    const gross = parseFloat(form.amount) || 0;
    return Math.max(0, gross - calculateDeductionTotal());
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

  // Auto-save form draft to localStorage so it survives page refresh / connection loss
  useEffect(() => {
    const hasData = form.headOfAccount || form.payeeId || form.amount || form.narration ||
      form.narrationItems.some(i => i.description || i.amount) ||
      form.deductions.some(d => d.description || d.amount) ||
      form.invoiceReference;
    if (hasData) {
      try {
        localStorage.setItem('cv_draft', JSON.stringify({ form, showDeductions, useNarrationTable }));
      } catch {}
    }
  }, [form, showDeductions, useNarrationTable]);

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
    const netAmount = calculateNetAmount();
    if (netAmount <= 0 && !saveAsDraft) {
      addToast('Net payable amount must be greater than zero after deductions', 'error');
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
        deductions: form.deductions,
        amount: netAmount, 
        paymentMode: form.paymentMode, 
        payeeId: form.payeeId, 
        preparedBy: user.id,
        saveAsDraft: saveAsDraft,
        invoiceReference: form.invoiceReference || null
      }); 
      if (result.success) { 
        addToast(saveAsDraft ? `Draft ${result.serialNumber} saved` : `Voucher ${result.serialNumber} submitted`, 'success'); 
        localStorage.removeItem('cv_draft');
        setForm({ headOfAccount: '', subHeadOfAccount: '', narration: '', narrationItems: [], deductions: [], payeeId: '', paymentMode: 'UPI', amount: '', invoiceReference: '' }); 
        setShowDeductions(false);
        setUseNarrationTable(false);
        setCreatedVoucher({ id: result.voucherId, serialNumber: result.serialNumber, status: result.status || (saveAsDraft ? 'draft' : 'pending') });
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
      {createdVoucher && (
        <div className="card" style={{ marginBottom: '1rem', border: '2px solid #10b981' }}>
          <div className="card-header" style={{ background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="card-title" style={{ color: '#065f46' }}>✅ {createdVoucher.status === 'draft' ? `Draft ${createdVoucher.serialNumber} saved` : `Voucher ${createdVoucher.serialNumber} submitted for approval`}</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => setCreatedVoucher(null)}>✕ New Voucher</button>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '0.85rem', color: '#047857', marginBottom: '0.75rem' }}>You can attach the bill or invoice now, or come back to it later from the voucher list.</p>
            <BillAttachmentPanel voucherId={createdVoucher.id} voucherType="regular" companyId={user.company.id} />
          </div>
        </div>
      )}
      {!createdVoucher && <>
      {/* Draft restored banner */}
      {(form.headOfAccount || form.payeeId || form.amount || form.narration || form.narrationItems.some(i => i.description || i.amount)) && (() => {
        let hasSaved = false;
        try { hasSaved = !!localStorage.getItem('cv_draft'); } catch {}
        return hasSaved ? (
          <div style={{marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem'}}>
            <span style={{fontSize: '0.9rem', color: '#92400e'}}>⚡ <strong>Draft restored</strong> — your last unsaved voucher was recovered automatically.</span>
            <button style={{fontSize: '0.8rem', padding: '0.3rem 0.75rem', background: 'transparent', border: '1px solid #f59e0b', borderRadius: '6px', color: '#92400e', cursor: 'pointer'}} onClick={() => {
              localStorage.removeItem('cv_draft');
              setForm({ headOfAccount: '', subHeadOfAccount: '', narration: '', narrationItems: [], deductions: [], payeeId: '', paymentMode: 'UPI', amount: '', invoiceReference: '' });
              setShowDeductions(false);
              setUseNarrationTable(true);
            }}>✕ Discard Draft</button>
          </div>
        ) : null;
      })()}
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

          {/* Deductions Section */}
          <div className="form-group">
            <label className="form-label form-label-row">
              Deductions / Advance Payments
              <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', background: showDeductions ? '#6366f1' : '#888', color: 'white', padding: '0.35rem 0.75rem', borderRadius: '6px'}}>
                <input type="checkbox" checked={showDeductions} onChange={(e) => {
                  setShowDeductions(e.target.checked);
                  if (!e.target.checked) setForm({ ...form, deductions: [] });
                }} />
                {showDeductions ? '💰 Deductions Active' : '➖ Add Deductions'}
              </label>
            </label>
            {showDeductions && (
              <DeductionsTable
                items={form.deductions}
                onChange={(items) => setForm({ ...form, deductions: items })}
              />
            )}
          </div>
          
          <div className="form-group">
            <label className="form-label">
              {showDeductions && form.deductions.length > 0 ? 'Gross Amount (₹) *' : 'Amount (₹) *'}
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
            {/* Net amount breakdown when deductions are present */}
            {showDeductions && form.deductions.length > 0 && parseFloat(form.amount) > 0 && (
              <div style={{marginTop: '0.75rem', padding: '1rem', background: '#eef2ff', borderRadius: '8px', border: '2px solid #6366f1'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem'}}>
                  <span style={{color: '#374151'}}>Gross Amount:</span>
                  <span style={{fontFamily: 'monospace', fontWeight: 600}}>{formatRupees(parseFloat(form.amount))}</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem', color: '#6366f1'}}>
                  <span>Less: Deductions:</span>
                  <span style={{fontFamily: 'monospace', fontWeight: 600}}>- {formatRupees(calculateDeductionTotal())}</span>
                </div>
                <div style={{borderTop: '2px solid #6366f1', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700}}>
                  <span style={{color: '#3730a3'}}>Net Payable:</span>
                  <span style={{fontFamily: 'monospace', color: '#3730a3'}}>{formatRupees(calculateNetAmount())}</span>
                </div>
                <div style={{marginTop: '0.5rem', fontSize: '0.8rem', color: '#6366f1', fontStyle: 'italic'}}>
                  <strong>Net in Words:</strong> {numberToWordsIndian(calculateNetAmount())}
                </div>
              </div>
            )}
            {/* In words for gross (when no deductions) */}
            {(!showDeductions || form.deductions.length === 0) && form.amount > 0 && (
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
      </>}
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
  const deductions = formData.deductions || [];
  const validItems = narrationItems.filter(item => item.description || item.amount);
  const validDeductions = deductions.filter(d => d.description || d.amount);
  const grossTotal = validItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) || parseFloat(formData.amount) || 0;
  const deductionTotal = validDeductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const netTotal = Math.max(0, grossTotal - deductionTotal);
  
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
            {validDeductions.length === 0 && (
              <tfoot>
                <tr style={{background: '#fef3c7', fontWeight: 700}}>
                  <td colSpan="2" style={{padding: '10px', textAlign: 'right'}}>TOTAL:</td>
                  <td style={{padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#f59e0b'}}>{formatRupees(grossTotal)}</td>
                </tr>
                <tr style={{background: '#fffbeb'}}>
                  <td colSpan="3" style={{padding: '8px', fontSize: '0.85rem', fontStyle: 'italic', color: '#92400e'}}>
                    <strong>Amount in Words:</strong> {numberToWordsIndian(grossTotal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        validDeductions.length === 0 && (
          <>
            <div className="voucher-total">TOTAL: {formatRupees(grossTotal)}</div>
            <div style={{fontSize: '0.85rem', fontStyle: 'italic', color: '#666', marginTop: '0.5rem', marginBottom: '1rem', background: '#fffbeb', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fcd34d'}}>
              <strong style={{color: '#92400e'}}>In Words:</strong> {numberToWordsIndian(grossTotal)}
            </div>
          </>
        )
      )}

      {/* Deductions table */}
      {validDeductions.length > 0 && (
        <div style={{marginTop: '1rem', marginBottom: '1rem'}}>
          <div style={{fontWeight: 600, marginBottom: '0.5rem', color: '#3730a3'}}>Less: Advance / Part Payments Deducted</div>
          <table style={{width: '100%', borderCollapse: 'collapse', border: '2px solid #6366f1', borderRadius: '8px', overflow: 'hidden'}}>
            <thead>
              <tr style={{background: '#6366f1', color: 'white'}}>
                <th style={{padding: '10px', textAlign: 'center', width: '60px'}}>S.No.</th>
                <th style={{padding: '10px', textAlign: 'left'}}>Description</th>
                <th style={{padding: '10px', textAlign: 'right', width: '130px'}}>Deduction (₹)</th>
              </tr>
            </thead>
            <tbody>
              {validDeductions.map((d, idx) => (
                <tr key={idx} style={{borderBottom: '1px solid #e0e7ff', background: idx % 2 === 0 ? 'white' : '#f5f3ff'}}>
                  <td style={{padding: '8px', textAlign: 'center', fontWeight: 600}}>{idx + 1}</td>
                  <td style={{padding: '8px'}}>{d.description}</td>
                  <td style={{padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: '#6366f1'}}>- {formatRupees(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Net payable summary */}
          <div style={{marginTop: '0.75rem', padding: '0.75rem 1rem', background: '#eef2ff', borderRadius: '8px', border: '2px solid #6366f1'}}>
            {validItems.length > 0 && (
              <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#374151', marginBottom: '0.3rem'}}>
                <span>Gross Amount:</span>
                <span style={{fontFamily: 'monospace', fontWeight: 600}}>{formatRupees(grossTotal)}</span>
              </div>
            )}
            <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#6366f1', marginBottom: '0.4rem'}}>
              <span>Less: Deductions:</span>
              <span style={{fontFamily: 'monospace', fontWeight: 600}}>- {formatRupees(deductionTotal)}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem', borderTop: '2px solid #6366f1', paddingTop: '0.4rem'}}>
              <span style={{color: '#3730a3'}}>NET PAYABLE:</span>
              <span style={{fontFamily: 'monospace', color: '#3730a3'}}>{formatRupees(netTotal)}</span>
            </div>
            <div style={{marginTop: '0.4rem', fontSize: '0.8rem', color: '#6366f1', fontStyle: 'italic'}}>
              <strong>In Words:</strong> {numberToWordsIndian(netTotal)}
            </div>
          </div>
        </div>
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
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelDateFrom, setExcelDateFrom] = useState('');
  const [excelDateTo, setExcelDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Document verification state
  const [showAttestationModal, setShowAttestationModal] = useState(false);
  const [attestationNotes, setAttestationNotes] = useState('');
  
  // Edit Draft state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ headOfAccount: '', subHeadOfAccount: '', narration: '', narrationItems: [], deductions: [], payeeId: '', paymentMode: 'UPI', amount: '', invoiceReference: '' });
  const [payees, setPayees] = useState([]);
  const [heads, setHeads] = useState([]);
  const [headsData, setHeadsData] = useState([]);
  const [subHeads, setSubHeads] = useState([]);
  const [allSubHeads, setAllSubHeads] = useState([]);
  const [useNarrationTable, setUseNarrationTable] = useState(false);
  const [showEditDeductions, setShowEditDeductions] = useState(false);

  // Search state — Completed Vouchers tab
  const [searchNum, setSearchNum] = useState('');
  const [searchHead, setSearchHead] = useState('');
  const [searchPayee, setSearchPayee] = useState('');
  const [searchDateMode, setSearchDateMode] = useState('range'); // 'exact' | 'range'
  const [searchDate, setSearchDate] = useState('');
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const hasSearchFilters = searchNum || searchHead || searchPayee || searchDate || searchFrom || searchTo;

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

  const baseFiltered = vouchers.filter(v => { 
    if (filter === 'draft') return v.status === 'draft';
    if (filter === 'pending') return v.status === 'pending'; 
    if (filter === 'approved') return ['approved', 'awaiting_payee_otp'].includes(v.status); 
    if (filter === 'completed') return v.status === 'completed'; 
    return true; 
  });

  const filtered = filter !== 'completed' ? baseFiltered : baseFiltered.filter(v => {
    const lc = s => (s || '').toLowerCase();
    if (searchNum && !lc(v.serial_number).includes(lc(searchNum))) return false;
    if (searchHead && !lc(v.head_of_account).includes(lc(searchHead))) return false;
    if (searchPayee && !lc(v.payee_name).includes(lc(searchPayee))) return false;
    const vDate = new Date(v.created_at);
    if (searchDateMode === 'exact' && searchDate) {
      const d = new Date(searchDate + 'T00:00:00'); const next = new Date(d); next.setDate(next.getDate() + 1);
      if (vDate < d || vDate >= next) return false;
    } else if (searchDateMode === 'range') {
      if (searchFrom && vDate < new Date(searchFrom + 'T00:00:00')) return false;
      if (searchTo && vDate > new Date(searchTo + 'T23:59:59')) return false;
    }
    return true;
  });
  
  const openVoucher = async (v) => {
    const full = await api.getVoucher(v.id);
    if (full?.error) { addToast(full.error || 'Failed to load voucher', 'error'); return; }
    setSelectedVoucher(full);
    setShowModal(true);
  };

  const handleEditDraft = (voucher) => {
    const narrationItems = typeof voucher.narration_items === 'string' 
      ? JSON.parse(voucher.narration_items || '[]') 
      : (voucher.narration_items || []);
    const hasItems = narrationItems.length > 0 && narrationItems.some(item => item.description || item.amount);

    const storedDeductions = typeof voucher.deductions === 'string'
      ? JSON.parse(voucher.deductions || '[]')
      : (voucher.deductions || []);
    const validDeductions = storedDeductions.filter(d => d.description || d.amount);
    const deductionTotal = validDeductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    // Reconstruct gross amount: stored amount is NET, so gross = net + deductions
    const netAmount = parseFloat(voucher.amount) || 0;
    const grossAmount = netAmount + deductionTotal;
    
    setEditForm({
      headOfAccount: voucher.head_of_account || '',
      subHeadOfAccount: voucher.sub_head_of_account || '',
      narration: voucher.narration || '',
      narrationItems: narrationItems,
      deductions: validDeductions,
      payeeId: voucher.payee_id || '',
      paymentMode: voucher.payment_mode || 'UPI',
      amount: grossAmount.toFixed(2),
      invoiceReference: voucher.invoice_reference || ''
    });
    setUseNarrationTable(hasItems);
    setShowEditDeductions(validDeductions.length > 0);
    setShowModal(false);
    setShowEditModal(true);
  };

  const handleUpdateDraft = async (saveAsDraft = true) => {
    if (!editForm.headOfAccount || !editForm.payeeId || !editForm.amount) {
      addToast('Fill all required fields (Head of Account, Payee, Amount)', 'error');
      return;
    }
    const editDeductionTotal = editForm.deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    const editNetAmount = Math.max(0, (parseFloat(editForm.amount) || 0) - editDeductionTotal);
    if (editNetAmount <= 0 && !saveAsDraft) {
      addToast('Net payable amount must be greater than zero after deductions', 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await api.updateVoucher(selectedVoucher.id, {
        headOfAccount: editForm.headOfAccount,
        subHeadOfAccount: editForm.subHeadOfAccount || null,
        narration: editForm.narration,
        narrationItems: editForm.narrationItems,
        deductions: editForm.deductions,
        amount: editNetAmount,
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
      const deductions = typeof v.deductions === 'string' ? JSON.parse(v.deductions || '[]') : (v.deductions || []);
      const validDeductions = deductions.filter(d => d.description || d.amount);
      
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
            ${validDeductions.length === 0 ? `
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
            </tfoot>` : ''}
          </table>
        </div>
      `;
    };

    // Helper to render deductions table
    const renderDeductions = (v) => {
      const deductions = typeof v.deductions === 'string' ? JSON.parse(v.deductions || '[]') : (v.deductions || []);
      const validDeductions = deductions.filter(d => d.description || d.amount);
      if (validDeductions.length === 0) return '';
      const deductionTotal = validDeductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
      return `
        <div class="particulars-section" style="margin-top:10px">
          <div class="particulars-title" style="color:#3730a3">Less: Advance / Part Payments Deducted</div>
          <table class="particulars-table" style="border:1px solid #c7d2fe">
            <thead>
              <tr style="background:#6366f1;color:white">
                <th style="text-align:center;width:10%">S.No.</th>
                <th style="text-align:left;width:60%">Description</th>
                <th style="text-align:right;width:30%">Deduction (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${validDeductions.map((d, idx) => `
                <tr style="background:${idx % 2 === 0 ? '#fff' : '#f5f3ff'}">
                  <td style="text-align:center;font-weight:600;color:#6366f1">${idx + 1}</td>
                  <td style="text-align:left">${d.description || '-'}</td>
                  <td style="text-align:right;font-weight:600;font-family:monospace;color:#6366f1">- ${formatCurrency(d.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top:8px;padding:8px 12px;background:#eef2ff;border:2px solid #6366f1;border-radius:4px">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#6366f1;margin-bottom:4px">
              <span>Total Deductions:</span>
              <span style="font-family:monospace;font-weight:600">- ${formatCurrency(deductionTotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-weight:700;font-size:13px;border-top:1px solid #6366f1;padding-top:4px">
              <span style="color:#3730a3">NET PAYABLE:</span>
              <span style="font-family:monospace;color:#3730a3">${formatCurrency(v.amount)}</span>
            </div>
            <div style="font-size:10px;font-style:italic;color:#6366f1;margin-top:4px">
              <strong>In Words:</strong> ${numToWords(v.amount)}
            </div>
          </div>
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
        ${v.suspense_serial ? `
        <div class="meta-row" style="background:#fffbeb;border-radius:4px;padding:2px 4px">
          <div class="meta-label" style="color:#92400e">Suspense Ref:</div>
          <div class="meta-value" style="font-weight:700;color:#92400e">${v.suspense_serial}</div>
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
      ${renderDeductions(v)}
      
      ${(() => { const deds = typeof v.deductions === 'string' ? JSON.parse(v.deductions || '[]') : (v.deductions || []); const hasDeds = deds.filter(d => d.description || d.amount).length > 0; const items = typeof v.narration_items === 'string' ? JSON.parse(v.narration_items || '[]') : (v.narration_items || []); const hasItems = items.filter(i => i.description || i.amount).length > 0; return (!hasItems && !hasDeds) ? `<div class="voucher-amount">AMOUNT: ${formatCurrency(v.amount)}</div><div style="font-size:11px;font-style:italic;color:#666;margin-bottom:15px;background:#fffbeb;padding:8px;border-radius:4px;border:1px solid #fcd34d"><strong style="color:#92400e">In Words:</strong> ${numToWords(v.amount)}</div>` : ''; })()}
      
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

  const handleDownloadExcel = () => {
    if (!excelDateFrom || !excelDateTo) { addToast('Select date range', 'error'); return; }
    const from = new Date(excelDateFrom);
    const to = new Date(excelDateTo);
    to.setHours(23, 59, 59);
    const dateFiltered = filtered.filter(v => {
      const vDate = new Date(v.created_at);
      return vDate >= from && vDate <= to;
    });
    if (dateFiltered.length === 0) { addToast('No vouchers in selected date range', 'error'); return; }
    const rows = dateFiltered.map((v, idx) => {
      const items = typeof v.narration_items === 'string'
        ? JSON.parse(v.narration_items || '[]')
        : (v.narration_items || []);
      const narrationText = items.length > 0
        ? items.filter(i => i.description).map(i => i.description).join(', ')
        : (v.narration || '');
      return {
        'S.No.': idx + 1,
        'Voucher No.': v.serial_number || '',
        'Date': new Date(v.created_at).toLocaleDateString('en-IN'),
        'Head of Account': v.head_of_account || '',
        'Sub Head': v.sub_head_of_account || '',
        'Payee': v.payee_name || '',
        'Narration': narrationText,
        'Invoice Ref': v.invoice_reference || '',
        'Suspense Ref': v.suspense_serial || '',
        'Payment Mode': v.payment_mode || '',
        'Amount (₹)': v.amount || 0,
        'Status': (v.status || '').replace(/_/g, ' '),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0]).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key]).length)) + 2
    }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, titles[filter]);
    XLSX.writeFile(wb, `${titles[filter].replace(/\s+/g, '_')}_${excelDateFrom}_to_${excelDateTo}.xlsx`);
    setShowExcelModal(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{titles[filter]}</h1>
          <p className="page-subtitle">{filtered.length} voucher(s)</p>
        </div>
        {filtered.length > 0 && (
          <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
            {(filter === 'all' || filter === 'completed') && (
              <button className="btn btn-secondary" onClick={() => setShowExcelModal(true)}>
                {Icons.download} Excel
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setShowPrintModal(true)}>
              {Icons.printer} Print Report
            </button>
          </div>
        )}
      </div>

      {/* ── SEARCH PANEL (Completed Vouchers only) ── */}
      {filter === 'completed' && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>🔍 Search Vouchers</span>
              {hasSearchFilters && (
                <button className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto', fontSize: '0.78rem' }}
                  onClick={() => { setSearchNum(''); setSearchHead(''); setSearchPayee(''); setSearchDate(''); setSearchFrom(''); setSearchTo(''); }}>
                  ✕ Clear All Filters
                </button>
              )}
              {hasSearchFilters && (
                <span style={{ fontSize: '0.8rem', color: '#f5841f', fontWeight: 600 }}>
                  {filtered.length} of {baseFiltered.length} vouchers
                </span>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Voucher Number</label>
                <input type="text" className="form-input" placeholder="e.g. 431 or VCH-2025-26-00431"
                  value={searchNum} onChange={e => setSearchNum(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Head of Account</label>
                <input type="text" className="form-input" placeholder="Partial name..."
                  value={searchHead} onChange={e => setSearchHead(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Payee</label>
                <input type="text" className="form-input" placeholder="Partial name..."
                  value={searchPayee} onChange={e => setSearchPayee(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date Filter</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    className={`btn btn-sm ${searchDateMode === 'exact' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setSearchDateMode('exact'); setSearchFrom(''); setSearchTo(''); }}>
                    📅 Specific Date
                  </button>
                  <button
                    className={`btn btn-sm ${searchDateMode === 'range' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setSearchDateMode('range'); setSearchDate(''); }}>
                    📅 Date Range
                  </button>
                </div>
              </div>
              {searchDateMode === 'exact' ? (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={searchDate} onChange={e => setSearchDate(e.target.value)} />
                </div>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">From</label>
                    <input type="date" className="form-input" value={searchFrom} onChange={e => setSearchFrom(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">To</label>
                    <input type="date" className="form-input" value={searchTo} onChange={e => setSearchTo(e.target.value)} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card"><div className="card-body" style={{ padding: 0 }}>
        {filtered.length === 0 ? <div className="empty-state">{Icons.fileText}<p>No vouchers found</p></div> : (
          <div className="table-container"><table className="table"><thead><tr><th>Serial No.</th><th>Head of Account</th><th>Payee</th><th>Amount</th><th>Mode</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
            {filtered.map(v => (<tr key={v.id}><td className="text-mono fw-600">{v.serial_number}{v.attachment_count > 0 && <span title={`${v.attachment_count} attachment${v.attachment_count > 1 ? 's' : ''}`} style={{marginLeft: '6px', color: '#f5841f', verticalAlign: 'middle', display: 'inline-flex'}}>{Icons.paperclip}</span>}</td><td>{v.head_of_account}</td><td>{v.payee_name}</td><td className="fw-600">{formatRupees(v.amount, 0)}</td><td>{v.payment_mode}</td><td><span className={`status-badge status-${v.status}`}>{v.status.replace(/_/g, ' ')}</span></td><td>{new Date(v.created_at).toLocaleDateString('en-IN')}</td><td><button className="btn btn-sm btn-secondary" onClick={() => openVoucher(v)}>{Icons.eye} View</button></td></tr>))}
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
            {/* Bill Attachments — visible on all statuses */}
            <BillAttachmentPanel
              voucherId={selectedVoucher.id}
              voucherType="regular"
              companyId={user.company.id}
            />
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
      {showExcelModal && (
        <div className="modal-overlay" onClick={() => setShowExcelModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3 className="modal-title">{Icons.download} Download Excel Report</h3><button className="modal-close" onClick={() => setShowExcelModal(false)}>×</button></div>
          <div className="modal-body">
            <p style={{marginBottom: '1rem', color: '#666'}}>Select date range for Excel report</p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">From Date</label>
                <input type="date" className="form-input" value={excelDateFrom} onChange={(e) => setExcelDateFrom(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">To Date</label>
                <input type="date" className="form-input" value={excelDateTo} onChange={(e) => setExcelDateTo(e.target.value)} />
              </div>
            </div>
            <div style={{background: '#f8f9fa', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem'}}>
              <strong>ℹ️ Excel report will include:</strong>
              <ul style={{margin: '0.5rem 0 0', paddingLeft: '1.5rem'}}>
                <li>All {titles[filter].toLowerCase()} in selected date range</li>
                <li>Serial No, Head of Account, Payee, Amount, Mode, Status</li>
                <li>Narration, Invoice Reference, Sub Head details</li>
              </ul>
            </div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowExcelModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleDownloadExcel} disabled={!excelDateFrom || !excelDateTo}>{Icons.download} Download Excel</button></div>
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

            {/* Deductions Section */}
            <div className="form-group">
              <label className="form-label form-label-row">
                Deductions / Advance Payments
                <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', background: showEditDeductions ? '#6366f1' : '#888', color: 'white', padding: '0.35rem 0.75rem', borderRadius: '6px'}}>
                  <input type="checkbox" checked={showEditDeductions} onChange={(e) => {
                    setShowEditDeductions(e.target.checked);
                    if (!e.target.checked) setEditForm({ ...editForm, deductions: [] });
                  }} />
                  {showEditDeductions ? '💰 Deductions Active' : '➖ Add Deductions'}
                </label>
              </label>
              {showEditDeductions && (
                <DeductionsTable items={editForm.deductions} onChange={(items) => setEditForm({ ...editForm, deductions: items })} />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                {showEditDeductions && editForm.deductions.length > 0 ? 'Gross Amount (₹) *' : 'Amount (₹) *'}
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
              {/* Net amount breakdown when deductions are active */}
              {showEditDeductions && editForm.deductions.length > 0 && parseFloat(editForm.amount) > 0 && (() => {
                const editDedTotal = editForm.deductions.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
                const editNet = Math.max(0, (parseFloat(editForm.amount) || 0) - editDedTotal);
                return (
                  <div style={{marginTop: '0.75rem', padding: '1rem', background: '#eef2ff', borderRadius: '8px', border: '2px solid #6366f1'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem'}}>
                      <span style={{color: '#374151'}}>Gross Amount:</span>
                      <span style={{fontFamily: 'monospace', fontWeight: 600}}>{formatRupees(parseFloat(editForm.amount))}</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem', color: '#6366f1'}}>
                      <span>Less: Deductions:</span>
                      <span style={{fontFamily: 'monospace', fontWeight: 600}}>- {formatRupees(editDedTotal)}</span>
                    </div>
                    <div style={{borderTop: '2px solid #6366f1', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700}}>
                      <span style={{color: '#3730a3'}}>Net Payable:</span>
                      <span style={{fontFamily: 'monospace', color: '#3730a3'}}>{formatRupees(editNet)}</span>
                    </div>
                    <div style={{marginTop: '0.5rem', fontSize: '0.8rem', color: '#6366f1', fontStyle: 'italic'}}>
                      <strong>Net in Words:</strong> {numberToWordsIndian(editNet)}
                    </div>
                  </div>
                );
              })()}
              {(!showEditDeductions || editForm.deductions.length === 0) && editForm.amount > 0 && (
                <div style={{marginTop: '0.5rem', fontSize: '0.85rem', color: '#666', fontStyle: 'italic', background: '#fffbeb', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fcd34d'}}>
                  <strong style={{color: '#92400e'}}>In Words:</strong> {numberToWordsIndian(parseFloat(editForm.amount))}
                </div>
              )}
            </div>
            <BillAttachmentPanel
              voucherId={selectedVoucher.id}
              voucherType="regular"
              companyId={user.company.id}
            />
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
      // Pre-select ALL companies with default role
      setNewUser(prev => ({
        ...prev,
        companyAccess: companies.map((company, index) => ({
          companyId: company.id,
          companyName: company.name,
          role: prev.role || 'accounts',
          isPrimary: company.id === user.company.id || index === 0
        }))
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

  // Sync role across ALL company access entries when global role changes
  const handleNewUserRoleChange = (newRole) => {
    setNewUser(prev => ({
      ...prev,
      role: newRole,
      companyAccess: prev.companyAccess.map(ca => ({ ...ca, role: newRole }))
    }));
  };

  const handleEditUserRoleChange = (newRole) => {
    setEditUser(prev => ({
      ...prev,
      role: newRole,
      companyAccess: prev.companyAccess.map(ca => ({ ...ca, role: newRole }))
    }));
  };
  
  const handleOnboardSubmit = async () => {
    if (!newUser.name?.trim() || !newUser.mobile?.trim() || (newUser.role !== 'auditor' && newUser.role !== 'staff' && !newUser.aadhar?.trim())) {
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
      companyAccess: allCompanies.map((company, index) => ({
        companyId: company.id,
        companyName: company.name,
        role: 'accounts',
        isPrimary: company.id === user.company.id || index === 0
      }))
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
        // Use unified role (prev.role = userToEdit.role) for all companies
        companyAccess: companyAccess.map(ca => ({
          companyId: ca.companyId,
          role: prev.role,
          isPrimary: ca.isPrimary
        }))
      }));
    } catch (err) {
      console.error('Failed to load company access:', err);
      // Fallback: access all companies with the user's role
      setEditUser(prev => ({ 
        ...prev, 
        companyAccess: allCompanies.map((company, index) => ({
          companyId: company.id,
          role: userToEdit.role,
          isPrimary: company.id === user.company.id || index === 0
        }))
      }));
    }
    setLoadingCompanyAccess(false);
  };
  
  const handleUpdateUser = async () => {
    if (!editUser.name?.trim() || !editUser.mobile?.trim() || (editUser.role !== 'auditor' && editUser.role !== 'staff' && !editUser.aadhar?.trim())) {
      addToast('All fields are required', 'error');
      return;
    }
    
    if (!editUser.companyAccess || editUser.companyAccess.length === 0) {
      addToast('At least one company access is required', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      // Update user basic info (use unified role from editUser.role)
      const result = await api.updateUser(selectedUser.id, {
        name: editUser.name,
        mobile: editUser.mobile,
        aadhar: editUser.aadhar,
        role: editUser.role,
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
          <div className="stat-icon teal" style={{fontSize:'1rem'}}>🔍</div>
          <div className="stat-value">{users.filter(u => u.role === 'auditor').length}</div>
          <div className="stat-label">Auditors</div>
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
                      <span className={`status-badge ${u.role === 'admin' ? 'status-approved' : u.role === 'auditor' ? 'status-completed' : 'status-pending'}`}>
                        {u.role === 'admin' ? '🛡 Admin' : u.role === 'auditor' ? '🔍 Auditor' : u.role === 'staff' ? '👤 Staff' : '👤 Accounts'}
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
                  
                  {newUser.role !== 'auditor' && (
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
                  )}

                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select
                      className="form-input"
                      value={newUser.role}
                      onChange={(e) => handleNewUserRoleChange(e.target.value)}
                    >
                      <option value="accounts">👤 Accounts</option>
                      <option value="admin">🛡️ Approver</option>
                      <option value="auditor">🔍 Auditor</option>
                    </select>
                    <small style={{color: '#666', fontSize: '0.85rem', marginTop: '4px', display: 'block'}}>
                      Username will be: <code style={{background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px'}}>{newUser.role === 'admin' ? 'Approve' : newUser.role === 'auditor' ? 'Audit' : 'Accounts'}-{newUser.name.split(' ')[0] || 'FirstName'}</code>
                    </small>
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
                          </div>
                        );
                      })}
                      {allCompanies.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#666', padding: '10px' }}>Loading companies...</div>
                      )}
                    </div>
                    <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '6px', display: 'block' }}>
                      Select the companies this user can access
                    </small>
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
                    disabled={submitting || !newUser.name || !newUser.mobile || (newUser.role !== 'auditor' && newUser.role !== 'staff' && !newUser.aadhar) || newUser.companyAccess.length === 0}
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
              
              {editUser.role !== 'auditor' && (
              <div className="form-group">
                <label className="form-label">Aadhar Number *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editUser.aadhar} 
                  onChange={(e) => setEditUser({ ...editUser, aadhar: e.target.value })} 
                />
              </div>
              )}

              <div className="form-group">
                <label className="form-label">Role *</label>
                <select
                  className="form-input"
                  value={editUser.role}
                  onChange={(e) => handleEditUserRoleChange(e.target.value)}
                >
                  <option value="accounts">👤 Accounts</option>
                  <option value="admin">🛡️ Approver</option>
                  <option value="auditor">🔍 Auditor</option>
                </select>
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
                                  // Add company access with current unified role
                                  setEditUser(prev => ({
                                    ...prev,
                                    companyAccess: [...(prev.companyAccess || []), {
                                      companyId: company.id,
                                      role: editUser.role,
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
                                  if (newAccess.length > 0 && !newAccess.some(ca => ca.isPrimary)) {
                                    newAccess[0].isPrimary = true;
                                  }
                                  setEditUser(prev => ({ ...prev, companyAccess: newAccess }));
                                }
                              }}
                              style={{ width: '18px', height: '18px' }}
                            />
                            <div style={{ fontWeight: 500 }}>{company.name}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                  Select the companies this user can access
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
                  <span className={`status-badge ${selectedUser.role === 'admin' ? 'status-approved' : selectedUser.role === 'auditor' ? 'status-completed' : 'status-pending'}`}>
                    {selectedUser.role === 'admin' ? '🛡 Admin' : selectedUser.role === 'auditor' ? '🔍 Auditor' : selectedUser.role === 'staff' ? '👤 Staff' : '👤 Accounts'}
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
                    className="btn btn-secondary" 
                    style={{borderColor: '#f59e0b', color: '#b45309'}}
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
  const [companyUsers, setCompanyUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showStaffLoginModal, setShowStaffLoginModal] = useState(false);
  const [staffLoginPayee, setStaffLoginPayee] = useState(null);
  const [staffLoginAadhar, setStaffLoginAadhar] = useState('');
  const [newPayee, setNewPayee] = useState({ name: '', alias: '', mobile: '', bankAccount: '', ifsc: '', upiId: '', isGlobal: false, payeeType: 'registered', requiresOtp: true, isStaff: false, userId: '' });
  const [editPayee, setEditPayee] = useState({ id: '', name: '', alias: '', mobile: '', bankAccount: '', ifsc: '', upiId: '', is_global: false, payee_type: 'registered', requires_otp: true, is_staff: false, user_id: '' });
  const [importData, setImportData] = useState('');
  const [importMethod, setImportMethod] = useState('excel'); // 'paste' or 'excel'

  const refreshPayees = () => {
    api.getPayees(user.company.id).then(setPayees).finally(() => setLoading(false));
  };

  useEffect(() => { refreshPayees(); }, [user.company.id]);
  useEffect(() => { api.getCompanyUsers(user.company.id).then(data => { if (Array.isArray(data)) setCompanyUsers(data); }); }, [user.company.id]);

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

  const handleCreateStaffLogin = (payee) => {
    if (!user.isSuperAdmin) { addToast('Only Super Admin can create staff logins', 'error'); return; }
    setStaffLoginPayee(payee);
    setStaffLoginAadhar('');
    setShowStaffLoginModal(true);
  };

  const handleConfirmStaffLogin = async () => {
    if (!staffLoginAadhar.trim()) { addToast('Aadhar number is required', 'error'); return; }
    setSubmitting(true);
    try {
      const result = await api.createStaffLogin(staffLoginPayee.id, user.id, staffLoginAadhar.trim());
      addToast(`Login created! Username: ${result.username}`, 'success');
      setShowStaffLoginModal(false);
      setStaffLoginPayee(null);
      refreshPayees();
    } catch (error) {
      addToast('Failed to create login: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
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
                  <th>Mobile</th>
                  <th>Bank / UPI</th>
                  <th style={{textAlign: 'center', minWidth: '90px'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payees.length === 0 ? (
                  <tr><td colSpan="5" style={{textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)'}}>No payees added yet. Click "Add Payee" to get started.</td></tr>
                ) : (
                  payees.map(p => (
                    <tr key={p.id} style={p.is_global && p.company_id !== user.company.id ? {background: '#f0f9ff'} : {}}>
                      <td className="fw-600">
                        {p.name}
                        {p.is_global && <span style={{marginLeft: '0.5rem', fontSize: '0.7rem', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '4px'}}>🌐 Global</span>}
                        {p.is_global && p.company_id !== user.company.id && <span style={{marginLeft: '0.25rem', fontSize: '0.65rem', color: '#666'}}>(from other company)</span>}
                        {p.is_staff && <span style={{marginLeft: '0.5rem', fontSize: '0.7rem', background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '4px'}}>👤 Staff</span>}
                        {p.is_staff && p.user_id && <span style={{marginLeft: '0.25rem', fontSize: '0.65rem', background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px'}}>🔑 Staff-{p.name.split(' ')[0]}</span>}
                        {p.alias && <div style={{fontSize: '0.75rem', color: '#6b7280', fontWeight: 400, marginTop: '1px'}}>{p.alias}</div>}
                      </td>
                      <td>
                        {p.payee_type === 'adhoc' ? (
                          <span style={{fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px'}}>📄 Ad-hoc</span>
                        ) : (
                          <span style={{fontSize: '0.75rem', background: '#d1fae5', color: '#059669', padding: '2px 8px', borderRadius: '4px'}}>✅ Registered</span>
                        )}
                      </td>
                      <td>{p.mobile}</td>
                      <td style={{fontSize: '0.8rem', color: '#555'}}>
                        {p.bank_account ? <div>{p.bank_account}{p.ifsc ? ` · ${p.ifsc}` : ''}</div> : null}
                        {p.upi_id ? <div style={{color: '#7c3aed'}}>{p.upi_id}</div> : null}
                        {!p.bank_account && !p.upi_id ? '-' : null}
                      </td>
                      <td style={{textAlign: 'center'}}>
                        {p.company_id === user.company.id ? (
                          <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap'}}>
                            {p.is_staff && !p.user_id && user.isSuperAdmin && (
                              <button className="btn btn-sm" style={{background: '#2563eb', color: 'white', fontSize: '0.7rem'}} onClick={() => handleCreateStaffLogin(p)} title={`Create app login: Staff-${p.name.split(' ')[0]}`}>🔑 Login</button>
                            )}
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

      {showStaffLoginModal && staffLoginPayee && (
        <div className="modal-overlay" onClick={() => setShowStaffLoginModal(false)}>
          <div className="modal" style={{maxWidth: '420px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🔑 Create Staff Login</h3>
              <button className="modal-close" onClick={() => setShowStaffLoginModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{marginBottom: '1rem', color: '#374151'}}>Creating app login for <strong>{staffLoginPayee.name}</strong></p>
              <div style={{background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '0.75rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#0369a1'}}>
                Username will be: <strong>Staff-{staffLoginPayee.name.split(' ')[0]}</strong><br/>
                Staff can log in with this username + SMS OTP on first use.
              </div>
              <div className="form-group">
                <label className="form-label">Aadhar Number *</label>
                <input className="form-control" type="text" maxLength={12} placeholder="12-digit Aadhar number" value={staffLoginAadhar} onChange={e => setStaffLoginAadhar(e.target.value.replace(/\D/g, ''))} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowStaffLoginModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmStaffLogin} disabled={submitting || staffLoginAadhar.length < 12}>
                {submitting ? 'Creating...' : 'Create Login'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <div className="form-group" style={{background: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #86efac', marginTop: '0.75rem'}}>
                <label style={{display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer'}}>
                  <input type="checkbox" checked={newPayee.isStaff} onChange={e => setNewPayee({...newPayee, isStaff: e.target.checked, userId: ''})} style={{width: '18px', height: '18px'}} />
                  <span style={{fontWeight: 500}}>👤 Staff Payee (internal employee)</span>
                </label>
                {newPayee.isStaff && (
                  <div style={{marginTop: '0.75rem'}}>
                    <label className="form-label">Link to System User <span style={{fontSize: '0.78rem', color: '#6b7280', fontWeight: 400}}>(optional)</span></label>
                    <select className="form-select" value={newPayee.userId} onChange={e => setNewPayee({...newPayee, userId: e.target.value})}>
                      <option value="">— Not a system user —</option>
                      {companyUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                    </select>
                    <p style={{fontSize: '0.8rem', color: '#166534', marginTop: '0.5rem'}}>Leave blank if the staff member doesn't have a system account. They'll still receive the SMS settlement link via their mobile number.</p>
                  </div>
                )}
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
              <div className="form-group" style={{background: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #86efac', marginTop: '0.75rem'}}>
                <label style={{display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer'}}>
                  <input type="checkbox" checked={editPayee.is_staff || false} onChange={e => setEditPayee({...editPayee, is_staff: e.target.checked, user_id: e.target.checked ? editPayee.user_id : ''})} style={{width: '18px', height: '18px'}} />
                  <span style={{fontWeight: 500}}>👤 Staff Payee (internal employee)</span>
                </label>
                {editPayee.is_staff && (
                  <div style={{marginTop: '0.75rem'}}>
                    <label className="form-label">Linked System User <span style={{fontSize: '0.78rem', color: '#6b7280', fontWeight: 400}}>(optional)</span></label>
                    <select className="form-select" value={editPayee.user_id || ''} onChange={e => setEditPayee({...editPayee, user_id: e.target.value})}>
                      <option value="">— Not a system user —</option>
                      {companyUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                    </select>
                    <p style={{fontSize: '0.8rem', color: '#166534', marginTop: '0.5rem'}}>Leave blank if the staff member doesn't have a system account. They'll still receive the SMS settlement link via their mobile number.</p>
                  </div>
                )}
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

// ─────────────────────────────────────────────────────────────────────────────
// BILL ATTACHMENT PANEL
// ─────────────────────────────────────────────────────────────────────────────
const BillAttachmentPanel = ({ voucherId, voucherType = 'regular', suspenseId, settlementId, companyId: companyIdProp }) => {
  const { user, addToast } = useApp();
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  const companyId = companyIdProp || user.company.id;
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  // mode: null | 'camera' | 'qr'
  const [mode, setMode] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [captureSession, setCaptureSession] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [polling, setPolling] = useState(false);
  const [pollExpiry, setPollExpiry] = useState(null);
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const pollIntervalRef = React.useRef(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState(null);
  // Category required when uploading directly to a suspense voucher (not to an entry)
  const [attachmentCategory, setAttachmentCategory] = React.useState(null);
  const needsCategory = voucherType === 'suspense' && !settlementId;

  const loadAttachments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (voucherId)    params.voucherId    = voucherId;
      if (suspenseId)   params.suspenseId   = suspenseId;
      if (settlementId) params.settlementId = settlementId;
      const data = await api.getAttachments(params);
      setAttachments(data.attachments || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadAttachments(); }, [voucherId, suspenseId, settlementId]);

  // Attach camera stream to video element after render
  useEffect(() => {
    if (mode === 'camera' && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [mode, cameraStream]);

  const compressAndEncode = async (file) => {
    let processedFile = file;
    if (file.type.startsWith('image/') && typeof imageCompression !== 'undefined') {
      try {
        processedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true });
      } catch {}
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ data: reader.result, mimeType: processedFile.type, name: file.name });
      reader.onerror = reject;
      reader.readAsDataURL(processedFile);
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { addToast('File too large (max 10 MB)', 'error'); return; }
    setUploading(true);
    try {
      const { data, mimeType, name } = await compressAndEncode(file);
      const result = await api.uploadAttachment({ fileData: data, mimeType, fileName: name, voucherId, voucherType, suspenseId, settlementId, uploadedBy: user.id, companyId, attachmentCategory: needsCategory ? attachmentCategory : undefined });
      if (result.success) { addToast('Attachment uploaded', 'success'); loadAttachments(); if (needsCategory) setAttachmentCategory(null); }
      else addToast(result.error || 'Upload failed', 'error');
    } catch { addToast('Upload failed', 'error'); }
    setUploading(false);
    e.target.value = '';
  };

  const handleDelete = async (attId) => {
    const result = await api.deleteAttachment(attId, user.id);
    setConfirmDeleteId(null);
    if (result.success) { addToast('Attachment deleted', 'success'); loadAttachments(); }
    else addToast(result.error || 'Delete failed', 'error');
  };

  // ── CAMERA / WEBCAM / SCANNER ─────────────────────────────────────────────
  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setCameraStream(stream);
      setMode('camera');
    } catch {
      setCameraError('No camera or webcam detected. Please use "Upload File" to attach a scanned document.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setMode(null);
    setCameraError('');
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setMode(null);
    canvas.toBlob(async (blob) => {
      if (!blob) { addToast('Failed to capture photo', 'error'); return; }
      setUploading(true);
      try {
        const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const { data, mimeType, name } = await compressAndEncode(file);
        const result = await api.uploadAttachment({ fileData: data, mimeType, fileName: name, voucherId, voucherType, suspenseId, settlementId, uploadedBy: user.id, companyId, attachmentCategory: needsCategory ? attachmentCategory : undefined });
        if (result.success) { addToast('Photo captured and uploaded', 'success'); loadAttachments(); if (needsCategory) setAttachmentCategory(null); }
        else addToast(result.error || 'Upload failed', 'error');
      } catch { addToast('Upload failed', 'error'); }
      setUploading(false);
    }, 'image/jpeg', 0.88);
  };

  // ── SEND TO PHONE (QR relay) ──────────────────────────────────────────────
  const startQRCapture = async () => {
    try {
      const result = await api.createCaptureSession({ companyId, createdBy: user.id, voucherId, suspenseId, settlementId, contextType: voucherType, attachmentCategory: needsCategory ? attachmentCategory : undefined });
      if (!result.success) { addToast('Failed to create session', 'error'); return; }
      const session = result.session;
      setCaptureSession(session);
      const url = `${window.location.origin}/capture/${session.id}`;
      // Use QR Server API — no JS library needed
      setQrImageUrl(`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1a1a1a&margin=10`);
      setMode('qr');
      setPollExpiry(new Date(session.expires_at));
      setPolling(true);
    } catch { addToast('Failed to start phone capture', 'error'); }
  };

  useEffect(() => {
    if (!polling || !captureSession) return;
    let lastKnownCount = attachments.length;
    const stop = (msg, isError) => {
      clearInterval(pollIntervalRef.current);
      setPolling(false); setMode(null); setCaptureSession(null); setQrImageUrl(null);
      addToast(msg, isError ? 'error' : 'success');
    };
    const poll = async () => {
      try {
        const data = await api.getCaptureSession(captureSession.id);
        const s = data.session;
        if (s.status === 'used') { stop('Photo received from phone!', false); loadAttachments(); return; }
        if (s.status === 'expired') { stop('QR session expired', true); return; }
        // Fallback: directly check if a new attachment appeared
        // (handles cases where the session status update failed server-side)
        if (voucherId || suspenseId || settlementId) {
          try {
            const params = {};
            if (voucherId)    params.voucherId    = voucherId;
            if (suspenseId)   params.suspenseId   = suspenseId;
            if (settlementId) params.settlementId = settlementId;
            const attData = await api.getAttachments(params);
            const newList = attData.attachments || [];
            if (newList.length > lastKnownCount) {
              lastKnownCount = newList.length;
              stop('Photo received from phone!', false);
              setAttachments(newList);
            }
          } catch {}
        }
      } catch {}
    };
    pollIntervalRef.current = setInterval(poll, 4000);
    return () => clearInterval(pollIntervalRef.current);
  }, [polling, captureSession]);

  const cancelQR = () => {
    clearInterval(pollIntervalRef.current);
    setMode(null); setCaptureSession(null); setQrImageUrl(null); setPolling(false);
  };

  const phoneUrl = captureSession ? `${window.location.origin}/capture/${captureSession.id}` : '';
  const expiryMinutes = pollExpiry ? Math.max(0, Math.ceil((pollExpiry - Date.now()) / 60000)) : 0;

  return (
    <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        {Icons.paperclip}
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Bill Attachments</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#666' }}>{attachments.length} file{attachments.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Attachment list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>{Icons.loader} Loading...</div>
      ) : attachments.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {attachments.map(att => (
            <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '1.2rem' }}>{att.mime_type?.includes('pdf') ? '📄' : '🖼️'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file_name}</div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>by {att.uploader?.name || 'Unknown'} · {new Date(att.uploaded_at).toLocaleDateString('en-IN')}</div>
                {att.attachment_category === 'transfer_receipt' && (
                  <span style={{ display: 'inline-block', marginTop: '2px', background: '#dbeafe', color: '#1d4ed8', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>🏦 Transfer Receipt</span>
                )}
                {att.attachment_category === 'expense_bill' && (
                  <span style={{ display: 'inline-block', marginTop: '2px', background: '#d1fae5', color: '#065f46', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>🧾 Expense Bill</span>
                )}
              </div>
              {confirmDeleteId !== att.id && (
                <a href={att.public_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>{Icons.eye}</a>
              )}
              {user.role !== 'auditor' && (att.uploaded_by === user.id || user.role === 'admin' || user.isSuperAdmin) && (
                confirmDeleteId === att.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>Delete?</span>
                    <button className="btn btn-sm btn-danger" style={{ padding: '3px 8px', fontSize: '0.75rem' }} onClick={() => handleDelete(att.id)}>Yes</button>
                    <button className="btn btn-sm btn-secondary" style={{ padding: '3px 8px', fontSize: '0.75rem' }} onClick={() => setConfirmDeleteId(null)}>No</button>
                  </div>
                ) : (
                  <button className="btn btn-sm btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setConfirmDeleteId(att.id)}>{Icons.x}</button>
                )
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '1rem', color: '#999', fontSize: '0.85rem', marginBottom: '0.75rem' }}>No attachments yet</div>
      )}

      {/* ── CAMERA / WEBCAM MODE ── */}
      {mode === 'camera' && (
        <div style={{ background: 'white', borderRadius: '8px', border: '2px solid #3b82f6', padding: '1rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>📷 Position the bill in view, then click Capture</span>
            <button className="btn btn-sm btn-secondary" onClick={stopCamera}>{Icons.x} Cancel</button>
          </div>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: '6px', background: '#000', maxHeight: 300, objectFit: 'cover', display: 'block' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }} onClick={capturePhoto}>
            📷 Capture Photo
          </button>
        </div>
      )}

      {cameraError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#dc2626', marginBottom: '0.75rem' }}>
          ⚠️ {cameraError}
        </div>
      )}

      {/* ── SEND TO PHONE (QR relay) MODE ── */}
      {mode === 'qr' && (
        <div style={{ background: 'white', borderRadius: '8px', border: '2px dashed #f5841f', padding: '1rem', marginBottom: '0.75rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem', textAlign: 'center' }}>📱 How to connect your phone:</p>
          <ol style={{ fontSize: '0.82rem', color: '#555', paddingLeft: '1.25rem', marginBottom: '0.75rem', lineHeight: 1.8 }}>
            <li>Open your phone's camera app and scan the QR code below</li>
            <li>A link will open in your phone's browser</li>
            <li>Take a photo of the bill — it will appear here automatically</li>
          </ol>
          <div style={{ textAlign: 'center' }}>
            {qrImageUrl
              ? <img src={qrImageUrl} alt="QR Code" style={{ width: 200, height: 200, border: '1px solid #eee', borderRadius: 4 }} />
              : <div style={{ width: 200, height: 200, background: '#f3f4f6', margin: '0 auto', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.8rem' }}>{Icons.loader} Loading...</div>
            }
          </div>
          <p style={{ fontSize: '0.75rem', color: '#888', textAlign: 'center', margin: '0.5rem 0 0.25rem' }}>Or copy this link and open it on your phone:</p>
          <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '6px 10px', fontSize: '0.72rem', color: '#444', wordBreak: 'break-all', fontFamily: 'monospace', marginBottom: '0.5rem' }}>
            {phoneUrl}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#aaa', textAlign: 'center', marginBottom: '0.75rem' }}>
            {Icons.clock} Waiting for photo... (expires in {expiryMinutes}m)
          </p>
          <button className="btn btn-sm btn-secondary" style={{ display: 'block', margin: '0 auto' }} onClick={cancelQR}>{Icons.x} Cancel</button>
        </div>
      )}

      {/* ── CATEGORY SELECTOR — required for suspense-level uploads ── */}
      {!mode && user.role !== 'auditor' && needsCategory && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e', marginBottom: '0.5rem' }}>What are you uploading? *</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setAttachmentCategory('transfer_receipt')}
              style={{ flex: 1, padding: '6px 8px', fontSize: '0.78rem', fontWeight: 600, borderRadius: '6px', border: attachmentCategory === 'transfer_receipt' ? '2px solid #1d4ed8' : '1px solid #d1d5db', background: attachmentCategory === 'transfer_receipt' ? '#dbeafe' : 'white', color: attachmentCategory === 'transfer_receipt' ? '#1d4ed8' : '#374151', cursor: 'pointer' }}
            >🏦 Transfer Receipt</button>
            <button
              onClick={() => setAttachmentCategory('expense_bill')}
              style={{ flex: 1, padding: '6px 8px', fontSize: '0.78rem', fontWeight: 600, borderRadius: '6px', border: attachmentCategory === 'expense_bill' ? '2px solid #065f46' : '1px solid #d1d5db', background: attachmentCategory === 'expense_bill' ? '#d1fae5' : 'white', color: attachmentCategory === 'expense_bill' ? '#065f46' : '#374151', cursor: 'pointer' }}
            >🧾 Expense Bill</button>
          </div>
          {!attachmentCategory && <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.4rem 0 0' }}>Select the document type before uploading.</p>}
        </div>
      )}

      {/* ── ACTION BUTTONS (shown when no mode active) ── */}
      {!mode && user.role !== 'auditor' && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label className="btn btn-sm btn-secondary" style={{ cursor: needsCategory && !attachmentCategory ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: needsCategory && !attachmentCategory ? 0.45 : 1 }}>
            {uploading ? Icons.loader : Icons.upload} {uploading ? 'Uploading...' : 'Upload File'}
            <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading || (needsCategory && !attachmentCategory)} />
          </label>
          {isMobile && (
            <button className="btn btn-sm btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: needsCategory && !attachmentCategory ? 0.45 : 1 }} onClick={needsCategory && !attachmentCategory ? undefined : startCamera} disabled={needsCategory && !attachmentCategory}>
              {Icons.camera} Use Camera
            </button>
          )}
          <button className="btn btn-sm btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: needsCategory && !attachmentCategory ? 0.45 : 1 }} onClick={needsCategory && !attachmentCategory ? undefined : startQRCapture} disabled={needsCategory && !attachmentCategory}>
            {Icons.qrCode} Send to Phone
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUSPENSE VOUCHER FORM
// ─────────────────────────────────────────────────────────────────────────────
const SuspenseVoucherForm = ({ onCreated, onViewDetail }) => {
  const { user, addToast } = useApp();
  const [staffPayees, setStaffPayees] = useState([]);
  const [activeVouchers, setActiveVouchers] = useState({}); // payeeId → voucher
  const [activeBlock, setActiveBlock] = useState(null); // the active voucher for selected payee
  const [form, setForm] = useState({ staffPayeeId: '', purpose: '', advanceAmount: '', paymentMode: 'Cash', narration: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getPayees(user.company.id).then(data => {
      if (Array.isArray(data)) setStaffPayees(data.filter(p => p.is_staff && p.company_id === user.company.id));
    });
    // Load all active suspense vouchers to detect conflicts upfront
    api.getSuspenseVouchers(user.company.id, {}).then(data => {
      const vouchers = Array.isArray(data) ? data : (data?.vouchers || []);
      const map = {};
      for (const v of vouchers) {
        if (['pending_approval', 'open', 'partial'].includes(v.status) && v.staff_payee_id) {
          if (!map[v.staff_payee_id]) map[v.staff_payee_id] = v; // keep first (earliest)
        }
      }
      setActiveVouchers(map);
    });
  }, [user.company.id]);

  const handlePayeeChange = (payeeId) => {
    setForm(f => ({ ...f, staffPayeeId: payeeId }));
    setActiveBlock(payeeId && activeVouchers[payeeId] ? activeVouchers[payeeId] : null);
  };

  const handleSubmit = async () => {
    if (!form.staffPayeeId || !form.purpose || !form.advanceAmount) {
      addToast('Staff member, purpose and advance amount are required', 'error');
      return;
    }
    if (isNaN(parseFloat(form.advanceAmount)) || parseFloat(form.advanceAmount) <= 0) {
      addToast('Enter a valid advance amount', 'error');
      return;
    }
    if (activeBlock) {
      addToast('This staff member already has an active suspense voucher. Please close it first.', 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await api.createSuspenseVoucher({
        companyId: user.company.id,
        staffPayeeId: form.staffPayeeId,
        advanceAmount: parseFloat(form.advanceAmount),
        purpose: form.purpose,
        narration: form.narration || null,
        paymentMode: form.paymentMode || null,
        createdBy: user.id
      });
      if (result.success) {
        addToast(`Suspense voucher ${result.suspenseVoucher.serial_number} created`, 'success');
        onCreated && onCreated();
      } else if (result.activeVoucher) {
        setActiveBlock(result.activeVoucher);
        addToast(result.error, 'error');
      } else {
        addToast(result.error || 'Failed to create suspense voucher', 'error');
      }
    } catch { addToast('Failed to create suspense voucher', 'error'); }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{Icons.wallet} New Suspense Voucher</h1>
        <p className="page-subtitle">Request an advance cash disbursement for a staff member</p>
      </div>
      <div className="card">
        <div className="card-header"><h3 className="card-title">{Icons.wallet} Suspense Voucher Details</h3></div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Staff Member *</label>
            {staffPayees.length === 0 ? (
              <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '0.85rem', fontSize: '0.88rem', color: '#92400e' }}>
                ⚠️ No staff payees found. Please go to <strong>Manage Payees</strong>, add the staff member, and check <strong>Staff Payee</strong> on their record first.
              </div>
            ) : (
              <select className="form-select" value={form.staffPayeeId} onChange={e => handlePayeeChange(e.target.value)}>
                <option value="">Select staff member</option>
                {staffPayees.map(p => <option key={p.id} value={p.id}>{p.name}{p.mobile ? ` · ${p.mobile}` : ''}{activeVouchers[p.id] ? ' ⚠️ Active' : ''}</option>)}
              </select>
            )}
            {activeBlock && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.9rem', marginTop: '0.5rem', fontSize: '0.88rem', color: '#991b1b' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>🚫 Cannot create a new voucher</div>
                <div>This staff member already has an active suspense voucher:</div>
                <div style={{ margin: '0.4rem 0', padding: '0.5rem 0.75rem', background: 'white', borderRadius: '6px', border: '1px solid #fca5a5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span><strong>{activeBlock.serial_number || activeBlock.serialNumber}</strong> · <span style={{ textTransform: 'capitalize' }}>{activeBlock.status}</span> · Balance: {formatRupees(activeBlock.balance_amount ?? activeBlock.balanceAmount ?? activeBlock.advance_amount)}</span>
                  {onViewDetail && activeBlock.id && (
                    <button className="btn btn-sm btn-secondary" style={{ fontSize: '0.78rem', padding: '2px 10px' }} onClick={() => onViewDetail(activeBlock.id)}>View →</button>
                  )}
                </div>
                <div style={{ marginTop: '0.3rem', color: '#b91c1c' }}>Please close or fully settle this voucher before creating a new one. You can also use <strong>💰 Top Up</strong> to add more funds to the existing voucher.</div>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Purpose *</label>
            <input className="form-input" type="text" placeholder="e.g. Field trip expenses" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Advance Amount (₹) *</label>
              <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.advanceAmount} onChange={e => setForm(f => ({ ...f, advanceAmount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select className="form-select" value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))}>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Account Transfer">Account Transfer</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Narration (optional)</label>
            <textarea className="form-input" rows={3} placeholder="Additional notes..." value={form.narration} onChange={e => setForm(f => ({ ...f, narration: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => onCreated && onCreated()}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !!activeBlock}>{loading && Icons.loader}{Icons.send} Submit for Approval</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// PENDING TOP-UP APPROVALS PANEL (Admin / Super Admin only)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// PENDING NEW SUSPENSE VOUCHERS PANEL (Admin / Super Admin only)
// ─────────────────────────────────────────────────────────────────────────────
const PendingNewVouchersPanel = ({ onViewVoucher }) => {
  const { user, addToast } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingVoucher, setRejectingVoucher] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getSuspenseVouchers(user.company.id, { status: 'pending_approval' });
      setItems(data.suspenseVouchers || []);
    } catch { /* silently skip */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.company.id]);

  const handleApprove = async (sv) => {
    setActionId(sv.id);
    const result = await api.approveSuspenseVoucher(sv.id, user.id);
    if (result.success) {
      addToast(`${sv.serial_number} approved — OTP sent to ${result.payeeName || 'staff'} (${result.payeeMobile || ''}). Open the voucher to verify OTP and activate the settlement link.`, 'success');
      load();
    } else addToast(result.error || 'Approval failed', 'error');
    setActionId(null);
  };

  const openReject = (sv) => { setRejectingVoucher(sv); setRejectReason(''); setShowRejectModal(true); };

  const confirmReject = async () => {
    setActionId(rejectingVoucher.id);
    const result = await api.rejectSuspenseVoucher(rejectingVoucher.id, user.id, rejectReason);
    if (result.success) { addToast(`${rejectingVoucher.serial_number} rejected`, 'success'); setShowRejectModal(false); load(); }
    else addToast(result.error || 'Rejection failed', 'error');
    setActionId(null);
  };

  if (!loading && items.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: '1rem', border: '2px solid #f59e0b', borderRadius: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
        <span style={{ fontSize: '1.25rem' }}>💼</span>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#b45309', margin: 0 }}>
          New Suspense Vouchers — Awaiting Approval
        </h3>
        {items.length > 0 && (
          <span style={{ background: '#f59e0b', color: 'white', borderRadius: '12px', padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }}>{items.length}</span>
        )}
      </div>
      {loading ? (
        <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{Icons.loader} Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {items.map(sv => (
            <div key={sv.id} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1f2937' }}>
                  <button style={{ background: 'none', border: 'none', color: '#f5841f', cursor: 'pointer', padding: 0, fontWeight: 700, fontSize: '0.95rem', textDecoration: 'underline' }}
                    onClick={() => onViewVoucher && onViewVoucher(sv.id)}>{sv.serial_number}</button>
                  <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.5rem' }}>{sv.purpose}</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#4b5563', marginTop: '2px' }}>
                  <span style={{ background: '#10b981', color: 'white', fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', fontWeight: 600, marginRight: '4px' }}>👤 Staff</span>
                  {sv.staff_payee?.name || sv.staff?.name || 'Unknown'}
                  {sv.payment_mode && <span style={{ color: '#9ca3af' }}> · {sv.payment_mode}</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
                  Advance: <strong style={{ color: '#f5841f' }}>{formatRupees(sv.advance_amount)}</strong>
                  {sv.creator?.name && <span> · Requested by {sv.creator.name}</span>}
                  {' · '}{new Date(sv.created_at).toLocaleDateString('en-IN')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button className="btn btn-sm btn-success" disabled={actionId === sv.id} onClick={() => handleApprove(sv)} style={{ fontSize: '0.8rem' }}>
                  {actionId === sv.id ? Icons.loader : '✅'} Approve
                </button>
                <button className="btn btn-sm btn-danger" disabled={actionId === sv.id} onClick={() => openReject(sv)} style={{ fontSize: '0.8rem' }}>
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showRejectModal && rejectingVoucher && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#ef4444', color: 'white' }}>
              <h3 className="modal-title" style={{ color: 'white' }}>✕ Reject Suspense Voucher</h3>
              <button className="modal-close" style={{ color: 'white' }} onClick={() => setShowRejectModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                <strong>{rejectingVoucher.serial_number}</strong> · {rejectingVoucher.purpose} · {formatRupees(rejectingVoucher.advance_amount)}
                <div style={{ marginTop: '4px', color: '#6b7280', fontSize: '0.8rem' }}>Staff: {rejectingVoucher.staff_payee?.name || rejectingVoucher.staff?.name}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Rejection (optional)</label>
                <textarea className="form-input" rows={3} placeholder="Enter reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmReject} disabled={!!actionId}>{actionId ? Icons.loader : '✕'} Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PendingTopUpsPanel = ({ onViewVoucher }) => {
  const { user, addToast } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingEntry, setRejectingEntry] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getPendingTopUps(user.company.id);
      setItems(data.pendingTopUps || []);
    } catch { /* silently skip */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.company.id]);

  const handleApprove = async (entry) => {
    setActionId(entry.id);
    const result = await api.approveTopUp(entry.id, user.id);
    if (result.success) {
      addToast(`Top-up of ${formatRupees(entry.amount)} approved · New balance: ${formatRupees(result.newBalance)}`, 'success');
      load();
    } else addToast(result.error || 'Approval failed', 'error');
    setActionId(null);
  };

  const openReject = (entry) => { setRejectingEntry(entry); setRejectReason(''); setShowRejectModal(true); };

  const confirmReject = async () => {
    setActionId(rejectingEntry.id);
    const result = await api.rejectTopUp(rejectingEntry.id, user.id, rejectReason);
    if (result.success) {
      addToast('Top-up rejected', 'success');
      setShowRejectModal(false);
      load();
    } else addToast(result.error || 'Rejection failed', 'error');
    setActionId(null);
  };

  if (!loading && items.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: '1.25rem', border: '2px solid #7c3aed', borderRadius: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
        <span style={{ fontSize: '1.25rem' }}>🔐</span>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#7c3aed', margin: 0 }}>
          Pending Top-Up Approvals
        </h3>
        {items.length > 0 && (
          <span style={{ background: '#7c3aed', color: 'white', borderRadius: '12px', padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }}>{items.length}</span>
        )}
      </div>
      {loading ? (
        <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{Icons.loader} Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {items.map(entry => (
            <div key={entry.id} style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1f2937' }}>
                  {formatRupees(entry.amount)}
                  <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.5rem' }}>top-up</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#4b5563', marginTop: '2px' }}>{entry.description}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
                  <button
                    style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', padding: 0, fontWeight: 600, fontSize: '0.78rem', textDecoration: 'underline' }}
                    onClick={() => onViewVoucher && onViewVoucher(entry.suspense?.id)}
                  >
                    {entry.suspense?.serial_number}
                  </button>
                  {' · '}{entry.suspense?.staff_payee?.name || 'Staff'}
                  {entry.submitter?.name && <span> · Requested by {entry.submitter.name}</span>}
                  {' · '}{new Date(entry.created_at).toLocaleDateString('en-IN')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button className="btn btn-sm btn-success" disabled={actionId === entry.id} onClick={() => handleApprove(entry)} style={{ fontSize: '0.8rem' }}>
                  {actionId === entry.id ? Icons.loader : '✅'} Approve
                </button>
                <button className="btn btn-sm btn-danger" disabled={actionId === entry.id} onClick={() => openReject(entry)} style={{ fontSize: '0.8rem' }}>
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showRejectModal && rejectingEntry && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#ef4444', color: 'white' }}>
              <h3 className="modal-title" style={{ color: 'white' }}>✕ Reject Top-Up</h3>
              <button className="modal-close" style={{ color: 'white' }} onClick={() => setShowRejectModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                <strong>{formatRupees(rejectingEntry.amount)}</strong> top-up for <strong>{rejectingEntry.suspense?.serial_number}</strong> — {rejectingEntry.description}
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Rejection (optional)</label>
                <textarea className="form-input" rows={3} placeholder="Enter reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmReject} disabled={!!actionId}>{actionId ? Icons.loader : '✕'} Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// SUSPENSE VOUCHER LIST
// ─────────────────────────────────────────────────────────────────────────────
const SuspenseVoucherList = ({ onViewDetail }) => {
  const { user, addToast } = useApp();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const data = await api.getSuspenseVouchers(user.company.id, params);
      setVouchers(data.suspenseVouchers || []);
    } catch { addToast('Failed to load suspense vouchers', 'error'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.company.id, statusFilter]);

  const statusBadge = (status) => {
    const map = { pending_approval: ['Pending Approval', '#f59e0b', '#fffbeb'], open: ['Open', '#10b981', '#ecfdf5'], partial: ['Partial', '#3b82f6', '#eff6ff'], closed: ['Closed', '#6b7280', '#f3f4f6'], rejected: ['Rejected', '#ef4444', '#fef2f2'] };
    const [label, color, bg] = map[status] || [status, '#666', '#eee'];
    return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{label}</span>;
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">{Icons.wallet} Suspense Vouchers</h1>
          <p className="page-subtitle">Track advance disbursements and settlements</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-select" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.85rem' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="open">Open</option>
            <option value="partial">Partial</option>
            <option value="closed">Closed</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className="btn btn-sm btn-secondary" onClick={load}>{Icons.refresh}</button>
        </div>
      </div>

      {(user.role === 'admin' || user.isSuperAdmin) && (
        <>
          <PendingNewVouchersPanel onViewVoucher={(id) => onViewDetail && onViewDetail(id)} />
          <PendingTopUpsPanel onViewVoucher={(id) => onViewDetail && onViewDetail(id)} />
        </>
      )}

      {loading ? (
        <div className="loading-state">{Icons.loader} Loading...</div>
      ) : vouchers.length === 0 ? (
        <div className="empty-state">{Icons.wallet}<p>No suspense vouchers found</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {vouchers.map(sv => (
            <div key={sv.id} className="card" style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }} onClick={() => onViewDetail && onViewDetail(sv.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f5841f' }}>{sv.serial_number}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, marginTop: '2px' }}>{sv.purpose}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ background: '#10b981', color: 'white', fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>👤 Staff</span>
                      {sv.staff_payee?.name || sv.staff?.name || 'Unknown'}
                    </span>
                    {' · '} Created by: {sv.creator?.name || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '2px' }}>{new Date(sv.created_at).toLocaleDateString('en-IN')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {statusBadge(sv.status)}
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '0.5rem' }}>{formatRupees(sv.advance_amount)}</div>
                  {sv.status !== 'closed' && sv.balance_amount != null && (
                    <div style={{ fontSize: '0.8rem', color: '#3b82f6' }}>Balance: {formatRupees(sv.balance_amount)}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SETTLEMENT ENTRY FORM (modal)
// ─────────────────────────────────────────────────────────────────────────────
const SettlementEntryForm = ({ suspenseId, onDone, onClose }) => {
  const { user, addToast } = useApp();
  const [form, setForm] = useState({ entryType: 'expense', amount: '', description: '', headOfAccount: '', referenceNumber: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.amount || !form.description) { addToast('Amount and description are required', 'error'); return; }
    if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) { addToast('Enter a valid amount', 'error'); return; }
    setLoading(true);
    try {
      const result = await api.addSuspenseSettlement(suspenseId, {
        entryType: form.entryType,
        amount: parseFloat(form.amount),
        description: form.description,
        headOfAccount: form.headOfAccount || null,
        referenceNumber: form.referenceNumber || null,
        submittedBy: user.id
      });
      if (result.success) {
        addToast('Settlement entry added', 'success');
        onDone && onDone(result);
      } else {
        addToast(result.error || 'Failed to add settlement', 'error');
      }
    } catch { addToast('Failed to add settlement', 'error'); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#3b82f6', color: 'white' }}>
          <h3 className="modal-title" style={{ color: 'white' }}>Add Settlement Entry</h3>
          <button className="modal-close" style={{ color: 'white' }} onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Entry Type *</label>
            <select className="form-input" value={form.entryType} onChange={e => setForm(f => ({ ...f, entryType: e.target.value }))}>
              <option value="expense">Expense (deducted from balance)</option>
              <option value="refund">Refund (added back to balance)</option>
              <option value="topup">Top-up (additional advance)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹) *</label>
            <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Description *</label>
            <input className="form-input" type="text" placeholder="What was this for?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Head of Account</label>
            <input className="form-input" type="text" placeholder="e.g. Travel" value={form.headOfAccount} onChange={e => setForm(f => ({ ...f, headOfAccount: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Reference / Receipt No.</label>
            <input className="form-input" type="text" placeholder="Optional" value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading && Icons.loader}Add Entry</button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUSPENSE VOUCHER DETAIL
// ─────────────────────────────────────────────────────────────────────────────
const SuspenseVoucherDetail = ({ suspenseId, onBack }) => {
  const { user, addToast } = useApp();
  const [sv, setSv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSettlement, setShowSettlement] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvingEntry, setApprovingEntry] = useState(null);
  const [approveForm, setApproveForm] = useState({ headOfAccount: '', subHeadOfAccount: '', narration: '', invoiceReference: '', paymentMode: 'UPI', createVoucher: true });
  const [heads, setHeads] = useState([]);
  const [resendLoading, setResendLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareSmsStatus, setShareSmsStatus] = useState(null); // 'sent' | 'failed' | null
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpForm, setTopUpForm] = useState({ amount: '', description: '' });
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showRejectTopUpModal, setShowRejectTopUpModal] = useState(false);
  const [rejectingTopUpEntry, setRejectingTopUpEntry] = useState(null);
  const [rejectTopUpReason, setRejectTopUpReason] = useState('');
  const [selectedSettlements, setSelectedSettlements] = useState(new Set());
  const [showCombineModal, setShowCombineModal] = useState(false);
  const [combineForm, setCombineForm] = useState({ headOfAccount: '', subHeadOfAccount: '', narration: '', invoiceReference: '', paymentMode: 'UPI' });
  const [combineLoading, setCombineLoading] = useState(false);
  const [showAdvanceOtpModal, setShowAdvanceOtpModal] = useState(false);
  const [advanceOtp, setAdvanceOtp] = useState('');
  const [advanceOtpLoading, setAdvanceOtpLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getSuspenseVoucher(suspenseId);
      setSv(data.suspenseVoucher);
    } catch { addToast('Failed to load suspense voucher', 'error'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [suspenseId]);

  const handleApprove = async () => {
    setActionLoading(true);
    const result = await api.approveSuspenseVoucher(suspenseId, user.id);
    if (result.success && result.requiresOtp) {
      addToast(`${sv.serial_number} approved — OTP sent to ${result.payeeName} (${result.payeeMobile}). Please verify OTP to activate the settlement link.`, 'success');
      setAdvanceOtp('');
      setShowAdvanceOtpModal(true);
      load();
    } else if (result.success) {
      addToast('Suspense voucher approved', 'success');
      load();
    } else {
      addToast(result.error || 'Approval failed', 'error');
    }
    setActionLoading(false);
  };

  const handleVerifyAdvanceOtp = async () => {
    if (advanceOtp.length < 6) { addToast('Enter the complete 6-digit OTP', 'error'); return; }
    setAdvanceOtpLoading(true);
    const result = await api.verifyAdvanceOtp(suspenseId, advanceOtp, user.id);
    if (result.success) {
      addToast('OTP verified — settlement link sent to staff' + (result.smsSent ? '' : ' (SMS failed — share link manually)'), result.smsSent ? 'success' : 'warning');
      setShowAdvanceOtpModal(false);
      setAdvanceOtp('');
      if (!result.smsSent && result.settlementUrl) {
        setShareUrl(result.settlementUrl);
        setShareSmsStatus('failed');
        setShowShareModal(true);
      }
      load();
    } else {
      addToast(result.error || 'OTP verification failed', 'error');
    }
    setAdvanceOtpLoading(false);
  };

  const handleResendAdvanceOtp = async () => {
    const result = await api.resendAdvanceOtp(suspenseId, user.id);
    if (result.success) addToast(`OTP resent to ${result.payeeMobile}`, 'success');
    else addToast(result.error || 'Failed to resend OTP', 'error');
  };

  const handleReject = async () => {
    setActionLoading(true);
    const result = await api.rejectSuspenseVoucher(suspenseId, user.id, rejectReason);
    if (result.success) { addToast('Suspense voucher rejected', 'success'); setShowRejectModal(false); load(); }
    else addToast(result.error || 'Rejection failed', 'error');
    setActionLoading(false);
  };

  const handleResendLink = async () => {
    setResendLoading(true);
    const result = await api.resendSettlementLink(suspenseId, user.id);
    if (result.success) {
      setShareUrl(result.settlementUrl);
      setShareSmsStatus(result.smsSent === false ? 'failed' : 'sent');
      setShowShareModal(true);
    } else {
      addToast(result.error || 'Failed to resend link', 'error');
    }
    setResendLoading(false);
  };

  const handleTopUp = async () => {
    if (!topUpForm.amount || isNaN(parseFloat(topUpForm.amount)) || parseFloat(topUpForm.amount) <= 0) {
      addToast('Enter a valid top-up amount', 'error'); return;
    }
    if (!topUpForm.description.trim()) { addToast('Description is required', 'error'); return; }
    setTopUpLoading(true);
    const result = await api.topUpSuspenseVoucher(suspenseId, { amount: parseFloat(topUpForm.amount), description: topUpForm.description, addedBy: user.id });
    if (result.success) {
      addToast(`Top-up of ₹${parseFloat(topUpForm.amount).toFixed(2)} submitted — awaiting Admin approval`, 'success');
      setShowTopUp(false);
      setTopUpForm({ amount: '', description: '' });
      load();
    } else addToast(result.error || 'Top-up failed', 'error');
    setTopUpLoading(false);
  };

  const handleApproveTopUp = async (entry) => {
    setActionLoading(true);
    const result = await api.approveTopUp(entry.id, user.id);
    if (result.success) {
      addToast(`Top-up of ₹${parseFloat(entry.amount).toFixed(2)} approved · New balance: ₹${result.newBalance?.toFixed(2)}${result.reopened ? ' · Voucher reopened' : ''}`, 'success');
      load();
    } else addToast(result.error || 'Approval failed', 'error');
    setActionLoading(false);
  };

  const handleRejectTopUp = (entry) => {
    setRejectingTopUpEntry(entry);
    setRejectTopUpReason('');
    setShowRejectTopUpModal(true);
  };

  const confirmRejectTopUp = async () => {
    if (!rejectingTopUpEntry) return;
    setActionLoading(true);
    const result = await api.rejectTopUp(rejectingTopUpEntry.id, user.id, rejectTopUpReason);
    if (result.success) {
      addToast('Top-up rejected', 'success');
      setShowRejectTopUpModal(false);
      setRejectingTopUpEntry(null);
      load();
    } else addToast(result.error || 'Rejection failed', 'error');
    setActionLoading(false);
  };

  const handleCloseVoucher = async () => {
    setCloseLoading(true);
    const result = await api.closeSuspenseVoucher(suspenseId, user.id);
    if (result.success) {
      addToast('Suspense voucher closed by Accounts', 'success');
      setShowCloseModal(false);
      load();
    } else addToast(result.error || 'Failed to close voucher', 'error');
    setCloseLoading(false);
  };

  const toggleSelectSettlement = (id) => {
    setSelectedSettlements(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openCombineModal = () => {
    const selected = (sv.settlements || []).filter(s => selectedSettlements.has(s.id));
    const defaultNarration = selected.map(s => s.description).join(' | ');
    api.getHeadsOfAccount(user.company.id).then(data => { if (Array.isArray(data)) setHeads(data.sort((a, b) => a.name.localeCompare(b.name))); });
    setCombineForm({ headOfAccount: '', subHeadOfAccount: '', narration: defaultNarration, invoiceReference: '', paymentMode: sv?.payment_mode || 'UPI' });
    setShowCombineModal(true);
  };

  const handleCombineSettlements = async () => {
    if (!combineForm.headOfAccount) { addToast('Please select a Head of Account', 'error'); return; }
    setCombineLoading(true);
    const result = await api.combineSettlements(suspenseId, {
      approvedBy: user.id,
      settlementIds: Array.from(selectedSettlements),
      voucherData: { headOfAccount: combineForm.headOfAccount, subHeadOfAccount: combineForm.subHeadOfAccount || null, narration: combineForm.narration, invoiceReference: combineForm.invoiceReference || null, paymentMode: combineForm.paymentMode }
    });
    if (result.success) {
      addToast(`${result.combinedCount} entries combined → Voucher ${result.voucher.serial_number} created (${formatRupees(result.totalAmount)})`, 'success');
      setShowCombineModal(false);
      setSelectedSettlements(new Set());
      load();
    } else {
      addToast(result.error || 'Combine failed', 'error');
    }
    setCombineLoading(false);
  };

  const openApproveModal = (entry) => {
    setApprovingEntry(entry);
    setApproveForm({ headOfAccount: entry.head_of_account || '', subHeadOfAccount: '', narration: entry.description, invoiceReference: entry.reference_number || '', paymentMode: sv?.payment_mode || 'UPI', createVoucher: true });
    api.getHeadsOfAccount(user.company.id).then(data => { if (Array.isArray(data)) setHeads(data.sort((a, b) => a.name.localeCompare(b.name))); });
    setShowApproveModal(true);
  };

  const handleApproveSettlement = async () => {
    if (!approveForm.headOfAccount) { addToast('Please select a Head of Account', 'error'); return; }
    setActionLoading(true);
    const result = await api.approveSettlementEntry(approvingEntry.id, {
      approvedBy: user.id,
      createVoucher: approveForm.createVoucher,
      voucherData: { headOfAccount: approveForm.headOfAccount, subHeadOfAccount: approveForm.subHeadOfAccount || null, narration: approveForm.narration, invoiceReference: approveForm.invoiceReference || null, paymentMode: approveForm.paymentMode }
    });
    if (result.success) { addToast('Settlement entry approved' + (result.voucher ? ` · Voucher ${result.voucher.serial_number} created (completed)` : ''), 'success'); setShowApproveModal(false); load(); }
    else addToast(result.error || 'Approval failed', 'error');
    setActionLoading(false);
  };

  const statusBadge = (status) => {
    const map = { pending_approval: ['Pending Approval', '#f59e0b', '#fffbeb'], awaiting_payee_otp: ['Awaiting Advance OTP', '#ea580c', '#fff7ed'], open: ['Open', '#10b981', '#ecfdf5'], partial: ['Partial', '#3b82f6', '#eff6ff'], closed: ['Closed', '#6b7280', '#f3f4f6'], rejected: ['Rejected', '#ef4444', '#fef2f2'] };
    const [label, color, bg] = map[status] || [status, '#666', '#eee'];
    return <span style={{ background: bg, color, padding: '3px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>{label}</span>;
  };

  const entryTypeColor = (t) => t === 'expense' ? '#ef4444' : t === 'refund' ? '#10b981' : '#3b82f6';
  const entryTypeLabel = (t) => t === 'expense' ? '↓ Expense' : t === 'refund' ? '↑ Refund' : '↑ Top-up';
  const settlementStatusBadge = (status) => {
    if (status === 'approved') return <span style={{ background: '#d1fae5', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>✅ Approved</span>;
    if (status === 'rejected') return <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>❌ Rejected</span>;
    if (status === 'pending_approval') return <span style={{ background: '#ede9fe', color: '#7c3aed', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>🔐 Awaiting Admin</span>;
    return <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>⏳ Pending Review</span>;
  };

  if (loading) return <div className="loading-state">{Icons.loader} Loading...</div>;
  if (!sv) return <div className="empty-state"><p>Suspense voucher not found</p></div>;

  const isAdmin = user.role === 'admin' || user.isSuperAdmin;
  const canSettle = (sv.status === 'open' || sv.status === 'partial');

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-sm btn-secondary" onClick={onBack}>← Back</button>
          <div>
            <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>{Icons.wallet} {sv.serial_number} {statusBadge(sv.status)}</h1>
            <p className="page-subtitle">{sv.purpose}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isAdmin && sv.status === 'pending_approval' && (
            <>
              <button className="btn btn-sm btn-danger" onClick={() => setShowRejectModal(true)} disabled={actionLoading}>{Icons.x} Reject</button>
              <button className="btn btn-sm btn-success" onClick={handleApprove} disabled={actionLoading}>{actionLoading ? Icons.loader : Icons.check} Approve</button>
            </>
          )}
          {(user.role === 'accounts' || user.isSuperAdmin || isAdmin) && sv.status === 'awaiting_payee_otp' && (
            <button className="btn btn-sm btn-warning" style={{ background: '#ea580c', color: 'white', border: 'none' }} onClick={() => { setAdvanceOtp(''); setShowAdvanceOtpModal(true); }}>🔐 Verify Advance OTP</button>
          )}
          {(user.role === 'accounts' || user.isSuperAdmin || isAdmin) && (sv.status === 'open' || sv.status === 'partial') && (
            <button className="btn btn-sm btn-secondary" onClick={handleResendLink} disabled={resendLoading}>{resendLoading ? Icons.loader : '📲'} Resend Link</button>
          )}
          {(user.role === 'accounts' || user.isSuperAdmin) && (sv.status === 'open' || sv.status === 'partial' || sv.status === 'closed') && sv.status !== 'pending_approval' && sv.status !== 'rejected' && sv.status !== 'awaiting_payee_otp' && (
            <button className="btn btn-sm btn-success" onClick={() => { setTopUpForm({ amount: '', description: `Additional advance for ${sv.purpose}` }); setShowTopUp(true); }}>💰 Top Up</button>
          )}
          {(user.role === 'accounts' || user.isSuperAdmin) && (sv.status === 'open' || sv.status === 'partial') && (
            <button className="btn btn-sm btn-danger" onClick={() => setShowCloseModal(true)}>🔒 Close Voucher</button>
          )}
          {canSettle && <button className="btn btn-sm btn-primary" onClick={() => setShowSettlement(true)}>{Icons.plus} Add Settlement</button>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div><div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Staff Member</div><div style={{ fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}><span style={{ background: '#10b981', color: 'white', fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>👤 Staff</span>{sv.staff_payee?.name || sv.staff?.name || 'Unknown'}{sv.staff_payee?.mobile && <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.85rem' }}>· {sv.staff_payee.mobile}</span>}</div></div>
          <div><div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Purpose</div><div style={{ fontWeight: 600, marginTop: '2px' }}>{sv.purpose}</div></div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Suspense Sent</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f5841f', marginTop: '2px' }}>
              {formatRupees(sv.total_suspense_sent ?? sv.advance_amount)}
            </div>
            {sv.total_suspense_sent != null && sv.total_suspense_sent > parseFloat(sv.advance_amount) && (
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                Initial {formatRupees(sv.advance_amount)} + Top-ups {formatRupees(sv.total_suspense_sent - parseFloat(sv.advance_amount))}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance Remaining</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: parseFloat(sv.balance_amount ?? sv.advance_amount) < 0 ? '#ef4444' : '#3b82f6', marginTop: '2px' }}>
              {formatRupees(sv.balance_amount ?? sv.advance_amount)}
            </div>
            {parseFloat(sv.balance_amount ?? sv.advance_amount) < 0 && (
              <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '2px', fontWeight: 600 }}>⚠️ Over-spent</div>
            )}
          </div>
          {sv.total_expenses_approved != null && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expenses Approved</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#374151', marginTop: '2px' }}>{formatRupees(sv.total_expenses_approved)}</div>
            </div>
          )}
          {sv.total_expenses_pending != null && sv.total_expenses_pending > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expenses Pending</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#d97706', marginTop: '2px' }}>{formatRupees(sv.total_expenses_pending)}</div>
            </div>
          )}
          {sv.payment_mode && <div><div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Mode</div><div style={{ marginTop: '2px' }}>{sv.payment_mode}</div></div>}
          <div><div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created By</div><div style={{ marginTop: '2px' }}>{sv.creator?.name || 'Unknown'} · {new Date(sv.created_at).toLocaleDateString('en-IN')}</div></div>
          {sv.approver && <div><div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Approved By</div><div style={{ marginTop: '2px' }}>{sv.approver.name} · {new Date(sv.approved_at).toLocaleDateString('en-IN')}</div></div>}
          {sv.narration && <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Narration</div><div style={{ marginTop: '2px' }}>{sv.narration}</div></div>}
        </div>
      </div>

      {sv.settlements && sv.settlements.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.75rem' }}>Settlement Entries</h3>
          {(user.role === 'accounts' || user.isSuperAdmin) && selectedSettlements.size >= 2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.6rem 1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', color: '#1d4ed8', fontWeight: 600 }}>
                🔗 {selectedSettlements.size} entries selected · Total: {formatRupees((sv.settlements || []).filter(s => selectedSettlements.has(s.id)).reduce((sum, s) => sum + parseFloat(s.amount), 0))}
              </span>
              <button className="btn btn-sm btn-primary" style={{ fontSize: '0.8rem' }} onClick={openCombineModal}>🔗 Combine into One Voucher</button>
              <button className="btn btn-sm btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setSelectedSettlements(new Set())}>✕ Clear Selection</button>
            </div>
          )}
          {sv.total_expenses_approved != null && sv.total_suspense_sent != null && sv.total_expenses_approved > sv.total_suspense_sent && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#991b1b' }}>
              ⚠️ <strong>Over-spending detected.</strong> Total approved expenses ({formatRupees(sv.total_expenses_approved)}) exceed total suspense sent ({formatRupees(sv.total_suspense_sent)}) by <strong>{formatRupees(sv.total_expenses_approved - sv.total_suspense_sent)}</strong>. Staff may have spent from their own funds. Please review and close the voucher when settled.
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {(user.role === 'accounts' || user.isSuperAdmin) && <th style={{ padding: '8px 8px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', width: '36px' }}></th>}
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Type</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Description</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>By</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Amount</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sv.settlements.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? 'white' : '#f8f9fa' }}>
                    {(user.role === 'accounts' || user.isSuperAdmin) && (
                      <td style={{ padding: '8px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
                        {s.status === 'pending_review' && s.entry_type === 'expense' && (
                          <input type="checkbox" checked={selectedSettlements.has(s.id)} onChange={() => toggleSelectSettlement(s.id)} style={{ width: '15px', height: '15px', cursor: 'pointer' }} title="Select to combine" />
                        )}
                      </td>
                    )}
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>{new Date(s.created_at).toLocaleDateString('en-IN')}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}><span style={{ color: entryTypeColor(s.entry_type), fontWeight: 600, fontSize: '0.8rem' }}>{entryTypeLabel(s.entry_type)}</span></td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>{s.description}{s.head_of_account && <span style={{ color: '#888', fontSize: '0.75rem' }}> · {s.head_of_account}</span>}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', color: '#666' }}>
                      {(s.payee?.name || s.submitter?.name) ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {s.payee?.name && <span style={{ background: '#10b981', color: 'white', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>👤</span>}
                          {s.payee?.name || s.submitter?.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', textAlign: 'right', fontWeight: 600, color: entryTypeColor(s.entry_type) }}>{formatRupees(s.amount)}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>{settlementStatusBadge(s.status)}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
                      {(user.role === 'accounts' || user.isSuperAdmin) && s.status === 'pending_review' && s.entry_type !== 'topup' && (
                        <button className="btn btn-sm btn-success" style={{ fontSize: '0.75rem', padding: '3px 10px' }} onClick={() => openApproveModal(s)}>✅ Review</button>
                      )}
                      {(user.role === 'admin' || user.isSuperAdmin) && s.entry_type === 'topup' && s.status === 'pending_approval' && (
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button className="btn btn-sm btn-success" style={{ fontSize: '0.75rem', padding: '3px 10px' }} onClick={() => handleApproveTopUp(s)} disabled={actionLoading}>✅ Approve</button>
                          <button className="btn btn-sm btn-danger" style={{ fontSize: '0.75rem', padding: '3px 10px' }} onClick={() => handleRejectTopUp(s)} disabled={actionLoading}>✕ Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BillAttachmentPanel suspenseId={suspenseId} voucherType="suspense" companyId={user.company.id} />

      {showSettlement && (
        <SettlementEntryForm
          suspenseId={suspenseId}
          onDone={() => { setShowSettlement(false); load(); }}
          onClose={() => setShowSettlement(false)}
        />
      )}

      {showTopUp && (
        <div className="modal-overlay" onClick={() => setShowTopUp(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#10b981', color: 'white' }}>
              <h3 className="modal-title" style={{ color: 'white' }}>💰 Top Up Suspense Funds</h3>
              <button className="modal-close" style={{ color: 'white' }} onClick={() => setShowTopUp(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#166534' }}>
                Current balance: <strong>{formatRupees(sv.balance_amount ?? sv.advance_amount)}</strong> · The top-up request will be sent to Admin for approval. Funds will be credited to the staff member only after Admin approves &amp; OTP is successfully verified.
              </div>
              <div className="form-group">
                <label className="form-label">Top-up Amount (₹) *</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="0.00" value={topUpForm.amount} onChange={e => setTopUpForm(f => ({ ...f, amount: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Description / Reason *</label>
                <input className="form-input" type="text" placeholder="e.g. Additional advance for field expenses" value={topUpForm.description} onChange={e => setTopUpForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {topUpForm.amount && !isNaN(parseFloat(topUpForm.amount)) && parseFloat(topUpForm.amount) > 0 && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.85rem', color: '#1d4ed8' }}>
                  Projected balance if approved: <strong>{formatRupees((parseFloat(sv.balance_amount ?? sv.advance_amount) + parseFloat(topUpForm.amount)))}</strong>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowTopUp(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handleTopUp} disabled={topUpLoading}>{topUpLoading ? Icons.loader : '💰'} Submit for Approval</button>
            </div>
          </div>
        </div>
      )}

      {showCloseModal && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#ef4444', color: 'white' }}>
              <h3 className="modal-title" style={{ color: 'white' }}>🔒 Close Suspense Voucher</h3>
              <button className="modal-close" style={{ color: 'white' }} onClick={() => setShowCloseModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#7f1d1d' }}>
                This will permanently close <strong>{sv.serial_number}</strong>. The staff member's settlement link will stop working. This action is intended only for use by Accounts once all entries are verified.
              </div>
              {parseFloat(sv.balance_amount ?? 0) < 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#92400e' }}>
                  ⚠️ There is an over-spend of <strong>{formatRupees(Math.abs(parseFloat(sv.balance_amount ?? 0)))}</strong>. Ensure this has been accounted for before closing.
                </div>
              )}
              {sv.settlements?.some(s => s.status === 'pending_review') && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#92400e' }}>
                  ⚠️ There are still <strong>{sv.settlements.filter(s => s.status === 'pending_review').length}</strong> pending entries awaiting review. Approve or reject them before closing.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCloseModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleCloseVoucher} disabled={closeLoading}>{closeLoading ? Icons.loader : '🔒'} Confirm Close</button>
            </div>
          </div>
        </div>
      )}

      {showRejectTopUpModal && rejectingTopUpEntry && (
        <div className="modal-overlay" onClick={() => setShowRejectTopUpModal(false)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#ef4444', color: 'white' }}>
              <h3 className="modal-title" style={{ color: 'white' }}>✕ Reject Top-Up Request</h3>
              <button className="modal-close" style={{ color: 'white' }} onClick={() => setShowRejectTopUpModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Top-Up Amount</div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{formatRupees(rejectingTopUpEntry.amount)}</div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.6rem', marginBottom: '0.3rem' }}>Reason Submitted</div>
                <div>{rejectingTopUpEntry.description}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Rejection (optional)</label>
                <textarea className="form-input" rows={3} placeholder="Enter reason for rejecting this top-up..." value={rejectTopUpReason} onChange={e => setRejectTopUpReason(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRejectTopUpModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmRejectTopUp} disabled={actionLoading}>{actionLoading ? Icons.loader : '✕'} Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: shareSmsStatus === 'sent' ? '#10b981' : '#f59e0b', color: 'white' }}>
              <h3 className="modal-title" style={{ color: 'white' }}>{shareSmsStatus === 'sent' ? '📲 Settlement Link Sent' : '⚠️ SMS Failed — Share Manually'}</h3>
              <button className="modal-close" style={{ color: 'white' }} onClick={() => setShowShareModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {shareSmsStatus === 'sent' ? (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#166534' }}>
                  ✅ SMS sent successfully to <strong>{sv.staff_payee?.mobile || sv.staff?.mobile || 'payee'}</strong>. You can also share this link directly:
                </div>
              ) : (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#92400e' }}>
                  ⚠️ SMS could not be delivered. Please share this link directly with <strong>{sv.staff_payee?.name || sv.staff?.name || 'the staff member'}</strong> via WhatsApp or any other channel.
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  className="form-input"
                  readOnly
                  value={shareUrl}
                  style={{ flex: 1, fontSize: '0.8rem', background: '#f8fafc' }}
                  onFocus={e => e.target.select()}
                />
                <button
                  className="btn btn-secondary"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl).then(() => addToast('Link copied!', 'success')).catch(() => addToast('Copy failed — select and copy manually', 'error'));
                  }}
                >📋 Copy</button>
              </div>
              <a
                href={`https://wa.me/${(sv.staff_payee?.mobile || '').replace(/\D/g, '')}?text=${encodeURIComponent('Your settlement form for ' + sv.serial_number + ' is ready. Open it here: ' + shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-success"
                style={{ width: '100%', display: 'block', textAlign: 'center', textDecoration: 'none' }}
              >💬 Share via WhatsApp</a>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowShareModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Reject Suspense Voucher</h3><button className="modal-close" onClick={() => setShowRejectModal(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Reason for rejection</label><textarea className="form-input" rows={3} placeholder="Enter reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReject} disabled={actionLoading}>{actionLoading && Icons.loader} Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

      {showAdvanceOtpModal && (
        <div className="modal-overlay" onClick={() => setShowAdvanceOtpModal(false)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#ea580c', color: 'white' }}>
              <h3 className="modal-title" style={{ color: 'white' }}>🔐 Verify Advance Receipt OTP</h3>
              <button className="modal-close" style={{ color: 'white' }} onClick={() => setShowAdvanceOtpModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#9a3412' }}>
                An OTP has been sent to <strong>{sv.staff_payee?.name || sv.staff?.name || 'the staff member'}</strong> ({sv.staff_payee?.mobile || sv.staff?.mobile || ''}). Ask them to share the OTP to confirm they have received the advance of <strong>{formatRupees(sv.advance_amount)}</strong>. The settlement form link will only be sent after this step.
              </div>
              <div className="form-group" style={{ textAlign: 'center' }}>
                <label className="form-label" style={{ marginBottom: '0.75rem', display: 'block' }}>Enter OTP received by staff</label>
                <OTPInput value={advanceOtp} onChange={setAdvanceOtp} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={handleResendAdvanceOtp}>🔄 Resend OTP</button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdvanceOtpModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handleVerifyAdvanceOtp} disabled={advanceOtpLoading || advanceOtp.length < 6}>{advanceOtpLoading ? Icons.loader : Icons.check} Verify & Activate</button>
            </div>
          </div>
        </div>
      )}

      {showCombineModal && (
        <div className="modal-overlay" onClick={() => setShowCombineModal(false)}>
          <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#2563eb', color: 'white' }}>
              <h3 className="modal-title" style={{ color: 'white' }}>🔗 Combine Entries into One Voucher</h3>
              <button className="modal-close" style={{ color: 'white' }} onClick={() => setShowCombineModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Summary of selected entries */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Entries being combined</div>
                {(sv.settlements || []).filter(s => selectedSettlements.has(s.id)).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#374151' }}>{s.description}</span>
                    <span style={{ fontWeight: 600, color: '#ef4444' }}>{formatRupees(s.amount)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700, marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '2px solid #e2e8f0' }}>
                  <span>Combined Total</span>
                  <span style={{ color: '#1d4ed8' }}>{formatRupees((sv.settlements || []).filter(s => selectedSettlements.has(s.id)).reduce((sum, s) => sum + parseFloat(s.amount), 0))}</span>
                </div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#166534' }}>
                ✅ One <strong>Completed</strong> payment voucher will be created for the combined total. All bill attachments from each expense entry will be carried over to this voucher.
              </div>
              <div className="form-group">
                <label className="form-label">Head of Account <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="form-select" value={combineForm.headOfAccount} onChange={e => setCombineForm(f => ({...f, headOfAccount: e.target.value}))}>
                  <option value="">— Select Head of Account —</option>
                  {heads.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Sub-Head (optional)</label>
                <input className="form-input" type="text" placeholder="Sub-head of account" value={combineForm.subHeadOfAccount} onChange={e => setCombineForm(f => ({...f, subHeadOfAccount: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Narration</label>
                <textarea className="form-input" rows={3} value={combineForm.narration} onChange={e => setCombineForm(f => ({...f, narration: e.target.value}))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="form-select" value={combineForm.paymentMode} onChange={e => setCombineForm(f => ({...f, paymentMode: e.target.value}))}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Account Transfer">Account Transfer</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Invoice Ref. (optional)</label>
                  <input className="form-input" type="text" placeholder="Invoice / Bill No." value={combineForm.invoiceReference} onChange={e => setCombineForm(f => ({...f, invoiceReference: e.target.value}))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCombineModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCombineSettlements} disabled={combineLoading}>{combineLoading ? Icons.loader : '🔗'} Combine & Create Voucher</button>
            </div>
          </div>
        </div>
      )}

      {showApproveModal && approvingEntry && (
        <div className="modal-overlay" onClick={() => setShowApproveModal(false)}>
          <div className="modal" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✅ Review & Approve Settlement Entry</h3>
              <button className="modal-close" onClick={() => setShowApproveModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
                  <div><div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entry Type</div><div style={{ fontWeight: 600, color: entryTypeColor(approvingEntry.entry_type), marginTop: '2px' }}>{entryTypeLabel(approvingEntry.entry_type)}</div></div>
                  <div><div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</div><div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>{formatRupees(approvingEntry.amount)}</div></div>
                  <div style={{ gridColumn: '1 / -1' }}><div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Staff Description</div><div style={{ marginTop: '2px' }}>{approvingEntry.description}</div></div>
                  {approvingEntry.reference_number && <div style={{ gridColumn: '1 / -1' }}><div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ref No.</div><div style={{ marginTop: '2px' }}>{approvingEntry.reference_number}</div></div>}
                </div>
              </div>
              <div className="form-group" style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={approveForm.createVoucher} onChange={e => setApproveForm(f => ({...f, createVoucher: e.target.checked}))} style={{ width: '18px', height: '18px' }} />
                  <span style={{ fontWeight: 600 }}>📋 Create Payment Voucher from this entry</span>
                </label>
              {approveForm.createVoucher && (
                <p style={{ fontSize: '0.8rem', color: '#166534', marginTop: '0.5rem', marginLeft: '2rem' }}>
                  A voucher will be created and marked <strong>Completed</strong> immediately — payment was already disbursed as the suspense advance. Bills attached by the staff member will be copied to this voucher for traceability.
                </p>
              )}
              </div>
              {/* Head of Account is ALWAYS required — Accounts must classify every expense */}
              <div className="form-group">
                <label className="form-label">Head of Account <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="form-select" value={approveForm.headOfAccount} onChange={e => setApproveForm(f => ({...f, headOfAccount: e.target.value}))}>
                  <option value="">— Select Head of Account —</option>
                  {heads.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                </select>
                <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.4rem' }}>ℹ️ Accounts must classify the expense head — staff cannot set this.</p>
              </div>
              <div className="form-group">
                <label className="form-label">Sub-Head (optional)</label>
                <input className="form-input" type="text" placeholder="Sub-head of account" value={approveForm.subHeadOfAccount} onChange={e => setApproveForm(f => ({...f, subHeadOfAccount: e.target.value}))} />
              </div>
              {approveForm.createVoucher && (
                <>
                  <div className="form-group">
                    <label className="form-label">Narration</label>
                    <textarea className="form-input" rows={2} value={approveForm.narration} onChange={e => setApproveForm(f => ({...f, narration: e.target.value}))} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Payment Mode</label>
                      <select className="form-select" value={approveForm.paymentMode} onChange={e => setApproveForm(f => ({...f, paymentMode: e.target.value}))}>
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Account Transfer">Account Transfer</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Invoice Ref.</label>
                      <input className="form-input" type="text" placeholder="Invoice / Bill No." value={approveForm.invoiceReference} onChange={e => setApproveForm(f => ({...f, invoiceReference: e.target.value}))} />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowApproveModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handleApproveSettlement} disabled={actionLoading}>{actionLoading ? Icons.loader : Icons.check} Approve{approveForm.createVoucher ? ' & Create Voucher' : ' Entry'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SETTLEMENT SESSION PAGE (public — no auth)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// SETTLEMENT INSTALL BANNER
// Shown inside the settlement page to nudge staff to install the PWA.
// Handles Android (beforeinstallprompt) and iOS (manual share instructions).
// ─────────────────────────────────────────────────────────────────────────────
const SettlementInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState(null); // 'android' | 'ios' | null
  const [iosExpanded, setIosExpanded] = useState(false);

  useEffect(() => {
    // Already installed as standalone PWA — don't show
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // User dismissed before — don't show
    if (localStorage.getItem('settlement-install-dismissed')) return;

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIos && isSafari) {
      setMode('ios');
      setShow(true);
      return;
    }

    // Android / desktop Chrome: listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setMode('android');
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShow(false);
    if (outcome === 'accepted') localStorage.setItem('settlement-install-dismissed', '1');
  };

  const handleDismiss = () => {
    localStorage.setItem('settlement-install-dismissed', '1');
    setShow(false);
  };

  if (!show) return null;

  const bannerStyle = {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)',
    borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem',
    color: 'white', textAlign: 'left', position: 'relative'
  };
  const dismissBtn = {
    position: 'absolute', top: '0.6rem', right: '0.75rem',
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
    fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: '0.2rem 0.4rem'
  };

  if (mode === 'android') return (
    <div style={bannerStyle}>
      <button style={dismissBtn} onClick={handleDismiss} aria-label="Dismiss">✕</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.6rem' }}>📲</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Install Relish Approvals</div>
          <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>Add to your home screen for quick access — no App Store needed.</div>
        </div>
      </div>
      <button onClick={handleInstall} style={{ background: '#f5841f', color: 'white', border: 'none', borderRadius: '8px', padding: '0.65rem 1.25rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', width: '100%' }}>
        ➕ Add to Home Screen
      </button>
    </div>
  );

  if (mode === 'ios') return (
    <div style={bannerStyle}>
      <button style={dismissBtn} onClick={handleDismiss} aria-label="Dismiss">✕</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.6rem' }}>📲</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Install Relish Approvals</div>
          <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>Save this form to your home screen for instant access.</div>
        </div>
      </div>
      {!iosExpanded ? (
        <button onClick={() => setIosExpanded(true)} style={{ background: '#f5841f', color: 'white', border: 'none', borderRadius: '8px', padding: '0.65rem 1.25rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', width: '100%' }}>
          Show me how
        </button>
      ) : (
        <ol style={{ margin: '0', paddingLeft: '1.25rem', fontSize: '0.88rem', lineHeight: 1.7, opacity: 0.95 }}>
          <li>Tap the <strong>Share</strong> button <span style={{ fontSize: '1rem' }}>⎙</span> at the bottom of Safari</li>
          <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
          <li>Tap <strong>Add</strong> — done! Open it like any app.</li>
        </ol>
      )}
    </div>
  );

  return null;
};

const SettlementSessionPage = ({ token }) => {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | submitting | submitted | error | expired | used
  const [error, setError] = useState('');
  const [entryType, setEntryType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [headOfAccount, setHeadOfAccount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [requiresInvoice, setRequiresInvoice] = useState(true);
  const [invoiceMissingReason, setInvoiceMissingReason] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]); // files staged before submission
  const [pendingUploading, setPendingUploading] = useState(false);
  const [settlement, setSettlement] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [captureSession, setCaptureSession] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pollExpiry, setPollExpiry] = useState(null);
  const [history, setHistory] = useState([]); // all settlement entries for this voucher
  const [historyLoading, setHistoryLoading] = useState(false);
  const pollIntervalRef = React.useRef(null);
  const takePhotoRef1 = React.useRef(null); // pre-submission camera input
  const takePhotoRef2 = React.useRef(null); // post-submission camera input
  const [cameraError, setCameraError] = useState('');

  // Detect if this page was reached via an authenticated staff login (not a raw SMS link)
  const isStaffLogin = (() => {
    try { const s = localStorage.getItem('relish_session'); if (!s) return false; const u = JSON.parse(s); return u?.role === 'staff'; } catch { return false; }
  })();
  const handleStaffLogout = () => {
    try { localStorage.removeItem('relish_session'); localStorage.removeItem('relish_settlement_token'); localStorage.removeItem('relish_page'); } catch {}
    window.location.reload();
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try { const data = await api.getSettlementEntries(token); setHistory(data.entries || []); } catch {}
    setHistoryLoading(false);
  };

  // Request camera permission explicitly, then trigger the file input.
  // This surfaces the browser permission prompt instead of silently failing.
  const requestCameraAndClick = async (inputRef, setErr) => {
    setErr('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Browser doesn't support getUserMedia — fall back directly to file input
      inputRef.current && inputRef.current.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(t => t.stop()); // permission granted — stop preview stream
      inputRef.current && inputRef.current.click();
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErr('Camera access was denied. Please allow camera permission in your browser/phone settings, then try again. Or use "Upload from Gallery" instead.');
      } else {
        // Device has no camera or other hardware error — still try the file input
        inputRef.current && inputRef.current.click();
      }
    }
  };

  const loadAttachments = async (settlementId) => {
    if (!settlementId) return;
    setAttachmentLoading(true);
    try {
      const data = await api.getAttachments({ settlementId });
      setAttachments(data.attachments || []);
    } catch {
      setAttachments([]);
    }
    setAttachmentLoading(false);
  };

  const compressAndEncode = async (file) => {
    let processedFile = file;
    if (file.type.startsWith('image/') && typeof imageCompression !== 'undefined') {
      try {
        processedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true });
      } catch {}
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ data: reader.result, mimeType: processedFile.type, name: file.name });
      reader.onerror = reject;
      reader.readAsDataURL(processedFile);
    });
  };

  const handlePendingFileAdd = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('File too large (max 10 MB)'); return; }
    try {
      const { data, mimeType, name } = await compressAndEncode(file);
      const previewUrl = file.type.startsWith('image/') ? data : null;
      setPendingFiles(prev => [...prev, { data, mimeType, name, previewUrl }]);
    } catch { setError('Failed to process file'); }
    e.target.value = '';
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !settlement) return;
    if (file.size > 10 * 1024 * 1024) { setAttachmentError('File too large (max 10 MB)'); return; }
    setAttachmentUploading(true);
    setAttachmentError('');
    try {
      const { data, mimeType, name } = await compressAndEncode(file);
      const result = await api.uploadAttachment({ fileData: data, mimeType, fileName: name, settlementId: settlement.id, suspenseId: session.suspense.id, uploadedBy: session.payee?.user_id || null, companyId: session.suspense.company_id });
      if (result.success) {
        setAttachmentError('');
        await loadAttachments(settlement.id);
      } else {
        setAttachmentError(result.error || 'Upload failed');
      }
    } catch {
      setAttachmentError('Upload failed');
    }
    setAttachmentUploading(false);
    e.target.value = '';
  };

  const startQRCapture = async () => {
    if (!settlement) return;
    setShowQr(false);
    try {
      const result = await api.createCaptureSession({ companyId: session.suspense.company_id, createdBy: session.payee?.user_id || null, voucherId: null, suspenseId: session.suspense.id, settlementId: settlement.id, contextType: 'settlement' });
      if (!result.success) { setAttachmentError('Failed to create session'); return; }
      const newSession = result.session;
      setCaptureSession(newSession);
      const url = `${window.location.origin}/capture/${newSession.id}`;
      setQrImageUrl(`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1a1a1a&margin=10`);
      setShowQr(true);
      setPollExpiry(new Date(newSession.expires_at));
      setPolling(true);
      setAttachmentError('');
    } catch {
      setAttachmentError('Failed to start phone capture');
    }
  };

  useEffect(() => {
    if (!polling || !captureSession || !settlement) return;
    const stopPolling = (message, isError) => {
      clearInterval(pollIntervalRef.current);
      setPolling(false);
      setShowQr(false);
      setCaptureSession(null);
      setQrImageUrl(null);
      if (message) setAttachmentError(isError ? message : '');
      if (!isError) loadAttachments(settlement.id);
    };
    const poll = async () => {
      try {
        const data = await api.getCaptureSession(captureSession.id);
        const sessionData = data.session;
        if (sessionData?.status === 'used') { stopPolling('Photo received from phone!', false); return; }
        if (sessionData?.status === 'expired') { stopPolling('QR session expired', true); return; }
      } catch {
        // ignore polling errors
      }
    };
    pollIntervalRef.current = setInterval(poll, 4000);
    return () => clearInterval(pollIntervalRef.current);
  }, [polling, captureSession, settlement]);

  useEffect(() => {
    api.getSettlementSession(token).then(data => {
      if (data.settlementSession) {
        setSession(data.settlementSession);
        setStatus('ready');
        // Persist token so PWA launched from home screen (start_url='/') can restore it
        try { localStorage.setItem('relish_settlement_token', token); } catch {}
        // Load expense history for this voucher
        loadHistory();
      } else {
        setError(data.error || 'Settlement session not found');
        setStatus('error');
        // If session is expired/invalid, clear any saved token
        try { localStorage.removeItem('relish_settlement_token'); } catch {}
      }
    }).catch(() => { setError('Failed to load settlement session'); setStatus('error'); });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !description.trim()) {
      setError('Amount and description are required.');
      return;
    }
    setError('');
    setStatus('submitting');
    try {
      const result = await api.submitSettlementSession(token, {
        entryType,
        amount,
        description,
        headOfAccount,
        referenceNumber,
        requiresInvoice,
        invoiceMissingReason: requiresInvoice ? null : invoiceMissingReason
      });
      if (result.success) {
        setSettlement(result.settlement);
        setStatus('submitted');
        // Upload any files staged inside the form
        if (pendingFiles.length > 0) {
          setPendingUploading(true);
          for (const pf of pendingFiles) {
            try {
              await api.uploadAttachment({ fileData: pf.data, mimeType: pf.mimeType, fileName: pf.name, settlementId: result.settlement.id, suspenseId: session.suspense.id, uploadedBy: session.payee?.user_id || null, companyId: session.suspense.company_id });
            } catch {}
          }
          setPendingFiles([]);
          setPendingUploading(false);
        }
        await loadAttachments(result.settlement.id);
        setTimeout(() => {
          const el = document.getElementById('attachment-panel');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 250);
      } else {
        setError(result.error || 'Failed to submit settlement entry');
        setStatus('error');
      }
    } catch (err) {
      setError(err.message || 'Failed to submit settlement entry');
      setStatus('error');
    }
  };

  const containerStyle = { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#f8f9fa', fontFamily: 'Outfit, sans-serif', textAlign: 'center' };
  const cardStyle = { background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: '520px', width: '100%' };
  const fieldStyle = { width: '100%', marginBottom: '1rem', textAlign: 'left' };
  const labelStyle = { display: 'block', marginBottom: '0.35rem', fontWeight: 600, color: '#333' };
  const inputStyle = { width: '100%', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #d6d6d6', fontSize: '1rem' };
  const buttonStyle = { width: '100%', background: '#f5841f', color: 'white', border: 'none', borderRadius: '10px', padding: '0.95rem 1rem', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' };

  if (status === 'loading') return <div style={containerStyle}><div style={cardStyle}>{Icons.loader}<p style={{ marginTop: '1rem', color: '#666' }}>Loading settlement session...</p></div></div>;
  if (status === 'error') return <div style={containerStyle}><div style={cardStyle}><div style={{ fontSize: '3rem' }}>❌</div><h2 style={{ marginTop: '1rem' }}>Session Error</h2><p style={{ color: '#666', marginTop: '0.5rem' }}>{error}</p></div></div>;
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return <div style={containerStyle}><div style={cardStyle}><div style={{ fontSize: '3rem' }}>⏰</div><h2 style={{ marginTop: '1rem' }}>Link Expired</h2><p style={{ color: '#666', marginTop: '0.5rem' }}>This settlement link has expired. Ask your approver to generate a new link.</p></div></div>;

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <SettlementInstallBanner />
        {isStaffLogin && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <button onClick={handleStaffLogout} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.35rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>
              ↩ Sign Out
            </button>
          </div>
        )}
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧾 Submit Settlement Details</div>
        <p style={{ color: '#666', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
          Hello {session.payee?.name || 'staff payee'}, please provide the required settlement details for suspense voucher <strong>{session.suspense.serial_number}</strong>.
        </p>
        <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={labelStyle}>Voucher</span>
            <div style={{ color: '#1f2937', fontWeight: 700 }}>{session.suspense.serial_number}</div>
          </div>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={labelStyle}>Available Balance</span>
            <div style={{ color: '#1f2937', fontWeight: 700 }}>{formatRupees(session.suspense.balance_amount || session.suspense.advance_amount || 0)}</div>
          </div>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={labelStyle}>Payee</span>
            <div style={{ color: '#1f2937' }}>{session.payee?.name || session.payee?.mobile}</div>
          </div>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={labelStyle}>Expires At</span>
            <div style={{ color: '#6b7280' }}>{new Date(session.expires_at).getFullYear() >= 2099 ? 'Active until voucher is closed' : new Date(session.expires_at).toLocaleString('en-IN')}</div>
          </div>
        </div>
        {status !== 'submitted' ? (
          <form onSubmit={handleSubmit}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Settlement Type</label>
              <select style={inputStyle} value={entryType} onChange={e => setEntryType(e.target.value)}>
                <option value="expense">Expense</option>
                <option value="advance_adjustment">Advance Adjustment</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Amount</label>
              <input style={inputStyle} type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter settlement amount" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Description / Purpose</label>
              <textarea style={{ ...inputStyle, minHeight: '110px' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the expense or adjustment" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Reference Number (optional)</label>
              <input style={inputStyle} type="text" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="Invoice / bill reference" />
            </div>
            <div style={{ ...fieldStyle, display: 'grid', gap: '0.35rem' }}>
              <label style={labelStyle}>Invoice Available?</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button type="button" onClick={() => setRequiresInvoice(true)} style={{ ...inputStyle, background: requiresInvoice ? '#f5841f' : 'white', color: requiresInvoice ? 'white' : '#111', border: requiresInvoice ? 'none' : '1px solid #d6d6d6' }}>Yes</button>
                <button type="button" onClick={() => setRequiresInvoice(false)} style={{ ...inputStyle, background: !requiresInvoice ? '#f5841f' : 'white', color: !requiresInvoice ? 'white' : '#111', border: !requiresInvoice ? 'none' : '1px solid #d6d6d6' }}>No</button>
              </div>
            </div>
            {!requiresInvoice && (
              <div style={fieldStyle}>
                <label style={labelStyle}>If invoice is not available, explain why</label>
                <textarea style={{ ...inputStyle, minHeight: '90px' }} value={invoiceMissingReason} onChange={e => setInvoiceMissingReason(e.target.value)} placeholder="Reason for missing invoice" />
              </div>
            )}
            {error && <div style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</div>}
            <div style={{ ...fieldStyle, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.75rem' }}>📎 Attach Invoice / Receipt</div>
              {pendingFiles.length > 0 && (
                <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {pendingFiles.map((pf, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.5rem 0.75rem' }}>
                      {pf.previewUrl ? <img src={pf.previewUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} /> : <span style={{ fontSize: '1.4rem' }}>📄</span>}
                      <span style={{ flex: 1, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pf.name}</span>
                      <button type="button" onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <button type="button" onClick={() => requestCameraAndClick(takePhotoRef1, setError)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#f5841f', color: 'white', padding: '0.7rem 1rem', borderRadius: '8px', cursor: 'pointer', width: '100%', justifyContent: 'center', boxSizing: 'border-box', fontSize: '0.9rem', fontWeight: 600, border: 'none' }}>
                  📷 Take Photo of Invoice
                </button>
                <input ref={takePhotoRef1} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePendingFileAdd} />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#1f2937', color: 'white', padding: '0.7rem 1rem', borderRadius: '8px', cursor: 'pointer', width: '100%', justifyContent: 'center', boxSizing: 'border-box', fontSize: '0.9rem', fontWeight: 600 }}>
                  {Icons.upload} Upload from Gallery / PDF
                  <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handlePendingFileAdd} />
                </label>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.5rem' }}>Optional — you can also add more attachments after submitting.</div>
            </div>
            <button style={buttonStyle} type="submit" disabled={status === 'submitting' || pendingUploading}>{pendingUploading ? 'Uploading attachments...' : status === 'submitting' ? 'Submitting...' : 'Submit Settlement'}</button>
          </form>
          ) : null}
        {settlement && (
          <div id="attachment-panel" style={{ marginTop: '1.5rem', textAlign: 'left' }}>
            <div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>✅ Settlement Submitted</div>
              <div style={{ color: '#064e3b', fontSize: '0.95rem' }}>You can now attach the invoice or receipt for this settlement.</div>
              <button type="button" onClick={async () => {
                setSettlement(null); setAmount(''); setDescription(''); setHeadOfAccount(''); setReferenceNumber(''); setRequiresInvoice(true); setInvoiceMissingReason(''); setPendingFiles([]);
                const data = await api.getSettlementSession(token);
                if (data.settlementSession) setSession(data.settlementSession);
                await loadHistory();
                setStatus('ready');
              }} style={{ marginTop: '0.75rem', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                ➕ Submit Another Entry
              </button>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#111827' }}>Invoice / Receipt Upload</div>
                  <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Upload directly or send a capture link to your phone.</div>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>{attachments.length} attachment{attachments.length !== 1 ? 's' : ''}</div>
              </div>
              {attachmentLoading ? (
                <div style={{ color: '#6b7280', padding: '1rem 0', textAlign: 'center' }}>{Icons.loader} Loading attachments...</div>
              ) : attachments.length > 0 ? (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {attachments.map(att => (
                    <div key={att.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                        <span style={{ fontSize: '1.2rem' }}>{att.mime_type?.includes('pdf') ? '📄' : '🖼️'}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file_name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{new Date(att.uploaded_at).toLocaleDateString('en-IN')}</div>
                        </div>
                      </div>
                      <a href={att.public_url} target="_blank" rel="noopener noreferrer" style={{ color: '#1d4ed8', fontWeight: 700, fontSize: '0.82rem' }}>View</a>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#6b7280', padding: '1rem 0' }}>No invoice attachments uploaded yet.</div>
              )}
              <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => requestCameraAndClick(takePhotoRef2, setAttachmentError)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#f5841f', color: 'white', padding: '0.8rem 1rem', borderRadius: '10px', cursor: 'pointer', width: '100%', justifyContent: 'center', boxSizing: 'border-box', fontWeight: 600, border: 'none', fontSize: '1rem' }}>
                  {attachmentUploading ? Icons.loader : '📷'} {attachmentUploading ? 'Uploading...' : 'Take Photo of Invoice'}
                </button>
                <input ref={takePhotoRef2} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileUpload} disabled={attachmentUploading} />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#1f2937', color: 'white', padding: '0.8rem 1rem', borderRadius: '10px', cursor: 'pointer', width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}>
                  {Icons.upload} Upload from Gallery / PDF
                  <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileUpload} disabled={attachmentUploading} />
                </label>
                <button type="button" onClick={startQRCapture} style={{ width: '100%', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '10px', padding: '0.8rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                  {Icons.qrCode} Send to Another Device (QR)
                </button>
              </div>
              {showQr && captureSession && (
                <div style={{ marginTop: '1rem', background: 'white', border: '1px dashed #f59e0b', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>📱 Open on another device</div>
                  <img src={qrImageUrl} alt="Capture QR code" style={{ width: 180, height: 180, marginBottom: '0.75rem', borderRadius: 8 }} />
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.75rem' }}>Scan this QR code on another device to take/upload a photo of the invoice.</div>
                  <div style={{ background: '#f3f4f6', borderRadius: 8, padding: '0.75rem', fontSize: '0.78rem', color: '#334155', wordBreak: 'break-all' }}>{`${window.location.origin}/capture/${captureSession.id}`}</div>
                </div>
              )}
              {attachmentError && <div style={{ color: '#b91c1c', marginTop: '1rem' }}>{attachmentError}</div>}
            </div>
          </div>
        )}

        {/* Expense History — read-only list of all entries for this voucher */}
        {history.length > 0 && (
          <div style={{ marginTop: '2rem', textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1f2937', marginBottom: '0.75rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
              📋 My Submitted Expenses
            </div>
            {historyLoading ? <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>Loading...</div> : (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {history.map(h => (
                  <div key={h.id} style={{ background: h.status === 'approved' ? '#f0fdf4' : h.status === 'rejected' ? '#fef2f2' : '#fafafa', border: `1px solid ${h.status === 'approved' ? '#bbf7d0' : h.status === 'rejected' ? '#fecaca' : '#e5e7eb'}`, borderRadius: '10px', padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2937', marginBottom: '0.2rem' }}>{h.description}</div>
                        {h.head_of_account && <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{h.head_of_account}</div>}
                        {h.reference_number && <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Ref: {h.reference_number}</div>}
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.2rem' }}>{new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        {h.attachments && h.attachments.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                            {h.attachments.map(att => (
                              <a key={att.id} href={att.public_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', textDecoration: 'none' }}>
                                {att.mime_type?.includes('pdf') ? '📄' : '🖼️'} {att.file_name || 'Bill'}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, color: h.entry_type === 'refund' ? '#059669' : '#dc2626', fontSize: '0.95rem' }}>
                          {h.entry_type === 'refund' ? '+' : '−'}₹{parseFloat(h.amount).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.72rem', marginTop: '0.2rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, background: h.status === 'approved' ? '#dcfce7' : h.status === 'rejected' ? '#fee2e2' : '#fef9c3', color: h.status === 'approved' ? '#15803d' : h.status === 'rejected' ? '#dc2626' : '#a16207' }}>
                          {h.status === 'approved' ? '✅ Approved' : h.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURE SESSION PAGE (public — no auth)
// ─────────────────────────────────────────────────────────────────────────────
const CaptureSessionPage = ({ sessionId }) => {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | uploading | success | error | expired | used
  const [error, setError] = useState('');
  const captureInputRef = React.useRef(null);

  const requestCameraAndClickCapture = async () => {
    setError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      captureInputRef.current && captureInputRef.current.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(t => t.stop());
      captureInputRef.current && captureInputRef.current.click();
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera access was denied. Please allow camera permission in your browser/phone settings and try again.');
      } else {
        captureInputRef.current && captureInputRef.current.click();
      }
    }
  };

  useEffect(() => {
    api.getCaptureSession(sessionId).then(data => {
      if (data.session) {
        const s = data.session;
        setSession(s);
        if (s.status === 'used') setStatus('used');
        else if (s.status === 'expired') setStatus('expired');
        else setStatus('ready');
      } else {
        setError('Session not found');
        setStatus('error');
      }
    }).catch(() => { setError('Failed to load session'); setStatus('error'); });
  }, [sessionId]);

  const handleCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('uploading');
    try {
      let processedFile = file;
      if (file.type.startsWith('image/') && typeof imageCompression !== 'undefined') {
        try { processedFile = await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 2000, useWebWorker: true }); } catch {}
      }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = await api.uploadToCapture(sessionId, { fileData: reader.result, mimeType: processedFile.type, fileName: file.name });
          if (result.success) setStatus('success');
          else { setError(result.error || 'Upload failed'); setStatus('error'); }
        } catch { setError('Upload failed'); setStatus('error'); }
      };
      reader.onerror = () => { setError('Failed to read file'); setStatus('error'); };
      reader.readAsDataURL(processedFile);
    } catch { setError('Failed to process image'); setStatus('error'); }
  };

  const containerStyle = { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#f8f9fa', fontFamily: 'Outfit, sans-serif', textAlign: 'center' };
  const cardStyle = { background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: '400px', width: '100%' };

  if (status === 'loading') return <div style={containerStyle}><div style={cardStyle}>{Icons.loader}<p style={{ marginTop: '1rem', color: '#666' }}>Loading session...</p></div></div>;
  if (status === 'error') return <div style={containerStyle}><div style={cardStyle}><div style={{ fontSize: '3rem' }}>❌</div><h2 style={{ marginTop: '1rem' }}>Session Error</h2><p style={{ color: '#666', marginTop: '0.5rem' }}>{error}</p></div></div>;
  if (status === 'expired') return <div style={containerStyle}><div style={cardStyle}><div style={{ fontSize: '3rem' }}>⏰</div><h2 style={{ marginTop: '1rem' }}>Session Expired</h2><p style={{ color: '#666', marginTop: '0.5rem' }}>This QR code has expired. Please generate a new one.</p></div></div>;
  if (status === 'used') return <div style={containerStyle}><div style={cardStyle}><div style={{ fontSize: '3rem' }}>✅</div><h2 style={{ marginTop: '1rem' }}>Already Used</h2><p style={{ color: '#666', marginTop: '0.5rem' }}>A photo was already uploaded via this link.</p></div></div>;
  if (status === 'success') return <div style={containerStyle}><div style={cardStyle}><div style={{ fontSize: '3rem' }}>✅</div><h2 style={{ marginTop: '1rem', color: '#10b981' }}>Photo Sent!</h2><p style={{ color: '#666', marginTop: '0.5rem' }}>Your photo has been attached successfully. You can close this page.</p></div></div>;
  if (status === 'uploading') return <div style={containerStyle}><div style={cardStyle}>{Icons.loader}<p style={{ marginTop: '1rem', color: '#666' }}>Uploading photo...</p></div></div>;

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📷</div>
        <h2 style={{ fontWeight: 700, color: '#1a1a1a' }}>Attach Bill Photo</h2>
        <p style={{ color: '#666', fontSize: '0.9rem', margin: '0.75rem 0 1.5rem' }}>
          Take a photo of the bill or receipt to attach it to the voucher.
        </p>
        <button type="button" onClick={requestCameraAndClickCapture} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#f5841f', color: 'white', padding: '0.85rem 2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', width: '100%', justifyContent: 'center', boxSizing: 'border-box', border: 'none' }}>
          📷 Take Photo / Choose File
        </button>
        <input ref={captureInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCapture} />
        {error && <p style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
        <p style={{ color: '#aaa', fontSize: '0.75rem', marginTop: '1rem' }}>
          Session expires: {session ? new Date(session.expires_at).toLocaleTimeString('en-IN') : ''}
        </p>
      </div>
    </div>
  );
};

// Main App
const App = () => {
  const [user, setUser] = useState(() => {
    try {
      // On mobile with lock active, start as null — lock screen will re-hydrate
      if (isMobileDevice()) {
        const hasLock = !!localStorage.getItem('relish_mobile_pin') || !!localStorage.getItem('relish_mobile_bio_id');
        if (hasLock && localStorage.getItem('relish_session')) return null;
      }
      const s = localStorage.getItem('relish_session');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  // Mobile-only lock state
  const [mobileLocked, setMobileLocked] = useState(() => {
    try {
      if (!isMobileDevice()) return false;
      const hasLock = !!localStorage.getItem('relish_mobile_pin') || !!localStorage.getItem('relish_mobile_bio_id');
      return hasLock && !!localStorage.getItem('relish_session');
    } catch { return false; }
  });
  const [mobileSavedUser, setMobileSavedUser] = useState(() => {
    try {
      if (!isMobileDevice()) return null;
      const hasLock = !!localStorage.getItem('relish_mobile_pin') || !!localStorage.getItem('relish_mobile_bio_id');
      if (hasLock) { const s = localStorage.getItem('relish_session'); return s ? JSON.parse(s) : null; }
    } catch {}
    return null;
  });
  const [showPinSetup, setShowPinSetup] = useState(false);
  const bgTimestamp = React.useRef(null);

  // Re-lock on return from background (mobile only, >10 s)
  useEffect(() => {
    if (!isMobileDevice()) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        bgTimestamp.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const elapsed = bgTimestamp.current ? Date.now() - bgTimestamp.current : 0;
        bgTimestamp.current = null;
        const hasLock = !!localStorage.getItem('relish_mobile_pin') || !!localStorage.getItem('relish_mobile_bio_id');
        if (elapsed > 10000 && hasLock && user) {
          setMobileSavedUser(user);
          setMobileLocked(true);
          setUser(null);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [user]);

  const [vouchers, setVouchers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [currentPage, setCurrentPage] = useState(() => {
    try { return localStorage.getItem('relish_page') || 'dashboard'; } catch { return 'dashboard'; }
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);
  const [switchingCompany, setSwitchingCompany] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [suspenseDetailId, setSuspenseDetailId] = useState(null);
  const [settlementToken] = useState(() => {
    const m = window.location.pathname.match(/^\/settlement\/([^/]+)/);
    if (m) return m[1];
    // PWA launched from home screen has start_url='/'; restore saved settlement token
    try {
      const saved = localStorage.getItem('relish_settlement_token');
      if (saved && window.location.pathname === '/') return saved;
    } catch {}
    return null;
  });
  const [captureSessionId] = useState(() => { const m = window.location.pathname.match(/^\/capture\/([^/]+)/); return m ? m[1] : null; });
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

  const addToast = useCallback((message, type = 'info', duration = 4000) => { const id = Date.now(); setToasts(prev => [...prev, { id, message, type }]); setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration); }, []);

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

  // On mount: if session was restored from localStorage, silently refresh user data from server
  // This keeps roles/company names up-to-date and invalidates deleted accounts
  useEffect(() => {
    const stored = (() => { try { return localStorage.getItem('relish_session'); } catch { return null; } })();
    if (!stored) return;
    const storedUser = (() => { try { return JSON.parse(stored); } catch { return null; } })();
    if (!storedUser?.id) return;
    api.refreshSession(storedUser.id).then(result => {
      if (result.success) {
        try { localStorage.setItem('relish_session', JSON.stringify(result.user)); } catch {}
        setUser(result.user);
      } else {
        // User no longer valid — force logout
        try { localStorage.removeItem('relish_session'); localStorage.removeItem('relish_page'); } catch {}
        setUser(null);
        setCurrentPage('dashboard');
      }
    }).catch(() => {
      // Server unreachable (offline) — keep using stored session silently
    });
  }, []); // run once on mount

  useEffect(() => { if (user) { refreshVouchers(); refreshNotifications(); const interval = setInterval(() => { refreshVouchers(); refreshNotifications(); }, 30000); return () => clearInterval(interval); } }, [user, refreshVouchers, refreshNotifications]);

  const handleLogin = async (userData, staffSettlementToken) => {
    // Staff users go directly to their settlement page — no app access
    if (userData.role === 'staff' && staffSettlementToken) {
      try { localStorage.setItem('relish_settlement_token', staffSettlementToken); } catch {}
      try { localStorage.setItem('relish_session', JSON.stringify(userData)); } catch {}  // saved so isStaffLogin check works on reload
      window.location.reload();  // reload so useState initializer picks up the token from localStorage
      return;
    }
    if (userData.role === 'staff') {
      // Staff user but no active voucher right now
      // We still set the user so we can show a meaningful message below
    }
    try { localStorage.setItem('relish_session', JSON.stringify(userData)); } catch {}
    const defaultPage = userData.role === 'auditor' ? 'completed' : 'dashboard';
    try { localStorage.setItem('relish_page', defaultPage); } catch {}
    // Clean up legacy keys
    try { localStorage.removeItem('relish_biometric_id'); } catch {}
    setUser(userData);
    setCurrentPage(defaultPage);
    // Mobile only: offer biometric or PIN setup if not yet configured
    if (isMobileDevice()) {
      const alreadySetup = !!localStorage.getItem('relish_mobile_pin') || !!localStorage.getItem('relish_mobile_bio_id');
      if (!alreadySetup) {
        // Try to register native biometric (Face/Fingerprint) silently
        const bioRegistered = await registerMobileBiometric(userData);
        if (!bioRegistered) {
          // Biometric not available — offer PIN setup
          setShowPinSetup(true);
        }
      }
    }
  };
  const handleLogout = () => {
    try {
      localStorage.removeItem('relish_session');
      localStorage.removeItem('relish_page');
      localStorage.removeItem('relish_biometric_id');
      localStorage.removeItem('relish_mobile_pin');
      localStorage.removeItem('relish_mobile_bio_id');
    } catch {}
    setMobileLocked(false); setMobileSavedUser(null); setShowPinSetup(false);
    setUser(null); setVouchers([]); setNotifications([]); setCurrentPage('dashboard');
  };
  const handleMobileUnlock = (savedUser) => {
    setUser(savedUser);
    setMobileLocked(false); setMobileSavedUser(null);
    setCurrentPage(localStorage.getItem('relish_page') || 'dashboard');
    // Refresh session timestamp
    try { localStorage.setItem('relish_session', JSON.stringify(savedUser)); } catch {}
  };
  const handleMobileLockSignOut = () => {
    try {
      localStorage.removeItem('relish_session');
      localStorage.removeItem('relish_page');
      localStorage.removeItem('relish_mobile_pin');
      localStorage.removeItem('relish_mobile_bio_id');
    } catch {}
    setMobileLocked(false); setMobileSavedUser(null);
  };
  const handlePinSet = (pin) => {
    localStorage.setItem('relish_mobile_pin', hashPin(pin));
    setShowPinSetup(false);
    addToast('PIN set! App will lock when you leave.', 'success');
  };
  const handleSwitchCompany = async (companyId) => {
    setSwitchingCompany(true);
    try {
      const result = await api.switchCompany(user.id, companyId);
      if (result.success) {
        try { localStorage.setItem('relish_session', JSON.stringify(result.user)); } catch {}
        try { localStorage.setItem('relish_page', 'dashboard'); } catch {}
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

  // Mobile lock screen
  if (mobileLocked && mobileSavedUser) {
    return <MobileLockScreen savedUser={mobileSavedUser} onUnlock={handleMobileUnlock} onSignOut={handleMobileLockSignOut} />;
  }

  // Settlement session page — public, no auth required
  if (settlementToken) return <SettlementSessionPage token={settlementToken} />;

  // Capture session page — public, no auth required
  if (captureSessionId) return <CaptureSessionPage sessionId={captureSessionId} />;

  if (!user) return <LoginPage onLogin={handleLogin} />;

  // Staff users should only ever land here if they have no active suspense voucher
  if (user.role === 'staff') {
    return (
      <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: '2rem'}}>
        <div style={{textAlign: 'center', maxWidth: '360px'}}>
          <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🕐</div>
          <h2 style={{fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem'}}>No Active Advance</h2>
          <p style={{color: '#6b7280', marginBottom: '1.5rem'}}>Hi {user.name.split(' ')[0]}! You don't have an active suspense advance right now. Your accounts team will send you an SMS when a new one is raised.</p>
          <button className="btn btn-secondary" onClick={handleLogout} style={{width: '100%'}}>Sign Out</button>
        </div>
      </div>
    );
  }

  const contextValue = { user, vouchers, notifications, addToast, refreshVouchers, refreshNotifications };
  const renderPage = () => {
    if (user.role === 'auditor') return <VoucherList filter="completed" />;
    switch(currentPage) { case 'dashboard': return <Dashboard />; case 'create': return (user.role === 'accounts' || user.isSuperAdmin) ? <CreateVoucher /> : <Dashboard />; case 'drafts': return (user.role === 'accounts' || user.isSuperAdmin) ? <VoucherList filter="draft" /> : <Dashboard />; case 'pending': return <VoucherList filter="pending" />; case 'approved': return <VoucherList filter="approved" />; case 'completed': return <VoucherList filter="completed" />; case 'all': return <VoucherList filter="all" />; case 'users': return user.isSuperAdmin ? <UsersManagement /> : <Dashboard />; case 'payees': return (user.role === 'accounts' || user.isSuperAdmin) ? <PayeesManagement /> : <Dashboard />; case 'accounts': return (user.role === 'accounts' || user.isSuperAdmin) ? <AccountsManagement /> : <Dashboard />; case 'suspense': return <SuspenseVoucherList onViewDetail={(id) => { setSuspenseDetailId(id); setCurrentPage('suspense-detail'); }} />; case 'create-suspense': return (user.role === 'accounts' || user.isSuperAdmin) ? <SuspenseVoucherForm onCreated={() => { setCurrentPage('suspense'); }} onViewDetail={(id) => { setSuspenseDetailId(id); setCurrentPage('suspense-detail'); }} /> : <Dashboard />; case 'suspense-detail': return suspenseDetailId ? <SuspenseVoucherDetail suspenseId={suspenseDetailId} onBack={() => setCurrentPage('suspense')} /> : <SuspenseVoucherList onViewDetail={(id) => { setSuspenseDetailId(id); setCurrentPage('suspense-detail'); }} />; default: return <Dashboard />; } };

  const handleNavClick = (page) => {
    try { localStorage.setItem('relish_page', page); } catch {}
    setCurrentPage(page);
    setShowMobileMenu(false);
  };

  return (
    <AppContext.Provider value={contextValue}>
      <PWAInstallPrompt />
      {showPinSetup && <SetPinModal onPinSet={handlePinSet} onSkip={() => setShowPinSetup(false)} />}
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
            {user.role === 'auditor' ? (
              <div className="nav-section"><div className="nav-section-title">Audit View</div>
                <div className={`nav-item ${currentPage === 'completed' ? 'active' : ''}`} onClick={() => handleNavClick('completed')}>{Icons.checkCircle} Completed Vouchers</div>
              </div>
            ) : (<>
            <div className="nav-section"><div className="nav-section-title">Main</div><div className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard')}>{Icons.home} Dashboard</div></div>
            <div className="nav-section"><div className="nav-section-title">Vouchers</div>
              {(user.role === 'accounts' || user.isSuperAdmin) && <div className={`nav-item ${currentPage === 'create' ? 'active' : ''}`} onClick={() => handleNavClick('create')}>{Icons.plus} Create Voucher</div>}
              {(user.role === 'accounts' || user.isSuperAdmin) && <div className={`nav-item ${currentPage === 'drafts' ? 'active' : ''}`} onClick={() => handleNavClick('drafts')}>📝 Drafts</div>}
              <div className={`nav-item ${currentPage === 'pending' ? 'active' : ''}`} onClick={() => handleNavClick('pending')}>{Icons.clock} Pending Approval</div>
              <div className={`nav-item ${currentPage === 'approved' ? 'active' : ''}`} onClick={() => handleNavClick('approved')}>{Icons.smartphone} Awaiting OTP</div>
              <div className={`nav-item ${currentPage === 'completed' ? 'active' : ''}`} onClick={() => handleNavClick('completed')}>{Icons.checkCircle} Completed</div>
              <div className={`nav-item ${currentPage === 'all' ? 'active' : ''}`} onClick={() => handleNavClick('all')}>{Icons.fileText} All Vouchers</div>
            </div>
            <div className="nav-section"><div className="nav-section-title">Suspense Accounts</div>
              <div className={`nav-item ${currentPage === 'suspense' || currentPage === 'suspense-detail' ? 'active' : ''}`} onClick={() => handleNavClick('suspense')}>{Icons.wallet} Suspense Vouchers</div>
              {(user.role === 'accounts' || user.isSuperAdmin) && <div className={`nav-item ${currentPage === 'create-suspense' ? 'active' : ''}`} onClick={() => handleNavClick('create-suspense')}>{Icons.plus} New Suspense</div>}
            </div>
            {(user.role === 'accounts' || user.isSuperAdmin) && <div className="nav-section"><div className="nav-section-title">Master Data</div>
              <div className={`nav-item ${currentPage === 'payees' ? 'active' : ''}`} onClick={() => handleNavClick('payees')}>{Icons.users} Manage Payees</div>
              <div className={`nav-item ${currentPage === 'accounts' ? 'active' : ''}`} onClick={() => handleNavClick('accounts')}>{Icons.fileText} Heads of Account</div>
            </div>}
            {user.isSuperAdmin && <div className="nav-section"><div className="nav-section-title">Admin Dashboard</div><div className={`nav-item ${currentPage === 'users' ? 'active' : ''}`} onClick={() => handleNavClick('users')}>{Icons.users} User Management</div></div>}
            </>)}
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
                {user.role === 'auditor' ? (
                  <div className="nav-section"><div className="nav-section-title">Audit View</div>
                    <div className={`nav-item ${currentPage === 'completed' ? 'active' : ''}`} onClick={() => handleNavClick('completed')}>{Icons.checkCircle} Completed Vouchers</div>
                  </div>
                ) : (<>
                <div className="nav-section"><div className="nav-section-title">Main</div><div className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => handleNavClick('dashboard')}>{Icons.home} Dashboard</div></div>
                <div className="nav-section"><div className="nav-section-title">Vouchers</div>
                  {(user.role === 'accounts' || user.isSuperAdmin) && <div className={`nav-item ${currentPage === 'create' ? 'active' : ''}`} onClick={() => handleNavClick('create')}>{Icons.plus} Create Voucher</div>}
                  {(user.role === 'accounts' || user.isSuperAdmin) && <div className={`nav-item ${currentPage === 'drafts' ? 'active' : ''}`} onClick={() => handleNavClick('drafts')}>📝 Drafts</div>}
                  <div className={`nav-item ${currentPage === 'pending' ? 'active' : ''}`} onClick={() => handleNavClick('pending')}>{Icons.clock} Pending Approval</div>
                  <div className={`nav-item ${currentPage === 'approved' ? 'active' : ''}`} onClick={() => handleNavClick('approved')}>{Icons.smartphone} Awaiting OTP</div>
                  <div className={`nav-item ${currentPage === 'completed' ? 'active' : ''}`} onClick={() => handleNavClick('completed')}>{Icons.checkCircle} Completed</div>
                  <div className={`nav-item ${currentPage === 'all' ? 'active' : ''}`} onClick={() => handleNavClick('all')}>{Icons.fileText} All Vouchers</div>
                </div>
                <div className="nav-section"><div className="nav-section-title">Suspense Accounts</div>
                  <div className={`nav-item ${currentPage === 'suspense' || currentPage === 'suspense-detail' ? 'active' : ''}`} onClick={() => handleNavClick('suspense')}>{Icons.wallet} Suspense Vouchers</div>
                  {(user.role === 'accounts' || user.isSuperAdmin) && <div className={`nav-item ${currentPage === 'create-suspense' ? 'active' : ''}`} onClick={() => handleNavClick('create-suspense')}>{Icons.plus} New Suspense</div>}
                </div>
                {(user.role === 'accounts' || user.isSuperAdmin) && <div className="nav-section"><div className="nav-section-title">Master Data</div>
                  <div className={`nav-item ${currentPage === 'payees' ? 'active' : ''}`} onClick={() => handleNavClick('payees')}>{Icons.users} Manage Payees</div>
                  <div className={`nav-item ${currentPage === 'accounts' ? 'active' : ''}`} onClick={() => handleNavClick('accounts')}>{Icons.fileText} Heads of Account</div>
                </div>}
                {user.isSuperAdmin && <div className="nav-section"><div className="nav-section-title">Admin Dashboard</div><div className={`nav-item ${currentPage === 'users' ? 'active' : ''}`} onClick={() => handleNavClick('users')}>{Icons.users} User Management</div></div>}
                </>)}
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
