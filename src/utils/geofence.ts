import { UNIBEN_GEOFENCE } from '../context/USRideContext';

// ─── Field-Calibrated Constants (derived from 25 UNIBEN campus trips, July 2026) ──
// Battery hardware: NE Technology 96V 64Ah (6144 Wh) / Rhinggo 96V 60Ah (5760 Wh)
export const KEKE_BATTERY_SPEC = {
  voltageV: 96,
  capacityAh: 62,          // average of 60Ah and 64Ah across the two battery models recorded
  energyWh: 5952,          // 96V × 62Ah
  reserveFloorPercent: 20, // 20% minimum safe battery reserve floor before driver receives alert to go and charge
  avgTripDistanceKm: 2.15, // field-measured average UNIBEN trip distance (53.78 km / 25 trips)
  cruiseSpeedKmH: 24,      // observed average cruise speed in drive mode (field-measured)
  bumpSpeedKmH: 8,         // observed average speed while crossing a bump (2–14 km/h range, midpoint)
  bumpDelayMinutes: 0.16,  // ~10 seconds time lost per bump (deceleration + crossing + acceleration)
  baseBattRatePerKm: 0.80, // %/km at 0 passengers (driver only), field-derived α₀ (~1% per km with load)
  passBattRatePerKm: 0.08, // additional %/km per passenger (calibrated so typical campus load ≈ 1.0% per km)
  bumpBattRatePerKm: 0.02, // additional %/km per road bump (field-calibrated ~0.96%–1.10% per km total)
};

// ─── Road Bump Lookup Map for Known UNIBEN Landmark-to-Landmark Routes ───────
// Sourced from real field test data. Key = "fromId-toId" (landmark IDs from LANDMARKS array)
// If a route is not listed, a default bump count is estimated from distance.
export const ROUTE_BUMP_MAP: Record<string, number> = {
  '1-2':   5, // Main Gate → Engineering
  '2-1':   5,
  '1-10':  3, // Main Gate → Ekosodin
  '10-1':  3,
  '10-13': 5, // Ekosodin → Library
  '13-10': 5,
  '1-8':   4, // Main Gate → Senate/Admin
  '8-1':   4,
  '11-22': 1, // ETF → NDDC
  '22-11': 1,
  '12-1':  1, // Sports Complex → Main Gate
  '1-12':  1,
  '3-1':   7, // Faculty of Law → Main Gate
  '1-3':   7,
  '20-9':  5, // Small Gate → Hall 1/2/3
  '9-20':  5,
  '9-34':  5, // Hall 1/2/3 → Blocks of Flat
  '34-9':  5,
  '22-3':  3, // NDDC → Faculty of Law
  '3-22':  3,
  '37-1': 10, // Vet Med → Main Gate
  '1-37': 10,
  '2-7':   9, // Engineering Park → Art Faculty
  '7-2':   9,
  '32-2': 12, // Tetfund Hostel → Engineering
  '2-32': 12,
  '33-12': 9, // Keystone → Sports Complex
  '12-33': 9,
  '34-1': 11, // Blocks of Flat → Main Gate
  '1-34': 11,
};

/**
 * Estimate number of road bumps for a route based on landmark IDs.
 * Falls back to distance-based estimate if route is not in the lookup map.
 */
export const estimateBumpsForRoute = (
  fromLandmarkId: string,
  toLandmarkId: string,
  distanceKm: number
): number => {
  const key = `${fromLandmarkId}-${toLandmarkId}`;
  if (ROUTE_BUMP_MAP[key] !== undefined) return ROUTE_BUMP_MAP[key];
  // Fallback: roughly 3 bumps per km on UNIBEN campus roads (empirically observed average)
  return Math.round(distanceKm * 3);
};

/**
 * Field-calibrated ETA for a Keke trip on UNIBEN campus.
 * Uses real cruise speed (24 km/h) and bump-delay model (10 sec per bump).
 * Result in minutes.
 */
