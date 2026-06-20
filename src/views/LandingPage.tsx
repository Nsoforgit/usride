import React, { useState } from 'react';
import { MapPin, Zap, Car, Star, Shield, ChevronRight, Menu, X } from 'lucide-react';

interface LandingPageProps {
  onGetRide: () => void;
  onBeDriver: () => void;
  onAdminAccess: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetRide, onBeDriver, onAdminAccess }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminClicks, setAdminClicks] = useState(0);

  // Secret admin access: tap logo 5 times
  const handleLogoTap = () => {
    const next = adminClicks + 1;
    setAdminClicks(next);
    if (next >= 5) { setAdminClicks(0); onAdminAccess(); }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      overflowX: 'hidden'
    }}>

      {/* ── NAV ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #f3f0ff',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 12px rgba(91,33,182,0.07)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={handleLogoTap}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #5B21B6, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(91,33,182,0.3)'
          }}>
            <span style={{ color: '#F59E0B', fontWeight: '900', fontSize: '15px' }}>UR</span>
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '16px', color: '#5B21B6', lineHeight: 1 }}>UNIBEN Ride</div>
            <div style={{ fontSize: '10px', color: '#9CA3AF', letterSpacing: '0.5px' }}>Campus Transport</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={onGetRide} style={{
            padding: '9px 20px', borderRadius: '50px',
            backgroundColor: '#5B21B6', color: '#fff',
            border: 'none', fontWeight: '700', fontSize: '13px',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(91,33,182,0.3)',
            transition: 'all 0.2s'
          }}>Sign In</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        padding: '56px 24px 40px',
        background: 'linear-gradient(160deg, #faf8ff 0%, #f3f0ff 60%, #fffbeb 100%)',
        textAlign: 'center'
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          backgroundColor: '#EDE9FE', borderRadius: '50px',
          padding: '6px 14px', marginBottom: '20px'
        }}>
          <Zap size={12} color="#5B21B6" fill="#5B21B6" />
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#5B21B6', letterSpacing: '0.5px' }}>
            SOLAR-POWERED CAMPUS RIDES
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 8vw, 64px)',
          fontWeight: '900',
          color: '#1e1040',
          lineHeight: 1.1,
          marginBottom: '16px',
          letterSpacing: '-1px'
        }}>
          UNIBEN<br />
          <span style={{ color: '#5B21B6' }}>Ride</span>
        </h1>

        <p style={{
          fontSize: '18px', color: '#6B7280',
          fontWeight: '500', marginBottom: '40px',
          maxWidth: '320px', margin: '0 auto 40px'
        }}>
          Driving Smart Around<br />
          <strong style={{ color: '#5B21B6' }}>UNIBEN Campus</strong>
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '320px', margin: '0 auto 32px' }}>
          <button onClick={onGetRide} style={{
            padding: '18px 32px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #5B21B6, #7C3AED)',
            color: '#fff', border: 'none',
            fontWeight: '800', fontSize: '17px',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(91,33,182,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'transform 0.2s'
          }}>
            🛺 Get a Ride <ChevronRight size={20} />
          </button>
          <button onClick={onBeDriver} style={{
            padding: '18px 32px', borderRadius: '16px',
            backgroundColor: 'transparent',
            color: '#5B21B6', border: '2px solid #5B21B6',
            fontWeight: '800', fontSize: '17px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'all 0.2s'
          }}>
            🚗 I'm a Driver <ChevronRight size={20} />
          </button>
        </div>

        <p style={{ fontSize: '12px', color: '#9CA3AF' }}>
          Already have an account?{' '}
          <span onClick={onGetRide} style={{ color: '#5B21B6', fontWeight: '700', cursor: 'pointer' }}>
            Sign in here
          </span>
        </p>
      </section>

      {/* ── SERVICE CARDS ── */}
      <section style={{ padding: '40px 20px', backgroundColor: '#fff' }}>
        <p style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '20px', textTransform: 'uppercase' }}>
          Our Services
        </p>

        <div style={{ display: 'flex', gap: '14px', maxWidth: '480px', margin: '0 auto' }}>
          {/* USRide Card */}
          <div style={{
            flex: 1, borderRadius: '20px', padding: '24px 20px',
            background: 'linear-gradient(145deg, #5B21B6, #7C3AED)',
            color: '#fff', boxShadow: '0 8px 24px rgba(91,33,182,0.3)',
            cursor: 'pointer', transition: 'transform 0.2s'
          }} onClick={onGetRide}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🛺</div>
            <div style={{ fontWeight: '900', fontSize: '20px', marginBottom: '4px' }}>USRide</div>
            <div style={{ fontSize: '12px', opacity: 0.85, marginBottom: '12px' }}>Smart Solar Keke</div>
            <div style={{
              backgroundColor: 'rgba(245,158,11,0.25)',
              borderRadius: '50px', padding: '4px 10px',
              display: 'inline-block', fontSize: '11px', fontWeight: '700', color: '#FDE68A'
            }}>
              ⚡ Solar Powered
            </div>
          </div>

          {/* UCRide Card */}
          <div style={{
            flex: 1, borderRadius: '20px', padding: '24px 20px',
            background: 'linear-gradient(145deg, #F59E0B, #D97706)',
            color: '#fff', boxShadow: '0 8px 24px rgba(245,158,11,0.3)',
            cursor: 'pointer', transition: 'transform 0.2s'
          }} onClick={onGetRide}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🚗</div>
            <div style={{ fontWeight: '900', fontSize: '20px', marginBottom: '4px' }}>UCRide</div>
            <div style={{ fontSize: '12px', opacity: 0.85, marginBottom: '12px' }}>Campus Cab</div>
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.25)',
              borderRadius: '50px', padding: '4px 10px',
              display: 'inline-block', fontSize: '11px', fontWeight: '700', color: '#fff'
            }}>
              🚀 Premium Comfort
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{
        padding: '32px 24px',
        background: 'linear-gradient(135deg, #5B21B6, #4C1D95)',
        margin: '0 20px 40px', borderRadius: '24px',
        maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          {[
            { value: '17+', label: 'Solar Kekes' },
            { value: '20+', label: 'Campus Cabs' },
            { value: '24/7', label: 'Available' },
          ].map(stat => (
            <div key={stat.label}>
              <div style={{ fontSize: '28px', fontWeight: '900', color: '#F59E0B' }}>{stat.value}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '20px 24px 48px', maxWidth: '480px', margin: '0 auto' }}>
        <p style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '24px', textTransform: 'uppercase' }}>
          How it works
        </p>
        {[
          { icon: '📱', title: 'Create Account', desc: 'Sign up with your UNIBEN email in seconds' },
          { icon: '📍', title: 'Choose Your Pickup', desc: 'Select from campus landmarks — faculty, hostels, gates' },
          { icon: '⚡', title: 'Get Matched', desc: 'A nearby Keke or Cab accepts your ride instantly' },
          { icon: '💳', title: 'Pay via Wallet', desc: 'Top up once, ride multiple times — no cash needed' },
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
              backgroundColor: '#F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px'
            }}>{step.icon}</div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e1040', marginBottom: '3px' }}>{step.title}</div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>{step.desc}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ── BOTTOM CTA ── */}
      <section style={{
        padding: '40px 24px',
        background: 'linear-gradient(160deg, #faf8ff, #f3f0ff)',
        textAlign: 'center'
      }}>
        <h2 style={{ fontSize: '26px', fontWeight: '900', color: '#1e1040', marginBottom: '8px' }}>
          Ready to Ride?
        </h2>
        <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>
          Join thousands of UNIBEN students and staff already riding smart.
        </p>
        <button onClick={onGetRide} style={{
          padding: '16px 40px', borderRadius: '50px',
          background: 'linear-gradient(135deg, #5B21B6, #7C3AED)',
          color: '#fff', border: 'none',
          fontWeight: '800', fontSize: '16px',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(91,33,182,0.4)',
        }}>
          Get Started Free →
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        padding: '24px', textAlign: 'center',
        borderTop: '1px solid #f3f0ff',
        backgroundColor: '#fff'
      }}>
        <div style={{ fontWeight: '800', color: '#5B21B6', marginBottom: '4px' }}>UNIBEN Ride</div>
        <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
          © 2025 University of Benin Smart Transport Platform
        </div>
      </footer>

    </div>
  );
};
