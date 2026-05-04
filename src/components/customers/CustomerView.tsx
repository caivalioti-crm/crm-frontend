import {
  ArrowLeft, Info, Building2, Truck, Plus, Calendar, ShoppingCart,
  Lightbulb, Users, Swords, Store, FileText, Tag, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, BarChart2, Medal, AlertCircle, Receipt,
} from 'lucide-react';

import { formatDate } from '../../utils/dateFormat';
import { NewVisitDialog } from '../visits/NewVisitDialog';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { CommercialEntityBase } from '../../types/commercialEntity';

const BASE_URL = 'http://localhost:3001';

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

export interface CustomerViewProps {
  customer: CommercialEntityBase & {
    code: string; name: string; nameGreek?: string;
    city?: string; area?: string; type?: string; group?: string;
    address?: string; phone?: string; mobile?: string; email?: string;
    contactName?: string; vatNumber?: string; createdDate?: string;
    lastVisitDate?: string; transportCompany?: string; transportMeans?: string;
    overallDiscount?: number; afm?: string; fax?: string; zip?: string;
    shipmentName?: string; carrierName?: string;
  };
  onBack: () => void;
}

const SHOP_TYPE_LABELS: Record<string, string> = {
  auto_parts_retailer: 'Ανταλλακτικά', garage: 'Γκαράζ', body_shop: 'Φανοποιείο',
  dealership: 'Αντιπροσωπεία', truck_parts: 'Φορτηγά', other: 'Άλλο',
};

const STOCK_BEHAVIOR_LABELS: Record<string, string> = {
  keeps_stock: 'Τηρεί Απόθεμα', on_demand: "Παραγγελία κατ'ανάγκη", mixed: 'Μικτό',
};

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  order:   { label: 'Παραγγελία', bg: 'bg-blue-100',  text: 'text-blue-700',  icon: ShoppingCart },
  invoice: { label: 'Τιμολόγιο',  bg: 'bg-green-100', text: 'text-green-700', icon: Receipt },
  credit:  { label: 'Πίστωση',    bg: 'bg-red-100',   text: 'text-red-700',   icon: Tag },
};

const DOC_PERIODS = [
  { label: '2026 YTD', from: '2026-01-01', to: '2026-12-31' },
  { label: '2025',     from: '2025-01-01', to: '2025-12-31' },
  { label: '2024',     from: '2024-01-01', to: '2024-12-31' },
  { label: 'Όλα',      from: '2022-01-01', to: '2026-12-31' },
];

const _now = new Date();
const _curYearMonth = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;
const _curMonthLabel = _now.toLocaleString('el-GR', { month: 'short' });

const SALES_PERIODS = [
  { label: 'Q1 2026',   from: '2026-01', to: '2026-03', prevFrom: '2025-01', prevTo: '2025-03', prevLabel: 'Q1 2025', dateFrom: '2026-01-01', dateTo: '2026-03-31', prevDateFrom: '2025-01-01', prevDateTo: '2025-03-31' },
  { label: 'Q2 2026',   from: '2026-04', to: '2026-06', prevFrom: '2025-04', prevTo: '2025-06', prevLabel: 'Q2 2025', dateFrom: '2026-04-01', dateTo: '2026-06-30', prevDateFrom: '2025-04-01', prevDateTo: '2025-06-30' },
  { label: `2026 YTD (έως ${_curMonthLabel})`, from: '2026-01', to: _curYearMonth, prevFrom: '2025-01', prevTo: `2025-${String(_now.getMonth() + 1).padStart(2, '0')}`, prevLabel: `Ιαν–${_curMonthLabel} 2025`, dateFrom: '2026-01-01', dateTo: `${_curYearMonth}-31`, prevDateFrom: '2025-01-01', prevDateTo: `2025-${String(_now.getMonth() + 1).padStart(2, '0')}-31` },
  { label: '2025 Full', from: '2025-01', to: '2025-12', prevFrom: '2024-01', prevTo: '2024-12', prevLabel: '2024',    dateFrom: '2025-01-01', dateTo: '2025-12-31', prevDateFrom: '2024-01-01', prevDateTo: '2024-12-31' },
  { label: 'Q4 2025',   from: '2025-10', to: '2025-12', prevFrom: '2024-10', prevTo: '2024-12', prevLabel: 'Q4 2024', dateFrom: '2025-10-01', dateTo: '2025-12-31', prevDateFrom: '2024-10-01', prevDateTo: '2024-12-31' },
  { label: 'Q3 2025',   from: '2025-07', to: '2025-09', prevFrom: '2024-07', prevTo: '2024-09', prevLabel: 'Q3 2024', dateFrom: '2025-07-01', dateTo: '2025-09-30', prevDateFrom: '2024-07-01', prevDateTo: '2024-09-30' },
  { label: 'Q2 2025',   from: '2025-04', to: '2025-06', prevFrom: '2024-04', prevTo: '2024-06', prevLabel: 'Q2 2024', dateFrom: '2025-04-01', dateTo: '2025-06-30', prevDateFrom: '2024-04-01', prevDateTo: '2024-06-30' },
  { label: 'Q1 2025',   from: '2025-01', to: '2025-03', prevFrom: '2024-01', prevTo: '2024-03', prevLabel: 'Q1 2024', dateFrom: '2025-01-01', dateTo: '2025-03-31', prevDateFrom: '2024-01-01', prevDateTo: '2024-03-31' },
];

function sumPeriod(sales: any[], fromMonth: string, toMonth: string): number {
  return sales.filter(s => s.month >= fromMonth && s.month <= toMonth).reduce((sum, s) => sum + (s.netamnt ?? 0), 0);
}

function fmtEur(n: number): string {
  return '€' + Math.round(n).toLocaleString('el-GR');
}

function GrowthBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