export const calculateKekeETA = (
  distanceKm: number,
  bumps: number,
  vehicleType: 'keke' | 'cab' = 'keke'
): number => {
  const cruiseSpeed = vehicleType === 'cab' ? 35 : KEKE_BATTERY_SPEC.cruiseSpeedKmH; // km/h
  const cruiseTimeMin = distanceKm / (cruiseSpeed / 60); // mins
  const bumpTimeMin = bumps * KEKE_BATTERY_SPEC.bumpDelayMinutes;
  const pickupDelayMin = 2; // base dispatch/pickup overhead
  return Math.ceil(cruiseTimeMin + bumpTimeMin + pickupDelayMin);
};

/**
 * Calculate estimated battery percentage drop for a Keke trip.
 * Based on field formula: ΔSoC = D × (α₀ + α₁×L + α₂×B)
 * D = distance km, L = passenger count (excluding driver), B = bumps.
 */
export const calculateBatteryDrop = (
  distanceKm: number,
  passengers: number,
  bumps: number
): number => {
  const { baseBattRatePerKm, passBattRatePerKm, bumpBattRatePerKm } = KEKE_BATTERY_SPEC;
  const rate = baseBattRatePerKm + passBattRatePerKm * passengers + bumpBattRatePerKm * bumps;
  return Math.ceil(distanceKm * rate * 10) / 10; // round up to 1 decimal
};

/**
 * Estimate remaining range in km given current battery percentage,
 * counting ONLY usable capacity above the 20% battery reserve floor.
 * Uses field-test consumption rate of ~1% per km.
 */
export const estimateRangeKm = (
  batteryPercent: number,
  passengers: number = 2
): number => {
  const { baseBattRatePerKm, passBattRatePerKm, reserveFloorPercent } = KEKE_BATTERY_SPEC;
  const usableBattery = Math.max(0, batteryPercent - reserveFloorPercent);
  const avgBumps = 5;
  const rate = baseBattRatePerKm + passBattRatePerKm * passengers + 0.02 * avgBumps; // ~1.06% per km
  return Math.round((usableBattery / rate) * 10) / 10;
};

/**
 * Calculate how many trips can be completed above the 20% battery reserve floor
 * given a specific route distance (or the 2.15 km campus average).
 */
export const estimateTripsLeftAboveReserve = (
  batteryPercent: number,
  routeDistanceKm: number = KEKE_BATTERY_SPEC.avgTripDistanceKm,
  passengers: number = 2,
  bumps: number = 5
): number => {
  const usableBattery = Math.max(0, batteryPercent - KEKE_BATTERY_SPEC.reserveFloorPercent);
  if (usableBattery <= 0) return 0;
  const dropPerTrip = Math.max(0.5, calculateBatteryDrop(Math.max(0.5, routeDistanceKm), passengers, bumps));
  return Math.floor(usableBattery / dropPerTrip);
};

/**
 * Deterministic 4-digit boarding verification code from a trip ID.
 */
export const getTripBoardingCode = (tripId: string): string => {
  let hash = 0;
  for (let i = 0; i < tripId.length; i++) {
    hash = (hash * 31 + tripId.charCodeAt(i)) % 9000;
  }
  return String(1000 + Math.abs(hash));
};

// Simple rectangular geofence check
export const isLocationInsideUniben = (lat: number, lng: number): boolean => {
  return (
    lat >= UNIBEN_GEOFENCE.minLat &&
    lat <= UNIBEN_GEOFENCE.maxLat &&
    lng >= UNIBEN_GEOFENCE.minLng &&
    lng <= UNIBEN_GEOFENCE.maxLng
  );
};

