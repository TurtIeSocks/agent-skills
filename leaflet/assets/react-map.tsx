// React + TypeScript Leaflet starter
//
// Setup:
//   npm install react react-dom leaflet react-leaflet
//   npm install -D @types/leaflet
//
// IMPORTANT: import 'leaflet/dist/leaflet.css' at your app entry point (or here).
// IMPORTANT: if marker icons look broken, run the icon-fix block once at startup.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  FeatureGroup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// -------- Marker icon fix for bundlers (run once) --------
// Without this, default markers may render with broken images.
// Most bundlers turn these imports into URLs.
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

// -------- Types --------
interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

interface MyMapProps {
  points: MapPoint[];
  center?: L.LatLngExpression;
  zoom?: number;
  onPick?: (latlng: L.LatLng) => void;
}

// -------- Side-effect components --------

/** Fit the map to a set of points whenever they change. */
function FitToPoints({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as L.LatLngTuple));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

/** Click anywhere on the map to call onPick. */
function ClickToPick({ onPick }: { onPick?: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick?.(e.latlng);
    },
  });
  return null;
}

/** Re-invalidate map size when a parent container resizes. */
function HandleResize({ trigger }: { trigger: unknown }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map, trigger]);
  return null;
}

// -------- Main component --------

export function MyMap({
  points,
  center = [51.505, -0.09],
  zoom = 13,
  onPick,
}: MyMapProps) {
  // Example: imperative ref if you need it
  const mapRef = useRef<L.Map>(null);

  const numberIcon = useMemo(
    () => (n: number) =>
      L.divIcon({
        className: 'number-pin-wrapper',
        html: `<div style="
          display:grid;place-items:center;
          width:32px;height:32px;border-radius:50%;
          background:#ef4444;color:white;font-weight:600;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
        ">${n}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    []
  );

  return (
    <MapContainer
      ref={mapRef}
      center={center}
      zoom={zoom}
      style={{ height: '500px', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />

      <FeatureGroup>
        {points.map((p, i) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={numberIcon(i + 1)}>
            <Popup>
              <b>{p.label}</b>
            </Popup>
          </Marker>
        ))}
      </FeatureGroup>

      <FitToPoints points={points} />
      <ClickToPick onPick={onPick} />
    </MapContainer>
  );
}

// -------- Example usage --------

export function MyMapDemo() {
  const [pickedAt, setPickedAt] = useState<L.LatLng | null>(null);

  const points: MapPoint[] = [
    { id: '1', lat: 51.5074, lng: -0.1278, label: 'London' },
    { id: '2', lat: 51.5152, lng: -0.082, label: 'City of London' },
    { id: '3', lat: 51.4994, lng: -0.1245, label: 'Westminster' },
  ];

  return (
    <div>
      <MyMap points={points} onPick={setPickedAt} />
      {pickedAt && (
        <p>
          Picked: [{pickedAt.lat.toFixed(4)}, {pickedAt.lng.toFixed(4)}]
        </p>
      )}
    </div>
  );
}
