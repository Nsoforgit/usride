/**
 * USRide — Supabase Database Service Layer
 * All reads and writes to Supabase go through here.
 * The React context imports these functions instead of touching the DB directly.
 */
import { supabase } from './supabase';
import type { Rider, Driver, Keke, Trip, WalletTransaction, SafetyIncident, SavedCard } from '../context/USRideContext';

// ─── Type helpers (DB row → app model) ───────────────────────────────────────

export function dbToRider(row: Record<string, unknown>, cards: SavedCard[] = []): Rider {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    role: row.role as 'student' | 'staff' | 'other',
    phoneNumber: (row.phone_number as string) ?? '',
    walletBalance: Number(row.wallet_balance),
    totalTrips: Number(row.total_trips),
    averageRating: Number(row.average_rating),
    photo: row.photo as string | undefined,
    savedCards: cards,
  };
}

export function dbToDriver(row: Record<string, unknown>): Driver {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    driverIdCode: row.driver_id_code as string,
    kekeId: Number(row.vehicle_id),
    walletBalance: Number(row.wallet_balance),
    totalTrips: Number(row.total_trips),
    averageRating: Number(row.average_rating),
    isActive: Boolean(row.is_active),
    vehicleType: row.vehicle_type as 'keke' | 'cab',
    petrolCostToday: Number(row.petrol_cost_today ?? 0),
    cashCollectedToday: Number(row.cash_collected_today ?? 0),
    photo: row.photo as string | undefined,
    vehicleModel: row.vehicle_model as string | undefined,
    vehicleColor: row.vehicle_color as string | undefined,
    queuedTripId: (row.queued_trip_id as string | null) ?? null,
    phoneNumber: (row.phone_number as string) ?? '',
  };
}

export function dbToKeke(row: Record<string, unknown>): Keke {
  return {
    id: Number(row.id),
    driverId: (row.driver_id as string | null) ?? null,
    plateNumber: row.plate_number as string,
    isOnline: Boolean(row.is_online),
    currentSeatsAvailable: Number(row.current_seats_available),
    currentBatteryPercent: Number(row.current_battery_percent),
    estimatedHoursRemaining: Number(row.estimated_hours_remaining),
    lat: Number(row.lat),
    lng: Number(row.lng),
    speed: Number(row.speed),
    vehicleType: row.vehicle_type as 'keke' | 'cab',
  };
}

export function dbToTrip(row: Record<string, unknown>): Trip {
  return {
    id: row.id as string,
    rideType: row.ride_type as 'shared' | 'drop',
    vehicleType: row.vehicle_type as 'keke' | 'cab',
    riderIds: row.rider_ids as string[],
    riderNames: row.rider_names as string[],
    driverId: (row.driver_id as string | null) ?? null,
    kekeId: (row.vehicle_id as number | null) ?? null,
    pickupLandmark: row.pickup_landmark as string,
    destinationLandmark: row.destination_landmark as string,
    pickupLocation: { lat: Number(row.pickup_lat), lng: Number(row.pickup_lng) },
    destinationLocation: { lat: Number(row.destination_lat), lng: Number(row.destination_lng) },
    status: row.status as Trip['status'],
    farePerPerson: Number(row.fare_per_person),
    transferFee: Number(row.transfer_fee),
    totalFare: Number(row.total_fare),
    energyUsedPercent: Number(row.energy_used_percent),
    seatsBooked: Number(row.seats_booked),
    routeCoords: (row.route_coords as [number, number][] | null) ?? undefined,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    eligibleDriverIds: (row.eligible_driver_ids as string[] | null) ?? undefined,
  };
}

export function dbToTransaction(row: Record<string, unknown>): WalletTransaction {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userType: row.user_type as 'rider' | 'driver',
    type: row.type as 'credit' | 'debit' | 'withdrawal',
    amount: Number(row.amount),
    reference: row.reference as string,
    description: row.description as string,
    createdAt: row.created_at as string,
  };
}

export function dbToIncident(row: Record<string, unknown>): SafetyIncident {
  return {
    id: row.id as string,
    riderId: row.rider_id as string,
    riderName: row.rider_name as string,
    riderPhone: row.rider_phone as string,
    landmarkName: row.landmark_name as string,
    timestamp: row.created_at as string,
    status: row.status as 'active' | 'resolved',
    description: row.description as string,
    driverName: row.driver_name as string | undefined,
    driverPhone: row.driver_phone as string | undefined,
    driverCode: row.driver_code as string | undefined,
    vehiclePlate: row.vehicle_plate as string | undefined,
  };
}