function RankCard({ title, rank, total, percentile, revenue }: {
  title: string; rank: number | null; total: number | null;
  percentile: number | null; revenue: number | null;
}) {
  if (!rank || !total) return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex-1">
      <div className="text-xs text-slate-400 font-medium mb-1">{title}</div>
      <div className="text-xs text-slate-400 italic">Δεν βρέθηκαν δεδομένα</div>
    </div>
  );
  const isTop10 = rank <= 10;
  const topPct = percentile ? Math.round(percentile) : null;
  return (
    <div className={`rounded-lg p-3 border flex-1 ${isTop10 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
      <div className={`text-xs font-medium mb-1 ${isTop10 ? 'text-amber-600' : 'text-slate-400'}`}>{title}</div>
      <div className="flex items-baseline gap-1">
        {isTop10 && <Medal className="w-4 h-4 text-amber-500 shrink-0" />}
        <span className={`text-lg font-bold ${isTop10 ? 'text-amber-700' : 'text-slate-700'}`}>#{rank}</span>
        <span className="text-xs text-slate-400">/ {total}</span>
      </div>
      {!isTop10 && topPct !== null && <div className="text-xs text-slate-500 mt-0.5">Top {topPct}%</div>}
      {revenue !== null && <div className="text-xs text-slate-400 mt-1">{fmtEur(revenue)}</div>}
    </div>
  );
}

type CatFilterType = 'all' | '0' | '1' | '2' | '3+';
const CAT_FILTER_LABELS: { key: CatFilterType; label: string }[] = [
  { key: 'all', label: 'Όλες' }, { key: '0', label: 'Δεν συζητήθηκε' },
  { key: '1', label: '1 φορά' }, { key: '2', label: '2×' }, { key: '3+', label: '3+ φορές' },
];

function getDiscussionBadgeStyle(n: number): string {
  if (n === 0) return 'bg-slate-100 text-slate-400';
  if (n === 1) return 'bg-indigo-100 text-indigo-600';
  if (n === 2) return 'bg-purple-100 text-purple-700';
  return 'bg-purple-600 text-white';
}

function getL1Code(cat: any): string { return cat.category_code.split('.')[0]; }
function getL1Label(l1Code: string, items: any[]): string {
  const l1Item = items.find(i => i.level === 1 && i.category_code === l1Code);
  return l1Item ? l1Item.full_name : `Κατηγορία ${l1Code}`;
}

export function CustomerView({ customer, onBack }: CustomerViewProps) {
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  const [visitsRefreshKey, setVisitsRefreshKey] = useState(0);
  const [visits, setVisits] = useState<any[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesPeriodIdx, setSalesPeriodIdx] = useState(0);
  const [salesByCategory, setSalesByCategory] = useState<any[]>([]);
  const [salesByCategoryLoading, setSalesByCategoryLoading] = useState(true);
  const [balance, setBalance] = useState<{ balance: number; entries: any[] } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const [expandedL1s, setExpandedL1s] = useState<Set<string>>(new Set());
  const [expandedL2s, setExpandedL2s] = useState<Set<string>>(new Set());
  const [expandedL3s, setExpandedL3s] = useState<Set<string>>(new Set());
  const [skuData, setSkuData] = useState<Record<string, any[]>>({});
  const [skuLoading, setSkuLoading] = useState<Set<string>>(new Set());
  const [rankData, setRankData] = useState<Record<string, any>>({});
  const [rankLoading, setRankLoading] = useState<Set<string>>(new Set());
  const [topCustData, setTopCustData] = useState<Record<string, any[]>>({});
  const [topCustLoading, setTopCustLoading] = useState<Set<string>>(new Set());

  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docPeriodIdx, setDocPeriodIdx] = useState(0);
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'order' | 'invoice' | 'credit'>('all');
  const [docsExpanded, setDocsExpanded] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<number | null>(null);
  const [docLines, setDocLines] = useState<Record<number, any[]>>({});
  const [docLinesLoading, setDocLinesLoading] = useState<Set<number>>(new Set());

  const [competitorInfo, setCompetitorInfo] = useState<any>(null);
  const [shopProfile, setShopProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<CatFilterType>('all');
  const [expandedDiscL1s, setExpandedDiscL1s] = useState<Set<string>>(new Set());
  const [categoryMaster, setCategoryMaster] = useState<Map<string, string>>(new Map());

  const docsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    authedFetch('/api/categories')
      .then((data: any[]) => {
        const map = new Map<string, string>();
        if (Array.isArray(data)) data.forEach(c => { if (c.category_code) map.set(String(c.category_code), c.full_name ?? c.short_name ?? c.category_code); });
        setCategoryMaster(map);
      }).catch(console.error);
  }, []);

  useEffect(() => {
    authedFetch(`/api/customers/${customer.code}/categories`)
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(console.error).finally(() => setCategoriesLoading(false));
  }, [customer.code, visitsRefreshKey]);

  useEffect(() => {
    authedFetch(`/api/visits?customer_code=${customer.code}`)
      .then(data => setVisits(Array.isArray(data) ? data : []))
      .catch(console.error).finally(() => setVisitsLoading(false));
  }, [customer.code, visitsRefreshKey]);

  useEffect(() => {
    setSalesLoading(true);
    authedFetch(`/api/erp/customers/${customer.code}/sales?from=2023-01-01&to=2026-12-31`)
      .then(data => setSales(Array.isArray(data) ? data : []))
      .catch(console.error).finally(() => setSalesLoading(false));
  }, [customer.code]);

  useEffect(() => {
    setSalesByCategoryLoading(true);
    setExpandedL1s(new Set()); setExpandedL2s(new Set()); setExpandedL3s(new Set());
    setSkuData({}); setRankData({});
    const { dateFrom, dateTo, prevDateFrom, prevDateTo } = SALES_PERIODS[salesPeriodIdx];
    authedFetch(`/api/erp/customers/${customer.code}/sales-by-category?from=${dateFrom}&to=${dateTo}&prevFrom=${prevDateFrom}&prevTo=${prevDateTo}`)
      .then(data => setSalesByCategory(data.grouped ?? []))
      .catch(console.error).finally(() => setSalesByCategoryLoading(false));
  }, [customer.code, salesPeriodIdx]);

  useEffect(() => {
    setDocsLoading(true);
    setDocsExpanded(false);
    setExpandedDocId(null);
    const { from, to } = DOC_PERIODS[docPeriodIdx];
    authedFetch(`/api/erp/customers/${customer.code}/documents?from=${from}&to=${to}`)
      .then(data => setDocuments(Array.isArray(data) ? data : []))
      .catch(console.error).finally(() => setDocsLoading(false));
  }, [customer.code, docPeriodIdx]);

  useEffect(() => {
    authedFetch(`/api/entity-profile/customer/${customer.code}`)
      .then(data => { setCompetitorInfo(data.competitor_info ?? null); setShopProfile(data.shop_profile ?? null); })
      .catch(console.error).finally(() => setProfileLoading(false));
  }, [customer.code]);

  useEffect(() => {
    authedFetch(`/api/erp/customers/${customer.code}/balance`)
      .then(data => setBalance(data))
      .catch(console.error).finally(() => setBalanceLoading(false));
  }, [customer.code]);

  function toggleDocExpand(findoc: number) {
    if (expandedDocId === findoc) { setExpandedDocId(null); return; }
    setExpandedDocId(findoc);
    if (!docLines[findoc] && !docLinesLoading.has(findoc)) {
      setDocLinesLoading(prev => new Set(prev).add(findoc));
      authedFetch(`/api/erp/customers/${customer.code}/documents/${findoc}/lines`)
        .then(data => setDocLines(prev => ({ ...prev, [findoc]: data })))
        .catch(console.error)
        .finally(() => setDocLinesLoading(prev => { const n = new Set(prev); n.delete(findoc); return n; }));
    }
  }

  function fetchSkus(categoryId: string) {
    if (skuData[categoryId] || skuLoading.has(categoryId)) return;
    const { dateFrom, dateTo } = SALES_PERIODS[salesPeriodIdx];
    setSkuLoading(prev => new Set(prev).add(categoryId));
    authedFetch(`/api/erp/customers/${customer.code}/skus-by-category?from=${dateFrom}&to=${dateTo}&categoryId=${categoryId}`)
      .then(data => setSkuData(prev => ({ ...prev, [categoryId]: data[categoryId] ?? [] })))
      .catch(console.error)
      .finally(() => setSkuLoading(prev => { const n = new Set(prev); n.delete(categoryId); return n; }));
  }

  function fetchRank(categoryId: string) {
    const { dateFrom, dateTo } = SALES_PERIODS[salesPeriodIdx];
    const areaKey = `${categoryId}-area`;
    const greeceKey = `${categoryId}-greece`;
    if (!rankData[areaKey] && !rankLoading.has(areaKey) && customer.area) {
      setRankLoading(prev => new Set(prev).add(areaKey));
      authedFetch(`/api/erp/customer-category-rank?from=${dateFrom}&to=${dateTo}&customerCode=${customer.code}&categoryId=${categoryId}&area=${encodeURIComponent(customer.area)}`)
        .then(data => setRankData(prev => ({ ...prev, [areaKey]: data })))
        .catch(console.error)
        .finally(() => setRankLoading(prev => { const n = new Set(prev); n.delete(areaKey); return n; }));
    }
    if (!rankData[greeceKey] && !rankLoading.has(greeceKey)) {
      setRankLoading(prev => new Set(prev).add(greeceKey));
      authedFetch(`/api/erp/customer-category-rank?from=${dateFrom}&to=${dateTo}&customerCode=${customer.code}&categoryId=${categoryId}`)
        .then(data => setRankData(prev => ({ ...prev, [greeceKey]: data })))
        .catch(console.error)
        .finally(() => setRankLoading(prev => { const n = new Set(prev); n.delete(greeceKey); return n; }));
    }
  }

  function fetchTopCust(categoryId: string) {
  if (topCustData[categoryId] || topCustLoading.has(categoryId)) return;
  const { dateFrom, dateTo, prevDateFrom, prevDateTo } = SALES_PERIODS[salesPeriodIdx];
  setTopCustLoading(prev => new Set(prev).add(categoryId));
  authedFetch(`/api/erp/top-customers-by-category?from=${dateFrom}&to=${dateTo}&prevFrom=${prevDateFrom}&prevTo=${prevDateTo}&categoryId=${categoryId}`)
    .then(data => setTopCustData(prev => ({ ...prev, [categoryId]: Array.isArray(data) ? data : [] })))
    .catch(console.error)
    .finally(() => setTopCustLoading(prev => { const n = new Set(prev); n.delete(categoryId); return n; }));
  }

  function toggleL1(code: string) { setExpandedL1s(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; }); }
  function toggleL2(code: string) { setExpandedL2s(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; }); }
  function toggleL3(code: string) { setExpandedL3s(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; }); }
  function handleExpandCategory(catIdKey: string) { fetchSkus(catIdKey); fetchRank(catIdKey); fetchTopCust(catIdKey); }

  const sp = SALES_PERIODS[salesPeriodIdx];
  const currentTotal = sumPeriod(sales, sp.from, sp.to);
  const prevTotal    = sumPeriod(sales, sp.prevFrom, sp.prevTo);
  const growthPct    = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : null;
  const isUp         = growthPct !== null && growthPct >= 0;
  const diffAbs      = currentTotal - prevTotal;

  const filteredDocs = docTypeFilter === 'all' ? documents : documents.filter(d => d.type === docTypeFilter);
  const visibleDocs  = docsExpanded ? filteredDocs : filteredDocs.slice(0, 8);
  const docCounts    = { order: documents.filter(d => d.type === 'order').length, invoice: documents.filter(d => d.type === 'invoice').length, credit: documents.filter(d => d.type === 'credit').length };
  const lastInvoice  = documents.find(d => d.type === 'invoice');
  const lastOrder    = documents.find(d => d.type === 'order');
  const totalDiscussions = categories.reduce((s, c) => s + (c.times_discussed ?? 0), 0);

  function matchesFilter(cat: any): boolean {
    const n = cat.times_discussed ?? 0;
    if (catFilter === 'all') return true;
    if (catFilter === '0') return n === 0;
    if (catFilter === '1') return n === 1;
    if (catFilter === '2') return n === 2;
    if (catFilter === '3+') return n >= 3;
    return true;
  }

  const l1Groups = (() => {
    const map = new Map<string, { l1Code: string; items: any[] }>();
    categories.forEach(cat => { const l1 = getL1Code(cat); if (!map.has(l1)) map.set(l1, { l1Code: l1, items: [] }); map.get(l1)!.items.push(cat); });
    return Array.from(map.values());
  })();

  const filteredGroups = l1Groups.map(g => ({ ...g, filtered: g.items.filter(matchesFilter) })).filter(g => g.filtered.length > 0);

  function renderCategoryExpanded(catIdKey: string) {
  const skus = skuData[catIdKey] ?? [];
  const isLoadingSkus = skuLoading.has(catIdKey);
  const areaRank = rankData[`${catIdKey}-area`];
  const greeceRank = rankData[`${catIdKey}-greece`];
  const isLoadingAreaRank = rankLoading.has(`${catIdKey}-area`);
  const isLoadingGreeceRank = rankLoading.has(`${catIdKey}-greece`);
  const topCusts = topCustData[catIdKey] ?? [];
  const isLoadingTopCust = topCustLoading.has(catIdKey);
  return (
    <div className="bg-slate-50 border-t border-slate-100">
      <div className="px-4 py-2 border-b border-slate-200">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Top SKUs</div>
        {isLoadingSkus ? <div className="text-xs text-slate-400">Φόρτωση...</div> : skus.length === 0 ? (
          <div className="text-xs text-slate-400 italic">Δεν βρέθηκαν προϊόντα</div>
        ) : (
          <div className="space-y-1">
            {skus.map((sku: any) => (
              <div key={sku.mtrl_id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono text-slate-400 shrink-0">{sku.sku_code}</span>
                  <span className="text-xs text-slate-600 truncate">{sku.sku_name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-xs text-slate-400">{Math.round(sku.qty)} τεμ.</span>
                  <span className="text-xs font-semibold text-slate-700">{fmtEur(sku.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-4 py-2 border-b border-slate-200">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Top 10 Πελάτες</div>
        {isLoadingTopCust ? <div className="text-xs text-slate-400">Φόρτωση...</div> : topCusts.length === 0 ? (
          <div className="text-xs text-slate-400 italic">Δεν βρέθηκαν πελάτες</div>
        ) : (
          <div className="space-y-1">
            {topCusts.map((c: any, i: number) => (
              <div key={c.customer_code} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs font-bold w-5 shrink-0 text-center ${i < 3 ? 'text-amber-500' : 'text-slate-400'}`}>#{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-700 truncate">{c.customer_name}</div>
                    <div className="text-xs text-slate-400">{c.city}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs text-slate-400">{Math.round(parseFloat(c.qty))} τεμ.</span>
                  <span className="text-xs font-semibold text-slate-700">{fmtEur(parseFloat(c.revenue))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="px-4 py-2">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Κατάταξη</div>
        {(isLoadingAreaRank || isLoadingGreeceRank) ? <div className="text-xs text-slate-400">Φόρτωση κατάταξης...</div> : (
          <div className="flex gap-2">
            <RankCard title={`Στην περιοχή (${customer.area ?? '—'})`} rank={areaRank?.rank ?? null} total={areaRank?.total_customers ?? null} percentile={areaRank?.percentile ?? null} revenue={areaRank?.revenue ?? null} />
            <RankCard title="Στην Ελλάδα" rank={greeceRank?.rank ?? null} total={greeceRank?.total_customers ?? null} percentile={greeceRank?.percentile ?? null} revenue={greeceRank?.revenue ?? null} />
          </div>
        )}
      </div>
    </div>
  );
}

  function renderDocLines(findoc: number, netamnt: number) {
    const lines = docLines[findoc];
    const loading = docLinesLoading.has(findoc);
    if (loading) return <div className="px-4 py-3 text-xs text-slate-400">Φόρτωση γραμμών...</div>;
    if (!lines || lines.length === 0) return <div className="px-4 py-3 text-xs text-slate-400 italic">Δεν βρέθηκαν γραμμές</div>;
    return (
      <div className="border-t border-slate-100 bg-slate-50">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400 font-medium">
              <th className="text-left px-4 py-2">Κωδ.</th>
              <th className="text-left px-4 py-2 hidden sm:table-cell">Περιγραφή</th>
              <th className="text-right px-3 py-2">Τεμ.</th>
              <th className="text-right px-4 py-2">Αξία</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line: any, i: number) => (
              <tr key={i} className="hover:bg-white transition-colors">
                <td className="px-4 py-2 font-mono text-slate-600 whitespace-nowrap">{line.sku_code}</td>
                <td className="px-4 py-2 text-slate-600 hidden sm:table-cell truncate max-w-xs">{line.sku_name}</td>
                <td className="px-3 py-2 text-right text-slate-500">{Math.round(Number(line.qty ?? 0))}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">{fmtEur(Number(line.netlineval ?? 0))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-white">
              <td colSpan={2} className="px-4 py-2 text-slate-400 text-xs hidden sm:table-cell">{lines.length} γραμμές</td>
              <td className="px-3 py-2 text-right text-xs font-medium text-slate-500">Σύνολο</td>
              <td className="px-4 py-2 text-right font-bold text-slate-800">{fmtEur(netamnt)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-2">
          {/* Top row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={onBack} className="text-white/80 hover:text-white shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="px-2 py-0.5 bg-white/20 rounded font-mono text-xs shrink-0">{customer.code}</span>
              <h1 className="text-base font-bold truncate">{customer.name}</h1>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    const el = docsRef.current;
                    if (el) {
                      const top = el.getBoundingClientRect().top + window.scrollY - 155;
                      window.scrollTo({ top, behavior: 'smooth' });
                    }
                  }}
                  title="Παραγγελίες & Τιμολόγια"
                  className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  <FileText className="w-4 h-4" />
                </button>
              <button onClick={() => setShowNewVisitDialog(true)} title="Νέα Επίσκεψη"
                className="p-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Subtitle */}
          <div className="flex items-center gap-2 flex-wrap">
            {(customer.city || customer.area) && (
              <span className="text-white/60 text-xs">{customer.city}{customer.city && customer.area ? ', ' : ''}{customer.area}</span>
            )}
            {customer.afm && <span className="text-white/40 text-xs">· ΑΦΜ {customer.afm}</span>}
            <span className="text-white/40 text-xs">· {SALES_PERIODS[salesPeriodIdx].label}</span>
            
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-4">

        {/* CUSTOMER DETAILS */}
        <section className="bg-white rounded-xl shadow p-5 border-l-4 border-indigo-500">
          <div className="flex items-center gap-2 mb-4"><Info className="w-5 h-5 text-indigo-600" /><h2 className="text-base font-semibold">Στοιχεία Πελάτη</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm text-slate-700">
            <div className="space-y-2">
              <div className="font-medium text-slate-400 text-xs uppercase tracking-wide">Επικοινωνία</div>
              {customer.address && <div className="flex items-start gap-2"><Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" /><span>{customer.address}{customer.zip ? `, ${customer.zip}` : ''}{customer.city ? `, ${customer.city}` : ''}</span></div>}
              {customer.email && <div className="flex items-center gap-2"><span>✉️</span><a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline truncate">{customer.email}</a></div>}
              {customer.fax && <div>📠 {customer.fax}</div>}
              {customer.afm && <div className="inline-block font-mono text-xs bg-slate-100 px-2 py-1 rounded">ΑΦΜ: {customer.afm}</div>}
            </div>
            <div className="space-y-2">
              <div className="font-medium text-slate-400 text-xs uppercase tracking-wide">Μεταφορά</div>
              {customer.shipmentName && <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-slate-400" /><span>{customer.shipmentName}</span></div>}
              {customer.carrierName && <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-slate-400" /><span>{customer.carrierName}</span></div>}
              {!customer.shipmentName && !customer.carrierName && <div className="text-slate-400 text-xs italic">Δεν υπάρχουν στοιχεία</div>}
            </div>
            <div className="space-y-2">
              <div className="font-medium text-slate-400 text-xs uppercase tracking-wide">Πληροφορίες</div>
              {customer.area && <div>Περιοχή: <span className="font-medium">{customer.area}</span></div>}
              {customer.lastVisitDate ? <div>Τελευταία επίσκεψη: <span className="font-medium">{formatDate(customer.lastVisitDate)}</span></div> : <div className="text-slate-400 text-xs italic">Καμία επίσκεψη ακόμα</div>}
            </div>
          </div>
        </section>

        {/* SHOP PROFILE + COMPETITOR INFO */}
        {!profileLoading && (shopProfile || competitorInfo) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {shopProfile && (
              <section className="bg-white rounded-xl shadow p-5 border-l-4 border-blue-400">
                <div className="flex items-center gap-2 mb-3"><Store className="w-5 h-5 text-blue-500" /><h2 className="text-base font-semibold">Προφίλ Καταστήματος</h2></div>
                <div className="space-y-2 text-sm text-slate-700">
                  {shopProfile.shop_type && <div className="flex justify-between"><span className="text-slate-500">Τύπος</span><span className="font-medium">{SHOP_TYPE_LABELS[shopProfile.shop_type] ?? shopProfile.shop_type}</span></div>}
                  {shopProfile.number_of_employees && <div className="flex justify-between"><span className="text-slate-500">Εργαζόμενοι</span><span className="font-medium flex items-center gap-1"><Users className="w-3.5 h-3.5" />{shopProfile.number_of_employees}</span></div>}
                  {shopProfile.shop_size_m2 && <div className="flex justify-between"><span className="text-slate-500">Εμβαδό</span><span className="font-medium">{shopProfile.shop_size_m2} m²</span></div>}
                  {shopProfile.stock_behavior && <div className="flex justify-between"><span className="text-slate-500">Απόθεμα</span><span className="font-medium">{STOCK_BEHAVIOR_LABELS[shopProfile.stock_behavior] ?? shopProfile.stock_behavior}</span></div>}
                </div>
              </section>
            )}
            {competitorInfo && (
              <section className="bg-white rounded-xl shadow p-5 border-l-4 border-orange-400">
                <div className="flex items-center gap-2 mb-3"><Swords className="w-5 h-5 text-orange-500" /><h2 className="text-base font-semibold">Ανταγωνισμός</h2></div>
                <div className="space-y-2 text-sm text-slate-700">
                  {competitorInfo.main_competitor && <div className="flex justify-between"><span className="text-slate-500">Κύριος</span><span className="font-medium">{competitorInfo.main_competitor}</span></div>}
                  {competitorInfo.other_competitors && <div className="flex justify-between"><span className="text-slate-500">Άλλοι</span><span className="font-medium">{competitorInfo.other_competitors}</span></div>}
                  {competitorInfo.estimated_monthly_spend && <div className="flex justify-between"><span className="text-slate-500">Μηνιαία Δαπάνη</span><span className="font-medium text-green-600">€{Number(competitorInfo.estimated_monthly_spend).toLocaleString('el-GR')}</span></div>}
                  {competitorInfo.competitor_strengths && <div><div className="text-slate-500 mb-1">Δυνατά σημεία</div><div className="text-xs bg-slate-50 rounded p-2">{competitorInfo.competitor_strengths}</div></div>}
                  {competitorInfo.switch_reason && <div><div className="text-slate-500 mb-1">Λόγος αλλαγής</div><div className="text-xs bg-slate-50 rounded p-2">{competitorInfo.switch_reason}</div></div>}
                </div>
              </section>
            )}
          </div>
        )}

        {/* VISITS */}
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-purple-600" /><h2 className="text-base font-semibold">Επισκέψεις</h2></div>
            {visits.length > 0 && <span className="text-xs text-slate-500">{visits.length} σύνολο</span>}
          </div>
          {visitsLoading ? <div className="text-sm text-slate-400">Φόρτωση...</div> : visits.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Καμία επίσκεψη ακόμα</div>
          ) : (
            <div className="space-y-2">
              {visits.slice(0, 5).map((v: any) => (
                <div key={v.id} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{formatDate(v.visit_date)}</div>
                    {v.notes && <div className="text-xs text-slate-500 mt-0.5">{v.notes}</div>}
                    {v.visit_type && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded mt-1 inline-block">{v.visit_type}</span>}
                  </div>
                  {v.owner_name && <span className="text-xs text-slate-400">{v.owner_name}</span>}
                </div>
              ))}
              {visits.length > 5 && <div className="text-xs text-indigo-500 pt-1">+{visits.length - 5} ακόμα επισκέψεις</div>}
            </div>
          )}
        </section>

        {/* SALES ANALYSIS */}
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <BarChart2 className="w-5 h-5 text-blue-600 shrink-0" />
              <h2 className="text-base font-semibold">Sales Analysis</h2>
              <span className="text-xs text-slate-400 whitespace-nowrap">{sp.label} vs {sp.prevLabel}</span>
            </div>
            <select value={salesPeriodIdx} onChange={e => setSalesPeriodIdx(Number(e.target.value))} className="text-xs border border-slate-300 rounded-lg px-2 py-1 text-slate-600 focus:ring-2 focus:ring-indigo-500">
              {SALES_PERIODS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
            </select>
          </div>

          {salesLoading ? <div className="text-sm text-slate-400">Φόρτωση...</div> : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                  <div className="text-xs text-indigo-500 font-medium mb-1">Τρέχουσα Περίοδος ({sp.label})</div>
                  <div className="text-2xl font-bold text-indigo-700 leading-tight">{fmtEur(currentTotal)}</div>
                  {growthPct !== null && (
                    <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${isUp ? 'text-green-600' : 'text-red-500'}`}>
                      {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {isUp ? '+' : ''}{growthPct.toFixed(1)}% vs {sp.prevLabel}
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium mb-1">Ίδια Περίοδος Πέρσι ({sp.prevLabel})</div>
                  <div className="text-2xl font-bold text-slate-600 leading-tight">{fmtEur(prevTotal)}</div>
                  {growthPct !== null && (
                    <div className={`text-xs mt-2 font-medium ${isUp ? 'text-green-600' : 'text-red-500'}`}>
                      {isUp ? '+' : ''}{fmtEur(Math.abs(diffAbs))} {isUp ? 'αύξηση' : 'μείωση'}
                    </div>
                  )}
                </div>
              </div>

              {(() => {
                const months = sales.filter(s => s.month >= sp.from && s.month <= sp.to).sort((a, b) => a.month.localeCompare(b.month));
                const prevMonthMap = new Map<string, number>();
                sales.filter(s => s.month >= sp.prevFrom && s.month <= sp.prevTo).forEach(s => prevMonthMap.set(s.month, s.netamnt));
                function toPrevMonth(curMonth: string): string {
                  const [y, m] = curMonth.split('-').map(Number);
                  const [py] = sp.prevFrom.split('-').map(Number);
                  const [cy] = sp.from.split('-').map(Number);
                  return `${py + (y - cy)}-${String(m).padStart(2, '0')}`;
                }
                if (months.length === 0) return null;
                const allAmounts = [...months.map(m => m.netamnt), ...months.map(m => prevMonthMap.get(toPrevMonth(m.month)) ?? 0)];
                const maxAmt = Math.max(...allAmounts, 1);
                return (
                  <div>
                    <div className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wide">Ανά Μήνα</div>
                    <div className="space-y-2">
                      {months.map(m => {
                        const prevKey = toPrevMonth(m.month);
                        const prevAmt = prevMonthMap.get(prevKey) ?? null;
                        const curPct  = Math.max((m.netamnt / maxAmt) * 100, 2);
                        const prevPct = prevAmt !== null ? Math.max((prevAmt / maxAmt) * 100, 2) : 0;
                        const monthLabel = new Date(m.month + '-01').toLocaleString('el-GR', { month: 'short' });
                        return (
                          <div key={m.month} className="text-xs">
                            <div className="flex items-center gap-2 mb-1 text-slate-500">
                              <span className="w-7 shrink-0 font-medium">{monthLabel}</span>
                              <span className="font-semibold text-slate-700">{fmtEur(m.netamnt)}</span>
                              {prevAmt !== null && <span className="text-slate-400">vs {fmtEur(prevAmt)}</span>}
                            </div>
                            <div className="w-full bg-slate-100 rounded-sm h-2 mb-0.5"><div className="h-2 rounded-sm bg-indigo-400 transition-all" style={{ width: `${curPct}%` }} /></div>
                            {prevAmt !== null && <div className="w-full bg-slate-100 rounded-sm h-1.5"><div className="h-1.5 rounded-sm bg-slate-300 transition-all" style={{ width: `${prevPct}%` }} /></div>}
                          </div>
                        );
                      })}
                    </div>
                    {months.length > 0 && prevMonthMap.size > 0 && (
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-indigo-400 inline-block" />{sp.label}</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-sm bg-slate-300 inline-block" />{sp.prevLabel}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SALES BY CATEGORY */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-400 font-medium mb-3 uppercase tracking-wide">Ανά Κατηγορία</div>
                {salesByCategoryLoading ? <div className="text-sm text-slate-400">Φόρτωση...</div> : salesByCategory.length === 0 ? (
                  <div className="text-sm text-slate-400 italic">Δεν βρέθηκαν κατηγορίες για αυτή την περίοδο</div>
                ) : (
                  <div className="space-y-1">
                    {salesByCategory.map(group => {
                      const isL1Exp = expandedL1s.has(group.l1_code);
                      const maxGroupRev = Math.max(...salesByCategory.map((g: any) => g.total_revenue), 1);
                      const groupBarPct = Math.max((group.total_revenue / maxGroupRev) * 100, 2);
                      const l1Name = categoryMaster.get(group.l1_code) ?? `Κατηγορία ${group.l1_code}`;
                      return (
                        <div key={group.l1_code} className="rounded-lg border border-slate-100 overflow-hidden">
                          <button onClick={() => toggleL1(group.l1_code)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${isL1Exp ? 'bg-blue-50 border-b border-blue-100' : 'bg-white hover:bg-slate-50'}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              {isL1Exp ? <ChevronDown className="w-4 h-4 text-blue-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono shrink-0">{group.l1_code}</span>
                              <span className="text-sm font-medium text-slate-700 truncate">{l1Name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <GrowthBadge pct={group.growth_pct ?? null} />
                              <span className="text-xs text-slate-400 hidden sm:block">{group.invoice_count} τιμολόγια</span>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-slate-700">{fmtEur(group.total_revenue)}</div>
                                {group.prev_revenue > 0 && <div className="text-xs text-slate-400">{fmtEur(group.prev_revenue)}</div>}
                              </div>
                            </div>
                          </button>
                          {!isL1Exp && <div className="px-3 pb-2 bg-white"><div className="w-full bg-slate-100 rounded-sm h-1.5"><div className="h-1.5 rounded-sm bg-blue-300 transition-all" style={{ width: `${groupBarPct}%` }} /></div></div>}
                          {isL1Exp && (
                            <div className="divide-y divide-slate-50">
                              {group.l2s.map((l2: any) => {
                                const l2Key = String(l2.category_code);
                                const l2IdKey = String(l2.category_id);
                                const isL2Exp = expandedL2s.has(l2Key);
                                const hasL3 = l2.l3s && l2.l3s.length > 0;
                                const l2Name = l2.full_name ?? categoryMaster.get(l2Key) ?? l2Key;
                                const maxL2Rev = Math.max(...group.l2s.map((l: any) => l.net_revenue), 1);
                                return (
                                  <div key={l2Key} className="bg-white">
                                    <button onClick={() => {
                                      toggleL2(l2Key);
                                      if (!isL2Exp) {
                                        const effectiveId = l2.category_id
                                          ? l2IdKey
                                          : l2.l3s?.[0]?.category_id ? String(l2.l3s[0].category_id) : null;
                                        if (effectiveId) handleExpandCategory(effectiveId);
                                      }
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 text-left">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-3 shrink-0" />
                                        {isL2Exp ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-mono shrink-0">{l2.short_name ?? l2Key}</span>
                                        <span className="text-sm font-medium text-slate-700 truncate">{l2Name}</span>
                                        {hasL3 && <span className="text-xs text-slate-400 shrink-0">({l2.l3s.length})</span>}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0 ml-2">
                                        <GrowthBadge pct={l2.growth_pct ?? null} />
                                        <div className="text-right">
                                          <div className="flex items-center gap-2 justify-end">
                                            <span className="text-xs text-slate-400">{Math.round(l2.total_qty)} τεμ.</span>
                                            <div className="text-sm font-semibold text-slate-700">{fmtEur(l2.net_revenue)}</div>
                                          </div>
                                          {l2.prev_qty > 0 && <div className="flex items-center gap-2 justify-end"><span className="text-xs text-slate-300">{Math.round(l2.prev_qty)} τεμ.</span><div className="text-xs text-slate-400">{fmtEur(l2.prev_revenue)}</div></div>}
                                        </div>
                                      </div>
                                    </button>
                                    <div className="px-3 pb-1 bg-white"><div className="ml-8 w-full bg-slate-100 rounded-sm h-1"><div className="h-1 rounded-sm bg-blue-200 transition-all" style={{ width: `${Math.max((l2.net_revenue / maxL2Rev) * 100, 2)}%` }} /></div></div>
                                    {isL2Exp && (
                                      <div>
                                        {(() => {
                                          const effectiveId = l2.category_id
                                            ? l2IdKey
                                            : l2.l3s?.[0]?.category_id ? String(l2.l3s[0].category_id) : null;
                                          return effectiveId ? renderCategoryExpanded(effectiveId) : null;
                                        })()}
                                        {hasL3 && (
                                          <div className="border-t border-slate-200 divide-y divide-slate-100 bg-slate-50">
                                            <div className="px-4 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide bg-white">Υποκατηγορίες</div>
                                            {l2.l3s.map((l3: any) => {
                                              const l3Key = String(l3.category_code);
                                              const l3IdKey = String(l3.category_id);
                                              const isL3Exp = expandedL3s.has(l3Key);
                                              const maxL3Rev = Math.max(...l2.l3s.map((x: any) => x.net_revenue), 1);
                                              return (
                                                <div key={l3Key} className="bg-white">
                                                  <button onClick={() => { toggleL3(l3Key); if (!isL3Exp) handleExpandCategory(l3IdKey); }}
                                                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-left">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                      <div className="w-4 shrink-0 flex justify-center"><div className="w-px h-4 bg-slate-200" /></div>
                                                      {isL3Exp ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                                                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-mono shrink-0 uppercase">{l3.short_name ?? l3Key}</span>
                                                      <span className="text-sm text-slate-700 truncate">{l3.full_name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                                      <GrowthBadge pct={l3.growth_pct ?? null} />
                                                      <div className="text-right">
                                                        <div className="flex items-center gap-2 justify-end">
                                                          <span className="text-xs text-slate-400">{Math.round(l3.total_qty)} τεμ.</span>
                                                          <div className="text-sm font-semibold text-slate-700">{fmtEur(l3.net_revenue)}</div>
                                                        </div>
                                                        {l3.prev_qty > 0 && <div className="flex items-center gap-2 justify-end"><span className="text-xs text-slate-300">{Math.round(l3.prev_qty)} τεμ.</span><div className="text-xs text-slate-400">{fmtEur(l3.prev_revenue)}</div></div>}
                                                      </div>
                                                    </div>
                                                  </button>
                                                  <div className="px-4 pb-1 bg-white"><div className="ml-10 w-full bg-slate-100 rounded-sm h-1"><div className="h-1 rounded-sm bg-indigo-300 transition-all" style={{ width: `${Math.max((l3.net_revenue / maxL3Rev) * 100, 2)}%` }} /></div></div>
                                                  {isL3Exp && renderCategoryExpanded(l3IdKey)}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* ORDERS & INVOICES */}
        <section ref={docsRef} className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-semibold">Παραγγελίες & Τιμολόγια</h2>
            </div>
            <select value={docPeriodIdx} onChange={e => setDocPeriodIdx(Number(e.target.value))} className="text-xs border border-slate-300 rounded-lg px-2 py-1 text-slate-600 focus:ring-2 focus:ring-indigo-500">
              {DOC_PERIODS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
            </select>
          </div>

          {!docsLoading && documents.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{docCounts.order} παραγγελίες</span>
              <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">{docCounts.invoice} τιμολόγια</span>
              {docCounts.credit > 0 && <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">{docCounts.credit} πιστωτικά</span>}
              {!balanceLoading && balance && (
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${balance.balance > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                  <AlertCircle className="w-3 h-3" />
                  Υπόλοιπο €{Math.abs(balance.balance).toLocaleString('el-GR', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          )}

          {!docsLoading && (lastInvoice || lastOrder) && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {lastInvoice && (
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <div className="text-xs text-green-600 font-medium mb-1">Τελευταίο Τιμολόγιο</div>
                  <div className="text-sm font-semibold text-slate-800">{lastInvoice.doc_number}</div>
                  <div className="text-xs text-slate-500">{formatDate(lastInvoice.trndate)}</div>
                  <div className="text-sm font-bold text-green-700 mt-1">€{lastInvoice.netamnt.toLocaleString('el-GR', { minimumFractionDigits: 2 })}</div>
                </div>
              )}
              {lastOrder && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="text-xs text-blue-600 font-medium mb-1">Τελευταία Παραγγελία</div>
                  <div className="text-sm font-semibold text-slate-800">{lastOrder.doc_number}</div>
                  <div className="text-xs text-slate-500">{formatDate(lastOrder.trndate)}</div>
                  <div className="text-sm font-bold text-blue-700 mt-1">€{lastOrder.netamnt.toLocaleString('el-GR', { minimumFractionDigits: 2 })}</div>
                </div>
              )}
            </div>
          )}

          {!docsLoading && documents.length > 0 && (
            <div className="flex gap-2 mb-3">
              {(['all', 'order', 'invoice', 'credit'] as const).map(t => (
                <button key={t} onClick={() => { setDocTypeFilter(t); setDocsExpanded(false); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${docTypeFilter === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}>
                  {t === 'all' ? 'Όλα' : TYPE_CONFIG[t].label}
                </button>
              ))}
            </div>
          )}

          {docsLoading ? <div className="text-sm text-slate-400">Φόρτωση...</div> : filteredDocs.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Δεν βρέθηκαν έγγραφα</div>
          ) : (
            <>
              <div className="border border-slate-100 rounded-lg overflow-hidden">
                {visibleDocs.map((doc: any) => {
                  const cfg = TYPE_CONFIG[doc.type] ?? TYPE_CONFIG.invoice;
                  const isExpanded = expandedDocId === doc.findoc;
                  const Icon = cfg.icon;
                  return (
                    <div key={doc.findoc} className="border-b border-slate-50 last:border-0">
                      <button onClick={() => toggleDocExpand(doc.findoc)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50 ${isExpanded ? 'bg-slate-50' : 'bg-white'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 ${cfg.text}`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                              <span className="font-mono text-xs text-slate-700 font-medium truncate">{doc.doc_number}</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">{formatDate(doc.trndate)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className={`text-sm font-semibold ${doc.netamnt < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                            {doc.netamnt < 0 ? '-' : ''}€{Math.abs(doc.netamnt).toLocaleString('el-GR', { minimumFractionDigits: 2 })}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {isExpanded && renderDocLines(doc.findoc, doc.netamnt)}
                    </div>
                  );
                })}
              </div>
              {filteredDocs.length > 8 && (
                <button onClick={() => setDocsExpanded(v => !v)} className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium py-2 border border-dashed border-indigo-200 rounded-lg">
                  <ChevronDown className={`w-4 h-4 transition-transform ${docsExpanded ? 'rotate-180' : ''}`} />
                  {docsExpanded ? 'Λιγότερα' : `Εμφάνιση όλων (${filteredDocs.length})`}
                </button>
              )}
            </>
          )}
        </section>

        {/* CATEGORY INTELLIGENCE */}
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2"><Lightbulb className="w-5 h-5 text-purple-600" /><h2 className="text-base font-semibold">Κατηγορίες που Συζητήθηκαν</h2></div>
            {categories.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{categories.length} κατηγορίες</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{totalDiscussions} αναφορές σύνολο</span>
              </div>
            )}
          </div>
          {categoriesLoading ? <div className="text-sm text-slate-400">Φόρτωση...</div> : categories.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Καμία κατηγορία ακόμα</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {CAT_FILTER_LABELS.map(f => (
                  <button key={f.key} onClick={() => setCatFilter(f.key)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${catFilter === f.key ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              {filteredGroups.length === 0 ? <div className="text-sm text-slate-400 italic">Δεν βρέθηκαν κατηγορίες</div> : (
                <div className="space-y-1">
                  {filteredGroups.map(group => {
                    const isExpanded = expandedDiscL1s.has(group.l1Code);
                    const totalTimes = group.items.reduce((s, c) => s + (c.times_discussed ?? 0), 0);
                    const lastDate = group.items.map(c => c.last_discussed).filter(Boolean).sort().reverse()[0] ?? null;
                    const l1Label = categoryMaster.get(group.l1Code) ?? getL1Label(group.l1Code, group.items);
                    const badgeStyle = getDiscussionBadgeStyle(totalTimes);
                    return (
                      <div key={group.l1Code} className="rounded-lg border border-slate-100 overflow-hidden">
                        <button onClick={() => setExpandedDiscL1s(prev => { const n = new Set(prev); n.has(group.l1Code) ? n.delete(group.l1Code) : n.add(group.l1Code); return n; })}
                          className={`w-full flex items-center justify-between px-3 py-3 text-left transition-colors ${isExpanded ? 'bg-indigo-50 border-b border-indigo-100' : 'bg-white hover:bg-slate-50'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-mono shrink-0">{group.l1Code}</span>
                            <span className="text-sm font-medium text-slate-700 truncate">{l1Label}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-xs text-slate-400 hidden sm:block">{group.items.length} υποκατ.</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeStyle}`}>{totalTimes}×</span>
                            {lastDate && <span className="text-xs text-slate-400">{formatDate(lastDate)}</span>}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="divide-y divide-slate-50">
                            {group.filtered.map(cat => {
                              const n = cat.times_discussed ?? 0;
                              return (
                                <div key={`${cat.category_code}-${cat.subcategory_code ?? ''}`} className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-4 shrink-0 flex justify-center"><div className="w-px h-4 bg-slate-200" /></div>
                                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-mono shrink-0 uppercase">{cat.short_name ?? cat.full_name?.slice(0, 6)}</span>
                                    <div className="min-w-0">
                                      <div className="text-sm text-slate-700 truncate">{cat.full_name}</div>
                                      {cat.subcategory_code && <div className="text-xs text-slate-400 font-mono">{cat.subcategory_code}</div>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getDiscussionBadgeStyle(n)}`}>{n}×</span>
                                    {cat.last_discussed && <span className="text-xs text-slate-400">{formatDate(cat.last_discussed)}</span>}
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
              )}
            </>
          )}
        </section>
      </main>

      <NewVisitDialog
        isOpen={showNewVisitDialog}
        onClose={() => setShowNewVisitDialog(false)}
        customers={[{ code: customer.code, name: customer.name, city: customer.city, area: customer.area }]}
        onSave={() => { setShowNewVisitDialog(false); setVisitsRefreshKey(k => k + 1); }}
      />
    </div>
  );
}
