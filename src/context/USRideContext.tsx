import React, { createContext, useState, useEffect, useContext } from 'react';
import { fetchGoogleRoute, getDistanceMeters } from '../utils/geofence';
import { supabase } from '../lib/supabase';
import {
  fetchAllRiders, fetchAllDrivers, fetchAllVehicles, fetchAllTrips, fetchAllTransactions, fetchAllIncidents,
  upsertRider, upsertDriver, upsertVehicle, insertTrip, updateTripStatus, insertTransaction, insertIncident,
  updateRiderBalance, updateDriverBalance,
  deleteAllUserData,
  dbToRider, dbToDriver, dbToKeke, dbToTrip, dbToTransaction, dbToIncident
} from '../lib/db';

export const GOOGLE_MAPS_API_KEY = "AIzaSyBAf1ytrEZjvqOVpHwmmO5Xb5GUzdy5AB0";

export interface SavedCard {
  id: string;
  last4: string;
  expiry: string;
  brand: string;
}

export interface Rider {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'staff' | 'other';
  phoneNumber: string;
  walletBalance: number;
  totalTrips: number;
  averageRating: number;
  savedCards?: SavedCard[];
  photo?: string;
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  driverIdCode: string;
  kekeId: number;
  walletBalance: number;
  totalTrips: number;
  averageRating: number;
  isActive: boolean;
  vehicleType: 'keke' | 'cab';
  petrolCostToday?: number;
  cashCollectedToday?: number;
  photo?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  queuedTripId?: string | null;
  phoneNumber?: string;
}

export interface Keke {
  id: number;
  driverId: string | null;
  plateNumber: string;
  isOnline: boolean;
  currentSeatsAvailable: number;
  currentBatteryPercent: number;
  estimatedHoursRemaining: number;
  lat: number;
  lng: number;
  speed: number;
  vehicleType: 'keke' | 'cab';
}

export interface Trip {
  id: string;
  rideType: 'shared' | 'drop';
  vehicleType: 'keke' | 'cab';
  riderIds: string[];
  riderNames: string[];
  driverId: string | null;
  kekeId: number | null;
  pickupLandmark: string;
  destinationLandmark: string;
  pickupLocation: { lat: number; lng: number };
  destinationLocation: { lat: number; lng: number };
  status: 'requested' | 'accepted' | 'active' | 'completed' | 'cancelled';
  farePerPerson: number;
  transferFee: number;
  totalFare: number;
  energyUsedPercent: number;
  createdAt: string;
  completedAt: string | null;
  routeCoords?: [number, number][];
  seatsBooked: number;
  eligibleDriverIds?: string[];
}

export interface Landmark {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: 'faculty' | 'hostel' | 'admin' | 'facility';
}

export interface WalletTransaction {
  id: string;
  userId: string;
  userType: 'rider' | 'driver';
  type: 'credit' | 'debit' | 'withdrawal';
  amount: number;
  reference: string;
  description: string;
  createdAt: string;
}

export interface SafetyIncident {
  id: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  landmarkName: string;
  timestamp: string;
  status: 'active' | 'resolved';
  description: string;
  driverName?: string;
  driverPhone?: string;
  driverCode?: string;
  vehiclePlate?: string;
}

export interface AppNotification {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'security';
  onConfirm?: () => void;
  onCancel?: () => void;
  inputPlaceholder?: string;
  onInputSubmit?: (input: string) => void;
}

// UNIBEN Boundaries (Rough bounding box/polygon for geofencing check)
export const UNIBEN_GEOFENCE = {
  minLat: 6.3850,
  maxLat: 6.4150,
  minLng: 5.6050,
  maxLng: 5.6320
};

// Landmarks Data
export const LANDMARKS: Landmark[] = [
  { id: '1', name: 'Main Gate (Ugbowo)', lat: 6.3980, lng: 5.6110, category: 'facility' },
  { id: '2', name: 'Faculty of Engineering', lat: 6.4020, lng: 5.6180, category: 'faculty' },
  { id: '3', name: 'Faculty of Law', lat: 6.4005, lng: 5.6175, category: 'faculty' },
  { id: '4', name: 'Faculty of Medicine (UBTH Gate)', lat: 6.3920, lng: 5.6210, category: 'faculty' },
  { id: '5', name: 'Faculty of Science', lat: 6.4010, lng: 5.6200, category: 'faculty' },
  { id: '6', name: 'Faculty of Social Sciences', lat: 6.4035, lng: 5.6190, category: 'faculty' },
  { id: '7', name: 'Faculty of Arts', lat: 6.4045, lng: 5.6180, category: 'faculty' },
  { id: '8', name: 'Senate Building / Admin Block', lat: 6.4025, lng: 5.6210, category: 'admin' },
  { id: '9', name: 'Student Union Building (SUB)', lat: 6.4000, lng: 5.6230, category: 'facility' },
  { id: '10', name: 'Ekosodin Hostels Gate', lat: 6.4100, lng: 5.6130, category: 'hostel' },
  { id: '11', name: 'ETF Building', lat: 6.4040, lng: 5.6225, category: 'facility' },
  { id: '12', name: 'Sports Complex', lat: 6.3985, lng: 5.6250, category: 'facility' },
  { id: '13', name: 'John Harris Library', lat: 6.4022, lng: 5.6220, category: 'facility' },
  { id: '14', name: 'Faculty of Education', lat: 6.4015, lng: 5.6240, category: 'faculty' },
  { id: '15', name: 'Post Graduate School', lat: 6.4048, lng: 5.6235, category: 'faculty' },
  { id: '16', name: 'Faculty of Agriculture', lat: 6.4060, lng: 5.6245, category: 'faculty' },
  { id: '17', name: 'UBTH Teaching Hospital Complex', lat: 6.3880, lng: 5.6270, category: 'facility' },
  { id: '18', name: 'Anatomy Back Gate', lat: 6.3955, lng: 5.6235, category: 'facility' },
  { id: '19', name: 'Akindeko Main Auditorium Hall', lat: 6.4012, lng: 5.6215, category: 'facility' },
  { id: '20', name: 'Small Gate', lat: 6.4050, lng: 5.6115, category: 'facility' },
  { id: '21', name: 'Clinical Hostel', lat: 6.3895, lng: 5.6240, category: 'hostel' },
  { id: '22', name: 'NDDC Hostel', lat: 6.4075, lng: 5.6165, category: 'hostel' },
  { id: '23', name: 'Helen Food', lat: 6.4008, lng: 5.6225, category: 'facility' },
  { id: '24', name: 'Hall 1', lat: 6.4045, lng: 5.6140, category: 'hostel' },
  { id: '25', name: 'Hall 2', lat: 6.4050, lng: 5.6145, category: 'hostel' },
  { id: '26', name: 'Hall 3', lat: 6.4055, lng: 5.6150, category: 'hostel' },
  { id: '27', name: 'Hall 4 Unit 1', lat: 6.4060, lng: 5.6155, category: 'hostel' },
  { id: '28', name: 'Hall 4 Unit 2', lat: 6.4062, lng: 5.6157, category: 'hostel' },
  { id: '29', name: 'Hall 5', lat: 6.4068, lng: 5.6142, category: 'hostel' },
  { id: '30', name: 'Hall 6', lat: 6.4072, lng: 5.6146, category: 'hostel' },
  { id: '31', name: 'Hall 7', lat: 6.4078, lng: 5.6150, category: 'hostel' },
  { id: '32', name: 'Tetfund Hostel', lat: 6.4082, lng: 5.6160, category: 'hostel' },
  { id: '33', name: 'Keystone Hostel', lat: 6.4085, lng: 5.6168, category: 'hostel' },
  { id: '34', name: 'Blocks of Flat', lat: 6.4015, lng: 5.6265, category: 'hostel' },
  { id: '35', name: 'Senior Staff Quarters', lat: 6.3950, lng: 5.6160, category: 'admin' },
  { id: '36', name: 'Junior Staff Quarters', lat: 6.3935, lng: 5.6175, category: 'admin' },
  { id: '37', name: 'Medical Complex', lat: 6.3910, lng: 5.6225, category: 'faculty' },
  { id: '38', name: 'BMS', lat: 6.3915, lng: 5.6230, category: 'faculty' },
  { id: '39', name: 'Uniben Guest House', lat: 6.3965, lng: 5.6145, category: 'facility' }
];

