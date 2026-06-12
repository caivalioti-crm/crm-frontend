import { useState, useEffect, useMemo } from 'react';
import { TrendingDown, AlertCircle, BarChart2, ChevronDown, ChevronRight, X, RotateCcw, Lightbulb, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const BUSINESS_TYPE_DISPLAY: Record<string, string> = {
  general_parts: 'Γενικά ανταλλ.', used_japanese: 'Μεταχ. JAP',
  used_european: 'Μεταχ. EUR',    used_american: 'Μεταχ. USA',
  bosch_service: 'Bosch Service', body_shop: 'Φανοποιείο',
  electrician: 'Ηλεκτρολόγος',   dealership: 'Αντιπροσωπεία',
  tire_shop: 'Ελαστικά',          truck_specialist: 'Trucks',
  mixed: 'Μικτό',
};

const BASE_URL = import.meta.env.VITE_API_URL

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
  const [similarCount, setSimilarCount] = useState<number | null>(null);
  const [primaryBrands, setPrimaryBrands] = useState<string[]>([]);
  const [brandCoveredCategories, setBrandCoveredCategories] = useState<Set<string>>(new Set());
  const [selectedSimilarCodes, setSelectedSimilarCodes] = useState<string[]>([]);
  const [filterByBrands, setFilterByBrands] = useState(true);
  const [expandedSignalCode, setExpandedSignalCode] = useState<string | null>(null);
  const [peerSkus, setPeerSkus] = useState<Record<string, any[]>>({});
  const [peerSkuLoading, setPeerSkuLoading] = useState<Record<string, boolean>>({});
  const [filterBySelected, setFilterBySelected] = useState(false);
  const [l2NameMap, setL2NameMap] = useState<Map<string, string>>(new Map());

  const loadSimilar = async () => {
    setSimilarLoading(true);
    try {
      // Build LOCAL map (React state update won't reflect in same closure)
      let localL2Map = l2NameMap;
      if (localL2Map.size === 0) {
        const { data: l2n } = await supabase
          .from('crm_category_master')
          .select('category_code, short_name, full_name')
          .eq('level', 2);
        if (l2n?.length) {
          localL2Map = new Map(l2n.map((n: any) => [
            n.category_code,
            n.short_name ?? n.full_name?.split('/')[0].trim() ?? n.category_code,
          ]));
          setL2NameMap(localL2Map);
        }
      }
      const resolveName = (code: string) => localL2Map.get(code) ?? code;

      if (similarCustomers.length > 0) { setShowSimilar(true); return; }

      const { data: rpcData } = await supabase.rpc('get_similar_customers_v2', {
        p_customer_code: customerCode,
        p_limit: 50,
      });
      if (!rpcData?.length) { setSimilarCustomers([]); setShowSimilar(true); return; }

      const codes = rpcData.map((r: any) => r.similar_code);
      const { data: custData } = await supabase
        .from('vw_crm_customers')
        .select('code, name, city, area')
        .in('code', codes);
      const custMap = new Map((custData ?? []).map((c: any) => [c.code, c]));

      setSimilarCustomers(rpcData.map((r: any) => ({
        ...r,
        name: custMap.get(r.similar_code)?.name ?? r.similar_code,
        city: custMap.get(r.similar_code)?.city ?? '',
        area: custMap.get(r.similar_code)?.area ?? '',
        shared_l2_names: (r.shared_l2_codes ?? []).map(resolveName),
        peer_only_l2_names: (r.peer_only_l2_codes ?? []).map(resolveName),
      })));
      setShowSimilar(true);
    } catch (e) { console.error(e); }
    finally { setSimilarLoading(false); }
  };

  useEffect(() => {
    const fetchBrandData = async () => {
      const { data: bp } = await supabase
        .from('mv_customer_brand_profile')
        .select('brand, brand_share_pct')
        .eq('customer_code', customerCode)
        .gte('brand_share_pct', 10)
        .order('brand_share_pct', { ascending: false });
      const brands = (bp ?? []).map((b: any) => b.brand);
      setPrimaryBrands(brands);
      if (brands.length > 0) {
        const { data: cov } = await supabase
          .from('mv_category_brand_coverage')
          .select('category_code')
          .in('brand', brands);
        setBrandCoveredCategories(new Set((cov ?? []).map((c: any) => c.category_code)));
      }
    };
    fetchBrandData();
  }, [customerCode]);

  // Fetch L2 names on mount so similar customer cards always have them
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('crm_category_master')
        .select('category_code, short_name, full_name')
        .eq('level', 2);
      if (data?.length) {
        setL2NameMap(new Map(data.map((n: any) => [
          n.category_code,
          n.short_name ?? n.full_name?.split('/')[0].trim() ?? n.category_code,
        ])));
      }
    })();
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      authedFetch(
        `/api/customers/${customerCode}/category-intelligence?from=${salesPeriod.dateFrom}&to=${salesPeriod.dateTo}&prevFrom=${salesPeriod.prevDateFrom}&prevTo=${salesPeriod.prevDateTo}`
      ),
      authedFetch(`/api/customers/${customerCode}/category-scope`),
      supabase.rpc('get_similar_count', { p_customer_code: customerCode }),
    ])
      .then(([intel, scope, countResult]) => {
        setData(intel);
        setOutOfScopeList(scope ?? []);
        setSimilarCount((countResult as any)?.data ?? null);
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

  const hasBrandCoverage = (code: string): boolean => {
    if (brandCoveredCategories.size === 0 || primaryBrands.length === 0) return true;
    if (brandCoveredCategories.has(code)) return true;
    const parts = code.split('.');
    if (parts.length > 1 && brandCoveredCategories.has(parts[0])) return true;
    if (parts.length > 2 && brandCoveredCategories.has(`${parts[0]}.${parts[1]}`)) return true;
    return false;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedCustomerL2Codes = useMemo(() => {
    const codes = new Set<string>();
    similarCustomers.filter(c => selectedSimilarCodes.includes(c.similar_code))
      .forEach(c => {
        (c.shared_l2_codes ?? []).forEach((x: string) => codes.add(x));
        (c.peer_only_l2_codes ?? []).forEach((x: string) => codes.add(x));
      });
    return codes;
  }, [selectedSimilarCodes, similarCustomers]);

  const isSignalRelevant = (signal: Signal, type: 'missing' | 'weak'): boolean => {
    if (filterByBrands && primaryBrands.length > 0 && !hasBrandCoverage(signal.category_code)) return false;
    if (filterBySelected && selectedSimilarCodes.length > 0 && type === 'missing') {
      const code = signal.category_code;
      const l1 = code.split('.')[0];
      // L1 signal matches if any peer L2 code falls under that L1
      const isRelevant = [...selectedCustomerL2Codes].some(l2code =>
        l2code === code || l2code.startsWith(l1 + '.')
      );
      if (!isRelevant) return false;
    }
    return true;
  };

  const loadPeerSkus = async (categoryCode: string) => {
    if (peerSkus[categoryCode]?.length > 0 || peerSkuLoading[categoryCode]) return;
    setPeerSkuLoading(prev => ({ ...prev, [categoryCode]: true }));
    try {
      let peerCodes = similarCustomers.map((c: any) => c.similar_code);
      if (peerCodes.length === 0) {
        const { data: rpcData } = await supabase.rpc('get_similar_customers_v2', {
          p_customer_code: customerCode, p_limit: 30,
        });
        peerCodes = (rpcData ?? []).map((r: any) => r.similar_code);
      }
      if (peerCodes.length === 0) { setPeerSkus(prev => ({ ...prev, [categoryCode]: [] })); return; }
      const { data } = await supabase.rpc('get_peer_category_skus', {
        p_category_code: categoryCode,
        p_peer_codes: peerCodes.slice(0, 30),
        p_limit: 8,
      });
      setPeerSkus(prev => ({ ...prev, [categoryCode]: data ?? [] }));
    } catch (e) { console.error(e); }
    finally { setPeerSkuLoading(prev => ({ ...prev, [categoryCode]: false })); }
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


  
const visibleDeclining = data.declining.filter(s => s.status !== 'dismissed');
  const visibleMissing = data.missing.filter(s => s.status !== 'dismissed' && isSignalRelevant(s, 'missing'));
  const visibleWeak = data.weak.filter(s => s.status !== 'dismissed' && isSignalRelevant(s, 'weak'));
  const totalSignals = visibleDeclining.length + visibleMissing.length + visibleWeak.length;

  const tabs: { key: TabType; label: string; count: number; color: string }[] = [
    { key: 'declining', label: 'Πτωτικές', count: visibleDeclining.length, color: 'text-red-600' },
    { key: 'missing', label: 'Απούσες', count: visibleMissing.length, color: 'text-purple-600' },
    { key: 'weak', label: 'Αδύναμες', count: visibleWeak.length, color: 'text-amber-600' },
  ];

  

  const renderDecliningCard = (signal: DecliningSignal) => {
    const key = `declining__${signal.category_code}`;
    const isExpanded = expandedCard === key;
    const isDismissed = signal.status === 'dismissed';
    const isDiscussed = signal.status === 'discussed';
    if (isDismissed) return null;

    return (
      <div key={key} className="rounded-xl border border-red-100 bg-white overflow-hidden">
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
    if (!isSignalRelevant(signal, 'missing')) return null;

    const skuKey = signal.category_code;
    const isSkuExpanded = expandedSignalCode === skuKey;

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
            {/* Peer SKUs */}
            <div className="border border-purple-100 rounded-lg overflow-hidden">
              <button
                onClick={() => { const n = isSkuExpanded ? null : skuKey; setExpandedSignalCode(n); if (n) loadPeerSkus(n); }}
                className="w-full flex items-center justify-between px-3 py-2 bg-purple-50 hover:bg-purple-100 text-xs text-purple-700 font-medium transition-colors">
                <span className="flex items-center gap-1.5"><BarChart2 className="w-3.5 h-3.5" />Top SKUs ομότιμων</span>
                {isSkuExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {isSkuExpanded && (
                <div className="px-3 py-2 space-y-1.5 bg-white">
                  {peerSkuLoading[skuKey] ? (
                    <div className="text-xs text-slate-400 text-center py-2">Φόρτωση...</div>
                  ) : (peerSkus[skuKey] ?? []).length === 0 ? (
                    <div className="text-xs text-slate-400 italic text-center py-2">Δεν βρέθηκαν SKUs</div>
                  ) : (peerSkus[skuKey] ?? []).map((sku: any) => (
                    <div key={sku.sku_code} className="flex items-center gap-2 py-1.5 px-2 bg-purple-50 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono text-slate-500 leading-none">{sku.sku_code}</div>
                        <div className="text-xs text-slate-700 truncate mt-0.5">{sku.sku_name}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-purple-700">{fmtEur(sku.total_revenue)}</div>
                        <div className="text-xs text-slate-400">{sku.buyer_count} πελ.</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
    if (!isSignalRelevant(signal, 'weak')) return null;

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

        {isExpanded && (() => {
          const skuKey = signal.category_code;
          const isSkuExpanded = expandedSignalCode === skuKey;
          return (
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
            {/* Peer SKUs */}
            <div className="border border-amber-100 rounded-lg overflow-hidden">
              <button
                onClick={() => { const n = isSkuExpanded ? null : skuKey; setExpandedSignalCode(n); if (n) loadPeerSkus(n); }}
                className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 hover:bg-amber-100 text-xs text-amber-700 font-medium transition-colors">
                <span className="flex items-center gap-1.5"><BarChart2 className="w-3.5 h-3.5" />Top SKUs ομότιμων</span>
                {isSkuExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {isSkuExpanded && (
                <div className="px-3 py-2 space-y-1.5 bg-white">
                  {peerSkuLoading[skuKey] ? (
                    <div className="text-xs text-slate-400 text-center py-2">Φόρτωση...</div>
                  ) : (peerSkus[skuKey] ?? []).length === 0 ? (
                    <div className="text-xs text-slate-400 italic text-center py-2">Δεν βρέθηκαν SKUs</div>
                  ) : (peerSkus[skuKey] ?? []).map((sku: any) => (
                    <div key={sku.sku_code} className="flex items-center gap-2 py-1.5 px-2 bg-amber-50 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono text-slate-500 leading-none">{sku.sku_code}</div>
                        <div className="text-xs text-slate-700 truncate mt-0.5">{sku.sku_name}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-amber-700">{fmtEur(sku.total_revenue)}</div>
                        <div className="text-xs text-slate-400">{sku.buyer_count} πελ.</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
          );
        })()}
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
          <button onClick={loadSimilar}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors">
            <Users className="w-3.5 h-3.5" />
            {similarLoading ? '...' : `${similarCount ?? data.similar_customers.count} ομότιμοι`}
          </button>
        </div>
        <div className="text-xs text-slate-400 mt-1">{salesPeriod.label} vs {salesPeriod.prevLabel}</div>
      </div>

      {(primaryBrands.length > 0 || selectedSimilarCodes.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50">
          {primaryBrands.length > 0 && (
            <button onClick={() => setFilterByBrands(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterByBrands ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-slate-500 border-slate-200'
              }`}>
              🎯 Φίλτρο μαρκών
              {filterByBrands && <span className="opacity-70">({primaryBrands.slice(0,2).join(', ')}{primaryBrands.length > 2 ? '+' : ''})</span>}
            </button>
          )}
          {selectedSimilarCodes.length > 0 && (
            <button onClick={() => setFilterBySelected(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterBySelected ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-white text-slate-500 border-slate-200'
              }`}>
              👥 {selectedSimilarCodes.length} επιλεγμένοι ομότιμοι
            </button>
          )}
        </div>
      )}

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
              <div className="text-xs text-slate-400 mt-0.5">
                Κορυφαίοι {similarCustomers.length} από {similarCount ?? similarCustomers.length} ομότιμους
              </div>
            </div>
            <button onClick={() => setShowSimilar(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
        {similarCustomers.map(c => {
            const isSelected = selectedSimilarCodes.includes(c.similar_code);
            return (
              <div key={c.similar_code}
                className={`px-4 py-3 space-y-2 border-b border-slate-50 last:border-0 transition-colors ${isSelected ? 'bg-purple-50' : ''}`}>
                <div className="flex items-start gap-2">
                  {/* Selection checkbox */}
                  <button
                    onClick={() => {
                      setSelectedSimilarCodes(prev => {
                        const next = isSelected
                          ? prev.filter(x => x !== c.similar_code)
                          : prev.length < 10 ? [...prev, c.similar_code] : prev;
                        if (next.length > 0) setFilterBySelected(true);
                        if (next.length === 0) setFilterBySelected(false);
                        return next;
                      });
                    }}
                    className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300 hover:border-purple-400'
                    }`}>
                    {isSelected && <span className="text-white text-xs leading-none">✓</span>}
                  </button>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-slate-800">{c.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                            c.match_quality === 'full' ? 'bg-green-100 text-green-700' :
                            c.match_quality === 'partial' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {c.match_quality === 'full' ? '✦ Πλήρες' : c.match_quality === 'partial' ? '◈ Μερικό' : '○ Βασικό'}
                          </span>
                          {c.shop_type && (
                            <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full shrink-0">
                              {BUSINESS_TYPE_DISPLAY[c.shop_type] ?? c.shop_type}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">{c.city}{c.area ? `, ${c.area}` : ''}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-bold text-indigo-600">{Math.round(c.total_score * 100)}%</div>
                      </div>
                    </div>

                    {/* Scores */}
                    <div className="flex gap-1 text-xs">
                      <div className="flex-1 bg-purple-50 rounded px-1.5 py-1 text-center">
                        <div className="font-bold text-purple-600">{Math.round(c.category_score * 100)}%</div>
                        <div className="text-purple-400">κατηγ.</div>
                      </div>
                      {c.brand_score > 0 && (
                        <div className="flex-1 bg-orange-50 rounded px-1.5 py-1 text-center">
                          <div className="font-bold text-orange-600">{Math.round(c.brand_score * 100)}%</div>
                          <div className="text-orange-400">μάρκες</div>
                        </div>
                      )}
                      {c.type_score !== 0.5 && (
                        <div className={`flex-1 rounded px-1.5 py-1 text-center ${c.type_score >= 1 ? 'bg-green-50' : 'bg-red-50'}`}>
                          <div className={`font-bold ${c.type_score >= 1 ? 'text-green-600' : 'text-red-400'}`}>{c.type_score >= 1 ? '✓' : '✗'}</div>
                          <div className="text-slate-400">τύπος</div>
                        </div>
                      )}
                    </div>

                    {/* Shared brands */}
                    {c.shared_brands?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.shared_brands.slice(0, 5).map((b: string) => (
                          <span key={b} className="px-1.5 py-0.5 bg-orange-50 border border-orange-200 text-orange-700 rounded text-xs font-medium">{b}</span>
                        ))}
                        {c.shared_brands.length > 5 && <span className="text-xs text-slate-400 self-center">+{c.shared_brands.length - 5}</span>}
                      </div>
                    )}

                    {/* Shared L2 categories */}
                    {c.shared_l2_codes?.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-xs text-slate-400">κοινά:</span>
                        {(c.shared_l2_names ?? c.shared_l2_codes).slice(0, 4).map((name: string, i: number) => (
                          <span key={i} title={name} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded text-xs">
                            {name.length > 12 ? name.slice(0, 11) + '…' : name}
                          </span>
                        ))}
                        {c.shared_l2_codes.length > 4 && <span className="text-xs text-slate-400">+{c.shared_l2_codes.length - 4}</span>}
                      </div>
                    )}

                    {/* Peer-only L2 */}
                    {c.peer_only_l2_codes?.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-xs text-slate-400">έχει κι αυτός:</span>
                        {(c.peer_only_l2_names ?? c.peer_only_l2_codes).slice(0, 3).map((name: string, i: number) => (
                          <span key={i} title={name} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-xs">
                            {name.length > 12 ? name.slice(0, 11) + '…' : name}
                          </span>
                        ))}
                        {c.peer_only_l2_codes.length > 3 && <span className="text-xs text-slate-400">+{c.peer_only_l2_codes.length - 3}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    )}
    </section>
  );
}