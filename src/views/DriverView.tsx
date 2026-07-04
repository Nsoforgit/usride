import React, { useState, useEffect } from 'react';
import { useUSRide, Keke, Trip, LANDMARKS } from '../context/USRideContext';
import { UnibenMap } from '../components/UnibenMap';
import { calculateETA, getDistanceMeters } from '../utils/geofence';
import { synthSound } from '../utils/audio';
import { 
  ToggleLeft, ToggleRight, Battery, User, LogOut, ArrowRight, 
  MapPin, CheckCircle, Navigation, DollarSign, Wallet, ArrowUpRight,
  TrendingUp, RefreshCw, X, Sliders, Play, Award,
  Eye, EyeOff
} from 'lucide-react';

const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '058', name: 'Guaranty Trust Bank (GTB)' },
  { code: '057', name: 'Zenith Bank' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '011', name: 'First Bank' },
  { code: '50211', name: 'Kuda Bank' },
  { code: '999992', name: 'OPay' },
  { code: '999991', name: 'PalmPay' },
  { code: '035', name: 'Wema Bank' },
  { code: '050', name: 'Ecobank' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '214', name: 'FCMB' },
  { code: '030', name: 'Heritage Bank' },
  { code: '221', name: 'Stanbic IBTC' },
  { code: '068', name: 'Standard Chartered' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'Suntrust Bank' },
  { code: '032', name: 'Union Bank' },
  { code: '215', name: 'Unity Bank' },
];