// ─── RIDERS ──────────────────────────────────────────────────────────────────

export async function fetchAllRiders(): Promise<Rider[]> {
  const { data: riderRows, error } = await supabase.from('riders').select('*').order('created_at');
  if (error) throw error;

  const { data: cardRows } = await supabase.from('saved_cards').select('*');
  const cardsByRider: Record<string, SavedCard[]> = {};
  for (const c of cardRows ?? []) {
    const rid = c.rider_id as string;
    if (!cardsByRider[rid]) cardsByRider[rid] = [];
    cardsByRider[rid].push({ id: c.id, last4: c.last4, expiry: c.expiry, brand: c.brand });
  }

  return (riderRows ?? []).map(r => dbToRider(r, cardsByRider[r.id as string] ?? []));
}

export async function upsertRider(rider: Rider): Promise<void> {
  const { savedCards, ...rest } = rider;
  const { error } = await supabase.from('riders').upsert({
    id: rest.id,
    name: rest.name,
    email: rest.email,
    role: rest.role,
    phone_number: rest.phoneNumber,
    wallet_balance: rest.walletBalance,
    total_trips: rest.totalTrips,
    average_rating: rest.averageRating,
    photo: rest.photo ?? null,
  });
  if (error) throw error;

  // Sync saved cards: delete all then re-insert
  await supabase.from('saved_cards').delete().eq('rider_id', rider.id);
  if (savedCards && savedCards.length > 0) {
    await supabase.from('saved_cards').insert(
      savedCards.map(c => ({ id: c.id, rider_id: rider.id, last4: c.last4, expiry: c.expiry, brand: c.brand }))
    );
  }
}

/**
 * Lightweight update — only touches wallet_balance and total_trips.
 * Use this after trip completion to avoid re-writing saved_cards.
 */
export async function updateRiderBalance(riderId: string, walletBalance: number, totalTrips: number): Promise<void> {
  const { error } = await supabase
    .from('riders')
    .update({ wallet_balance: walletBalance, total_trips: totalTrips })
    .eq('id', riderId);
  if (error) throw error;
}

/**
 * Lightweight update — only touches wallet_balance and total_trips for a driver.
 */
export async function updateDriverBalance(driverId: string, walletBalance: number, totalTrips: number): Promise<void> {
  const { error } = await supabase
    .from('drivers')
    .update({ wallet_balance: walletBalance, total_trips: totalTrips })
    .eq('id', driverId);
  if (error) throw error;
}

export async function registerRider(rider: Rider): Promise<void> {
  return upsertRider(rider);
}

// ─── DRIVERS ─────────────────────────────────────────────────────────────────

export async function fetchAllDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase.from('drivers').select('*').order('created_at');
  if (error) throw error;
  return (data ?? []).map(dbToDriver);
}

export async function upsertDriver(driver: Driver): Promise<void> {
  const { error } = await supabase.from('drivers').upsert({
    id: driver.id,
    name: driver.name,
    email: driver.email,
    driver_id_code: driver.driverIdCode,
    vehicle_id: driver.kekeId,
    wallet_balance: driver.walletBalance,
    total_trips: driver.totalTrips,
    average_rating: driver.averageRating,
    is_active: driver.isActive,
    vehicle_type: driver.vehicleType,
    petrol_cost_today: driver.petrolCostToday ?? 0,
    cash_collected_today: driver.cashCollectedToday ?? 0,
    photo: driver.photo ?? null,
    vehicle_model: driver.vehicleModel ?? null,
    vehicle_color: driver.vehicleColor ?? null,
    queued_trip_id: driver.queuedTripId ?? null,
    phone_number: driver.phoneNumber ?? null,
  });
  if (error) throw error;
}

// ─── VEHICLES (Kekes + Cabs) ──────────────────────────────────────────────────

export async function fetchAllVehicles(): Promise<Keke[]> {
  const { data, error } = await supabase.from('vehicles').select('*').order('id');
  if (error) throw error;
  return (data ?? []).map(dbToKeke);
}

