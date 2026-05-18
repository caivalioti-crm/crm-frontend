import { useState, useEffect } from 'react';
import { TrendingDown, AlertCircle, BarChart2, ChevronDown, ChevronRight, X, RotateCcw, Lightbulb, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function authedFetch(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

type Signal = {
  category_code: string;
  category_name: string;
  category_level: number;
  status: 'open' | 'discussed' | 'dismissed';
  notes: string | null;
};

type DecliningSignal = Signal & {
  prev_revenue: number;
  curr_revenue: number;
  drop_pct: number;
  pct_of_total: number;
  was_top3: boolean;
};

type MissingSignal = Signal & {
  peer_penetration_pct: number;
  peer_avg_revenue: number;
  peer_buyer_count: number;
  similar_customer_count: number;
};

type WeakSignal = Signal & {
  curr_revenue: number;
  peer_avg_revenue: number;
  gap_revenue: number;
  ratio_pct: number;
};

type IntelligenceData = {
  similar_customers: { count: number };
  out_of_scope: string[];
  declining: DecliningSignal[];
  missing: MissingSignal[];
  weak: WeakSignal[];
};

function fmtEur(n: number) {
  return '€' + Math.round(n).toLocaleString('el-GR');
}

type TabType = 'declining' | 'missing' | 'weak';

export function CategoryIntelligence({
  customerCode,
  competitorInfo,
  salesPeriod,
}: {
  customerCode: string;
  competitorInfo: any;
  salesPeriod: { dateFrom: string; dateTo: string; prevDateFrom: string; prevDateTo: string; label: string; prevLabel: string };
}) {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('declining');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [outOfScopeList, setOutOfScopeList] = useState<any[]>([]);
  const [showOutOfScope, setShowOutOfScope] = useState(false);
  const [showSimilar, setShowSimilar] = useState(false);
  const [similarCustomers, setSimilarCustomers] = useState<any[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const loadSimilar = async () => {
    if (similarCustomers.length > 0) { setShowSimilar(true); return; }
    setSimilarLoading(true);
    try {
      const result = await authedFetch(
        `/api/customers/${customerCode}/similar-customers?from=${salesPeriod.dateFrom}&to=${salesPeriod.dateTo}`
      );
      setSimilarCustomers(result);
      setShowSimilar(true);
    } catch (e) { console.error(e); }
    finally { setSimilarLoading(false); }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      authedFetch(
        `/api/customers/${customerCode}/category-intelligence?from=${salesPeriod.dateFrom}&to=${salesPeriod.dateTo}&prevFrom=${salesPeriod.prevDateFrom}&prevTo=${salesPeriod.prevDateTo}`
      ),
      authedFetch(`/api/customers/${customerCode}/category-scope`),
    ])
      .then(([intel, scope]) => {
        setData(intel);
        setOutOfScopeList(scope ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [customerCode, salesPeriod.dateFrom, salesPeriod.dateTo]);

  const saveOpportunity = async (
    opportunityType: string,
    signal: Signal,
    status: string,
    notesText?: string
  ) => {
    const key = `${opportunityType}__${signal.category_code}`;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await authedFetch(`/api/customers/${customerCode}/category-opportunities`, {
        method: 'POST',
        body: JSON.stringify({
          opportunity_type: opportunityType,
          category_code: signal.category_code,
          category_level: signal.category_level,
          category_name: signal.category_name,
          status,
          notes: notesText ?? notes[key] ?? null,
        }),
      });
      // Update local state
      setData(prev => {
        if (!prev) return prev;
        const update = (arr: Signal[]) =>
          arr.map(s => s.category_code === signal.category_code
            ? { ...s, status: status as any, notes: notesText ?? notes[key] ?? s.notes }
            : s
          );
        return {
          ...prev,
          declining: update(prev.declining) as DecliningSignal[],
          missing: update(prev.missing) as MissingSignal[],
          weak: update(prev.weak) as WeakSignal[],
        };
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  };

  const markOutOfScope = async (signal: Signal) => {
    await authedFetch(`/api/customers/${customerCode}/category-scope`, {
      method: 'POST',
      body: JSON.stringify({
        category_code: signal.category_code,
        category_level: signal.category_level,
      }),
    });
    setOutOfScopeList(prev => [...prev, { category_code: signal.category_code, category_name: signal.category_name }]);
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        missing: prev.missing.filter(s => s.category_code !== signal.category_code),
      };
    });
  };

  const revertOutOfScope = async (categoryCode: string) => {
    await authedFetch(`/api/customers/${customerCode}/category-scope/${categoryCode}`, {
      method: 'DELETE',
    });
    setOutOfScopeList(prev => prev.filter(s => s.category_code !== categoryCode));
  };

  if (loading) return (
    <section className="bg-white rounded-xl shadow p-5">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="w-5 h-5 text-amber-500" />
        <h2 className="text-base font-semibold">Category Intelligence</h2>
      </div>
      <div className="text-sm text-slate-400">Ανάλυση κατηγοριών...</div>
    </section>
  );

  if (error) return (
    <section className="bg-white rounded-xl shadow p-5">
      <div className="text-sm text-red-500">Σφάλμα: {error}</div>
    </section>
  );

  if (!data) return null;

  const totalSignals = data.declining.length + data.missing.length + data.weak.length;
  const tabs: { key: TabType; label: string; count: number; color: string }[] = [
    { key: 'declining', label: 'Πτωτικές', count: data.declining.length, color: 'text-red-600' },
    { key: 'missing', label: 'Απούσες', count: data.missing.length, color: 'text-purple-600' },
    { key: 'weak', label: 'Αδύναμες', count: data.weak.length, color: 'text-amber-600' },
  ];

  const renderDecliningCard = (signal: DecliningSignal) => {
    const key = `declining__${signal.category_code}`;
    const isExpanded = expandedCard === key;
    const isDismissed = signal.status === 'dismissed';
    const isDiscussed = signal.status === 'discussed';
    if (isDismissed) return null;

    return (
      <div key={key} className={`rounded-xl border overflow-hidden ${isDiscussed ? 'border-green-200 bg-green-50' : 'border-red-100 bg-white'}`}>
        <button onClick={() => setExpandedCard(isExpanded ? null : key)}
          className="w-full px-4 py-3 flex items-start justify-between text-left hover:bg-red-50 transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {signal.was_top3 && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">Top-3 κατηγορία</span>
              )}
              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">L{signal.category_level}</span>
              {isDiscussed && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Συζητήθηκε</span>}
            </div>
            <div className="font-semibold text-slate-800 text-sm">{signal.category_name}</div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="text-red-600 font-bold">-{signal.drop_pct}%</span>
              <span>{fmtEur(signal.prev_revenue)} → {fmtEur(signal.curr_revenue)}</span>
              {signal.pct_of_total > 0 && <span>{signal.pct_of_total}% του τζίρου</span>}
            </div>
          </div>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />}
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-red-50 space-y-3 pt-3">
            {competitorInfo?.main_competitor && (
              <div className="text-xs bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                <span className="text-orange-600 font-medium">⚔ Ανταγωνιστής: </span>
                <span className="text-orange-700 font-semibold">{competitorInfo.main_competitor}</span>
                {competitorInfo.estimated_monthly_spend && (
                  <span className="text-orange-500 ml-1">(~{fmtEur(competitorInfo.estimated_monthly_spend)}/μήνα)</span>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-slate-400 mb-0.5">{salesPeriod.prevLabel}</div>
                <div className="font-bold text-slate-700">{fmtEur(signal.prev_revenue)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-2">
                <div className="text-slate-400 mb-0.5">Τρέχουσα περίοδος</div>
                <div className="font-bold text-red-600">{fmtEur(signal.curr_revenue)}</div>
              </div>
            </div>
            <textarea
              rows={2}
              value={notes[key] ?? signal.notes ?? ''}
              onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))}
              placeholder="Σημειώσεις από τη συζήτηση..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-red-400 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => saveOpportunity('declining', signal, 'discussed', notes[key])}
                disabled={saving[key]}
                className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors">
                {saving[key] ? '...' : '✓ Συζητήθηκε'}
              </button>
              <button
                onClick={() => saveOpportunity('declining', signal, 'dismissed')}
                disabled={saving[key]}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors">
                Απόρριψη
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMissingCard = (signal: MissingSignal) => {
    const key = `missing__${signal.category_code}`;
    const isExpanded = expandedCard === key;
    const isDismissed = signal.status === 'dismissed';
    if (isDismissed) return null;

    return (
      <div key={key} className="rounded-xl border border-purple-100 bg-white overflow-hidden">
        <button onClick={() => setExpandedCard(isExpanded ? null : key)}
          className="w-full px-4 py-3 flex items-start justify-between text-left hover:bg-purple-50 transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-semibold">{signal.peer_penetration_pct}% ομότιμων</span>
              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">L{signal.category_level}</span>
            </div>
            <div className="font-semibold text-slate-800 text-sm">{signal.category_name}</div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{signal.peer_buyer_count}/{signal.similar_customer_count} πελάτες</span>
              <span>Μέσος όρος: {fmtEur(signal.peer_avg_revenue)}</span>
            </div>
          </div>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />}
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-purple-50 space-y-3 pt-3">
            <div className="text-xs bg-purple-50 rounded-lg px-3 py-2 text-purple-700">
              {signal.peer_penetration_pct}% των ομότιμων πελατών ({signal.peer_buyer_count} από {signal.similar_customer_count}) αγοράζουν αυτή την κατηγορία με μέσο τζίρο {fmtEur(signal.peer_avg_revenue)} την περίοδο.
            </div>
            <textarea
              rows={2}
              value={notes[key] ?? signal.notes ?? ''}
              onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))}
              placeholder="Σημειώσεις..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-400 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => saveOpportunity('missing', signal, 'discussed', notes[key])}
                disabled={saving[key]}
                className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors">
                {saving[key] ? '...' : '✓ Συζητήθηκε'}
              </button>
              <button
                onClick={() => markOutOfScope(signal)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors"
                title="Ο πελάτης δεν ενδιαφέρεται - μην εμφανίσεις ξανά">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-xs text-slate-400 italic">Το X σημαίνει "εκτός εύρους" — δεν θα εμφανιστεί ξανά</div>
          </div>
        )}
      </div>
    );
  };

  const renderWeakCard = (signal: WeakSignal) => {
    const key = `weak__${signal.category_code}`;
    const isExpanded = expandedCard === key;
    const isDismissed = signal.status === 'dismissed';
    if (isDismissed) return null;

    return (
      <div key={key} className="rounded-xl border border-amber-100 bg-white overflow-hidden">
        <button onClick={() => setExpandedCard(isExpanded ? null : key)}
          className="w-full px-4 py-3 flex items-start justify-between text-left hover:bg-amber-50 transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">{signal.ratio_pct}% του μέσου όρου</span>
              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">L{signal.category_level}</span>
            </div>
            <div className="font-semibold text-slate-800 text-sm">{signal.category_name}</div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span>{fmtEur(signal.curr_revenue)} vs μέσος {fmtEur(signal.peer_avg_revenue)}</span>
              <span className="text-amber-600 font-medium">gap {fmtEur(signal.gap_revenue)}</span>
            </div>
          </div>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />}
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-amber-50 space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-amber-50 rounded-lg p-2">
                <div className="text-slate-400 mb-0.5">Τρέχων τζίρος</div>
                <div className="font-bold text-amber-700">{fmtEur(signal.curr_revenue)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-slate-400 mb-0.5">Μέσος ομότιμων</div>
                <div className="font-bold text-slate-700">{fmtEur(signal.peer_avg_revenue)}</div>
              </div>
            </div>
            <div className="text-xs bg-amber-50 rounded-lg px-3 py-2 text-amber-700">
              Δυνητική ανάπτυξη: <span className="font-bold">{fmtEur(signal.gap_revenue)}</span> για να φτάσει τον μέσο όρο ομότιμων
            </div>
            <textarea
              rows={2}
              value={notes[key] ?? signal.notes ?? ''}
              onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))}
              placeholder="Σημειώσεις..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-400 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => saveOpportunity('weak', signal, 'discussed', notes[key])}
                disabled={saving[key]}
                className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors">
                {saving[key] ? '...' : '✓ Συζητήθηκε'}
              </button>
              <button
                onClick={() => saveOpportunity('weak', signal, 'dismissed')}
                disabled={saving[key]}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors">
                Απόρριψη
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="bg-white rounded-xl shadow overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold">Category Intelligence</h2>
            {totalSignals > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">{totalSignals}</span>
            )}
          </div>
          <button
  onClick={() => { console.log('clicked'); loadSimilar(); }}
  style={{ background: 'purple', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '12px' }}
