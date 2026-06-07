import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MapPin, Search, Save, RotateCcw, Navigation, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { smartMatch } from '../../utils/smartSearch';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function authedFetch(url: string, options?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

type CustomerCoord = {
  customer_code: string;
  customer_name: string;
  city: string;
  area: string;
  address: string;
  salesman_code: string;
  lat: number | null;
  lng: number | null;
  accuracy_meters: number | null;
  captured_by: string | null;
  captured_at: string | null;
  has_coords: boolean;
};

type Props = {
  currentUser: { id: string; role: string; salesman_code: string | null; name: string };
  initialCustomers?: any[];
  singleCustomer?: { code: string; name: string; address?: string; city?: string; area?: string };
  onClose: () => void;
  onSelectCustomer?: (customer: any) => void;
  repList?: { id: string; full_name: string; salesman_code: string }[];
  dateFrom?: string;
  dateTo?: string;
};

const FULL_ACCESS_ROLES = ['admin', 'manager', 'exec'];

export function CustomerMap({ currentUser, singleCustomer, onClose, onSelectCustomer, repList = [], dateFrom, dateTo }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const dragMarkerRef = useRef<any>(null);
  const preserveViewRef = useRef(false);

  const isPrivileged = FULL_ACCESS_ROLES.includes(currentUser.role);

  const [customers, setCustomers] = useState<CustomerCoord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRep, setFilterRep] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [showNoCoords, setShowNoCoords] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  const [editing, setEditing] = useState<CustomerCoord | null>(null);
  const [editLat, setEditLat] = useState<number | null>(null);
  const [editLng, setEditLng] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCode, setSavedCode] = useState<string | null>(null);

  const [popup, setPopup] = useState<CustomerCoord | null>(null);
  const [customerRevenue, setCustomerRevenue] = useState<Map<string, number>>(new Map());
  const [filterL1, setFilterL1] = useState('');
  const [filterL2, setFilterL2] = useState('');
  const [l1Categories, setL1Categories] = useState<{code: string; name: string}[]>([]);
  const [l2Categories, setL2Categories] = useState<{code: string; name: string}[]>([]);
  const [categoryCustomers, setCategoryCustomers] = useState<Set<string> | null>(null);

  // ── Init Leaflet ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const L = (window as any).L;
    if (!L) { console.error('Leaflet not loaded'); return; }

    const map = L.map(mapRef.current, { zoomControl: true }).setView([39.5, 22.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (singleCustomer) {
        const data = await authedFetch(`/api/coordinates?customer_code=${singleCustomer.code}`);
        setCustomers(Array.isArray(data) ? data : [data]);
      } else {
        const params = new URLSearchParams();
        if (filterRep) params.set('salesman_code', filterRep);
        if (filterArea) params.set('area', filterArea);
        if (filterCity) params.set('city', filterCity);
        const data: CustomerCoord[] = await authedFetch(`/api/coordinates?${params.toString()}`);
        setCustomers(data ?? []);
        const uniqueAreas = [...new Set(data.map(c => c.area).filter(Boolean))].sort();
        setAreas(uniqueAreas);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [singleCustomer, filterRep, filterArea, filterCity]);

  useEffect(() => { loadData(); }, [loadData]);


 // Revenue map for performance coloring
  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    supabase.rpc('get_customer_revenue_map', { p_from: dateFrom, p_to: dateTo })
      .then(({ data }) => {
        if (data) setCustomerRevenue(new Map(data.map((r: any) => [r.customer_code, Number(r.total_revenue)])));
      });
  }, [dateFrom, dateTo]);

  // L1 categories on mount
  useEffect(() => {
    supabase.from('crm_category_master').select('category_code, short_name')
      .eq('level', 1).order('category_code')
      .then(({ data }) => setL1Categories((data ?? []).map((c: any) => ({ code: c.category_code, name: c.short_name }))));
  }, []);

  // L2 when L1 changes
  useEffect(() => {
    if (!filterL1) { setL2Categories([]); setFilterL2(''); return; }
    supabase.from('crm_category_master').select('category_code, short_name')
      .eq('level', 2).eq('parent_code', filterL1).order('category_code')
      .then(({ data }) => setL2Categories((data ?? []).map((c: any) => ({ code: c.category_code, name: c.short_name }))));
    setFilterL2('');
  }, [filterL1]);

  // Category customer filter
  useEffect(() => {
    const code = filterL2 || filterL1;
    if (!code) { setCategoryCustomers(null); return; }
    const table = filterL2 ? 'mv_customer_l2_categories' : 'mv_customer_l1_categories';
    const field = filterL2 ? 'l2_code' : 'l1_code';
    supabase.from(table).select('customer_code').eq(field, code)
      .then(({ data }) => setCategoryCustomers(new Set((data ?? []).map((r: any) => r.customer_code))));
  }, [filterL1, filterL2]);

  // Update cities when area changes
  useEffect(() => {
    if (filterArea) {
      const areaCustomers = customers.filter(c => c.area === filterArea);
      const uniqueCities = [...new Set(areaCustomers.map(c => c.city).filter(Boolean))].sort();
      setCities(uniqueCities);
      setFilterCity('');
    } else {
      setCities([]);
      setFilterCity('');
    }
  }, [filterArea, customers]);

  // ── Render markers ────────────────────────────────────────────────────────
  useEffect(() => {
    const L = (window as any).L;
    const map = leafletMap.current;
    if (!L || !map) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    // Percentile-based performance coloring
    const activeRevenues = customers
      .map(c => customerRevenue.get(c.customer_code) ?? 0)
      .filter(r => r > 0).sort((a, b) => a - b);
    const getPerformanceColor = (code: string): string => {
      if (customerRevenue.size === 0) return '#EF9F27';
      const rev = customerRevenue.get(code) ?? 0;
      if (rev === 0) return '#94A3B8';
      const pct = activeRevenues.filter(r => r <= rev).length / activeRevenues.length;
      if (pct < 0.25) return '#BAE6FD';
      if (pct < 0.50) return '#38BDF8';
      if (pct < 0.75) return '#0EA5E9';
      if (pct < 0.90) return '#0284C7';
      return '#1E3A8A';
    };

    const filtered = customers.filter(c => {
      if (showNoCoords) return !c.has_coords;
      if (!c.lat || !c.lng) return false;
      if (categoryCustomers !== null && !categoryCustomers.has(c.customer_code)) return false;
      if (search && !['customer_name', 'customer_code', 'city', 'area'].some(k =>
        smartMatch((c as any)[k] ?? '', search)
      )) return false;
      return true;
    });

    if (filtered.length === 0) return;

    const bounds: [number, number][] = [];

    filtered.forEach(c => {
      if (!c.lat || !c.lng) return;

      const color = customerRevenue.size > 0
        ? getPerformanceColor(c.customer_code)
        : (c.captured_by ? '#E24B4A' : c.accuracy_meters && c.accuracy_meters <= 50 ? '#1D9E75' : '#EF9F27');
      const canEdit = isPrivileged || String(c.salesman_code) === String(currentUser.salesman_code);

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:${canEdit ? 'pointer' : 'default'};"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });

      const marker = L.marker([c.lat, c.lng], { icon })
        .addTo(map)
        .on('click', () => setPopup(c));

      markersRef.current.set(c.customer_code, marker);
      bounds.push([c.lat, c.lng]);
    });

    if (bounds.length && !singleCustomer) {
      if (!preserveViewRef.current) {
        const greekBounds = bounds.filter(([lat, lng]) => lat >= 34 && lat <= 42 && lng >= 18 && lng <= 30);
        const fitTarget = greekBounds.length > 0 ? greekBounds : bounds;
        map.fitBounds(fitTarget, { padding: [40, 40], maxZoom: 10 });
      }
      preserveViewRef.current = false;
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }
  }, [customers, search, showNoCoords, isPrivileged, currentUser.salesman_code, singleCustomer]);

  // ── Start editing ─────────────────────────────────────────────────────────
  const startEdit = useCallback((c: CustomerCoord) => {
    const L = (window as any).L;
    const map = leafletMap.current;
    if (!L || !map) return;

    setEditing(c);
    setPopup(null);

    const lat = c.lat ?? 39.5;
    const lng = c.lng ?? 22.5;
    setEditLat(lat);
    setEditLng(lng);

    if (dragMarkerRef.current) dragMarkerRef.current.remove();

    const dragIcon = L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;border-radius:50%;background:#378ADD;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:grab;"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const dragMarker = L.marker([lat, lng], { icon: dragIcon, draggable: true }).addTo(map);
    dragMarker.on('dragend', (e: any) => {
      const pos = e.target.getLatLng();
      setEditLat(Math.round(pos.lat * 1000000) / 1000000);
      setEditLng(Math.round(pos.lng * 1000000) / 1000000);
    });

    dragMarkerRef.current = dragMarker;
    map.setView([lat, lng], 15);
  }, []);