// ─── Exact Google Maps / Field-Measured Road Distances (km) on UNIBEN Campus ──
export const ROUTE_ROAD_DISTANCE_KM: Record<string, number> = {
  '1-33': 2.40, '33-1': 2.40, // Main Gate ↔ Keystone Hostel (2.4 km driving distance)
  '1-32': 2.35, '32-1': 2.35, // Main Gate ↔ Tetfund Hostel
  '1-22': 2.25, '22-1': 2.25, // Main Gate ↔ NDDC Hostel
  '1-31': 2.20, '31-1': 2.20, // Main Gate ↔ Hall 7
  '1-30': 2.10, '30-1': 2.10, // Main Gate ↔ Hall 6
  '1-29': 2.05, '29-1': 2.05, // Main Gate ↔ Hall 5
  '1-34': 2.65, '34-1': 2.65, // Main Gate ↔ Blocks of Flat
  '1-37': 3.00, '37-1': 3.00, // Main Gate ↔ Medical Complex / Vet Med
  '1-17': 2.90, '17-1': 2.90, // Main Gate ↔ UBTH Complex
  '1-21': 2.75, '21-1': 2.75, // Main Gate ↔ Clinical Hostel
  '1-10': 2.10, '10-1': 2.10, // Main Gate ↔ Ekosodin Hostels Gate
  '1-8':  1.40, '8-1':  1.40, // Main Gate ↔ Senate Building / Admin
  '1-2':  1.35, '2-1':  1.35, // Main Gate ↔ Faculty of Engineering
  '1-3':  0.89, '3-1':  0.89, // Main Gate ↔ Faculty of Law
  '10-13': 1.30, '13-10': 1.30, // Ekosodin ↔ John Harris Library
  '33-12': 2.20, '12-33': 2.20, // Keystone Hostel ↔ Sports Complex
  '32-2':  2.05, '2-32':  2.05, // Tetfund Hostel ↔ Engineering
  '20-9':  2.18, '9-20':  2.18, // Small Gate ↔ SUB / Hall 1-3
  '9-34':  1.77, '34-9':  1.77, // SUB / Hall 1-3 ↔ Blocks of Flat
};

// In-memory cache of exact driving distances (in meters) fetched from Google Routes / Directions / OSRM
const ROAD_DISTANCE_CACHE = new Map<string, number>();

function makeCoordCacheKey(lat1: number, lng1: number, lat2: number, lng2: number): string {
  return `${lat1.toFixed(4)},${lng1.toFixed(4)}->${lat2.toFixed(4)},${lng2.toFixed(4)}`;
}

// Raw Haversine straight-line GPS distance in meters (used for <= 50m boarding checks & snapping)
export const getRawGpsDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // in meters
};

// Compute total road distance in meters along a turn-by-turn polyline
export const getPolylineDistanceMeters = (coords: [number, number][]): number => {
  if (!coords || coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += getRawGpsDistanceMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  }
  return total;
};

// Compute actual UNIBEN driving distance in meters between two coordinates:
// 1. If points are within 80m (e.g. 50m boarding proximity check at the pickup spot), returns exact GPS meters.
// 2. If Google Routes / Directions / OSRM has cached the exact road distance for these coordinates, returns that exact road distance.
// 3. Otherwise applies the calibrated UNIBEN campus road-winding factor (1.80x over straight-line Haversine, matching 2.4 km from Main Gate to Keystone Hostel).
export const getDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const rawMeters = getRawGpsDistanceMeters(lat1, lng1, lat2, lng2);
  if (rawMeters <= 80) {
    return rawMeters;
  }
  const cacheKey = makeCoordCacheKey(lat1, lng1, lat2, lng2);
  const reverseKey = makeCoordCacheKey(lat2, lng2, lat1, lng1);
  const cachedRoadMeters = ROAD_DISTANCE_CACHE.get(cacheKey) ?? ROAD_DISTANCE_CACHE.get(reverseKey);
  if (cachedRoadMeters && cachedRoadMeters > rawMeters) {
    return cachedRoadMeters;
  }
  // Calibrated UNIBEN road network circuity multiplier (1.33 km straight-line × 1.80 = 2.40 km actual driving distance)
  return rawMeters * 1.80;
};

// Get exact road distance in km between two UNIBEN landmarks (checks field lookup table, road cache, or calibrated road distance)
export const getLandmarkRoadDistanceKm = (
  fromLandmarkId: string,
  toLandmarkId: string,
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const key = `${fromLandmarkId}-${toLandmarkId}`;
  if (ROUTE_ROAD_DISTANCE_KM[key] !== undefined) {
    return ROUTE_ROAD_DISTANCE_KM[key];
  }
  return Math.round((getDistanceMeters(lat1, lng1, lat2, lng2) / 1000) * 100) / 100;
};

