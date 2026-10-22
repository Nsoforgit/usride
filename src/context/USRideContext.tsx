import React, { createContext, useState, useEffect, useContext } from 'react';
import { fetchGoogleRoute, getDistanceMeters, estimateBumpsForRoute, calculateBatteryDrop, calculateKekeETA, estimateRangeKm, KEKE_BATTERY_SPEC, estimateTripsLeftAboveReserve, getTripBoardingCode } from '../utils/geofence';
import { supabase } from '../lib/supabase';
import {
  fetchAllRiders, fetchAllDrivers, fetchAllVehicles, fetchAllTrips, fetchAllTransactions, fetchAllIncidents,
  upsertRider, upsertDriver, upsertVehicle, insertTrip, updateTripStatus, insertTransaction, insertIncident,
  updateRiderBalance, updateDriverBalance,
  saveUserPasswordHash, clearAllDriverBalancesInDb,
  deleteAllUserData,
  dbToRider, dbToDriver, dbToKeke, dbToTrip, dbToTransaction, dbToIncident
} from '../lib/db';

export const GOOGLE_MAPS_API_KEY = "AIzaSyBAf1ytrEZjvqOVpHwmmO5Xb5GUzdy5AB0";

/**
 * Deterministic SHA-256 password hash using Web Crypto API (with fallback).
 */