>
  <Users className="w-3.5 h-3.5 inline mr-1" />
  {similarLoading ? '...' : `${data.similar_customers.count} ομότιμοι`}
</button>
        </div>
        <div className="text-xs text-slate-400 mt-1">{salesPeriod.label} vs {salesPeriod.prevLabel}</div>
      </div>

      {totalSignals === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm italic">
          {data.similar_customers.count === 0
            ? 'Δεν βρέθηκαν ομότιμοι πελάτες για σύγκριση'
            : 'Δεν εντοπίστηκαν ευκαιρίες για αυτή την περίοδο'}
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.key ? `border-current ${tab.color}` : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}>
                {tab.key === 'declining' && <TrendingDown className="w-3.5 h-3.5" />}
                {tab.key === 'missing' && <AlertCircle className="w-3.5 h-3.5" />}
                {tab.key === 'weak' && <BarChart2 className="w-3.5 h-3.5" />}
                {tab.label}
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-white text-xs font-bold ${
                    tab.key === 'declining' ? 'bg-red-500' : tab.key === 'missing' ? 'bg-purple-500' : 'bg-amber-500'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Cards */}
          <div className="px-4 py-4 space-y-3">
            {activeTab === 'declining' && (
              data.declining.length === 0
                ? <div className="text-sm text-slate-400 italic text-center py-4">Δεν υπάρχουν πτωτικές κατηγορίες</div>
                : data.declining.map(renderDecliningCard)
            )}
            {activeTab === 'missing' && (
              data.missing.length === 0
                ? <div className="text-sm text-slate-400 italic text-center py-4">Δεν υπάρχουν απούσες κατηγορίες</div>
                : data.missing.map(renderMissingCard)
            )}
            {activeTab === 'weak' && (
              data.weak.length === 0
                ? <div className="text-sm text-slate-400 italic text-center py-4">Δεν υπάρχουν αδύναμες κατηγορίες</div>
                : data.weak.map(renderWeakCard)
            )}
          </div>

          {/* Out of scope panel */}
          {outOfScopeList.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-3">
              <button onClick={() => setShowOutOfScope(v => !v)}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" />
                Εκτός εύρους ({outOfScopeList.length})
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOutOfScope ? 'rotate-180' : ''}`} />
              </button>
              {showOutOfScope && (
                <div className="mt-3 space-y-2">
                  {outOfScopeList.map(s => (
                    <div key={s.category_code} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                      <span className="text-xs text-slate-600">{s.category_name ?? s.category_code}</span>
                      <button
                        onClick={() => revertOutOfScope(s.category_code)}
                        className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                        <RotateCcw className="w-3 h-3" />
                        Επαναφορά
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {showSimilar && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
        onClick={() => setShowSimilar(false)}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Ομότιμοι Πελάτες</h3>
              <div className="text-xs text-slate-400 mt-0.5">{similarCustomers.length} πελάτες με παρόμοιο προφίλ αγορών</div>
            </div>
            <button onClick={() => setShowSimilar(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
            {similarCustomers.map(c => (
              <div key={c.code} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{c.name}</div>
                  <div className="text-xs text-slate-400">{c.city}{c.area ? `, ${c.area}` : ''}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Ομοιότητα L1/L2</div>
                    <div className="text-xs font-semibold text-purple-600">{c.l1_overlap}% / {c.l2_overlap}%</div>
                  </div>
                  {c.revenue > 0 && (
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Τζίρος</div>
                      <div className="text-xs font-semibold text-slate-700">€{c.revenue.toLocaleString('el-GR')}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
    </section>
  );
}