import { useState, useEffect, useMemo } from 'react';
import { UserPlus, ChevronDown, Plus, Search, MapPin, Eye, Calendar, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Prospect = {
  id: string;
  business_name: string;
  owner_name: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  area: string | null;
  vat_number: string | null;
  notes: string | null;
  status: string;
  salesman_code: string;
  assigned_rep_id: string;
  created_at: string;
  converted_customer_code: string | null;
  crm_prospect_visits: any[];
};

type ProspectsListProps = {
  currentUser: {
    id: string;
    name: string;
    role: 'rep' | 'manager' | 'admin' | 'exec';
    salesman_code?: string | null;
  };
  onNewProspect: () => void;
  onSelectProspect: (prospect: Prospect) => void;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  new_lead:   { label: 'Νέο Lead',    bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
  contacted:  { label: 'Επικοινωνία', bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  visited:    { label: 'Επίσκεψη',    bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  offer_sent: { label: 'Προσφορά',    bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  converted:  { label: 'Πελάτης ✓',  bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  lost:       { label: 'Χαμένο',      bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-400' },
};

const DATE_FILTERS = [
  { label: 'Όλες', value: '' },
  { label: 'Σήμερα', value: 'today' },
  { label: 'Εβδομάδα', value: 'week' },
  { label: 'Μήνας', value: 'month' },
  { label: '3 Μήνες', value: '3months' },
];

function getDateThreshold(filter: string): string | null {
  const now = new Date();
  if (filter === 'today') {
    return now.toISOString().split('T')[0];
  }
  if (filter === 'week') {
    now.setDate(now.getDate() - 7);
  } else if (filter === 'month') {
    now.setMonth(now.getMonth() - 1);
  } else if (filter === '3months') {
    now.setMonth(now.getMonth() - 3);
  } else {
    return null;
  }
  return now.toISOString().split('T')[0];
}

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

type Tab = 'prospects' | 'visits';

export function ProspectsList({ onNewProspect, onSelectProspect }: ProspectsListProps) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('prospects');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Prospect visits state
  const [prospectVisits, setProspectVisits] = useState<any[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);

  useEffect(() => {
    authedFetch('/api/prospects')
      .then(data => setProspects(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'visits' && prospectVisits.length === 0) {
      setVisitsLoading(true);
      // Fetch all prospect visits by fetching each prospect's visits
      authedFetch('/api/prospects')
        .then(async (data: Prospect[]) => {
          const allVisits: any[] = [];
          for (const p of data) {
            const visits = p.crm_prospect_visits ?? [];
            visits.forEach((v: any) => allVisits.push({ ...v, prospect_name: p.business_name, prospect_id: p.id }));
          }
          allVisits.sort((a, b) => (b.visit_date ?? '').localeCompare(a.visit_date ?? ''));
          setProspectVisits(allVisits);
        })
        .catch(console.error)
        .finally(() => setVisitsLoading(false));
    }
  }, [activeTab]);

  const areas = useMemo(() =>
    [...new Set(prospects.map(p => p.area).filter(Boolean))].sort() as string[],
    [prospects]
  );

  const cities = useMemo(() => {
    const source = areaFilter ? prospects.filter(p => p.area === areaFilter) : prospects;
    return [...new Set(source.map(p => p.city).filter(Boolean))].sort() as string[];
  }, [prospects, areaFilter]);

  const filteredProspects = useMemo(() => {
    const dateThreshold = getDateThreshold(dateFilter);
    return prospects.filter(p => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.business_name.toLowerCase().includes(q) &&
            !(p.owner_name?.toLowerCase().includes(q)) &&
            !(p.vat_number?.includes(q)) &&
            !(p.phone?.includes(q)) &&
            !(p.mobile?.includes(q))) return false;
      }
      if (statusFilter && p.status !== statusFilter) return false;
      if (areaFilter && p.area !== areaFilter) return false;
      if (cityFilter && p.city !== cityFilter) return false;
      if (dateThreshold) {
        const created = (p.created_at ?? '').slice(0, 10);
        if (dateFilter === 'today') {
          if (created !== dateThreshold) return false;
        } else {
          if (created < dateThreshold) return false;
        }
      }
      return true;
    });
  }, [prospects, searchQuery, statusFilter, areaFilter, cityFilter, dateFilter]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    prospects.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [prospects]);

  const totalVisits = useMemo(() =>
    prospects.reduce((sum, p) => sum + (p.crm_prospect_visits?.length ?? 0), 0),
    [prospects]
  );

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
        >
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-purple-600" />
            Prospects
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              {prospects.length} σύνολο
            </span>
            {(summary['visited'] ?? 0) > 0 && (
              <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                {summary['visited']} επισκέφθηκαν
              </span>
            )}
            {(summary['converted'] ?? 0) > 0 && (
              <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                {summary['converted']} μετατράπηκαν
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0 ml-3">
          <button
            onClick={e => { e.stopPropagation(); onNewProspect(); }}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Νέος
          </button>
          <button
            onClick={() => setIsOpen(prev => !prev)}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-gray-200">

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => setActiveTab('prospects')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'prospects'
                  ? 'border-purple-500 text-purple-700 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Prospects ({prospects.length})
            </button>
            <button
              onClick={() => setActiveTab('visits')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'visits'
                  ? 'border-purple-500 text-purple-700 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Επισκέψεις ({totalVisits})
            </button>
          </div>

          {activeTab === 'prospects' && (
            <>
              {/* Status filter bar */}
              <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-2">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  (summary[key] || 0) > 0 && (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border-2 ${
                        statusFilter === key ? 'border-gray-400' : 'border-transparent'
                      } ${cfg.bg} ${cfg.text}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label} ({summary[key]})
                    </button>
                  )
                ))}
                {statusFilter && (
                  <button onClick={() => setStatusFilter('')} className="text-xs text-gray-500 hover:text-gray-700 underline">
                    Clear
                  </button>
                )}
              </div>

              {/* Search + filters */}
              <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Επωνυμία, ιδιοκτήτης, ΑΦΜ, τηλέφωνο..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={areaFilter}
                    onChange={e => { setAreaFilter(e.target.value); setCityFilter(''); }}
                    className="text-sm bg-white border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Όλες οι Περιοχές</option>
                    {areas.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  {areaFilter && cities.length > 0 && (
                    <select
                      value={cityFilter}
                      onChange={e => setCityFilter(e.target.value)}
                      className="text-sm bg-white border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Όλες οι Πόλεις</option>
                      {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  <div className="flex gap-1">
                    {DATE_FILTERS.map(f => (
                      <button
                        key={f.value}
                        onClick={() => setDateFilter(f.value)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          dateFilter === f.value
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Prospects list */}
              {loading ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">Φόρτωση...</div>
              ) : filteredProspects.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500 text-sm">Δεν βρέθηκαν prospects</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredProspects.map(prospect => {
                    const cfg = STATUS_CONFIG[prospect.status] ?? STATUS_CONFIG['new_lead'];
                    const visitCount = prospect.crm_prospect_visits?.length ?? 0;
                    return (
                      <button
                        key={prospect.id}
                        onClick={() => onSelectProspect(prospect)}
                        className="w-full px-4 sm:px-6 py-4 hover:bg-purple-50 transition-colors text-left group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                              <span className="font-semibold text-gray-900 group-hover:text-purple-700">
                                {prospect.business_name}
                              </span>
                              {prospect.owner_name && (
                                <span className="text-xs text-gray-500">{prospect.owner_name}</span>
                              )}
                              {prospect.converted_customer_code && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-mono">
                                  → {prospect.converted_customer_code}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                              {(prospect.city || prospect.area) && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {prospect.city}{prospect.city && prospect.area ? ', ' : ''}{prospect.area}
                                </span>
                              )}
                              {prospect.vat_number && (
                                <span className="font-mono text-gray-400">ΑΦΜ: {prospect.vat_number}</span>
                              )}
                              {prospect.phone && <span>📞 {prospect.phone}</span>}
                              {visitCount > 0 && (
                                <span className="text-purple-600">{visitCount} επισκέψεις</span>
                              )}
                              <span className="text-gray-300">{prospect.created_at?.slice(0, 10)}</span>
                            </div>
                          </div>
                          <Eye className="w-4 h-4 text-gray-400 group-hover:text-purple-600 shrink-0 mt-1" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'visits' && (
            <div>
              {visitsLoading ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">Φόρτωση...</div>
              ) : prospectVisits.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500 text-sm">Δεν βρέθηκαν επισκέψεις</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {prospectVisits.map((v: any) => (
                    <div key={v.id} className="px-4 sm:px-6 py-3 hover:bg-purple-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="text-sm font-medium text-gray-700">{v.visit_date}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{v.visit_type ?? 'in-person'}</span>
                          </div>
                          <div className="text-xs font-semibold text-purple-700 mb-0.5">{v.prospect_name}</div>
                          {v.notes && <div className="text-xs text-gray-500 truncate">{v.notes}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}