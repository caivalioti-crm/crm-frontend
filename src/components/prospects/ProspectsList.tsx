import { useState, useEffect, useMemo } from 'react';
import { UserPlus, ChevronDown, Plus, Search, MapPin, Eye, Bell } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const BASE_URL = 'http://localhost:3001';

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

export function ProspectsList({ currentUser, onNewProspect, onSelectProspect }: ProspectsListProps) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');

  useEffect(() => {
    authedFetch('/api/prospects')
      .then(data => setProspects(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredProspects = useMemo(() => {
    return prospects.filter(p => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.business_name.toLowerCase().includes(q) &&
            !(p.owner_name?.toLowerCase().includes(q)) &&
            !(p.vat_number?.includes(q)) &&
            !(p.phone?.includes(q))) return false;
      }
      if (statusFilter && p.status !== statusFilter) return false;
      if (areaFilter && p.area !== areaFilter) return false;
      return true;
    });
  }, [prospects, searchQuery, statusFilter, areaFilter]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    prospects.forEach(p => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return counts;
  }, [prospects]);

  const areas = useMemo(() =>
    [...new Set(prospects.map(p => p.area).filter(Boolean))].sort() as string[],
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
            {summary['offer_sent'] > 0 && (
              <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                {summary['offer_sent']} προσφορά
              </span>
            )}
            {summary['visited'] > 0 && (
              <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                {summary['visited']} επισκέφθηκαν
              </span>
            )}
            {summary['converted'] > 0 && (
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

          {/* Search + area filter */}
          <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Επωνυμία, ιδιοκτήτης, ΑΦΜ, τηλέφωνο..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>
            <select
              value={areaFilter}
              onChange={e => setAreaFilter(e.target.value)}
              className="text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Όλες οι Περιοχές</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* List */}
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading prospects...</div>
          ) : filteredProspects.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500 text-sm">
              Δεν βρέθηκαν prospects
            </div>
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
                          {visitCount > 0 && (
                            <span className="text-purple-600">{visitCount} επισκέψεις</span>
                          )}
                        </div>
                      </div>
                      <Eye className="w-4 h-4 text-gray-400 group-hover:text-purple-600 shrink-0 mt-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}