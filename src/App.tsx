import React, { useState } from 'react';
import { USRideProvider, useUSRide } from './context/USRideContext';
import { RiderView } from './views/RiderView';
import { DriverView } from './views/DriverView';
import { AdminView } from './views/AdminView';
import { LandingPage } from './views/LandingPage';
import { AuthView } from './views/AuthView';
import { CustomModal } from './components/CustomModal';
import './styles/app.css';

type AppScreen = 'landing' | 'auth-rider' | 'auth-driver' | 'admin';

const MainAppContent: React.FC = () => {
  const { currentRider, currentDriver, activeView, setActiveView } = useUSRide();
  const [screen, setScreen] = useState<AppScreen>('landing');

  // ── Logged-in as Rider ──────────────────────────────────────────────────
  if (currentRider) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8f7ff' }}>
        <RiderView />
      </div>
    );
  }

  // ── Logged-in as Driver ─────────────────────────────────────────────────
  if (currentDriver) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8f7ff' }}>
        <DriverView />
      </div>
    );
  }

  // ── Admin Portal (hidden — only accessible via logo tap) ────────────────
  if (activeView === 'admin' || screen === 'admin') {
    return <AdminView />;
  }

  // ── Auth Screens ────────────────────────────────────────────────────────
  if (screen === 'auth-rider') {
    return (
      <AuthView
        defaultRole="rider"
        onBack={() => setScreen('landing')}
      />
    );
  }

  if (screen === 'auth-driver') {
    return (
      <AuthView
        defaultRole="driver"
        onBack={() => setScreen('landing')}
      />
    );
  }

  // ── Landing Page (default) ──────────────────────────────────────────────
  return (
    <LandingPage
      onGetRide={() => setScreen('auth-rider')}
      onBeDriver={() => setScreen('auth-driver')}
      onAdminAccess={() => {
        setActiveView('admin');
        setScreen('admin');
      }}
    />
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
