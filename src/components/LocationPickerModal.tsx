/**
 * LocationPickerModal.tsx
 *
 * A full-screen map overlay that lets riders drag a pin to their exact location.
 * As the pin moves, the nearest UNIBEN campus landmark is highlighted in real-time.
 * Clicking "Confirm" snaps to that landmark and sets the pickup ID.
 *
 * Usage:
 *   <LocationPickerModal
 *     isOpen={showPicker}
 *     onClose={() => setShowPicker(false)}
 *     onConfirm={(landmarkId) => setPickupId(landmarkId)}
 *   />
 */

import React, { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LANDMARKS, Landmark } from '../context/USRideContext';
import { snapCoordinatesToNearestLandmark, getDistanceMeters } from '../utils/geofence';
import { X, CheckCircle, MapPin, Navigation } from 'lucide-react';

// UNIBEN campus centre
const CAMPUS_CENTER: [number, number] = [6.4020, 5.6180];

// ── Draggable pin icon ─────────────────────────────────────────────────────
const draggablePinIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    ">
      <div style="
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, #7c3aed, #4f46e5);
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 15px rgba(124, 58, 237, 0.5);
        cursor: grab;
      "></div>
      <div style="
        width: 8px;
        height: 8px;
        background: rgba(124, 58, 237, 0.3);
        border-radius: 50%;
        margin-top: 2px;
      "></div>
    </div>
  `,
  iconSize: [36, 44],
  iconAnchor: [18, 44],
});

// ── Category colour map ─────────────────────────────────────────────────────
const categoryColour: Record<string, string> = {
  hostel: '#8b5cf6',
  faculty: '#f59e0b',
  facility: '#10b981',
  admin: '#3b82f6',
};

const createLandmarkDot = (category: string, isNearest: boolean) => {
  const colour = categoryColour[category] ?? '#64748b';
  const size = isNearest ? 18 : 10;
  const border = isNearest ? `3px solid white` : `2px solid white`;
  const shadow = isNearest
    ? `0 0 0 3px ${colour}, 0 4px 12px rgba(0,0,0,0.3)`
    : `0 2px 4px rgba(0,0,0,0.2)`;

  return L.divIcon({
    className: '',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${colour};
      border: ${border};
      border-radius: 50%;
      box-shadow: ${shadow};
      transition: all 0.2s ease;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// ── Inner component: listens for map clicks and drag to move the pin ────────
interface PinMoverProps {
  position: [number, number];
  onMove: (lat: number, lng: number) => void;
}

const DraggablePin: React.FC<PinMoverProps> = ({ position, onMove }) => {
  // Click anywhere on map to teleport the pin
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <Marker
      position={position}
      icon={draggablePinIcon}
      draggable={true}
      eventHandlers={{
        dragend(e) {
          const latlng = (e.target as L.Marker).getLatLng();
          onMove(latlng.lat, latlng.lng);
        },
      }}
    />
  );
};

// ── Main Modal Component ────────────────────────────────────────────────────
interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the selected landmark id when user confirms */
  onConfirm: (landmarkId: string) => void;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [pinPosition, setPinPosition] = useState<[number, number]>(CAMPUS_CENTER);
  const [nearestLandmark, setNearestLandmark] = useState<Landmark>(() => {
    const snapped = snapCoordinatesToNearestLandmark(CAMPUS_CENTER[0], CAMPUS_CENTER[1], LANDMARKS);
    return LANDMARKS.find(lm => lm.id === snapped.id) ?? LANDMARKS[0];
  });

  const handlePinMove = useCallback((lat: number, lng: number) => {
    setPinPosition([lat, lng]);
    const snapped = snapCoordinatesToNearestLandmark(lat, lng, LANDMARKS);
    const full = LANDMARKS.find(lm => lm.id === snapped.id) ?? LANDMARKS[0];
    setNearestLandmark(full);
  }, []);

  const handleConfirm = () => {
    onConfirm(nearestLandmark.id);
    onClose();
  };

  if (!isOpen) return null;

  const distToNearest = getDistanceMeters(
    pinPosition[0], pinPosition[1],
    nearestLandmark.lat, nearestLandmark.lng
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          color: 'white',
          flexShrink: 0,
          zIndex: 1000,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MapPin size={20} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Pick Your Location</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Drag the pin or tap anywhere on the map</div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Map ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={CAMPUS_CENTER}
          zoom={16}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Render all campus landmarks as coloured dots */}
          {LANDMARKS.map((lm) => {
            const isNearest = lm.id === nearestLandmark.id;
            return (
              <Marker
                key={lm.id}
                position={[lm.lat, lm.lng]}
                icon={createLandmarkDot(lm.category, isNearest)}
              >
                <Popup>
                  <strong>{lm.name}</strong>
                  <br />
                  <span style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>
                    {lm.category}
                  </span>
                </Popup>
              </Marker>
            );
          })}

          {/* The draggable / tappable pin */}
          <DraggablePin position={pinPosition} onMove={handlePinMove} />
        </MapContainer>

        {/* ── Live nearest landmark banner ─────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'white',
            borderRadius: 12,
            padding: '8px 14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 220,
            maxWidth: '90%',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: categoryColour[nearestLandmark.category] ?? '#64748b',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
              {nearestLandmark.name}
            </div>
            <div style={{ fontSize: 10, color: '#64748b' }}>
              {Math.round(distToNearest)}m away · tap map or drag pin to move
            </div>
          </div>
        </div>

        {/* ── Tip label at bottom ──────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            fontSize: 10,
            color: '#64748b',
            background: 'rgba(255,255,255,0.85)',
            borderRadius: 8,
            padding: '4px 10px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          🟣 Hostel &nbsp;|&nbsp; 🟡 Faculty &nbsp;|&nbsp; 🟢 Facility &nbsp;|&nbsp; 🔵 Admin
        </div>
      </div>

      {/* ── Confirm Footer ──────────────────────────────────────────────── */}
      <div
        style={{
          padding: '14px 16px',
          background: 'white',
          flexShrink: 0,
          borderTop: '1px solid #e2e8f0',
        }}
      >
        <div style={{ marginBottom: 8, fontSize: 12, color: '#475569' }}>
          <span style={{ fontWeight: 700, color: '#1e293b' }}>Pickup will be set to: </span>
          {nearestLandmark.name}
        </div>
        <button
          onClick={handleConfirm}
          style={{
            width: '100%',
            padding: '13px',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 15,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 15px rgba(79, 70, 229, 0.4)',
          }}
        >
          <CheckCircle size={18} />
          Confirm — {nearestLandmark.name}
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '10px',
            marginTop: 8,
            background: 'none',
            color: '#64748b',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cancel — Select Manually Instead
        </button>
      </div>
    </div>
  );
};
