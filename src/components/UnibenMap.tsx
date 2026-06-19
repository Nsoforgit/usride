import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LANDMARKS, Keke, Landmark, useUSRide } from '../context/USRideContext';
import 'leaflet/dist/leaflet.css';

// Center coordinates for UNIBEN Ugbowo campus
const UNIBEN_CENTER: [number, number] = [6.4020, 5.6180];

// Custom HTML/CSS Marker Icons to avoid asset loading issues in Vite/Leaflet
const createLandmarkIcon = (category: string, name: string) => {
  let color = '#3b82f6'; // Admin / default blue
  if (category === 'faculty') color = '#f59e0b'; // Faculty amber
  if (category === 'hostel') color = '#8b5cf6'; // Hostel purple
  if (category === 'facility') color = '#10b981'; // Facility green

  return L.divIcon({
    className: 'custom-landmark-marker',
    html: `
      <div style="
        width: 12px;
        height: 12px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      " title="${name}"></div>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

const createKekeIcon = (keke: Keke, isSelected: boolean) => {
  const isKeke = keke.vehicleType === 'keke';
  const batteryColor = keke.currentBatteryPercent > 50 
    ? '#10b981' // Green
    : keke.currentBatteryPercent > 20 
      ? '#f59e0b' // Yellow
      : '#ef4444'; // Red

  const pulseClass = keke.speed > 0 ? 'keke-pulse' : '';

  return L.divIcon({
    className: `custom-keke-marker ${isSelected ? 'selected' : ''}`,
    html: `
      <div class="${pulseClass}" style="
        position: relative;
        width: 32px;
        height: 32px;
        background-color: ${isSelected ? '#eab308' : (isKeke ? '#047857' : '#1d4ed8')};
        color: white;
        border: 2px solid #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 6px rgba(0,0,0,0.25);
        transition: all 0.3s ease;
      ">
        <!-- SVG Vehicle Icon -->
        ${isKeke ? `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 13H17.5V11H19V13M12 4H9V5H12V4M19 7H14.5V9H19V7M21 11C21 9.9 20.1 9 19 9H17.5V7H19C20.1 7 21 6.1 21 5V4C21 2.9 20.1 2 19 2H5C3.9 2 3 2.9 3 4V5C3 6.1 3.9 7 5 7H11V9H5C3.9 9 3 9.9 3 11V12C3 13.1 3.9 14 5 14H6.1C6.6 16.3 8.6 18 11 18C11.3 18 11.7 18 12 17.9V19H9V21H15V19H12.8C13.6 18.6 14.2 18 14.5 17.2L17.2 19.8L18.6 18.4L15.4 15.2C16.4 14.1 17.1 12.6 17.4 11H19C20.1 11 21 10.1 21 9V7Z"/>
        </svg>
        ` : `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 6h11c.28 0 .5.22.5.5L18 11H6l-.02-4.5c0-.28.22-.5.52-.5zM5 16c-.83 0-1.5-.67-1.5-1.5S4.17 13 5 13s1.5.67 1.5 1.5S5.83 16 5 16zm14 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
        `}
        <!-- Seat count Badge -->
        <div style="
          position: absolute;
          top: -6px;
          right: -6px;
          background-color: #3b82f6;
          color: white;
          font-size: 9px;
          font-weight: bold;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid white;
        ">${keke.currentSeatsAvailable}</div>
        
        <!-- Battery Bar Indicator (Keke only) -->
        ${isKeke ? `
        <div style="
          position: absolute;
          bottom: -8px;
          left: 2px;
          width: 24px;
          height: 4px;
          background-color: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
          border: 0.5px solid #64748b;
        ">
          <div style="
            width: ${keke.currentBatteryPercent}%;
            height: 100%;
            background-color: ${batteryColor};
          "></div>
        </div>
        ` : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// Component to handle map center auto-updates when requested
const MapController: React.FC<{ center?: [number, number]; triggerResize?: boolean }> = ({ center, triggerResize }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.panTo(center);
    }
  }, [center, map]);

  useEffect(() => {
    // Invalidate size helps Leaflet redraw properly when elements resize or toggled
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [triggerResize, map]);

  return null;
};

interface UnibenMapProps {
  selectedKekeId?: number | null;
  selectedLandmarkId?: string | null;
  showLandmarks?: boolean;
  kekeClickCallback?: (keke: Keke) => void;
  landmarkClickCallback?: (landmark: Landmark) => void;
  riderActiveTripRoute?: boolean; // Draws active trip polyline
  triggerResize?: boolean;
  showLegend?: boolean;
}

export const UnibenMap: React.FC<UnibenMapProps> = ({
  selectedKekeId,
  selectedLandmarkId,
  showLandmarks = true,
  kekeClickCallback,
  landmarkClickCallback,
  riderActiveTripRoute = true,
  triggerResize = false,
  showLegend = false
}) => {
  const { kekes, trips, currentRider, currentDriver, activeView } = useUSRide();

  // Find active route coordinates for lines
  let routeCoords: [number, number][] = [];
  let routeTrip = trips.find(t => 
    t.status !== 'completed' && t.status !== 'cancelled' &&
    ((currentRider && t.riderIds.includes(currentRider.id)) ||
     (currentDriver && t.driverId === currentDriver.id))
  );

  if (routeTrip && riderActiveTripRoute) {
    const matchedKeke = kekes.find(k => k.id === routeTrip?.kekeId);
    if (matchedKeke) {
      if (routeTrip.status === 'accepted') {
        // Draw path from keke to pickup
        routeCoords = [
          [matchedKeke.lat, matchedKeke.lng],
          [routeTrip.pickupLocation.lat, routeTrip.pickupLocation.lng]
        ];
      } else if (routeTrip.status === 'active') {
        // Use Google Directions route path if available
        if (routeTrip.routeCoords && routeTrip.routeCoords.length > 0) {
          routeCoords = routeTrip.routeCoords;
        } else {
          routeCoords = [
            [matchedKeke.lat, matchedKeke.lng],
            [routeTrip.destinationLocation.lat, routeTrip.destinationLocation.lng]
          ];
        }
      }
    }
  }

  // Get map center based on selections
  let mapCenter = UNIBEN_CENTER;
  if (selectedLandmarkId) {
    const landmark = LANDMARKS.find(l => l.id === selectedLandmarkId);
    if (landmark) mapCenter = [landmark.lat, landmark.lng];
  } else if (selectedKekeId) {
    const keke = kekes.find(k => k.id === selectedKekeId);
    if (keke) mapCenter = [keke.lat, keke.lng];
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer 
        center={UNIBEN_CENTER} 
        zoom={15} 
        zoomControl={false}
        style={{ width: '100%', height: '100%', zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; Google Maps'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        />

        <MapController center={mapCenter} triggerResize={triggerResize} />

        {/* 1. Draw Landmarks */}
        {showLandmarks && LANDMARKS.map(landmark => (
          <Marker
            key={`lm-${landmark.id}`}
            position={[landmark.lat, landmark.lng]}
            icon={createLandmarkIcon(landmark.category, landmark.name)}
            eventHandlers={{
              click: () => landmarkClickCallback && landmarkClickCallback(landmark)
            }}
          >
            <Popup>
              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{landmark.name}</div>
              <div style={{ fontSize: '10px', color: '#666', textTransform: 'capitalize' }}>
                {landmark.category}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 2. Draw Online Vehicles (Kekes and Cabs) */}
        {kekes.filter(k => k.isOnline).map(keke => (
          <Marker
            key={`keke-${keke.id}`}
            position={[keke.lat, keke.lng]}
            icon={createKekeIcon(keke, selectedKekeId === keke.id)}
            eventHandlers={{
              click: () => kekeClickCallback && kekeClickCallback(keke)
            }}
          >
            <Popup>
              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {keke.vehicleType === 'keke' ? 'Solar Keke' : 'Campus Cab'} {keke.plateNumber}
              </div>
              {keke.vehicleType === 'keke' ? (
                <div style={{ fontSize: '11px' }}>
                  🔋 Battery: {keke.currentBatteryPercent}% ({keke.estimatedHoursRemaining} hrs left)
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 'bold' }}>
                  🚗 UCRide Cab Service
                </div>
              )}
              <div style={{ fontSize: '11px' }}>
                💺 Available Seats: {keke.currentSeatsAvailable}/{keke.vehicleType === 'keke' ? 5 : 4}
              </div>
              <div style={{ fontSize: '11px', color: keke.speed > 0 ? '#10b981' : '#666' }}>
                Status: {keke.speed > 0 ? `Moving (${keke.speed} km/h)` : 'Idle'}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 3. Draw polyline path for active trips (Google Maps style solid blue/green navigation line) */}
        {routeCoords.length > 0 && (
          <Polyline 
            positions={routeCoords} 
            color={routeTrip?.vehicleType === 'keke' ? '#10b981' : '#2563eb'} 
            weight={6} 
            opacity={0.85}
          />
        )}

        {/* 4. Draw Driver Demand Heatmaps (red/orange high-demand circles) */}
        {activeView === 'driver' && (
          <>
            <Circle 
              center={[6.3980, 5.6110]} 
              radius={130} 
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3, weight: 1 }}
            >
              <Popup><div style={{ fontSize: '10px', fontWeight: 'bold' }}>🔥 High Demand: Main Gate (Ugbowo)</div></Popup>
            </Circle>
            <Circle 
              center={[6.4020, 5.6180]} 
              radius={100} 
              pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.3, weight: 1 }}
            >
              <Popup><div style={{ fontSize: '10px', fontWeight: 'bold' }}>🔥 Moderate Demand: Faculty of Engineering</div></Popup>
            </Circle>
            <Circle 
              center={[6.3920, 5.6210]} 
              radius={110} 
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3, weight: 1 }}
            >
              <Popup><div style={{ fontSize: '10px', fontWeight: 'bold' }}>🔥 High Demand: Faculty of Medicine (UBTH Gate)</div></Popup>
            </Circle>
          </>
        )}
      </MapContainer>

      {/* Map legend in corner */}
      {showLegend && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          zIndex: 500,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '6px 10px',
          borderRadius: '6px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          fontSize: '9px',
          color: '#333',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '2px' }}>UNIBEN Map Legend</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div> Faculty
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8b5cf6' }}></div> Hostel
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div> Admin
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div> USRide Solar Hubs
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#1d4ed8' }}></div> UCRide Cabs
          </div>
        </div>
      )}
    </div>
  );
};