useEffect(() => {
    if (singleCustomer && customers.length > 0 && !editing) {
      const match = customers.find(
        c => String(c.customer_code) === String(singleCustomer.code)
      );
      if (match) startEdit(match);
    }
  }, [customers, singleCustomer, startEdit, editing]);

  const cancelEdit = useCallback(() => {
    if (dragMarkerRef.current) { dragMarkerRef.current.remove(); dragMarkerRef.current = null; }
    setEditing(null);
    setEditLat(null);
    setEditLng(null);
  }, []);

  const saveCoords = useCallback(async () => {
    if (!editing || editLat === null || editLng === null) return;
    setSaving(true);
    try {
      await authedFetch(`/api/coordinates/${editing.customer_code}`, {
        method: 'PATCH',
        body: JSON.stringify({ lat: editLat, lng: editLng, accuracy_meters: 10 }),
      });
      setSavedCode(editing.customer_code);
      setTimeout(() => setSavedCode(null), 2000);
      cancelEdit();
      preserveViewRef.current = true;
      loadData();
    } catch (err) {
      alert('Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  }, [editing, editLat, editLng, cancelEdit, loadData]);

  // ── Use current GPS for edit ───────────────────────────────────────────────
  const useGPS = useCallback(() => {
    if (!navigator.geolocation || !dragMarkerRef.current) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      dragMarkerRef.current.setLatLng([latitude, longitude]);
      setEditLat(Math.round(latitude * 1000000) / 1000000);
      setEditLng(Math.round(longitude * 1000000) / 1000000);
      leafletMap.current?.setView([latitude, longitude], 17);
    }, () => alert('Αδυναμία εντοπισμού τοποθεσίας'), { enableHighAccuracy: true });
  }, []);

  

  const noCoordCount = customers.filter(c => !c.has_coords).length;
  const mapsSearchUrl = editing
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [editing.customer_name, editing.address, editing.city, editing.area, 'Greece']
          .filter(Boolean).join(', ')
      )}`
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 text-white shrink-0 flex-wrap">
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="font-semibold text-sm shrink-0">
          {singleCustomer ? singleCustomer.name : 'Customer Map'}
        </div>

        {!singleCustomer && (
          <>
            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Αναζήτηση..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"
              />
            </div>

            {/* Rep filter — privileged only */}
            {isPrivileged && repList.length > 0 && (
              <select
                value={filterRep}
                onChange={e => setFilterRep(e.target.value)}
                className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-400"
              >
                <option value="">Όλοι οι αντιπρόσωποι</option>
                {repList.filter(r => r.salesman_code && ['rep', 'manager'].includes((r as any).role ?? 'rep')).map(r => (
              <option key={r.id} value={r.salesman_code}>{r.full_name}</option>
            ))}
              </select>
            )}

            {/* Area filter */}
            {areas.length > 0 && (
              <select
                value={filterArea}
                onChange={e => setFilterArea(e.target.value)}
                className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-400"
              >
                <option value="">Όλες οι περιοχές</option>
                {areas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}

            {/* City filter */}
            {cities.length > 0 && (
              <select
                value={filterCity}
                onChange={e => setFilterCity(e.target.value)}
                className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-400"
              >
                <option value="">Όλες οι πόλεις</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {/* L1 category filter */}
            {l1Categories.length > 0 && (
              <select value={filterL1} onChange={e => setFilterL1(e.target.value)}
                className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-400">
                <option value="">Όλες κατηγορίες L1</option>
                {l1Categories.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            )}
            {l2Categories.length > 0 && (
              <select value={filterL2} onChange={e => setFilterL2(e.target.value)}
                className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-400">
                <option value="">Όλες κατηγορίες L2</option>
                {l2Categories.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            )}

            {/* No coords toggle */}
            {noCoordCount > 0 && (
              <button
                onClick={() => setShowNoCoords(v => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showNoCoords ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-amber-400'}`}
              >
                <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                {noCoordCount} χωρίς coords
              </button>
            )}
          </>
        )}

        {loading && <span className="text-xs text-slate-400 ml-auto">Φόρτωση...</span>}
        <span className="text-xs text-slate-400 ml-auto">{customers.length} πελάτες · {customers.filter(c => c.has_coords).length} με coords</span>
      </div>

