import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, X, Plus, Calendar, MapPin,
  CheckCircle, Clock, User, Building2, CalendarDays,
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

const GREEK_MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος',
  'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος',
  'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];

const GREEK_DAYS_SHORT = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ'];

const TIME_SEGMENTS = ['09-11', '11-13', '13-15', '15-17', '17-19'];

interface CalendarProps {
  currentUser: { id: string; role: string; name: string; salesman_code?: string | null };
  onClose: () => void;
  onSelectCustomer?: (customer: any) => void;
  customers?: any[];
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday-first: 0=Mon...6=Sun
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getMondayOfWeek(d: Date): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return dateKey(monday);
}

const VISIT_TYPE_COLORS: Record<string, string> = {
  'in-person': 'bg-purple-500',
  'phone': 'bg-blue-400',
  'video': 'bg-cyan-400',
  'other': 'bg-slate-400',
};

export function VisitCalendar({ onSelectCustomer, onClose, customers = [] }: CalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [actualVisits, setActualVisits] = useState<any[]>([]);
  const [plannedVisits, setPlannedVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showAddPlanned, setShowAddPlanned] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Add planned visit form state
  const [formCustomerCode, setFormCustomerCode] = useState('');
  const [formCustomerSearch, setFormCustomerSearch] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTimeSegment, setFormTimeSegment] = useState('');
  const [formPreciseTime, setFormPreciseTime] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsFixed, setFormIsFixed] = useState(false);
  const [formSaving, setFormSaving] = useState(false);

  

  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [actual, planned] = await Promise.allSettled([
        authedFetch(`/api/visits?from=${from}&to=${to}`),
        authedFetch(`/api/planning/planned-visits?from=${from}&to=${to}`),
      ]);
      setActualVisits(actual.status === 'fulfilled' ? (Array.isArray(actual.value) ? actual.value : []) : []);
      setPlannedVisits(planned.status === 'fulfilled' ? (Array.isArray(planned.value) ? planned.value : []) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to, refreshKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const days = getMonthDays(year, month);

  // Group by date
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
  const selectedActual = selectedKey ? (actualByDate.get(selectedKey) ?? []) : [];
  const selectedPlanned = selectedKey ? (plannedByDate.get(selectedKey) ?? []) : [];

  const filteredCustomers = customers.filter(c =>
    c.is_active !== false &&
    (formCustomerSearch === '' ||
      c.name?.toLowerCase().includes(formCustomerSearch.toLowerCase()) ||
      c.code?.includes(formCustomerSearch))
  ).slice(0, 20);

  const handleAddPlanned = async () => {
    if (!formDate) return;
    setFormSaving(true);
    try {
      await authedFetch('/api/planning/planned-visits', {
        method: 'POST',
        body: JSON.stringify({
          planned_date: formDate,
          week_start: getMondayOfWeek(new Date(formDate)),
          customer_code: formCustomerCode || null,
          time_segment: formTimeSegment || null,
          planned_time: formPreciseTime || null,
          notes: formNotes || null,
          is_fixed_appointment: formIsFixed,
        }),
      });
      setShowAddPlanned(false);
      setFormCustomerCode('');
      setFormCustomerSearch('');
      setFormDate(selectedKey ?? '');
      setFormTimeSegment('');
      setFormPreciseTime('');
      setFormNotes('');
      setFormIsFixed(false);
      setRefreshKey(k => k + 1);
    } catch (err) {
      alert('Αποτυχία αποθήκευσης');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeletePlanned = async (id: string) => {
    try {
      await authedFetch(`/api/planning/planned-visits/${id}`, { method: 'DELETE' });
      setRefreshKey(k => k + 1);
    } catch {
      alert('Αποτυχία διαγραφής');
    }
  };

  const openAddForDay = (d: Date) => {
    setSelectedDay(d);
    setFormDate(dateKey(d));
    setShowAddPlanned(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-4 px-2">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5" />
            <h2 className="text-lg font-bold">Ημερολόγιο Επισκέψεων</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

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
        <div className="flex items-center gap-4 px-6 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />Επίσκεψη</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" />Προγραμ.</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Ραντεβού</span>
        </div>

        {/* Calendar grid */}
        <div className="px-4 py-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {GREEK_DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} />;
              const dk = dateKey(d);
              const actual = actualByDate.get(dk) ?? [];
              const planned = plannedByDate.get(dk) ?? [];
              const isToday = dk === todayKey;
              const isSelected = dk === selectedKey;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const total = actual.length + planned.length;

              return (
                <button
                  key={dk}
                  onClick={() => setSelectedDay(isSelected ? null : d)}
                  className={`
                    relative min-h-[56px] p-1.5 rounded-lg text-left transition-all border
                    ${isSelected ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}
                    ${isWeekend ? 'bg-slate-50/50' : ''}
                  `}
                >
                  <div className={`
                    text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday ? 'bg-indigo-600 text-white' : isSelected ? 'text-indigo-700' : 'text-slate-600'}
                  `}>
                    {d.getDate()}
                  </div>

                  {/* Dots */}
                  <div className="flex flex-wrap gap-0.5">
                    {actual.slice(0, 3).map((v, j) => (
                      <span key={j} className={`w-2 h-2 rounded-full ${VISIT_TYPE_COLORS[v.visit_type] ?? 'bg-purple-500'}`} />
                    ))}
                    {planned.slice(0, 2).map((v, j) => (
                      <span key={`p${j}`} className={`w-2 h-2 rounded-full ${v.is_fixed_appointment ? 'bg-green-500' : 'bg-blue-400'}`} />
                    ))}
                    {total > 5 && <span className="text-xs text-slate-400 leading-none">+{total - 5}</span>}
                  </div>

                  {/* Quick add */}
                  {isSelected && (
                    <button
                      onClick={e => { e.stopPropagation(); openAddForDay(d); }}
                      className="absolute top-1 right-1 w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        {selectedDay && !showAddPlanned && (
          <div className="border-t border-slate-100 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800">
                {selectedDay.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button
                onClick={() => openAddForDay(selectedDay)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" /> Προγραμ. Επίσκεψη
              </button>
            </div>

            {selectedActual.length === 0 && selectedPlanned.length === 0 && (
              <div className="text-sm text-slate-400 italic">Καμία επίσκεψη αυτή την ημέρα</div>
            )}

            {/* Actual visits */}
            {selectedActual.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Πραγματικές Επισκέψεις</div>
                <div className="space-y-2">
                  {selectedActual.map(v => (
                    <div
                        key={v.id}
                        onClick={() => {
                            const cust = customers.find(c => c.code === v.customer_code);
                            if (cust && onSelectCustomer) onSelectCustomer(cust);
                        }}
                        className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100 cursor-pointer hover:bg-purple-100 transition-colors"
                        >
                      <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-700">
                                        {customers.find(c => c.code === v.customer_code)?.name ?? v.customer_code}
                                        </span>
                                        <span className="text-xs font-mono text-slate-400">{v.customer_code}</span>
                          {v.visit_type && (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">{v.visit_type}</span>
                          )}
                          {v.owner_name && <span className="text-xs text-slate-400">{v.owner_name}</span>}
                        </div>
                        {v.notes && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{v.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Planned visits */}
            {selectedPlanned.length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Προγραμματισμένες</div>
                <div className="space-y-2">
                  {selectedPlanned.map(v => {
                    const cust = customers.find(c => c.code === v.customer_code);
                    return (
                      <div key={v.id} className={`flex items-start gap-3 p-3 rounded-lg border ${v.is_fixed_appointment ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-100'}`}>
                        <Clock className={`w-4 h-4 mt-0.5 shrink-0 ${v.is_fixed_appointment ? 'text-green-500' : 'text-blue-400'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {v.customer_code ? (
                              <span className="text-sm font-medium text-slate-700">
                                {cust?.name ?? v.customer_code}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-500 italic">Χωρίς συγκεκριμένο πελάτη</span>
                            )}
                            {v.is_fixed_appointment && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">Ραντεβού</span>
                            )}
                            {v.time_segment && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{v.time_segment}</span>
                            )}
                            {v.planned_time && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{v.planned_time.slice(0, 5)}</span>
                            )}
                          </div>
                          {v.area && <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400"><MapPin className="w-3 h-3" />{v.area}{v.city ? ` › ${v.city}` : ''}</div>}
                          {v.notes && <p className="text-xs text-slate-500 mt-0.5">{v.notes}</p>}
                        </div>
                        <button
                          onClick={() => handleDeletePlanned(v.id)}
                          className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add planned visit form */}
        {showAddPlanned && (
          <div className="border-t border-slate-100 px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Προγραμματισμός Επίσκεψης</h3>
              <button onClick={() => setShowAddPlanned(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ημερομηνία</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Customer search */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Πελάτης (προαιρετικό)</label>
                {formCustomerCode ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <Building2 className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm text-indigo-700 flex-1">
                      {customers.find(c => c.code === formCustomerCode)?.name ?? formCustomerCode}
                    </span>
                    <button onClick={() => { setFormCustomerCode(''); setFormCustomerSearch(''); }} className="text-slate-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={formCustomerSearch}
                      onChange={e => setFormCustomerSearch(e.target.value)}
                      placeholder="Αναζήτηση πελάτη..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                    {formCustomerSearch && filteredCustomers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredCustomers.map(c => (
                          <button
                            key={c.code}
                            onClick={() => { setFormCustomerCode(c.code); setFormCustomerSearch(''); }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left"
                          >
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

              {/* Time segment */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Χρονικό Τμήμα</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFormTimeSegment('')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${formTimeSegment === '' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}
                  >
                    Οποιαδήποτε ώρα
                  </button>
                  {TIME_SEGMENTS.map(seg => (
                    <button
                      key={seg}
                      onClick={() => setFormTimeSegment(seg)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${formTimeSegment === seg ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}
                    >
                      {seg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Precise time */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ακριβής Ώρα (προαιρετικό)</label>
                <input
                  type="time"
                  value={formPreciseTime}
                  onChange={e => setFormPreciseTime(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Fixed appointment */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="fixed-appt"
                  checked={formIsFixed}
                  onChange={e => setFormIsFixed(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="fixed-appt" className="text-sm text-slate-600">
                  Σταθερό ραντεβού <span className="text-xs text-slate-400">(constraint για τον προγραμματισμό)</span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Σημειώσεις</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="π.χ. Να συζητηθούν νέες κατηγορίες..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddPlanned}
                  disabled={!formDate || formSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {formSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}
                </button>
                <button
                  onClick={() => setShowAddPlanned(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm"
                >
                  Ακύρωση
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Monthly summary footer */}
        <div className="border-t border-slate-100 px-6 py-3 bg-slate-50 rounded-b-2xl flex items-center gap-6 text-sm text-slate-500">
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
      </div>
    </div>
  );
}
