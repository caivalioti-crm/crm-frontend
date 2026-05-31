import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  X, ExternalLink, ChevronUp, ChevronDown, AlertTriangle, MapPin, Star, Trash2, 
} from 'lucide-react';

// ── Fix Leaflet's broken default icons under Vite ──────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Icon factories ─────────────────────────────────────────────────────────

function stopIcon(n: number, bg = '#4f46e5') {
  return L.divIcon({
    html: `<div style="
      background:${bg};color:#fff;border-radius:50%;
      width:30px;height:30px;display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:13px;
      box-shadow:0 2px 6px rgba(0,0,0,.45);border:2px solid #fff;
    ">${n}</div>`,
    className: '',
    iconSize:   [30, 30],
    iconAnchor: [15, 15],
    popupAnchor:[0, -18],
  });
}

function startIcon(label = 'Αφετηρία') {
  return L.divIcon({
    html: `<div style="
      background:#16a34a;color:#fff;border-radius:8px;
      padding:3px 8px;font-weight:700;font-size:11px;
      box-shadow:0 2px 6px rgba(0,0,0,.4);border:2px solid #fff;white-space:nowrap;
    ">🏨 ${label}</div>`,
    className: '',
    iconSize:   [120, 26],
    iconAnchor: [60, 13],
    popupAnchor:[0, -16],
  });
}

// ── Auto-fit map to all visible points ────────────────────────────────────

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView(points[0], 14); return; }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface RouteStop {
  code: string;
  name: string;
  city: string | null;
  area: string | null;
  address: string | null;
  lat?: number | null;
  lng?: number | null;
  suggested_time?: string;
  duration_minutes?: number;
  tier: number;
  sos?: boolean;
}