// Charging Stations
export interface ChargingStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isOperational: boolean;
}

export const CHARGING_STATIONS: ChargingStation[] = [
  { id: 'c1', name: 'Main Gate Solar Hub', lat: 6.3982, lng: 5.6115, isOperational: true },
  { id: 'c2', name: 'Engineering Solar Garage', lat: 6.4018, lng: 5.6185, isOperational: true },
  { id: 'c3', name: 'SUB Charging Center', lat: 6.4002, lng: 5.6235, isOperational: true }
];

// ─── localStorage helpers ────────────────────────────────────────────────────
const LS_KEYS = {
  riders: 'usride_riders',
  drivers: 'usride_drivers',
  kekes: 'usride_kekes',
  trips: 'usride_trips',
  transactions: 'usride_transactions',
  safetyIncidents: 'usride_safety_incidents',
  currentRiderId: 'usride_current_rider_id',
  currentDriverId: 'usride_current_driver_id',
};

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded */ }
}

function lsDel(key: string) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

// ─── Default initial data constants ──────────────────────────────────────────
const INITIAL_RIDERS: Rider[] = [
  { 
    id: 'r1', name: 'Osas Igbinedion', email: 'osas@uniben.edu', role: 'student',
    phoneNumber: '08031234567', walletBalance: 1500, totalTrips: 12, averageRating: 4.8,
    savedCards: [
      { id: 'card-1', last4: '4242', expiry: '12/28', brand: 'Visa' },
      { id: 'card-2', last4: '5555', expiry: '08/29', brand: 'Mastercard' }
    ],
    photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80'
  },
  { 
    id: 'r2', name: 'Dr. Evelyn Alile', email: 'evelyn.alile@uniben.edu', role: 'staff',
    phoneNumber: '08059876543', walletBalance: 4200, totalTrips: 28, averageRating: 4.9,
    savedCards: [{ id: 'card-3', last4: '1111', expiry: '05/30', brand: 'Visa' }],
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80'
  },
  { 
    id: 'r3', name: 'Bose Adebayo', email: 'bose@student.uniben.edu', role: 'student',
    phoneNumber: '08123456789', walletBalance: 300, totalTrips: 4, averageRating: 4.5,
    savedCards: [],
    photo: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=100&q=80'
  }
];

const INITIAL_DRIVERS: Driver[] = [
  { id: 'd1', name: 'Sunday Egbon', email: 'sunday@usride.uniben.edu', driverIdCode: 'DRV001', kekeId: 1,
    walletBalance: 4500, totalTrips: 84, averageRating: 4.7, isActive: true, vehicleType: 'keke',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    vehicleModel: 'Wavz Solar Keke X1', vehicleColor: 'Uniben Green', queuedTripId: null, phoneNumber: '08039991111' },
  { id: 'd2', name: 'Musa Ibrahim', email: 'musa@usride.uniben.edu', driverIdCode: 'DRV002', kekeId: 2,
    walletBalance: 8200, totalTrips: 110, averageRating: 4.9, isActive: true, vehicleType: 'keke',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    vehicleModel: 'EcoDrive Solar Tricycle', vehicleColor: 'Forest Green', queuedTripId: null, phoneNumber: '08058882222' },
  { id: 'd3', name: 'Efosa Osula', email: 'efosa@usride.uniben.edu', driverIdCode: 'DRV003', kekeId: 3,
    walletBalance: 1200, totalTrips: 19, averageRating: 4.4, isActive: true, vehicleType: 'keke',
    photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80',
    vehicleModel: 'SolarSpeed Tricycle', vehicleColor: 'Lime Green', queuedTripId: null, phoneNumber: '08127773333' },
  { id: 'd4', name: 'Alao Akala', email: 'alao@ucride.uniben.edu', driverIdCode: 'DRV004', kekeId: 18,
    walletBalance: 3200, totalTrips: 45, averageRating: 4.6, isActive: true, vehicleType: 'cab',
    petrolCostToday: 4000, cashCollectedToday: 7500,
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
    vehicleModel: 'Toyota Corolla 2015', vehicleColor: 'Silver Metallic', queuedTripId: null, phoneNumber: '07036664444' },
  { id: 'd5', name: 'Kingsley Ogie', email: 'kingsley@ucride.uniben.edu', driverIdCode: 'DRV005', kekeId: 19,
    walletBalance: 5100, totalTrips: 62, averageRating: 4.8, isActive: true, vehicleType: 'cab',
    petrolCostToday: 0, cashCollectedToday: 0,
    photo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80',
    vehicleModel: 'Lexus ES350 2012', vehicleColor: 'Charcoal Black', queuedTripId: null, phoneNumber: '09015555555' }
];

function generateDefaultKekes(): Keke[] {
  const list: Keke[] = [];
  for (let i = 1; i <= 17; i++) {
    const landmark = LANDMARKS[(i - 1) % LANDMARKS.length];
    list.push({
      id: i, driverId: i <= 3 ? `d${i}` : null,
      plateNumber: `UNIBEN-${i.toString().padStart(2, '0')}K`,
      isOnline: i <= 3, currentSeatsAvailable: 5,
      currentBatteryPercent: 80 - (i * 2), estimatedHoursRemaining: 6,
      lat: landmark.lat + (Math.random() - 0.5) * 0.001,
      lng: landmark.lng + (Math.random() - 0.5) * 0.001,
      speed: 0, vehicleType: 'keke'
    });
  }
  for (let i = 18; i <= 37; i++) {
    const landmark = LANDMARKS[(i - 1) % LANDMARKS.length];
    list.push({
      id: i, driverId: i === 18 ? 'd4' : (i === 19 ? 'd5' : null),
      plateNumber: `UNIBEN-${i.toString().padStart(2, '0')}C`,
      isOnline: i === 18 || i === 19, currentSeatsAvailable: 4,
      currentBatteryPercent: 100, estimatedHoursRemaining: 8,
      lat: landmark.lat + (Math.random() - 0.5) * 0.001,
      lng: landmark.lng + (Math.random() - 0.5) * 0.001,
      speed: 0, vehicleType: 'cab'
    });
  }
  return list;
}

// Context Type
interface USRideContextType {
  riders: Rider[];
  drivers: Driver[];
  kekes: Keke[];
  trips: Trip[];
  transactions: WalletTransaction[];
  currentRider: Rider | null;
  currentDriver: Driver | null;
  currentKeke: Keke | null;
  activeView: 'rider' | 'driver' | 'admin' | 'simulator';
  setActiveView: (view: 'rider' | 'driver' | 'admin' | 'simulator') => void;
  