export async function upsertVehicle(keke: Keke): Promise<void> {
  const { error } = await supabase.from('vehicles').upsert({
    id: keke.id,
    driver_id: keke.driverId ?? null,
    plate_number: keke.plateNumber,
    is_online: keke.isOnline,
    current_seats_available: keke.currentSeatsAvailable,
    current_battery_percent: keke.currentBatteryPercent,
    estimated_hours_remaining: keke.estimatedHoursRemaining,
    lat: keke.lat,
    lng: keke.lng,
    speed: keke.speed,
    vehicle_type: keke.vehicleType,
  });
  if (error) throw error;
}

// ─── TRIPS ────────────────────────────────────────────────────────────────────

export async function fetchAllTrips(): Promise<Trip[]> {
  const { data, error } = await supabase.from('trips').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(dbToTrip);
}

export async function insertTrip(trip: Trip): Promise<void> {
  const { error } = await supabase.from('trips').insert({
    id: trip.id,
    ride_type: trip.rideType,
    vehicle_type: trip.vehicleType,
    rider_ids: trip.riderIds,
    rider_names: trip.riderNames,
    driver_id: trip.driverId ?? null,
    vehicle_id: trip.kekeId ?? null,
    pickup_landmark: trip.pickupLandmark,
    destination_landmark: trip.destinationLandmark,
    pickup_lat: trip.pickupLocation.lat,
    pickup_lng: trip.pickupLocation.lng,
    destination_lat: trip.destinationLocation.lat,
    destination_lng: trip.destinationLocation.lng,
    status: trip.status,
    fare_per_person: trip.farePerPerson,
    transfer_fee: trip.transferFee,
    total_fare: trip.totalFare,
    energy_used_percent: trip.energyUsedPercent,
    seats_booked: trip.seatsBooked,
    route_coords: trip.routeCoords ?? null,
    created_at: trip.createdAt,
    completed_at: trip.completedAt ?? null,
    eligible_driver_ids: trip.eligibleDriverIds ?? null,
  });
  if (error) throw error;
}

export async function updateTripStatus(
  tripId: string,
  status: Trip['status'],
  extra: Partial<{ driverId: string; vehicleId: number; completedAt: string }> = {}
): Promise<void> {
  const { error } = await supabase.from('trips').update({
    status,
    ...(extra.driverId !== undefined && { driver_id: extra.driverId }),
    ...(extra.vehicleId !== undefined && { vehicle_id: extra.vehicleId }),
    ...(extra.completedAt !== undefined && { completed_at: extra.completedAt }),
  }).eq('id', tripId);
  if (error) throw error;
}

// ─── WALLET TRANSACTIONS ──────────────────────────────────────────────────────

export async function fetchAllTransactions(): Promise<WalletTransaction[]> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(dbToTransaction);
}

export async function insertTransaction(tx: WalletTransaction): Promise<void> {
  const { error } = await supabase.from('wallet_transactions').insert({
    id: tx.id,
    user_id: tx.userId,
    user_type: tx.userType,
    type: tx.type,
    amount: tx.amount,
    reference: tx.reference,
    description: tx.description,
    created_at: tx.createdAt,
  });
  if (error) throw error;
}

// ─── SAFETY INCIDENTS ─────────────────────────────────────────────────────────

export async function fetchAllIncidents(): Promise<SafetyIncident[]> {
  const { data, error } = await supabase
    .from('safety_incidents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(dbToIncident);
}

export async function insertIncident(incident: SafetyIncident): Promise<void> {
  const { error } = await supabase.from('safety_incidents').insert({
    id: incident.id,
    rider_id: incident.riderId,
    rider_name: incident.riderName,
    rider_phone: incident.riderPhone,
    landmark_name: incident.landmarkName,
    status: incident.status,
    description: incident.description,
    driver_name: incident.driverName ?? null,
    driver_phone: incident.driverPhone ?? null,
    driver_code: incident.driverCode ?? null,
    vehicle_plate: incident.vehiclePlate ?? null,
    created_at: incident.timestamp,
  });
  if (error) throw error;
}

export async function resolveIncident(incidentId: string): Promise<void> {
  const { error } = await supabase
    .from('safety_incidents')
    .update({ status: 'resolved' })
    .eq('id', incidentId);
  if (error) throw error;
}

// ─── RESET (Admin) ────────────────────────────────────────────────────────────

export async function deleteAllUserData(): Promise<void> {
  await supabase.from('safety_incidents').delete().neq('id', '');
  await supabase.from('wallet_transactions').delete().neq('id', '');
  await supabase.from('trips').delete().neq('id', '');
}
