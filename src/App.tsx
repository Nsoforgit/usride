import React, { useState } from 'react';
import { USRideProvider, useUSRide } from './context/USRideContext';
import { RiderView } from './views/RiderView';
import { DriverView } from './views/DriverView';
import { AdminView } from './views/AdminView';
import { LandingPage } from './views/LandingPage';
import { AuthView } from './views/AuthView';
import { CustomModal } from './components/CustomModal';
import { ConnectionToast } from './components/ConnectionToast';
import './styles/app.css';

type AppScreen = 'landing' | 'auth-rider' | 'auth-driver' | 'admin';

const MainAppContent: React.FC = () => {
  const { currentRider, currentDriver, activeView, setActiveView, realtimeStatus } = useUSRide();
  const [screen, setScreen] = useState<AppScreen>('landing');

  const toast = <ConnectionToast status={realtimeStatus} />;

  // ── Logged-in as Rider ──────────────────────────────────────────────────
  if (currentRider) {
    return (
      <>
        <div className="phone-screen">
          <RiderView />
        </div>
        {toast}
      </>
    );
  }

  // ── Logged-in as Driver ─────────────────────────────────────────────────
  if (currentDriver) {
    return (
      <>
        <div className="phone-screen">
          <DriverView />
        </div>
        {toast}
      </>
    );
  }

  // ── Admin Portal (hidden — only accessible via logo tap) ────────────────
  if (activeView === 'admin' || screen === 'admin') {
    return <>{<AdminView />}{toast}</>;
  }

  // ── Auth Screens ────────────────────────────────────────────────────────
  if (screen === 'auth-rider') {
    return (
      <>
        <AuthView
          defaultRole="rider"
          onBack={() => setScreen('landing')}
        />
        {toast}
      </>
    );
  }

  if (screen === 'auth-driver') {
    return (
      <>
        <AuthView
          defaultRole="driver"
          onBack={() => setScreen('landing')}
        />
        {toast}
      </>
    );
  }

  // ── Landing Page (default) ──────────────────────────────────────────────
  return (
    <>
      <LandingPage
        onGetRide={() => setScreen('auth-rider')}
        onBeDriver={() => setScreen('auth-driver')}
        onAdminAccess={() => {
          setActiveView('admin');
          setScreen('admin');
        }}
      />
      {toast}
    </>
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
