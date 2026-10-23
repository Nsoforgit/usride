import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUSRide, LANDMARKS, Keke, Trip, Landmark, GOOGLE_MAPS_API_KEY } from '../context/USRideContext';
import { UnibenMap } from '../components/UnibenMap';
import { LocationPickerModal } from '../components/LocationPickerModal';
import { calculateETA, snapCoordinatesToNearestLandmark, getDistanceMeters, getLandmarkRoadDistanceKm, fetchGoogleRoute, estimateBumpsForRoute, calculateKekeETA, getTripBoardingCode } from '../utils/geofence';
import { synthSound } from '../utils/audio';
import { useUserLocation } from '../hooks/useUserLocation';
import { supabase } from '../lib/supabase';
import { dbToTrip } from '../lib/db';
import { 
  Wallet, MapPin, Navigation, User, LogOut, ArrowRight, ShieldAlert,
  Star, CreditCard, RefreshCw, X, CheckCircle, Clock, Battery, Trash2, History,
  Eye, EyeOff, QrCode, AlertTriangle
} from 'lucide-react';

export const RiderView: React.FC = () => {
  const {
    riders,
    drivers,
    currentRider,
    riderLogin,
    riderRegister,
    riderResetPassword,
    riderLogout,
    bookRide,
    cancelRide,
    riderTopUpWallet,
    addRiderCard,
    removeRiderCard,
    trips,
    kekes,
    transactions,
    confirmBoarded,
    completeTrip,
    raiseTripDispute,
    triggerSOSAlert,
    showModal,
    updateRiderProfile
  } = useUSRide();

  // Live GPS location tracking
  const userLocation = useUserLocation();

  // Screen states
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerRole, setRegisterRole] = useState<'student' | 'staff'>('student');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerNdpaConsent, setRegisterNdpaConsent] = useState(false);
  const [resetEmailInput, setResetEmailInput] = useState('');
  const [resetPhoneInput, setResetPhoneInput] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');

  // SOS Hardening states
  const [showSosSheet, setShowSosSheet] = useState(false);
  const [sosCategory, setSosCategory] = useState('Medical Emergency');
  const [sosDescription, setSosDescription] = useState('');

  // 3.5 Vehicle QR Code Instant Booking states
  const [preselectedKekeId, setPreselectedKekeId] = useState<number | null>(null);
  const [showQrScannerModal, setShowQrScannerModal] = useState(false);
  const [qrVehicleInput, setQrVehicleInput] = useState('');
  
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
  
  // Auto-Location / Map picker state
  const [isLocating, setIsLocating] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  
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
  
  // Rating & Boarding states
  const [ratingStars, setRatingStars] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [boardingCodeInput, setBoardingCodeInput] = useState('');

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
      } else if (
        bookingStep !== 'wallet' &&
        bookingStep !== 'rating' &&
        bookingStep !== 'history' &&
        bookingStep !== 'locations' &&
        bookingStep !== 'ride-type'
      ) {
        setActiveTrip(null);
        setSelectedKeke(null);
        setBookingStep('idle');
      }
    }
  }, [trips, currentRider, kekes]);

  // 2. Polling fallback — when searching, re-fetch trip from DB every 5s
  //    This catches Realtime misses when rider and driver are on different devices
  const activeTripRef = useRef(activeTrip);
  const bookingStepRef = useRef(bookingStep);
  useEffect(() => { activeTripRef.current = activeTrip; }, [activeTrip]);
  useEffect(() => { bookingStepRef.current = bookingStep; }, [bookingStep]);

  useEffect(() => {
    if (bookingStep !== 'searching' || !activeTrip) return;

    const poll = setInterval(async () => {
      // Only poll if still in searching state
      if (bookingStepRef.current !== 'searching' || !activeTripRef.current) {
        clearInterval(poll);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', activeTripRef.current.id)
          .single();

        if (error || !data) return;
        const freshTrip = dbToTrip(data);

        if (freshTrip.status === 'cancelled') {
          clearInterval(poll);
          setActiveTrip(null);
          setSelectedKeke(null);
          setBookingStep('idle');
        } else if (freshTrip.status !== 'requested') {
          // Driver accepted (or trip went active) — force transition to active screen
          clearInterval(poll);
          setActiveTrip(freshTrip);
          setBookingStep('active');
          const matchKeke = kekes.find(k => k.id === freshTrip.kekeId);
          if (matchKeke) setSelectedKeke(matchKeke);
          synthSound.playChime();
        }
      } catch (err) {
        console.warn('[RiderView] Trip poll error:', err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(poll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingStep, activeTrip?.id]);


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

  const schoolTransferFee = rideType === 'drop'
    ? 50
    : 10 * calculatedSeats;
  const totalDebitAmount = totalFareAmount + schoolTransferFee;

  // Pre-warm Google/OSRM road route distance cache as soon as pickup & destination are selected
  const [liveRouteDistanceKm, setLiveRouteDistanceKm] = useState<number | null>(null);
  useEffect(() => {
    const p = LANDMARKS.find(l => l.id === pickupId);
    const d = LANDMARKS.find(l => l.id === destId);
    if (!p || !d || p.id === d.id) {
      setLiveRouteDistanceKm(null);
      return;
    }
    const initialRoadKm = getLandmarkRoadDistanceKm(p.id, d.id, p.lat, p.lng, d.lat, d.lng);
    setLiveRouteDistanceKm(initialRoadKm);

    let cancelled = false;
    fetchGoogleRoute(p.lat, p.lng, d.lat, d.lng, GOOGLE_MAPS_API_KEY).then(() => {
      if (!cancelled) {
        const updatedKm = getLandmarkRoadDistanceKm(p.id, d.id, p.lat, p.lng, d.lat, d.lng);
        setLiveRouteDistanceKm(updatedKm);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pickupId, destId]);

  // Compute driving distance from pickup landmark to the nearest online vehicle of the selected type
  const pickupLandmarkObj = LANDMARKS.find(l => l.id === pickupId);
  const destLandmarkObj = LANDMARKS.find(l => l.id === destId);
  const onlineVehiclesOfSelectedType = kekes.filter(k => k.isOnline && k.vehicleType === vehicleType);
  const nearestVehicleDistanceMeters = pickupLandmarkObj && onlineVehiclesOfSelectedType.length > 0
    ? Math.min(...onlineVehiclesOfSelectedType.map(k => getDistanceMeters(k.lat, k.lng, pickupLandmarkObj.lat, pickupLandmarkObj.lng)))
    : null;
  const nearestVehicleDistanceKm = nearestVehicleDistanceMeters !== null
    ? Math.round((nearestVehicleDistanceMeters / 1000) * 100) / 100
    : null;
  // Suggest "Book a Full Ride (Drop) Instead" when nearest driver is far (>= 1.8 km driving distance) and rider is booking 1 or 2 shared seats
  const shouldSuggestFullRide =
    rideType === 'shared' &&
    seatsCount <= 2 &&
    nearestVehicleDistanceKm !== null &&
    nearestVehicleDistanceKm >= 1.8;



  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return;
    const res = await riderLogin(emailInput, passwordInput);
    if (!res.success) {
      showModal({
        title: "Sign In Failed",
        message: res.error || "Invalid email or password. Please check your credentials or register a new account.",
        type: 'error'
      });
    } else {
      setPasswordInput('');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName || !registerEmail || !registerPhone || !registerPassword) return;
    if (registerPassword.length < 4) {
      showModal({
        title: "Weak Password",
        message: "Password must be at least 4 characters long.",
        type: 'warning'
      });
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      showModal({
        title: "Password Mismatch",
        message: "Passwords do not match. Please verify and try again.",
        type: 'error'
      });
      return;
    }
    if (!registerNdpaConsent) {
      showModal({
        title: "NDPA Privacy Consent Required",
        message: "Please accept the Nigeria Data Protection Act (NDPA) 2023 privacy & data consent notice to create an account.",
        type: 'warning'
      });
      return;
    }
    const res = await riderRegister(registerName, registerEmail, registerRole, registerPhone, registerPassword);
    if (!res.success) {
      showModal({
        title: "Registration Failed",
        message: res.error || "Email address might already exist. Please check or try again.",
        type: 'error'
      });
    } else {
      setRegisterPassword('');
      setRegisterConfirmPassword('');
    }
  };

  const startBooking = () => {
    setBookingStep('locations');
  };

  // Opens the visual map pin picker instead of unreliable GPS
  const handleAutoLocation = () => {
    setShowLocationPicker(true);
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
    const trip = await bookRide(rideType, vehicleType, pickupId, destId, seatsCount, preselectedKekeId);
    if (trip) {
      setActiveTrip(trip);
      setPreselectedKekeId(null);
      setBookingStep('searching');
    }
  };

  // 3.5 Auto-detect ?vehicle= or ?qr= URL parameter from a scanned Vehicle QR code
  useEffect(() => {
    if (!currentRider || kekes.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const qrParam = (params.get('vehicle') || params.get('qr') || '').trim().toUpperCase();
    if (!qrParam) return;

    const matchedVehicle = kekes.find(
      k =>
        String(k.id) === qrParam.replace('#', '') ||
        k.plateNumber.toUpperCase() === qrParam ||
        drivers.some(d => d.kekeId === k.id && d.driverIdCode.toUpperCase() === qrParam)
    );
    if (matchedVehicle) {
      setPreselectedKekeId(matchedVehicle.id);
      setVehicleType(matchedVehicle.vehicleType);
      setBookingStep('locations');
      // Clean URL parameter so it doesn't re-trigger
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [currentRider, kekes, drivers]);

  const handleSelectQrVehicle = (queryOrId: string | number) => {
    const clean = String(queryOrId).trim().toUpperCase().replace('#', '');
    const matched = kekes.find(
      k =>
        String(k.id) === clean ||
        k.plateNumber.toUpperCase() === clean ||
        drivers.some(d => d.kekeId === k.id && d.driverIdCode.toUpperCase() === clean)
    );
    if (!matched) {
      showModal({
        title: 'Vehicle Not Found',
        message: 'Could not find a USRide Keke or Cab matching that QR code / plate number. Try entering the plate (e.g. UNIBEN-01K) or Driver Code (e.g. DRV001).',
        type: 'warning'
      });
      return;
    }
    setPreselectedKekeId(matched.id);
    setVehicleType(matched.vehicleType);
    setShowQrScannerModal(false);
    setQrVehicleInput('');
    if (userLocation.nearestLandmark && !pickupId) {
      setPickupId(userLocation.nearestLandmark.id);
    }
    setBookingStep('locations');
    synthSound.playChime();
  };

  const handleCancelBooking = async () => {
    if (!activeTrip) return;

    // Check live DB status before cancelling to prevent cancelling an already-accepted trip
    try {
      const { data } = await supabase
        .from('trips')
        .select('status, driver_id, vehicle_id')
        .eq('id', activeTrip.id)
        .single();

      if (data && data.status !== 'requested') {
        // Driver already accepted — do NOT cancel, instead sync the rider screen
        const freshTrip = { ...activeTrip, status: data.status as Trip['status'], driverId: data.driver_id, kekeId: data.vehicle_id };
        setActiveTrip(freshTrip);
        setBookingStep('active');
        const matchKeke = kekes.find(k => k.id === data.vehicle_id);
        if (matchKeke) setSelectedKeke(matchKeke);
        synthSound.playChime();
        showModal({
          title: "Driver Already En Route 🚕",
          message: "A driver has already accepted your booking and is heading to your pickup. Your trip is now active!",
          type: 'info'
        });
        return;
      }
    } catch {
      // If DB check fails, allow cancel to proceed safely
    }

    cancelRide(activeTrip.id);
    setActiveTrip(null);
    setBookingStep('idle');
  };

  const handleProcessTopup = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(topupAmount);
    if (isNaN(amt) || amt < 100) {
      showModal({ title: 'Minimum Amount', message: 'Minimum top-up amount is ₦100.', type: 'warning' });
      return;
    }
    if (amt > 2000) {
      showModal({
        title: '₦2,000 Top-Up Cap',
        message: 'Wallet top-ups are capped at ₦2,000 per transaction so the Paystack ₦100 flat fee stays waived. You can top up up to ₦2,000 at a time.',
        type: 'warning'
      });
      return;
    }
    if (!currentRider?.email) return;

    setIsProcessingTopup(true);

    // Always use the real Paystack Inline popup for wallet top-ups (no simulated virtual balance bypass)
    // PaystackPop is loaded globally from the <script> tag in index.html
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PaystackPop = (window as any).PaystackPop;
    if (!PaystackPop) {
      showModal({ title: 'Payment Error', message: 'Paystack SDK failed to load. Please check your internet connection and try again.', type: 'warning' });
      setIsProcessingTopup(false);
      return;
    }

    // Use the live public key from environment variable
    const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!paystackPublicKey || !paystackPublicKey.startsWith('pk_live_')) {
      showModal({ title: 'Payment Configuration Error', message: 'Payment system is not configured correctly. Please contact support.', type: 'error' });
      setIsProcessingTopup(false);
      return;
    }

    const handler = PaystackPop.setup({
      key: paystackPublicKey,
      email: currentRider.email,
      amount: amt * 100, // Paystack uses kobo (smallest unit)
      currency: 'NGN',
      ref: `usride-topup-${currentRider.id}-${Date.now()}`,
      metadata: {
        rider_id: currentRider.id,
        rider_name: currentRider.name,
        custom_fields: [
          { display_name: 'Rider Name', variable_name: 'rider_name', value: currentRider.name },
          { display_name: 'Rider ID', variable_name: 'rider_id', value: currentRider.id },
        ],
      },
      callback: (response: { reference: string }) => {
        // Payment was completed on Paystack's side.
        // Update balance locally and in database immediately with idempotency reference guard
        console.log('[Paystack Live] Payment successful, reference:', response.reference);
        const credited = riderTopUpWallet(amt, response.reference);
        setIsProcessingTopup(false);
        if (credited) {
          synthSound.playCashRegister();
          setTopupSuccess(true);
          setTimeout(() => {
            setTopupSuccess(false);
            setBookingStep('idle');
          }, 2500);
        }
      },
      onClose: () => {
        // User closed the popup without completing payment
        setIsProcessingTopup(false);
        showModal({
          title: 'Payment Window Closed',
          message: 'No funds were deducted. If you initiated a bank transfer, your wallet will automatically update once Paystack confirms the transaction.',
          type: 'info'
        });
      },
    });

    handler.openIframe();
  };

  const handleViewReceipt = (receiptData: {
    id: string;
    typeLabel: string;
    amount: number;
    description: string;
    dateStr: string;
    reference?: string;
  }) => {
    const receiptText = [
      '========================================',
      '       USRIDE CAMPUS TRANSIT RECEIPT    ',
      '   University of Benin (UNIBEN) Shuttle ',
      '========================================',
      `Receipt ID  : ${receiptData.id}`,
      receiptData.reference ? `Paystack Ref: ${receiptData.reference}` : null,
      `Rider Name  : ${currentRider?.name || 'Campus Rider'}`,
      `Rider Email : ${currentRider?.email || 'N/A'}`,
      `Type        : ${receiptData.typeLabel}`,
      `Details     : ${receiptData.description}`,
      `Amount      : ₦${receiptData.amount.toLocaleString()}`,
      `Date & Time : ${receiptData.dateStr}`,
      `Status      : CONFIRMED & VERIFIED`,
      '========================================',
      'Protected under NDPA 2023 • Powered by USRide',
    ].filter(Boolean).join('\n');

    showModal({
      title: '🧾 Official USRide Receipt',
      message: `${receiptData.typeLabel}\n• Details: ${receiptData.description}\n• Amount: ₦${receiptData.amount.toLocaleString()}\n• Date: ${receiptData.dateStr}\n• Ref: ${receiptData.reference || receiptData.id}\n\nClick Confirm below to download a copy of this receipt (.txt).`,
      type: 'success',
      onConfirm: () => {
        const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `USRide-Receipt-${receiptData.id.slice(-8)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
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
                  required
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Password</label>
                  <span
                    style={{ fontSize: '11px', color: 'var(--uniben-gold)', cursor: 'pointer', fontWeight: 'bold' }}
                    onClick={() => {
                      setResetEmailInput(emailInput);
                      setAuthMode('forgot');
                    }}
                  >
                    Forgot Password?
                  </span>
                </div>
                <input 
                  type="password" 
                  className="landmark-select-item" 
                  style={{ width: '100%', outline: 'none', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }} 
                  placeholder="Enter your password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                />
              </div>
              <button className="primary-btn" type="submit">Sign In</button>
              
              <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '10px' }}>
                Don't have an account? <span style={{ color: 'var(--uniben-gold)', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setAuthMode('register')}>Register</span>
              </div>
            </form>
          ) : authMode === 'forgot' ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!resetEmailInput || !resetPhoneInput || !resetNewPassword) return;
                if (resetNewPassword.length < 4) {
                  showModal({ title: 'Weak Password', message: 'Your new password must be at least 4 characters long.', type: 'warning' });
                  return;
                }
                if (resetNewPassword !== resetConfirmPassword) {
                  showModal({ title: 'Password Mismatch', message: 'New passwords do not match. Please try again.', type: 'error' });
                  return;
                }
                const res = await riderResetPassword(resetEmailInput, resetPhoneInput, resetNewPassword);
                if (!res.success) {
                  showModal({ title: 'Reset Failed', message: res.error || 'Could not verify your email and phone number.', type: 'error' });
                } else {
                  setEmailInput(resetEmailInput);
                  setResetNewPassword('');
                  setResetConfirmPassword('');
                  setAuthMode('login');
                  showModal({ title: 'Password Reset Successful ✅', message: 'Your password has been updated. Please sign in with your new password.', type: 'success' });
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Registered Email</label>
                <input
                  type="email"
                  className="landmark-select-item"
                  style={{ width: '100%', outline: 'none', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }}
                  placeholder="name@uniben.edu"
                  value={resetEmailInput}
                  onChange={(e) => setResetEmailInput(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Registered Phone Number</label>
                <input
                  type="tel"
                  className="landmark-select-item"
                  style={{ width: '100%', outline: 'none', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }}
                  placeholder="e.g. 08031234567"
                  value={resetPhoneInput}
                  onChange={(e) => setResetPhoneInput(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>New Password</label>
                <input
                  type="password"
                  className="landmark-select-item"
                  style={{ width: '100%', outline: 'none', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }}
                  placeholder="Minimum 4 characters"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Confirm New Password</label>
                <input
                  type="password"
                  className="landmark-select-item"
                  style={{ width: '100%', outline: 'none', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }}
                  placeholder="Re-enter new password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <button className="primary-btn" type="submit">Reset Password</button>
              <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '10px' }}>
                Remembered your password? <span style={{ color: 'var(--uniben-gold)', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setAuthMode('login')}>Back to Sign In</span>
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
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Create Password</label>
                <input 
                  type="password" 
                  className="landmark-select-item" 
                  style={{ width: '100%', outline: 'none', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }} 
                  placeholder="Minimum 4 characters"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold' }}>Confirm Password</label>
                <input 
                  type="password" 
                  className="landmark-select-item" 
                  style={{ width: '100%', outline: 'none', color: '#1e293b', border: '1px solid #475569', marginTop: '4px' }} 
                  placeholder="Re-enter password"
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(15, 23, 42, 0.5)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', color: '#cbd5e1', cursor: 'pointer', lineHeight: 1.4 }}>
                <input
                  type="checkbox"
                  checked={registerNdpaConsent}
                  onChange={(e) => setRegisterNdpaConsent(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: 'var(--uniben-gold)' }}
                  required
                />
                <span>
                  <strong style={{ color: '#fff' }}>NDPA 2023 Data Privacy Consent:</strong> Only your Name, Phone, Email, and Role are collected for campus shuttle dispatch and safety. All operational records belong to the University of Benin.
                </span>
              </label>
              <button className="primary-btn" type="submit">Create Account</button>
              
              <div style={{ textAlign: 'center', fontSize: '12px', marginTop: '10px' }}>
                Already registered? <span style={{ color: 'var(--uniben-gold)', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setAuthMode('login')}>Login</span>
              </div>
            </form>
          )}
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
              src={currentRider.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentRider.name)}&background=047857&color=fff&bold=true`} 
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
                src={editPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentRider.name)}&background=047857&color=fff&bold=true`} 
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
                    src={editPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentRider.name)}&background=047857&color=fff&bold=true`}
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
                <label style={{ fontSize: '11px', color: '#64748b' }}>Custom Amount (₦100 – ₦2,000 max)</label>
                <input 
                  type="number" 
                  min={100}
                  max={2000}
                  className="landmark-select-item" 
                  style={{ width: '100%', color: '#1e293b', border: '1px solid #cbd5e1', marginTop: '4px', padding: '10px' }} 
                  placeholder="Enter amount (max ₦2,000)"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                />
                <div style={{ fontSize: '10px', color: '#047857', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '6px 8px', marginTop: '6px' }}>
                  💡 Capped at <strong>₦2,000</strong> so the Paystack ₦100 fee stays waived. Funds settle to the school ledger in one daily batch.
                </div>
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
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}>
                      <div>
                        <strong>{tx.description}</strong>
                        <div style={{ color: '#94a3b8' }}>{new Date(tx.createdAt).toLocaleString()}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: tx.type === 'credit' ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                          {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleViewReceipt({
                            id: tx.id,
                            typeLabel: tx.type === 'credit' ? 'WALLET TOP-UP / CREDIT' : 'RIDE FARE DEBIT',
                            amount: tx.amount,
                            description: tx.description,
                            dateStr: new Date(tx.createdAt).toLocaleString(),
                            reference: tx.reference
                          })}
                          style={{
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#f8fafc',
                            color: '#334155',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            fontSize: '10px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                          title="View or Download Official Receipt"
                        >
                          🧾 Receipt
                        </button>
                      </div>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: '#1e293b' }}>₦{(t.totalFare + (t.transferFee ?? (t.rideType === 'drop' ? 50 : 10 * (t.seatsBooked || 1)))).toLocaleString()}</strong>
                        <button
                          type="button"
                          onClick={() => handleViewReceipt({
                            id: t.id,
                            typeLabel: `CAMPUS SHUTTLE TRIP (${t.status.toUpperCase()})`,
                            amount: t.totalFare + (t.transferFee ?? (t.rideType === 'drop' ? 50 : 10 * (t.seatsBooked || 1))),
                            description: `${t.pickupLandmark} ➔ ${t.destinationLandmark} (${t.vehicleType === 'keke' ? 'Solar Keke' : 'Campus Cab'} • ${t.rideType.toUpperCase()})`,
                            dateStr: new Date(t.completedAt || t.createdAt).toLocaleString()
                          })}
                          style={{
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#f8fafc',
                            color: '#047857',
                            borderRadius: '6px',
                            padding: '3px 6px',
                            fontSize: '10px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          🧾 Receipt
                        </button>
                      </div>
                    </div>

                    {t.status === 'completed' && (
                      (() => {
                        const completedTimeMs = new Date(t.completedAt || t.createdAt).getTime();
                        const within24h = Date.now() - completedTimeMs <= 24 * 60 * 60 * 1000;
                        const hoursRemaining = Math.max(0, Math.ceil((completedTimeMs + 24 * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000)));
                        return (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: '9px', color: within24h ? '#047857' : '#94a3b8', fontWeight: '600' }}>
                              {within24h ? `🛡️ 24h Dispute Window Open (${hoursRemaining}h left)` : '🔒 24h Dispute Window Closed'}
                            </span>
                            {within24h && (
                              <button
                                type="button"
                                onClick={() => {
                                  showModal({
                                    title: '⚖️ Raise Trip Dispute (24h Window)',
                                    message: `Report a fare or service issue for trip ${t.pickupLandmark} ➔ ${t.destinationLandmark}:`,
                                    type: 'warning',
                                    inputPlaceholder: 'Describe the issue (e.g., overcharge, wrong drop-off)...',
                                    onInputSubmit: (reason) => {
                                      raiseTripDispute(t.id, reason);
                                    }
                                  });
                                }}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #f59e0b',
                                  backgroundColor: '#fffbeb',
                                  color: '#b45309',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                ⚖️ Raise Dispute
                              </button>
                            )}
                          </div>
                        );
                      })()
                    )}
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
                      setSosCategory('Medical Emergency');
                      setSosDescription('');
                      setShowSosSheet(true);
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

              {/* Structured SOS Campus Emergency Modal / Sheet (3.2 SOS Hardening) */}
              {showSosSheet && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(6px)',
                  zIndex: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px'
                }}>
                  <div style={{
                    backgroundColor: '#0f172a',
                    border: '2px solid #ef4444',
                    borderRadius: '16px',
                    padding: '16px',
                    width: '100%',
                    maxWidth: '340px',
                    color: '#fff',
                    boxShadow: '0 10px 30px rgba(239, 68, 68, 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: '800', fontSize: '14px' }}>
                        <ShieldAlert size={18} /> SOS CAMPUS SECURITY
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSosSheet(false)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
                      Select an emergency category to alert UNIBEN Campus Security Hub. Phone numbers are masked for privacy and alerts have a 60s rate-limit cooldown.
                    </p>
                    <div>
                      <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '700' }}>Incident Category</label>
                      <select
                        className="landmark-select-item"
                        style={{ width: '100%', marginTop: '4px', color: '#1e293b', fontWeight: '700', fontSize: '12px' }}
                        value={sosCategory}
                        onChange={(e) => setSosCategory(e.target.value)}
                      >
                        <option value="Medical Emergency">🚑 Medical Emergency</option>
                        <option value="Harassment / Personal Safety">🛡️ Harassment / Personal Safety</option>
                        <option value="Vehicle Breakdown / Accident">⚠️ Vehicle Breakdown / Accident</option>
                        <option value="Reckless Driving / Route Deviation">🚨 Reckless Driving / Route Deviation</option>
                        <option value="Other Campus Security Issue">🔒 Other Campus Security Issue</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '700' }}>Additional Details (Optional)</label>
                      <textarea
                        className="landmark-select-item"
                        style={{ width: '100%', marginTop: '4px', color: '#1e293b', height: '60px', fontSize: '12px', resize: 'none' }}
                        placeholder="Describe location landmark or situation..."
                        value={sosDescription}
                        onChange={(e) => setSosDescription(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setShowSosSheet(false)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid #475569',
                          background: 'transparent',
                          color: '#cbd5e1',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const landmarkName = activeTrip?.pickupLandmark || LANDMARKS.find(l => l.id === pickupId)?.name || 'Main Gate (Ugbowo)';
                          const sent = triggerSOSAlert(
                            currentRider.id,
                            landmarkName,
                            sosDescription.trim() || sosCategory,
                            sosCategory
                          );
                          setShowSosSheet(false);
                          if (!sent) return;

                          synthSound.playAlert();
                          let driverInfoText = '';
                          if (activeTrip && activeTrip.driverId) {
                            const matchedDriver = drivers.find(d => d.id === activeTrip.driverId);
                            if (matchedDriver) {
                              const rawPhone = matchedDriver.phoneNumber || '';
                              const maskedDriverPhone = rawPhone.length >= 7
                                ? `${rawPhone.slice(0, 4)}***${rawPhone.slice(-3)}`
                                : 'N/A';
                              driverInfoText = `\n\n🚨 ACTIVE DRIVER CAPTURED:\nName: ${matchedDriver.name}\nPhone (Masked): ${maskedDriverPhone}\nVehicle: ${selectedKeke?.plateNumber || 'N/A'}`;
                            }
                          }

                          showModal({
                            title: '⚠️ SOS TRANSMITTED',
                            message: `[${sosCategory.toUpperCase()}] TRANSMITTED TO UNIBEN SECURITY HUB!\nSecurity personnel have been dispatched to ${landmarkName}.${driverInfoText}`,
                            type: 'success'
                          });
                        }}
                        style={{
                          flex: 1.4,
                          padding: '10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#ef4444',
                          color: '#fff',
                          fontWeight: '800',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        🚨 Transmit SOS
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3.5 Vehicle QR Code Instant Booking Scanner / Selector Modal */}
              {showQrScannerModal && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(6px)',
                  zIndex: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px'
                }}>
                  <div style={{
                    backgroundColor: '#0f172a',
                    border: '2px solid var(--uniben-gold)',
                    borderRadius: '16px',
                    padding: '16px',
                    width: '100%',
                    maxWidth: '340px',
                    color: '#fff',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--uniben-gold)', fontWeight: '800', fontSize: '14px' }}>
                        <QrCode size={18} /> INSTANT VEHICLE QR BOOKING
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowQrScannerModal(false)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
                      Scan or select the QR code displayed on a USRide Solar Keke or Campus Cab to pre-select that exact vehicle and pay in-app (eliminating off-app transfers).
                    </p>
                    <div>
                      <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '700' }}>Enter Vehicle Plate / Driver Code</label>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <input
                          type="text"
                          className="landmark-select-item"
                          style={{ flex: 1, color: '#1e293b', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase' }}
                          placeholder="e.g. UNIBEN-01K or DRV001"
                          value={qrVehicleInput}
                          onChange={(e) => setQrVehicleInput(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => handleSelectQrVehicle(qrVehicleInput)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: 'var(--uniben-gold)',
                            color: '#0f172a',
                            fontWeight: '800',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          Select
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '700' }}>Or Tap an Online Vehicle QR Directly</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto', marginTop: '6px' }}>
                        {kekes.filter(k => k.isOnline).map(v => {
                          const drv = drivers.find(d => d.kekeId === v.id);
                          return (
                            <button
                              key={`qr-veh-${v.id}`}
                              type="button"
                              onClick={() => handleSelectQrVehicle(v.id)}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 10px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.12)',
                                backgroundColor: 'rgba(255,255,255,0.06)',
                                color: '#fff',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '11px'
                              }}
                            >
                              <div>
                                <strong>{v.vehicleType === 'keke' ? '🛺 Keke' : '🚗 Cab'} #{v.id} ({v.plateNumber})</strong>
                                <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                  Driver: {drv?.name || 'Assigned'} ({drv?.driverIdCode || 'N/A'})
                                </div>
                              </div>
                              <span style={{ color: 'var(--uniben-gold)', fontWeight: '800', fontSize: '10px' }}>
                                Pre-select ➔
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 'bold' }}>USRide Campus Transit</div>
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

                    {/* Live GPS Location Pill */}
                    {userLocation.nearestLandmark && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        backgroundColor: '#eff6ff',
                        borderRadius: '8px',
                        border: '1px solid #bfdbfe',
                        fontSize: '11px',
                        color: '#1e40af',
                        fontWeight: '600'
                      }}>
                        <MapPin size={12} />
                        📍 Near {userLocation.nearestLandmark.name}
                        {userLocation.distanceToLandmark !== null && (
                          <span style={{ fontWeight: '400', color: '#60a5fa', marginLeft: '4px' }}>
                            ({userLocation.distanceToLandmark}m)
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button className="primary-btn" style={{ flex: 1.4 }} onClick={startBooking}>
                        <Navigation size={16} /> Book USRide
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowQrScannerModal(true)}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--uniben-green)',
                          backgroundColor: '#f0fdf4',
                          color: 'var(--uniben-green-dark)',
                          fontWeight: '800',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                        title="Scan or enter a Keke/Cab QR code to pre-select that vehicle"
                      >
                        <QrCode size={15} /> Scan QR
                      </button>
                    </div>
                  </div>
                )}

                {/* SELECT LOCATIONS BOX */}
                {bookingStep === 'locations' && (
                  <div className="glass-panel" style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '700' }}>Select Landmarks</h4>
                      <button onClick={() => { setBookingStep('idle'); setPickupId(''); setDestId(''); setPreselectedKekeId(null); }} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={16} /></button>
                    </div>

                    {preselectedKekeId && (() => {
                      const preVeh = kekes.find(k => k.id === preselectedKekeId);
                      const preDrv = drivers.find(d => d.kekeId === preselectedKekeId);
                      return preVeh ? (
                        <div style={{
                          backgroundColor: '#f0fdf4',
                          border: '1.5px solid #059669',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          fontSize: '11px',
                          color: '#065f46',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>
                            🎯 <strong>QR Pre-selected:</strong> {preVeh.vehicleType === 'keke' ? 'Solar Keke' : 'Campus Cab'} <strong>{preVeh.plateNumber}</strong> ({preDrv?.name || 'Driver'})
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreselectedKekeId(null)}
                            style={{ border: 'none', background: 'none', color: '#065f46', cursor: 'pointer', fontWeight: '800', fontSize: '10px' }}
                          >
                            Clear
                          </button>
                        </div>
                      ) : null;
                    })()}

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
                          ₦{vehicleType === 'keke' ? '110' : '260'} <span style={{ fontSize: '10px', fontWeight: '600', color: '#64748b' }}>/ seat</span>
                        </div>
                        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                          ₦{vehicleType === 'keke' ? '100' : '250'} fare + ₦10 fee
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
                        <strong style={{ display: 'block', fontSize: '13px' }}>Full Ride (Drop)</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Private charter</span>
                        <div style={{ fontSize: '15px', fontWeight: '800', marginTop: '6px', color: vehicleType === 'keke' ? 'var(--uniben-green)' : '#2563eb' }}>
                          ₦{vehicleType === 'keke' ? '550' : '1,050'}
                        </div>
                        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                          ₦{vehicleType === 'keke' ? '500' : '1,000'} fare + ₦50 fee
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

                    {/* Route Driving Distance & ETA Pill */}
                    {pickupLandmarkObj && destLandmarkObj && liveRouteDistanceKm !== null && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: '11px',
                        color: '#334155'
                      }}>
                        <span>
                          🛣️ <strong>Driving Distance:</strong> {liveRouteDistanceKm.toFixed(1)} km
                        </span>
                        <span>
                          ⏱️ <strong>Est. Trip Time:</strong> ~{calculateKekeETA(liveRouteDistanceKm, estimateBumpsForRoute(pickupLandmarkObj.id, destLandmarkObj.id, liveRouteDistanceKm), vehicleType)} mins
                        </span>
                      </div>
                    )}

                    {/* Smart Non-Compulsory Suggestion when Drivers are Far Away */}
                    {shouldSuggestFullRide && nearestVehicleDistanceKm !== null && (
                      <div style={{
                        backgroundColor: '#fffbeb',
                        border: '1.5px solid #f59e0b',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        fontSize: '11px',
                        color: '#92400e',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', color: '#b45309' }}>
                          <AlertTriangle size={14} color="#d97706" />
                          <span>Drivers are ~{nearestVehicleDistanceKm.toFixed(1)} km away — Book a Full Ride instead?</span>
                        </div>
                        <div style={{ lineHeight: 1.4, fontSize: '10.5px' }}>
                          Available {vehicleType === 'keke' ? 'Kekes' : 'Cabs'} are currently far from <strong>{pickupLandmarkObj?.name}</strong>. Because drivers burn more {vehicleType === 'keke' ? 'battery' : 'fuel'} driving empty when there may be no other passengers along the way, they are much more likely to accept a <strong>Full Ride (Drop)</strong>.
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '9.5px', color: '#b45309', fontStyle: 'italic' }}>
                            Optional suggestion — you can still book {seatsCount} {seatsCount === 1 ? 'seat' : 'seats'} below.
                          </span>
                          <button
                            type="button"
                            onClick={() => setRideType('drop')}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: '#d97706',
                              color: 'white',
                              fontWeight: '800',
                              fontSize: '10px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Switch to Full Ride ➔
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Breakdown & Charges */}
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', fontSize: '11px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{rideType === 'drop' ? 'Full-Ride Fare (100% to School Ledger):' : `Seat Fare (${calculatedSeats} × ₦${baseRideFarePerSeat} — 100% to School Ledger):`}</span>
                        <strong>₦{totalFareAmount.toLocaleString()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{rideType === 'drop' ? 'Full-Ride Service Fee:' : `Platform Service Fee (₦10 × ${calculatedSeats} ${calculatedSeats === 1 ? 'seat' : 'seats'}):`}</span>
                        <strong style={{ color: '#b45309' }}>₦{schoolTransferFee.toLocaleString()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px dashed #cbd5e1', paddingTop: '5px', marginTop: '2px', fontSize: '12px', color: '#1e293b' }}>
                        <span>Full Price to Confirm:</span>
                        <strong style={{ color: vehicleType === 'keke' ? 'var(--uniben-green)' : '#2563eb', fontSize: '15px' }}>
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
                      Confirm &amp; Pay ₦{totalDebitAmount.toLocaleString()} ({vehicleType === 'keke' ? 'USRide' : 'UCRide'})
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
                              <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }} title="Field-calibrated estimate (~1% per km)">
                                <Battery size={12} style={{ color: '#10b981' }} /> {selectedKeke.currentBatteryPercent}% · Calibrated est.
                              </span>
                            </>
                          ) : (
                            <>
                              <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 'bold' }}>
                                🚗 USRide Cab
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
                              src={matchedDriver.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(matchedDriver.name)}&background=064e3b&color=fff&bold=true`} 
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

                    {/* Boarding Check (Code/QR + 50m Proximity) when Driver Accepted */}
                    {activeTrip.status === 'accepted' && (
                      (() => {
                        const expectedCode = getTripBoardingCode(activeTrip.id);
                        const distToPickup = selectedKeke
                          ? Math.round(getDistanceMeters(selectedKeke.lat, selectedKeke.lng, activeTrip.pickupLocation.lat, activeTrip.pickupLocation.lng))
                          : 0;
                        const isWithin50m = distToPickup <= 50;
                        return (
                          <div style={{
                            backgroundColor: '#f0fdf4',
                            border: '1.5px dashed #059669',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: '800', color: '#065f46', textTransform: 'uppercase' }}>
                                  🎫 Boarding Check (4-Digit Code / QR)
                                </div>
                                <div style={{ fontSize: '9px', color: isWithin50m ? '#059669' : '#b45309', fontWeight: '700', marginTop: '2px' }}>
                                  {isWithin50m
                                    ? `✓ Proximity Verified (${distToPickup}m ≤ 50m)`
                                    : `📍 Driver ${distToPickup}m away (Verify ≤ 50m + Code ${expectedCode})`}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setBoardingCodeInput(expectedCode);
                                  confirmBoarded(activeTrip.id, expectedCode);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #059669',
                                  backgroundColor: 'white',
                                  color: '#064e3b',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  cursor: 'pointer'
                                }}
                                title="Scan Driver QR Code"
                              >
                                <QrCode size={13} /> Scan QR ({expectedCode})
                              </button>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                type="text"
                                maxLength={4}
                                placeholder={`Enter driver 4-digit code (${expectedCode})`}
                                value={boardingCodeInput}
                                onChange={(e) => setBoardingCodeInput(e.target.value.replace(/\D/g, ''))}
                                className="landmark-select-item"
                                style={{ flex: 1, padding: '7px 10px', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', border: '1px solid #a7f3d0', backgroundColor: 'white' }}
                              />
                              <button
                                type="button"
                                onClick={() => confirmBoarded(activeTrip.id, boardingCodeInput || expectedCode)}
                                className="primary-btn"
                                style={{ padding: '7px 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                              >
                                Confirm Boarding
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    )}

                    <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        Total Charge: <strong>₦{activeTrip.totalFare + (activeTrip.transferFee ?? (activeTrip.rideType === 'drop' ? 50 : 10 * (activeTrip.seatsBooked || 1)))}</strong> (incl. ₦{activeTrip.transferFee ?? (activeTrip.rideType === 'drop' ? 50 : 10 * (activeTrip.seatsBooked || 1))} fee)
                      </span>
                      {activeTrip.status === 'active' && (
                        <button 
                          onClick={() => completeTrip(activeTrip.id)}
                          style={{ border: 'none', background: 'none', color: activeTrip.vehicleType === 'keke' ? 'var(--uniben-green-light)' : '#3b82f6', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
                        >
                          (Complete Ride)
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
                      animation: 'slideUp 0.2s ease-out',
                      transform: 'translateY(-55px)'
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
      
      {/* Location Picker Modal — opens when rider taps "Pinpoint My Location" */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={(landmarkId) => {
          setPickupId(landmarkId);
          setShowLocationPicker(false);
        }}
      />

    </div>
  );
};
