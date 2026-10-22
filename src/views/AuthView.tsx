import React, { useState } from 'react';
import { useUSRide } from '../context/USRideContext';
import { ArrowLeft, Eye, EyeOff, Loader, Lock, KeyRound, CheckCircle } from 'lucide-react';

type AuthMode = 'select' | 'rider-login' | 'rider-register' | 'rider-forgot' | 'driver-login' | 'driver-forgot';

interface AuthViewProps {
  defaultRole?: 'rider' | 'driver';
  onBack: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ defaultRole, onBack }) => {
  const { riderLogin, riderRegister, riderResetPassword, driverLogin, driverResetPassword } = useUSRide();

  const [mode, setMode] = useState<AuthMode>(
    defaultRole === 'driver' ? 'driver-login' : defaultRole === 'rider' ? 'rider-login' : 'select'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Rider login
  const [rEmail, setREmail] = useState('');
  const [rLoginPassword, setRLoginPassword] = useState('');

  // Rider register
  const [rName, setRName] = useState('');
  const [rRegEmail, setRRegEmail] = useState('');
  const [rPhone, setRPhone] = useState('');
  const [rRole, setRRole] = useState<'student' | 'staff' | 'other'>('student');
  const [rRegPassword, setRRegPassword] = useState('');
  const [rRegConfirmPassword, setRRegConfirmPassword] = useState('');
  const [rNdpaConsent, setRNdpaConsent] = useState(false);

  // Rider forgot password
  const [rResetEmail, setRResetEmail] = useState('');
  const [rResetPhone, setRResetPhone] = useState('');
  const [rResetNewPassword, setRResetNewPassword] = useState('');
  const [rResetConfirmPassword, setRResetConfirmPassword] = useState('');

  // Driver login
  const [dCode, setDCode] = useState('');
  const [dPassword, setDPassword] = useState('');

  // Driver forgot password
  const [dResetCode, setDResetCode] = useState('');
  const [dResetVerify, setDResetVerify] = useState('');
  const [dResetNewPassword, setDResetNewPassword] = useState('');
  const [dResetConfirmPassword, setDResetConfirmPassword] = useState('');

  const handleRiderLogin = async () => {
    if (!rEmail.trim()) { setError('Please enter your email address.'); return; }
    if (!rLoginPassword.trim() || rLoginPassword.trim().length < 4) {
      setError('Please enter your password (minimum 4 characters).');
      return;
    }
    setLoading(true); setError('');
    const res = await riderLogin(rEmail.trim(), rLoginPassword);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Invalid email or password.');
    }
  };

  const handleRiderRegister = async () => {
    if (!rName.trim() || !rRegEmail.trim() || !rPhone.trim() || !rRegPassword.trim()) {
      setError('Please fill in all fields including your password.'); return;
    }
    if (!rRegEmail.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (rPhone.length < 10) { setError('Please enter a valid phone number.'); return; }
    if (rRegPassword.trim().length < 4) {
      setError('Password must be at least 4 characters long.'); return;
    }
    if (rRegPassword !== rRegConfirmPassword) {
      setError('Passwords do not match. Please check and try again.'); return;
    }
    if (!rNdpaConsent) {
      setError('Please accept the NDPA 2023 Data Privacy & University of Benin Consent notice to create an account.');
      return;
    }
    setLoading(true); setError('');
    const res = await riderRegister(rName.trim(), rRegEmail.trim(), rRole, rPhone.trim(), rRegPassword);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'An account with this email already exists. Please sign in instead.');
    }
  };

  const handleDriverLogin = async () => {
    if (!dCode.trim()) { setError('Please enter your Driver ID Code.'); return; }
    if (!dPassword.trim() || dPassword.trim().length < 4) {
      setError('Please enter your Driver PIN / Password (minimum 4 characters).');
      return;
    }
    setLoading(true); setError(''); setSuccessMsg('');
    const res = await driverLogin(dCode.trim().toUpperCase(), dPassword);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Invalid Driver ID Code or PIN. Contact the Admin if you need help.');
    }
  };

  const handleRiderForgotPassword = async () => {
    if (!rResetEmail.trim() || !rResetPhone.trim() || !rResetNewPassword.trim()) {
      setError('Please enter your registered email, phone number, and your new password.');
      return;
    }
    if (rResetNewPassword.trim().length < 4) {
      setError('Your new password must be at least 4 characters long.');
      return;
    }
    if (rResetNewPassword !== rResetConfirmPassword) {
      setError('New passwords do not match. Please check and try again.');
      return;
    }
    setLoading(true); setError(''); setSuccessMsg('');
    const res = await riderResetPassword(rResetEmail.trim(), rResetPhone.trim(), rResetNewPassword);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Could not reset password. Please check your registered email and phone number.');
    } else {
      setREmail(rResetEmail.trim());
      setRLoginPassword('');
      setRResetNewPassword('');
      setRResetConfirmPassword('');
      setSuccessMsg('✅ Password reset successful! You can now sign in with your new password.');
      setMode('rider-login');
    }
  };

  const handleDriverForgotPassword = async () => {
    if (!dResetCode.trim() || !dResetVerify.trim() || !dResetNewPassword.trim()) {
      setError('Please enter your Driver ID Code, registered email or phone number, and your new PIN/Password.');
      return;
    }
    if (dResetNewPassword.trim().length < 4) {
      setError('Your new PIN / Password must be at least 4 characters long.');
      return;
    }
    if (dResetNewPassword !== dResetConfirmPassword) {
      setError('New PIN / Passwords do not match. Please check and try again.');
      return;
    }
    setLoading(true); setError(''); setSuccessMsg('');
    const res = await driverResetPassword(dResetCode.trim().toUpperCase(), dResetVerify.trim(), dResetNewPassword);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Could not reset PIN/Password. Please verify your details or contact USRide Admin.');
    } else {
      setDCode(dResetCode.trim().toUpperCase());
      setDPassword('');
      setDResetNewPassword('');
      setDResetConfirmPassword('');
      setSuccessMsg('✅ Driver PIN / Password reset successful! You can now sign in.');
      setMode('driver-login');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px',
    borderRadius: '12px', border: '1.5px solid #E9D5FF',
    fontSize: '15px', outline: 'none',
    backgroundColor: '#FAFAFA', color: '#1e1040',
    fontFamily: 'inherit', boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  };

  const btnPrimary: React.CSSProperties = {
    width: '100%', padding: '16px',
    background: 'linear-gradient(135deg, #5B21B6, #7C3AED)',
    color: '#fff', border: 'none', borderRadius: '14px',
    fontWeight: '800', fontSize: '16px', cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(91,33,182,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    transition: 'opacity 0.2s', opacity: loading ? 0.7 : 1
  };

  const card: React.CSSProperties = {
    minHeight: '100vh', backgroundColor: '#fff',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    display: 'flex', flexDirection: 'column'
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 0',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <button onClick={mode === 'select' ? onBack : () => { setMode('select'); setError(''); }}
          style={{ background: 'none', border: '1.5px solid #E9D5FF', borderRadius: '10px', padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={18} color="#5B21B6" />
        </button>
        <div>
          <div style={{ fontWeight: '800', fontSize: '16px', color: '#5B21B6' }}>USRide</div>
          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>UNIBEN Smart Campus Mobility</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '32px 24px', maxWidth: '420px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* ── ROLE SELECTION ── */}
        {mode === 'select' && (
          <>
            <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#1e1040', marginBottom: '8px' }}>
              Welcome to USRide 👋
            </h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '32px' }}>
              How are you using USRide today?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <button onClick={() => setMode('rider-login')} style={{
                padding: '20px 24px', borderRadius: '16px',
                background: 'linear-gradient(135deg, #5B21B6, #7C3AED)',
                color: '#fff', border: 'none', textAlign: 'left', cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(91,33,182,0.3)'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🛺</div>
                <div style={{ fontWeight: '800', fontSize: '18px' }}>I need a Ride</div>
                <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>Book a USRide Solar Keke or Campus Cab</div>
              </button>

              <button onClick={() => setMode('driver-login')} style={{
                padding: '20px 24px', borderRadius: '16px',
                backgroundColor: 'transparent',
                color: '#5B21B6', border: '2px solid #5B21B6',
                textAlign: 'left', cursor: 'pointer'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🚗</div>
                <div style={{ fontWeight: '800', fontSize: '18px' }}>I'm a Driver</div>
                <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Sign in with your Driver ID Code & PIN</div>
              </button>
            </div>
          </>
        )}

        {/* ── RIDER LOGIN ── */}
        {mode === 'rider-login' && (
          <>
            <h2 style={{ fontSize: '26px', fontWeight: '900', color: '#1e1040', marginBottom: '6px' }}>Sign In</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '28px' }}>
              Enter your email and password to access your wallet & rides.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Email Address</label>
                <input
                  style={inputStyle} type="email" placeholder="yourname@uniben.edu"
                  value={rEmail} onChange={e => setREmail(e.target.value)}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>Password</label>
                  <span
                    onClick={() => {
                      setRResetEmail(rEmail);
                      setError('');
                      setSuccessMsg('');
                      setMode('rider-forgot');
                    }}
                    style={{ fontSize: '12px', fontWeight: '700', color: '#5B21B6', cursor: 'pointer' }}
                  >
                    Forgot Password?
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingRight: '44px' }}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={rLoginPassword}
                    onChange={e => setRLoginPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRiderLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex'
                    }}
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <span style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px', display: 'block' }}>
                  <Lock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                  Existing account without a password? Enter your desired password to secure your account.
                </span>
              </div>
            </div>

            {successMsg && (
              <p style={{ color: '#047857', fontSize: '13px', marginBottom: '16px', padding: '10px 14px', backgroundColor: '#ECFDF5', borderRadius: '10px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} /> {successMsg}
              </p>
            )}
            {error && <p style={{ color: '#DC2626', fontSize: '13px', marginBottom: '16px', padding: '10px 14px', backgroundColor: '#FEF2F2', borderRadius: '10px' }}>{error}</p>}

            <button style={btnPrimary} onClick={handleRiderLogin} disabled={loading}>
              {loading ? <Loader size={18} className="spin" /> : null}
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: '#6B7280', marginTop: '20px' }}>
              New to USRide?{' '}
              <span onClick={() => { setMode('rider-register'); setError(''); }}
                style={{ color: '#5B21B6', fontWeight: '700', cursor: 'pointer' }}>
                Create Account
              </span>
            </p>
          </>
        )}

        {/* ── RIDER REGISTER ── */}
        {mode === 'rider-register' && (
          <>
            <h2 style={{ fontSize: '26px', fontWeight: '900', color: '#1e1040', marginBottom: '6px' }}>Create Account</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>Join USRide with a password-protected campus wallet.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Full Name</label>
                <input style={inputStyle} type="text" placeholder="e.g. Osas Igbinedion"
                  value={rName} onChange={e => setRName(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Email Address</label>
                <input style={inputStyle} type="email" placeholder="yourname@uniben.edu"
                  value={rRegEmail} onChange={e => setRRegEmail(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Phone Number</label>
                <input style={inputStyle} type="tel" placeholder="08012345678"
                  value={rPhone} onChange={e => setRPhone(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Create Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingRight: '44px' }}
                    type={showPass ? 'text' : 'password'}
                    placeholder="At least 4 characters"
                    value={rRegPassword}
                    onChange={e => setRRegPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex'
                    }}
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Confirm Password</label>
                <input
                  style={inputStyle}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={rRegConfirmPassword}
                  onChange={e => setRRegConfirmPassword(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>I am a</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {(['student', 'staff', 'other'] as const).map(r => (
                    <button key={r} type="button" onClick={() => setRRole(r)} style={{
                      flex: 1, padding: '10px', borderRadius: '10px',
                      border: `2px solid ${rRole === r ? '#5B21B6' : '#E9D5FF'}`,
                      backgroundColor: rRole === r ? '#EDE9FE' : '#fff',
                      color: rRole === r ? '#5B21B6' : '#6B7280',
                      fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}>{r}</button>
                  ))}
                </div>
              </div>

              {/* NDPA 2023 Privacy & Consent Checkbox */}
              <div style={{
                backgroundColor: '#F5F3FF',
                border: '1px solid #DDD6FE',
                borderRadius: '12px',
                padding: '12px'
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '12px', color: '#374151', lineHeight: 1.45 }}>
                  <input
                    type="checkbox"
                    checked={rNdpaConsent}
                    onChange={e => setRNdpaConsent(e.target.checked)}
                    style={{ marginTop: '3px', accentColor: '#5B21B6', width: '16px', height: '16px', flexShrink: 0 }}
                  />
                  <span>
                    <strong>NDPA 2023 Data Privacy Consent:</strong> I consent to USRide collecting only my <strong>Name, Phone Number, Email, and Campus Role</strong> for ride dispatch and wallet settlement. All data is governed under the <strong>Nigeria Data Protection Act (NDPA) 2023</strong> and owned by the <strong>University of Benin (UNIBEN)</strong>.
                  </span>
                </label>
              </div>
            </div>

            {error && <p style={{ color: '#DC2626', fontSize: '13px', marginBottom: '16px', padding: '10px 14px', backgroundColor: '#FEF2F2', borderRadius: '10px' }}>{error}</p>}

            <button style={btnPrimary} onClick={handleRiderRegister} disabled={loading}>
              {loading ? <Loader size={18} /> : null}
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: '#6B7280', marginTop: '20px' }}>
              Already have an account?{' '}
              <span onClick={() => { setMode('rider-login'); setError(''); }}
                style={{ color: '#5B21B6', fontWeight: '700', cursor: 'pointer' }}>Sign In</span>
            </p>
          </>
        )}

        {/* ── RIDER FORGOT PASSWORD ── */}
        {mode === 'rider-forgot' && (
          <>
            <h2 style={{ fontSize: '26px', fontWeight: '900', color: '#1e1040', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={24} color="#5B21B6" /> Reset Password
            </h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
              Verify your registered email and phone number to set a new password.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Registered Email Address</label>
                <input
                  style={inputStyle}
                  type="email"
                  placeholder="yourname@uniben.edu"
                  value={rResetEmail}
                  onChange={e => setRResetEmail(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Registered Phone Number</label>
                <input
                  style={inputStyle}
                  type="tel"
                  placeholder="e.g. 08031234567"
                  value={rResetPhone}
                  onChange={e => setRResetPhone(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingRight: '44px' }}
                    type={showPass ? 'text' : 'password'}
                    placeholder="At least 4 characters"
                    value={rResetNewPassword}
                    onChange={e => setRResetNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex'
                    }}
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Confirm New Password</label>
                <input
                  style={inputStyle}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Re-enter your new password"
                  value={rResetConfirmPassword}
                  onChange={e => setRResetConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRiderForgotPassword()}
                />
              </div>
            </div>

            {error && <p style={{ color: '#DC2626', fontSize: '13px', marginBottom: '16px', padding: '10px 14px', backgroundColor: '#FEF2F2', borderRadius: '10px' }}>{error}</p>}

            <button style={btnPrimary} onClick={handleRiderForgotPassword} disabled={loading}>
              {loading ? <Loader size={18} className="spin" /> : null}
              {loading ? 'Updating Password...' : 'Reset Password →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: '#6B7280', marginTop: '20px' }}>
              Remembered your password?{' '}
              <span onClick={() => { setMode('rider-login'); setError(''); }}
                style={{ color: '#5B21B6', fontWeight: '700', cursor: 'pointer' }}>Back to Sign In</span>
            </p>
          </>
        )}

        {/* ── DRIVER LOGIN ── */}
        {mode === 'driver-login' && (
          <>
            <h2 style={{ fontSize: '26px', fontWeight: '900', color: '#1e1040', marginBottom: '6px' }}>Driver Sign In</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '28px' }}>
              Enter your Driver ID Code and secret PIN/Password.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Driver ID Code</label>
                <input
                  style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '3px', fontWeight: '700', fontSize: '18px', textAlign: 'center' }}
                  type="text" placeholder="DRV001"
                  value={dCode} onChange={e => setDCode(e.target.value.toUpperCase())}
                  maxLength={8}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>Driver PIN / Password</label>
                  <span
                    onClick={() => {
                      setDResetCode(dCode);
                      setError('');
                      setSuccessMsg('');
                      setMode('driver-forgot');
                    }}
                    style={{ fontSize: '12px', fontWeight: '700', color: '#5B21B6', cursor: 'pointer' }}
                  >
                    Forgot PIN / Password?
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingRight: '44px' }}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Enter your PIN or password"
                    value={dPassword}
                    onChange={e => setDPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleDriverLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex'
                    }}
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <span style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px', display: 'block' }}>
                  First time signing in? Enter a 4+ character PIN to lock your Driver ID.
                </span>
              </div>
            </div>

            {successMsg && (
              <p style={{ color: '#047857', fontSize: '13px', marginBottom: '16px', padding: '10px 14px', backgroundColor: '#ECFDF5', borderRadius: '10px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} /> {successMsg}
              </p>
            )}
            {error && <p style={{ color: '#DC2626', fontSize: '13px', marginBottom: '16px', padding: '10px 14px', backgroundColor: '#FEF2F2', borderRadius: '10px' }}>{error}</p>}

            <button style={btnPrimary} onClick={handleDriverLogin} disabled={loading}>
              {loading ? <Loader size={18} /> : null}
              {loading ? 'Signing in...' : 'Sign In as Driver →'}
            </button>

            <div style={{
              marginTop: '24px', padding: '14px 16px', borderRadius: '12px',
              backgroundColor: '#FFFBEB', border: '1px solid #FDE68A'
            }}>
              <p style={{ fontSize: '12px', color: '#92400E', margin: 0, lineHeight: 1.6 }}>
                <strong>⚠️ No Driver ID?</strong><br />
                Contact the USRide Admin to get registered as a driver on the platform.
              </p>
            </div>
          </>
        )}

        {/* ── DRIVER FORGOT PIN / PASSWORD ── */}
        {mode === 'driver-forgot' && (
          <>
            <h2 style={{ fontSize: '26px', fontWeight: '900', color: '#1e1040', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={24} color="#5B21B6" /> Reset Driver PIN
            </h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
              Enter your Driver ID Code and registered email or phone number to set a new PIN/Password.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Driver ID Code</label>
                <input
                  style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '3px', fontWeight: '700', fontSize: '18px', textAlign: 'center' }}
                  type="text"
                  placeholder="DRV001"
                  value={dResetCode}
                  onChange={e => setDResetCode(e.target.value.toUpperCase())}
                  maxLength={8}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Registered Email or Phone Number</label>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="driver@usride.uniben.edu or 0803..."
                  value={dResetVerify}
                  onChange={e => setDResetVerify(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>New PIN / Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingRight: '44px' }}
                    type={showPass ? 'text' : 'password'}
                    placeholder="At least 4 characters"
                    value={dResetNewPassword}
                    onChange={e => setDResetNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex'
                    }}
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Confirm New PIN / Password</label>
                <input
                  style={inputStyle}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Re-enter your new PIN or password"
                  value={dResetConfirmPassword}
                  onChange={e => setDResetConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDriverForgotPassword()}
                />
              </div>
            </div>

            {error && <p style={{ color: '#DC2626', fontSize: '13px', marginBottom: '16px', padding: '10px 14px', backgroundColor: '#FEF2F2', borderRadius: '10px' }}>{error}</p>}

            <button style={btnPrimary} onClick={handleDriverForgotPassword} disabled={loading}>
              {loading ? <Loader size={18} className="spin" /> : null}
              {loading ? 'Updating PIN...' : 'Reset Driver PIN →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: '#6B7280', marginTop: '20px' }}>
              Remembered your PIN?{' '}
              <span onClick={() => { setMode('driver-login'); setError(''); }}
                style={{ color: '#5B21B6', fontWeight: '700', cursor: 'pointer' }}>Back to Driver Sign In</span>
            </p>
          </>
        )}

      </div>
    </div>
  );
};
