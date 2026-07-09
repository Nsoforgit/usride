import { useState, useEffect, useRef } from 'react';
import { LANDMARKS, Landmark } from '../context/USRideContext';
import { getDistanceMeters } from '../utils/geofence';

interface UserLocationState {
  lat: number | null;
  lng: number | null;
  nearestLandmark: Landmark | null;
  distanceToLandmark: number | null; // meters
  accuracy: number | null; // GPS accuracy in meters
  isWatching: boolean;
  error: string | null;
}

/**
 * Custom hook that uses browser GPS to track the user's real-time position
 * and snaps it to the nearest UNIBEN campus landmark.
 */
export function useUserLocation(): UserLocationState {
  const [state, setState] = useState<UserLocationState>({
    lat: null,
    lng: null,
    nearestLandmark: null,
    distanceToLandmark: null,
    accuracy: null,
    isWatching: false,
    error: null,
  });

  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: 'Geolocation not supported' }));
      return;
    }

    setState(prev => ({ ...prev, isWatching: true }));

    const onSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;

      // Find nearest landmark using Haversine
      let nearest: Landmark = LANDMARKS[0];
      let minDist = Infinity;

      for (const lm of LANDMARKS) {
        const d = getDistanceMeters(latitude, longitude, lm.lat, lm.lng);
        if (d < minDist) {
          minDist = d;
          nearest = lm;
        }
      }

      setState({
        lat: latitude,
        lng: longitude,
        nearestLandmark: nearest,
        distanceToLandmark: Math.round(minDist),
        accuracy: accuracy ? Math.round(accuracy) : null,
        isWatching: true,
        error: null,
      });
    };

    const onError = (err: GeolocationPositionError) => {
      console.warn('[useUserLocation] GPS error:', err.message);
      setState(prev => ({
        ...prev,
        isWatching: false,
        error: err.code === 1 ? 'Location permission denied' : 'Could not get location',
      }));
    };

    // Use watchPosition for continuous tracking
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000, // Cache for 5s to avoid battery drain
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return state;
}
