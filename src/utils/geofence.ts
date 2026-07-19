import { UNIBEN_GEOFENCE } from '../context/USRideContext';

// Simple rectangular geofence check
export const isLocationInsideUniben = (lat: number, lng: number): boolean => {
  return (
    lat >= UNIBEN_GEOFENCE.minLat &&
    lat <= UNIBEN_GEOFENCE.maxLat &&
    lng >= UNIBEN_GEOFENCE.minLng &&
    lng <= UNIBEN_GEOFENCE.maxLng
  );
};

// Compute distance in meters between two coordinates using Haversine formula
export const getDistanceMeters = (
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

// Calculate ETA based on coordinates and average speed (default 20 km/h)
export const calculateETA = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  speedKmH: number = 20
): number => {
  const distance = getDistanceMeters(lat1, lng1, lat2, lng2); // meters
  const speedMS = (speedKmH * 1000) / 3600; // meters per second
  const timeSeconds = distance / speedMS;
  return Math.ceil(timeSeconds / 60); // ETA in minutes (minimum 1 minute)
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
          return coords.map((c: [number, number]) => [c[1], c[0]]); // convert to [lat, lng]
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