  // Auth Functions
  riderLogin: (email: string) => Promise<boolean>;
  riderRegister: (name: string, email: string, role: 'student' | 'staff' | 'other', phoneNumber: string) => Promise<boolean>;
  riderLogout: () => void;
  driverLogin: (driverIdCode: string) => Promise<boolean>;
  driverLogout: () => void;
  
  // Driver Keke controls
  toggleDriverOnline: () => void;
  updateKekeEnergy: (batteryPercent: number, hoursRemaining: number) => void;
  updateCabFinancials: (petrolCost: number, cashCollected: number) => void;
  withdrawEarnings: (amount: number, bankName: string, accountNumber: string) => Promise<boolean>;
  updateVehicleLocation: (lat: number, lng: number) => Promise<void>;
  
  // Booking Functions
  bookRide: (rideType: 'shared' | 'drop', vehicleType: 'keke' | 'cab', pickupId: string, destId: string, seatsBooked?: number) => Promise<Trip | null>;
  cancelRide: (tripId: string) => void;
  riderTopUpWallet: (amount: number) => void;
  addRiderCard: (card: Omit<SavedCard, 'id'>) => void;
  removeRiderCard: (cardId: string) => void;
  
  // Driver ride flows
  acceptTrip: (tripId: string) => void;
  declineTrip: (tripId: string) => void;
  confirmBoarded: (tripId: string) => void;
  completeTrip: (tripId: string) => void;
  rateUser: (tripId: string, rating: number, isRatingDriver: boolean) => void;
  chargeKeke: () => void;
  adminRegisterDriver: (name: string, email: string, driverIdCode: string, vehicleType: 'keke' | 'cab', vehicleIdOrPlate: string, phoneNumber?: string, photo?: string) => void;
  updateRiderProfile: (phoneNumber: string, photo: string) => void;
  updateDriverProfile: (phoneNumber: string, photo: string) => void;
  resetSimulatorDatabase: () => void;
  safetyIncidents: SafetyIncident[];
  triggerSOSAlert: (riderId: string, landmarkName: string, description: string) => void;
  modalConfig: AppNotification | null;
  showModal: (config: AppNotification) => void;
  hideModal: () => void;
}

const USRideContext = createContext<USRideContextType | undefined>(undefined);

