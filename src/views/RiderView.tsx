import React, { useState, useEffect } from 'react';
import { useUSRide, LANDMARKS, Keke, Trip, Landmark } from '../context/USRideContext';
import { UnibenMap } from '../components/UnibenMap';
import { calculateETA, snapCoordinatesToNearestLandmark } from '../utils/geofence';
import { synthSound } from '../utils/audio';
import { 
  Wallet, MapPin, Navigation, User, LogOut, ArrowRight, ShieldAlert,
  Star, CreditCard, RefreshCw, X, CheckCircle, Clock, Battery, Trash2, History,
  Eye, EyeOff
} from 'lucide-react';

export const RiderView: React.FC = () => {
  const {
    riders,
    drivers,
    currentRider,
    riderLogin,
    riderRegister,
    riderLogout,
    bookRide,
    cancelRide,
    riderTopUpWallet,
    addRiderCard,
    removeRiderCard,
    trips,
    kekes,
    transactions,
    completeTrip,
    triggerSOSAlert,
    showModal,
    updateRiderProfile
  } = useUSRide();

  // Screen states
  const [emailInput, setEmailInput] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerRole, setRegisterRole] = useState<'student' | 'staff'>('student');
  const [registerPhone, setRegisterPhone] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Booking states
  const [bookingStep, setBookingStep] = useState<'idle' | 'locations' | 'ride-type' | 'searching' | 'active' | 'rating' | 'wallet' | 'history' | 'profile'>('idle');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [pickupId, setPickupId] = useState('');
  const [destId, setDestId] = useState('');
  const [rideType, setRideType] = useState<'shared' | 'drop'>('shared');
  const [vehicleType, setVehicleType] = useState<'keke' | 'cab'>('keke');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [selectedKeke, setSelectedKeke] = useState<Keke | null>(null);
  const [seatsCount, setSeatsCount] = useState(1);
  
  // Auto-Location state
  const [isLocating, setIsLocating] = useState(false);
  
  // Card management states
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [cardBrand, setCardBrand] = useState('Visa');
  const [isAddingCard, setIsAddingCard] = useState(false);

  // Show/Hide bottom sheet overlay
  const [hideOverlay, setHideOverlay] = useState(false);

  // Topup states
  const [topupAmount, setTopupAmount] = useState('500');
  const [isProcessingTopup, setIsProcessingTopup] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState(false);
  
  // Rating states
  const [ratingStars, setRatingStars] = useState(5);
  const [feedback, setFeedback] = useState('');

  // 1. Keep track of active trip for current rider
  useEffect(() => {
    if (!currentRider) return;
    
    // Find active trip (not completed or cancelled)
    const trip = trips.find(t => 
      t.riderIds.includes(currentRider.id) && 
      t.status !== 'completed' && 
      t.status !== 'cancelled'
    );
    
    if (trip) {
      if (activeTrip && activeTrip.status === 'requested' && trip.status === 'accepted') {
        synthSound.playChime();
      }
      setActiveTrip(trip);
      if (trip.status === 'requested') {
        setBookingStep('searching');
      } else {
        setBookingStep('active');
        const matchKeke = kekes.find(k => k.id === trip.kekeId);
        if (matchKeke) setSelectedKeke(matchKeke);
      }
    } else {
      // Check if we just completed a trip that was active
      if (activeTrip && (trips.find(t => t.id === activeTrip.id)?.status === 'completed')) {
        synthSound.playCashRegister();
        setBookingStep('rating');
      } else if (bookingStep !== 'wallet' && bookingStep !== 'rating' && bookingStep !== 'history') {
        setActiveTrip(null);
        setSelectedKeke(null);
        setBookingStep('idle');
      }
    }
  }, [trips, currentRider, kekes]);

  // Dynamic fleet counters
  const onlineKekes = kekes.filter(k => k.isOnline && k.vehicleType === 'keke').length;
  const onlineCabs = kekes.filter(k => k.isOnline && k.vehicleType === 'cab').length;

  // Reset seats count to 1 if ride type changes to drop
  useEffect(() => {
    if (rideType === 'drop') {
      setSeatsCount(1);
    }
  }, [rideType]);

  // Adjust seats count if vehicleType changes and seatsCount exceeds capacity
  useEffect(() => {
    const maxSeats = vehicleType === 'keke' ? 5 : 4;
    if (seatsCount > maxSeats) {
      setSeatsCount(maxSeats);
    }
  }, [vehicleType, seatsCount]);

  // Dynamic fare calculations
  const baseRideFarePerSeat = rideType === 'drop'
    ? (vehicleType === 'keke' ? 500 : 1000)
    : (vehicleType === 'keke' ? 100 : 250);

  const calculatedSeats = rideType === 'drop'
    ? (vehicleType === 'keke' ? 5 : 4)
    : seatsCount;

  const totalFareAmount = rideType === 'drop'
    ? baseRideFarePerSeat
    : baseRideFarePerSeat * calculatedSeats;

  const schoolTransferFee = 20;
  const totalDebitAmount = totalFareAmount + schoolTransferFee;



  // Auth Quick Select for easier testing
  const handleQuickLogin = (email: string) => {
    riderLogin(email);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    const success = await riderLogin(emailInput);
    if (!success) {
      showModal({
        title: "Account Not Found",
        message: "Email not found. Try one of the demo accounts below, or click Register!",
        type: 'error'
      });
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName || !registerEmail || !registerPhone) return;
    const success = await riderRegister(registerName, registerEmail, registerRole, registerPhone);
    if (!success) {
      showModal({
        title: "Registration Failed",
        message: "Email address might already exist. Please check or try again.",
        type: 'error'
      });
    }
  };

  const startBooking = () => {
    setBookingStep('locations');
  };

  const handleAutoLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const snapped = snapCoordinatesToNearestLandmark(latitude, longitude, LANDMARKS);
          setPickupId(snapped.id);
          setIsLocating(false);
        },
        (error) => {
          console.warn("Geolocation error, using mock UNIBEN center coordinates", error);
          const mockLat = 6.4020 + (Math.random() - 0.5) * 0.005;
          const mockLng = 5.6180 + (Math.random() - 0.5) * 0.005;
          const snapped = snapCoordinatesToNearestLandmark(mockLat, mockLng, LANDMARKS);
          setPickupId(snapped.id);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      const snapped = snapCoordinatesToNearestLandmark(6.4025, 5.6210, LANDMARKS);
      setPickupId(snapped.id);
      setIsLocating(false);
    }
  };

  const handleConfirmLocations = () => {
    if (!pickupId || !destId) {
      showModal({
        title: "Incomplete Locations",
        message: "Please select both a Pickup and a Destination landmark.",
        type: 'warning'
      });
      return;
    }
    if (pickupId === destId) {
      showModal({
        title: "Invalid Route",
        message: "Pickup and Destination landmarks cannot be the same.",
        type: 'warning'
      });
      return;
    }
    setBookingStep('ride-type');
  };

  const handleConfirmBooking = async () => {
    synthSound.playBubble();
    const trip = await bookRide(rideType, vehicleType, pickupId, destId, seatsCount);
    if (trip) {
      setActiveTrip(trip);
      setBookingStep('searching');
    }
  };

  const handleCancelBooking = () => {
    if (activeTrip) {
      cancelRide(activeTrip.id);
      setActiveTrip(null);
      setBookingStep('idle');
    }
  };

  const handleProcessTopup = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(topupAmount);
    if (isNaN(amt) || amt <= 0) return;

    setIsProcessingTopup(true);
    // Simulate Paystack checkout sheet delay
    setTimeout(() => {
      riderTopUpWallet(amt);
      synthSound.playCashRegister();
      setIsProcessingTopup(false);
      setTopupSuccess(true);
      setTimeout(() => {
        setTopupSuccess(false);
        setBookingStep('idle');
      }, 1500);
    }, 1500);
  };

  const handleCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardExpiry || !cardCVV) {
      showModal({
        title: "Incomplete Card Data",
        message: "Please fill in all credit card details.",
        type: 'warning'
      });
      return;
    }
    const brand = cardNumber.startsWith('4') ? 'Visa' : 'Mastercard';
    addRiderCard({
      last4: cardNumber.slice(-4),
      expiry: cardExpiry,
      brand
    });
    setCardNumber('');
    setCardExpiry('');
    setCardCVV('');
    setIsAddingCard(false);
  };

  const handleCardDelete = (cardId: string) => {
    showModal({
      title: "Remove Saved Card",
      message: "Are you sure you want to remove this saved payment card?",
      type: 'warning',
      onConfirm: () => {
        removeRiderCard(cardId);
        if (selectedCardId === cardId) {
          setSelectedCardId('');
        }
      }
    });
  };

  const handleSubmitRating = () => {
    showModal({
      title: "Feedback Submitted",
      message: `Thank you for your rating! You rated the driver ${ratingStars} Stars.`,
      type: 'success'
    });
    setActiveTrip(null);
    setBookingStep('idle');
  };

  // Render Auth screen
  if (!currentRider) {
    return (
      <div className="phone-screen" style={{ backgroundColor: '#0f172a', color: 'white' }}>
        <div className="phone-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div className="logo-badge" style={{ margin: '0 auto 10px auto' }}>US</div>
            <h2 style={{ fontSize: '24px', fontWeight: '800' }}>USRide Client</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Uniben Smart Ride Platform</p>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Email Address</label>
                <input 
                  type="email" 
                  className="landmark-select-item" 
                  style={{ width: '100%', outline: 'none', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }} 
                  placeholder="name@uniben.edu"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </div>
              <button className="primary-btn" type="submit">Sign In</button>
              
              <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '10px' }}>
                Don't have an account? <span style={{ color: 'var(--uniben-gold)', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setAuthMode('register')}>Register</span>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Full Name</label>
                <input 
                  type="text" 
                  className="landmark-select-item" 
                  style={{ width: '100%', outline: 'none', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }} 
                  placeholder="Osas Egbon"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Email Address</label>
                <input 
                  type="email" 
                  className="landmark-select-item" 
                  style={{ width: '100%', outline: 'none', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }} 
                  placeholder="name@uniben.edu"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Phone Number</label>
                <input 
                  type="tel" 
                  className="landmark-select-item" 
                  style={{ width: '100%', outline: 'none', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }} 
                  placeholder="e.g. 08031234567"
                  value={registerPhone}
                  onChange={(e) => setRegisterPhone(e.target.value.replace(/\D/g,''))}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>I am a...</label>
                <select 
                  className="landmark-select-item" 
                  style={{ width: '100%', outline: 'none', color: '#1e293b', border: '1px solid #475569', marginTop: '4px', height: '45px' }}
                  value={registerRole}
                  onChange={(e) => setRegisterRole(e.target.value as any)}
                >
                  <option value="student">Student</option>
                  <option value="staff">Staff Member</option>
                </select>
              </div>
              <button className="primary-btn" type="submit">Create Account</button>
              
              <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '10px' }}>
                Already registered? <span style={{ color: 'var(--uniben-gold)', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setAuthMode('login')}>Login</span>
              </div>
            </form>
          )}

          {/* Test Account quick log list */}
          <div style={{ marginTop: '35px', paddingTop: '20px', borderTop: '1px solid #334155' }}>
            <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '10px', fontWeight: '800' }}>Demo Quick Login</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {riders.map(r => (
                <button 
                  key={r.id}
                  onClick={() => handleQuickLogin(r.email)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid #334155',
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
                    <strong>{r.name}</strong> ({r.role === 'student' ? 'Student' : 'Staff'})
                    <div style={{ opacity: 0.6 }}>{r.email}</div>
                  </div>
                  <span style={{ color: 'var(--uniben-gold)', fontWeight: 'bold' }}>₦{r.walletBalance}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-screen">
      {/* Main app header */}
      <div className="phone-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: 'white', color: 'var(--uniben-green)', width: '24px', height: '24px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '12px' }}>US</div>
          <h2>USRide Rider</h2>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={() => {
              if (currentRider) {
                setEditPhone(currentRider.phoneNumber || '');
                setEditPhoto(currentRider.photo || '');
              }
              setBookingStep('profile');
            }} 
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
            title="My Profile"
          >
            <img 
              src={currentRider.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'} 
              alt="Profile"
              style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.6)' }}
            />
          </button>
          <button onClick={() => setBookingStep('history')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} title="Ride History">
            <History size={18} />
          </button>
          <button onClick={() => setBookingStep('wallet')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} title="Wallet">
            <Wallet size={18} />
          </button>
          <button onClick={riderLogout} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Phone Body Area */}
      <div className="phone-content">
        
        {/* VIEW: Profile View */}
        {bookingStep === 'profile' && currentRider && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>My Profile</h3>
              <button onClick={() => setBookingStep('idle')} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px' }}>
              <img 
                src={editPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'} 
                alt="Profile Preview"
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--uniben-green)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>{currentRider.name}</h4>
                <span style={{ fontSize: '11px', textTransform: 'capitalize', color: 'white', backgroundColor: 'var(--uniben-green)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', display: 'inline-block', marginTop: '4px' }}>
                  {currentRider.role}
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
                  value={currentRider.email}
                  disabled
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Phone Number</label>
                <input 
                  type="tel" 
                  className="landmark-select-item" 
                  style={{ width: '100%', padding: '10px', fontSize: '12px', color: '#334155', border: '1px solid #cbd5e1' }}
                  placeholder="e.g. 08031234567"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Profile Photo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={editPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                    alt="Preview"
                    style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--uniben-purple)', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <label
                      htmlFor="rider-photo-upload"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px',
                        fontWeight: '600', border: '2px dashed var(--uniben-purple)', color: 'var(--uniben-purple)',
                        backgroundColor: '#f5f3ff', transition: 'all 0.2s ease', width: '100%'
                      }}
                    >
                      📷 Upload Photo
                    </label>
                    <input
                      id="rider-photo-upload"
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
                  style={{ flex: 1, backgroundColor: 'var(--uniben-green)', color: 'white' }}
                  onClick={() => {
                    if (!editPhone) {
                      showModal({
                        title: "Required Phone Number",
                        message: "Please enter a valid phone number.",
                        type: 'warning'
                      });
                      return;
                    }
                    updateRiderProfile(editPhone, editPhoto);
                    showModal({
                      title: "Profile Updated",
                      message: "Your rider profile details have been successfully updated.",
                      type: 'success'
                    });
                    setBookingStep('idle');
                  }}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  style={{ flex: 1, backgroundColor: '#64748b', color: 'white' }}
                  onClick={() => setBookingStep('idle')}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 1: Wallet View */}
        {bookingStep === 'wallet' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>My Wallet</h3>
              <button onClick={() => setBookingStep('idle')} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div className="wallet-card">
              <h3>Available Balance</h3>
              <div className="wallet-balance-amt">₦{currentRider.walletBalance.toLocaleString()}</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>Fund your wallet upfront to pay for rides directly!</div>
            </div>

            {/* 1. Saved Cards Manager */}
            <div className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CreditCard size={14} style={{ color: 'var(--uniben-green)' }} /> Saved Cards
                </h4>
                <button 
                  type="button" 
                  onClick={() => setIsAddingCard(!isAddingCard)}
                  style={{ border: 'none', background: 'none', color: 'var(--uniben-green)', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {isAddingCard ? 'Cancel' : '+ Add Card'}
                </button>
              </div>

              {isAddingCard ? (
                <form onSubmit={handleCardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Card Number (4242...)"
                    className="landmark-select-item"
                    style={{ width: '100%', padding: '10px', fontSize: '11px', color: '#334155', border: '1px solid #cbd5e1' }}
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.replace(/\D/g,''))}
                    maxLength={16}
                    required
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input 
                      type="text" 
                      placeholder="MM/YY"
                      className="landmark-select-item"
                      style={{ flex: 1, padding: '10px', fontSize: '11px', color: '#334155', border: '1px solid #cbd5e1' }}
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      maxLength={5}
                      required
                    />
                    <input 
                      type="password" 
                      placeholder="CVV"
                      className="landmark-select-item"
                      style={{ flex: 1, padding: '10px', fontSize: '11px', color: '#334155', border: '1px solid #cbd5e1' }}
                      value={cardCVV}
                      onChange={(e) => setCardCVV(e.target.value.replace(/\D/g,''))}
                      maxLength={3}
                      required
                    />
                  </div>
                  <button type="submit" className="primary-btn" style={{ width: '100%', fontSize: '11px', padding: '8px' }}>
                    Save Card
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(currentRider.savedCards || []).length === 0 ? (
                    <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', padding: '6px' }}>
                      No saved cards. Add a card to start funding upfront!
                    </div>
                  ) : (
                    (currentRider.savedCards || []).map(card => (
                      <div 
                        key={card.id}
                        onClick={() => setSelectedCardId(card.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: selectedCardId === card.id ? '2px solid var(--uniben-green)' : '1px solid #e2e8f0',
                          backgroundColor: selectedCardId === card.id ? '#f0fdf4' : 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                          <span>💳</span>
                          <div>
                            <strong>{card.brand} •••• {card.last4}</strong>
                            <div style={{ fontSize: '9px', opacity: 0.6 }}>Expires {card.expiry}</div>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); handleCardDelete(card.id); }}
                          style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 2. Top Up Billing Form */}
            <form onSubmit={handleProcessTopup} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'white' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>Top Up Wallet</h4>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                {['200', '500', '1000', '2000'].map(val => (
                  <button 
                    key={val}
                    type="button"
                    onClick={() => setTopupAmount(val)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: '8px',
                      border: topupAmount === val ? '2px solid var(--uniben-green)' : '1px solid #cbd5e1',
                      backgroundColor: topupAmount === val ? '#e6f4ea' : 'white',
                      fontWeight: topupAmount === val ? '700' : '500',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    ₦{val}
                  </button>
                ))}
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Custom Amount (₦)</label>
                <input 
                  type="number" 
                  className="landmark-select-item" 
                  style={{ width: '100%', color: '#1e293b', border: '1px solid #cbd5e1', marginTop: '4px', padding: '10px' }} 
                  placeholder="Enter amount"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                />
              </div>

              {selectedCardId ? (
                <button className="primary-btn" type="submit" disabled={isProcessingTopup}>
                  {isProcessingTopup ? (
                    <>
                      <RefreshCw size={14} className="keke-pulse" style={{ marginRight: '6px' }} />
                      Authorizing Card Transaction...
                    </>
                  ) : (
                    <>
                      <CreditCard size={14} style={{ marginRight: '6px' }} />
                      Charge Saved Card (₦{parseFloat(topupAmount || '0').toLocaleString()})
                    </>
                  )}
                </button>
              ) : (
                <button className="gold-btn" type="submit" disabled={isProcessingTopup}>
                  {isProcessingTopup ? (
                    <>
                      <RefreshCw size={14} className="keke-pulse" style={{ marginRight: '6px' }} />
                      Connecting Paystack Web Checkout...
                    </>
                  ) : (
                    <>
                      <CreditCard size={14} style={{ marginRight: '6px' }} />
                      Checkout with Paystack Popup
                    </>
                  )}
                </button>
              )}
            </form>

            {topupSuccess && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(4, 120, 87, 0.95)', color: 'white', padding: '20px', borderRadius: '12px',
                textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
              }}>
                <CheckCircle size={32} />
                <strong>Top Up Successful!</strong>
                <span>Balance Updated.</span>
              </div>
            )}

            <div>
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>Recent Transactions</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {transactions.filter(tx => tx.userId === currentRider.id).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '12px' }}>No transactions yet.</div>
                ) : (
                  transactions.filter(tx => tx.userId === currentRider.id).map(tx => (
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}>
                      <div>
                        <strong>{tx.description}</strong>
                        <div style={{ color: '#94a3b8' }}>{new Date(tx.createdAt).toLocaleTimeString()}</div>
                      </div>
                      <span style={{ color: tx.type === 'credit' ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                        {tx.type === 'credit' ? '+' : '-'}₦{tx.amount}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: Ride History View */}
        {bookingStep === 'history' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <History size={16} style={{ color: 'var(--uniben-green)' }} /> Ride History
              </h3>
              <button onClick={() => setBookingStep('idle')} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {trips.filter(t => t.riderIds.includes(currentRider.id)).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '12px' }}>
                  No trips booked yet.
                </div>
              ) : (
                trips.filter(t => t.riderIds.includes(currentRider.id)).map(t => (
                  <div key={t.id} className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                      <span className="app-notification" style={{ margin: 0, padding: '2px 6px', fontSize: '9px', backgroundColor: t.status === 'completed' ? '#047857' : (t.status === 'cancelled' ? '#ef4444' : '#b45309') }}>
                        {t.status.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                      <div>
                        <div style={{ opacity: 0.6 }}>Pickup:</div>
                        <strong>{t.pickupLandmark}</strong>
                      </div>
                      <ArrowRight size={10} style={{ color: '#cbd5e1' }} />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ opacity: 0.6 }}>Destination:</div>
                        <strong>{t.destinationLandmark}</strong>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      <span>Type: <strong>{t.vehicleType === 'keke' ? 'Solar Keke' : 'Campus Cab'} ({t.rideType})</strong></span>
                      <strong style={{ color: '#1e293b' }}>₦{t.totalFare + 20}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: Rating view */}
        {bookingStep === 'rating' && (
          <div style={{ padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', backgroundColor: '#f8fafc' }}>
            <div style={{ margin: '0 auto 20px auto', backgroundColor: '#e6f4ea', color: 'var(--uniben-green)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={36} />
            </div>
            
            <h3 style={{ fontSize: '20px', fontWeight: '800' }}>Ride Completed!</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Your wallet was debited for the ride fare.</p>

            <div className="glass-panel" style={{ marginTop: '24px', backgroundColor: 'white' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Rate USRide Driver</span>
              
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <span 
                    key={star} 
                    onClick={() => setRatingStars(star)}
                    className={`star-icon ${star <= ratingStars ? 'filled' : ''}`}
                  >
                    ★
                  </span>
                ))}
              </div>

              <textarea 
                className="landmark-select-item"
                style={{ width: '100%', color: '#1e293b', border: '1px solid #cbd5e1', height: '80px', padding: '10px', resize: 'none', fontSize: '12px' }}
                placeholder="Write optional driver feedback..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />

              <button className="primary-btn" style={{ width: '100%', marginTop: '12px' }} onClick={handleSubmitRating}>
                Submit Feedback
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: Standard Map & Booking Steps */}
        {(bookingStep === 'idle' || bookingStep === 'locations' || bookingStep === 'ride-type' || bookingStep === 'searching' || bookingStep === 'active') && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* Map wrapper */}
            <div className="map-container-wrapper" style={{ flex: 1 }}>
              <UnibenMap 
                selectedLandmarkId={pickupId || null}
                selectedKekeId={selectedKeke?.id || null}
                showLandmarks={true}
                landmarkClickCallback={(lm) => {
                  if (bookingStep === 'locations') {
                    if (!pickupId) setPickupId(lm.id);
                    else if (!destId) setDestId(lm.id);
                  }
                }}
              />

              {/* Wallet / SOS Widget overlay */}
              <div className="map-overlay-top">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="glass-panel-dark" style={{ padding: '8px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <Wallet size={12} style={{ color: 'var(--uniben-gold)' }} />
                    <span style={{ fontWeight: 'bold' }}>₦{currentRider.walletBalance.toLocaleString()}</span>
                  </div>
                  
                  <button 
                    onClick={() => {
                      showModal({
                        title: "🚨 SOS CAMPUS EMERGENCY ALERT",
                        message: "Please describe the issue (e.g., medical emergency, harassment, security threat):",
                        type: 'security',
                        inputPlaceholder: "Explain the emergency in detail...",
                        onInputSubmit: (description) => {
                          synthSound.playAlert();
                          triggerSOSAlert(currentRider.id, activeTrip?.pickupLandmark || LANDMARKS.find(l => l.id === pickupId)?.name || 'Main Gate (Ugbowo)', description);
                          
                          let driverInfoText = "";
                          if (activeTrip && activeTrip.driverId) {
                            const matchedDriver = drivers.find(d => d.id === activeTrip.driverId);
                            if (matchedDriver) {
                              driverInfoText = `\n\n🚨 ACTIVE DRIVER CAPTURED:\nName: ${matchedDriver.name}\nPhone: ${matchedDriver.phoneNumber || 'N/A'}\nVehicle: ${selectedKeke?.plateNumber || 'N/A'}`;
                            }
                          }

                          showModal({
                            title: "⚠️ SOS TRANSMITTED",
                            message: `SOS EMERGENCY ALERT TRANSMITTED TO UNIBEN HUB!\nSecurity personnel have been dispatched to your current snapped location.${driverInfoText}`,
                            type: 'success'
                          });
                        }
                      });
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="SOS Campus Security"
                  >
                    <ShieldAlert size={18} />
                  </button>
                </div>
              </div>

              {/* Booking Step Overlay panel */}
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
                
                {/* IDLE: Book ride trigger button */}
                {bookingStep === 'idle' && (
                  <div className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 'bold' }}>UNIBEN Transit</div>
                      <span className="app-notification" style={{ margin: 0, padding: '2px 8px', fontSize: '10px' }}>
                        {onlineKekes} {onlineKekes === 1 ? 'Keke' : 'Kekes'} • {onlineCabs} {onlineCabs === 1 ? 'Cab' : 'Cabs'}
                      </span>
                    </div>
                    
                    {/* Prominent Available Balance Card */}
                    <div className="wallet-card" style={{ padding: '14px', borderRadius: '12px', cursor: 'pointer' }} onClick={() => setBookingStep('wallet')}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.8, fontWeight: 'bold' }}>Available Balance</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', margin: '4px 0' }}>₦{currentRider.walletBalance.toLocaleString()}</div>
                      <div style={{ fontSize: '9px', opacity: 0.8 }}>Tap to top up / manage cards ➔</div>
                    </div>
                    
                    <button className="primary-btn" style={{ width: '100%', marginTop: '4px' }} onClick={startBooking}>
                      <Navigation size={16} /> Book Uniben Smart Ride
                    </button>
                  </div>
                )}

                {/* SELECT LOCATIONS BOX */}
                {bookingStep === 'locations' && (
                  <div className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '700' }}>Select Landmarks</h4>
                      <button onClick={() => { setBookingStep('idle'); setPickupId(''); setDestId(''); }} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={16} /></button>
                    </div>

                    <button 
                      type="button"
                      onClick={handleAutoLocation}
                      disabled={isLocating}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#f8fafc',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: 'var(--uniben-green)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        width: '100%'
                      }}
                    >
                      {isLocating ? (
                        <>
                          <RefreshCw size={12} className="keke-pulse" /> Pinpointing...
                        </>
                      ) : (
                        <>
                          📍 Pinpoint My Location
                        </>
                      )}
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* Pickup Input */}
                      <div style={{ position: 'relative' }}>
                        <select 
                          className="landmark-select-item" 
                          style={{ width: '100%', paddingLeft: '32px', outline: 'none', height: '40px', fontSize: '12px' }}
                          value={pickupId}
                          onChange={(e) => setPickupId(e.target.value)}
                        >
                          <option value="">📍 Select Pickup Point...</option>
                          {LANDMARKS.map(l => (
                            <option key={`pick-${l.id}`} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Destination Input */}
                      <div>
                        <select 
                          className="landmark-select-item" 
                          style={{ width: '100%', paddingLeft: '32px', outline: 'none', height: '40px', fontSize: '12px' }}
                          value={destId}
                          onChange={(e) => setDestId(e.target.value)}
                        >
                          <option value="">🏁 Select Destination Point...</option>
                          {LANDMARKS.map(l => (
                            <option key={`dest-${l.id}`} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button className="primary-btn" onClick={handleConfirmLocations}>
                      Continue <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* CHOOSE RIDE TYPE */}
                {bookingStep === 'ride-type' && (
                  <div className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '700' }}>Choose Vehicle & Option</h4>
                      <button onClick={() => setBookingStep('locations')} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={16} /></button>
                    </div>

                    {/* Vehicle Brand Tabs */}
                    <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                      <button 
                        type="button"
                        onClick={() => setVehicleType('keke')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          border: vehicleType === 'keke' ? '2px solid var(--uniben-green)' : '1px solid #e2e8f0',
                          backgroundColor: vehicleType === 'keke' ? '#e6f4ea' : 'white',
                          fontWeight: 'bold',
                          fontSize: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>🛺</span>
                        <span>USRide (Keke)</span>
                        <span style={{ fontSize: '9px', opacity: 0.6 }}>Solar Powered</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setVehicleType('cab')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          border: vehicleType === 'cab' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          backgroundColor: vehicleType === 'cab' ? '#eff6ff' : 'white',
                          fontWeight: 'bold',
                          fontSize: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>🚗</span>
                        <span>UCRide (Cab)</span>
                        <span style={{ fontSize: '9px', opacity: 0.6 }}>Petrol Powered</span>
                      </button>
                    </div>

                    {/* Shared vs Drop Cards */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {/* Shared Option */}
                      <div 
                        className={`ride-option-card ${rideType === 'shared' ? 'selected' : ''}`}
                        onClick={() => setRideType('shared')}
                        style={{
                          border: rideType === 'shared' ? `2px solid ${vehicleType === 'keke' ? 'var(--uniben-green)' : '#2563eb'}` : '1px solid #cbd5e1'
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: '13px' }}>Shared Seat</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {vehicleType === 'keke' ? 'Up to 5 passengers' : 'Up to 4 passengers'}
                        </span>
                        <div style={{ fontSize: '15px', fontWeight: '800', marginTop: '6px', color: vehicleType === 'keke' ? 'var(--uniben-green)' : '#2563eb' }}>
                          ₦{vehicleType === 'keke' ? '100' : '250'}
                        </div>
                      </div>

                      {/* Drop Option */}
                      <div 
                        className={`ride-option-card ${rideType === 'drop' ? 'selected' : ''}`}
                        onClick={() => setRideType('drop')}
                        style={{
                          border: rideType === 'drop' ? `2px solid ${vehicleType === 'keke' ? 'var(--uniben-green)' : '#2563eb'}` : '1px solid #cbd5e1'
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: '13px' }}>Full Drop</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Private booking</span>
                        <div style={{ fontSize: '15px', fontWeight: '800', marginTop: '6px', color: vehicleType === 'keke' ? 'var(--uniben-green)' : '#2563eb' }}>
                          ₦{vehicleType === 'keke' ? '500' : '1,000'}
                        </div>
                      </div>
                    </div>

                    {/* Seat selector for shared rides */}
                    {rideType === 'shared' && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        marginTop: '4px'
                      }}>
                        <div>
                          <strong style={{ fontSize: '12px', color: '#1e293b' }}>Number of Seats</strong>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>Book multiple seats for group</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button 
                            type="button"
                            onClick={() => setSeatsCount(prev => Math.max(1, prev - 1))}
                            disabled={seatsCount <= 1}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              border: '1px solid #cbd5e1',
                              backgroundColor: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              fontSize: '14px',
                              cursor: seatsCount <= 1 ? 'not-allowed' : 'pointer',
                              opacity: seatsCount <= 1 ? 0.5 : 1
                            }}
                          >
                            -
                          </button>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', minWidth: '16px', textAlign: 'center' }}>
                            {seatsCount}
                          </span>
                          <button 
                            type="button"
                            onClick={() => {
                              const maxSeats = vehicleType === 'keke' ? 5 : 4;
                              setSeatsCount(prev => Math.min(maxSeats, prev + 1));
                            }}
                            disabled={seatsCount >= (vehicleType === 'keke' ? 5 : 4)}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              border: '1px solid #cbd5e1',
                              backgroundColor: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              fontSize: '14px',
                              cursor: seatsCount >= (vehicleType === 'keke' ? 5 : 4) ? 'not-allowed' : 'pointer',
                              opacity: seatsCount >= (vehicleType === 'keke' ? 5 : 4) ? 0.5 : 1
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Breakdown & Charges */}
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', fontSize: '11px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Base Ride Fare:</span>
                        <strong>₦{totalFareAmount.toLocaleString()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>School Transfer Fee:</span>
                        <strong style={{ color: '#b45309' }}>₦20</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px dashed #cbd5e1', paddingTop: '4px', marginTop: '2px', fontSize: '12px', color: '#1e293b' }}>
                        <span>Total Debit Amount:</span>
                        <strong style={{ color: vehicleType === 'keke' ? 'var(--uniben-green)' : '#2563eb', fontSize: '14px' }}>
                          ₦{totalDebitAmount.toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    <button 
                      className="primary-btn" 
                      onClick={handleConfirmBooking}
                      style={{
                        backgroundColor: vehicleType === 'keke' ? 'var(--uniben-green)' : '#2563eb'
                      }}
                    >
                      Confirm Book {vehicleType === 'keke' ? 'USRide' : 'UCRide'}
                    </button>
                  </div>
                )}

                {/* SEARCHING FOR DRIVER */}
                {bookingStep === 'searching' && (
                  <div className="glass-panel" style={{ backgroundColor: 'white', textAlign: 'center', padding: '20px' }}>
                    <div className="request-timer keke-pulse" style={{ border: `3px solid ${vehicleType === 'keke' ? 'var(--uniben-green)' : '#2563eb'}`, color: vehicleType === 'keke' ? 'var(--uniben-green)' : '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={20} className="keke-pulse" />
                    </div>
                    <strong style={{ display: 'block', fontSize: '14px', marginTop: '12px' }}>
                      Searching for {vehicleType === 'keke' ? 'USRide Solar Keke' : 'UCRide Campus Cab'}...
                    </strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Broadcasting to nearby vehicles on campus
                    </span>

                    <button className="danger-btn" style={{ width: '100%', marginTop: '15px' }} onClick={handleCancelBooking}>
                      Cancel Booking
                    </button>
                  </div>
                )}

                {/* ACTIVE TRIP OVERLAY */}
                {bookingStep === 'active' && activeTrip && (
                  <div className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                      <div>
                        <span className="app-notification" style={{ margin: 0, padding: '2px 8px', fontSize: '9px', display: 'inline-block', backgroundColor: activeTrip.vehicleType === 'keke' ? '#047857' : '#2563eb' }}>
                          {activeTrip.status === 'accepted' ? '🚕 DRIVER ACCEPTED' : '🚘 ON TRIP'}
                        </span>
                        <h4 style={{ fontSize: '14px', fontWeight: '800', marginTop: '4px' }}>
                          {activeTrip.vehicleType === 'keke' ? 'Solar Keke' : 'Campus Cab'} {selectedKeke?.plateNumber || '...'}
                        </h4>
                      </div>
                      
                      {selectedKeke && (
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          {selectedKeke.vehicleType === 'keke' ? (
                            <>
                              <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Battery size={12} style={{ color: '#10b981' }} /> {selectedKeke.currentBatteryPercent}%
                              </span>
                            </>
                          ) : (
                            <>
                              <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 'bold' }}>
                                🚗 UCRide Cab
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Driver details */}
                    {activeTrip.driverId && (
                      (() => {
                        const matchedDriver = drivers.find(d => d.id === activeTrip.driverId);
                        if (!matchedDriver) return null;
                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: '#f8fafc',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0'
                          }}>
                            <img 
                              src={matchedDriver.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} 
                              alt={matchedDriver.name}
                              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #cbd5e1' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '11px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{matchedDriver.name}</span>
                                <span style={{ color: 'var(--uniben-gold)', fontSize: '10px' }}>★ {matchedDriver.averageRating}</span>
                              </div>
                              <div style={{ fontSize: '9px', color: '#64748b', marginTop: '1px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {matchedDriver.vehicleColor} • {matchedDriver.vehicleModel}
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                      <div style={{ minWidth: '45%' }}>
                        <div style={{ color: '#94a3b8' }}>Pickup Landmark</div>
                        <strong style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{activeTrip.pickupLandmark}</strong>
                      </div>
                      <ArrowRight size={12} style={{ color: '#94a3b8' }} />
                      <div style={{ textAlign: 'right', minWidth: '45%' }}>
                        <div style={{ color: '#94a3b8' }}>Destination Landmark</div>
                        <strong style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{activeTrip.destinationLandmark}</strong>
                      </div>
                    </div>

                    {/* Show distance-based ETAs */}
                    {selectedKeke && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ backgroundColor: activeTrip.status === 'accepted' ? '#eff6ff' : '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                          <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 'bold' }}>DRIVER TO PICKUP</span>
                          <strong style={{ fontSize: '12px', color: activeTrip.status === 'accepted' ? '#2563eb' : '#94a3b8', marginTop: '2px' }}>
                            {activeTrip.status === 'accepted' ? (
                              `${calculateETA(selectedKeke.lat, selectedKeke.lng, activeTrip.pickupLocation.lat, activeTrip.pickupLocation.lng)} Mins`
                            ) : (
                              'Arrived'
                            )}
                          </strong>
                        </div>
                        <div style={{ backgroundColor: activeTrip.status === 'active' ? '#f0fdf4' : '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                          <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 'bold' }}>DRIVER TO DEST</span>
                          <strong style={{ fontSize: '12px', color: activeTrip.status === 'active' ? '#10b981' : '#94a3b8', marginTop: '2px' }}>
                            {activeTrip.status === 'active' ? (
                              `${calculateETA(selectedKeke.lat, selectedKeke.lng, activeTrip.destinationLocation.lat, activeTrip.destinationLocation.lng)} Mins`
                            ) : (
                              `${calculateETA(activeTrip.pickupLocation.lat, activeTrip.pickupLocation.lng, activeTrip.destinationLocation.lat, activeTrip.destinationLocation.lng)} Mins`
                            )}
                          </strong>
                        </div>
                      </div>
                    )}

                    <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Total Charge: <strong>₦{activeTrip.totalFare + 20}</strong> (incl. ₦20 fee)</span>
                      <button 
                        onClick={() => completeTrip(activeTrip.id)}
                        style={{ border: 'none', background: 'none', color: activeTrip.vehicleType === 'keke' ? 'var(--uniben-green-light)' : '#3b82f6', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
                      >
                        (Simulate Arrived)
                      </button>
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