export const DriverView: React.FC = () => {
  const {
    riders,
    drivers,
    currentDriver,
    currentKeke,
    driverLogin,
    driverLogout,
    toggleDriverOnline,
    updateKekeEnergy,
    updateCabFinancials,
    withdrawEarnings,
    trips,
    transactions,
    acceptTrip,
    declineTrip,
    confirmBoarded,
    completeTrip,
    chargeKeke,
    showModal,
    updateDriverProfile
  } = useUSRide();

  // Login states
  const [driverIdInput, setDriverIdInput] = useState('');
  
  // Dashboard navigation states
  const [driverStep, setDriverStep] = useState<'idle' | 'energy-input' | 'earnings' | 'active' | 'profile'>('idle');
  const [hideOverlay, setHideOverlay] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  
  // Withdrawal states
  const [bankCode, setBankCode] = useState('044');
  const [accountNumber, setAccountNumber] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  // Manual Energy Input Slider states
  const [energySliderVal, setEnergySliderVal] = useState(currentKeke?.currentBatteryPercent || 80);
  const [hoursSliderVal, setHoursSliderVal] = useState(currentKeke?.estimatedHoursRemaining || 6);

  // Cab Financials states
  const [cabPetrolInput, setCabPetrolInput] = useState(currentDriver?.petrolCostToday || 0);
  const [cabCashInput, setCabCashInput] = useState(currentDriver?.cashCollectedToday || 0);

  // Incoming booking offer alert state
  const [incomingTrip, setIncomingTrip] = useState<Trip | null>(null);
  const [timerCount, setTimerCount] = useState(30);

  // Sync sliders and cab inputs when currentKeke/currentDriver changes
  useEffect(() => {
    if (currentKeke) {
      setEnergySliderVal(currentKeke.currentBatteryPercent);
      setHoursSliderVal(currentKeke.estimatedHoursRemaining);
    }
  }, [currentKeke]);

  useEffect(() => {
    if (currentDriver) {
      setCabPetrolInput(currentDriver.petrolCostToday || 0);
      setCabCashInput(currentDriver.cashCollectedToday || 0);
    }
  }, [currentDriver]);

  // Keep track of active trip for driver
  const [driverActiveTrip, setDriverActiveTrip] = useState<Trip | null>(null);

  useEffect(() => {
    if (!currentDriver) return;
    
    // Find if this driver has an accepted or active trip
    const active = trips.find(t => 
      t.driverId === currentDriver.id && 
      (t.status === 'accepted' || t.status === 'active')
    );
    
    if (active) {
      setDriverActiveTrip(active);
      setDriverStep('active');
    } else {
      if (driverActiveTrip && trips.find(t => t.id === driverActiveTrip.id)?.status === 'completed') {
        synthSound.playCashRegister();
      }
      setDriverActiveTrip(null);
      if (driverStep === 'active') setDriverStep('idle');
    }
  }, [trips, currentDriver, driverStep, driverActiveTrip]);

  // Poll for incoming booking requests (supporting back-to-back rides)
  useEffect(() => {
    if (!currentDriver || !currentKeke || !currentKeke.isOnline) {
      setIncomingTrip(null);
      return;
    }

    // If already has a queued trip, do not receive more offers
    const queuedTrip = trips.find(t => t.driverId === currentDriver.id && t.status === 'accepted');
    if (queuedTrip) {
      setIncomingTrip(null);
      return;
    }

    // Find requested trip matching driver's vehicle type and brand
    const pendingRequest = trips.find(t => 
      t.status === 'requested' && 
      t.driverId === null && 
      t.vehicleType === currentDriver.vehicleType
    );
    
    if (pendingRequest) {
      const maxSeats = currentKeke.vehicleType === 'keke' ? 5 : 4;
      const isEligible = pendingRequest.rideType === 'drop' 
        ? currentKeke.currentSeatsAvailable === maxSeats 
        : currentKeke.currentSeatsAvailable > 0;

      if (isEligible) {
        setIncomingTrip(pendingRequest);
        setTimerCount(90); // 90-second accept window
      }
    } else {
      setIncomingTrip(null);
    }
  }, [trips, currentDriver, currentKeke, driverActiveTrip]);

  // 90-second countdown timer for incoming request
  useEffect(() => {
    if (!incomingTrip) return;

    const timer = setInterval(() => {
      setTimerCount(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          declineTrip(incomingTrip.id);
          setIncomingTrip(null);
          return 90;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [incomingTrip]);

  // Play incoming request chime
  useEffect(() => {
    if (incomingTrip) {
      synthSound.playChime();
    }
  }, [incomingTrip?.id]);

  const handleDriverLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverIdInput) return;
    const success = await driverLogin(driverIdInput);
    if (!success) {
      showModal({
        title: "Access Denied",
        message: "Invalid Driver ID code. Try one of the demo drivers below!",
        type: 'error'
      });
    }
  };

  const handleQuickLogin = async (code: string) => {
    await driverLogin(code);
  };

  const handleApplyEnergySettings = () => {
    updateKekeEnergy(energySliderVal, hoursSliderVal);
    setDriverStep('idle');
    showModal({
      title: "Energy Configured",
      message: "Energy Settings updated! Syncing battery gauge...",
      type: 'success'
    });
  };

  const handleSaveCabFinancials = () => {
    updateCabFinancials(cabPetrolInput, cabCashInput);
    setDriverStep('idle');
    showModal({
      title: "Financials Updated",
      message: "Daily profit tracker updated successfully!",
      type: 'success'
    });
  };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0 || !accountNumber) return;

    setIsWithdrawing(true);
    // Execute real secure Paystack Transfer payout via Edge Function
    const success = await withdrawEarnings(amt, bankCode, accountNumber);
    setIsWithdrawing(false);
    
    if (success) {
      synthSound.playCashRegister();
      setWithdrawSuccess(true);
      setWithdrawAmount('');
      setAccountNumber('');
      setTimeout(() => {
        setWithdrawSuccess(false);
        setDriverStep('idle');
      }, 2500);
    }
  };

  // Render Auth screen
  if (!currentDriver || !currentKeke) {
    return (
      <div className="phone-screen" style={{ backgroundColor: '#022c22', color: 'white' }}>
        <div className="phone-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div className="logo-badge" style={{ margin: '0 auto 10px auto', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}>DR</div>
            <h2 style={{ fontSize: '24px', fontWeight: '800' }}>USRide / UCRide</h2>
            <p style={{ fontSize: '12px', color: '#a7f3d0', marginTop: '4px' }}>UNIBEN Campus Driver Portal</p>
          </div>

          <form onSubmit={handleDriverLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#a7f3d0', fontWeight: 'bold' }}>Driver ID Code</label>
              <input 
                type="text" 
                className="landmark-select-item" 
                style={{ width: '100%', outline: 'none', color: '#1e293b', border: '1px solid #059669', marginTop: '4px', textTransform: 'uppercase' }} 
                placeholder="DRV001"
                value={driverIdInput}
                onChange={(e) => setDriverIdInput(e.target.value)}
              />
            </div>
            <button className="gold-btn" type="submit">Access Portal</button>
          </form>

          {/* Quick Select login lists */}
          <div style={{ marginTop: '35px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#a7f3d0', marginBottom: '10px', fontWeight: '800' }}>Demo Quick Login</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {drivers.map(d => (
                <button 
                  key={d.id}
                  onClick={() => handleQuickLogin(d.driverIdCode)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    textAlign: 'left',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                  <strong>{d.name}</strong> ({d.vehicleType === 'keke' ? `Keke ${d.kekeId}` : `Cab ${d.kekeId}`})
                    <div style={{ opacity: 0.6 }}>Code: {d.driverIdCode} | Brand: {d.vehicleType === 'keke' ? 'USRide' : 'UCRide'}</div>
                  </div>
                  <span style={{ color: 'var(--uniben-gold)', fontWeight: 'bold' }}>₦{d.walletBalance}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculated estimates based on sliders
  const estimatedTripsRemaining = Math.max(1, Math.round((energySliderVal / 100) * 16));

  return (
    <div className="phone-screen">
      {/* Main app header */}
      <div className="phone-navbar" style={{ backgroundColor: currentDriver.vehicleType === 'keke' ? '#064e3b' : '#1e3a8a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--uniben-gold)' }}><Award size={18} /></span>
          <h2>{currentDriver.vehicleType === 'keke' ? 'USRide Driver' : 'UCRide Driver'}</h2>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={() => {
              if (currentDriver) {
                setEditPhone(currentDriver.phoneNumber || '');
                setEditPhoto(currentDriver.photo || '');
              }
              setDriverStep('profile');
            }} 
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
            title="My Profile"
          >
            <img 
              src={currentDriver.photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'} 
              alt="Profile"
              style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.6)' }}
            />
          </button>
          <button onClick={() => setDriverStep('earnings')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} title="Earnings">
            <Wallet size={18} />
          </button>
          <button 
            onClick={() => setDriverStep('energy-input')} 
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} 
            title={currentDriver.vehicleType === 'keke' ? "Configure Energy Settings" : "Configure Profit Tracker"}
          >
            <Sliders size={18} />
          </button>
          <button onClick={driverLogout} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Phone Body Area */}
      <div className="phone-content" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* DRIVER ALERTS OVERLAY (INCOMING REQUEST) */}
        {incomingTrip && (
          (() => {
            const riderInfo = riders.find(r => r.id === incomingTrip.riderIds[0]);
            return (
              <div className="incoming-request-card">
                <div style={{ textAlign: 'center' }}>
                  <div className="request-timer">{timerCount}</div>
                  <h3 style={{ fontSize: '20px', fontWeight: '800', marginTop: '16px' }}>
                    {driverActiveTrip ? 'Queue Next Ride!' : 'Incoming Booking!'}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#a7f3d0' }}>
                    {driverActiveTrip ? '🔥 BACK-TO-BACK OFFER' : `Type: ${incomingTrip.rideType.toUpperCase()} RIDE`}
                  </span>
                </div>

                <div className="glass-panel-dark" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {riderInfo && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      marginBottom: '6px',
                      textAlign: 'left'
                    }}>
                      <img 
                        src={riderInfo.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'} 
                        alt={riderInfo.name}
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2.5px solid var(--uniben-gold)' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {riderInfo.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#a7f3d0', textTransform: 'capitalize', fontWeight: 'bold' }}>
                          {riderInfo.role} • {incomingTrip.rideType === 'shared' ? `Shared (${incomingTrip.seatsBooked} ${incomingTrip.seatsBooked === 1 ? 'seat' : 'seats'})` : 'Drop Ride'}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', padding: '8px 10px', borderRadius: '8px', fontSize: '11px', color: '#fff', textAlign: 'center', marginBottom: '4px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    📍 Pickup: <strong>{Math.round(getDistanceMeters(currentKeke.lat, currentKeke.lng, incomingTrip.pickupLocation.lat, incomingTrip.pickupLocation.lng))}m</strong> away (~<strong>{calculateETA(currentKeke.lat, currentKeke.lng, incomingTrip.pickupLocation.lat, incomingTrip.pickupLocation.lng)} mins</strong>)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <MapPin size={14} style={{ color: 'var(--uniben-gold)' }} />
                    <div>
                      <div style={{ opacity: 0.6 }}>Pickup Point:</div>
                      <strong>{incomingTrip.pickupLandmark}</strong>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginTop: '4px' }}>
                    <ArrowRight size={14} style={{ color: 'var(--uniben-green-light)' }} />
                    <div>
                      <div style={{ opacity: 0.6 }}>Destination Point:</div>
                      <strong>{incomingTrip.destinationLandmark}</strong>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', fontWeight: 'bold', marginTop: '4px' }}>
                    <span>Fare:</span>
                    <span style={{ color: 'var(--uniben-gold)', fontSize: '18px' }}>₦{incomingTrip.totalFare}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    className="danger-btn" 
                    style={{ flex: 1 }}
                    onClick={() => { declineTrip(incomingTrip.id); setIncomingTrip(null); }}
                  >
                    {driverActiveTrip ? 'Ignore' : 'Decline'}
                  </button>
                  <button 
                    className="gold-btn" 
                    style={{ flex: 1 }}
                    onClick={() => { acceptTrip(incomingTrip.id); setIncomingTrip(null); }}
                  >
                    {driverActiveTrip ? 'Queue Ride' : 'Accept'}
                  </button>
                </div>
              </div>
            );
          })()
        )}

        {/* VIEW: Profile View */}
        {driverStep === 'profile' && currentDriver && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>My Profile</h3>
              <button onClick={() => setDriverStep('idle')} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px' }}>
              <img 
                src={editPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'} 
                alt="Profile Preview"
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--uniben-green)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>{currentDriver.name}</h4>
                <span style={{ fontSize: '11px', textTransform: 'capitalize', color: 'white', backgroundColor: currentDriver.vehicleType === 'keke' ? '#064e3b' : '#1e3a8a', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', display: 'inline-block', marginTop: '4px' }}>
                  {currentDriver.vehicleType === 'keke' ? 'Solar Keke' : 'Campus Cab'} Driver ({currentDriver.driverIdCode})
                </span>
              </div>
            </div>

            {/* Profile Fields form */}
            <div className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Email Address</label>
                <input 
                  type="text" 
                  className="landmark-select-item" 
                  style={{ width: '100%', padding: '10px', fontSize: '12px', color: '#94a3b8', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                  value={currentDriver.email}
                  disabled
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Phone Number</label>
                <input 
                  type="tel" 
                  className="landmark-select-item" 
                  style={{ width: '100%', padding: '10px', fontSize: '12px', color: '#334155', border: '1px solid #cbd5e1' }}
                  placeholder="e.g. 08039991111"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Profile Photo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={editPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'}
                    alt="Preview"
                    style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${currentDriver.vehicleType === 'keke' ? '#064e3b' : '#1e3a8a'}`, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <label
                      htmlFor="driver-photo-upload"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px',
                        fontWeight: '600', border: `2px dashed ${currentDriver.vehicleType === 'keke' ? '#064e3b' : '#1e3a8a'}`,
                        color: currentDriver.vehicleType === 'keke' ? '#064e3b' : '#1e3a8a',
                        backgroundColor: currentDriver.vehicleType === 'keke' ? '#f0fdf4' : '#eff6ff',
                        transition: 'all 0.2s ease', width: '100%'
                      }}
                    >
                      📷 Upload Photo
                    </label>
                    <input
                      id="driver-photo-upload"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          showModal({ title: 'File Too Large', message: 'Please choose an image under 2 MB.', type: 'warning' });
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => setEditPhoto(reader.result as string);
                        reader.readAsDataURL(file);
                      }}
                    />
                    <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', textAlign: 'center' }}>JPG, PNG or WebP · max 2 MB</p>
                  </div>
                </div>
              </div>


              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="primary-btn"
                  style={{ flex: 1, backgroundColor: currentDriver.vehicleType === 'keke' ? '#064e3b' : '#1e3a8a', color: 'white' }}
                  onClick={() => {
                    if (!editPhone) {
                      showModal({
                        title: "Required Phone Number",
                        message: "Please enter a valid phone number.",
                        type: 'warning'
                      });
                      return;
                    }
                    updateDriverProfile(editPhone, editPhoto);
                    showModal({
                      title: "Profile Updated",
                      message: "Your driver profile details have been successfully updated.",
                      type: 'success'
                    });
                    setDriverStep('idle');
                  }}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  style={{ flex: 1, backgroundColor: '#64748b', color: 'white' }}
                  onClick={() => setDriverStep('idle')}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Energy Slider / Financial configurations */}
        {driverStep === 'energy-input' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>
                {currentDriver.vehicleType === 'keke' ? 'Energy Configurations' : 'Daily Profit Tracker'}
              </h3>
              <button onClick={() => setDriverStep('idle')} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {currentDriver.vehicleType === 'keke' ? (
              <div className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Estimated Capacity metrics</span>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--uniben-green)', marginTop: '4px' }}>
                    {estimatedTripsRemaining} Trips Left
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Manual calibration slider</span>
                </div>

                {/* Slider 1: Battery % */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold' }}>
                    <span>Keke Battery (%)</span>
                    <span style={{ color: 'var(--uniben-green)' }}>{energySliderVal}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    step="5"
                    value={energySliderVal}
                    onChange={(e) => setEnergySliderVal(parseInt(e.target.value))}
                    style={{ width: '100%', marginTop: '8px', accentColor: 'var(--uniben-green)' }}
                  />
                </div>

                {/* Slider 2: Estimated Hours remaining */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold' }}>
                    <span>Driving Time Remaining</span>
                    <span style={{ color: 'var(--uniben-green)' }}>{hoursSliderVal} Hours</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    step="1"
                    value={hoursSliderVal}
                    onChange={(e) => setHoursSliderVal(parseInt(e.target.value))}
                    style={{ width: '100%', marginTop: '8px', accentColor: 'var(--uniben-green)' }}
                  />
                </div>

                <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '8px', fontSize: '11px', color: '#166534', border: '1px solid #bbf7d0' }}>
                  💡 Solar tricycles consume ~6% battery per campus cross-trip on average.
                </div>

                <button className="primary-btn" onClick={handleApplyEnergySettings}>
                  Apply Configuration
                </button>
              </div>
            ) : (
              // Cab Driver: Petrol and Cash Inputs
              <div className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>UCRide Daily Financials</span>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>
                    ₦{((trips.filter(t => t.driverId === currentDriver.id && t.status === 'completed').reduce((sum, t) => sum + t.totalFare, 0) || 0) + (cabCashInput || 0) - (cabPetrolInput || 0)).toLocaleString()} Profit
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Real-time profit tracking dashboard</span>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>Daily Petrol Purchased (₦)</label>
                  <input 
                    type="number" 
                    className="landmark-select-item" 
                    style={{ width: '100%', color: '#1e293b', border: '1px solid #cbd5e1', marginTop: '6px', padding: '10px' }} 
                    placeholder="e.g. 3500"
                    value={cabPetrolInput}
                    onChange={(e) => setCabPetrolInput(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>Daily Cash Collected (₦)</label>
                  <input 
                    type="number" 
                    className="landmark-select-item" 
                    style={{ width: '100%', color: '#1e293b', border: '1px solid #cbd5e1', marginTop: '6px', padding: '10px' }} 
                    placeholder="e.g. 5000"
                    value={cabCashInput}
                    onChange={(e) => setCabCashInput(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </div>

                <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '8px', fontSize: '11px', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                  💡 This tracks offline cash collections and fuel expenses to help monitor your daily net take-home earnings.
                </div>

                <button className="primary-btn" style={{ backgroundColor: '#2563eb' }} onClick={handleSaveCabFinancials}>
                  Save Financials Tracker
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Driver Earnings & Bank Withdrawal (Paystack payouts) */}
        {driverStep === 'earnings' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>My Earnings</h3>
              <button onClick={() => setDriverStep('idle')} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div className="energy-status-widget" style={{ background: 'linear-gradient(135deg, var(--uniben-green-dark), #064e3b)', padding: '20px', borderRadius: '18px' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.8 }}>Available Earnings Balance</span>
              <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '4px' }}>
                ₦{currentDriver.walletBalance.toLocaleString()}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', fontSize: '11px', opacity: 0.8 }}>
                <span>Trips Done: {currentDriver.totalTrips}</span>
                <span>Rating: ★{currentDriver.averageRating}</span>
              </div>
            </div>

            {/* Withdraw form */}
            <form onSubmit={handleWithdrawalSubmit} className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700' }}>Withdraw to Bank (Paystack Transfer)</h4>
              
              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Select Bank</label>
                <select 
                  className="landmark-select-item" 
                  style={{ width: '100%', border: '1px solid #cbd5e1', marginTop: '4px', height: '40px' }}
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                >
                  {NIGERIAN_BANKS.map(bank => (
                    <option key={bank.code} value={bank.code}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Account Number</label>
                <input 
                  type="text" 
                  maxLength={10}
                  className="landmark-select-item" 
                  style={{ width: '100%', color: '#1e293b', border: '1px solid #cbd5e1', marginTop: '4px', padding: '10px' }} 
                  placeholder="0123456789"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Amount to Transfer (₦)</label>
                <input 
                  type="number" 
                  className="landmark-select-item" 
                  style={{ width: '100%', color: '#1e293b', border: '1px solid #cbd5e1', marginTop: '4px', padding: '10px' }} 
                  placeholder="Enter amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  required
                />
              </div>

              <button className="gold-btn" type="submit" disabled={isWithdrawing}>
                {isWithdrawing ? (
                  <>
                    <RefreshCw size={14} className="keke-pulse" />
                    Processing Bank payout...
                  </>
                ) : (
                  <>
                    <ArrowUpRight size={14} />
                    Transfer to Bank
                  </>
                )}
              </button>
            </form>

            {withdrawSuccess && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(4, 120, 87, 0.95)', color: 'white', padding: '20px', borderRadius: '12px',
                textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
              }}>
                <CheckCircle size={32} />
                <strong>Payout Sent!</strong>
                <span>Earnings transferred successfully.</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Normal Map Dashboard & Navigation Controls */}
        {(driverStep === 'idle' || driverStep === 'active') && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            
            {/* Map Area */}
            <div className="map-container-wrapper" style={{ flex: 1 }}>
              {driverStep === 'active' && driverActiveTrip && (
                <div style={{
                  position: 'absolute',
                  top: '55px',
                  left: '10px',
                  right: '10px',
                  zIndex: 500,
                  backgroundColor: '#064e3b',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <div style={{ fontSize: '18px' }}>
                    {(() => {
                      if (driverActiveTrip.status === 'accepted') {
                        return '⬆️';
                      }
                      const dist = getDistanceMeters(currentKeke.lat, currentKeke.lng, driverActiveTrip.destinationLocation.lat, driverActiveTrip.destinationLocation.lng);
                      return dist > 300 ? '⬅️' : (dist > 100 ? '➡️' : '🏁');
                    })()}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 'bold' }}>
                      {(() => {
                        if (driverActiveTrip.status === 'accepted') {
                          return `Head towards ${driverActiveTrip.pickupLandmark}`;
                        }
                        const dist = getDistanceMeters(currentKeke.lat, currentKeke.lng, driverActiveTrip.destinationLocation.lat, driverActiveTrip.destinationLocation.lng);
                        return dist > 300 
                          ? `In 150m, turn left onto Arts Avenue` 
                          : (dist > 100 ? `In 50m, turn right onto Senate Rd` : `Arriving shortly at destination`);
                      })()}
                    </div>
                    <div style={{ fontSize: '9px', opacity: 0.8, marginTop: '1px' }}>
                      {(() => {
                        const targetLoc = driverActiveTrip.status === 'accepted' ? driverActiveTrip.pickupLocation : driverActiveTrip.destinationLocation;
                        const dist = Math.round(getDistanceMeters(currentKeke.lat, currentKeke.lng, targetLoc.lat, targetLoc.lng));
                        return `${dist}m remaining • ${calculateETA(currentKeke.lat, currentKeke.lng, targetLoc.lat, targetLoc.lng)} mins`;
                      })()}
                    </div>
                  </div>
                </div>
              )}

              <UnibenMap 
                selectedKekeId={currentKeke.id}
                showLandmarks={true}
                riderActiveTripRoute={true}
              />

              {/* Status Indicator overlays */}
              <div className="map-overlay-top">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', width: '100%' }}>
                  
                  {/* Battery Level Indicator or Cab Profit Tracker */}
                  {currentDriver.vehicleType === 'keke' ? (
                    <div className="glass-panel-dark" style={{ padding: '8px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                      <Battery size={14} style={{ color: currentKeke.currentBatteryPercent > 30 ? '#10b981' : '#ef4444' }} />
                      <span style={{ fontWeight: 'bold' }}>{currentKeke.currentBatteryPercent}%</span>
                      <span style={{ opacity: 0.6 }}>({currentKeke.estimatedHoursRemaining} hrs)</span>
                    </div>
                  ) : (
                    <div className="glass-panel-dark" style={{ padding: '8px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', backgroundColor: 'rgba(37, 99, 235, 0.9)' }}>
                      <TrendingUp size={14} style={{ color: 'var(--uniben-gold)' }} />
                      <span style={{ fontWeight: 'bold' }}>
                        Profit: ₦{(((trips.filter(t => t.driverId === currentDriver.id && t.status === 'completed').reduce((sum, t) => sum + t.totalFare, 0) || 0) + (currentDriver.cashCollectedToday || 0) - (currentDriver.petrolCostToday || 0))).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Action Button: Solar Charge or Log Finances */}
                  {currentDriver.vehicleType === 'keke' ? (
                    <button 
                      onClick={chargeKeke}
                      style={{
                        border: 'none',
                        backgroundColor: 'var(--uniben-gold)',
                        color: 'var(--uniben-green-dark)',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '10px',
                        fontWeight: '800',
                        boxShadow: '0 2px 8px rgba(234, 179, 8, 0.3)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      🔌 Solar Charge
                    </button>
                  ) : (
                    <button 
                      onClick={() => setDriverStep('energy-input')}
                      style={{
                        border: 'none',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '10px',
                        fontWeight: '800',
                        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      📊 Log Finances
                    </button>
                  )}
                </div>
              </div>

              {/* Driver Control overlay panels */}
              <div className="map-overlay-bottom" style={{ display: hideOverlay ? 'none' : 'block' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                  <button 
                    onClick={() => setHideOverlay(true)}
                    style={{
                      border: 'none',
                      backgroundColor: 'rgba(15, 23, 42, 0.7)',
                      backdropFilter: 'blur(5px)',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                  >
                    <EyeOff size={12} /> Hide Panel
                  </button>
                </div>
                
                {/* IDLE state switches */}
                {driverStep === 'idle' && (
                  <div className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    {/* Toggle Online / Offline */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Driver Status</div>
                        <span style={{ fontSize: '11px', color: currentKeke.isOnline ? '#10b981' : '#64748b', fontWeight: '600' }}>
                          {currentKeke.isOnline ? '● Online & Available' : '● Offline'}
                        </span>
                      </div>
                      
                      <button 
                        onClick={toggleDriverOnline}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: currentKeke.isOnline ? 'var(--uniben-green)' : '#cbd5e1' }}
                      >
                        {currentKeke.isOnline ? <ToggleRight size={42} /> : <ToggleLeft size={42} />}
                      </button>
                    </div>

                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                      <span>Seats Left: <strong>{currentKeke.currentSeatsAvailable}/{currentKeke.vehicleType === 'keke' ? 5 : 4}</strong></span>
                      <span>Wallet: <strong>₦{currentDriver.walletBalance}</strong></span>
                    </div>
                  </div>
                )}

                {/* ACTIVE TRIP ROUTE NAVIGATION PANEL */}
                {driverStep === 'active' && driverActiveTrip && (
                  <div className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                      <div>
                        <span className="app-notification" style={{ margin: 0, padding: '2px 8px', fontSize: '9px', display: 'inline-block', backgroundColor: currentDriver.vehicleType === 'keke' ? '#047857' : '#2563eb' }}>
                          {driverActiveTrip.status === 'accepted' ? '🚕 EN ROUTE TO PICKUP' : '🚘 ON TRIP'}
                        </span>
                        <h4 style={{ fontSize: '13px', fontWeight: '800', marginTop: '4px' }}>
                          Trip: {driverActiveTrip.rideType.toUpperCase()}
                        </h4>
                      </div>
                      
                      <span style={{ fontSize: '15px', fontWeight: '800', color: currentDriver.vehicleType === 'keke' ? 'var(--uniben-green)' : '#2563eb' }}>
                        ₦{driverActiveTrip.totalFare}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Pickup Landmark:</span>
                        <div style={{ fontWeight: 'bold' }}>{driverActiveTrip.pickupLandmark}</div>
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ color: '#94a3b8' }}>Destination Landmark:</span>
                        <div style={{ fontWeight: 'bold' }}>{driverActiveTrip.destinationLandmark}</div>
                      </div>
                    </div>

                    {/* Navigation Actions */}
                    <div style={{ marginTop: '6px' }}>
                      {driverActiveTrip.status === 'accepted' ? (
                        <button 
                          className="primary-btn" 
                          style={{ width: '100%' }}
                          onClick={() => confirmBoarded(driverActiveTrip.id)}
                        >
                          <CheckCircle size={16} /> Confirm Rider Boarded
                        </button>
                      ) : (
                        <button 
                          className="gold-btn" 
                          style={{ width: '100%' }}
                          onClick={() => completeTrip(driverActiveTrip.id)}
                        >
                          <Play size={14} /> End Trip (Collect Fare)
                        </button>
                      )}
                    </div>

                  </div>
                )}
              </div>

              {/* Show Panel button when hidden */}
              {hideOverlay && (
                <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 10 }}>
                  <button 
                    onClick={() => setHideOverlay(false)}
                    style={{
                      border: 'none',
                      backgroundColor: 'var(--uniben-green)',
                      color: 'white',
                      padding: '10px 16px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(4, 120, 87, 0.4)',
                      animation: 'slideUp 0.2s ease-out'
                    }}
                  >
                    <Eye size={12} /> Show Panel
                  </button>
                </div>
              )}
            </div>
            
          </div>
        )}

      </div>

      {/* Phone home bottom line */}
      <div className="phone-home-indicator">
        <div className="home-bar"></div>
      </div>
    </div>
  );
};
