import React, { useState } from 'react';
import { useUSRide, LANDMARKS, Driver, Keke, Landmark, PRELOADED_DRIVER_IDS, PRELOADED_RIDER_IDS } from '../context/USRideContext';
import { UnibenMap } from '../components/UnibenMap';
import { 
  Users, MapPin, Zap, BarChart2, ShieldCheck, Plus, Trash2, 
  Battery, Play, Info, Check, LogIn, ShieldAlert, CreditCard, LogOut, RefreshCw, Download, Eye, EyeOff, Lock
} from 'lucide-react';

interface AdminViewProps {
  onExit: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onExit }) => {
  const {
    riders,
    drivers,
    kekes,
    trips,
    transactions,
    adminRegisterDriver,
    safetyIncidents,
    adminAuditLogs,
    logAdminAction,
    showModal,
    resetSimulatorDatabase,
    clearDriverFloatingBalances,
    refreshLiveDashboardData
  } = useUSRide();

  // Authentication — defaults to false to request password
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Sub-tabs
  const [adminTab, setAdminTab] = useState<'fleet' | 'drivers' | 'riders' | 'reports' | 'ledger'>('fleet');

  // Data Filter: Separate Real Pilot Data from Preloaded Demo Fleet
  const [dataFilterMode, setDataFilterMode] = useState<'all' | 'pilot-only'>('all');

  // Phone number privacy masking: track revealed phone IDs
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({});

  const maskPhoneNumber = (phone?: string) => {
    if (!phone) return 'N/A';
    const clean = phone.trim();
    if (clean.length < 7) return '***';
    return `${clean.slice(0, 4)}***${clean.slice(-4)}`;
  };

  const toggleRevealPhone = (key: string, label: string, phone?: string) => {
    if (!phone) return;
    const willReveal = !revealedPhones[key];
    setRevealedPhones(prev => ({ ...prev, [key]: willReveal }));
    if (willReveal) {
      logAdminAction('REVEAL_PHONE', `Admin revealed masked phone number for ${label}`);
    }
  };

  // Register driver form state
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverCode, setNewDriverCode] = useState('');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverKekeId, setNewDriverKekeId] = useState('');
  const [newDriverVehicleType, setNewDriverVehicleType] = useState<'keke' | 'cab'>('keke');
  const [newDriverPlateNumber, setNewDriverPlateNumber] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverPhoto, setNewDriverPhoto] = useState('');
  const [newDriverPassword, setNewDriverPassword] = useState('');
  const [isSyncingLive, setIsSyncingLive] = useState(false);


  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'admin123') {
      setIsAdminLoggedIn(true);
      logAdminAction('ADMIN_LOGIN', 'Administrator signed in to USRide Admin console');
    } else {
      logAdminAction('ADMIN_LOGIN_FAILED', 'Failed administrator password attempt');
      showModal({
        title: "Access Denied",
        message: "Invalid administrator password! (Hint: use admin123)",
        type: 'error'
      });
    }
  };

  const handleRegisterDriver = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check validation based on type
    if (newDriverVehicleType === 'keke') {
      if (!newDriverName || !newDriverCode || !newDriverEmail || !newDriverKekeId) {
        showModal({
          title: "Missing Fields",
          message: "Please fill in all driver registry onboarding fields.",
          type: 'warning'
        });
        return;
      }
    } else {
      if (!newDriverName || !newDriverCode || !newDriverEmail || !newDriverPlateNumber) {
        showModal({
          title: "Missing Fields",
          message: "Please fill in all fields, including the cab licence plate number.",
          type: 'warning'
        });
        return;
      }
    }

    if (drivers.some(d => d.driverIdCode.toUpperCase() === newDriverCode.toUpperCase())) {
      showModal({
        title: "Code Conflict",
        message: "This Driver Code already exists in the system registry.",
        type: 'error'
      });
      return;
    }

    const valueOrPlate = newDriverVehicleType === 'keke' ? newDriverKekeId : newDriverPlateNumber;
    adminRegisterDriver(newDriverName, newDriverEmail, newDriverCode, newDriverVehicleType, valueOrPlate, newDriverPhone, newDriverPhoto, newDriverPassword);

    showModal({
      title: "Driver Onboarded",
      message: `Driver ${newDriverName} (${newDriverCode.toUpperCase()}) registered and assigned successfully to the fleet.`,
      type: 'success'
    });

    setNewDriverName('');
    setNewDriverCode('');
    setNewDriverEmail('');
    setNewDriverKekeId('');
    setNewDriverPlateNumber('');
    setNewDriverPhone('');
    setNewDriverPhoto('');
    setNewDriverPassword('');
  };

  // Filter out vehicles that don't have driver assigned based on type
  const unassignedVehicles = kekes.filter(k => k.driverId === null && k.vehicleType === newDriverVehicleType);

  // Stats Calculations (Live & Accurate)
  const completedTripsList = trips.filter(t => t.status === 'completed');
  const totalTripsCompleted = completedTripsList.length;
  const totalEnergyDrained = completedTripsList.reduce((acc, t) => acc + (t.energyUsedPercent || 0), 0);

  const activeRides = trips.filter(t => t.status === 'accepted' || t.status === 'active').length;

  const totalRiderTopUps = transactions
    .filter(t => t.userType === 'rider' && t.type === 'credit')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalRiderWalletPool = riders.reduce((acc, r) => acc + r.walletBalance, 0);
  const totalDriverWalletPool = drivers.reduce((acc, d) => acc + d.walletBalance, 0);

  // Platform Service Fee: ₦10 per seat for shared, ₦50 for full-ride drop
  const totalPlatformServiceFee = completedTripsList.reduce(
    (acc, t) => acc + (t.transferFee ?? (t.rideType === 'drop' ? 50 : 10 * (t.seatsBooked || 1))),
    0
  );
  // 100% of seat/drop ride fares go to the School Ledger (and are credited to drivers to be paid out by the school)
  const totalGrossRideFares = completedTripsList.reduce((acc, t) => acc + (t.totalFare || 0), 0);
  const totalDriverWithdrawals = transactions
    .filter(t => t.userType === 'driver' && t.type === 'withdrawal')
    .reduce((acc, t) => acc + t.amount, 0);

  // Ledger Reconciliation Equation:
  // Money In = School Share + Driver Pool + Platform Fee + Gateway Costs + Wallet Float
  // Note: Top-ups are capped at ₦2,000 so Paystack's ₦100 flat fee is waived (₦0).
  const totalDriverPool = totalDriverWalletPool + totalDriverWithdrawals;
  const totalGatewayCosts = 0; // Waived under ₦2,000 top-up cap & daily school batch settlement
  const totalMoneyIn = Math.max(
    totalRiderTopUps,
    totalGrossRideFares + totalPlatformServiceFee + totalRiderWalletPool
  );
  // School Share (retained in university ledger before/after driver disbursements)
  const totalSchoolShare = Math.max(
    0,
    totalMoneyIn - (totalDriverPool + totalPlatformServiceFee + totalGatewayCosts + totalRiderWalletPool)
  );
  const ledgerAllocatedSum = totalSchoolShare + totalDriverPool + totalPlatformServiceFee + totalGatewayCosts + totalRiderWalletPool;
  const ledgerVariance = totalMoneyIn - ledgerAllocatedSum;

  const handleExportLedgerCSV = () => {
    const nowStr = new Date().toISOString();
    const lines: string[] = [
      'USRIDE FINANCIAL LEDGER & RECONCILIATION EXPORT ("WHERE EVERY NAIRA WENT")',
      `Generated At,${nowStr}`,
      'Settlement Policy,Top-ups capped at NGN 2000 (Paystack NGN 100 flat fee waived); settled to school in one daily batch',
      '',
      'SECTION 1: LEDGER BALANCE EQUATION (Money In = School Share + Driver Pool + Platform Fee + Gateway Costs + Wallet Float)',
      'Bucket,Amount (NGN),Notes',
      `Money In (Total Funded),${totalMoneyIn.toFixed(2)},Total verified rider wallet funding`,
      `100% Seat Fare to School Ledger (Gross),${totalGrossRideFares.toFixed(2)},100% of completed ride fares (NGN 100/seat or NGN 500/drop) settled to school ledger`,
      `School Net Ledger Share,${totalSchoolShare.toFixed(2)},University ledger balance net of driver pool credits`,
      `Driver Pool (Earnings credited - paid out by the school),${totalDriverPool.toFixed(2)},Credited: NGN ${totalDriverWalletPool.toFixed(2)} | Disbursed: NGN ${totalDriverWithdrawals.toFixed(2)}`,
      `Platform Service Fee (NGN 10/seat | NGN 50/drop),${totalPlatformServiceFee.toFixed(2)},Flat service fee paid by riders on top of fare`,
      `Gateway Costs (Paystack),${totalGatewayCosts.toFixed(2)},NGN 100 flat fee waived via NGN 2000 top-up cap`,
      `Rider Wallet Float (Unspent Balance),${totalRiderWalletPool.toFixed(2)},Active wallet balance across ${riders.length} registered riders`,
      `Ledger Variance (Must be 0.00),${ledgerVariance.toFixed(2)},${ledgerVariance === 0 ? 'BALANCED' : 'CHECK'}`,
      '',
      'SECTION 2: COMPLETED TRIPS BREAKDOWN',
      'Trip ID,Completed At,Vehicle Type,Ride Type,Seats,Pickup,Destination,Fare to School Ledger (NGN),Platform Service Fee (NGN),Total Rider Paid (NGN),Driver ID',
      ...completedTripsList.map(t => {
        const fee = t.transferFee ?? (t.rideType === 'drop' ? 50 : 10 * (t.seatsBooked || 1));
        return `${t.id},${t.completedAt || t.createdAt},${t.vehicleType},${t.rideType},${t.seatsBooked || 1},"${t.pickupLandmark}","${t.destinationLandmark}",${t.totalFare},${fee},${t.totalFare + fee},${t.driverId || 'N/A'}`;
      }),
      '',
      'SECTION 3: WALLET & SETTLEMENT TRANSACTIONS',
      'Transaction ID,Timestamp,User Type,User ID,Type,Amount (NGN),Reference,Description',
      ...transactions.map(tx => `${tx.id},${tx.createdAt},${tx.userType},${tx.userId},${tx.type},${tx.amount},${tx.reference},"${(tx.description || '').replace(/"/g, '""')}"`)
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `usride-naira-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Separate Real Pilot vs Preloaded Demo Accounts
  const isPilotDriver = (d: Driver) =>
    !PRELOADED_DRIVER_IDS.has(d.id) || d.totalTrips > 0 || d.walletBalance > 0;
  const isPilotRider = (r: { id: string; totalTrips: number; walletBalance: number }) =>
    !PRELOADED_RIDER_IDS.has(r.id) || r.totalTrips > 0 || r.walletBalance > 0;

  const pilotDriversCount = drivers.filter(isPilotDriver).length;
  const preloadedDriversCount = drivers.length - pilotDriversCount;
  const pilotRidersCount = riders.filter(isPilotRider).length;
  const preloadedRidersCount = riders.length - pilotRidersCount;

  const displayedDrivers = dataFilterMode === 'pilot-only' ? drivers.filter(isPilotDriver) : drivers;
  const displayedRiders = dataFilterMode === 'pilot-only' ? riders.filter(isPilotRider) : riders;

  const completedKekeTrips = completedTripsList.filter(t => t.vehicleType === 'keke').length;
  const completedCabTrips = completedTripsList.filter(t => t.vehicleType === 'cab').length;
  const kekeFleet = kekes.filter(k => k.vehicleType === 'keke');
  const avgKekeBattery = kekeFleet.length > 0
    ? Math.round(kekeFleet.reduce((acc, k) => acc + k.currentBatteryPercent, 0) / kekeFleet.length)
    : 100;

  if (!isAdminLoggedIn) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', padding: '20px' }}>
        <form onSubmit={handleAdminLogin} className="glass-panel-dark" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px', padding: '30px' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="logo-badge" style={{ margin: '0 auto 10px auto' }}>AD</div>
            <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Admin Dashboard</h2>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>USRide University Administration</span>
          </div>

          <div>
            <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8' }}>Admin Password</label>
            <input 
              type="password" 
              className="landmark-select-item" 
              style={{ width: '100%', outline: 'none', border: '1px solid #475569', marginTop: '4px', color: '#0f172a' }} 
              placeholder="Enter admin password (admin123)"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
          </div>

          <button className="primary-btn" type="submit">
            <LogIn size={16} /> Sign In as Admin
          </button>

          <button 
            className="secondary-btn" 
            type="button" 
            onClick={onExit} 
            style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
          >
            Cancel &amp; Go Back
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      {/* Tab controls */}
      <div className="admin-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '15px', marginBottom: '25px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck style={{ color: 'var(--uniben-gold)' }} />
            USRide Admin
          </h2>
          <span style={{ fontSize: '11px', color: '#64748b' }}>University of Benin Smart Solar Fleet Management · {pilotDriversCount} Live Pilot Driver(s) · {pilotRidersCount} Live Pilot Rider(s)</span>
        </div>

        <div className="admin-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="simulator-controls">
            <button 
              className={`sim-btn ${adminTab === 'fleet' ? 'active' : ''}`}
              onClick={() => setAdminTab('fleet')}
            >
              <MapPin size={14} /> Fleet Map
            </button>
            <button 
              className={`sim-btn ${adminTab === 'drivers' ? 'active' : ''}`}
              onClick={() => setAdminTab('drivers')}
            >
              <Users size={14} /> Drivers Registry
            </button>
            <button 
              className={`sim-btn ${adminTab === 'riders' ? 'active' : ''}`}
              onClick={() => setAdminTab('riders')}
            >
              <Users size={14} /> Riders Directory
            </button>
            <button 
              className={`sim-btn ${adminTab === 'reports' ? 'active' : ''}`}
              onClick={() => setAdminTab('reports')}
            >
              <BarChart2 size={14} /> Analytics &amp; Reports
            </button>
            <button 
              className={`sim-btn ${adminTab === 'ledger' ? 'active' : ''}`}
              onClick={() => setAdminTab('ledger')}
            >
              <CreditCard size={14} /> Where Every Naira Went
            </button>
          </div>
          <button
            onClick={async () => {
              setIsSyncingLive(true);
              await refreshLiveDashboardData();
              setIsSyncingLive(false);
              showModal({
                title: '✅ Live Data Synchronized',
                message: 'Driver registry, rider balances, and analytical reports have been refreshed from the live Supabase database.',
                type: 'success',
              });
            }}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(16,185,129,0.4)',
              backgroundColor: 'rgba(16,185,129,0.12)',
              color: '#34d399',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s'
            }}
            title="Sync all tables and reports with live database"
          >
            <RefreshCw size={13} className={isSyncingLive ? 'spin' : ''} /> {isSyncingLive ? 'Syncing...' : 'Sync Live Data'}
          </button>

          <button
            onClick={() => {
              const nextMode = dataFilterMode === 'all' ? 'pilot-only' : 'all';
              setDataFilterMode(nextMode);
              logAdminAction('FILTER_DATA_MODE', `Switched admin view to ${nextMode === 'pilot-only' ? 'Live Pilot Data Only' : 'All Records (Pilot + Preloaded Demo)'}`);
            }}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: `1px solid ${dataFilterMode === 'pilot-only' ? 'rgba(56,189,248,0.6)' : 'rgba(148,163,184,0.3)'}`,
              backgroundColor: dataFilterMode === 'pilot-only' ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.05)',
              color: dataFilterMode === 'pilot-only' ? '#38bdf8' : '#cbd5e1',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Toggle between Live Pilot Records Only vs All Records (including preloaded fleet)"
          >
            {dataFilterMode === 'pilot-only' ? '🟢 Showing: Live Pilot Only' : '📊 Filter: Live Pilot Only'}
          </button>

          <button
            onClick={() => showModal({
              title: '🔒 Protected Admin Action: Clear Driver Float',
              message: 'Protected Action: To zero out all drivers\' floating wallet balances while keeping riders\' real wallet balances untouched, type CONFIRM below:',
              type: 'security',
              inputPlaceholder: 'Type CONFIRM to proceed...',
              onInputSubmit: (val) => {
                if (val.trim().toUpperCase() !== 'CONFIRM') {
                  logAdminAction('CLEAR_DRIVER_FLOAT_BLOCKED', 'Admin confirmation text did not match CONFIRM');
                  showModal({
                    title: 'Action Cancelled',
                    message: 'You must type CONFIRM in uppercase to execute this protected database operation.',
                    type: 'error'
                  });
                  return;
                }
                clearDriverFloatingBalances();
              }
            })}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(251,191,36,0.4)',
              backgroundColor: 'rgba(251,191,36,0.12)',
              color: '#fbbf24',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s'
            }}
            title="Protected: Requires typing CONFIRM to zero out floating driver wallet balances"
          >
            <Lock size={12} /> Clear Driver Float
          </button>

          <button
            onClick={() => showModal({
              title: '🔒 Protected Admin Action: Reset Database',
              message: 'WARNING: This resets local simulator state to factory defaults. This action is locked behind admin confirmation. Type CONFIRM below to proceed:',
              type: 'security',
              inputPlaceholder: 'Type CONFIRM to reset database...',
              onInputSubmit: (val) => {
                if (val.trim().toUpperCase() !== 'CONFIRM') {
                  logAdminAction('RESET_DATABASE_BLOCKED', 'Admin confirmation text did not match CONFIRM');
                  showModal({
                    title: 'Reset Blocked',
                    message: 'Database reset aborted. You must type CONFIRM to execute a reset.',
                    type: 'error'
                  });
                  return;
                }
                resetSimulatorDatabase();
              }
            })}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(239,68,68,0.4)',
              backgroundColor: 'rgba(239,68,68,0.12)',
              color: '#f87171',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Protected Reset Database (Requires typing CONFIRM)"
          >
            <Lock size={12} /> Reset DB
          </button>

          <button
            onClick={onExit}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              color: '#cbd5e1',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s'
            }}
            title="Return to user landing page"
          >
            <LogOut size={13} /> Exit Admin
          </button>
        </div>
      </div>

      {/* ADMIN VIEW 1: FLEET OVERVIEW MAP */}
      {adminTab === 'fleet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
          
          {/* Real-time stats grid */}
          <div className="admin-grid">
            <div className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Fleet Breakdown (Pilot vs Preloaded)</h3>
                <div className="admin-stat" style={{ fontSize: '15px', marginTop: '6px' }}>
                  {kekes.length} Vehicles ({kekes.filter(k => k.vehicleType === 'keke').length} USRide Kekes · {kekes.filter(k => k.vehicleType === 'cab').length} USRide Cabs)
                </div>
                <span style={{ fontSize: '10px', color: '#34d399', fontWeight: '700' }}>
                  🟢 {pilotDriversCount} Live Pilot Driver(s) · 📦 {preloadedDriversCount} Preloaded Demo Fleet
                </span>
              </div>
              <Zap size={32} style={{ color: 'var(--uniben-gold)' }} />
            </div>
            
            <div className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Active Online</h3>
                <div className="admin-stat" style={{ fontSize: '15px', marginTop: '6px' }}>
                  {kekes.filter(k => k.isOnline && k.vehicleType === 'keke').length} USRide Kekes · {kekes.filter(k => k.isOnline && k.vehicleType === 'cab').length} USRide Cabs
                </div>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                  20% battery reserve guard active (~1%/km field rate)
                </span>
              </div>
              <Check size={32} style={{ color: '#10b981' }} />
            </div>

            <div className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Live Pilot &amp; Trip Activity</h3>
                <div className="admin-stat" style={{ fontSize: '15px', marginTop: '6px' }}>{activeRides} Active · {totalTripsCompleted} Completed</div>
                <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '700' }}>
                  🟢 {pilotRidersCount} Live Pilot Rider(s) · 📦 {preloadedRidersCount} Preloaded Demo Rider(s)
                </span>
              </div>
              <Play size={32} style={{ color: '#3b82f6' }} />
            </div>
          </div>

          {/* Large Map Panel */}
          <div style={{ flex: 1, minHeight: '400px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
            <UnibenMap showLandmarks={true} />
          </div>
        </div>
      )}

      {/* ADMIN VIEW 2: REGISTER & MANAGE DRIVERS */}
      {adminTab === 'drivers' && (
        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
          
          {/* Onboard Driver Form */}
          <div className="admin-card" style={{ flex: 1, minWidth: '320px', backgroundColor: '#1e293b' }}>
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '15px' }}>
              Onboard New Driver
            </h3>
            
            <form onSubmit={handleRegisterDriver} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Driver Name</label>
                <input 
                  type="text" 
                  className="landmark-select-item" 
                  style={{ width: '100%', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }} 
                  placeholder="Sunday Ibrahim"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Driver Code</label>
                <input 
                  type="text" 
                  className="landmark-select-item" 
                  style={{ width: '100%', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }} 
                  placeholder="DRV004"
                  value={newDriverCode}
                  onChange={(e) => setNewDriverCode(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Email Address</label>
                <input 
                  type="email" 
                  className="landmark-select-item" 
                  style={{ width: '100%', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }} 
                  placeholder="driver@usride.uniben.edu"
                  value={newDriverEmail}
                  onChange={(e) => setNewDriverEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Vehicle Brand / Type</label>
                <select 
                  className="landmark-select-item" 
                  style={{ width: '100%', color: '#1e293b', border: '1px solid #475569', marginTop: '4px', height: '40px' }}
                  value={newDriverVehicleType}
                  onChange={(e) => {
                    setNewDriverVehicleType(e.target.value as 'keke' | 'cab');
                    setNewDriverKekeId(''); // reset selected vehicle
                    setNewDriverPlateNumber(''); // reset custom plate
                  }}
                  required
                >
                  <option value="keke">USRide (Solar Keke)</option>
                  <option value="cab">USRide (Campus Cab)</option>
                </select>
              </div>

              {newDriverVehicleType === 'keke' ? (
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Assign Solar Tricycle (Keke)</label>
                  <select 
                    className="landmark-select-item" 
                    style={{ width: '100%', color: '#1e293b', border: '1px solid #475569', marginTop: '4px', height: '40px' }}
                    value={newDriverKekeId}
                    onChange={(e) => setNewDriverKekeId(e.target.value)}
                    required
                  >
                    <option value="">Select unassigned tricycle...</option>
                    {unassignedVehicles.map(k => (
                      <option key={k.id} value={k.id}>Keke {k.id} ({k.plateNumber})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Cab Plate Number</label>
                  <input 
                    type="text" 
                    className="landmark-select-item" 
                    style={{ width: '100%', color: '#1e293b', border: '1px solid #475569', marginTop: '4px', padding: '10px' }} 
                    placeholder="e.g. UNIBEN-38C"
                    value={newDriverPlateNumber}
                    onChange={(e) => setNewDriverPlateNumber(e.target.value)}
                    required
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Phone Number (Optional)</label>
                <input 
                  type="tel" 
                  className="landmark-select-item" 
                  style={{ width: '100%', color: '#1e293b', border: '1px solid #475569', marginTop: '4px', padding: '10px' }} 
                  placeholder="e.g. 08039991111"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Profile Photo URL (Optional — defaults to USRide Branded Initials)</label>
                <input 
                  type="text" 
                  className="landmark-select-item" 
                  style={{ width: '100%', color: '#1e293b', border: '1px solid #475569', marginTop: '4px', padding: '10px' }} 
                  placeholder="Leave blank for automatic USRide initials avatar"
                  value={newDriverPhoto}
                  onChange={(e) => setNewDriverPhoto(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Driver Login Password / PIN (Optional)</label>
                <input 
                  type="password" 
                  className="landmark-select-item" 
                  style={{ width: '100%', color: '#1e293b', border: '1px solid #475569', marginTop: '4px', padding: '10px' }} 
                  placeholder="Min 4 chars (or driver sets on first login)"
                  value={newDriverPassword}
                  onChange={(e) => setNewDriverPassword(e.target.value)}
                />
              </div>

              <button className="gold-btn" type="submit" style={{ marginTop: '10px' }}>
                <Plus size={16} /> Onboard Driver
              </button>
            </form>
          </div>

          {/* Driver List */}
          <div className="admin-card" style={{ flex: 2, minWidth: '280px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0 }}>
                  Drivers Registry ({displayedDrivers.length} Shown · {pilotDriversCount} Live Pilot / {preloadedDriversCount} Preloaded Demo)
                </h3>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Phone numbers masked by default (click eye icon to reveal &amp; log) · Earnings credited, paid out by the school: <strong style={{ color: '#38bdf8' }}>₦{totalDriverWalletPool.toLocaleString()}</strong>
                </span>
              </div>
              {totalDriverWalletPool > 0 && (
                <button
                  onClick={() => showModal({
                    title: '🔒 Protected Admin Action: Zero All Driver Wallets',
                    message: 'Type CONFIRM to zero out all driver wallet balances:',
                    type: 'security',
                    inputPlaceholder: 'Type CONFIRM to proceed...',
                    onInputSubmit: (val) => {
                      if (val.trim().toUpperCase() === 'CONFIRM') {
                        clearDriverFloatingBalances();
                      }
                    }
                  })}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(251,191,36,0.4)',
                    backgroundColor: 'rgba(251,191,36,0.12)',
                    color: '#fbbf24',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🔒 Zero All Driver Wallets
                </button>
              )}
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-list-table">
                <thead>
                  <tr>
                    <th>Driver Code</th>
                    <th>Data Source</th>
                    <th>Photo</th>
                    <th>Name</th>
                    <th>Phone (Masked)</th>
                    <th>Vehicle Assigned</th>
                    <th>Trips Done</th>
                    <th>Earnings credited, paid out by the school</th>
                    <th>Rating</th>
                    <th>Status / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDrivers.map(d => {
                    const v = kekes.find(k => k.id === d.kekeId);
                    const pilot = isPilotDriver(d);
                    const phoneKey = `drv-${d.id}`;
                    const isPhoneRevealed = !!revealedPhones[phoneKey];
                    return (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 'bold', color: 'var(--uniben-gold)' }}>{d.driverIdCode}</td>
                        <td>
                          <span style={{
                            padding: '2px 7px',
                            borderRadius: '8px',
                            fontSize: '9px',
                            fontWeight: '800',
                            backgroundColor: pilot ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.15)',
                            color: pilot ? '#34d399' : '#94a3b8',
                            border: `1px solid ${pilot ? 'rgba(16,185,129,0.4)' : 'rgba(148,163,184,0.3)'}`
                          }}>
                            {pilot ? '🟢 LIVE PILOT' : '📦 PRELOADED'}
                          </span>
                        </td>
                        <td>
                          <img 
                            src={d.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=064e3b&color=fff&bold=true`} 
                            alt={d.name}
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 'bold', color: 'white' }}>{d.name}</div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>{d.email}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: isPhoneRevealed ? 'var(--uniben-gold)' : '#94a3b8', fontFamily: 'monospace', fontSize: '11px' }}>
                              {isPhoneRevealed ? (d.phoneNumber || 'N/A') : maskPhoneNumber(d.phoneNumber)}
                            </span>
                            {d.phoneNumber && (
                              <button
                                type="button"
                                onClick={() => toggleRevealPhone(phoneKey, `Driver ${d.name} (${d.driverIdCode})`, d.phoneNumber)}
                                style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                title={isPhoneRevealed ? 'Hide phone number' : 'Reveal phone number (logged in audit trail)'}
                              >
                                {isPhoneRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{ 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '9px', 
                            marginRight: '6px',
                            backgroundColor: d.vehicleType === 'keke' ? '#065f46' : '#1e40af',
                            color: 'white',
                            fontWeight: 'bold'
                          }}>
                            {d.vehicleType === 'keke' ? 'USRide Keke' : 'USRide Cab'}
                          </span>
                          #{d.kekeId} ({v?.plateNumber || '...'})
                        </td>
                        <td style={{ fontWeight: '600', color: '#cbd5e1' }}>{d.totalTrips || 0}</td>
                        <td style={{ fontWeight: '700', color: d.walletBalance > 0 ? '#38bdf8' : '#94a3b8' }}>
                          ₦{d.walletBalance.toLocaleString()}
                        </td>
                        <td>★ {d.averageRating}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              backgroundColor: d.isActive ? '#065f46' : '#991b1b',
                              color: '#fff'
                            }}>
                              {d.isActive ? 'Active' : 'Suspended'}
                            </span>
                            {(d.walletBalance > 0 || d.totalTrips > 0) && (
                              <button
                                onClick={() => clearDriverFloatingBalances(d.id)}
                                style={{
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(239,68,68,0.4)',
                                  backgroundColor: 'rgba(239,68,68,0.12)',
                                  color: '#f87171',
                                  fontSize: '9px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                                title="Clear floating balance for this driver"
                              >
                                Zero
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ADMIN VIEW 3: MANAGE RIDERS */}
      {adminTab === 'riders' && (
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '15px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0 }}>
                Riders Directory ({displayedRiders.length} Shown · {pilotRidersCount} Live Pilot / {preloadedRidersCount} Preloaded Demo)
              </h3>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Phone numbers are masked by default for rider privacy. Click the eye icon to reveal (action is recorded in Admin Audit Log).
              </span>
            </div>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-list-table">
              <thead>
                <tr>
                  <th>Rider ID</th>
                  <th>Data Source</th>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Phone (Masked)</th>
                  <th>Email</th>
                  <th>User Role</th>
                  <th>Wallet Balance</th>
                  <th>Trips Completed</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {displayedRiders.map(r => {
                  const pilot = isPilotRider(r);
                  const phoneKey = `rdr-${r.id}`;
                  const isPhoneRevealed = !!revealedPhones[phoneKey];
                  return (
                    <tr key={r.id}>
                      <td>{r.id.toUpperCase()}</td>
                      <td>
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: '8px',
                          fontSize: '9px',
                          fontWeight: '800',
                          backgroundColor: pilot ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.15)',
                          color: pilot ? '#34d399' : '#94a3b8',
                          border: `1px solid ${pilot ? 'rgba(16,185,129,0.4)' : 'rgba(148,163,184,0.3)'}`
                        }}>
                          {pilot ? '🟢 LIVE PILOT' : '📦 PRELOADED'}
                        </span>
                      </td>
                      <td>
                        <img 
                          src={r.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=047857&color=fff&bold=true`} 
                          alt={r.name}
                          style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                      </td>
                      <td style={{ fontWeight: 'bold', color: 'white' }}>{r.name}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: isPhoneRevealed ? 'var(--uniben-gold)' : '#94a3b8', fontFamily: 'monospace', fontSize: '11px' }}>
                            {isPhoneRevealed ? r.phoneNumber : maskPhoneNumber(r.phoneNumber)}
                          </span>
                          {r.phoneNumber && (
                            <button
                              type="button"
                              onClick={() => toggleRevealPhone(phoneKey, `Rider ${r.name} (${r.email})`, r.phoneNumber)}
                              style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                              title={isPhoneRevealed ? 'Hide phone number' : 'Reveal phone number (logged in audit trail)'}
                            >
                              {isPhoneRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td>{r.email}</td>
                      <td style={{ textTransform: 'capitalize' }}>{r.role}</td>
                      <td style={{ color: 'var(--uniben-green-light)', fontWeight: 'bold' }}>₦{r.walletBalance.toLocaleString()}</td>
                      <td>{r.totalTrips}</td>
                      <td>★ {r.averageRating}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADMIN VIEW 4: ANALYTICS & ENERGY REPORTS */}
      {adminTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Energy & Financial metrics overview cards */}
          <div className="admin-grid">
            <div className="admin-card">
              <h3>Total Ride Volume</h3>
              <div className="admin-stat">{totalTripsCompleted} Trips Completed</div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                {completedKekeTrips} USRide (Keke) · {completedCabTrips} UCRide (Cab) · Gross Fares: ₦{totalGrossRideFares.toLocaleString()}
              </span>
            </div>

            <div className="admin-card">
              <h3>Avg USRide Battery (Calibrated est.)</h3>
              <div className="admin-stat">
                {avgKekeBattery}%
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                ~1%/km field rate · 20% reserve floor · Drained: {totalEnergyDrained.toFixed(1)}%
              </span>
            </div>

            <div className="admin-card">
              <h3>School Ledger (100% Seat Fare)</h3>
              <div className="admin-stat" style={{ color: 'var(--uniben-gold)' }}>
                ₦{totalGrossRideFares.toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                100% of ₦100 seat / ₦500 drop fares settled in daily batch · Platform Service Fee (₦10/seat): <strong>₦{totalPlatformServiceFee.toLocaleString()}</strong>
              </span>
            </div>
          </div>

          {/* Digital Inflow & Rider wallet pools */}
          <div className="admin-grid">
            <div className="admin-card">
              <h3>Rider Digital Top-Ups (≤ ₦2,000 Cap)</h3>
              <div className="admin-stat" style={{ color: 'var(--uniben-gold)' }}>
                ₦{totalRiderTopUps.toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Paystack ₦100 fee waived under ₦2,000 top-up cap</span>
            </div>

            <div className="admin-card">
              <h3>Rider Wallet Float</h3>
              <div className="admin-stat" style={{ color: 'var(--uniben-green-light)' }}>
                ₦{totalRiderWalletPool.toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                Active balance across {riders.filter(r => r.walletBalance > 0).length} funded rider(s)
              </span>
            </div>

            <div className="admin-card">
              <h3>Earnings credited, paid out by the school</h3>
              <div className="admin-stat" style={{ color: '#38bdf8' }}>
                ₦{totalDriverWalletPool.toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                Credited driver earnings · Paid out to bank: ₦{totalDriverWithdrawals.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Quick link to Where Every Naira Went + CSV Export */}
          <div className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <div>
              <h3 style={{ color: '#34d399', margin: 0, fontSize: '14px' }}>
                ⚖️ Balanced Naira Ledger: Money In (₦{totalMoneyIn.toLocaleString()}) = School Share (₦{totalSchoolShare.toLocaleString()}) + Driver Pool (₦{totalDriverPool.toLocaleString()}) + Platform Fee (₦{totalPlatformServiceFee.toLocaleString()}) + Gateway Costs (₦{totalGatewayCosts.toLocaleString()}) + Wallet Float (₦{totalRiderWalletPool.toLocaleString()})
              </h3>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Variance: ₦{ledgerVariance.toFixed(2)} · 100% of seat fares (₦{totalGrossRideFares.toLocaleString()}) settle to the university ledger in one daily batch.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setAdminTab('ledger')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Open "Where Every Naira Went"
              </button>
              <button
                onClick={handleExportLedgerCSV}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  backgroundColor: '#059669',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>

          {/* Cab Specific Financial Analytics */}
          <div className="admin-grid">
            <div className="admin-card">
              <h3>Total Cab Petrol Expense</h3>
              <div className="admin-stat" style={{ color: '#f87171' }}>
                ₦{drivers.filter(d => d.vehicleType === 'cab').reduce((acc, d) => acc + (d.petrolCostToday || 0), 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Petrol costs logged by cab drivers</span>
            </div>

            <div className="admin-card">
              <h3>Total Cab Cash Earnings</h3>
              <div className="admin-stat" style={{ color: '#34d399' }}>
                ₦{drivers.filter(d => d.vehicleType === 'cab').reduce((acc, d) => acc + (d.cashCollectedToday || 0), 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Offline cash fares collected by cabs</span>
            </div>

            <div className="admin-card">
              <h3>Total Cab Net Take-Home</h3>
              <div className="admin-stat" style={{ color: '#60a5fa' }}>
                ₦{(
                  drivers.filter(d => d.vehicleType === 'cab').reduce((acc, d) => acc + (d.cashCollectedToday || 0), 0) +
                  trips.filter(t => t.status === 'completed' && t.vehicleType === 'cab').reduce((acc, t) => acc + t.totalFare, 0) -
                  drivers.filter(d => d.vehicleType === 'cab').reduce((acc, d) => acc + (d.petrolCostToday || 0), 0)
                ).toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Cash + Card Fares minus petrol expenses</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            
            {/* Energy Log report list */}
            <div className="admin-card" style={{ flex: 1, minWidth: '300px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px' }}>
                <Zap size={16} /> Energy Consumption Log
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {trips.filter(t => t.status === 'completed' && t.vehicleType === 'keke').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '12px' }}>
                    No Keke trips logged yet. Complete trips in simulator to generate energy metrics!
                  </div>
                ) : (
                  trips.filter(t => t.status === 'completed' && t.vehicleType === 'keke').map(trip => (
                    <div 
                      key={trip.id}
                      style={{
                        padding: '12px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px'
                      }}
                    >
                      <div>
                        <strong>Keke {trip.kekeId} ({trip.rideType})</strong>
                        <div style={{ color: '#64748b' }}>{trip.pickupLandmark} ➔ {trip.destinationLandmark}</div>
                      </div>
                      
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}>-{trip.energyUsedPercent}% Battery</span>
                        <div style={{ color: '#64748b', fontSize: '10px' }}>
                          {new Date(trip.completedAt || '').toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Active Security & Safety Alert Log */}
            <div className="admin-card" style={{ flex: 1, minWidth: '300px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px' }}>
                <ShieldAlert size={16} style={{ color: '#f87171' }} /> Active Security & SOS Logs
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {safetyIncidents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px dashed rgba(16, 185, 129, 0.2)', borderRadius: '8px', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={24} />
                    <strong>System Secure</strong>
                    <span>No active SOS security alarms.</span>
                  </div>
                ) : (
                  safetyIncidents.map(inc => (
                    <div 
                      key={inc.id}
                      style={{
                        padding: '12px',
                        backgroundColor: 'rgba(239, 68, 68, 0.05)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'inline-block', backgroundColor: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold' }}>
                          🚨 SOS ALARM
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '10px' }}>
                          {new Date(inc.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#fca5a5' }}>
                        <div>
                          <strong>Rider:</strong> {inc.riderName} · <a href={`tel:${inc.riderPhone}`} style={{ color: 'var(--uniben-gold)', textDecoration: 'underline' }}>{inc.riderPhone}</a>
                        </div>
                        <div style={{ color: '#f87171', fontWeight: 'bold' }}>DISPATCHED</div>
                      </div>

                      <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '6px', fontSize: '11px', color: '#fff', borderLeft: '3px solid #ef4444' }}>
                        <strong>Incident:</strong> {inc.description}
                      </div>

                      {inc.driverName && (
                        <div style={{ 
                          padding: '6px 8px', 
                          backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                          border: '1px solid rgba(59, 130, 246, 0.2)', 
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: '#93c5fd',
                          marginTop: '2px'
                        }}>
                          <strong>Assigned Driver:</strong> {inc.driverName} ({inc.driverCode}) · <a href={`tel:${inc.driverPhone}`} style={{ color: 'var(--uniben-gold)', textDecoration: 'underline' }}>{inc.driverPhone}</a>
                          {inc.vehiclePlate && <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>Vehicle Plate: {inc.vehiclePlate}</div>}
                        </div>
                      )}

                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                        📍 Landmark: <strong>{inc.landmarkName}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Admin Security Audit Log & System Operations */}
            <div className="admin-card" style={{ flex: 1, minWidth: '300px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px' }}>
                <Info size={16} /> Admin Audit Log &amp; Operations ({adminAuditLogs.length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto', fontSize: '11px', color: '#94a3b8' }}>
                {adminAuditLogs.map(entry => (
                  <div key={entry.id} style={{ padding: '6px 8px', backgroundColor: 'rgba(56, 189, 248, 0.06)', borderLeft: '3px solid #38bdf8', borderRadius: '4px', color: '#e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#38bdf8', fontWeight: '700' }}>
                      <span>[AUDIT: {entry.action}]</span>
                      <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ marginTop: '2px', fontSize: '11px' }}>{entry.details}</div>
                  </div>
                ))}
                <div style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  [System] {new Date().toLocaleTimeString()} - USRide Admin console initialized ({pilotDriversCount} live pilot driver(s), {preloadedDriversCount} preloaded demo vehicles).
                </div>
                {safetyIncidents.map(inc => (
                  <div key={`syslog-${inc.id}`} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', color: '#f87171' }}>
                    [Incident Log] {inc.description.startsWith('[DISPUTE]') ? '⚖️ 24h Dispute' : '🚨 SOS'}: {inc.riderName} ({maskPhoneNumber(inc.riderPhone)}) near {inc.landmarkName} - "{inc.description}".
                  </div>
                ))}
                {trips.map(t => (
                  <div key={`log-${t.id}`} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    [Trip Log] {t.status.toUpperCase()} - Trip {t.id.substring(5, 10)}: {t.pickupLandmark} to {t.destinationLandmark} ({t.rideType}).
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ADMIN VIEW 5: WHERE EVERY NAIRA WENT (LEDGER RECONCILIATION & CSV EXPORT) */}
      {adminTab === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.45), rgba(15, 23, 42, 0.9))', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
            <div>
              <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={20} style={{ color: 'var(--uniben-gold)' }} />
                Where Every Naira Went — Live Ledger Reconciliation
              </h3>
              <p style={{ fontSize: '12px', color: '#a7f3d0', margin: '4px 0 0 0' }}>
                Accounting Identity: <strong>Money In = School Share + Driver Pool + Platform Fee + Gateway Costs + Wallet Float</strong>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '800',
                backgroundColor: ledgerVariance === 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: ledgerVariance === 0 ? '#34d399' : '#f87171',
                border: `1px solid ${ledgerVariance === 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
              }}>
                {ledgerVariance === 0 ? '● LEDGER BALANCED (₦0.00 Variance)' : `⚠️ Variance: ₦${ledgerVariance.toFixed(2)}`}
              </span>
              <button
                onClick={handleExportLedgerCSV}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(251, 191, 36, 0.5)',
                  backgroundColor: 'var(--uniben-gold)',
                  color: '#0f172a',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={14} /> Export Ledger CSV
              </button>
            </div>
          </div>

          {/* 6-Card Naira Equation Breakdown */}
          <div className="admin-grid">
            <div className="admin-card" style={{ borderLeft: '4px solid #fbbf24' }}>
              <h3>1. Money In (Total Funded)</h3>
              <div className="admin-stat" style={{ color: '#fbbf24' }}>
                ₦{totalMoneyIn.toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                All verified Paystack top-ups (capped at ₦2,000/top-up)
              </span>
            </div>

            <div className="admin-card" style={{ borderLeft: '4px solid #10b981' }}>
              <h3>2. School Ledger (100% Seat Fare)</h3>
              <div className="admin-stat" style={{ color: '#10b981' }}>
                ₦{totalGrossRideFares.toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                100% of ₦100 seat / ₦500 drop fares settled in one daily batch (Net retained after driver credits: ₦{totalSchoolShare.toLocaleString()})
              </span>
            </div>

            <div className="admin-card" style={{ borderLeft: '4px solid #38bdf8' }}>
              <h3>3. Driver Pool (School Disbursed)</h3>
              <div className="admin-stat" style={{ color: '#38bdf8' }}>
                ₦{totalDriverPool.toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                Earnings credited, paid out by the school (Active: ₦{totalDriverWalletPool.toLocaleString()} · Withdrawn: ₦{totalDriverWithdrawals.toLocaleString()})
              </span>
            </div>

            <div className="admin-card" style={{ borderLeft: '4px solid #a855f7' }}>
              <h3>4. Platform Service Fee</h3>
              <div className="admin-stat" style={{ color: '#c084fc' }}>
                ₦{totalPlatformServiceFee.toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                Flat ₦10 per seat (shared) or ₦50 (full-ride drop) paid by riders
              </span>
            </div>

            <div className="admin-card" style={{ borderLeft: '4px solid #64748b' }}>
              <h3>5. Paystack Gateway Costs</h3>
              <div className="admin-stat" style={{ color: '#cbd5e1' }}>
                ₦{totalGatewayCosts.toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                ₦100 flat fee waived by capping top-ups at ₦2,000 &amp; settling in one daily batch
              </span>
            </div>

            <div className="admin-card" style={{ borderLeft: '4px solid #34d399' }}>
              <h3>6. Rider Wallet Float</h3>
              <div className="admin-stat" style={{ color: '#34d399' }}>
                ₦{totalRiderWalletPool.toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                Unspent balance held by {riders.filter(r => r.walletBalance > 0).length} active rider(s)
              </span>
            </div>
          </div>

          {/* Reconciliation Table */}
          <div className="admin-card">
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '15px' }}>
              Ledger Equation &amp; Daily Batch Settlement Summary
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-list-table">
                <thead>
                  <tr>
                    <th>Ledger Bucket</th>
                    <th>Rule / Policy</th>
                    <th>Amount (₦)</th>
                    <th>Share of Money In</th>
                    <th>Settlement Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 'bold', color: '#fbbf24' }}>Money In (Gross Inflow)</td>
                    <td>Rider wallet top-ups capped at ₦2,000 per transaction</td>
                    <td style={{ fontWeight: '800', color: '#fbbf24' }}>₦{totalMoneyIn.toFixed(2)}</td>
                    <td>100.0%</td>
                    <td><span style={{ color: '#34d399', fontWeight: 'bold' }}>Verified via Paystack</span></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', color: '#10b981' }}>School Share (University Ledger)</td>
                    <td>100% of ₦100 seat fare &amp; ₦500 drop fare goes to school ledger (₦{totalGrossRideFares.toFixed(2)} gross)</td>
                    <td style={{ fontWeight: '700', color: '#10b981' }}>₦{totalSchoolShare.toFixed(2)}</td>
                    <td>{totalMoneyIn > 0 ? ((totalSchoolShare / totalMoneyIn) * 100).toFixed(1) : '0.0'}%</td>
                    <td><span style={{ color: '#fbbf24', fontWeight: 'bold' }}>Daily Batch Settlement (23:59 WAT)</span></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', color: '#38bdf8' }}>Driver Pool</td>
                    <td>Earnings credited, paid out by the school from the school fare ledger</td>
                    <td style={{ fontWeight: '700', color: '#38bdf8' }}>₦{totalDriverPool.toFixed(2)}</td>
                    <td>{totalMoneyIn > 0 ? ((totalDriverPool / totalMoneyIn) * 100).toFixed(1) : '0.0'}%</td>
                    <td><span style={{ color: '#38bdf8', fontWeight: 'bold' }}>Credited &amp; Disbursed by School</span></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', color: '#c084fc' }}>Platform Fee</td>
                    <td>Flat ₦10 service fee per seat (shared) or ₦50 per full-ride drop</td>
                    <td style={{ fontWeight: '700', color: '#c084fc' }}>₦{totalPlatformServiceFee.toFixed(2)}</td>
                    <td>{totalMoneyIn > 0 ? ((totalPlatformServiceFee / totalMoneyIn) * 100).toFixed(1) : '0.0'}%</td>
                    <td><span style={{ color: '#c084fc', fontWeight: 'bold' }}>Accrued per Completed Trip</span></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', color: '#cbd5e1' }}>Gateway Costs</td>
                    <td>Paystack ₦100 flat fee waived (all top-ups ≤ ₦2,000)</td>
                    <td style={{ fontWeight: '700', color: '#cbd5e1' }}>₦{totalGatewayCosts.toFixed(2)}</td>
                    <td>0.0%</td>
                    <td><span style={{ color: '#34d399', fontWeight: 'bold' }}>Fee Waived (&lt; ₦2,500)</span></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', color: '#34d399' }}>Wallet Float (Rider Balances)</td>
                    <td>Unspent prepaid balance available in student &amp; staff wallets</td>
                    <td style={{ fontWeight: '700', color: '#34d399' }}>₦{totalRiderWalletPool.toFixed(2)}</td>
                    <td>{totalMoneyIn > 0 ? ((totalRiderWalletPool / totalMoneyIn) * 100).toFixed(1) : '0.0'}%</td>
                    <td><span style={{ color: '#34d399', fontWeight: 'bold' }}>Held in Rider Wallets</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaction-level Audit Trail */}
          <div className="admin-card">
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '15px' }}>
              Every Naira Audit Trail ({transactions.length} Ledger Entries)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-list-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Reference</th>
                    <th>Account Type</th>
                    <th>Entry Type</th>
                    <th>Description</th>
                    <th>Amount (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                        No transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--uniben-gold)' }}>{tx.reference}</td>
                        <td style={{ textTransform: 'capitalize' }}>{tx.userType}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '8px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            backgroundColor: tx.type === 'credit' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: tx.type === 'credit' ? '#34d399' : '#f87171'
                          }}>
                            {tx.type.toUpperCase()}
                          </span>
                        </td>
                        <td>{tx.description}</td>
                        <td style={{ fontWeight: 'bold', color: tx.type === 'credit' ? '#34d399' : '#f87171' }}>
                          {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
