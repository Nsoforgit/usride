import React, { useState } from 'react';
import { useUSRide } from '../context/USRideContext';
import { ArrowLeft, Eye, EyeOff, Loader } from 'lucide-react';

type AuthMode = 'select' | 'rider-login' | 'rider-register' | 'driver-login';

interface AuthViewProps {
  defaultRole?: 'rider' | 'driver';
  onBack: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ defaultRole, onBack }) => {
  const { riderLogin, riderRegister, driverLogin } = useUSRide();

  const [mode, setMode] = useState<AuthMode>(
    defaultRole === 'driver' ? 'driver-login' : defaultRole === 'rider' ? 'rider-login' : 'select'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Rider login
  const [rEmail, setREmail] = useState('');

  // Rider register
  const [rName, setRName] = useState('');
  const [rRegEmail, setRRegEmail] = useState('');
  const [rPhone, setRPhone] = useState('');
  const [rRole, setRRole] = useState<'student' | 'staff' | 'other'>('student');

  // Driver login
  const [dCode, setDCode] = useState('');

  const handleRiderLogin = async () => {
    if (!rEmail.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true); setError('');
    const ok = await riderLogin(rEmail.trim());
    setLoading(false);
    if (!ok) setError('No account found with that email. Please register first.');
  };

  const handleRiderRegister = async () => {
    if (!rName.trim() || !rRegEmail.trim() || !rPhone.trim()) {
      setError('Please fill in all fields.'); return;
    }
    if (!rRegEmail.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (rPhone.length < 10) { setError('Please enter a valid phone number.'); return; }
    setLoading(true); setError('');
    const ok = await riderRegister(rName.trim(), rRegEmail.trim(), rRole, rPhone.trim());
    setLoading(false);
    if (!ok) setError('An account with this email already exists. Please sign in instead.');
  };

  const handleDriverLogin = async () => {
    if (!dCode.trim()) { setError('Please enter your Driver ID Code.'); return; }
    setLoading(true); setError('');
    const ok = await driverLogin(dCode.trim().toUpperCase());
    setLoading(false);
    if (!ok) setError('Invalid Driver ID Code. Contact the Admin if you need help.');
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
          <div style={{ fontWeight: '800', fontSize: '16px', color: '#5B21B6' }}>UNIBEN Ride</div>
          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Campus Transport</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '32px 24px', maxWidth: '420px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* ── ROLE SELECTION ── */}
        {mode === 'select' && (
          <>
            <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#1e1040', marginBottom: '8px' }}>
              Welcome 👋
            </h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '32px' }}>
              How are you using UNIBEN Ride today?
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
                <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>Book USRide Keke or UCRide Cab</div>
              </button>

              <button onClick={() => setMode('driver-login')} style={{
                padding: '20px 24px', borderRadius: '16px',
                backgroundColor: 'transparent',
                color: '#5B21B6', border: '2px solid #5B21B6',
                textAlign: 'left', cursor: 'pointer'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🚗</div>
                <div style={{ fontWeight: '800', fontSize: '18px' }}>I'm a Driver</div>
                <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Sign in with your Driver ID Code</div>
              </button>
            </div>
          </>
        )}

        {/* ── RIDER LOGIN ── */}
        {mode === 'rider-login' && (
          <>
            <h2 style={{ fontSize: '26px', fontWeight: '900', color: '#1e1040', marginBottom: '6px' }}>Sign In</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '28px' }}>Welcome back! Enter your email to continue.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Email Address</label>
                <input
                  style={inputStyle} type="email" placeholder="yourname@uniben.edu"
                  value={rEmail} onChange={e => setREmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRiderLogin()}
                />
              </div>
            </div>

            {error && <p style={{ color: '#DC2626', fontSize: '13px', marginBottom: '16px', padding: '10px 14px', backgroundColor: '#FEF2F2', borderRadius: '10px' }}>{error}</p>}

            <button style={btnPrimary} onClick={handleRiderLogin} disabled={loading}>
              {loading ? <Loader size={18} className="spin" /> : null}
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: '#6B7280', marginTop: '20px' }}>
              New to UNIBEN Ride?{' '}
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
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '28px' }}>Join UNIBEN Ride in seconds.</p>

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
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>I am a</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {(['student', 'staff', 'other'] as const).map(r => (
                    <button key={r} onClick={() => setRRole(r)} style={{
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

        {/* ── DRIVER LOGIN ── */}
        {mode === 'driver-login' && (
          <>
            <h2 style={{ fontSize: '26px', fontWeight: '900', color: '#1e1040', marginBottom: '6px' }}>Driver Sign In</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '28px' }}>
              Enter your Driver ID Code issued by the UNIBEN Ride Admin.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '6px' }}>Driver ID Code</label>
              <input
                style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '3px', fontWeight: '700', fontSize: '18px', textAlign: 'center' }}
                type="text" placeholder="DRV001"
                value={dCode} onChange={e => setDCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleDriverLogin()}
                maxLength={8}
              />
            </div>

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
                Contact the UNIBEN Ride Admin to get registered as a driver on the platform.
              </p>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