export const USRideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<'rider' | 'driver' | 'admin' | 'simulator'>('simulator');

  // ─── 1. State initialized from localStorage (falls back to defaults) ─────
  const [riders, setRiders] = useState<Rider[]>(() => lsGet(LS_KEYS.riders, INITIAL_RIDERS));
  const [drivers, setDrivers] = useState<Driver[]>(() => lsGet(LS_KEYS.drivers, INITIAL_DRIVERS));
  const [kekes, setKekes] = useState<Keke[]>(() => lsGet(LS_KEYS.kekes, generateDefaultKekes()));
  const [trips, setTrips] = useState<Trip[]>(() => lsGet(LS_KEYS.trips, []));
  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => lsGet(LS_KEYS.transactions, []));
  const [safetyIncidents, setSafetyIncidents] = useState<SafetyIncident[]>(() => lsGet(LS_KEYS.safetyIncidents, []));
  const [modalConfig, setModalConfig] = useState<AppNotification | null>(null);


  const showModal = (config: AppNotification) => setModalConfig(config);
  const hideModal = () => setModalConfig(null);

  // ─── Auth state (session restored from localStorage) ─────────────────────
  const [currentRider, setCurrentRider] = useState<Rider | null>(() => {
    const savedId = localStorage.getItem(LS_KEYS.currentRiderId);
    if (!savedId) return null;
    const saved: Rider[] = lsGet(LS_KEYS.riders, INITIAL_RIDERS);
    return saved.find(r => r.id === savedId) || null;
  });
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(() => {
    const savedId = localStorage.getItem(LS_KEYS.currentDriverId);
    if (!savedId) return null;
    const saved: Driver[] = lsGet(LS_KEYS.drivers, INITIAL_DRIVERS);
    return saved.find(d => d.id === savedId) || null;
  });
  const [currentKeke, setCurrentKeke] = useState<Keke | null>(null);

  // ─── 2. localStorage sync effects ─────────────────────────────────────────
  useEffect(() => { lsSet(LS_KEYS.riders, riders); }, [riders]);
  useEffect(() => { lsSet(LS_KEYS.drivers, drivers); }, [drivers]);
  useEffect(() => { lsSet(LS_KEYS.kekes, kekes); }, [kekes]);
  useEffect(() => { lsSet(LS_KEYS.trips, trips); }, [trips]);
  useEffect(() => { lsSet(LS_KEYS.transactions, transactions); }, [transactions]);
  useEffect(() => { lsSet(LS_KEYS.safetyIncidents, safetyIncidents); }, [safetyIncidents]);
  useEffect(() => {
    if (currentRider) lsSet(LS_KEYS.currentRiderId, currentRider.id);
    else lsDel(LS_KEYS.currentRiderId);
  }, [currentRider]);
  useEffect(() => {
    if (currentDriver) lsSet(LS_KEYS.currentDriverId, currentDriver.id);
    else lsDel(LS_KEYS.currentDriverId);
  }, [currentDriver]);

  // ─── 3. Supabase bootstrap — load fresh data on mount ─────────────────────
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const [sbRiders, sbDrivers, sbVehicles, sbTrips, sbTx, sbSos] = await Promise.all([
          fetchAllRiders(), fetchAllDrivers(), fetchAllVehicles(),
          fetchAllTrips(), fetchAllTransactions(), fetchAllIncidents()
        ]);
        if (cancelled) return;
        if (sbRiders.length > 0)  { setRiders(sbRiders);  lsSet(LS_KEYS.riders, sbRiders); }
        if (sbDrivers.length > 0) { setDrivers(sbDrivers); lsSet(LS_KEYS.drivers, sbDrivers); }
        if (sbVehicles.length > 0){ setKekes(sbVehicles);  lsSet(LS_KEYS.kekes, sbVehicles); }
        setTrips(sbTrips);         lsSet(LS_KEYS.trips, sbTrips);
        setTransactions(sbTx);     lsSet(LS_KEYS.transactions, sbTx);
        setSafetyIncidents(sbSos); lsSet(LS_KEYS.safetyIncidents, sbSos);

        // Restore logged-in session from localStorage IDs against fresh Supabase data
        const riderId = localStorage.getItem(LS_KEYS.currentRiderId);
        const driverId = localStorage.getItem(LS_KEYS.currentDriverId);
        if (riderId) { const r = sbRiders.find(x => x.id === riderId); if (r) setCurrentRider(r); }
        if (driverId){ const d = sbDrivers.find(x => x.id === driverId); if (d) setCurrentDriver(d); }
      } catch (err) {
        // Network unavailable — silently keep localStorage data already in state
        console.warn('[USRide] Supabase unreachable, running on local cache:', err);
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 4. Supabase Realtime Listener ───────────────────────────────────────
  useEffect(() => {
    // 1. Trips Channel
    const tripsChannel = supabase
      .channel('realtime-trips')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        (payload) => {
          console.log('[Realtime] Trip change received:', payload);
          if (payload.eventType === 'INSERT') {
            const freshTrip = dbToTrip(payload.new);
            setTrips(prev => {
              if (prev.some(t => t.id === freshTrip.id)) return prev;
              return [freshTrip, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const freshTrip = dbToTrip(payload.new);
            setTrips(prev => prev.map(t => t.id === freshTrip.id ? freshTrip : t));
          } else if (payload.eventType === 'DELETE') {
            setTrips(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 2. Vehicles Channel
    const vehiclesChannel = supabase
      .channel('realtime-vehicles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicles' },
        (payload) => {
          console.log('[Realtime] Vehicle change received:', payload);
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const freshKeke = dbToKeke(payload.new);
            setKekes(prev => {
              const exists = prev.some(k => k.id === freshKeke.id);
              if (exists) {
                return prev.map(k => k.id === freshKeke.id ? freshKeke : k);
              } else {
                return [...prev, freshKeke];
              }
            });
          } else if (payload.eventType === 'DELETE') {
            setKekes(prev => prev.filter(k => k.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 3. Drivers Channel
    const driversChannel = supabase
      .channel('realtime-drivers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        (payload) => {
          console.log('[Realtime] Driver change received:', payload);
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const freshDriver = dbToDriver(payload.new);
            setDrivers(prev => {
              const exists = prev.some(d => d.id === freshDriver.id);
              if (exists) {
                return prev.map(d => {
                  if (d.id === freshDriver.id) {
                    // Preserve local photo if DB returned none
                    return { ...freshDriver, photo: freshDriver.photo || d.photo };
                  }
                  return d;
                });
              } else {
                return [...prev, freshDriver];
              }
            });
            setCurrentDriver(prev => {
              if (prev && prev.id === freshDriver.id) {
                // Preserve local photo if DB returned none
                return { ...freshDriver, photo: freshDriver.photo || prev.photo };
              }
              return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            setDrivers(prev => prev.filter(d => d.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 4. Riders Channel
    const ridersChannel = supabase
      .channel('realtime-riders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'riders' },
        (payload) => {
          console.log('[Realtime] Rider change received:', payload);
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setRiders(prev => {
              const matched = prev.find(r => r.id === payload.new.id);
              const freshRider = dbToRider(payload.new, matched?.savedCards || []);
              const exists = prev.some(r => r.id === freshRider.id);
              if (exists) {
                return prev.map(r => {
                  if (r.id === freshRider.id) {
                    // Preserve local photo if DB returned none
                    return { ...freshRider, photo: freshRider.photo || r.photo };
                  }
                  return r;
                });
              } else {
                return [...prev, freshRider];
              }
            });
            setCurrentRider(prev => {
              if (prev && prev.id === payload.new.id) {
                const incoming = dbToRider(payload.new, prev.savedCards || []);
                // Preserve local photo if DB returned none
                return { ...incoming, photo: incoming.photo || prev.photo };
              }
              return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            setRiders(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 5. Safety Incidents Channel
    const incidentsChannel = supabase
      .channel('realtime-incidents')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'safety_incidents' },
        (payload) => {
          console.log('[Realtime] Incident change received:', payload);
          if (payload.eventType === 'INSERT') {
            const freshIncident = dbToIncident(payload.new);
            setSafetyIncidents(prev => {
              if (prev.some(i => i.id === freshIncident.id)) return prev;
              return [freshIncident, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const freshIncident = dbToIncident(payload.new);
            setSafetyIncidents(prev => prev.map(i => i.id === freshIncident.id ? freshIncident : i));
          } else if (payload.eventType === 'DELETE') {
            setSafetyIncidents(prev => prev.filter(i => i.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 6. Transactions Channel
    const transactionsChannel = supabase
      .channel('realtime-transactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_transactions' },
        (payload) => {
          console.log('[Realtime] Transaction change received:', payload);
          if (payload.eventType === 'INSERT') {
            const freshTx = dbToTransaction(payload.new);
            setTransactions(prev => {
              if (prev.some(t => t.id === freshTx.id)) return prev;
              return [freshTx, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      tripsChannel.unsubscribe();
      vehiclesChannel.unsubscribe();
      driversChannel.unsubscribe();
      ridersChannel.unsubscribe();
      incidentsChannel.unsubscribe();
      transactionsChannel.unsubscribe();
    };
  }, []);

  // Sync currentKeke whenever kekes list or driver changes
  useEffect(() => {
    if (currentDriver) {
      const match = kekes.find(k => k.id === currentDriver.kekeId);
      if (match) setCurrentKeke(match);
    } else {
      setCurrentKeke(null);
    }
  }, [kekes, currentDriver]);

  // Sync currentRider whenever riders list changes (balance, totalTrips, etc.)
  useEffect(() => {
    if (currentRider) {
      const match = riders.find(r => r.id === currentRider.id);
      if (match) setCurrentRider(match);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riders]);

  // 2. Rider Auth
  const riderLogin = async (email: string) => {
    const found = riders.find(r => r.email.toLowerCase() === email.toLowerCase());
    if (found) {
      setCurrentRider(found);
      return true;
    }
    return false;
  };

  const riderRegister = async (name: string, email: string, role: 'student' | 'staff' | 'other', phoneNumber: string) => {
    if (riders.some(r => r.email.toLowerCase() === email.toLowerCase())) {
      return false;
    }
    const newRider: Rider = {
      id: `r${Date.now()}`,
      name, email, role, phoneNumber,
      walletBalance: 0, totalTrips: 0, averageRating: 5.0,
      photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'
    };
    setRiders(prev => [...prev, newRider]);
    setCurrentRider(newRider);
    upsertRider(newRider).catch(console.error);
    return true;
  };

  const riderLogout = () => {
    setCurrentRider(null);
  };

  // 3. Driver Auth
  const driverLogin = async (driverIdCode: string) => {
    const found = drivers.find(d => d.driverIdCode.toUpperCase() === driverIdCode.toUpperCase() && d.isActive);
    if (found) {
      setCurrentDriver(found);
      // Synchronously set their keke to prevent any split-second loading flickers in DriverView
      const match = kekes.find(k => k.id === found.kekeId);
      if (match) setCurrentKeke(match);

      // Set their keke online
      setKekes(prev => prev.map(k => {
        if (k.id === found.kekeId) {
          const updated = { ...k, driverId: found.id, isOnline: true };
          upsertVehicle(updated).catch(console.error);
          return updated;
        }
        return k;
      }));
      return true;
    }
    return false;
  };

  const driverLogout = () => {
    if (currentDriver) {
      // Set their keke offline
      setKekes(prev => prev.map(k => {
        if (k.id === currentDriver.kekeId) {
          const updated = { ...k, isOnline: false };
          upsertVehicle(updated).catch(console.error);
          return updated;
        }
        return k;
      }));
    }
    setCurrentDriver(null);
  };

  // Online status toggle
  const toggleDriverOnline = () => {
    if (!currentDriver) return;
    setKekes(prev => prev.map(k => {
      if (k.id === currentDriver.kekeId) {
        const updated = { ...k, isOnline: !k.isOnline };
        upsertVehicle(updated).catch(console.error);
        return updated;
      }
      return k;
    }));
  };

  // Driver energy update
  const updateKekeEnergy = (batteryPercent: number, hoursRemaining: number) => {
    if (!currentDriver) return;
    setKekes(prev => prev.map(k => {
      if (k.id === currentDriver.kekeId) {
        const updated = { 
          ...k, 
          currentBatteryPercent: batteryPercent,
          estimatedHoursRemaining: hoursRemaining 
        };
        upsertVehicle(updated).catch(console.error);
        return updated;
      }
      return k;
    }));
  };

  // Update vehicle position in DB
  const updateVehicleLocation = async (lat: number, lng: number) => {
    if (!currentDriver || !currentKeke) return;
    const updatedKeke: Keke = {
      ...currentKeke,
      lat,
      lng
    };
    setCurrentKeke(updatedKeke);
    setKekes(prev => prev.map(k => k.id === currentKeke.id ? updatedKeke : k));
    try {
      await upsertVehicle(updatedKeke);
      console.log(`[GPS Sync] Updated vehicle ${currentKeke.id} position in database to lat: ${lat}, lng: ${lng}`);
    } catch (err) {
      console.error('[GPS Sync] Failed to update vehicle position in database:', err);
    }
  };

  const updateCabFinancials = (petrolCost: number, cashCollected: number) => {
    if (!currentDriver) return;
    setDrivers(prev => prev.map(d => {
      if (d.id === currentDriver.id) {
        const updated = { 
          ...d, 
          petrolCostToday: petrolCost,
          cashCollectedToday: cashCollected 
        };
        setCurrentDriver(updated);
        upsertDriver(updated).catch(console.error);
        return updated;
      }
      return d;
    }));
  };

  // Withdraw Driver Earnings via secure Paystack Transfer Edge Function
  const withdrawEarnings = async (amount: number, bankCode: string, accountNumber: string): Promise<boolean> => {
    if (!currentDriver) return false;
    if (currentDriver.walletBalance < amount) return false;

    // Helper function to process mock/fallback payout locally
    const processLocalFallback = async (reasonMsg: string) => {
      console.log(`[Payout Fallback] ${reasonMsg} - falling back to client-side database simulation`);
      
      const newBalance = currentDriver.walletBalance - amount;
      
      try {
        // 1. Update DB directly
        await updateDriverBalance(currentDriver.id, newBalance, currentDriver.totalTrips);
        
        // 2. Insert transaction log
        const txCode = `fallback-trf-${Date.now()}`;
        const newTx: WalletTransaction = {
          id: `tx-out-${txCode}`,
          userId: currentDriver.id,
          userType: 'driver',
          type: 'withdrawal',
          amount: amount,
          reference: `FALLBACK-REF-${Date.now()}`,
          description: `Payout to Bank (${accountNumber}) - Simulated Sandbox Mode`,
          createdAt: new Date().toISOString()
        };
        
        setTransactions(prev => [newTx, ...prev]);
        await insertTransaction(newTx);
        
        // 3. Update local state
        setDrivers(prev => prev.map(d => {
          if (d.id === currentDriver.id) {
            return { ...d, walletBalance: newBalance };
          }
          return d;
        }));
        setCurrentDriver(prev => prev ? { ...prev, walletBalance: newBalance } : null);

        showModal({
          title: "Simulated Payout Success",
          message: `⚠️ Edge Function offline/unreachable.\nProcessed locally: Deducted ₦${amount.toLocaleString()} and logged simulated payout.`,
          type: 'success'
        });
        return true;
      } catch (dbErr) {
        console.error('[Payout Fallback] Local database update failed:', dbErr);
        showModal({
          title: "Payout Failed",
          message: "Could not connect to Edge Function, and local database sync failed.",
          type: 'error'
        });
        return false;
      }
    };

    // If using the sandbox Test Bank (001), execute local processing immediately
    // to bypass potential Paystack sandbox limits or Edge Function issues
    if (bankCode === '001') {
      return await processLocalFallback("Test Bank 001 selected");
    }

    try {
      const { data, error } = await supabase.functions.invoke('paystack-payout', {
        body: {
          driverId: currentDriver.id,
          bankCode,
          accountNumber,
          amount
        }
      });

      if (error || !data || !data.success) {
        console.error('[Payout] Payout failed:', error || data);
        // Fallback to local processing if edge function returned specific errors or failed
        return await processLocalFallback(error?.message || data?.error || "Paystack transfer failed");
      }

      // Calculate new balance
      const newBalance = currentDriver.walletBalance - amount;

      // Update local drivers state list
      setDrivers(prev => prev.map(d => {
        if (d.id === currentDriver.id) {
          return { ...d, walletBalance: newBalance };
        }
        return d;
      }));

      // Immediately update currentDriver context
      setCurrentDriver(prev => prev ? { ...prev, walletBalance: newBalance } : null);

      return true;
    } catch (err) {
      console.error('[Payout] Connection error:', err);
      // Fallback to local processing if connection times out or fails
      return await processLocalFallback("Edge Function connection timed out/failed");
    }
  };

  // 4. Rider Booking Flow
  const bookRide = async (rideType: 'shared' | 'drop', vehicleType: 'keke' | 'cab', pickupId: string, destId: string, seatsBooked = 1) => {
    if (!currentRider) return null;
    
    const baseFare = rideType === 'drop' 
      ? (vehicleType === 'keke' ? 500 : 1000) 
      : (vehicleType === 'keke' ? 100 : 250);
    const seats = rideType === 'drop'
      ? (vehicleType === 'keke' ? 5 : 4)
      : seatsBooked;
    const totalFare = rideType === 'drop'
      ? baseFare
      : baseFare * seats;
    const transferFee = 20;
    const totalCost = totalFare + transferFee;

    if (currentRider.walletBalance < totalCost) {
      showModal({
        title: "Insufficient Balance",
        message: "❌ Insufficient wallet balance. Please top up in your wallet tab!",
        type: 'error'
      });
      return null;
    }

    const pickup = LANDMARKS.find(l => l.id === pickupId);
    const dest = LANDMARKS.find(l => l.id === destId);
    if (!pickup || !dest) return null;

    // Fetch route from Google Directions API
    const route = await fetchGoogleRoute(pickup.lat, pickup.lng, dest.lat, dest.lng, GOOGLE_MAPS_API_KEY);

    // ─── Proximity Matching: Find eligible drivers within radius ──────────
    const onlineVehiclesOfType = kekes.filter(k => k.isOnline && k.vehicleType === vehicleType);
    const RADIUS_1 = 1000; // 1km primary search radius
    const RADIUS_2 = 2000; // 2km fallback radius

    // Calculate distances from each online vehicle to pickup
    const vehicleDistances = onlineVehiclesOfType.map(k => {
      const dist = getDistanceMeters(k.lat, k.lng, pickup.lat, pickup.lng);
      return { vehicleId: k.id, driverId: k.driverId, distance: dist };
    }).filter(v => v.driverId !== null);

    // First try 1km radius, then fallback to 2km
    let eligibleDriverIds = vehicleDistances
      .filter(v => v.distance <= RADIUS_1)
      .map(v => v.driverId as string);

    if (eligibleDriverIds.length === 0) {
      eligibleDriverIds = vehicleDistances
        .filter(v => v.distance <= RADIUS_2)
        .map(v => v.driverId as string);
    }

    // If still no drivers found within 2km, allow all online drivers of this vehicle type
    if (eligibleDriverIds.length === 0) {
      eligibleDriverIds = vehicleDistances.map(v => v.driverId as string);
    }

    if (eligibleDriverIds.length === 0) {
      showModal({
        title: "No Drivers Available",
        message: "😔 No drivers of the selected vehicle type are currently online. Please try again shortly.",
        type: 'warning'
      });
      return null;
    }

    // Create new Trip with eligible driver list
    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      rideType,
      vehicleType,
      riderIds: [currentRider.id],
      riderNames: [currentRider.name],
      driverId: null,
      kekeId: null,
      pickupLandmark: pickup.name,
      destinationLandmark: dest.name,
      pickupLocation: { lat: pickup.lat, lng: pickup.lng },
      destinationLocation: { lat: dest.lat, lng: dest.lng },
      status: 'requested',
      farePerPerson: baseFare,
      transferFee: transferFee,
      totalFare: totalFare,
      energyUsedPercent: 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
      routeCoords: route,
      seatsBooked: seats,
      eligibleDriverIds
    };

    console.log(`[Proximity] Trip ${newTrip.id}: ${eligibleDriverIds.length} eligible driver(s) within range`);

    setTrips(prev => [...prev, newTrip]);
    insertTrip(newTrip).catch(console.error);

    // 90-second accept window timeout
    setTimeout(() => {
      setTrips(prev => {
        const trip = prev.find(t => t.id === newTrip.id);
        if (trip && trip.status === 'requested') {
          showModal({
            title: "Booking Timeout",
            message: "⏱️ No driver accepted your request within 90 seconds. The request has been cancelled.",
            type: 'warning'
          });
          // Persist cancellation to DB so all tabs see the update via Realtime
          updateTripStatus(newTrip.id, 'cancelled').catch(console.error);
          return prev.map(t => t.id === newTrip.id ? { ...t, status: 'cancelled' as const } : t);
        }
        return prev;
      });
    }, 90000);

    return newTrip;
  };

  // Cancel ride
  const cancelRide = (tripId: string) => {
    setTrips(prev => prev.map(t => {
      if (t.id === tripId) {
        return { ...t, status: 'cancelled' as const };
      }
      return t;
    }));
    updateTripStatus(tripId, 'cancelled').catch(console.error);

    // Release keke seats if driver was already assigned
    const trip = trips.find(t => t.id === tripId);
    if (trip && trip.kekeId) {
      setKekes(prev => prev.map(k => {
        if (k.id === trip.kekeId) {
          const maxSeats = k.vehicleType === 'keke' ? 5 : 4;
          const releasedSeats = trip.seatsBooked || (trip.rideType === 'drop' ? maxSeats : 1);
          const updatedKeke = { ...k, currentSeatsAvailable: Math.min(maxSeats, k.currentSeatsAvailable + releasedSeats) };
          upsertVehicle(updatedKeke).catch(console.error);
          return updatedKeke;
        }
        return k;
      }));
    }
  };

  // Top Up Rider Wallet
  const riderTopUpWallet = (amount: number) => {
    if (!currentRider) return;

    const newBalance = currentRider.walletBalance + amount;

    // Update local state list
    setRiders(prev => prev.map(r => {
      if (r.id === currentRider.id) {
        return { ...r, walletBalance: newBalance };
      }
      return r;
    }));

    // Immediately update currentRider context
    setCurrentRider(prev => prev ? { ...prev, walletBalance: newBalance } : null);

    // Log transaction
    const newTx: WalletTransaction = {
      id: `tx-${Date.now()}`,
      userId: currentRider.id,
      userType: 'rider',
      type: 'credit',
      amount,
      reference: `PSTK-DEP-${Math.floor(Math.random() * 10000000)}`,
      description: 'Wallet Top Up via Card',
      createdAt: new Date().toISOString()
    };
    setTransactions(prev => [newTx, ...prev]);
    insertTransaction(newTx).catch(console.error);

    // Persist updated balance directly to database
    updateRiderBalance(currentRider.id, newBalance, currentRider.totalTrips).catch(console.error);
  };

  const addRiderCard = (card: Omit<SavedCard, 'id'>) => {
    if (!currentRider) return;
    const newCard: SavedCard = {
      ...card,
      id: `card-${Date.now()}`
    };
    setRiders(prev => prev.map(r => {
      if (r.id === currentRider.id) {
        const updatedCards = [...(r.savedCards || []), newCard];
        const updated = { ...r, savedCards: updatedCards };
        setCurrentRider(updated);
        upsertRider(updated).catch(console.error);
        return updated;
      }
      return r;
    }));
  };

  const removeRiderCard = (cardId: string) => {
    if (!currentRider) return;
    setRiders(prev => prev.map(r => {
      if (r.id === currentRider.id) {
        const updatedCards = (r.savedCards || []).filter(c => c.id !== cardId);
        const updated = { ...r, savedCards: updatedCards };
        setCurrentRider(updated);
        upsertRider(updated).catch(console.error);
        return updated;
      }
      return r;
    }));
  };

  // 5. Driver Operation Controls
  const acceptTrip = (tripId: string) => {
    if (!currentDriver) return;
    
    const currentTrip = trips.find(t => t.id === tripId);
    if (!currentTrip || currentTrip.status !== 'requested') {
      showModal({
        title: "Trip Unavailable",
        message: "⌛ This trip request has timed out or was cancelled by the rider.",
        type: 'warning'
      });
      return;
    }
    
    setTrips(prev => prev.map(t => {
      if (t.id === tripId) {
        return { ...t, status: 'accepted' as const, driverId: currentDriver.id, kekeId: currentDriver.kekeId };
      }
      return t;
    }));
    updateTripStatus(tripId, 'accepted', { driverId: currentDriver.id, vehicleId: currentDriver.kekeId }).catch(console.error);

    // Book the seats on the Keke
    const maxSeats = currentDriver.vehicleType === 'keke' ? 5 : 4;
    const bookedSeats = currentTrip.seatsBooked || (currentTrip.rideType === 'drop' ? maxSeats : 1);
    setKekes(prev => prev.map(k => {
      if (k.id === currentDriver.kekeId) {
        return { 
          ...k, 
          currentSeatsAvailable: Math.max(0, k.currentSeatsAvailable - bookedSeats) 
        };
      }
      return k;
    }));
  };

  const declineTrip = (tripId: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (trip && trip.status === 'requested') {
      setTrips(prev => prev.map(t => {
        if (t.id === tripId) {
          return { ...t, status: 'cancelled' as const };
        }
        return t;
      }));
      updateTripStatus(tripId, 'cancelled').catch(console.error);
      showModal({
        title: "Booking Cancelled",
        message: "🛺 The driver declined your request. Your trip has been cancelled.",
        type: 'warning'
      });
    }
  };

  const confirmBoarded = (tripId: string) => {
    setTrips(prev => prev.map(t => {
      if (t.id === tripId) return { ...t, status: 'active' as const };
      return t;
    }));
    updateTripStatus(tripId, 'active').catch(console.error);
  };

  const completeTrip = (tripId: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    // 1. Calculate mock energy drain based on trip distance (straight-line calculation)
    const dy = trip.destinationLocation.lat - trip.pickupLocation.lat;
    const dx = trip.destinationLocation.lng - trip.pickupLocation.lng;
    const distanceEst = Math.sqrt(dx*dx + dy*dy) * 100; // rough km factor
    const batteryDrain = Math.max(2, Math.min(15, Math.ceil(distanceEst * 8))); // 2% to 15% drain

    // 2. Update trip status & trigger queued trip if back-to-back exists
    setTrips(prev => {
      const nextTrips = prev.map(t => {
        if (t.id === tripId) {
          return { 
            ...t, 
            status: 'completed' as const, 
            completedAt: new Date().toISOString(),
            energyUsedPercent: trip.vehicleType === 'keke' ? batteryDrain : 0
          };
        }
        return t;
      });

      // Find if there is a back-to-back queued trip (accepted and belongs to same driver)
      if (trip.driverId) {
        const queued = nextTrips.find(t => t.driverId === trip.driverId && t.status === 'accepted');
        if (queued) {
          return nextTrips.map(t => t.id === queued.id ? { ...t, status: 'active' as const } : t);
        }
      }
      return nextTrips;
    });

    // 3. Debit Riders & Credit Drivers
    const fare = trip.totalFare;
    const transferFee = trip.transferFee || 20;
    const totalCharged = trip.totalFare + transferFee;

    // Debit riders — calculate updates synchronously first
    const ridersToUpdate = riders.filter(r => trip.riderIds.includes(r.id));
    const updatedRidersList = ridersToUpdate.map(r => ({
      ...r,
      walletBalance: Math.max(0, r.walletBalance - totalCharged),
      totalTrips: r.totalTrips + 1
    }));

    // Update local state list
    setRiders(prev => prev.map(r => {
      const match = updatedRidersList.find(u => u.id === r.id);
      return match ? match : r;
    }));

    // Immediately update currentRider if they are one of the deducted riders
    if (currentRider && trip.riderIds.includes(currentRider.id)) {
      const match = updatedRidersList.find(u => u.id === currentRider.id);
      if (match) {
        setCurrentRider(match);
      }
    }

    // Persist only balance + totalTrips to Supabase (avoids saved_cards re-write)
    updatedRidersList.forEach(r => {
      updateRiderBalance(r.id, r.walletBalance, r.totalTrips).catch(console.error);
    });

    // Log & persist rider debit transactions
    trip.riderIds.forEach((rId, idx) => {
      const riderTx: WalletTransaction = {
        id: `tx-deb-${Date.now()}-${idx}-${rId}`,
        userId: rId,
        userType: 'rider',
        type: 'debit',
        amount: totalCharged,
        reference: `TRIP-FARE-${trip.id.substring(5, 12)}`,
        description: `${trip.vehicleType === 'keke' ? 'USRide' : 'UCRide'} Fare: ${trip.pickupLandmark} ➔ ${trip.destinationLandmark} (Fee ₦${transferFee})`,
        createdAt: new Date().toISOString()
      };
      setTransactions(prev => [riderTx, ...prev]);
      insertTransaction(riderTx).catch(console.error);
    });

    // Credit driver — calculate updates synchronously first
    if (trip.driverId) {
      const driverToUpdate = drivers.find(d => d.id === trip.driverId);
      if (driverToUpdate) {
        const updatedDriver = {
          ...driverToUpdate,
          walletBalance: driverToUpdate.walletBalance + fare,
          totalTrips: driverToUpdate.totalTrips + 1
        };

        // Update local drivers state list
        setDrivers(prev => prev.map(d => d.id === trip.driverId ? updatedDriver : d));

        // Immediately update currentDriver if it's the same driver
        if (currentDriver && currentDriver.id === trip.driverId) {
          setCurrentDriver(updatedDriver);
        }

        // Persist balance only
        updateDriverBalance(updatedDriver.id, updatedDriver.walletBalance, updatedDriver.totalTrips).catch(console.error);
      }

      // Log Driver credit
      const driverTx: WalletTransaction = {
        id: `tx-crd-${Date.now()}`,
        userId: trip.driverId,
        userType: 'driver',
        type: 'credit',
        amount: fare,
        reference: `EARN-TRIP-${trip.id.substring(5, 12)}`,
        description: `Earnings: ${trip.rideType === 'drop' ? 'Drop Ride' : 'Shared Ride'}`,
        createdAt: new Date().toISOString()
      };
      setTransactions(prev => [driverTx, ...prev]);
      insertTransaction(driverTx).catch(console.error);
    }


    // 4. Reset keke seats & reduce battery
    setKekes(prev => prev.map(k => {
      if (k.id === trip.kekeId) {
        const maxSeats = k.vehicleType === 'keke' ? 5 : 4;
        const releasedSeats = trip.seatsBooked || (trip.rideType === 'drop' ? maxSeats : 1);
        if (k.vehicleType === 'keke') {
          const newBattery = Math.max(0, k.currentBatteryPercent - batteryDrain);
          const hoursRemaining = Math.max(0, Math.round((newBattery / 100) * 8 * 10) / 10);
          const updated = { ...k, currentSeatsAvailable: Math.min(maxSeats, k.currentSeatsAvailable + releasedSeats), currentBatteryPercent: newBattery, estimatedHoursRemaining: hoursRemaining };
          upsertVehicle(updated).catch(console.error);
          return updated;
        } else {
          const updated = { ...k, currentSeatsAvailable: Math.min(maxSeats, k.currentSeatsAvailable + releasedSeats) };
          upsertVehicle(updated).catch(console.error);
          return updated;
        }
      }
      return k;
    }));
    updateTripStatus(tripId, 'completed', { completedAt: new Date().toISOString() }).catch(console.error);
  };

  const rateUser = (tripId: string, rating: number, isRatingDriver: boolean) => {
    // In a real app we'd recalculate averages and save to backend.
    // For our simulation, we just complete the flow.
  };

  // Solar charging simulation
  const chargeKeke = () => {
    if (!currentDriver) return;
    setKekes(prev => prev.map(k => {
      if (k.id === currentDriver.kekeId) {
        return {
          ...k,
          currentBatteryPercent: 100,
          estimatedHoursRemaining: 8
        };
      }
      return k;
    }));
    showModal({
      title: "Solar Charging Complete",
      message: "🔌 Solar Charging Completed! Tricycle battery is at 100%.",
      type: 'success'
    });
  };

  // Admin Driver Onboarding
  const adminRegisterDriver = (name: string, email: string, driverIdCode: string, vehicleType: 'keke' | 'cab', vehicleIdOrPlate: string, phoneNumber?: string, photo?: string) => {
    const nextDriverId = `d${drivers.length + 1}`;
    let assignedVehicleId = 0;

    if (vehicleType === 'keke') {
      assignedVehicleId = parseInt(vehicleIdOrPlate);
      // Assign driver to existing Keke
      setKekes(prev => prev.map(k => {
        if (k.id === assignedVehicleId) {
          return { ...k, driverId: nextDriverId, isOnline: true };
        }
        return k;
      }));
    } else {
      // Cab: create new vehicle dynamically
      assignedVehicleId = Math.max(...kekes.map(k => k.id)) + 1;
      const landmark = LANDMARKS[Math.floor(Math.random() * LANDMARKS.length)];
      const newCab: Keke = {
        id: assignedVehicleId,
        driverId: nextDriverId,
        plateNumber: vehicleIdOrPlate.toUpperCase(),
        isOnline: true,
        currentSeatsAvailable: 4,
        currentBatteryPercent: 100,
        estimatedHoursRemaining: 8,
        lat: landmark.lat + (Math.random() - 0.5) * 0.001,
        lng: landmark.lng + (Math.random() - 0.5) * 0.001,
        speed: 0,
        vehicleType: 'cab'
      };
      setKekes(prev => [...prev, newCab]);
    }

    const newDrv: Driver = {
      id: nextDriverId,
      name,
      email,
      driverIdCode: driverIdCode.toUpperCase(),
      kekeId: assignedVehicleId,
      walletBalance: 0,
      totalTrips: 0,
      averageRating: 5.0,
      isActive: true,
      vehicleType,
      phoneNumber: phoneNumber || ('081' + Math.floor(10000000 + Math.random() * 90000000)),
      photo: photo || (vehicleType === 'keke'
        ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
        : 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80')
    };

    setDrivers(prev => [...prev, newDrv]);
    upsertDriver(newDrv).catch(console.error);
  };

  const updateRiderProfile = (phoneNumber: string, photo: string) => {
    if (!currentRider) return;
    setRiders(prev => prev.map(r => {
      if (r.id === currentRider.id) {
        const updated = { ...r, phoneNumber, photo };
        setCurrentRider(updated);
        upsertRider(updated).catch(console.error);
        return updated;
      }
      return r;
    }));
  };

  const updateDriverProfile = (phoneNumber: string, photo: string) => {
    if (!currentDriver) return;
    setDrivers(prev => prev.map(d => {
      if (d.id === currentDriver.id) {
        const updated = { ...d, phoneNumber, photo };
        setCurrentDriver(updated);
        upsertDriver(updated).catch(console.error);
        return updated;
      }
      return d;
    }));
  };

  const triggerSOSAlert = (riderId: string, landmarkName: string, description: string) => {
    const rider = riders.find(r => r.id === riderId);
    
    // Find active trip for this rider to capture assigned driver details
    const activeTrip = trips.find(t => 
      t.riderIds.includes(riderId) && 
      (t.status === 'accepted' || t.status === 'active')
    );
    
    let matchedDriver: Driver | undefined;
    let matchedKeke: Keke | undefined;
    if (activeTrip && activeTrip.driverId) {
      matchedDriver = drivers.find(d => d.id === activeTrip.driverId);
      if (activeTrip.kekeId) {
        matchedKeke = kekes.find(k => k.id === activeTrip.kekeId);
      }
    }

    const newIncident: SafetyIncident = {
      id: `sos-${Date.now()}`,
      riderId,
      riderName: rider?.name || 'Unknown Rider',
      riderPhone: rider?.phoneNumber || 'N/A',
      landmarkName,
      timestamp: new Date().toISOString(),
      status: 'active',
      description: description || 'General Emergency Alert',
      driverName: matchedDriver?.name,
      driverPhone: matchedDriver?.phoneNumber || 'N/A',
      driverCode: matchedDriver?.driverIdCode,
      vehiclePlate: matchedKeke?.plateNumber
    };
    setSafetyIncidents(prev => [newIncident, ...prev]);
    insertIncident(newIncident).catch(console.error);
  };

  // 6. REAL-TIME MOVEMENT SIMULATION ENGINE
  // Run a clock every 1.5 seconds to move Kekes that are on active/accepted trips
  useEffect(() => {
    const interval = setInterval(() => {
      setKekes(prevKekes => {
        let updated = false;
        const nextKekes = prevKekes.map(keke => {
          // Find trip associated with this online keke
          const activeTrip = trips.find(t => 
            t.kekeId === keke.id && 
            (t.status === 'accepted' || t.status === 'active')
          );

          if (!activeTrip) {
            if (keke.speed > 0) {
              updated = true;
              const updatedKeke = { ...keke, speed: 0 };
              if (currentDriver && keke.id === currentDriver.kekeId) {
                upsertVehicle(updatedKeke).catch(console.error);
              }
              return updatedKeke;
            }
            return keke;
          }

          // ONLY update coordinate if this tab owns this vehicle (i.e. is the logged-in driver)
          // OR if we are in the admin/sandbox view and want to run mock simulation (to keep compatibility)
          const isOwner = currentDriver && keke.id === currentDriver.kekeId;
          const isSimulatorView = activeView === 'simulator';
          
          if (!isOwner && !isSimulatorView) {
            return keke;
          }

          // Target is either pickup location (if 'accepted') or destination location (if 'active')
          const target = activeTrip.status === 'accepted' 
            ? activeTrip.pickupLocation 
            : activeTrip.destinationLocation;

          // Target coordinate calculation
          let targetLat = target.lat;
          let targetLng = target.lng;

          // If active trip (heading to destination), follow Google Directions route points
          if (activeTrip.status === 'active' && activeTrip.routeCoords && activeTrip.routeCoords.length > 0) {
            const route = activeTrip.routeCoords;
            let closestIdx = 0;
            let minDist = Infinity;
            
            // Find closest route point
            for (let i = 0; i < route.length; i++) {
              const d = getDistanceMeters(keke.lat, keke.lng, route[i][0], route[i][1]);
              if (d < minDist) {
                minDist = d;
                closestIdx = i;
              }
            }

            // Target the next coordinate point
            const targetIdx = Math.min(route.length - 1, closestIdx + 1);
            targetLat = route[targetIdx][0];
            targetLng = route[targetIdx][1];
          }

          const dy = targetLat - keke.lat;
          const dx = targetLng - keke.lng;
          // Distance to the absolute final destination
          const finalDy = target.lat - keke.lat;
          const finalDx = target.lng - keke.lng;
          const finalDistance = Math.sqrt(finalDx*finalDx + finalDy*finalDy);

          // If very close to final destination, stay there (waiting for boarding or completion trigger)
          if (finalDistance < 0.0003) {
            // Auto transition from accepted -> active (boarding) for simulation realism
            // so that if you're not in the driver view, it still proceeds
            if (activeTrip.status === 'accepted') {
              setTimeout(() => {
                setTrips(prevTrips => prevTrips.map(t => 
                  t.id === activeTrip.id ? { ...t, status: 'active' } : t
                ));
                updateTripStatus(activeTrip.id, 'active').catch(console.error);
              }, 1000);
            }
            
            if (keke.speed > 0) {
              updated = true;
              const updatedKeke = { ...keke, speed: 0, lat: target.lat, lng: target.lng };
              if (isOwner) {
                upsertVehicle(updatedKeke).catch(console.error);
              }
              return updatedKeke;
            }
            return keke;
          }

          // Calculate step (speed scale factor)
          const stepSize = 0.0004; // scale of speed
          const angle = Math.atan2(dy, dx);
          
          updated = true;
          const updatedKeke = {
            ...keke,
            lat: keke.lat + Math.sin(angle) * stepSize * 0.7,
            lng: keke.lng + Math.cos(angle) * stepSize * 0.7,
            speed: 25 // mock speed in km/h
          };
          if (isOwner) {
            upsertVehicle(updatedKeke).catch(console.error);
          }
          return updatedKeke;
        });

        return updated ? nextKekes : prevKekes;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [trips, currentDriver, activeView]);

  // ─── Reset simulator database to defaults ─────────────────────────────────
  const resetSimulatorDatabase = () => {
    Object.values(LS_KEYS).forEach(k => lsDel(k));
    const freshKekes = generateDefaultKekes();
    setRiders(INITIAL_RIDERS);
    setDrivers(INITIAL_DRIVERS);
    setKekes(freshKekes);
    setTrips([]);
    setTransactions([]);
    setSafetyIncidents([]);
    setCurrentRider(null);
    setCurrentDriver(null);
    setCurrentKeke(null);
    // Also wipe Supabase cloud data (trips, transactions, incidents)
    deleteAllUserData().catch(console.error);
  };

  return (
    <USRideContext.Provider value={{
      riders,
      drivers,
      kekes,
      trips,
      transactions,
      currentRider,
      currentDriver,
      currentKeke,
      activeView,
      setActiveView,
      riderLogin,
      riderRegister,
      riderLogout,
      driverLogin,
      driverLogout,
      toggleDriverOnline,
      updateKekeEnergy,
      updateCabFinancials,
      withdrawEarnings,
      updateVehicleLocation,
      bookRide,
      cancelRide,
      riderTopUpWallet,
      addRiderCard,
      removeRiderCard,
      acceptTrip,
      declineTrip,
      confirmBoarded,
      completeTrip,
      rateUser,
      chargeKeke,
      adminRegisterDriver,
      updateRiderProfile,
      updateDriverProfile,
      resetSimulatorDatabase,
      safetyIncidents,
      triggerSOSAlert,
      modalConfig,
      showModal,
      hideModal
    }}>
      {children}
    </USRideContext.Provider>
  );
};

export const useUSRide = () => {
  const context = useContext(USRideContext);
  if (!context) {
    throw new Error('useUSRide must be used within a USRideProvider');
  }
  return context;
};
