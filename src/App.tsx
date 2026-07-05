import React, { useState } from 'react';
import { USRideProvider, useUSRide } from './context/USRideContext';
import { RiderView } from './views/RiderView';
import { DriverView } from './views/DriverView';
import { AdminView } from './views/AdminView';
import { LandingPage } from './views/LandingPage';
import { AuthView } from './views/AuthView';
import { SplashScreen } from './components/SplashScreen';
import { CustomModal } from './components/CustomModal';
import { AnimatePresence, motion } from 'framer-motion';
import './styles/app.css';

type AppScreen = 'landing' | 'auth-rider' | 'auth-driver' | 'admin';

const MainAppContent: React.FC = () => {
  const { currentRider, currentDriver, activeView, setActiveView } = useUSRide();
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [showSplash, setShowSplash] = useState(true);

  return (
    <AnimatePresence mode="wait">
      {showSplash ? (
        <SplashScreen key="splash" onComplete={() => setShowSplash(false)} />
      ) : (
        <motion.div 
          key="main-app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{ width: '100%', height: '100%' }}
        >
          {(() => {
            // ── Logged-in as Rider ──────────────────────────────────────────────────
            if (currentRider) {
              return <RiderView />;
            }

            // ── Logged-in as Driver ─────────────────────────────────────────────────
            if (currentDriver) {
              return <DriverView />;
            }

            // ── Admin Portal (hidden — only accessible via logo tap) ────────────────
            if (activeView === 'admin' || screen === 'admin') {
              return <AdminView onExit={() => {
                setActiveView('rider');
                setScreen('landing');
              }} />;
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
          })()}
        </motion.div>
      )}
    </AnimatePresence>
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