// Calculate ETA based on coordinates and average speed (default 20 km/h)
// Legacy fallback — prefer calculateKekeETA() for campus routes.
export const calculateETA = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  speedKmH: number = 20,
  bumps: number = 0,
  vehicleType: 'keke' | 'cab' = 'keke'
): number => {
  const distanceKm = getDistanceMeters(lat1, lng1, lat2, lng2) / 1000;
  // Use the field-calibrated model if it's a campus Keke route
  if (vehicleType === 'keke' || bumps > 0) {
    return calculateKekeETA(distanceKm, bumps, vehicleType);
  }
  // Fallback for cabs: straight speed-based estimate
  const speedMS = (speedKmH * 1000) / 3600;
  const timeSeconds = (distanceKm * 1000) / speedMS;
  return Math.max(1, Math.ceil(timeSeconds / 60));
};

// Decodes Google encoded polyline points
export const decodePolyline = (encoded: string): [number, number][] => {
  const poly: [number, number][] = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push([lat / 1e5, lng / 1e5]);
  }
  return poly;
};

// ─── 1. Google Routes API v2 (Traffic-Aware Turn-by-Turn Routing) ───────────
export const fetchGoogleRoutesV2 = async (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  apiKey: string
): Promise<{ routeCoords: [number, number][]; durationSeconds?: number; distanceMeters?: number }> => {
  if (!apiKey || !apiKey.startsWith('AIzaSy')) {
    return { routeCoords: [[lat1, lng1], [lat2, lng2]] };
  }

  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: lat1, longitude: lng1 } } },
        destination: { location: { latLng: { latitude: lat2, longitude: lng2 } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        units: 'METRIC'
      })
    });

    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const encoded = route.polyline?.encodedPolyline;
      const fallbackCoords: [number, number][] = [[lat1, lng1], [lat2, lng2]];
      const routeCoords: [number, number][] = encoded ? decodePolyline(encoded) : fallbackCoords;
      const durationSeconds = route.duration ? parseInt(route.duration.replace('s', '')) : undefined;
      const distanceMeters = route.distanceMeters;

      console.log(`[Google Routes API v2] Route fetched: ${distanceMeters}m, ${durationSeconds}s duration (Traffic-Aware)`);
      return { routeCoords, durationSeconds, distanceMeters };
    }
  } catch (err) {
    console.warn('[Google Routes API v2] Fallback to DirectionsService:', err);
  }

  return { routeCoords: [[lat1, lng1], [lat2, lng2]] };
};

// ─── 2. Google Roads API (Snap To Roads) ────────────────────────────────────
export const snapToRoads = async (
  path: [number, number][],
  apiKey: string
): Promise<[number, number][]> => {
  if (!apiKey || !apiKey.startsWith('AIzaSy') || path.length === 0) return path;

  try {
    const pathString = path.map(p => `${p[0]},${p[1]}`).join('|');
    const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(pathString)}&interpolate=true&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.snappedPoints && data.snappedPoints.length > 0) {
      const snapped: [number, number][] = data.snappedPoints.map((pt: any) => [
        pt.location.latitude,
        pt.location.longitude
      ]);
      console.log(`[Google Roads API] Snapped ${path.length} GPS points to ${snapped.length} road geometry points.`);
      return snapped;
    }
  } catch (err) {
    console.warn('[Google Roads API] Snap to Roads error:', err);
  }

  return path;
};

