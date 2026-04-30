import { useState, useEffect, useCallback } from 'react';
import { Calendar, MapPin, User, ChevronDown, Search, CheckCircle, Clock, AlertCircle, Plus, ChevronRight, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const BASE_URL = 'http://localhost:3001';

type Task = {
  id: string;
  description: string;
  reminder_date: string | null;
  status: 'not-started' | 'in-progress' | 'completed';
};

type VisitCategory = {
  id: string;
  category_code: string;
  subcategory_code: string | null;
};

type Visit = {
  id: string;
  customer_code: string;
  salesman_code: string;
  visit_date: string;
  visit_time: string | null;
  visit_type: string;
  notes: string;
  created_at: string;
  crm_visit_tasks: Task[];
  crm_visit_categories: VisitCategory[];
};

type CategoryItem = {
  category_code: string;
  parent_code: string | null;
  level: number;
  full_name: string;
  short_name: string;
};

type VisitsLogProps = {
  currentUser: {
    id: string;
    name: string;
    role: 'rep' | 'manager' | 'admin' | 'exec';
    salesman_code?: string | null;
  };
  onNewVisit: () => void;
  customers?: { code: string; name: string; city: string; area: string; trdr_id?: number }[];
};

async function authedFetch(url: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export function VisitsLog({ currentUser, onNewVisit, customers = [] }: VisitsLogProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const [visitsData, categoriesData] = await Promise.all([
        authedFetch('/api/visits'),
        authedFetch('/api/categories'),
      ]);
      setVisits(Array.isArray(visitsData) ? visitsData : []);
      setAllCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  const categoryMap = new Map(allCategories.map(c => [c.category_code, c]));
  const customerMap = new Map(customers.map(c => [c.code, c]));

  const areas = [...new Set(customers.map(c => c.area))].sort();
  const cities = selectedArea
    ? [...new Set(customers.filter(c => c.area === selectedArea).map(c => c.city))].sort()
    : [];

  const filteredVisits = visits.filter(v => {
    const customer = customerMap.get(v.customer_code);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesCode = v.customer_code.includes(q);
      const matchesName = customer?.name.toLowerCase().includes(q) ?? false;
      const matchesNotes = v.notes?.toLowerCase().includes(q) ?? false;
      if (!matchesCode && !matchesName && !matchesNotes) return false;
    }
    if (selectedArea && customer?.area !== selectedArea) return false;
    if (selectedCity && customer?.city !== selectedCity) return false;
    if (dateFrom && v.visit_date < dateFrom) return false;
    if (dateTo && v.visit_date > dateTo) return false;
    return true;
  });

  const hasActiveFilters = searchQuery || selectedArea || selectedCity || dateFrom || dateTo;

  const getTaskSummary = (tasks: Task[]) => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = total - completed;
    return { total, completed, pending };
  };

  const formatVisitDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const groupVisitCategories = (visitCategories: VisitCategory[]) => {
    const groups = new Map<string, { general: boolean; subcats: string[] }>();

    for (const vc of visitCategories) {
      if (!vc.subcategory_code) {
        // Parent selected as general
        const name = categoryMap.get(vc.category_code)?.full_name ?? vc.category_code;
        if (!groups.has(name)) groups.set(name, { general: false, subcats: [] });
        groups.get(name)!.general = true;
      } else {
        // Subcategory selected — find its root parent for grouping
        const subCat = categoryMap.get(vc.subcategory_code);
        const parentCat = subCat?.parent_code ? categoryMap.get(subCat.parent_code) : null;
        const groupName = parentCat?.full_name ?? categoryMap.get(vc.category_code)?.full_name ?? vc.category_code;
        const subName = subCat?.full_name ?? vc.subcategory_code;
        if (!groups.has(groupName)) groups.set(groupName, { general: false, subcats: [] });
        groups.get(groupName)!.subcats.push(subName);
      }
    }
    return groups;
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div
        className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(prev => !prev)}
      >
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Visit Log
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {filteredVisits.length} visit{filteredVisits.length !== 1 ? 's' : ''}
            {hasActiveFilters ? ' (filtered)' : ` · ${visits.length} total`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          <button
            onClick={e => { e.stopPropagation(); onNewVisit(); }}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Visit
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          {/* Filters */}
          <div className="px-4 sm:px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Customer or notes..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500" />
              </div>
              <select value={selectedArea} onChange={e => { setSelectedArea(e.target.value); setSelectedCity(''); }}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="">All Areas</option>
                {areas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} disabled={!selectedArea}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                <option value="">All Cities</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="text-xs text-gray-400 mb-1">From</div>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-400 mb-1">To</div>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">Filters:</span>
                {searchQuery && <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">"{searchQuery}"</span>}
                {selectedArea && <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs">{selectedArea}</span>}
                {selectedCity && <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">{selectedCity}</span>}
                {dateFrom && <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">From {dateFrom}</span>}
                {dateTo && <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">To {dateTo}</span>}
                <button onClick={() => { setSearchQuery(''); setSelectedArea(''); setSelectedCity(''); setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline ml-1">Clear all</button>
              </div>
            )}
          </div>

          {/* Visit list */}
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading visits...</div>
            ) : filteredVisits.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                {hasActiveFilters ? 'No visits match your filters.' : 'No visits recorded yet.'}
              </div>
            ) : (
              filteredVisits.map(visit => {
                const customer = customerMap.get(visit.customer_code);
                const taskSummary = getTaskSummary(visit.crm_visit_tasks);
                const isExpanded = expandedVisit === visit.id;
                const visitCategories = visit.crm_visit_categories ?? [];
                const categoryGroups = groupVisitCategories(visitCategories);

                return (
                  <div key={visit.id}>
                    <button
                      onClick={() => setExpandedVisit(isExpanded ? null : visit.id)}
                      className="w-full px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-gray-900">{formatVisitDate(visit.visit_date)}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-sm font-medium text-blue-600">{customer?.name ?? visit.customer_code}</span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">{visit.customer_code}</span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{visit.visit_type}</span>
                            {visitCategories.length > 0 && (
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs flex items-center gap-1">
                                <Tag className="w-3 h-3" />
                                {visitCategories.length} categories
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-1">
                            {customer && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {customer.city}, {customer.area}
                              </span>
                            )}
                            {(currentUser.role === 'manager' || currentUser.role === 'admin') && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {visit.salesman_code}
                              </span>
                            )}
                          </div>
                          {visit.notes && (
                            <p className="text-sm text-gray-600 line-clamp-2">{visit.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {taskSummary.total > 0 && (
                            taskSummary.pending > 0 ? (
                              <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                                <AlertCircle className="w-3 h-3" />
                                {taskSummary.pending} pending
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                <CheckCircle className="w-3 h-3" />
                                All done
                              </span>
                            )
                          )}
                          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 sm:px-6 pb-5 pt-3 bg-blue-50 border-t border-blue-100 space-y-4">

                        {/* Visit Notes */}
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Visit Notes</div>
                          <p className="text-sm text-gray-700 leading-relaxed">{visit.notes || '—'}</p>
                        </div>

                        {/* Categories Discussed */}
                        {categoryGroups.size > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Categories Discussed ({visitCategories.length})
                            </div>
                            <div className="space-y-2">
                              {Array.from(categoryGroups.entries()).map(([parentName, { general, subcats }]) => (
                                <div key={parentName} className="bg-white rounded-lg px-3 py-2.5 border border-gray-200">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-gray-800">{parentName}</span>
                                    {general && (
                                      <span className="px-2 py-0.5 border border-dashed border-blue-400 text-blue-500 rounded text-xs">
                                        general
                                      </span>
                                    )}
                                  </div>
                                  {subcats.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {subcats.map(sub => (
                                        <span key={sub} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                          {sub}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tasks */}
                        {visit.crm_visit_tasks.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Tasks ({taskSummary.completed}/{taskSummary.total} completed)
                            </div>
                            <div className="space-y-2">
                              {visit.crm_visit_tasks.map(task => (
                                <div key={task.id} className="flex items-start gap-3 bg-white rounded-lg px-3 py-2.5 border border-gray-200">
                                  <div className="mt-0.5">
                                    {task.status === 'completed'
                                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                                      : task.status === 'in-progress'
                                      ? <Clock className="w-4 h-4 text-orange-500" />
                                      : <AlertCircle className="w-4 h-4 text-gray-400" />
                                    }
                                  </div>
                                  <div className="flex-1">
                                    <p className={`text-sm ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                      {task.description}
                                    </p>
                                    {task.reminder_date && (
                                      <div className="text-xs text-gray-400 mt-0.5">Reminder: {task.reminder_date}</div>
                                    )}
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                                    task.status === 'completed' ? 'bg-green-100 text-green-700' :
                                    task.status === 'in-progress' ? 'bg-orange-100 text-orange-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {task.status === 'not-started' ? 'Not started' :
                                     task.status === 'in-progress' ? 'In progress' : 'Completed'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}