interface RouteMapPanelProps {
  stops: RouteStop[];
  startPoint: { lat: number; lng: number; label?: string } | null;
  dayLabel: string;
  googleMapsUrl: string | null;
  onClose: () => void;
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
  onRemove: (code: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function RouteMapPanel({
  stops,
  startPoint,
  dayLabel,
  googleMapsUrl,
  onClose,
  onMoveUp,
  onMoveDown,
  onRemove,
}: RouteMapPanelProps) {

  const withCoords    = stops.filter(s => s.lat && s.lng);
  const withoutCoords = stops.filter(s => !s.lat || !s.lng);

  // Build polyline: hotel → all stops with coords (in route order)
  const polylinePoints: [number, number][] = [
    ...(startPoint ? [[startPoint.lat, startPoint.lng] as [number, number]] : []),
    ...stops
      .filter(s => s.lat && s.lng)
      .map(s => [s.lat!, s.lng!] as [number, number]),
  ];

  // All located points (for FitBounds)
  const allPoints: [number, number][] = [
    ...(startPoint ? [[startPoint.lat, startPoint.lng] as [number, number]] : []),
    ...withCoords.map(s => [s.lat!, s.lng!] as [number, number]),
  ];

  const fallbackCenter: [number, number] = allPoints.length
    ? [
        allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length,
        allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length,
      ]
    : [39.5, 22.0];

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-indigo-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 shrink-0" />
            <span className="font-bold text-base">{dayLabel}</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {stops.length} στάσεις · {withCoords.length} στον χάρτη
            </span>
            {withoutCoords.length > 0 && (
              <span className="text-xs bg-amber-400/80 px-2 py-0.5 rounded-full text-white font-medium">
                {withoutCoords.length} χωρίς θέση
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {googleMapsUrl && (
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-50 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Google Maps
              </a>
            )}
            <button onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Map ── */}
          <div className="flex-1 relative">
            <MapContainer
              center={fallbackCenter}
              zoom={11}
              style={{ width: '100%', height: '100%' }}
              zoomControl
            >
              <FitBounds points={allPoints} />

              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />

              {/* Starting point */}
              {startPoint && (
                <Marker
                  position={[startPoint.lat, startPoint.lng]}
                  icon={startIcon(startPoint.label ?? 'Αφετηρία')}
                >
                  <Popup>
                    <div className="text-sm font-semibold">🏨 {startPoint.label ?? 'Αφετηρία'}</div>
                  </Popup>
                </Marker>
              )}

              {/* Stop markers (numbered in route order) */}
              {stops.map((s, idx) => {
                if (!s.lat || !s.lng) return null;
                const bg = s.sos ? '#f59e0b' : '#4f46e5';
                return (
                  <Marker key={s.code} position={[s.lat, s.lng]} icon={stopIcon(idx + 1, bg)}>
                    <Popup minWidth={200}>
                      <div className="text-sm">
                        <div className="font-bold text-slate-800">
                          #{idx + 1}{s.suggested_time ? ` · ${s.suggested_time}` : ''}
                          {s.sos && <span className="ml-1 text-amber-500">★ SOS</span>}
                        </div>
                        <div className="font-medium text-indigo-700 mt-0.5">{s.name}</div>
                        <div className="text-slate-400 font-mono text-xs">{s.code}</div>
                        {s.address && <div className="text-slate-500 text-xs mt-1">{s.address}</div>}
                        {s.city    && <div className="text-slate-400 text-xs">{s.city}</div>}
                        {s.duration_minutes && (
                          <div className="text-slate-400 text-xs">Διάρκεια: {s.duration_minutes}′</div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Route polyline */}
              {polylinePoints.length >= 2 && (
                <Polyline
                  positions={polylinePoints}
                  pathOptions={{ color: '#4f46e5', weight: 3, opacity: 0.75, dashArray: '8 5' }}
                />
              )}
            </MapContainer>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-[400] bg-white/90 backdrop-blur rounded-xl px-3 py-2 shadow text-xs text-slate-600 flex flex-col gap-1 pointer-events-none">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-600 inline-block" /> Στάση
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-400 inline-block" /> SOS
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-green-600 inline-block" /> Αφετηρία
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-slate-400 inline-block" /> Χωρίς θέση
              </span>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="w-72 border-l border-slate-200 flex flex-col bg-slate-50 shrink-0">

            <div className="px-4 py-3 bg-white border-b border-slate-200 shrink-0">
              <div className="text-sm font-semibold text-slate-700">Σειρά Στάσεων</div>
              <div className="text-xs text-slate-400 mt-0.5">Αναδιατάξτε με τα βέλη</div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {stops.map((s, idx) => (
                <div key={s.code}
                  className={`flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-slate-50 transition-colors ${s.sos ? 'border-l-2 border-amber-400' : ''}`}>

                  {/* Number badge */}
                  <div
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: !s.lat || !s.lng ? '#94a3b8' : s.sos ? '#f59e0b' : '#4f46e5' }}>
                    {idx + 1}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      {s.sos && <Star className="w-3 h-3 text-amber-400 shrink-0" />}
                      <span className="text-xs font-medium text-slate-700 truncate">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      {s.suggested_time && <span>{s.suggested_time}</span>}
                      {s.city && <span className="truncate">· {s.city}</span>}
                    </div>
                    {!s.lat && !s.lng && (
                      <div className="flex items-center gap-0.5 text-xs text-amber-600">
                        <AlertTriangle className="w-3 h-3" /> Χωρίς θέση
                      </div>
                    )}
                  </div>

                  {/* Move / remove */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => onMoveUp(idx)} disabled={idx === 0}
                      className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-25 transition-colors">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onMoveDown(idx)} disabled={idx === stops.length - 1}
                      className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-25 transition-colors">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onRemove(s.code)}
                      className="p-0.5 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Unlocated stops summary */}
            {withoutCoords.length > 0 && (
              <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 shrink-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {withoutCoords.length} στάσεις εκτός χάρτη
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {withoutCoords.map(s => (
                    <div key={s.code} className="text-xs text-amber-700 truncate">
                      · {s.name} <span className="font-mono text-amber-500">{s.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
