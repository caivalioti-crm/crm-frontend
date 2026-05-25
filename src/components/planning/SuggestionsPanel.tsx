import { useState, useEffect, useCallback } from 'react';
import {
  X, ChevronLeft, ChevronRight, MapPin, TrendingUp, TrendingDown,
  Star, Trash2, Plus, ExternalLink, RotateCcw, Check, AlertTriangle,
  Calendar, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

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

const GREEK_DAYS = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];
const GREEK_DAYS_SHORT = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ'];
const GREEK_MONTHS_SHORT = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];

const TIER_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Ανενεργός', color: 'text-slate-500', bg: 'bg-slate-100' },
  1: { label: 'Σπάνιος', color: 'text-orange-600', bg: 'bg-orange-100' },
  2: { label: 'Περιστασιακός', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  3: { label: 'Τακτικός', color: 'text-blue-600', bg: 'bg-blue-100' },
  4: { label: 'Εβδομαδιαίος', color: 'text-green-700', bg: 'bg-green-100' },
};

function fmtMonthYear(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${GREEK_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWeekLabel(monday: Date): string {
  const friday = addDays(monday, 4);
  const mDay = monday.getDate();
  const mMonth = GREEK_MONTHS_SHORT[monday.getMonth()];
  const fDay = friday.getDate();
  const fMonth = GREEK_MONTHS_SHORT[friday.getMonth()];
  const year = friday.getFullYear();
  if (monday.getMonth() === friday.getMonth()) {
    return `${mDay}–${fDay} ${fMonth} ${year}`;
  }
  return `${mDay} ${mMonth} – ${fDay} ${fMonth} ${year}`;
}

interface DaySlot {
  date: string;
  dayName: string;
  area: string;
  city: string;
}

interface CustomerSelection {
  code: string;
  name: string;
  city: string;
  area: string;
  address: string | null;
  tier: number;
  last_visit_date: string | null;
  last_invoice_date: string | null;
  days_since_visit: number;
  days_since_purchase: number;
  urgency_score: number;
  total_invoices_6m: number;
  constraint: any | null;
  // selection state
  included: boolean;
  sos: boolean;
  // assigned day
  assignedDate?: string;
  // performance
  ytd_revenue?: number;
  prev_ytd_revenue?: number;
  ytd_growth_pct?: number | null;
  declining_months?: number;
  // suggested time
  suggested_time?: string;
  duration_minutes?: number;
  travel_buffer?: number;
  lat?: number | null;
  lng?: number | null;
}

interface SuggestionsPanelProps {
  currentUser: { id: string; role: string; name: string; salesman_code?: string | null };
  onClose: () => void;
  customers?: any[];
  areas?: string[];
}

type Step = 'week' | 'slots' | 'select' | 'plan';

export function SuggestionsPanel({ currentUser, onClose, customers = [], areas = [] }: SuggestionsPanelProps) {
  const isPrivileged = ['admin', 'manager', 'exec'].includes(currentUser.role);

  const [step, setStep] = useState<Step>('week');

  // Week selection
  const [selectedMonday, setSelectedMonday] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);

  // Day slots
  const [daySlots, setDaySlots] = useState<DaySlot[]>([]);

  // Filters
  
  const [filterNotVisitedDays, setFilterNotVisitedDays] = useState<number | null>(null);
  const [filterPerformance, setFilterPerformance] = useState<'all' | 'up' | 'down'>('all');
  const [filterTiers, setFilterTiers] = useState<number[]>([]);

  // Rep selector (managers)
  const [targetUserId, setTargetUserId] = useState<string>(currentUser.id);
  const [repProfiles, setRepProfiles] = useState<any[]>([]);

  // Customer selection
  const [customerPool, setCustomerPool] = useState<CustomerSelection[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [selectedDayForPool, setSelectedDayForPool] = useState<string | null>(null);

  // Plan
  const [plan, setPlan] = useState<Record<string, CustomerSelection[]>>({});
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unscheduled, setUnscheduled] = useState<any[]>([]);
const [showUnscheduled, setShowUnscheduled] = useState(false);

  // Load rep profiles for manager
useEffect(() => {
  if (!isPrivileged) return;
  supabase.from('crm_user_profiles').select('id, full_name, role, salesman_code')
    .then(({ data }) => {
      setRepProfiles((data ?? []).filter((p: any) => p.role === 'rep' || p.role === 'manager'));
    })
    .then(undefined, (err) => console.error(err));
}, [isPrivileged]);

  // Build initial day slots when monday changes
  useEffect(() => {
    const slots: DaySlot[] = [];
    for (let i = 0; i < 5; i++) {
      const d = addDays(selectedMonday, i);
      slots.push({
        date: dateKey(d),
        dayName: GREEK_DAYS[i],
        area: '',
        city: '',
      });
    }
    setDaySlots(slots);
    setPlan({});
    setCustomerPool([]);
    setSaved(false);
  }, [selectedMonday]);

  const citiesForArea = (area: string) => {
    return [...new Set(customers.filter(c => c.area === area && c.city).map(c => c.city))].sort();
  };

  const updateSlot = (idx: number, field: keyof DaySlot, value: string) => {
    setDaySlots(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      if (field === 'area') return { ...s, area: value, city: '' };
      return { ...s, [field]: value };
    }));
  };

  const addExtraDay = () => {
    const lastSlot = daySlots[daySlots.length - 1];
    const lastDate = new Date(lastSlot.date);
    const nextDate = addDays(lastDate, 1);
    const nextDayIdx = nextDate.getDay() === 0 ? 6 : nextDate.getDay() - 1;
    setDaySlots(prev => [...prev, {
      date: dateKey(nextDate),
      dayName: GREEK_DAYS[nextDayIdx],
      area: '',
      city: '',
    }]);
  };

  const removeSlot = (idx: number) => {
    setDaySlots(prev => prev.filter((_, i) => i !== idx));
  };

  const validSlots = daySlots.filter(s => s.area && s.area !== 'SKIP');

  // Load customer pool for a specific day slot
  const loadPoolForSlot = useCallback(async (slot: DaySlot) => {
    setPoolLoading(true);
    setSelectedDayForPool(slot.date);
    try {
      const body = {
        week_start: dateKey(selectedMonday),
        target_user_id: targetUserId !== currentUser.id ? targetUserId : undefined,
        day_slots: [{ date: slot.date, area: slot.area, city: slot.city || undefined }],
        filters: {
          performance: filterPerformance,
          not_visited_since: filterNotVisitedDays,
          tiers: filterTiers.length > 0 ? filterTiers : null,
        },
        max_per_day: 50, // get all, rep will filter
      };

      const result = await authedFetch('/api/planning/suggest', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const dayResult = result.days?.[0];
      if (!dayResult) { setCustomerPool([]); return; }

        const suggested: CustomerSelection[] = dayResult.suggested.map((s: any) => ({
        ...s,
        name: s.customer_name ?? s.name ?? s.code,
        code: s.customer_code ?? s.code,
        included: true,
        sos: false,
        duration_minutes: 30,
        }));

      setCustomerPool(suggested);
    } catch (err) {
      console.error(err);
      setCustomerPool([]);
    } finally {
      setPoolLoading(false);
    }
  }, [selectedMonday, targetUserId, currentUser.id, filterPerformance, filterNotVisitedDays, filterTiers]);

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const body = {
        week_start: dateKey(selectedMonday),
        target_user_id: targetUserId !== currentUser.id ? targetUserId : undefined,
        day_slots: validSlots.map(s => ({ date: s.date, area: s.area, city: s.city || undefined })),
        filters: {
          performance: filterPerformance,
          not_visited_since: filterNotVisitedDays,
          tiers: filterTiers.length > 0 ? filterTiers : null,
        },
        max_per_day: 12,
      };

      const result = await authedFetch('/api/planning/suggest', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const newPlan: Record<string, CustomerSelection[]> = {};
        for (const day of result.days ?? []) {
            newPlan[day.date] = day.suggested.map((s: any, i: number, arr: any[]) => ({
            ...s,
            name: s.customer_name ?? s.name ?? s.code,
            code: s.customer_code ?? s.code,
            included: true,
            sos: false,
            duration_minutes: 30,
            travel_buffer: i === 0 ? 0 : (arr[i-1].city === s.city ? 10 : 20),
        }));
        }

      // Apply SOS overrides from pool
      for (const slot of validSlots) {
        const sosCusts = customerPool.filter(c => c.sos && c.assignedDate === slot.date);
        if (sosCusts.length > 0 && newPlan[slot.date]) {
          const existingCodes = new Set(newPlan[slot.date].map(c => c.code));
          for (const sos of sosCusts) {
            if (!existingCodes.has(sos.code)) {
              newPlan[slot.date].unshift({ ...sos, suggested_time: '09:00', duration_minutes: 30 });
            }
          }
        }
      }

      setPlan(newPlan);
      setUnscheduled(result.unscheduled ?? []);
      setStep('plan');
    } catch (err) {
      alert('Αποτυχία δημιουργίας πλάνου');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      const inserts: any[] = [];
      for (const [date, custs] of Object.entries(plan)) {
        const slot = daySlots.find(s => s.date === date);
        for (const c of custs) {
          inserts.push({
            planned_date: date,
            week_start: dateKey(selectedMonday),
            customer_code: c.code,
            area: slot?.area || null,
            city: slot?.city || null,
            planned_time: c.suggested_time || null,
            time_segment: null,
            is_fixed_appointment: false,
            notes: c.sos ? 'SOS' : null,
            status: 'planned',
          });
        }
      }

      for (const insert of inserts) {
        await authedFetch('/api/planning/planned-visits', {
          method: 'POST',
          body: JSON.stringify(insert),
        });
      }

      setSaved(true);
    } catch (err) {
      alert('Αποτυχία αποθήκευσης');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const buildGoogleMapsUrl = (date: string) => {
  const custs = plan[date] ?? [];
  if (custs.length === 0) return null;

  // Use coordinates if available, fall back to address
  const hasCoords = custs.some((c: any) => c.lat && c.lng);

  if (hasCoords) {
    const points = custs.map((c: any) => {
      if (c.lat && c.lng) return `${c.lat},${c.lng}`;
      return encodeURIComponent([c.address, c.city, 'Greece'].filter(Boolean).join(', '));
    });
    // Google Maps dir with lat/lng waypoints
    return `https://www.google.com/maps/dir/${points.join('/')}`;
  }

  // Fallback to addresses
  const addresses = custs.map((c: any) =>
    [c.address, c.city, 'Greece'].filter(Boolean).join(', ')
  ).filter(Boolean);
  if (!addresses.length) return null;
  return `https://www.google.com/maps/dir/${addresses.map(a => encodeURIComponent(a)).join('/')}`;
};

  const movePlanItem = (date: string, idx: number, dir: 'up' | 'down') => {
    setPlan(prev => {
      const list = [...(prev[date] ?? [])];
      const newIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= list.length) return prev;
      [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
      // Recalculate times
      let minutes = 9 * 60;
        const recalculated = list.map((c, i) => {
          if (i > 0) minutes += c.travel_buffer ?? 10;
          const h = Math.floor(minutes / 60);
          const m = minutes % 60;
          const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          minutes += c.duration_minutes ?? 30;
          return { ...c, suggested_time: time };
        });
      return { ...prev, [date]: recalculated };
    });
  };

  const removePlanItem = (date: string, code: string) => {
    setPlan(prev => {
      const list = (prev[date] ?? []).filter(c => c.code !== code);
      let minutes = 9 * 60;
      const recalculated = list.map((c, i) => {
        if (i > 0) minutes += c.travel_buffer ?? 10;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        minutes += c.duration_minutes ?? 30;
        return { ...c, suggested_time: time };
      });
      return { ...prev, [date]: recalculated };
    });
  };

  const updateDuration = (date: string, code: string, duration: number) => {
  setPlan(prev => {
    const list = (prev[date] ?? []).map(c => c.code === code ? { ...c, duration_minutes: duration } : c);
    let minutes = 9 * 60;
    const recalculated = list.map((c, i) => {
      if (i > 0) minutes += c.travel_buffer ?? 10;
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      minutes += c.duration_minutes ?? 30;
      return { ...c, suggested_time: time };
    });
    return { ...prev, [date]: recalculated };
  });
};

  const totalPlanned = Object.values(plan).reduce((s, custs) => s + custs.length, 0);

  return (
    <div className="border-t border-slate-200 bg-slate-50">
      {/* Panel header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800">Έξυπνος Προγραμματισμός</h3>
          <div className="flex items-center gap-1">
            {(['week', 'slots', 'select', 'plan'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === s ? 'bg-indigo-600 text-white' : i < (['week', 'slots', 'select', 'plan'] as Step[]).indexOf(step) ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {i + 1}
                </div>
                {i < 3 && <div className="w-4 h-px bg-slate-300" />}
              </div>
            ))}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="px-6 py-4">

        {/* ── STEP 1: WEEK SELECTION ── */}
        {step === 'week' && (
          <div>
            <h4 className="font-medium text-slate-700 mb-4">Επιλογή Εβδομάδας</h4>

            {isPrivileged && repProfiles.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-500 mb-1">Εκπρόσωπος</label>
                <select value={targetUserId} onChange={e => setTargetUserId(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value={currentUser.id}>Εγώ ({currentUser.name})</option>
                  {repProfiles.filter(p => p.id !== currentUser.id).map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Week navigator */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setCalendarWeekOffset(o => o - 1)}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="text-center">
                <div className="text-sm font-medium text-slate-500 mb-1">Τρέχουσα επιλογή</div>
                <div className="text-lg font-bold text-indigo-700">
                  {formatWeekLabel(selectedMonday)}
                </div>
              </div>
              <button onClick={() => setCalendarWeekOffset(o => o + 1)}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Mini week grid */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {GREEK_DAYS_SHORT.map(d => (
                <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
              ))}
              {Array.from({ length: 5 }, (_, i) => {
                const baseMonday = getMondayOfWeek(new Date());
                const weekStart = addDays(baseMonday, calendarWeekOffset * 7);
                const d = addDays(weekStart, i);
                const isSelected = dateKey(d) >= dateKey(selectedMonday) && dateKey(d) <= dateKey(addDays(selectedMonday, 4));
                
                return (
                  <button key={i}
                    onClick={() => {
                      const monday = getMondayOfWeek(d);
                      setSelectedMonday(monday);
                    }}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50 text-slate-700'}`}>
                    {d.getDate()}
                  </button>
                );
              })}
              {/* Sat/Sun grayed */}
              {[5, 6].map(i => {
                const baseMonday = getMondayOfWeek(new Date());
                const weekStart = addDays(baseMonday, calendarWeekOffset * 7);
                const d = addDays(weekStart, i);
                return (
                  <div key={i} className="py-2 text-center text-sm text-slate-300">{d.getDate()}</div>
                );
              })}
            </div>

            {/* Quick week selector */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[-1, 0, 1, 2].map(offset => {
                const monday = addDays(getMondayOfWeek(new Date()), offset * 7);
                const label = offset === 0 ? 'Αυτή η εβδομάδα' : offset === 1 ? 'Επόμενη εβδομάδα' : offset === -1 ? 'Προηγούμενη' : formatWeekLabel(monday);
                const isSelected = dateKey(monday) === dateKey(selectedMonday);
                return (
                  <button key={offset}
                    onClick={() => setSelectedMonday(monday)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}>
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-700 mb-4">
              <Calendar className="w-4 h-4 shrink-0" />
              <span>Επιλεγμένη εβδομάδα: <strong>{formatWeekLabel(selectedMonday)}</strong></span>
            </div>

            <button onClick={() => setStep('slots')}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
              Συνέχεια →
            </button>
          </div>
        )}

        {/* ── STEP 2: DAY SLOTS ── */}
        {step === 'slots' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-slate-700">Ανάθεση Περιοχών ανά Ημέρα</h4>
              <button onClick={() => setStep('week')} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                <ChevronLeft className="w-3.5 h-3.5" /> Πίσω
              </button>
            </div>

            <div className="text-xs text-indigo-600 font-medium mb-3">{formatWeekLabel(selectedMonday)}</div>

            <div className="space-y-2 mb-4">
              {daySlots.map((slot, idx) => (
                <div key={slot.date} className={`flex items-center gap-2 p-3 rounded-lg border ${slot.area === 'SKIP' ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-white border-slate-200'}`}>
                <div className="w-12 shrink-0">
                    <div className="text-xs font-bold text-slate-600">{slot.dayName.slice(0, 3)}</div>
                    <div className="text-xs text-slate-400">{new Date(slot.date).getDate()}/{new Date(slot.date).getMonth() + 1}</div>
                </div>
                <select value={slot.area} onChange={e => updateSlot(idx, 'area', e.target.value)}
                    className={`flex-1 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 ${slot.area === 'SKIP' ? 'text-slate-400 italic' : ''}`}>
                    <option value="">— Περιοχή —</option>
                    <option value="SKIP">🚫 Δεν εργάζομαι αυτή την ημέρα</option>
                    {areas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                  {slot.area && (
                    <select value={slot.city} onChange={e => updateSlot(idx, 'city', e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                      <option value="">Όλες οι πόλεις</option>
                      {citiesForArea(slot.area).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  {idx >= 5 && (
                    <button onClick={() => removeSlot(idx)} className="p-1 text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={addExtraDay}
              className="w-full py-2 border border-dashed border-slate-300 text-slate-500 text-sm rounded-lg hover:border-indigo-400 hover:text-indigo-600 transition-colors mb-4 flex items-center justify-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Προσθήκη ημέρας (Σαβ/Κυρ)
            </button>

            <button
              onClick={() => { setStep('select'); setSelectedDayForPool(validSlots[0]?.date ?? null); if (validSlots[0]) loadPoolForSlot(validSlots[0]); }}
              disabled={validSlots.length === 0}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
              Επιλογή Πελατών →
            </button>
          </div>
        )}

        {/* ── STEP 3: CUSTOMER SELECTION ── */}
        {step === 'select' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-slate-700">Επιλογή Πελατών</h4>
              
              <button onClick={() => setStep('slots')} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                <ChevronLeft className="w-3.5 h-3.5" /> Πίσω
              </button>
            </div>

            {/* Day tabs */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {validSlots.map(slot => (
                <button key={slot.date}
                  onClick={() => { setSelectedDayForPool(slot.date); loadPoolForSlot(slot); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${selectedDayForPool === slot.date ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:border-indigo-400'}`}>
                  {GREEK_DAYS_SHORT[new Date(slot.date).getDay() === 0 ? 6 : new Date(slot.date).getDay() - 1]} · {slot.area}{slot.city ? ` › ${slot.city}` : ''}
                </button>
              ))}
            </div>

            {/* Inline filters for selection step */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-3">
            <div className="flex flex-wrap gap-3 items-end">
                <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Δεν επισκέφθηκε από</label>
                <div className="flex flex-wrap gap-1">
                    {[null, 30, 60, 180, 365].map(days => (
                    <button key={days ?? 'all'} onClick={() => { setFilterNotVisitedDays(days); if (selectedDayForPool) { const slot = validSlots.find(s => s.date === selectedDayForPool); if (slot) loadPoolForSlot(slot); }}}
                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${filterNotVisitedDays === days ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}>
                        {days === null ? 'Όλοι' : days === 30 ? '1μ' : days === 60 ? '2μ' : days === 180 ? '6μ' : '1χ'}
                    </button>
                    ))}
                </div>
                </div>
                <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Απόδοση</label>
                <div className="flex gap-1">
                    {[['all', 'Όλοι'], ['up', '↑'], ['down', '↓']].map(([v, l]) => (
                    <button key={v} onClick={() => { setFilterPerformance(v as any); if (selectedDayForPool) { const slot = validSlots.find(s => s.date === selectedDayForPool); if (slot) loadPoolForSlot(slot); }}}
                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${filterPerformance === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}>
                        {l}
                    </button>
                    ))}
                </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tier</label>
                  <div className="flex gap-1">
                    <button onClick={() => {
                      setFilterTiers([]);
                      if (selectedDayForPool) { const slot = validSlots.find(s => s.date === selectedDayForPool); if (slot) loadPoolForSlot(slot); }
                    }}
                      className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${filterTiers.length === 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}>
                      Όλοι
                    </button>
                    {[0, 1, 2, 3, 4].map(t => {
                      const selected = filterTiers.includes(t);
                      const newTiers = selected ? filterTiers.filter(x => x !== t) : [...filterTiers, t];
                      return (
                        <button key={t} onClick={() => {
                          setFilterTiers(newTiers);
                          if (selectedDayForPool) {
                            const slot = validSlots.find(s => s.date === selectedDayForPool);
                            if (slot) {
                              setPoolLoading(true);
                              setSelectedDayForPool(slot.date);
                              authedFetch('/api/planning/suggest', {
                                method: 'POST',
                                body: JSON.stringify({
                                  week_start: dateKey(selectedMonday),
                                  target_user_id: targetUserId !== currentUser.id ? targetUserId : undefined,
                                  day_slots: [{ date: slot.date, area: slot.area, city: slot.city || undefined }],
                                  filters: { performance: filterPerformance, not_visited_since: filterNotVisitedDays, tiers: newTiers.length > 0 ? newTiers : null },
                                  max_per_day: 50,
                                }),
                              }).then(result => {
                                const dayResult = result.days?.[0];
                                setCustomerPool(!dayResult ? [] : dayResult.suggested.map((s: any) => ({
                                  ...s, name: s.customer_name ?? s.name ?? s.code, code: s.customer_code ?? s.code,
                                  included: true, sos: false, duration_minutes: 30,
                                })));
                              }).catch(console.error).finally(() => setPoolLoading(false));
                            }
                          }
                        }}
                          className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${selected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}>
                          T{t}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {[
                      { t: 0, label: 'Ανενεργός', sub: '0 τιμολ.' },
                      { t: 1, label: 'Σπάνιος', sub: '<1/μήνα' },
                      { t: 2, label: 'Περιστ.', sub: '1-3/μήνα' },
                      { t: 3, label: 'Τακτικός', sub: '4+/μήνα' },
                      { t: 4, label: 'Εβδομ.', sub: 'κάθε εβδ.' },
                    ].map(({ t, label, sub }) => (
                      <span key={t} className="text-xs text-slate-400">
                        <span className={`font-medium ${TIER_LABELS[t].color}`}>T{t}</span> {label} ({sub})
                      </span>
                    ))}
                  </div>
                  </div>
            </div>
            </div>

            {poolLoading ? (
              <div className="text-sm text-slate-400 text-center py-8">Φόρτωση πελατών...</div>
            ) : customerPool.length === 0 ? (
              <div className="text-sm text-slate-400 italic text-center py-8">Δεν βρέθηκαν πελάτες για αυτή την επιλογή</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {customerPool.map(c => {
                  const tier = TIER_LABELS[c.tier];
                  return (
                    <div key={c.code} className={`p-3 rounded-lg border transition-colors ${c.sos ? 'border-amber-400 bg-amber-50' : c.included ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-700">{c.name}</span>
                            <span className="text-xs font-mono text-slate-400">{c.code}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tier.bg} ${tier.color}`}>
                              T{c.tier} · {c.total_invoices_6m > 0 ? `${Math.round(c.total_invoices_6m / 6)}/μήνα` : '0'}
                            </span>
                            {c.ytd_growth_pct !== null && c.ytd_growth_pct !== undefined && (
                              <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${(c.ytd_growth_pct ?? 0) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                {(c.ytd_growth_pct ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {(c.ytd_growth_pct ?? 0) >= 0 ? '+' : ''}{(c.ytd_growth_pct ?? 0).toFixed(1)}%
                              </span>
                            )}
                            {c.declining_months !== undefined && c.declining_months > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                                <AlertTriangle className="w-3 h-3" /> {c.declining_months}μ ↓
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                            {c.city && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{c.city}</span>}
                            {c.address && <span className="truncate max-w-xs">{c.address}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                            <span>Τελ. επίσκεψη: <span className="font-medium text-slate-600">{fmtMonthYear(c.last_visit_date)}</span></span>
                            <span>Τελ. αγορά: <span className="font-medium text-slate-600">{fmtMonthYear(c.last_invoice_date)}</span></span>
                          </div>
                          {c.constraint && (
                            <div className="mt-1 text-xs text-orange-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {c.constraint.allowed_days?.length > 0 && `Μόνο: ${c.constraint.allowed_days.map((d: number) => GREEK_DAYS_SHORT[d - 1]).join(', ')}`}
                              {c.constraint.earliest_time && ` από ${c.constraint.earliest_time}`}
                              {c.constraint.latest_time && ` έως ${c.constraint.latest_time}`}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* SOS toggle */}
                          <button
                            onClick={() => setCustomerPool(prev => prev.map(x => x.code === c.code ? { ...x, sos: !x.sos, included: true, assignedDate: !x.sos ? selectedDayForPool ?? undefined : undefined } : x))}
                            className={`p-1.5 rounded-lg transition-colors ${c.sos ? 'bg-amber-400 text-white' : 'bg-white border border-slate-300 text-slate-400 hover:text-amber-500'}`}
                            title="SOS — πρέπει να συμπεριληφθεί"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                          {/* Include/exclude toggle */}
                          <button
                            onClick={() => setCustomerPool(prev => prev.map(x => x.code === c.code ? { ...x, included: !x.included, sos: false } : x))}
                            className={`p-1.5 rounded-lg transition-colors ${c.included ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-400'}`}
                            title={c.included ? 'Εξαίρεση' : 'Συμπερίληψη'}
                          >
                            {c.included ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-slate-500">
                {customerPool.filter(c => c.included).length} επιλεγμένοι ·{' '}
                {customerPool.filter(c => c.sos).length} SOS
              </div>
              <button
                onClick={generatePlan}
                disabled={generating || customerPool.filter(c => c.included).length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {generating ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Δημιουργία...</>
                ) : (
                  <><Calendar className="w-4 h-4" />Δημιουργία Πλάνου</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: PLAN VIEW ── */}
        {step === 'plan' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h4 className="font-medium text-slate-700">Προτεινόμενο Πλάνο</h4>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                  {totalPlanned} πελάτες
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setStep('select')} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" /> Πίσω
                </button>
                <button onClick={generatePlan} disabled={generating}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-600 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" /> Αναδημιουργία
                </button>
              </div>
            </div>

            {saved && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm mb-4">
                <Check className="w-4 h-4" /> Το πλάνο αποθηκεύτηκε στο ημερολόγιο!
              </div>
            )}

            <div className="space-y-4">
              {validSlots.map(slot => {
                const custs = plan[slot.date] ?? [];
                const mapsUrl = buildGoogleMapsUrl(slot.date);
                const totalMinutes = custs.reduce((s, c, i) => s + (c.duration_minutes ?? 30) + (i > 0 ? (c.travel_buffer ?? 10) : 0), 0);
                const endHour = Math.floor((9 * 60 + totalMinutes) / 60);
                const endMin = (9 * 60 + totalMinutes) % 60;

                return (
                  <div key={slot.date} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700">{slot.dayName}</span>
                          <span className="text-xs text-slate-400">{new Date(slot.date).getDate()}/{new Date(slot.date).getMonth() + 1}</span>
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">{slot.area}{slot.city ? ` · ${slot.city}` : ''}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {custs.length} πελάτες · 09:00–{String(endHour).padStart(2, '0')}:{String(endMin).padStart(2, '0')}
                        </div>
                      </div>
                      {mapsUrl && (
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" /> Google Maps
                        </a>
                      )}
                    </div>

                    {custs.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-slate-400 italic text-center">Δεν προτείνονται πελάτες</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {custs.map((c, idx) => {
                          const tier = TIER_LABELS[c.tier];
                          return (
                            <div key={c.code}>
                            {idx > 0 && (
                              <div className="flex items-center gap-2 px-4 py-1 bg-slate-50 border-b border-slate-100">
                                <div className="w-px h-3 bg-slate-300 ml-5" />
                                <span className="text-xs text-slate-400">🚗 Μετακίνηση:</span>
                                {[5, 10, 15, 20, 30, 45].map(b => (
                                  <button key={b}
                                    onClick={() => {
                                      setPlan(prev => {
                                        const list = (prev[slot.date] ?? []).map((x, i) => i === idx ? { ...x, travel_buffer: b } : x);
                                        let minutes = 9 * 60;
                                        const recalculated = list.map((x, i) => {
                                          if (i > 0) minutes += x.travel_buffer ?? 10;
                                          const h = Math.floor(minutes / 60);
                                          const m = minutes % 60;
                                          const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                          minutes += x.duration_minutes ?? 30;
                                          return { ...x, suggested_time: time };
                                        });
                                        return { ...prev, [slot.date]: recalculated };
                                      });
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${(c.travel_buffer ?? 10) === b ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-400'}`}>
                                    {b}'
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className={`px-4 py-3 flex items-start gap-3 ${c.sos ? 'bg-amber-50' : ''}`}>
                              <div className="shrink-0 text-center w-14">
                                <div className="text-lg font-bold text-indigo-600">#{idx + 1}</div>
                                <div className="text-xs font-medium text-slate-500">{c.suggested_time}</div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {c.sos && <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                  <span className="text-sm font-medium text-slate-700">{c.name}</span>
                                  <span className="text-xs font-mono text-slate-400">{c.code}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tier.bg} ${tier.color}`}>T{c.tier}</span>
                                  {(c.lat || c.address || c.city) && (
                                  <a href={c.lat
                                    ? `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`
                                    : `https://www.google.com/maps/search/${encodeURIComponent([c.address, c.city, 'Greece'].filter(Boolean).join(', '))}`}
                                      target="_blank" rel="noopener noreferrer"
                                      className="p-0.5 text-slate-300 hover:text-blue-500 transition-colors"
                                      onClick={e => e.stopPropagation()}>
                                      <MapPin className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                                  {c.city && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{c.city}</span>}
                                  <span>Τελ. επίσκεψη: {fmtMonthYear(c.last_visit_date)}</span>
                                </div>
                                {/* Duration selector */}
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-xs text-slate-400">Διάρκεια:</span>
                                  {[10, 15, 20, 30, 45, 60].map(d => (
                                    <button key={d} onClick={() => updateDuration(slot.date, c.code, d)}
                                      className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${c.duration_minutes === d ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                      {d}'
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => movePlanItem(slot.date, idx, 'up')} disabled={idx === 0}
                                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => movePlanItem(slot.date, idx, 'down')} disabled={idx === custs.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => removePlanItem(slot.date, c.code)}
                                  className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={savePlan}
                disabled={saving || saved || totalPlanned === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Αποθήκευση...</>
                ) : saved ? (
                  <><Check className="w-4 h-4" />Αποθηκεύτηκε!</>
                ) : (
                  <><Check className="w-4 h-4" />Αποθήκευση στο Ημερολόγιο</>
                )}
              </button>
            </div>
            {unscheduled.length > 0 && (
  <div className="mt-4">
    <button
      onClick={() => setShowUnscheduled(v => !v)}
      className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <span>{unscheduled.length} πελάτες δεν προγραμματίστηκαν αυτή την εβδομάδα</span>
      </div>
      <ChevronDown className={`w-4 h-4 text-amber-500 transition-transform ${showUnscheduled ? 'rotate-180' : ''}`} />
    </button>
    {showUnscheduled && (
      <div className="mt-2 border border-amber-200 rounded-xl overflow-hidden">
        <div className="max-h-64 overflow-y-auto divide-y divide-amber-100">
          {unscheduled.map(c => {
            const tier = TIER_LABELS[c.tier ?? 0];
            return (
              <div key={c.customer_code} className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-amber-50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-700">{c.customer_name}</span>
                    <span className="text-xs font-mono text-slate-400">{c.customer_code}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tier.bg} ${tier.color}`}>T{c.tier ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                    <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{c.city}</span>
                    <span>Τελ. επίσκεψη: {fmtMonthYear(c.last_visit_date)}</span>
                    {c.days_since_visit < 999 && (
                      <span className={`font-medium ${c.days_since_visit > 60 ? 'text-red-500' : c.days_since_visit > 30 ? 'text-amber-500' : 'text-slate-500'}`}>
                        {c.days_since_visit}μ αγ.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>
)}
          </div>
        )}

      </div>
    </div>
  );
}