{/* ── Edit bar ── */}
      {editing && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-700 text-white shrink-0 flex-wrap">
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium shrink-0">Επεξεργασία: {editing.customer_name}</span>
          {(editing.address || editing.city) && (
            <span className="text-xs text-indigo-300 font-mono shrink-0">
              {[editing.address, editing.city, editing.area].filter(Boolean).join(', ')}
            </span>
          )}
          <a href={mapsSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-indigo-200 hover:text-white transition-colors shrink-0"
            title="Αναζήτηση στο Google Maps"
          >
            <MapPin className="w-3 h-3" />
            Google Maps ↗
          </a>
          <span className="text-xs text-indigo-200 shrink-0">Σύρε τον μπλε δείκτη στη σωστή θέση</span>
          {editLat !== null && (
            <div className="flex items-center gap-1 flex-wrap gap-y-1">
              <input
                type="text"
                placeholder="Paste: 37.065, 22.433"
                className="w-44 px-2 py-1 bg-indigo-900 border border-indigo-400 rounded text-xs font-mono text-white focus:outline-none focus:border-white placeholder:text-indigo-400"
                onChange={e => {
                  const parts = e.target.value.trim().split(',').map(s => parseFloat(s.trim()));
                  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    setEditLat(Math.round(parts[0] * 1000000) / 1000000);
                    setEditLng(Math.round(parts[1] * 1000000) / 1000000);
                    dragMarkerRef.current?.setLatLng([parts[0], parts[1]]);
                    leafletMap.current?.setView([parts[0], parts[1]], leafletMap.current.getZoom());
                  }
                }}
              />
              <input
                type="number"
                step="0.000001"
                value={editLat ?? ''}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) {
                    setEditLat(v);
                    dragMarkerRef.current?.setLatLng([v, editLng ?? 0]);
                    leafletMap.current?.setView([v, editLng ?? 0], leafletMap.current.getZoom());
                  }
                }}
                className="w-28 px-2 py-1 bg-indigo-800 border border-indigo-500 rounded text-xs font-mono text-white focus:outline-none focus:border-white"
                placeholder="Lat"
              />
              <input
                type="number"
                step="0.000001"
                value={editLng ?? ''}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) {
                    setEditLng(v);
                    dragMarkerRef.current?.setLatLng([editLat ?? 0, v]);
                    leafletMap.current?.setView([editLat ?? 0, v], leafletMap.current.getZoom());
                  }
                }}
                className="w-28 px-2 py-1 bg-indigo-800 border border-indigo-500 rounded text-xs font-mono text-white focus:outline-none focus:border-white"
                placeholder="Lng"
              />
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={useGPS} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium">
              <Navigation className="w-3.5 h-3.5" />GPS
            </button>
            <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium">
              <RotateCcw className="w-3.5 h-3.5" />Ακύρωση
            </button>
            <button onClick={saveCoords} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-400 disabled:opacity-50 rounded-lg text-xs font-medium">
              {saving ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Αποθήκευση
            </button>
          </div>
        </div>
      )}

      {/* ── Map + sidebar ── */}
      <div className="flex flex-1 min-h-0">

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-slate-800/90 text-white rounded-lg px-3 py-2 text-xs space-y-1 pointer-events-none">
            {customerRevenue.size > 0 ? (<>
              <div className="text-slate-400 font-medium mb-1">Τζίρος περιόδου</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#1E3A8A] inline-block" />Top 10%</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#0284C7] inline-block" />75–90%</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] inline-block" />25–75%</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#BAE6FD] inline-block" />Κάτω 25%</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#94A3B8] inline-block" />Ανενεργός</div>
            </>) : (<>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#1D9E75] inline-block" />Address-level</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#EF9F27] inline-block" />City-level</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#E24B4A] inline-block" />Rep-captured</div>
            </>)}
          </div>

          {/* Saved toast */}
          {savedCode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg">
              <CheckCircle className="w-4 h-4" />
              Αποθηκεύτηκε
            </div>
          )}
        </div>

        {/* Popup panel */}
        {popup && (
          <div className="w-72 bg-slate-800 text-white flex flex-col shrink-0 border-l border-slate-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <span className="font-medium text-sm truncate">{popup.customer_name}</span>
              <button onClick={() => setPopup(null)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-3 space-y-2 flex-1">
              <div className="text-xs text-slate-400">{popup.customer_code}</div>
              {popup.address && <div className="text-xs text-slate-300">{popup.address}</div>}
              <div className="text-xs text-slate-400">{popup.city} · {popup.area}</div>

              <div className="pt-2 border-t border-slate-700">
                {popup.has_coords ? (
                  <div className="space-y-1">
                    <div className="text-xs text-slate-400">
                      {popup.captured_by ? '📍 Rep-captured' : popup.accuracy_meters && popup.accuracy_meters <= 50 ? '🏠 Address-level' : '🏙 City-level'}
                      {popup.accuracy_meters && ` · ${popup.accuracy_meters}m`}
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      {popup.lat?.toFixed(5)}, {popup.lng?.toFixed(5)}
                    </div>
                    {popup.captured_at && (
                      <div className="text-xs text-slate-500">
                        {new Date(popup.captured_at).toLocaleDateString('el-GR')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-amber-400">Δεν υπάρχουν συντεταγμένες</div>
                )}
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-700 space-y-2">
              {/* Edit coords button */}
              {(isPrivileged || String(popup.salesman_code) === String(currentUser.salesman_code)) && (
                <button
                  onClick={() => startEdit(popup)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  {popup.has_coords ? 'Διόρθωση θέσης' : 'Ορισμός θέσης'}
                </button>
              )}

              {/* Open profile */}
              {onSelectCustomer && (
                <button
                  onClick={() => {
                    onSelectCustomer({ code: popup.customer_code, name: popup.customer_name, city: popup.city, area: popup.area, address: popup.address });
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                >
                  Άνοιγμα προφίλ →
                </button>
              )}
            </div>
          </div>
        )}

        {/* No-coords list (when toggle active) */}
        {showNoCoords && !popup && (
          <div className="w-72 bg-slate-800 text-white flex flex-col shrink-0 border-l border-slate-700 overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-700 text-sm font-medium text-amber-400">
              Χωρίς συντεταγμένες ({noCoordCount})
            </div>
            {customers.filter(c => !c.has_coords).map(c => (
              <button
                key={c.customer_code}
                onClick={() => setPopup(c)}
                className="flex flex-col items-start px-4 py-3 border-b border-slate-700/50 hover:bg-white/5 text-left"
              >
                <span className="text-sm font-medium text-white truncate w-full">{c.customer_name}</span>
                <span className="text-xs text-slate-400">{c.city} · {c.area}</span>
                <span className="text-xs text-slate-500 font-mono">{c.customer_code}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