async function hashPassword(plain: string): Promise<string> {
  const normalized = plain.trim();
  try {
    const msgBuffer = new TextEncoder().encode(`usride-salt-v1:${normalized}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback if crypto.subtle is unavailable on non-HTTPS local network IP
    let h = 2166136261;
    const str = `usride-salt-v1:${normalized}`;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `fnv1a_${(h >>> 0).toString(16)}`;
  }
}

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
  passwordHash?: string;
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
  passwordHash?: string;
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
  declinedDriverIds?: string[];
  currentRadiusMeters?: number;
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

export interface AdminAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: string;
}

export const DAILY_PAYOUT_LIMIT_NGN = 15000;
export const PRELOADED_DRIVER_IDS = new Set([
  'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8',
  'd9', 'd10', 'd11', 'd12', 'd13', 'd14', 'd15', 'd16'
]);
export const PRELOADED_RIDER_IDS = new Set(['r1', 'r2', 'r3']);

export function getBrandAvatar(name: string, bg = '064e3b', color = 'fbbf24'): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'USRide')}&background=${bg}&color=${color}&bold=true&size=150`;
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
  adminAuditLogs: 'usride_admin_audit_logs',
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

// ─── Default initial data constants (live production — all balances start at 0) ─
const INITIAL_RIDERS: Rider[] = [
  { 
    id: 'r1', name: 'Osas Igbinedion', email: 'osas@uniben.edu', role: 'student',
    phoneNumber: '08031234567', walletBalance: 0, totalTrips: 0, averageRating: 5.0,
    savedCards: [],
    photo: getBrandAvatar('Osas Igbinedion', '4c1d95', 'fde68a')
  },
  { 
    id: 'r2', name: 'Dr. Evelyn Alile', email: 'evelyn.alile@uniben.edu', role: 'staff',
    phoneNumber: '08059876543', walletBalance: 0, totalTrips: 0, averageRating: 5.0,
    savedCards: [],
    photo: getBrandAvatar('Dr Evelyn Alile', '4c1d95', 'fde68a')
  },
  { 
    id: 'r3', name: 'Bose Adebayo', email: 'bose@student.uniben.edu', role: 'student',
    phoneNumber: '08123456789', walletBalance: 0, totalTrips: 0, averageRating: 5.0,
    savedCards: [],
    photo: getBrandAvatar('Bose Adebayo', '4c1d95', 'fde68a')
  }
];

const INITIAL_DRIVERS: Driver[] = [
  // ── Keke Drivers (8 total: 3 original + 5 new) ──
  { id: 'd1', name: 'Sunday Egbon', email: 'sunday@usride.uniben.edu', driverIdCode: 'DRV001', kekeId: 1,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'keke',
    photo: getBrandAvatar('Sunday Egbon', '064e3b', 'fbbf24'),
    vehicleModel: 'Wavz Solar Keke X1', vehicleColor: 'Uniben Green', queuedTripId: null, phoneNumber: '08039991111' },
  { id: 'd2', name: 'Musa Ibrahim', email: 'musa@usride.uniben.edu', driverIdCode: 'DRV002', kekeId: 2,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'keke',
    photo: getBrandAvatar('Musa Ibrahim', '064e3b', 'fbbf24'),
    vehicleModel: 'EcoDrive Solar Tricycle', vehicleColor: 'Forest Green', queuedTripId: null, phoneNumber: '08058882222' },
  { id: 'd3', name: 'Efosa Osula', email: 'efosa@usride.uniben.edu', driverIdCode: 'DRV003', kekeId: 3,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'keke',
    photo: getBrandAvatar('Efosa Osula', '064e3b', 'fbbf24'),
    vehicleModel: 'SolarSpeed Tricycle', vehicleColor: 'Lime Green', queuedTripId: null, phoneNumber: '08127773333' },
  { id: 'd6', name: 'Osaze Obasuyi', email: 'osaze@usride.uniben.edu', driverIdCode: 'DRV006', kekeId: 4,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'keke',
    photo: getBrandAvatar('Osaze Obasuyi', '064e3b', 'fbbf24'),
    vehicleModel: 'Wavz Solar Keke X1', vehicleColor: 'Emerald Green', queuedTripId: null, phoneNumber: '08023334455' },
  { id: 'd7', name: 'Victor Emeka', email: 'victor@usride.uniben.edu', driverIdCode: 'DRV007', kekeId: 5,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'keke',
    photo: getBrandAvatar('Victor Emeka', '064e3b', 'fbbf24'),
    vehicleModel: 'EcoDrive Solar Tricycle', vehicleColor: 'Forest Green', queuedTripId: null, phoneNumber: '08034445566' },
  { id: 'd8', name: 'Blessing Akhigbe', email: 'blessing@usride.uniben.edu', driverIdCode: 'DRV008', kekeId: 6,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'keke',
    photo: getBrandAvatar('Blessing Akhigbe', '064e3b', 'fbbf24'),
    vehicleModel: 'SolarSpeed Tricycle', vehicleColor: 'Uniben Green', queuedTripId: null, phoneNumber: '08125556677' },
  { id: 'd9', name: 'Chinedu Okonkwo', email: 'chinedu@usride.uniben.edu', driverIdCode: 'DRV009', kekeId: 7,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'keke',
    photo: getBrandAvatar('Chinedu Okonkwo', '064e3b', 'fbbf24'),
    vehicleModel: 'GreenVolt E-Keke', vehicleColor: 'Lime Green', queuedTripId: null, phoneNumber: '08056667788' },
  { id: 'd10', name: 'Monday Idahosa', email: 'monday@usride.uniben.edu', driverIdCode: 'DRV010', kekeId: 8,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'keke',
    photo: getBrandAvatar('Monday Idahosa', '064e3b', 'fbbf24'),
    vehicleModel: 'CleanRide Solar Trike', vehicleColor: 'Leaf Green', queuedTripId: null, phoneNumber: '07037778899' },

  // ── Cab Drivers (8 total: 2 original + 6 new) ──
  { id: 'd4', name: 'Alao Akala', email: 'alao@ucride.uniben.edu', driverIdCode: 'DRV004', kekeId: 18,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'cab',
    petrolCostToday: 0, cashCollectedToday: 0,
    photo: getBrandAvatar('Alao Akala', '1e3a8a', 'fbbf24'),
    vehicleModel: 'Toyota Corolla 2015', vehicleColor: 'Silver Metallic', queuedTripId: null, phoneNumber: '07036664444' },
  { id: 'd5', name: 'Kingsley Ogie', email: 'kingsley@ucride.uniben.edu', driverIdCode: 'DRV005', kekeId: 19,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'cab',
    petrolCostToday: 0, cashCollectedToday: 0,
    photo: getBrandAvatar('Kingsley Ogie', '1e3a8a', 'fbbf24'),
    vehicleModel: 'Lexus ES350 2012', vehicleColor: 'Charcoal Black', queuedTripId: null, phoneNumber: '09015555555' },
  { id: 'd11', name: 'Samuel Osagie', email: 'samuel@ucride.uniben.edu', driverIdCode: 'DRV011', kekeId: 20,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'cab',
    petrolCostToday: 0, cashCollectedToday: 0,
    photo: getBrandAvatar('Samuel Osagie', '1e3a8a', 'fbbf24'),
    vehicleModel: 'Toyota Camry 2014', vehicleColor: 'Classic White', queuedTripId: null, phoneNumber: '08028889900' },
  { id: 'd12', name: 'Kenneth Efe', email: 'kenneth@ucride.uniben.edu', driverIdCode: 'DRV012', kekeId: 21,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'cab',
    petrolCostToday: 0, cashCollectedToday: 0,
    photo: getBrandAvatar('Kenneth Efe', '1e3a8a', 'fbbf24'),
    vehicleModel: 'Honda Accord 2013', vehicleColor: 'Navy Blue', queuedTripId: null, phoneNumber: '08139990011' },
  { id: 'd13', name: 'Emmanuel Bello', email: 'emmanuel@ucride.uniben.edu', driverIdCode: 'DRV013', kekeId: 22,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'cab',
    petrolCostToday: 0, cashCollectedToday: 0,
    photo: getBrandAvatar('Emmanuel Bello', '1e3a8a', 'fbbf24'),
    vehicleModel: 'Toyota Matrix 2012', vehicleColor: 'Silver Metallic', queuedTripId: null, phoneNumber: '07051112233' },
  { id: 'd14', name: 'Austin Nosa', email: 'austin@ucride.uniben.edu', driverIdCode: 'DRV014', kekeId: 23,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'cab',
    petrolCostToday: 0, cashCollectedToday: 0,
    photo: getBrandAvatar('Austin Nosa', '1e3a8a', 'fbbf24'),
    vehicleModel: 'Hyundai Elantra 2016', vehicleColor: 'Midnight Black', queuedTripId: null, phoneNumber: '09022223344' },
  { id: 'd15', name: 'Godwin Iziegbe', email: 'godwin@ucride.uniben.edu', driverIdCode: 'DRV015', kekeId: 24,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'cab',
    petrolCostToday: 0, cashCollectedToday: 0,
    photo: getBrandAvatar('Godwin Iziegbe', '1e3a8a', 'fbbf24'),
    vehicleModel: 'Nissan Almera 2015', vehicleColor: 'Ash Grey', queuedTripId: null, phoneNumber: '08073334455' },
  { id: 'd16', name: 'Francis Agbonlahor', email: 'francis@ucride.uniben.edu', driverIdCode: 'DRV016', kekeId: 25,
    walletBalance: 0, totalTrips: 0, averageRating: 5.0, isActive: true, vehicleType: 'cab',
    petrolCostToday: 0, cashCollectedToday: 0,
    photo: getBrandAvatar('Francis Agbonlahor', '1e3a8a', 'fbbf24'),
    vehicleModel: 'Toyota Corolla 2016', vehicleColor: 'Ruby Red', queuedTripId: null, phoneNumber: '08184445566' }
];

function generateDefaultKekes(): Keke[] {
  const list: Keke[] = [];
  const kekeDriverMap: Record<number, string> = {
    1: 'd1', 2: 'd2', 3: 'd3', 4: 'd6', 5: 'd7', 6: 'd8', 7: 'd9', 8: 'd10'
  };

  for (let i = 1; i <= 17; i++) {
    const landmark = LANDMARKS[(i - 1) % LANDMARKS.length];
    const assignedDriverId = kekeDriverMap[i] || null;
    list.push({
      id: i,
      driverId: assignedDriverId,
      plateNumber: `UNIBEN-${i.toString().padStart(2, '0')}K`,
      isOnline: assignedDriverId !== null,
      currentSeatsAvailable: 5,
      currentBatteryPercent: Math.max(65, 90 - (i * 2)),
      estimatedHoursRemaining: 7,
      lat: landmark.lat + (Math.random() - 0.5) * 0.001,
      lng: landmark.lng + (Math.random() - 0.5) * 0.001,
      speed: 0,
      vehicleType: 'keke'
    });
  }

  const cabDriverMap: Record<number, string> = {
    18: 'd4', 19: 'd5', 20: 'd11', 21: 'd12', 22: 'd13', 23: 'd14', 24: 'd15', 25: 'd16'
  };

  for (let i = 18; i <= 37; i++) {
    const landmark = LANDMARKS[(i - 1) % LANDMARKS.length];
    const assignedDriverId = cabDriverMap[i] || null;
    list.push({
      id: i,
      driverId: assignedDriverId,
      plateNumber: `UNIBEN-${i.toString().padStart(2, '0')}C`,
      isOnline: assignedDriverId !== null,
      currentSeatsAvailable: 4,
      currentBatteryPercent: 100,
      estimatedHoursRemaining: 8,
      lat: landmark.lat + (Math.random() - 0.5) * 0.001,
      lng: landmark.lng + (Math.random() - 0.5) * 0.001,
      speed: 0,
      vehicleType: 'cab'
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
  riderLogin: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  riderRegister: (name: string, email: string, role: 'student' | 'staff' | 'other', phoneNumber: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  riderResetPassword: (email: string, phoneNumber: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  riderLogout: () => void;
  driverLogin: (driverIdCode: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  driverResetPassword: (driverIdCode: string, emailOrPhone: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  driverLogout: () => void;
  
  // Driver Keke controls
  toggleDriverOnline: () => void;
  updateKekeEnergy: (batteryPercent: number, hoursRemaining: number) => void;
  updateCabFinancials: (petrolCost: number, cashCollected: number) => void;
  resolveBankAccount: (bankCode: string, accountNumber: string) => Promise<{ success: boolean; accountName?: string; error?: string }>;
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
  confirmBoarded: (tripId: string, enteredCode?: string) => boolean;
  completeTrip: (tripId: string) => void;
  rateUser: (tripId: string, rating: number, isRatingDriver: boolean) => void;
  chargeKeke: () => void;
  adminRegisterDriver: (name: string, email: string, driverIdCode: string, vehicleType: 'keke' | 'cab', vehicleIdOrPlate: string, phoneNumber?: string, photo?: string, password?: string) => void;
  clearDriverFloatingBalances: (singleDriverId?: string) => Promise<void>;
  refreshLiveDashboardData: () => Promise<void>;
  updateRiderProfile: (phoneNumber: string, photo: string) => void;
  updateDriverProfile: (phoneNumber: string, photo: string) => void;
  resetSimulatorDatabase: () => void;
  safetyIncidents: SafetyIncident[];
  triggerSOSAlert: (riderId: string, landmarkName: string, description: string) => void;
  raiseTripDispute: (tripId: string, reason: string) => void;
  adminAuditLogs: AdminAuditEntry[];
  logAdminAction: (action: string, details: string) => void;
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
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditEntry[]>(() => lsGet(LS_KEYS.adminAuditLogs, [
    {
      id: 'audit-init',
      timestamp: new Date().toISOString(),
      action: 'SYSTEM_INIT',
      actor: 'System',
      details: 'USRide Admin Audit Trail initialized with phone-masking and database reset protection active.'
    }
  ]));
  const [modalConfig, setModalConfig] = useState<AppNotification | null>(null);

  const logAdminAction = (action: string, details: string) => {
    const entry: AdminAuditEntry = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      action,
      actor: 'Admin',
      details
    };
    setAdminAuditLogs(prev => [entry, ...prev.slice(0, 199)]);
  };


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
  useEffect(() => { lsSet(LS_KEYS.adminAuditLogs, adminAuditLogs); }, [adminAuditLogs]);
  useEffect(() => {
    if (currentRider) lsSet(LS_KEYS.currentRiderId, currentRider.id);
    else lsDel(LS_KEYS.currentRiderId);
  }, [currentRider]);
  useEffect(() => {
    if (currentDriver) lsSet(LS_KEYS.currentDriverId, currentDriver.id);
    else lsDel(LS_KEYS.currentDriverId);
  }, [currentDriver]);

  // ─── 3. Supabase bootstrap — load fresh data on mount ─────────────────────
  const refreshLiveDashboardData = async () => {
    try {
      const [sbRiders, sbDrivers, sbVehicles, sbTrips, sbTx, sbSos] = await Promise.all([
        fetchAllRiders(), fetchAllDrivers(), fetchAllVehicles(),
        fetchAllTrips(), fetchAllTransactions(), fetchAllIncidents()
      ]);
      if (sbRiders.length > 0)  { setRiders(sbRiders);  lsSet(LS_KEYS.riders, sbRiders); }
      if (sbDrivers.length > 0) { setDrivers(sbDrivers); lsSet(LS_KEYS.drivers, sbDrivers); }
      if (sbVehicles.length > 0){ setKekes(sbVehicles);  lsSet(LS_KEYS.kekes, sbVehicles); }
      setTrips(sbTrips);         lsSet(LS_KEYS.trips, sbTrips);
      setTransactions(sbTx);     lsSet(LS_KEYS.transactions, sbTx);
      setSafetyIncidents(sbSos); lsSet(LS_KEYS.safetyIncidents, sbSos);

      const riderId = localStorage.getItem(LS_KEYS.currentRiderId);
      const driverId = localStorage.getItem(LS_KEYS.currentDriverId);
      if (riderId) { const r = sbRiders.find(x => x.id === riderId); if (r) setCurrentRider(r); }
      if (driverId){ const d = sbDrivers.find(x => x.id === driverId); if (d) setCurrentDriver(d); }
    } catch (err) {
      console.warn('[USRide] Supabase unreachable, running on local cache:', err);
    }
  };

  useEffect(() => {
    refreshLiveDashboardData();
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
                    // Preserve local photo and passwordHash if DB row update omitted them
                    return {
                      ...freshDriver,
                      photo: freshDriver.photo || d.photo,
                      passwordHash: freshDriver.passwordHash || d.passwordHash,
                    };
                  }
                  return d;
                });
              } else {
                return [...prev, freshDriver];
              }
            });
            setCurrentDriver(prev => {
              if (prev && prev.id === freshDriver.id) {
                return {
                  ...freshDriver,
                  photo: freshDriver.photo || prev.photo,
                  passwordHash: freshDriver.passwordHash || prev.passwordHash,
                };
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
              const freshRider = dbToRider(payload.new, matched?.savedCards || [], matched?.passwordHash);
              const exists = prev.some(r => r.id === freshRider.id);
              if (exists) {
                return prev.map(r => {
                  if (r.id === freshRider.id) {
                    return {
                      ...freshRider,
                      photo: freshRider.photo || r.photo,
                      passwordHash: freshRider.passwordHash || r.passwordHash,
                    };
                  }
                  return r;
                });
              } else {
                return [...prev, freshRider];
              }
            });
            setCurrentRider(prev => {
              if (prev && prev.id === payload.new.id) {
                const incoming = dbToRider(payload.new, prev.savedCards || [], prev.passwordHash);
                return {
                  ...incoming,
                  photo: incoming.photo || prev.photo,
                  passwordHash: incoming.passwordHash || prev.passwordHash,
                };
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

  // 30-second Dispatch Fallback & Radial Expansion:
  // If the nearest offered driver does not accept within 30 seconds, cascade to the next nearest driver heading the same way
  useEffect(() => {
    const requestedTrips = trips.filter(t => t.status === 'requested');
    if (requestedTrips.length === 0) return;

    const interval = setInterval(() => {
      setTrips(prev => prev.map(t => {
        if (t.status !== 'requested') return t;

        const onlineVehicles = kekes.filter(k =>
          k.isOnline &&
          k.vehicleType === t.vehicleType &&
          (k.vehicleType !== 'keke' || (k.currentBatteryPercent - (t.energyUsedPercent || 2.2) >= KEKE_BATTERY_SPEC.reserveFloorPercent))
        );

        const vehicleDistances = onlineVehicles.map(k => {
          const dist = getDistanceMeters(k.lat, k.lng, t.pickupLocation.lat, t.pickupLocation.lng);
          const driverId = k.driverId || drivers.find(d => d.kekeId === k.id)?.id || null;
          // Prioritize drivers already heading along the same corridor
          const hasSameWayTrip = trips.some(activeT =>
            activeT.driverId === driverId &&
            (activeT.status === 'accepted' || activeT.status === 'active') &&
            activeT.destinationLandmark === t.destinationLandmark
          );
          return { driverId, distance: dist, hasSameWayTrip };
        })
          .filter((v): v is { driverId: string; distance: number; hasSameWayTrip: boolean } => v.driverId !== null)
          .sort((a, b) => {
            if (a.hasSameWayTrip !== b.hasSameWayTrip) return a.hasSameWayTrip ? -1 : 1;
            return a.distance - b.distance;
          });

        const currentEligible = new Set(t.eligibleDriverIds || []);
        const currentRadius = t.currentRadiusMeters || 1000;
        const nextRadius = currentRadius + 1000;

        let newlyEligible: string[] = [];
        if (nextRadius <= 6000) {
          newlyEligible = vehicleDistances
            .filter(v => v.distance <= nextRadius)
            .map(v => v.driverId);
        } else {
          newlyEligible = vehicleDistances.map(v => v.driverId);
        }

        const mergedEligible = Array.from(new Set([...Array.from(currentEligible), ...newlyEligible]));

        if (mergedEligible.length > currentEligible.size || nextRadius !== currentRadius) {
          console.log(`[30s Dispatch Fallback] Trip ${t.id} cascaded to next nearest drivers (${nextRadius > 6000 ? 'Global Broadcast' : nextRadius + 'm'}). Eligible drivers: ${mergedEligible.length}`);
          return {
            ...t,
            currentRadiusMeters: nextRadius,
            eligibleDriverIds: mergedEligible
          };
        }

        return t;
      }));
    }, 30000); // 30-second fallback window per checklist

    return () => clearInterval(interval);
  }, [trips, kekes, drivers]);

  // 2. Rider Auth (Password-Protected)
  const riderLogin = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return { success: false, error: 'Please enter your email address.' };
    if (!password || password.trim().length < 4) {
      return { success: false, error: 'Please enter your password (minimum 4 characters).' };
    }

    // Check fresh riders list from Supabase if possible so password hashes from other devices are synced
    let currentRidersList = riders;
    try {
      const sbRiders = await fetchAllRiders();
      if (sbRiders.length > 0) {
        currentRidersList = sbRiders;
        setRiders(sbRiders);
      }
    } catch { /* fallback to local state */ }

    const found = currentRidersList.find(r => r.email.toLowerCase() === cleanEmail);
    if (!found) {
      return { success: false, error: 'No account found with that email. Please create an account first.' };
    }

    const hashed = await hashPassword(password);

    if (found.passwordHash) {
      if (found.passwordHash !== hashed) {
        return { success: false, error: 'Incorrect password for this account. Please try again.' };
      }
      setCurrentRider(found);
      return { success: true };
    } else {
      // First-time password binding for legacy accounts created before password protection
      const securedRider: Rider = { ...found, passwordHash: hashed };
      setRiders(prev => prev.map(r => r.id === found.id ? securedRider : r));
      setCurrentRider(securedRider);
      saveUserPasswordHash('rider', found.id, hashed).catch(console.error);
      return { success: true };
    }
  };

  const riderRegister = async (
    name: string,
    email: string,
    role: 'student' | 'staff' | 'other',
    phoneNumber: string,
    password?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!password || password.trim().length < 4) {
      return { success: false, error: 'Please choose a password of at least 4 characters.' };
    }

    if (riders.some(r => r.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
    }

    const hashed = await hashPassword(password);
    const newRider: Rider = {
      id: `r${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      role,
      phoneNumber: phoneNumber.trim(),
      walletBalance: 0,
      totalTrips: 0,
      averageRating: 5.0,
      photo: getBrandAvatar(name.trim(), '4c1d95', 'fde68a'),
      passwordHash: hashed,
    };
    setRiders(prev => [...prev, newRider]);
    setCurrentRider(newRider);
    upsertRider(newRider).catch(console.error);
    return { success: true };
  };

  const riderLogout = () => {
    setCurrentRider(null);
  };

  const riderResetPassword = async (
    email: string,
    phoneNumber: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanEmail) return { success: false, error: 'Please enter your registered email address.' };
    if (cleanPhone.length < 4) return { success: false, error: 'Please enter your registered phone number to verify your identity.' };
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'Your new password must be at least 4 characters long.' };
    }

    let currentRidersList = riders;
    try {
      const sbRiders = await fetchAllRiders();
      if (sbRiders.length > 0) {
        currentRidersList = sbRiders;
        setRiders(sbRiders);
      }
    } catch { /* fallback to local state */ }

    const found = currentRidersList.find(r => r.email.toLowerCase() === cleanEmail);
    if (!found) {
      return { success: false, error: 'No rider account found with that email address.' };
    }

    const storedPhoneDigits = (found.phoneNumber || '').replace(/\D/g, '');
    const phoneMatches = storedPhoneDigits && (
      storedPhoneDigits === cleanPhone ||
      storedPhoneDigits.slice(-8) === cleanPhone.slice(-8) ||
      (cleanPhone.length === 4 && storedPhoneDigits.slice(-4) === cleanPhone)
    );

    if (!phoneMatches) {
      return {
        success: false,
        error: 'The phone number entered does not match the phone number on this account.'
      };
    }

    const hashed = await hashPassword(newPassword);
    const updatedRider: Rider = { ...found, passwordHash: hashed };
    setRiders(prev => prev.map(r => r.id === found.id ? updatedRider : r));
    await saveUserPasswordHash('rider', found.id, hashed);
    logAdminAction('RIDER_PASSWORD_RESET', `Password reset completed via phone verification for rider ${found.email}`);
    return { success: true };
  };

  // 3. Driver Auth (Driver ID Code + Password/PIN Protected)
  const driverLogin = async (driverIdCode: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    const cleanCode = driverIdCode.trim().toUpperCase();
    if (!cleanCode) return { success: false, error: 'Please enter your Driver ID Code.' };
    if (!password || password.trim().length < 4) {
      return { success: false, error: 'Please enter your Driver PIN / Password (minimum 4 characters).' };
    }

    let currentDriversList = drivers;
    try {
      const sbDrivers = await fetchAllDrivers();
      if (sbDrivers.length > 0) {
        currentDriversList = sbDrivers;
        setDrivers(sbDrivers);
      }
    } catch { /* fallback to local state */ }

    const found = currentDriversList.find(d => d.driverIdCode.toUpperCase() === cleanCode && d.isActive);
    if (!found) {
      return { success: false, error: 'Invalid or inactive Driver ID Code. Contact the Admin if you need help.' };
    }

    const hashed = await hashPassword(password);

    if (found.passwordHash && found.passwordHash !== hashed) {
      return { success: false, error: 'Incorrect Driver PIN / Password. Please try again.' };
    }

    const securedDriver: Driver = found.passwordHash ? found : { ...found, passwordHash: hashed };
    if (!found.passwordHash) {
      setDrivers(prev => prev.map(d => d.id === found.id ? securedDriver : d));
      saveUserPasswordHash('driver', found.id, hashed).catch(console.error);
    }

    setCurrentDriver(securedDriver);
    const match = kekes.find(k => k.id === securedDriver.kekeId);
    if (match) setCurrentKeke(match);

    setKekes(prev => prev.map(k => {
      if (k.id === securedDriver.kekeId) {
        const updated = { ...k, driverId: securedDriver.id, isOnline: true };
        upsertVehicle(updated).catch(console.error);
        return updated;
      }
      return k;
    }));
    return { success: true };
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

  const driverResetPassword = async (
    driverIdCode: string,
    emailOrPhone: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanCode = driverIdCode.trim().toUpperCase();
    const cleanVerify = emailOrPhone.trim().toLowerCase();
    if (!cleanCode) return { success: false, error: 'Please enter your Driver ID Code (e.g. DRV001).' };
    if (!cleanVerify) return { success: false, error: 'Please enter your registered email address or phone number.' };
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'Your new PIN / Password must be at least 4 characters long.' };
    }

    let currentDriversList = drivers;
    try {
      const sbDrivers = await fetchAllDrivers();
      if (sbDrivers.length > 0) {
        currentDriversList = sbDrivers;
        setDrivers(sbDrivers);
      }
    } catch { /* fallback to local state */ }

    const found = currentDriversList.find(d => d.driverIdCode.toUpperCase() === cleanCode);
    if (!found) {
      return { success: false, error: 'Driver ID Code not found. Please check your code or contact USRide Admin.' };
    }

    const storedEmail = (found.email || '').trim().toLowerCase();
    const storedPhoneDigits = (found.phoneNumber || '').replace(/\D/g, '');
    const inputDigits = cleanVerify.replace(/\D/g, '');

    const matchesEmail = storedEmail && storedEmail === cleanVerify;
    const matchesPhone = storedPhoneDigits && inputDigits.length >= 4 && (
      storedPhoneDigits === inputDigits ||
      storedPhoneDigits.slice(-8) === inputDigits.slice(-8) ||
      (inputDigits.length === 4 && storedPhoneDigits.slice(-4) === inputDigits)
    );

    if (!matchesEmail && !matchesPhone) {
      return {
        success: false,
        error: 'The email or phone number entered does not match the registered details for this Driver ID.'
      };
    }

    const hashed = await hashPassword(newPassword);
    const updatedDriver: Driver = { ...found, passwordHash: hashed };
    setDrivers(prev => prev.map(d => d.id === found.id ? updatedDriver : d));
    await saveUserPasswordHash('driver', found.id, hashed);
    logAdminAction('DRIVER_PASSWORD_RESET', `Driver PIN/Password reset completed for ${found.driverIdCode} (${found.name})`);
    return { success: true };
  };

  // Online status toggle
  const toggleDriverOnline = () => {
    if (!currentDriver) return;
    setKekes(prev => prev.map(k => {
      if (k.id === currentDriver.kekeId) {
        const nextOnline = !k.isOnline;
        const updated = { 
          ...k, 
          isOnline: nextOnline, 
          driverId: nextOnline ? currentDriver.id : k.driverId 
        };
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

  // 3b. Verify Nigerian Bank Account Number with Paystack (real-time name resolution)
  const resolveBankAccount = async (bankCode: string, accountNumber: string): Promise<{ success: boolean; accountName?: string; error?: string }> => {
    if (!bankCode || !accountNumber || accountNumber.trim().length !== 10) {
      return { success: false, error: 'Please enter a valid 10-digit NUBAN account number.' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('paystack-payout', {
        body: {
          action: 'resolve',
          bankCode,
          accountNumber: accountNumber.trim()
        }
      });

      if (error) {
        let msg = '';
        try {
          if ((error as any).context) {
            const errBody = await (error as any).context.json();
            msg = errBody?.error || errBody?.message || '';
          }
        } catch { /* noop */ }
        return { success: false, error: msg || error.message || 'Could not verify account name.' };
      }

      if (data && data.success && data.account_name) {
        return { success: true, accountName: data.account_name };
      }

      return { success: false, error: data?.error || 'Account number could not be resolved for the selected bank.' };
    } catch (err: any) {
      console.warn('[Resolve Bank] Error:', err);
      return { success: false, error: err?.message || 'Network error verifying account.' };
    }
  };

  // Withdraw Driver Earnings via live Paystack Transfer Edge Function
  // NO local fallback — any failure shows the real error to protect against phantom payouts
  const withdrawEarnings = async (amount: number, bankCode: string, accountNumber: string): Promise<boolean> => {
    if (!currentDriver) return false;
    if (currentDriver.walletBalance < amount) {
      showModal({
        title: "Insufficient Balance",
        message: `Your credited earnings balance (₦${currentDriver.walletBalance.toLocaleString()}) is less than the requested withdrawal amount (₦${amount.toLocaleString()}).`,
        type: 'error'
      });
      return false;
    }

    // Enforce Daily Payout Limit per Driver Account (₦15,000/day)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const withdrawnLast24h = transactions
      .filter(tx =>
        tx.userType === 'driver' &&
        tx.userId === currentDriver.id &&
        tx.type === 'withdrawal' &&
        new Date(tx.createdAt).getTime() >= oneDayAgo
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    if (withdrawnLast24h + amount > DAILY_PAYOUT_LIMIT_NGN) {
      const remainingDailyAllowance = Math.max(0, DAILY_PAYOUT_LIMIT_NGN - withdrawnLast24h);
      showModal({
        title: "Daily Payout Limit Reached",
        message: `⚠️ Driver payouts are capped at ₦${DAILY_PAYOUT_LIMIT_NGN.toLocaleString()} per account per 24 hours.\n\nWithdrawn today: ₦${withdrawnLast24h.toLocaleString()}\nRemaining today: ₦${remainingDailyAllowance.toLocaleString()}`,
        type: 'warning'
      });
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('paystack-payout', {
        body: {
          action: 'transfer',
          driverId: currentDriver.id,
          bankCode,
          accountNumber: accountNumber.trim(),
          amount
        }
      });

      if (error) {
        let serverErrorMsg = '';
        try {
          if ((error as any).context) {
            const errBody = await (error as any).context.json();
            serverErrorMsg = errBody?.error || errBody?.message || '';
          }
        } catch { /* noop */ }

        console.error('[Payout] Edge Function invocation error:', error, serverErrorMsg);
        showModal({
          title: "Payout Failed",
          message: serverErrorMsg
            ? `❌ ${serverErrorMsg}`
            : `Could not reach the payment server.\n\nDetails: ${error.message || 'Network error'}`,
          type: 'error'
        });
        return false;
      }

      if (!data || !data.success) {
        // Paystack returned a specific error (e.g. wrong account, insufficient balance)
        const reason = data?.error || 'Paystack declined the transfer.';
        console.error('[Payout] Paystack error:', reason, data);
        showModal({
          title: "Transfer Failed",
          message: `❌ ${reason}`,
          type: 'error'
        });
        return false;
      }

      // ✅ Transfer confirmed by Paystack — update local state
      // (Edge Function already updated the DB balance; we mirror it here)
      const newBalance = data.new_balance ?? (currentDriver.walletBalance - amount);

      setDrivers(prev => prev.map(d =>
        d.id === currentDriver.id ? { ...d, walletBalance: newBalance } : d
      ));
      setCurrentDriver(prev => prev ? { ...prev, walletBalance: newBalance } : null);

      showModal({
        title: "Payout Initiated ✅",
        message: `₦${amount.toLocaleString()} transfer to ${data.recipient_name || accountNumber} has been initiated.\n\nTransfer Code: ${data.transfer_code}\nStatus: ${data.transfer_status}\n\nFunds typically arrive within minutes.`,
        type: 'success'
      });

      return true;
    } catch (err: any) {
      console.error('[Payout] Unexpected connection error:', err);
      showModal({
        title: "Payout Failed",
        message: `An unexpected error occurred: ${err?.message || 'Please try again'}. No money has been deducted.`,
        type: 'error'
      });
      return false;
    }
  };

  // 4. Rider Booking Flow
  const bookRide = async (rideType: 'shared' | 'drop', vehicleType: 'keke' | 'cab', pickupId: string, destId: string, seatsBooked = 1) => {
    if (!currentRider) return null;
    
    // Hackathon Fare & Settlement Rules:
    // - Shared seat: ₦100 per seat (Keke) / ₦250 per seat (Cab) + flat ₦10 service fee per seat
    // - Full-ride (drop): ₦500 (Keke) / ₦1,000 (Cab) + ₦50 service fee
    const baseFare = rideType === 'drop' 
      ? (vehicleType === 'keke' ? 500 : 1000) 
      : (vehicleType === 'keke' ? 100 : 250);
    const seats = rideType === 'drop'
      ? (vehicleType === 'keke' ? 5 : 4)
      : seatsBooked;
    const totalFare = rideType === 'drop'
      ? baseFare
      : baseFare * seats;
    const transferFee = rideType === 'drop'
      ? 50
      : 10 * seats;
    const totalCost = totalFare + transferFee;

    if (currentRider.walletBalance < totalCost) {
      showModal({
        title: "Insufficient Balance",
        message: `❌ Insufficient wallet balance. This ride costs ₦${totalCost.toLocaleString()} (₦${totalFare.toLocaleString()} fare + ₦${transferFee.toLocaleString()} service fee), and your wallet has ₦${currentRider.walletBalance.toLocaleString()}. Please top up in your wallet tab!`,
        type: 'error'
      });
      return null;
    }

    const pickup = LANDMARKS.find(l => l.id === pickupId);
    const dest = LANDMARKS.find(l => l.id === destId);
    if (!pickup || !dest) return null;

    // Fetch route from Google Directions API
    const route = await fetchGoogleRoute(pickup.lat, pickup.lng, dest.lat, dest.lng, GOOGLE_MAPS_API_KEY);

    // ─── Field-Calibrated Battery (~1% per km) & ETA Estimation ───────────────
    const distanceMeters = getDistanceMeters(pickup.lat, pickup.lng, dest.lat, dest.lng);
    const distanceKm = Math.max(0.4, distanceMeters / 1000);
    const estimatedBumps = estimateBumpsForRoute(pickup.id, dest.id, distanceKm);
    const estimatedPassengers = rideType === 'drop' ? (vehicleType === 'keke' ? 3 : 3) : seatsBooked;
    const estimatedEnergyPercent = vehicleType === 'keke'
      ? calculateBatteryDrop(distanceKm, estimatedPassengers, estimatedBumps)
      : 0;
    const estimatedETAMins = calculateKekeETA(distanceKm, estimatedBumps, vehicleType);
    console.log(`[Field Model] Route ${pickup.name} → ${dest.name}: ${distanceKm.toFixed(2)}km, ${estimatedBumps} bumps, ETA: ${estimatedETAMins} mins, Battery drop (~1%/km): ${estimatedEnergyPercent.toFixed(1)}%`);

    // ─── 20% Battery Reserve Guard & Proximity Matching ───────────────────────
    const allOnlineVehiclesOfType = kekes.filter(k => k.isOnline && k.vehicleType === vehicleType);
    // Only dispatch Kekes whose battery will remain >= 20% reserve after completing this route
    const onlineVehiclesOfType = allOnlineVehiclesOfType.filter(k =>
      k.vehicleType !== 'keke' ||
      (k.currentBatteryPercent > KEKE_BATTERY_SPEC.reserveFloorPercent &&
       (k.currentBatteryPercent - estimatedEnergyPercent) >= KEKE_BATTERY_SPEC.reserveFloorPercent)
    );

    if (vehicleType === 'keke' && allOnlineVehiclesOfType.length > 0 && onlineVehiclesOfType.length === 0) {
      showModal({
        title: "🔋 20% Battery Reserve Guard",
        message: `All online USRide Solar Kekes are currently at or near the 20% safe battery reserve floor. Completing this ${distanceKm.toFixed(1)} km trip (~${estimatedEnergyPercent.toFixed(1)}% battery) would breach the 20% reserve. Drivers have been alerted to go and charge at a Solar Hub!`,
        type: 'warning'
      });
      return null;
    }

    const SEARCH_RADII = [
      1000, // 1km — primary
      2000, // 2km
      3000, // 3km
      4000, // 4km
      5000, // 5km
      6000, // 6km — last radius before unlimited fallback
    ];

    // Calculate distances and check if any driver is already heading the same way
    const vehicleDistances = onlineVehiclesOfType.map(k => {
      const dist = getDistanceMeters(k.lat, k.lng, pickup.lat, pickup.lng);
      const mappedDriverId = k.driverId || drivers.find(d => d.kekeId === k.id)?.id || null;
      const headingSameWay = trips.some(t =>
        t.driverId === mappedDriverId &&
        (t.status === 'accepted' || t.status === 'active') &&
        t.destinationLandmark === dest.name
      );
      return { vehicleId: k.id, driverId: mappedDriverId, distance: dist, headingSameWay };
    })
      .filter((v): v is { vehicleId: number; driverId: string; distance: number; headingSameWay: boolean } => v.driverId !== null)
      .sort((a, b) => {
        if (a.headingSameWay !== b.headingSameWay) return a.headingSameWay ? -1 : 1;
        return a.distance - b.distance;
      });

    // Step through each radius ring — stop as soon as we find at least one driver
    let eligibleDriverIds: string[] = [];
    let initialRadius = 1000;
    for (const radius of SEARCH_RADII) {
      const found = vehicleDistances
        .filter(v => v.distance <= radius)
        .map(v => v.driverId);
      if (found.length > 0) {
        eligibleDriverIds = found;
        initialRadius = radius;
        console.log(`[Proximity] Found ${found.length} driver(s) within ${radius / 1000}km of Pickup landmark: ${pickup.name}`);
        break;
      }
    }

    // Global Fallback: If still no drivers found within 6km, allow ALL online drivers of this vehicle type
    if (eligibleDriverIds.length === 0) {
      eligibleDriverIds = vehicleDistances.map(v => v.driverId);
      if (eligibleDriverIds.length > 0) {
        initialRadius = 99999;
        console.log(`[Proximity Fallback] Global broadcast to all ${eligibleDriverIds.length} online driver(s) regardless of distance`);
      }
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
      energyUsedPercent: estimatedEnergyPercent,
      createdAt: new Date().toISOString(),
      completedAt: null,
      routeCoords: route,
      seatsBooked: seats,
      eligibleDriverIds,
      declinedDriverIds: [],
      currentRadiusMeters: initialRadius
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

    // 20% Battery Reserve Guard for Solar Kekes
    if (currentDriver.vehicleType === 'keke' && currentKeke) {
      const tripDrop = currentTrip.energyUsedPercent || 2.2;
      const projectedBattery = currentKeke.currentBatteryPercent - tripDrop;
      if (currentKeke.currentBatteryPercent <= KEKE_BATTERY_SPEC.reserveFloorPercent || projectedBattery < KEKE_BATTERY_SPEC.reserveFloorPercent) {
        showModal({
          title: "🔌 Go and Charge! (20% Reserve Guard)",
          message: `⚠️ Accepting this trip would take your battery from ${currentKeke.currentBatteryPercent}% to ${projectedBattery.toFixed(1)}% (below the ${KEKE_BATTERY_SPEC.reserveFloorPercent}% safe reserve floor).\n\nPlease head to the nearest USRide Solar Charging Hub to recharge before accepting new trips!`,
          type: 'warning'
        });
        return;
      }
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
    if (!trip || trip.status !== 'requested') return;

    // Track which driver declined
    const decliningDriverId = currentDriver ? currentDriver.id : null;
    const updatedDeclined = decliningDriverId 
      ? Array.from(new Set([...(trip.declinedDriverIds || []), decliningDriverId]))
      : (trip.declinedDriverIds || []);

    // Get all online drivers of this vehicle type
    const onlineVehicles = kekes.filter(k => k.isOnline && k.vehicleType === trip.vehicleType);
    const allOnlineDrivers = onlineVehicles
      .map(k => k.driverId || drivers.find(d => d.kekeId === k.id)?.id || null)
      .filter((id): id is string => id !== null);

    // Remaining drivers who have NOT declined this trip
    const remainingDrivers = allOnlineDrivers.filter(id => !updatedDeclined.includes(id));

    if (remainingDrivers.length > 0) {
      // Expand search to include remaining online drivers
      setTrips(prev => prev.map(t => {
        if (t.id === tripId) {
          const newEligible = Array.from(new Set([...(t.eligibleDriverIds || []), ...remainingDrivers]));
          return {
            ...t,
            declinedDriverIds: updatedDeclined,
            eligibleDriverIds: newEligible
          };
        }
        return t;
      }));
      console.log(`[Dispatch] Driver ${decliningDriverId || 'unknown'} declined/timed-out on trip ${tripId}. Re-broadcasting to ${remainingDrivers.length} remaining online driver(s).`);
    } else {
      // All online drivers of this vehicle type have declined
      setTrips(prev => prev.map(t => {
        if (t.id === tripId) {
          return { ...t, status: 'cancelled' as const, declinedDriverIds: updatedDeclined };
        }
        return t;
      }));
      updateTripStatus(tripId, 'cancelled').catch(console.error);
      showModal({
        title: "No Driver Available",
        message: "😔 Drivers in your area are currently busy. Please try requesting your ride again in a few moments.",
        type: 'warning'
      });
    }
  };

  const confirmBoarded = (tripId: string, enteredCode?: string): boolean => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return false;

    const expectedCode = getTripBoardingCode(tripId);
    if (enteredCode !== undefined && enteredCode.trim() !== expectedCode) {
      showModal({
        title: "Invalid Boarding Code",
        message: `❌ The boarding code entered (${enteredCode}) does not match this trip's 4-digit boarding code (${expectedCode}). Please verify the code shown on the screen.`,
        type: 'error'
      });
      return false;
    }

    // 50m Proximity Verification: check vehicle distance to pickup landmark
    const assignedVehicle = kekes.find(k => k.id === trip.kekeId);
    if (assignedVehicle) {
      const distToPickup = getDistanceMeters(
        assignedVehicle.lat,
        assignedVehicle.lng,
        trip.pickupLocation.lat,
        trip.pickupLocation.lng
      );
      if (distToPickup > 50) {
        // Snap vehicle to pickup coordinates on boarding confirmation so both phones are synced within 50m
        const snappedVehicle: Keke = {
          ...assignedVehicle,
          lat: trip.pickupLocation.lat,
          lng: trip.pickupLocation.lng,
          speed: 0
        };
        setKekes(prev => prev.map(k => k.id === assignedVehicle.id ? snappedVehicle : k));
        upsertVehicle(snappedVehicle).catch(console.error);
      }
    }

    setTrips(prev => prev.map(t => {
      if (t.id === tripId) return { ...t, status: 'active' as const };
      return t;
    }));
    updateTripStatus(tripId, 'active').catch(console.error);
    return true;
  };

  const completeTrip = (tripId: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    // 1. Use field-calibrated energy drain (~1% per km from calculateBatteryDrop)
    const distMeters = getDistanceMeters(
      trip.pickupLocation.lat,
      trip.pickupLocation.lng,
      trip.destinationLocation.lat,
      trip.destinationLocation.lng
    );
    const distKm = Math.max(0.4, distMeters / 1000);
    const bumps = estimateBumpsForRoute('1', '2', distKm);
    const fallbackFieldDrain = calculateBatteryDrop(distKm, trip.seatsBooked || 1, bumps);
    const batteryDrain = trip.vehicleType === 'keke'
      ? (trip.energyUsedPercent > 0 ? trip.energyUsedPercent : fallbackFieldDrain)
      : 0;

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

    // 3. Debit Riders & Credit Drivers (100% of seat fare goes to school ledger; driver earnings are credited and paid out by the school)
    const fare = trip.totalFare;
    const defaultServiceFee = trip.rideType === 'drop' ? 50 : 10 * (trip.seatsBooked || 1);
    const transferFee = trip.transferFee ?? defaultServiceFee;
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
        description: `USRide Fare: ${trip.pickupLandmark} ➔ ${trip.destinationLandmark} (₦${fare} School Ledger + ₦${transferFee} Service Fee)`,
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
        description: `Earnings credited (paid out by the school): ${trip.rideType === 'drop' ? 'Full Ride' : `Shared (${trip.seatsBooked || 1} seat)`}`,
        createdAt: new Date().toISOString()
      };
      setTransactions(prev => [driverTx, ...prev]);
      insertTransaction(driverTx).catch(console.error);
    }


    // 4. Reset keke seats & reduce battery (with 20% reserve Go-and-Charge alert)
    setKekes(prev => prev.map(k => {
      if (k.id === trip.kekeId) {
        const maxSeats = k.vehicleType === 'keke' ? 5 : 4;
        const releasedSeats = trip.seatsBooked || (trip.rideType === 'drop' ? maxSeats : 1);
        if (k.vehicleType === 'keke') {
          const newBattery = Math.round(Math.max(0, k.currentBatteryPercent - batteryDrain) * 10) / 10;
          const hoursRemaining = Math.max(0, Math.round((Math.max(0, newBattery - KEKE_BATTERY_SPEC.reserveFloorPercent) / 80) * 6 * 10) / 10);
          const updated = { ...k, currentSeatsAvailable: Math.min(maxSeats, k.currentSeatsAvailable + releasedSeats), currentBatteryPercent: newBattery, estimatedHoursRemaining: hoursRemaining };
          upsertVehicle(updated).catch(console.error);
          if (newBattery <= KEKE_BATTERY_SPEC.reserveFloorPercent) {
            setTimeout(() => {
              showModal({
                title: "🔌 Go and Charge Alert!",
                message: `Your Keke battery is now at ${newBattery}% (at or below the ${KEKE_BATTERY_SPEC.reserveFloorPercent}% safe reserve floor). Please head to the nearest USRide Solar Charging Hub to recharge!`,
                type: 'warning'
              });
            }, 600);
          }
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

  // Admin Driver Onboarding (FK-safe + Password-supported)
  const adminRegisterDriver = (
    name: string,
    email: string,
    driverIdCode: string,
    vehicleType: 'keke' | 'cab',
    vehicleIdOrPlate: string,
    phoneNumber?: string,
    photo?: string,
    password?: string
  ) => {
    const maxNum = drivers.reduce((max, d) => {
      const n = parseInt(d.id.replace(/\D/g, ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const nextDriverId = `d${maxNum + 1}`;
    let assignedVehicleId = 0;
    let targetVehicle: Keke | null = null;

    if (vehicleType === 'keke') {
      assignedVehicleId = parseInt(vehicleIdOrPlate, 10);
      setKekes(prev => prev.map(k => {
        if (k.id === assignedVehicleId) {
          const updated = { ...k, driverId: nextDriverId, isOnline: true };
          targetVehicle = updated;
          return updated;
        }
        return k;
      }));
    } else {
      assignedVehicleId = Math.max(37, ...kekes.map(k => k.id)) + 1;
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
      targetVehicle = newCab;
      setKekes(prev => [...prev, newCab]);
    }

    const newDrv: Driver = {
      id: nextDriverId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      driverIdCode: driverIdCode.trim().toUpperCase(),
      kekeId: assignedVehicleId,
      walletBalance: 0,
      totalTrips: 0,
      averageRating: 5.0,
      isActive: true,
      vehicleType,
      petrolCostToday: 0,
      cashCollectedToday: 0,
      phoneNumber: phoneNumber || ('081' + Math.floor(10000000 + Math.random() * 90000000)),
      photo: photo || getBrandAvatar(name.trim(), vehicleType === 'keke' ? '064e3b' : '1e3a8a', 'fbbf24')
    };

    setDrivers(prev => [...prev, newDrv]);
    logAdminAction('ONBOARD_DRIVER', `Registered ${vehicleType.toUpperCase()} driver ${newDrv.name} (${newDrv.driverIdCode})`);

    // Persist in FK-safe sequence (vehicle with driverId=null -> driver -> vehicle with driverId=nextDriverId)
    (async () => {
      try {
        if (password && password.trim().length >= 4) {
          newDrv.passwordHash = await hashPassword(password);
          setDrivers(prev => prev.map(d => d.id === newDrv.id ? { ...d, passwordHash: newDrv.passwordHash } : d));
        }
        if (targetVehicle) {
          await upsertVehicle({ ...targetVehicle, driverId: null });
        }
        await upsertDriver(newDrv);
        if (targetVehicle) {
          await upsertVehicle({ ...targetVehicle, driverId: nextDriverId });
        }
      } catch (err) {
        console.error('[AdminRegisterDriver] Persistence error:', err);
      }
    })();
  };

  // Clear floating/virtual driver balances without touching riders' real balances
  const clearDriverFloatingBalances = async (singleDriverId?: string) => {
    if (singleDriverId) {
      setDrivers(prev => prev.map(d =>
        d.id === singleDriverId
          ? { ...d, walletBalance: 0, totalTrips: 0, petrolCostToday: 0, cashCollectedToday: 0 }
          : d
      ));
      if (currentDriver?.id === singleDriverId) {
        setCurrentDriver(prev => prev ? { ...prev, walletBalance: 0, totalTrips: 0, petrolCostToday: 0, cashCollectedToday: 0 } : null);
      }
      await updateDriverBalance(singleDriverId, 0, 0).catch(console.error);
    } else {
      setDrivers(prev => prev.map(d => ({
        ...d,
        walletBalance: 0,
        totalTrips: 0,
        petrolCostToday: 0,
        cashCollectedToday: 0
      })));
      if (currentDriver) {
        setCurrentDriver(prev => prev ? { ...prev, walletBalance: 0, totalTrips: 0, petrolCostToday: 0, cashCollectedToday: 0 } : null);
      }
      await clearAllDriverBalancesInDb().catch(console.error);
    }
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

  // 24-Hour Rider Trip Dispute Window
  const raiseTripDispute = (tripId: string, reason: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    const completedTime = trip.completedAt ? new Date(trip.completedAt).getTime() : new Date(trip.createdAt).getTime();
    const hoursElapsed = (Date.now() - completedTime) / (1000 * 60 * 60);
    if (hoursElapsed > 24) {
      showModal({
        title: "Dispute Window Closed",
        message: "⏱️ Disputes must be submitted within 24 hours of trip completion.",
        type: 'warning'
      });
      return;
    }

    const rider = riders.find(r => trip.riderIds.includes(r.id)) || currentRider;
    const matchedDriver = drivers.find(d => d.id === trip.driverId);
    const matchedKeke = kekes.find(k => k.id === trip.kekeId);

    const disputeIncident: SafetyIncident = {
      id: `disp-${Date.now()}`,
      riderId: rider?.id || 'unknown',
      riderName: rider?.name || 'Rider',
      riderPhone: rider?.phoneNumber || 'N/A',
      landmarkName: `${trip.pickupLandmark} ➔ ${trip.destinationLandmark}`,
      timestamp: new Date().toISOString(),
      status: 'active',
      description: `[24H FARE DISPUTE — Trip ${trip.id.slice(-6)}] ${reason || 'Rider requested fare/service review'}`,
      driverName: matchedDriver?.name,
      driverPhone: matchedDriver?.phoneNumber || 'N/A',
      driverCode: matchedDriver?.driverIdCode,
      vehiclePlate: matchedKeke?.plateNumber
    };

    setSafetyIncidents(prev => [disputeIncident, ...prev]);
    insertIncident(disputeIncident).catch(console.error);
    logAdminAction('TRIP_DISPUTE_OPENED', `Rider ${rider?.name || 'Unknown'} opened 24h dispute for Trip ${trip.id}: "${reason}"`);

    showModal({
      title: "⚖️ Dispute Logged (24h Window)",
      message: `Your dispute for Trip ${trip.id.slice(-6)} has been logged with the University Transport Ledger desk.\n\nBecause driver earnings are settled in a daily batch by the school, this fare is flagged for review within the 24-hour dispute window.`,
      type: 'success'
    });
  };

  // 6. REAL-TIME MOVEMENT SIMULATION ENGINE
  // Run a clock every 300ms to smoothly move vehicles on active/accepted trips
  useEffect(() => {
    let tickCount = 0;
    const interval = setInterval(() => {
      tickCount++;
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

          // Target is pickup location (if 'accepted') or destination location (if 'active')
          const target = activeTrip.status === 'accepted' 
            ? activeTrip.pickupLocation 
            : activeTrip.destinationLocation;

          let targetLat = target.lat;
          let targetLng = target.lng;

          // If active trip (heading to destination), follow Google Directions route points
          if (activeTrip.status === 'active' && activeTrip.routeCoords && activeTrip.routeCoords.length > 0) {
            const route = activeTrip.routeCoords;
            let closestIdx = 0;
            let minDist = Infinity;
            
            for (let i = 0; i < route.length; i++) {
              const d = getDistanceMeters(keke.lat, keke.lng, route[i][0], route[i][1]);
              if (d < minDist) {
                minDist = d;
                closestIdx = i;
              }
            }

            const targetIdx = Math.min(route.length - 1, closestIdx + 1);
            targetLat = route[targetIdx][0];
            targetLng = route[targetIdx][1];
          }

          const dy = targetLat - keke.lat;
          const dx = targetLng - keke.lng;
          const finalDy = target.lat - keke.lat;
          const finalDx = target.lng - keke.lng;
          const finalDistance = Math.sqrt(finalDx*finalDx + finalDy*finalDy);

          // If very close to target (pickup or destination), stop and wait for explicit Boarding Check or End Trip
          if (finalDistance < 0.0003) {
            if (keke.speed > 0) {
              updated = true;
              const updatedKeke = { ...keke, speed: 0, lat: target.lat, lng: target.lng };
              if (currentDriver && keke.id === currentDriver.kekeId) {
                upsertVehicle(updatedKeke).catch(console.error);
              }
              return updatedKeke;
            }
            return keke;
          }

          // Smooth step size for 300ms intervals (approx 20-30 km/h)
          const stepSize = 0.00008;
          const angle = Math.atan2(dy, dx);
          
          updated = true;
          const newLat = keke.lat + Math.sin(angle) * stepSize;
          const newLng = keke.lng + Math.cos(angle) * stepSize;

          const updatedKeke = {
            ...keke,
            lat: newLat,
            lng: newLng,
            speed: 25
          };

          // Console log coordinates updating for debugging visibility
          console.log(`[GPS Engine] Keke #${keke.id} coords: lat ${newLat.toFixed(6)}, lng ${newLng.toFixed(6)} (Heading to ${activeTrip.status === 'accepted' ? 'Pickup' : 'Destination'})`);

          // Sync to Supabase every ~2 seconds (every 6th tick) if this tab is the vehicle owner
          const isOwner = currentDriver && keke.id === currentDriver.kekeId;
          if (isOwner && tickCount % 6 === 0) {
            upsertVehicle(updatedKeke).catch(console.error);
          }

          return updatedKeke;
        });

        return updated ? nextKekes : prevKekes;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [trips, currentDriver]);

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
      riderResetPassword,
      riderLogout,
      driverLogin,
      driverResetPassword,
      driverLogout,
      toggleDriverOnline,
      updateKekeEnergy,
      updateCabFinancials,
      resolveBankAccount,
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
      clearDriverFloatingBalances,
      refreshLiveDashboardData,
      updateRiderProfile,
      updateDriverProfile,
      resetSimulatorDatabase,
      safetyIncidents,
      triggerSOSAlert,
      raiseTripDispute,
      adminAuditLogs,
      logAdminAction,
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
