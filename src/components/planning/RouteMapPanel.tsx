import { useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, ExternalLink, GripVertical, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';


interface Stop {
  code: string;
  name: string;
  city?: string;
  lat?: number | null;
  lng?: number | null;
  suggested_time?: string;
}

interface RouteMapPanelProps {
  stops: Stop[];
  startPoint?: { lat: number; lng: number; label?: string } | null;
  finishPoint?: { lat: number; lng: number; label?: string } | null;
  dayLabel: string;
  googleMapsUrl: string | null;
  onClose: () => void;
  onRemove: (code: string) => void;
  onReorder?: (fromIdx: number, toIdx: number) => void;
  onReverseOrder?: () => void;
  onSetStart?: (lat: number, lng: number, label: string) => void;
  onSetFinish?: (lat: number, lng: number, label: string) => void;
  customers?: any[];
  onOpenCustomerMap?: (customer: any) => void;
  savedHotels?: { id: string; name: string; area: string; lat: number; lng: number }[];
  onUpdateStopCoords?: (code: string, lat: number, lng: number) => void;
}

function createNumberedIcon(n: number, color = '#4f46e5') {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;background:${color};
      color:#fff;font-size:12px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);
    ">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createSpecialIcon(type: 'start' | 'finish') {
  const color = type === 'start' ? '#16a34a' : '#dc2626';
  const label = type === 'start' ? '▶' : '■';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;background:${color};
      color:#fff;font-size:13px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function RouteMapPanel({
  stops, startPoint, finishPoint, dayLabel, googleMapsUrl,
  onClose, onRemove, onReorder, onReverseOrder, onSetStart, onSetFinish, customers = [], onOpenCustomerMap, savedHotels = [], onUpdateStopCoords,
}: RouteMapPanelProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);
  const [startInput, setStartInput] = useState(startPoint?.label ?? '');
  const [finishInput, setFinishInput] = useState(finishPoint?.label ?? '');
  const [hotelAreaFilter, setHotelAreaFilter] = useState('');

  const parseCoord = (val: string, setter: (lat: number, lng: number, label: string) => void) => {
    const parts = val.trim().split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      setter(parts[0], parts[1], val);
    }
  };

  const located = stops.filter(s => s.lat && s.lng);
  const unlocated = stops.filter(s => !s.lat || !s.lng);

  const routePoints: [number, number][] = [
    ...(startPoint ? [[startPoint.lat, startPoint.lng] as [number, number]] : []),
    ...located.map(s => [s.lat!, s.lng!] as [number, number]),
    ...(finishPoint ? [[finishPoint.lat, finishPoint.lng] as [number, number]] : []),
  ];

  const allPoints = routePoints;
  const centerLat = allPoints.length ? allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length : 37.9;
  const centerLng = allPoints.length ? allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length : 23.7;

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (idx !== dragIdx) setDragOverIdx(idx);
  };
  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx && onReorder) {
      onReorder(dragIdx, idx);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const refreshUnlocated = async () => {
    const codes = unlocated.map(s => s.code);
    if (!codes.length || !onUpdateStopCoords) return;
    const { data } = await supabase
      .from('crm_customer_coordinates')
      .select('customer_code, lat, lng, coord_source, captured_by')
      .in('customer_code', codes);
    for (const coord of data ?? []) {
      if ((coord.coord_source === 'gps' || coord.coord_source === 'map' || coord.captured_by) && coord.lat && coord.lng) {
        onUpdateStopCoords(coord.customer_code, coord.lat, coord.lng);
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-600 text-white">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span>🗺</span>
          <span>{dayLabel}</span>
          <span className="font-normal opacity-75">· {stops.length} στάσεις · {located.length} στον χάρτη</span>
        </div>
        <div className="flex items-center gap-2">
          {googleMapsUrl && (
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 bg-white text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-50 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> Google Maps
            </a>
          )}
          <button onClick={onClose} className="p-1 hover:bg-indigo-500 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          <MapContainer
            center={[centerLat, centerLng]}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {routePoints.length > 1 && (
              <Polyline positions={routePoints} color="#4f46e5" weight={2.5} dashArray="6 4" opacity={0.8} />
            )}
            {startPoint && (
              <Marker position={[startPoint.lat, startPoint.lng]} icon={createSpecialIcon('start')}>
                <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                  <span className="text-xs font-medium">▶ {startPoint.label || 'Αφετηρία'}</span>
                </Tooltip>
              </Marker>
            )}
            {finishPoint && (
              <Marker position={[finishPoint.lat, finishPoint.lng]} icon={createSpecialIcon('finish')}>
                <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                  <span className="text-xs font-medium">🏁 {finishPoint.label || 'Τελικό σημείο'}</span>
                </Tooltip>
              </Marker>
            )}
            {stops.map((stop, idx) => {
              if (!stop.lat || !stop.lng) return null;
              return (
                <Marker
                  key={stop.code}
                  position={[stop.lat, stop.lng]}
                  icon={createNumberedIcon(idx + 1)}
                >
                  <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                    <div style={{ maxWidth: '160px' }}>
                      <div className="text-xs font-semibold">{stop.name}</div>
                      {stop.city && <div className="text-xs text-slate-500">{stop.city}</div>}
                      {stop.suggested_time && <div className="text-xs text-indigo-600">{stop.suggested_time}</div>}
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <div className="w-72 flex flex-col border-l border-slate-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-600">Σειρά Στάσεων</div>
                <div className="text-xs text-slate-400">Σύρετε για αναδιάταξη</div>
              </div>
              {onReverseOrder && (
                <button
                  onClick={onReverseOrder}
                  className="px-2 py-1 text-xs bg-slate-200 hover:bg-slate-300 text-slate-600 rounded transition-colors"
                  title="Αντίστροφη σειρά">
                  ↕ Αντίστροφη
                </button>
              )}
            </div>
            {onSetStart && (
              <input
                type="text"
                placeholder="▶ Αφετηρία: 40.123, 22.456"
                value={startInput}
                onChange={e => { setStartInput(e.target.value); parseCoord(e.target.value, onSetStart); }}
                className="w-full px-2 py-1 text-xs border border-green-300 rounded focus:ring-1 focus:ring-green-400 focus:outline-none placeholder:text-slate-300"
              />
            )}
            {onSetFinish && (
              <input
                type="text"
                placeholder="🏁 Τελικό σημείο: 40.123, 22.456"
                value={finishInput}
                onChange={e => { setFinishInput(e.target.value); parseCoord(e.target.value, onSetFinish); }}
                className="w-full px-2 py-1 text-xs border border-red-300 rounded focus:ring-1 focus:ring-red-400 focus:outline-none placeholder:text-slate-300"
              />
            )}
            {savedHotels.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs text-slate-400 font-medium">🏨 Ξενοδοχεία:</span>
                  {[...new Set(savedHotels.map((h: any) => h.area))].length > 1 && (
                    <select value={hotelAreaFilter} onChange={e => setHotelAreaFilter(e.target.value)}
                      className="ml-auto text-xs border border-slate-200 rounded px-1 py-0.5 text-slate-600">
                      <option value="">Όλες</option>
                      {[...new Set(savedHotels.map((h: any) => h.area))].sort().map((a: any) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {savedHotels
                    .filter((h: any) => !hotelAreaFilter || h.area === hotelAreaFilter)
                    .map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between gap-1 p-1.5 bg-white border border-slate-200 rounded">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-slate-700 truncate">{h.name}</div>
                          <div className="text-xs text-slate-400">{h.area}</div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {onSetStart && (
                            <button onClick={() => { setStartInput(h.name); onSetStart(h.lat, h.lng, h.name); }}
                              className="px-1.5 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">▶</button>
                          )}
                          {onSetFinish && (
                            <button onClick={() => { setFinishInput(h.name); onSetFinish(h.lat, h.lng, h.name); }}
                              className="px-1.5 py-0.5 bg-red-600 text-white rounded text-xs hover:bg-red-700">🏁</button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
                
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {stops.map((stop, idx) => {
              const isDragging = dragIdx === idx;
              const isDragOver = dragOverIdx === idx && !isDragging;
              return (
                <div
                  key={stop.code}
                  ref={idx === dragIdx ? dragNode : null}
                  draggable={!!onReorder}
                  onDragStart={e => handleDragStart(e, idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={e => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 px-3 py-2 transition-colors select-none cursor-default
                    ${isDragging ? 'opacity-40 bg-indigo-50' : ''}
                    ${isDragOver ? 'border-t-2 border-indigo-400 bg-indigo-50' : ''}
                    ${!isDragging && !isDragOver ? 'hover:bg-slate-50' : ''}
                  `}
                >
                  {onReorder && (
                    <div className="cursor-grab text-slate-300 hover:text-slate-500 shrink-0 active:cursor-grabbing">
                      <GripVertical className="w-4 h-4" />
                    </div>
                  )}
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-700 truncate">{stop.name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1 flex-wrap">
                      {stop.suggested_time && <span className="text-indigo-500 font-medium">{stop.suggested_time}</span>}
                      {stop.city && <span>· {stop.city}</span>}
                      {!stop.lat && <span className="text-amber-500">· χωρίς θέση</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(stop.code)}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 space-y-1">
            {startPoint && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-3 h-3 rounded-full bg-green-600 inline-block shrink-0" />
                {startPoint.label || 'Αφετηρία'}
              </div>
            )}
            {finishPoint && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-3 h-3 rounded-full bg-red-600 inline-block shrink-0" />
                {finishPoint.label || 'Τελικό σημείο'}
              </div>
            )}
            {unlocated.length > 0 && (
              <div className="border-t border-amber-200 mt-1 pt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-amber-600 font-medium">⚠ Χωρίς συντεταγμένες:</span>
                  {onUpdateStopCoords && (
                    <button onClick={refreshUnlocated} className="text-xs text-indigo-600 hover:text-indigo-800">↺ Ανανέωση</button>
                  )}
                </div>
                {unlocated.map(stop => {
                  const fullCust = customers.find((c: any) => c.code === stop.code);
                  return (
                    <div key={stop.code} className="flex items-center justify-between gap-1 py-0.5">
                      <span className="text-xs text-slate-600 truncate">{stop.name}</span>
                      {onOpenCustomerMap && fullCust && (
                        <button onClick={() => onOpenCustomerMap(fullCust)}
                          className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 shrink-0">
                          Επεξ. θέση
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
