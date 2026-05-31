import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, X, Plus, Calendar, MapPin,
  CheckCircle, Clock, User, Building2, CalendarDays, Pencil, Filter,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { SuggestionsPanel } from './SuggestionsPanel';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function authedFetch(url: string, options?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

const GREEK_MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος',
  'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος',
  'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];
const GREEK_DAYS_SHORT = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ'];
const TIME_SEGMENTS = ['09-11', '11-13', '13-15', '15-17', '17-19'];

const REP_COLORS = [
  { dot: 'bg-violet-600',  text: 'text-violet-700',  city: 'text-violet-600'  },
  { dot: 'bg-red-500',     text: 'text-red-600',     city: 'text-red-500'     },
  { dot: 'bg-orange-400',  text: 'text-orange-500',  city: 'text-orange-400'  },
  { dot: 'bg-sky-500',     text: 'text-sky-600',     city: 'text-sky-500'     },
  { dot: 'bg-pink-500',    text: 'text-pink-600',    city: 'text-pink-500'    },
  { dot: 'bg-yellow-400',  text: 'text-yellow-600',  city: 'text-yellow-500'  },
  { dot: 'bg-teal-500',    text: 'text-teal-600',    city: 'text-teal-500'    },
  { dot: 'bg-fuchsia-500', text: 'text-fuchsia-600', city: 'text-fuchsia-500' },
];

function hashColor(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % REP_COLORS.length;
}

const REP_COLOR_OVERRIDES: Record<string, { dot: string; text: string; city: string }> = {
  'Tsogiannis': { dot: 'bg-slate-600', text: 'text-slate-700', city: 'text-slate-600' },
};

function getRepColor(ownerName: string) {
  if (REP_COLOR_OVERRIDES[ownerName]) return REP_COLOR_OVERRIDES[ownerName];
  return REP_COLORS[hashColor(ownerName ?? '')];
}

interface CalendarProps {
  currentUser: { id: string; role: string; name: string; salesman_code?: string | null };
  onClose: () => void;
  onSelectCustomer?: (customer: any) => void;
  onOpenCustomerMap?: (customer: any) => void;
  customers?: any[];
  repList?: { id: string; full_name: string; salesman_code: string }[];
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMondayOfWeek(d: Date): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return dateKey(monday);
}

const blankForm = () => ({
  customerCode: '',
  customerSearch: '',
  date: '',
  area: '',
  cities: [] as string[],
  timeSegment: '',
  preciseTime: '',
  notes: '',
  isFixed: false,
});

export function VisitCalendar({ currentUser, onSelectCustomer, onOpenCustomerMap, onClose, customers = [], repList = [] }: CalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [actualVisits, setActualVisits] = useState<any[]>([]);
  const [plannedVisits, setPlannedVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm());
  const [formSaving, setFormSaving] = useState(false);

  const [filterArea, setFilterArea] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterRepId, setFilterRepId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [actual, planned] = await Promise.allSettled([
        authedFetch(`/api/visits?from=${from}&to=${to}`),
        authedFetch(`/api/planning/planned-visits?from=${from}&to=${to}${filterRepId ? `&user_id=${filterRepId}` : ''}`),
      ]);
      setActualVisits(actual.status === 'fulfilled' ? (Array.isArray(actual.value) ? actual.value : []) : []);
      setPlannedVisits(planned.status === 'fulfilled' ? (Array.isArray(planned.value) ? planned.value : []) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to, refreshKey, filterRepId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const days = getMonthDays(year, month);

  const actualByDate = new Map<string, any[]>();
  for (const v of actualVisits) {
    const k = v.visit_date?.slice(0, 10);
    if (!k) continue;
    if (!actualByDate.has(k)) actualByDate.set(k, []);
    actualByDate.get(k)!.push(v);
  }
  const plannedByDate = new Map<string, any[]>();
  for (const v of plannedVisits) {
    const k = v.planned_date?.slice(0, 10);
    if (!k) continue;
    if (!plannedByDate.has(k)) plannedByDate.set(k, []);
    plannedByDate.get(k)!.push(v);
  }

  const todayKey = dateKey(today);
  const selectedKey = selectedDay ? dateKey(selectedDay) : null;

  const filterVisit = (v: any, isActual: boolean) => {
    const cust = customers.find((c: any) => c.code === v.customer_code);
    if (filterArea && cust?.area !== filterArea) return false;
    if (filterCity && cust?.city !== filterCity) return false;
    if (isActual && filterRepId && v.owner_id !== filterRepId) return false;
    return true;
  };

  const selectedActual = (selectedKey ? (actualByDate.get(selectedKey) ?? []) : []).filter(v => filterVisit(v, true));
  const selectedPlanned = (selectedKey ? (plannedByDate.get(selectedKey) ?? []) : []).filter(v => filterVisit(v, false));

  const allAreas = [...new Set(customers.map((c: any) => c.area).filter(Boolean))].sort() as string[];
  const allCities = [...new Set(
    customers.filter((c: any) => !filterArea || c.area === filterArea).map((c: any) => c.city).filter(Boolean)
  )].sort() as string[];

  const filteredCustomers = customers.filter((c: any) =>
    c.is_active !== false &&
    (form.customerSearch === '' ||
      c.name?.toLowerCase().includes(form.customerSearch.toLowerCase()) ||
      c.code?.includes(form.customerSearch))
  ).slice(0, 20);

const repNameForUserId = (userId: string) =>
    repList.find(r => r.id === userId)?.full_name ?? '';

  const citiesForDay = (dk: string): { city: string; ownerName: string }[] => {
    const actual = (actualByDate.get(dk) ?? []).filter(v => filterVisit(v, true));
    const planned = (plannedByDate.get(dk) ?? []).filter(v => filterVisit(v, false));
    const seen = new Map<string, string>();
    for (const v of actual) {
      const cust = customers.find((c: any) => c.code === v.customer_code);
      const label = cust?.city || cust?.area || v.city || v.area;
      if (label && !seen.has(label)) seen.set(label, v.owner_name ?? '');
    }
    for (const v of planned) {
      const cust = customers.find((c: any) => c.code === v.customer_code);
      const label = cust?.city || v.city || cust?.area || v.area;
      const ownerName = repNameForUserId(v.user_id ?? '');
      if (label && !seen.has(label)) seen.set(label, ownerName);
    }
    return [...seen.entries()].slice(0, 3).map(([city, ownerName]) => ({ city, ownerName }));
  };

  const openAdd = (d: Date) => {
    setSelectedDay(d);
    setFormMode('add');
    setEditingId(null);
    setForm({ ...blankForm(), date: dateKey(d) });
  };

  const openEdit = (v: any) => {
    setFormMode('edit');
    setEditingId(v.id);
    setForm({
      customerCode: v.customer_code ?? '',
      customerSearch: '',
      date: v.planned_date ?? '',
      area: v.area ?? '',
      cities: v.city ? [v.city] : [],
      timeSegment: v.time_segment ?? '',
      preciseTime: v.planned_time?.slice(0, 5) ?? '',
      notes: v.notes ?? '',
      isFixed: v.is_fixed_appointment ?? false,
    });
  };

  const handleSave = async () => {
    if (!form.date) return;
    setFormSaving(true);
    try {
      // Create one record per selected city (or one without city if none selected)
      const citiesToSave: (string | null)[] = form.cities.length > 0 ? form.cities : [null];
      for (let i = 0; i < citiesToSave.length; i++) {
        const body = {
          planned_date: form.date,
          week_start: getMondayOfWeek(new Date(form.date)),
          customer_code: form.customerCode || null,
          area: form.area || null,
          city: citiesToSave[i],
          time_segment: form.timeSegment || null,
          planned_time: form.preciseTime || null,
          notes: form.notes || null,
          is_fixed_appointment: form.isFixed,
        };
        if (formMode === 'edit' && editingId && i === 0) {
          await authedFetch(`/api/planning/planned-visits/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) });
        } else {
          await authedFetch('/api/planning/planned-visits', { method: 'POST', body: JSON.stringify(body) });
        }
      }
      setFormMode(null);
      setEditingId(null);
      setForm(blankForm());
      setRefreshKey(k => k + 1);
    } catch {
      alert('Αποτυχία αποθήκευσης');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeletePlanned = async (id: string) => {
    if (!confirm('Διαγραφή προγραμματισμένης επίσκεψης;')) return;
    try {
      await authedFetch(`/api/planning/planned-visits/${id}`, { method: 'DELETE' });
      setRefreshKey(k => k + 1);
    } catch {
      alert('Αποτυχία διαγραφής');
    }
  };

  const hasActiveFilters = !!(filterArea || filterCity || filterRepId);

  // Filter customers to selected rep when filterRepId is active
  const selectedRep = filterRepId ? repList.find(r => r.id === filterRepId) : null;
  const repFilteredCustomers = selectedRep
    ? customers.filter((c: any) => String(c.salesman_code) === String(selectedRep.salesman_code))
    : customers;

  // Cities available for the selected area in the form
  const formCities = form.area
    ? [...new Set(repFilteredCustomers.filter((c: any) => c.area === form.area && c.city).map((c: any) => c.city as string))].sort()
    : [];

    
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-4 px-2">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5" />
            <h2 className="text-lg font-bold">Ημερολόγιο Επισκέψεων</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-white text-indigo-700' : 'bg-white/20 hover:bg-white/30'}`}>
              <Filter className="w-4 h-4" />
              {hasActiveFilters && <span className="w-2 h-2 bg-amber-400 rounded-full" />}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
            <button onClick={() => setShowSuggestions(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showSuggestions ? 'bg-white text-indigo-700' : 'bg-white/20 hover:bg-white/30'}`}>
              <Calendar className="w-4 h-4" /> Προτάσεις
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Περιοχή</label>
                <select value={filterArea} onChange={e => { setFilterArea(e.target.value); setFilterCity(''); }}
                  className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">— Περιοχή —</option>
                  {[...new Set(repFilteredCustomers.map((c: any) => c.area).filter(Boolean))].sort().map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Πόλη</label>
                <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
                  className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Όλες</option>
                  {allCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {repList.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Εκπρόσωπος</label>
                <select value={filterRepId} onChange={e => setFilterRepId(e.target.value)}
                  className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Όλοι</option>
                  {currentUser.salesman_code && (
                    <option value={currentUser.id}>Εγώ ({currentUser.name})</option>
                  )}
                  {repList.filter(r => r.id !== currentUser.id && r.salesman_code).map(r => (
                    <option key={r.id} value={r.id}>{r.full_name}</option>
                  ))}
                </select>
              </div>
            )}
              
                {hasActiveFilters && (
              <button onClick={() => { setFilterArea(''); setFilterCity(''); setFilterRepId(''); }}
                  className="px-3 py-1.5 text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 self-end">
                  × Καθαρισμός
                </button>
              )}
            </div>
            {repList.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-slate-200">
              {repList.map(r => (
                <span key={r.id} className="flex items-center gap-1 text-xs text-slate-600">
                  <span className={`w-2.5 h-2.5 rounded-full inline-block ${getRepColor(r.full_name).dot}`} />
                  {r.full_name}
                </span>
              ))}
            </div>
          )}
          </div>
        )}

        {/* Month nav */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="text-center">
            <div className="text-lg font-bold text-slate-800">{GREEK_MONTHS[month]} {year}</div>
            {loading && <div className="text-xs text-slate-400">Φόρτωση...</div>}
          </div>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-500 flex-wrap">
          {repList.length > 0 ? (
            <>
              {repList.map(rep => (
                <span key={rep.id} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-full inline-block ${getRepColor(rep.full_name).dot}`} />{rep.full_name}
                </span>
              ))}
              <span className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200">
                <span className="w-3 h-3 rounded-full inline-block bg-green-500" />Ραντεβού
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />Επίσκεψη</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" />Προγραμ.</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Ραντεβού</span>
            </>
          )}
        </div>

        {/* Calendar grid */}
        <div className="px-4 py-3">
          <div className="grid grid-cols-7 mb-1">
            {GREEK_DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} />;
              const dk = dateKey(d);
              const actual = (actualByDate.get(dk) ?? []).filter(v => filterVisit(v, true));
              const planned = (plannedByDate.get(dk) ?? []).filter(v => filterVisit(v, false));
              const isToday = dk === todayKey;
              const isSelected = dk === selectedKey;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const total = actual.length + planned.length;
              const cities = citiesForDay(dk);

              return (
                <button key={dk} onClick={() => setSelectedDay(isSelected ? null : d)}
                  className={`relative min-h-[64px] p-1.5 rounded-lg text-left transition-all border ${isSelected ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'} ${isWeekend ? 'bg-slate-50/50' : ''}`}>
                  <div className={`text-xs font-semibold mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>
                    {d.getDate()}
                  </div>
                  <div className="flex flex-wrap gap-0.5 mb-0.5">
                    {actual.slice(0, 3).map((v, j) => (
                      <span key={j} className={`w-2 h-2 rounded-full ${getRepColor(v.owner_name ?? '').dot}`} />
                    ))}
                    {planned.slice(0, 2).map((v, j) => (
                      <span key={`p${j}`} className={`w-2 h-2 rounded-full ${v.is_fixed_appointment ? 'bg-green-500' : getRepColor(v.owner_name ?? '').dot}`} />
                    ))}
                    {total > 5 && <span className="text-xs text-slate-400 leading-none">+{total - 5}</span>}
                  </div>
                  {cities.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      {cities.map(({ city, ownerName }) => (
                        <span key={city} className={`${getRepColor(ownerName).city} truncate leading-tight`} style={{ fontSize: '9px' }}>{city}</span>
                      ))}
                    </div>
                  )}
                  {isSelected && (
                    <button onClick={e => { e.stopPropagation(); openAdd(d); }}
                      className="absolute top-1 right-1 w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700">
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        {selectedDay && !formMode && (
          <div className="border-t border-slate-100 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800">
                {selectedDay.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button onClick={() => openAdd(selectedDay)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
                <Plus className="w-3.5 h-3.5" /> Προγραμ. Επίσκεψη
              </button>
            </div>

            {selectedActual.length === 0 && selectedPlanned.length === 0 && (
              <div className="text-sm text-slate-400 italic">Καμία επίσκεψη αυτή την ημέρα{hasActiveFilters ? ' (με τα τρέχοντα φίλτρα)' : ''}</div>
            )}

            {selectedActual.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Πραγματικές Επισκέψεις</div>
                <div className="space-y-2">
                  {selectedActual.map(v => {
                    const cust = customers.find((c: any) => c.code === v.customer_code);
                    const rc = getRepColor(v.owner_name ?? '');
                    return (
                      <div key={v.id} onClick={() => { if (cust && onSelectCustomer) onSelectCustomer(cust); }}
                        className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100 cursor-pointer hover:bg-purple-100 transition-colors">
                        <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${rc.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-700">{cust?.name ?? v.customer_code}</span>
                            <span className="text-xs font-mono text-slate-400">{v.customer_code}</span>
                            {v.visit_type && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">{v.visit_type}</span>}
                            {v.owner_name && <span className={`text-xs font-medium ${rc.text}`}>{v.owner_name}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {cust?.area && <span className="flex items-center gap-0.5 text-xs text-slate-400"><MapPin className="w-3 h-3" />{cust.area}{cust.city ? ` › ${cust.city}` : ''}</span>}
                            {cust?.address && <span className="text-xs text-slate-400 truncate max-w-xs">{cust.address}</span>}
                          </div>
                          {v.notes && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{v.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedPlanned.length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Προγραμματισμένες</div>
                <div className="space-y-2">
                  {selectedPlanned.map(v => {
                    const cust = customers.find((c: any) => c.code === v.customer_code);
                    return (
                      <div key={v.id} className={`flex items-start gap-3 p-3 rounded-lg border ${v.is_fixed_appointment ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-100'}`}>
                        <Clock className={`w-4 h-4 mt-0.5 shrink-0 ${v.is_fixed_appointment ? 'text-green-500' : 'text-blue-400'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {v.customer_code ? (
                              <>
                                <span className="text-sm font-medium text-slate-700">{cust?.name ?? v.customer_code}</span>
                                <span className="text-xs font-mono text-slate-400">{v.customer_code}</span>
                              </>
                            ) : (
                              <span className="text-sm text-slate-500 italic">Χωρίς συγκεκριμένο πελάτη</span>
                            )}
                            {v.is_fixed_appointment && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">Ραντεβού</span>}
                            {v.time_segment && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{v.time_segment}</span>}
                            {v.planned_time && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{v.planned_time.slice(0, 5)}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {(cust?.area || v.area) && (
                              <span className="flex items-center gap-0.5 text-xs text-slate-400">
                                <MapPin className="w-3 h-3" />{cust?.area ?? v.area}{(cust?.city || v.city) ? ` › ${cust?.city ?? v.city}` : ''}
                              </span>
                            )}
                            {cust?.address && <span className="text-xs text-slate-400 truncate max-w-xs">{cust.address}</span>}
                          </div>
                          {v.notes && <p className="text-xs text-slate-500 mt-0.5">{v.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEdit(v)} className="p-1 hover:bg-blue-100 rounded text-slate-400 hover:text-blue-600 transition-colors" title="Επεξεργασία">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeletePlanned(v.id)} className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 transition-colors" title="Διαγραφή">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add / Edit form */}
        {formMode && (
          <div className="border-t border-slate-100 px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">
                {formMode === 'edit' ? 'Επεξεργασία Προγραμματισμένης' : 'Προγραμματισμός Επίσκεψης'}
              </h3>
              <button onClick={() => { setFormMode(null); setEditingId(null); setForm(blankForm()); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ημερομηνία</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>

              {/* Customer */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Πελάτης (προαιρετικό)</label>
                {form.customerCode ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <Building2 className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm text-indigo-700 flex-1">{customers.find((c: any) => c.code === form.customerCode)?.name ?? form.customerCode}</span>
                    <button onClick={() => setForm(f => ({ ...f, customerCode: '', customerSearch: '' }))} className="text-slate-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input type="text" value={form.customerSearch}
                      onChange={e => setForm(f => ({ ...f, customerSearch: e.target.value }))}
                      placeholder="Αναζήτηση πελάτη..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                    {form.customerSearch && filteredCustomers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredCustomers.map((c: any) => (
                          <button key={c.code}
                            onClick={() => setForm(f => ({
                              ...f, customerCode: c.code, customerSearch: '',
                              area: c.area || f.area,
                              cities: c.city ? (f.cities.includes(c.city) ? f.cities : [...f.cities, c.city]) : f.cities,
                            }))}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm text-slate-700 truncate">{c.name}</div>
                              <div className="text-xs text-slate-400">{c.city} · {c.code}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Area + Cities (checkboxes) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Περιοχή / Πόλεις</label>
                <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value, cities: [] }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 mb-2">
                  <option value="">— Περιοχή —</option>
                  {allAreas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                {form.area && formCities.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formCities.map(city => (
                      <label key={city} className={`flex items-center gap-1.5 text-sm cursor-pointer px-2 py-1 border rounded-lg transition-colors ${form.cities.includes(city) ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}>
                        <input type="checkbox" checked={form.cities.includes(city)}
                          onChange={e => setForm(f => ({
                            ...f,
                            cities: e.target.checked ? [...f.cities, city] : f.cities.filter(c => c !== city),
                          }))}
                          className="w-3.5 h-3.5 text-indigo-600 rounded" />
                        <span className={form.cities.includes(city) ? 'text-indigo-700 font-medium' : 'text-slate-600'}>{city}</span>
                      </label>
                    ))}
                  </div>
                )}
                {form.cities.length > 0 && (
                  <div className="mt-1 text-xs text-indigo-600">{form.cities.length} πόλη/πόλεις επιλεγμένη/ες → {form.cities.length} εγγραφή/ες</div>
                )}
              </div>

              {/* Time segment */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Χρονικό Τμήμα</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setForm(f => ({ ...f, timeSegment: '' }))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${form.timeSegment === '' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}>
                    Οποιαδήποτε ώρα
                  </button>
                  {TIME_SEGMENTS.map(seg => (
                    <button key={seg} onClick={() => setForm(f => ({ ...f, timeSegment: seg }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${form.timeSegment === seg ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}>
                      {seg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Precise time */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ακριβής Ώρα (προαιρετικό)</label>
                <input type="time" value={form.preciseTime} onChange={e => setForm(f => ({ ...f, preciseTime: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>

              {/* Fixed appointment */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="fixed-appt" checked={form.isFixed}
                  onChange={e => setForm(f => ({ ...f, isFixed: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 rounded" />
                <label htmlFor="fixed-appt" className="text-sm text-slate-600">
                  Σταθερό ραντεβού <span className="text-xs text-slate-400">(constraint για τον προγραμματισμό)</span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Σημειώσεις</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="π.χ. Να συζητηθούν νέες κατηγορίες..." />
              </div>

              <div className="flex gap-2">
                <button onClick={handleSave} disabled={!form.date || formSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                  {formSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}
                </button>
                <button onClick={() => { setFormMode(null); setEditingId(null); setForm(blankForm()); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">
                  Ακύρωση
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`border-t border-slate-100 px-6 py-3 bg-slate-50 flex items-center gap-6 text-sm text-slate-500 ${showSuggestions ? '' : 'rounded-b-2xl'}`}>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-purple-500" />
            <span className="font-medium text-slate-700">{actualVisits.length}</span> επισκέψεις
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="font-medium text-slate-700">{plannedVisits.length}</span> προγραμματισμένες
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="font-medium text-slate-700">{plannedVisits.filter(v => v.is_fixed_appointment).length}</span> ραντεβού
          </span>
        </div>

        {showSuggestions && (
          <SuggestionsPanel
            currentUser={currentUser}
            onClose={() => setShowSuggestions(false)}
            customers={customers}
            areas={[...new Set(customers.map((c: any) => c.area).filter(Boolean))].sort()}
            onSelectCustomer={onSelectCustomer}
            onOpenCustomerMap={onOpenCustomerMap}
          />
        )}
      </div>
    </div>
  );
}
