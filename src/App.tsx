import React, { useState } from 'react';
import { USRideProvider, useUSRide } from './context/USRideContext';
import { RiderView } from './views/RiderView';
import { DriverView } from './views/DriverView';
import { AdminView } from './views/AdminView';
import { CustomModal } from './components/CustomModal';
import { 
  Smartphone, Shield, HelpCircle, Laptop, Landmark,
  Lightbulb, Zap, Info, Play
} from 'lucide-react';
import './styles/app.css';

const MainAppContent: React.FC = () => {
  const { activeView, setActiveView } = useUSRide();
  const [showDemoGuide, setShowDemoGuide] = useState(true);

  return (
    <div className="simulator-container">
      {/* Simulator Master Header */}
      <header className="simulator-header">
        <div className="brand-title">
          <div className="logo-badge">US</div>
          <div className="brand-text">
            <h1>USRide</h1>
            <span>Uniben Smart Ride Simulator</span>
          </div>
        </div>

        {/* Portals Toggle Bar */}
        <div className="simulator-controls">
          <button 
            className={`sim-btn ${activeView === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveView('simulator')}
          >
            <Laptop size={14} /> Split-Screen Sandbox
          </button>
          <button 
            className={`sim-btn ${activeView === 'rider' ? 'active' : ''}`}
            onClick={() => setActiveView('rider')}
          >
            <Smartphone size={14} /> Rider Phone View
          </button>
          <button 
            className={`sim-btn ${activeView === 'driver' ? 'active' : ''}`}
            onClick={() => setActiveView('driver')}
          >
            <Smartphone size={14} /> Driver Phone View
          </button>
          <button 
            className={`sim-btn ${activeView === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveView('admin')}
          >
            <Shield size={14} /> Administration Hub
          </button>
        </div>

        {/* Demo Guidelines Trigger */}
        <button 
          className="sim-btn" 
          onClick={() => setShowDemoGuide(!showDemoGuide)}
          style={{ borderColor: 'var(--uniben-gold)' }}
        >
          <HelpCircle size={14} style={{ color: 'var(--uniben-gold)' }} />
          {showDemoGuide ? 'Hide Instructions' : 'Demo Guide'}
        </button>
      </header>

      {/* Simulator Sandbox Body */}
      <main className="simulator-body">
        
        {/* Active View 1: Side-by-Side Dual Simulator */}
        {activeView === 'simulator' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
            
            {/* Top Quick Demo Instructions Panel */}
            {showDemoGuide && (
              <div style={{
                backgroundColor: 'rgba(6, 78, 59, 0.4)',
                borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
                padding: '12px 24px',
                fontSize: '11px',
                lineHeight: '1.5',
                color: '#a7f3d0',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                <Lightbulb size={24} style={{ color: 'var(--uniben-gold)', flexShrink: 0 }} />
                <div>
                  <strong>💡 QUICK SANDBOX GUIDE:</strong> Login on the <strong>Left (Rider App)</strong>, and login on the <strong>Right (Driver App)</strong> using <strong>DRV001 (USRide Solar Keke)</strong> or <strong>DRV004 (UCRide Campus Cab)</strong>. Set status to <strong>Online</strong>.
                  On the Rider App, choose your destination, select Keke or Cab, and click <strong>Book</strong>. The corresponding Driver App will receive the booking instantly! Accept it to watch the vehicle move on the map.
                </div>
                <button 
                  onClick={() => setShowDemoGuide(false)}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.6, fontSize: '14px', fontWeight: 'bold', marginLeft: 'auto' }}
                >
                  ✕
                </button>
              </div>
            )}

            <div className="viewports-wrapper">
              {/* Left Smartphone frame: Rider App */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  📱 Rider Application
                </div>
                <div className="phone-frame">
                  <div className="phone-notch">
                    <div className="phone-speaker"></div>
                  </div>
                  <RiderView />
                </div>
              </div>

              {/* Right Smartphone frame: Driver App */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  🛺 Driver application
                </div>
                <div className="phone-frame">
                  <div className="phone-notch">
                    <div className="phone-speaker"></div>
                  </div>
                  <DriverView />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active View 2: Standalone Rider view */}
        {activeView === 'rider' && (
          <div className="viewports-wrapper" style={{ padding: '40px 0' }}>
            <div className="phone-frame">
              <div className="phone-notch">
                <div className="phone-speaker"></div>
              </div>
              <RiderView />
            </div>
          </div>
        )}

        {/* Active View 3: Standalone Driver view */}
        {activeView === 'driver' && (
          <div className="viewports-wrapper" style={{ padding: '40px 0' }}>
            <div className="phone-frame">
              <div className="phone-notch">
                <div className="phone-speaker"></div>
              </div>
              <DriverView />
            </div>
          </div>
        )}

        {/* Active View 4: Desktop Administration dashboard */}
        {activeView === 'admin' && (
          <AdminView />
        )}

      </main>
    </div>
  );
};

function App() {
  return (
    <USRideProvider>
      <MainAppContent />
      <CustomModal />
    </USRideProvider>
  );
}

export default App;
