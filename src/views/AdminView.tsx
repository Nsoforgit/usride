import React, { useState } from 'react';
import { useUSRide, LANDMARKS, Driver, Keke, Landmark } from '../context/USRideContext';
import { UnibenMap } from '../components/UnibenMap';
import { 
  Users, MapPin, Zap, BarChart2, ShieldCheck, Plus, Trash2, 
  Battery, Play, Info, Check, LogIn, ShieldAlert, CreditCard
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const {
    riders,
    drivers,
    kekes,
    trips,
    transactions,
    adminRegisterDriver,
    safetyIncidents,
    showModal,
    resetSimulatorDatabase
  } = useUSRide();

  // Authentication
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');

  // Sub-tabs
  const [adminTab, setAdminTab] = useState<'fleet' | 'drivers' | 'riders' | 'reports'>('fleet');

  // Register driver form state
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverCode, setNewDriverCode] = useState('');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverKekeId, setNewDriverKekeId] = useState('');
  const [newDriverVehicleType, setNewDriverVehicleType] = useState<'keke' | 'cab'>('keke');
  const [newDriverPlateNumber, setNewDriverPlateNumber] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverPhoto, setNewDriverPhoto] = useState('');


  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'admin123') {
      setIsAdminLoggedIn(true);
    } else {
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
    adminRegisterDriver(newDriverName, newDriverEmail, newDriverCode, newDriverVehicleType, valueOrPlate, newDriverPhone, newDriverPhoto);

    showModal({
      title: "Driver Onboarded",
      message: `Driver ${newDriverName} registered and assigned successfully to the fleet.`,
      type: 'success'
    });

    setNewDriverName('');
    setNewDriverCode('');
    setNewDriverEmail('');
    setNewDriverKekeId('');
    setNewDriverPlateNumber('');
    setNewDriverPhone('');
    setNewDriverPhoto('');
  };

  // Filter out vehicles that don't have driver assigned based on type
  const unassignedVehicles = kekes.filter(k => k.driverId === null && k.vehicleType === newDriverVehicleType);

  // Stats Calculations
  const totalTripsCompleted = trips.filter(t => t.status === 'completed').length;
  const totalEnergyDrained = trips
    .filter(t => t.status === 'completed')
    .reduce((acc, t) => acc + t.energyUsedPercent, 0);

  const activeRides = trips.filter(t => t.status === 'accepted' || t.status === 'active').length;

  const totalRiderTopUps = transactions
    .filter(t => t.userType === 'rider' && t.type === 'credit')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalRiderWalletPool = riders.reduce((acc, r) => acc + r.walletBalance, 0);

  const completedKekeTrips = trips.filter(t => t.status === 'completed' && t.vehicleType === 'keke').length;
  const completedCabTrips = trips.filter(t => t.status === 'completed' && t.vehicleType === 'cab').length;

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
        </form>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      {/* Tab controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '15px', marginBottom: '25px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck style={{ color: 'var(--uniben-gold)' }} />
            USRide Hub
          </h2>
          <span style={{ fontSize: '11px', color: '#64748b' }}>University of Benin Smart Solar Fleet Management</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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
          </div>
          <button
            onClick={() => showModal({
              title: '🔄 Reset Simulator Database',
              message: 'This will wipe all wallet balances, trips, registered drivers, and active sessions, restoring the app to its original demo state. Are you sure?',
              type: 'warning',
              onConfirm: () => { resetSimulatorDatabase(); },
            })}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(239,68,68,0.4)',
              backgroundColor: 'rgba(239,68,68,0.12)',
              color: '#f87171',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s'
            }}
            title="Reset all simulator data to defaults"
          >
            <Trash2 size={13} /> Reset Database
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
                <h3>Total Fleet Size</h3>
                <div className="admin-stat" style={{ fontSize: '15px', marginTop: '6px' }}>
                  {kekes.length} Vehicles ({kekes.filter(k => k.vehicleType === 'keke').length} USRide Kekes · {kekes.filter(k => k.vehicleType === 'cab').length} UCRide Cabs)
                </div>
              </div>
              <Zap size={32} style={{ color: 'var(--uniben-gold)' }} />
            </div>
            
            <div className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Active Online</h3>
                <div className="admin-stat" style={{ fontSize: '15px', marginTop: '6px' }}>
                  {kekes.filter(k => k.isOnline && k.vehicleType === 'keke').length} USRide Kekes · {kekes.filter(k => k.isOnline && k.vehicleType === 'cab').length} UCRide Cabs
                </div>
              </div>
              <Check size={32} style={{ color: '#10b981' }} />
            </div>

            <div className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Active Ongoing Trips</h3>
                <div className="admin-stat" style={{ fontSize: '15px', marginTop: '6px' }}>{activeRides} Active Bookings</div>
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
                  <option value="cab">UCRide (Campus Petrol Cab)</option>
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
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Profile Photo URL (Optional)</label>
                <input 
                  type="text" 
                  className="landmark-select-item" 
                  style={{ width: '100%', color: '#1e293b', border: '1px solid #475569', marginTop: '4px', padding: '10px' }} 
                  placeholder="e.g. https://images.unsplash.com/photo-..."
                  value={newDriverPhoto}
                  onChange={(e) => setNewDriverPhoto(e.target.value)}
                />
              </div>

              <button className="gold-btn" type="submit" style={{ marginTop: '10px' }}>
                <Plus size={16} /> Onboard Driver
              </button>
            </form>
          </div>

          {/* Driver List */}
          <div className="admin-card" style={{ flex: 2, minWidth: '450px' }}>
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '15px' }}>
              Drivers Registry
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-list-table">
                <thead>
                  <tr>
                    <th>Driver Code</th>
                    <th>Photo</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Vehicle Assigned</th>
                    <th>Wallet Balance</th>
                    <th>Rating</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map(d => {
                    const v = kekes.find(k => k.id === d.kekeId);
                    return (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 'bold', color: 'var(--uniben-gold)' }}>{d.driverIdCode}</td>
                        <td>
                          <img 
                            src={d.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'} 
                            alt={d.name}
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                        </td>
                        <td style={{ fontWeight: 'bold', color: 'white' }}>{d.name}</td>
                        <td>
                          <a href={`tel:${d.phoneNumber || ''}`} style={{ color: 'var(--uniben-gold)', textDecoration: 'underline' }}>
                            {d.phoneNumber || 'N/A'}
                          </a>
                        </td>
                        <td>{d.email}</td>
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
                            {d.vehicleType === 'keke' ? 'USRide' : 'UCRide'}
                          </span>
                          #{d.kekeId} ({v?.plateNumber || '...'})
                        </td>
                        <td>₦{d.walletBalance.toLocaleString()}</td>
                        <td>★ {d.averageRating}</td>
                        <td>
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
          <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '15px' }}>
            Riders Directory (Students & Staff)
          </h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-list-table">
              <thead>
                <tr>
                  <th>Rider ID</th>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>User Role</th>
                  <th>Wallet Balance</th>
                  <th>Trips Completed</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {riders.map(r => (
                  <tr key={r.id}>
                    <td>{r.id.toUpperCase()}</td>
                    <td>
                      <img 
                        src={r.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'} 
                        alt={r.name}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </td>
                    <td style={{ fontWeight: 'bold', color: 'white' }}>{r.name}</td>
                    <td>
                      <a href={`tel:${r.phoneNumber}`} style={{ color: 'var(--uniben-gold)', textDecoration: 'underline' }}>
                        {r.phoneNumber}
                      </a>
                    </td>
                    <td>{r.email}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.role}</td>
                    <td style={{ color: 'var(--uniben-green-light)', fontWeight: 'bold' }}>₦{r.walletBalance.toLocaleString()}</td>
                    <td>{r.totalTrips}</td>
                    <td>★ {r.averageRating}</td>
                  </tr>
                ))}
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
                {completedKekeTrips} USRide (Keke) · {completedCabTrips} UCRide (Cab)
              </span>
            </div>

            <div className="admin-card">
              <h3>Avg USRide Battery Level</h3>
              <div className="admin-stat">
                {Math.round(kekes.filter(k => k.vehicleType === 'keke').reduce((acc, k) => acc + k.currentBatteryPercent, 0) / kekes.filter(k => k.vehicleType === 'keke').length)}%
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Solar tricycles fleet battery status</span>
            </div>

            <div className="admin-card">
              <h3>School Revenue (₦20 Fee)</h3>
              <div className="admin-stat" style={{ color: 'var(--uniben-gold)' }}>
                ₦{(totalTripsCompleted * 20).toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Approved administrative transfer levies</span>
            </div>
          </div>

          {/* Digital Inflow & Rider wallet pools */}
          <div className="admin-grid">
            <div className="admin-card">
              <h3>Rider Digital Top-Ups</h3>
              <div className="admin-stat" style={{ color: 'var(--uniben-gold)' }}>
                ₦{totalRiderTopUps.toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Total funded upfront via card gateways</span>
            </div>

            <div className="admin-card">
              <h3>Rider Wallet Pools</h3>
              <div className="admin-stat" style={{ color: 'var(--uniben-green-light)' }}>
                ₦{totalRiderWalletPool.toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Active float balance held by students/staff</span>
            </div>

            <div className="admin-card">
              <h3>Fleet Digital Wallet Balance</h3>
              <div className="admin-stat" style={{ color: '#38bdf8' }}>
                ₦{drivers.reduce((acc, d) => acc + d.walletBalance, 0).toLocaleString()}
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Drivers digital earnings pool balance</span>
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

            {/* General System logs */}
            <div className="admin-card" style={{ flex: 1, minWidth: '300px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px' }}>
                <Info size={16} /> System Operations Logs
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto', fontSize: '11px', color: '#94a3b8' }}>
                <div style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  [System] {new Date().toLocaleTimeString()} - USRide administrative panel dashboard initialized.
                </div>
                <div style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  [Database] Preloaded 17 solar-powered tricycles with active locations.
                </div>
                {safetyIncidents.map(inc => (
                  <div key={`syslog-${inc.id}`} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', color: '#f87171' }}>
                    [Incident Log] SOS Triggered: {inc.riderName} ({inc.riderPhone}) near {inc.landmarkName} - "{inc.description}".
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

    </div>
  );
};
