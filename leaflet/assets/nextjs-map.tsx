// Next.js Leaflet starter — works with App Router AND Pages Router.
//
// The pattern: split into TWO files.
//   1. MapWrapper.tsx — a thin shell that dynamic-imports the real component with ssr: false
//   2. Map.tsx        — the actual react-leaflet component (only runs client-side)
//
// Then use <MapWrapper /> in your page. Don't import Map.tsx directly in pages — Leaflet
// will crash during server render with "ReferenceError: window is not defined".
//
// Setup:
//   npm install leaflet react-leaflet
//   npm install -D @types/leaflet
//
// File layout:
//   app/
//     components/
//       MapWrapper.tsx    <-- this file (the wrapper)
//       Map.tsx           <-- the actual map (see bottom of file)
//     page.tsx            <-- imports MapWrapper

// ============================================================================
// FILE 1: app/components/MapWrapper.tsx
// ============================================================================
'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

// Important: ssr: false is what actually prevents the server render from
// touching Leaflet. 'use client' alone is NOT enough — client components are
// still server-rendered to initial HTML.
const Map = dynamic(
  () => import('./Map').then((mod) => mod.Map),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: '500px',
          width: '100%',
          display: 'grid',
          placeItems: 'center',
          background: '#f3f4f6',
          color: '#6b7280',
        }}
      >
        Loading map…
      </div>
    ),
  }
);

type MapProps = ComponentProps<typeof Map>;

export function MapWrapper(props: MapProps) {
  return <Map {...props} />;
}

// ============================================================================
// FILE 2: app/components/Map.tsx
// ============================================================================
// (Paste the following into a separate file — it's shown here for completeness.)
/*
'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Marker icon fix for Next.js (bundler rewrites the asset paths)
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl.src,   // Next.js gives you a StaticImageData object
  iconUrl:       iconUrl.src,
  shadowUrl:     shadowUrl.src,
});

interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

export interface MapProps {
  points?: MapPoint[];
  center?: [number, number];
  zoom?: number;
}

export function Map({
  points = [],
  center = [51.505, -0.09],
  zoom = 13,
}: MapProps) {
  return (
    <MapContainer
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
      {points.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]}>
          <Popup>{p.label}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
*/

// ============================================================================
// FILE 3: app/page.tsx — usage example
// ============================================================================
/*
import { MapWrapper } from './components/MapWrapper';

export default function Page() {
  const points = [
    { id: '1', lat: 51.5074, lng: -0.1278, label: 'London' },
    { id: '2', lat: 51.5152, lng: -0.082, label: 'City of London' },
  ];

  return (
    <main style={{ padding: '2rem' }}>
      <h1>My Map</h1>
      <MapWrapper points={points} />
    </main>
  );
}
*/

// ============================================================================
// NOTES
// ============================================================================
//
// • In Next.js, .png imports come back as a StaticImageData object, not a string.
//   That's why the marker icon fix uses `iconRetinaUrl.src` (etc.) — see Map.tsx.
//
// • If you see hydration warnings related to the map's contents, double-check that
//   only the wrapper file uses `dynamic({ ssr: false })` — the inner Map.tsx
//   should be a normal client component.
//
// • For App Router with React Server Components, the `MapWrapper` itself must be
//   a client component ('use client') because next/dynamic with ssr:false is a
//   client-only feature.
//
// • Pages Router users: the same pattern works without 'use client' — just
//   create the dynamic import in your pages/components.

export {};
