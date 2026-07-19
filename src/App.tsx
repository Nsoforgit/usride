import React, { useState, Suspense, lazy } from 'react';
import { USRideProvider, useUSRide } from './context/USRideContext';
import { SplashScreen } from './components/SplashScreen';
import { CustomModal } from './components/CustomModal';
import { AnimatePresence, motion } from 'framer-motion';
import './styles/app.css';

// ── Lazy-loaded heavy views (each becomes its own JS chunk) ─────────────────
// iOS will only download + parse the chunk when the user actually navigates there.
const RiderView  = lazy(() => import('./views/RiderView').then(m => ({ default: m.RiderView })));
const DriverView = lazy(() => import('./views/DriverView').then(m => ({ default: m.DriverView })));
const AdminView  = lazy(() => import('./views/AdminView').then(m => ({ default: m.AdminView })));
const LandingPage = lazy(() => import('./views/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthView   = lazy(() => import('./views/AuthView').then(m => ({ default: m.AuthView })));

// ── Minimal inline fallback shown while the view chunk is downloading ────────
const ViewLoadingFallback: React.FC = () => (
  <div style={{
    position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#0f0a2e',
    flexDirection: 'column', gap: '16px'
  }}>
    <div style={{
      width: '40px', height: '40px', borderRadius: '50%',
      border: '3px solid rgba(124,58,237,0.2)',
      borderTopColor: '#7c3aed',
      animation: 'spin 0.8s linear infinite'
    }} />
    <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>Loading…</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

type AppScreen = 'landing' | 'auth-rider' | 'auth-driver' | 'admin';

const MainAppContent: React.FC = () => {
  const { currentRider, currentDriver, activeView, setActiveView } = useUSRide();
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [showSplash, setShowSplash] = useState(true);

  // ── DEBUGGING SCRIPT (EASY TO REMOVE) ──────────────────────────────────────
  React.useEffect(() => {
    // 1. On map click: snapshot scrollY BEFORE and AFTER (in next frame)
    const handleMapClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.leaflet-container')) {
        const scrollBefore = window.scrollY;
        // Check again after browser has had a chance to auto-scroll
        requestAnimationFrame(() => {
          const scrollAfter = window.scrollY;
          alert(
            `[DEBUG] Map clicked!\n` +
            `scrollY BEFORE click: ${scrollBefore}px\n` +
            `scrollY AFTER click:  ${scrollAfter}px\n` +
            `(If these differ, the browser is scrolling the page when you tap the map)`
          );
        });
      }
    };
    document.addEventListener('click', handleMapClick, true);
    document.addEventListener('touchstart', handleMapClick, true);

    // 2. IntersectionObserver: alert when navbar leaves or enters the viewport
    let intersectionObserver: IntersectionObserver | null = null;
    const initIntersection = () => {
      const navbar = document.querySelector('.phone-navbar');
      if (!navbar) {
        setTimeout(initIntersection, 200);
        return;
      }
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const scrollY = window.scrollY;
            if (!entry.isIntersecting) {
              alert(
                `[DEBUG] Navbar LEFT the viewport!\n` +
                `window.scrollY = ${scrollY}px\n` +
                `navbar top edge = ${Math.round(entry.boundingClientRect.top)}px\n` +
                `(Positive scrollY means the page has scrolled down, pushing navbar up off-screen)`
              );
            } else {
              alert(
                `[DEBUG] Navbar RETURNED to viewport.\n` +
                `window.scrollY = ${scrollY}px`
              );
            }
          });
        },
        { threshold: 0.1 }
      );
      intersectionObserver.observe(navbar);
    };
    initIntersection();

    // Clean up on unmount
    return () => {
      document.removeEventListener('click', handleMapClick, true);
      document.removeEventListener('touchstart', handleMapClick, true);
      if (intersectionObserver) intersectionObserver.disconnect();
    };
  }, []);
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence mode="wait">
      {showSplash ? (
        <SplashScreen key="splash" onComplete={() => setShowSplash(false)} />
      ) : (
        <motion.div 
          key="main-app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{ width: '100%', height: '100%' }}
        >
          <Suspense fallback={<ViewLoadingFallback />}>
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
          </Suspense>
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