// ─── 3. Google Geolocation API ──────────────────────────────────────────────
export const fetchGoogleGeolocation = async (apiKey: string): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
  if (!apiKey || !apiKey.startsWith('AIzaSy')) return null;

  try {
    const response = await fetch(`https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ considerIp: true })
    });
    const data = await response.json();
    if (data.location) {
      console.log(`[Google Geolocation API] Triangulated location: lat ${data.location.lat}, lng ${data.location.lng} (Accuracy: ${data.accuracy}m)`);
      return {
        lat: data.location.lat,
        lng: data.location.lng,
        accuracy: data.accuracy || 50
      };
    }
  } catch (err) {
    console.warn('[Google Geolocation API] Error:', err);
  }

  return null;
};

// Fetch real turn-by-turn route coordinates from Google Directions API / Routes API
export const fetchGoogleRoute = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  apiKey: string
): Promise<[number, number][]> => {
  return new Promise(async (resolve) => {
    // Try modern Routes API v2 first for traffic-aware accuracy
    if (apiKey && apiKey.startsWith('AIzaSy')) {
      const r2 = await fetchGoogleRoutesV2(lat1, lng1, lat2, lng2, apiKey);
      if (r2.routeCoords && r2.routeCoords.length > 2) {
        const roadMeters = r2.distanceMeters || getPolylineDistanceMeters(r2.routeCoords);
        if (roadMeters > 0) {
          ROAD_DISTANCE_CACHE.set(makeCoordCacheKey(lat1, lng1, lat2, lng2), roadMeters);
        }
        resolve(r2.routeCoords);
        return;
      }
    }

    // Helper for OSRM free public routing API fallback
    const fetchOSRMFallback = async (): Promise<[number, number][]> => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates; // array of [lng, lat]
          const poly: [number, number][] = coords.map((c: [number, number]) => [c[1], c[0]]); // convert to [lat, lng]
          const roadMeters = data.routes[0].distance || getPolylineDistanceMeters(poly);
          if (roadMeters > 0) {
            ROAD_DISTANCE_CACHE.set(makeCoordCacheKey(lat1, lng1, lat2, lng2), roadMeters);
          }
          return poly;
        }
      } catch (err) {
        console.error("OSRM Fallback Route Error:", err);
      }
      return [[lat1, lng1], [lat2, lng2]]; // final straight-line fallback
    };

    if (!apiKey || !apiKey.startsWith('AIzaSy')) {
      const fallback = await fetchOSRMFallback();
      resolve(fallback);
      return;
    }

    const google = (window as any).google;
    if (google && google.maps && google.maps.DirectionsService) {
      try {
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
          {
            origin: new google.maps.LatLng(lat1, lng1),
            destination: new google.maps.LatLng(lat2, lng2),
            travelMode: google.maps.TravelMode.DRIVING,
          },
          async (result: any, status: any) => {
            if (status === 'OK' && result && result.routes && result.routes.length > 0) {
              const route = result.routes[0];
              const path: [number, number][] = [];
              if (route.overview_path) {
                route.overview_path.forEach((latLng: any) => {
                  path.push([latLng.lat(), latLng.lng()]);
                });
              }
              if (path.length > 0) {
                const legMeters = route.legs?.[0]?.distance?.value || getPolylineDistanceMeters(path);
                if (legMeters > 0) {
                  ROAD_DISTANCE_CACHE.set(makeCoordCacheKey(lat1, lng1, lat2, lng2), legMeters);
                }
                resolve(path);
                return;
              }
            }
            console.warn("Directions request failed status:", status, "- using OSRM fallback.");
            const fallback = await fetchOSRMFallback();
            resolve(fallback);
          }
        );
      } catch (err) {
        console.error("DirectionsService error:", err, "- using OSRM fallback.");
        const fallback = await fetchOSRMFallback();
        resolve(fallback);
      }
    } else {
      console.warn("Google Maps JS SDK not loaded, using OSRM fallback.");
      const fallback = await fetchOSRMFallback();
      resolve(fallback);
    }
  });
};

// Find nearest landmark to coordinates using Haversine distance snapping
export const snapCoordinatesToNearestLandmark = (
  lat: number,
  lng: number,
  landmarks: { id: string; name: string; lat: number; lng: number }[]
): { id: string; name: string; lat: number; lng: number } => {
  if (!landmarks || landmarks.length === 0) {
    return { id: '', name: 'Unknown Location', lat, lng };
  }
  let closest = landmarks[0];
  let minDist = Infinity;

  for (const lm of landmarks) {
    const d = getDistanceMeters(lat, lng, lm.lat, lm.lng);
    if (d < minDist) {
      minDist = d;
      closest = lm;
    }
  }

  return closest;
};
