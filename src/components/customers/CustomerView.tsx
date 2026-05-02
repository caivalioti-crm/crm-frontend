import {
  ArrowLeft,
  Info,
  Building2,
  Truck,
  Plus,
  Calendar,
  ShoppingCart,
  Lightbulb,
  Users,
  Swords,
  Store,
  FileText,
  Tag,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  BarChart2,
} from 'lucide-react';

import { formatDate } from '../../utils/dateFormat';
import { NewVisitDialog } from '../visits/NewVisitDialog';
import { useState, useEffect } from 'react';
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
    code: string;
    name: string;
    nameGreek?: string;
    city?: string;
    area?: string;
    type?: string;
    group?: string;
    address?: string;
    phone?: string;
    mobile?: string;
    email?: string;
    contactName?: string;
    vatNumber?: string;
    createdDate?: string;
    lastVisitDate?: string;
    transportCompany?: string;
    transportMeans?: string;
    overallDiscount?: number;
    afm?: string;
    fax?: string;
    zip?: string;
    shipmentName?: string;
    carrierName?: string;
  };
  onBack: () => void;
}

const SHOP_TYPE_LABELS: Record<string, string> = {
  auto_parts_retailer: 'Ανταλλακτικά',
  garage: 'Γκαράζ',
  body_shop: 'Φανοποιείο',
  dealership: 'Αντιπροσωπεία',
  truck_parts: 'Φορτηγά',
  other: 'Άλλο',
};

const STOCK_BEHAVIOR_LABELS: Record<string, string> = {
  keeps_stock: 'Τηρεί Απόθεμα',
  on_demand: "Παραγγελία κατ'ανάγκη",
  mixed: 'Μικτό',
};

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  order:   { label: 'Παραγγελία', bg: 'bg-blue-100',   text: 'text-blue-700' },
  invoice: { label: 'Τιμολόγιο',  bg: 'bg-green-100',  text: 'text-green-700' },
  credit:  { label: 'Πίστωση',    bg: 'bg-red-100',    text: 'text-red-700' },
};

const DOC_PERIODS = [
  { label: '2026 YTD', from: '2026-01-01', to: '2026-12-31' },
  { label: '2025',     from: '2025-01-01', to: '2025-12-31' },
  { label: '2024',     from: '2024-01-01', to: '2024-12-31' },
  { label: 'Όλα',      from: '2022-01-01', to: '2026-12-31' },
];

// ─── Sales period config ──────────────────────────────────────────────────────
const _now = new Date();
const _curYearMonth = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;
const _curMonthLabel = _now.toLocaleString('el-GR', { month: 'short' });

const SALES_PERIODS = [
  { label: 'Q1 2026',   from: '2026-01', to: '2026-03', prevFrom: '2025-01', prevTo: '2025-03', prevLabel: 'Q1 2025',             dateFrom: '2026-01-01', dateTo: '2026-03-31' },
  { label: 'Q2 2026',   from: '2026-04', to: '2026-06', prevFrom: '2025-04', prevTo: '2025-06', prevLabel: 'Q2 2025',             dateFrom: '2026-04-01', dateTo: '2026-06-30' },
  { label: `2026 YTD (έως ${_curMonthLabel})`, from: '2026-01', to: _curYearMonth, prevFrom: '2025-01', prevTo: `2025-${String(_now.getMonth() + 1).padStart(2, '0')}`, prevLabel: `Ιαν–${_curMonthLabel} 2025`, dateFrom: '2026-01-01', dateTo: `${_curYearMonth}-31` },
  { label: '2025 Full', from: '2025-01', to: '2025-12', prevFrom: '2024-01', prevTo: '2024-12', prevLabel: '2024',                dateFrom: '2025-01-01', dateTo: '2025-12-31' },
  { label: 'Q4 2025',   from: '2025-10', to: '2025-12', prevFrom: '2024-10', prevTo: '2024-12', prevLabel: 'Q4 2024',             dateFrom: '2025-10-01', dateTo: '2025-12-31' },
  { label: 'Q3 2025',   from: '2025-07', to: '2025-09', prevFrom: '2024-07', prevTo: '2024-09', prevLabel: 'Q3 2024',             dateFrom: '2025-07-01', dateTo: '2025-09-30' },
  { label: 'Q2 2025',   from: '2025-04', to: '2025-06', prevFrom: '2024-04', prevTo: '2024-06', prevLabel: 'Q2 2024',             dateFrom: '2025-04-01', dateTo: '2025-06-30' },
  { label: 'Q1 2025',   from: '2025-01', to: '2025-03', prevFrom: '2024-01', prevTo: '2024-03', prevLabel: 'Q1 2024',             dateFrom: '2025-01-01', dateTo: '2025-03-31' },
];

function sumPeriod(sales: any[], fromMonth: string, toMonth: string): number {
  return sales
    .filter(s => s.month >= fromMonth && s.month <= toMonth)
    .reduce((sum, s) => sum + (s.netamnt ?? 0), 0);
}

function fmtEur(n: number): string {
  return '€' + Math.round(n).toLocaleString('el-GR');
}

// ─── Category Intelligence helpers ───────────────────────────────────────────
type CatFilterType = 'all' | '0' | '1' | '2' | '3+';

const CAT_FILTER_LABELS: { key: CatFilterType; label: string }[] = [
  { key: 'all', label: 'Όλες' },
  { key: '0',   label: 'Δεν συζητήθηκε' },
  { key: '1',   label: '1 φορά' },
  { key: '2',   label: '2×' },
  { key: '3+',  label: '3+ φορές' },
];

function getDiscussionBadgeStyle(n: number): string {
  if (n === 0) return 'bg-slate-100 text-slate-400';
  if (n === 1) return 'bg-indigo-100 text-indigo-600';
  if (n === 2) return 'bg-purple-100 text-purple-700';
  return 'bg-purple-600 text-white';
}

function getL1Code(cat: any): string {
  return cat.category_code.split('.')[0];
}

function getL1Label(l1Code: string, items: any[]): string {
  const l1Item = items.find(i => i.level === 1 && i.category_code === l1Code);
  if (l1Item) return l1Item.full_name;
  return `Κατηγορία ${l1Code}`;
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
  const [expandedCatL1s, setExpandedCatL1s] = useState<Set<string>>(new Set());

  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docPeriodIdx, setDocPeriodIdx] = useState(0);
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'order' | 'invoice' | 'credit'>('all');
  const [docsExpanded, setDocsExpanded] = useState(false);

  const [competitorInfo, setCompetitorInfo] = useState<any>(null);
  const [shopProfile, setShopProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<CatFilterType>('all');
  const [expandedL1s, setExpandedL1s] = useState<Set<string>>(new Set());
  const [categoryMaster, setCategoryMaster] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    authedFetch('/api/categories')
      .then((data: any[]) => {
        const map = new Map<string, string>();
        if (Array.isArray(data)) {
          data.forEach(c => {
            if (c.category_code) map.set(String(c.category_code), c.full_name ?? c.short_name ?? c.category_code);
          });
        }
        setCategoryMaster(map);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    authedFetch(`/api/customers/${customer.code}/categories`)
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setCategoriesLoading(false));
  }, [customer.code, visitsRefreshKey]);

  useEffect(() => {
    authedFetch(`/api/visits?customer_code=${customer.code}`)
      .then(data => setVisits(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setVisitsLoading(false));
  }, [customer.code, visitsRefreshKey]);

  useEffect(() => {
    setSalesLoading(true);
    authedFetch(`/api/erp/customers/${customer.code}/sales?from=2023-01-01&to=2026-12-31`)
      .then(data => setSales(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setSalesLoading(false));
  }, [customer.code]);

  useEffect(() => {
    setSalesByCategoryLoading(true);
    setExpandedCatL1s(new Set());
    const { dateFrom, dateTo } = SALES_PERIODS[salesPeriodIdx];
    authedFetch(`/api/erp/customers/${customer.code}/sales-by-category?from=${dateFrom}&to=${dateTo}`)
      .then(data => setSalesByCategory(data.grouped ?? []))
      .catch(console.error)
      .finally(() => setSalesByCategoryLoading(false));
  }, [customer.code, salesPeriodIdx]);

  useEffect(() => {
    setDocsLoading(true);
    setDocsExpanded(false);
    const { from, to } = DOC_PERIODS[docPeriodIdx];
    authedFetch(`/api/erp/customers/${customer.code}/documents?from=${from}&to=${to}`)
      .then(data => setDocuments(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setDocsLoading(false));
  }, [customer.code, docPeriodIdx]);

  useEffect(() => {
    authedFetch(`/api/entity-profile/customer/${customer.code}`)
      .then(data => {
        setCompetitorInfo(data.competitor_info ?? null);
        setShopProfile(data.shop_profile ?? null);
      })
      .catch(console.error)
      .finally(() => setProfileLoading(false));
  }, [customer.code]);

  const sp = SALES_PERIODS[salesPeriodIdx];
  const currentTotal = sumPeriod(sales, sp.from, sp.to);
  const prevTotal    = sumPeriod(sales, sp.prevFrom, sp.prevTo);
  const growthPct    = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : null;
  const isUp         = growthPct !== null && growthPct >= 0;
  const diffAbs      = currentTotal - prevTotal;

  const filteredDocs = docTypeFilter === 'all' ? documents : documents.filter(d => d.type === docTypeFilter);
  const visibleDocs  = docsExpanded ? filteredDocs : filteredDocs.slice(0, 8);
  const docCounts = {
    order:   documents.filter(d => d.type === 'order').length,
    invoice: documents.filter(d => d.type === 'invoice').length,
    credit:  documents.filter(d => d.type === 'credit').length,
  };
  const lastInvoice = documents.find(d => d.type === 'invoice');
  const lastOrder   = documents.find(d => d.type === 'order');

  const totalDiscussions = categories.reduce((s, c) => s + (c.times_discussed ?? 0), 0);

  function matchesFilter(cat: any): boolean {
    const n = cat.times_discussed ?? 0;
    if (catFilter === 'all') return true;
    if (catFilter === '0')   return n === 0;
    if (catFilter === '1')   return n === 1;
    if (catFilter === '2')   return n === 2;
    if (catFilter === '3+')  return n >= 3;
    return true;
  }

  const l1Groups = (() => {
    const map = new Map<string, { l1Code: string; items: any[] }>();
    categories.forEach(cat => {
      const l1 = getL1Code(cat);
      if (!map.has(l1)) map.set(l1, { l1Code: l1, items: [] });
      map.get(l1)!.items.push(cat);
    });
    return Array.from(map.values());
  })();

  const filteredGroups = l1Groups
    .map(g => ({ ...g, filtered: g.items.filter(matchesFilter) }))
    .filter(g => g.filtered.length > 0);

  function toggleL1(code: string) {
    setExpandedL1s(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  function toggleCatL1(code: string) {
    setExpandedCatL1s(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  function groupStats(items: any[]) {
    const totalTimes = items.reduce((s, c) => s + (c.times_discussed ?? 0), 0);
    const lastDate = items.map(c => c.last_discussed).filter(Boolean).sort().reverse()[0] ?? null;
    return { totalTimes, lastDate };
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      <header className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="flex items-center gap-2 text-white/90 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </button>
            <button
              onClick={() => setShowNewVisitDialog(true)}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              New Visit
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 bg-white/20 rounded-md font-mono text-sm">{customer.code}</span>
            <h1 className="text-xl font-bold">{customer.name}</h1>
          </div>
          {(customer.city || customer.area) && (
            <div className="text-white/70 text-sm">
              {customer.city}{customer.city && customer.area ? ', ' : ''}{customer.area}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-4">

        {/* CUSTOMER DETAILS */}
        <section className="bg-white rounded-xl shadow p-5 border-l-4 border-indigo-500">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold">Στοιχεία Πελάτη</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm text-slate-700">
            <div className="space-y-2">
              <div className="font-medium text-slate-400 text-xs uppercase tracking-wide">Επικοινωνία</div>
              {customer.address && (
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <span>{customer.address}{customer.zip ? `, ${customer.zip}` : ''}{customer.city ? `, ${customer.city}` : ''}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2">
                  <span>✉️</span>
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline truncate">{customer.email}</a>
                </div>
              )}
              {customer.fax && <div>📠 {customer.fax}</div>}
              {customer.afm && (
                <div className="inline-block font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                  ΑΦΜ: {customer.afm}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="font-medium text-slate-400 text-xs uppercase tracking-wide">Μεταφορά</div>
              {customer.shipmentName && (
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-400" />
                  <span>{customer.shipmentName}</span>
                </div>
              )}
              {customer.carrierName && (
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-400" />
                  <span>{customer.carrierName}</span>
                </div>
              )}
              {!customer.shipmentName && !customer.carrierName && (
                <div className="text-slate-400 text-xs italic">Δεν υπάρχουν στοιχεία</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="font-medium text-slate-400 text-xs uppercase tracking-wide">Πληροφορίες</div>
              {customer.area && <div>Περιοχή: <span className="font-medium">{customer.area}</span></div>}
              {customer.lastVisitDate ? (
                <div>Τελευταία επίσκεψη: <span className="font-medium">{formatDate(customer.lastVisitDate)}</span></div>
              ) : (
                <div className="text-slate-400 text-xs italic">Καμία επίσκεψη ακόμα</div>
              )}
            </div>
          </div>
        </section>

        {/* SHOP PROFILE + COMPETITOR INFO */}
        {!profileLoading && (shopProfile || competitorInfo) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {shopProfile && (
              <section className="bg-white rounded-xl shadow p-5 border-l-4 border-blue-400">
                <div className="flex items-center gap-2 mb-3">
                  <Store className="w-5 h-5 text-blue-500" />
                  <h2 className="text-base font-semibold">Προφίλ Καταστήματος</h2>
                </div>
                <div className="space-y-2 text-sm text-slate-700">
                  {shopProfile.shop_type && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Τύπος</span>
                      <span className="font-medium">{SHOP_TYPE_LABELS[shopProfile.shop_type] ?? shopProfile.shop_type}</span>
                    </div>
                  )}
                  {shopProfile.number_of_employees && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Εργαζόμενοι</span>
                      <span className="font-medium flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />{shopProfile.number_of_employees}
                      </span>
                    </div>
                  )}
                  {shopProfile.shop_size_m2 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Εμβαδό</span>
                      <span className="font-medium">{shopProfile.shop_size_m2} m²</span>
                    </div>
                  )}
                  {shopProfile.stock_behavior && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Απόθεμα</span>
                      <span className="font-medium">{STOCK_BEHAVIOR_LABELS[shopProfile.stock_behavior] ?? shopProfile.stock_behavior}</span>
                    </div>
                  )}
                </div>
              </section>
            )}
            {competitorInfo && (
              <section className="bg-white rounded-xl shadow p-5 border-l-4 border-orange-400">
                <div className="flex items-center gap-2 mb-3">
                  <Swords className="w-5 h-5 text-orange-500" />
                  <h2 className="text-base font-semibold">Ανταγωνισμός</h2>
                </div>
                <div className="space-y-2 text-sm text-slate-700">
                  {competitorInfo.main_competitor && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Κύριος</span>
                      <span className="font-medium">{competitorInfo.main_competitor}</span>
                    </div>
                  )}
                  {competitorInfo.other_competitors && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Άλλοι</span>
                      <span className="font-medium">{competitorInfo.other_competitors}</span>
                    </div>
                  )}
                  {competitorInfo.estimated_monthly_spend && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Μηνιαία Δαπάνη</span>
                      <span className="font-medium text-green-600">
                        €{Number(competitorInfo.estimated_monthly_spend).toLocaleString('el-GR')}
                      </span>
                    </div>
                  )}
                  {competitorInfo.competitor_strengths && (
                    <div>
                      <div className="text-slate-500 mb-1">Δυνατά σημεία</div>
                      <div className="text-xs bg-slate-50 rounded p-2">{competitorInfo.competitor_strengths}</div>
                    </div>
                  )}
                  {competitorInfo.switch_reason && (
                    <div>
                      <div className="text-slate-500 mb-1">Λόγος αλλαγής</div>
                      <div className="text-xs bg-slate-50 rounded p-2">{competitorInfo.switch_reason}</div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* VISITS */}
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-semibold">Επισκέψεις</h2>
            </div>
            {visits.length > 0 && <span className="text-xs text-slate-500">{visits.length} σύνολο</span>}
          </div>
          {visitsLoading ? (
            <div className="text-sm text-slate-400">Φόρτωση...</div>
          ) : visits.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Καμία επίσκεψη ακόμα</div>
          ) : (
            <div className="space-y-2">
              {visits.slice(0, 5).map((v: any) => (
                <div key={v.id} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{formatDate(v.visit_date)}</div>
                    {v.notes && <div className="text-xs text-slate-500 mt-0.5">{v.notes}</div>}
                    {v.visit_type && (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded mt-1 inline-block">
                        {v.visit_type}
                      </span>
                    )}
                  </div>
                  {v.owner_name && <span className="text-xs text-slate-400">{v.owner_name}</span>}
                </div>
              ))}
              {visits.length > 5 && (
                <div className="text-xs text-indigo-500 pt-1">+{visits.length - 5} ακόμα επισκέψεις</div>
              )}
            </div>
          )}
        </section>

        {/* ── SALES ANALYSIS ───────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <BarChart2 className="w-5 h-5 text-blue-600 shrink-0" />
              <h2 className="text-base font-semibold">Sales Analysis</h2>
              <span className="text-xs text-slate-400 whitespace-nowrap">{sp.label} vs {sp.prevLabel}</span>
            </div>
            <select
              value={salesPeriodIdx}
              onChange={e => setSalesPeriodIdx(Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1 text-slate-600 focus:ring-2 focus:ring-indigo-500"
            >
              {SALES_PERIODS.map((p, i) => (
                <option key={p.label} value={i}>{p.label}</option>
              ))}
            </select>
          </div>

          {salesLoading ? (
            <div className="text-sm text-slate-400">Φόρτωση...</div>
          ) : (
            <>
              {/* Period cards */}
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

              {/* Monthly bar chart */}
              {(() => {
                const months = sales
                  .filter(s => s.month >= sp.from && s.month <= sp.to)
                  .sort((a, b) => a.month.localeCompare(b.month));
                const prevMonthMap = new Map<string, number>();
                sales
                  .filter(s => s.month >= sp.prevFrom && s.month <= sp.prevTo)
                  .forEach(s => prevMonthMap.set(s.month, s.netamnt));
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
                            <div className="w-full bg-slate-100 rounded-sm h-2 mb-0.5">
                              <div className="h-2 rounded-sm bg-indigo-400 transition-all" style={{ width: `${curPct}%` }} />
                            </div>
                            {prevAmt !== null && (
                              <div className="w-full bg-slate-100 rounded-sm h-1.5">
                                <div className="h-1.5 rounded-sm bg-slate-300 transition-all" style={{ width: `${prevPct}%` }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {months.length > 0 && prevMonthMap.size > 0 && (
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-2 rounded-sm bg-indigo-400 inline-block" />{sp.label}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-1.5 rounded-sm bg-slate-300 inline-block" />{sp.prevLabel}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── SALES BY CATEGORY ─────────────────────────────────────────── */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-400 font-medium mb-3 uppercase tracking-wide">Ανά Κατηγορία</div>
                {salesByCategoryLoading ? (
                  <div className="text-sm text-slate-400">Φόρτωση...</div>
                ) : salesByCategory.length === 0 ? (
                  <div className="text-sm text-slate-400 italic">Δεν βρέθηκαν κατηγορίες για αυτή την περίοδο</div>
                ) : (
                  <div className="space-y-1">
                    {salesByCategory.map(group => {
                      const isExp = expandedCatL1s.has(group.l1_code);
                      const maxGroupRev = Math.max(...salesByCategory.map((g: any) => g.total_revenue), 1);
                      const groupBarPct = Math.max((group.total_revenue / maxGroupRev) * 100, 2);
                      const l1Name = categoryMaster.get(group.l1_code) ?? `Κατηγορία ${group.l1_code}`;
                      return (
                        <div key={group.l1_code} className="rounded-lg border border-slate-100 overflow-hidden">
                          <button
                            onClick={() => toggleCatL1(group.l1_code)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors
                              ${isExp ? 'bg-blue-50 border-b border-blue-100' : 'bg-white hover:bg-slate-50'}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isExp
                                ? <ChevronDown className="w-4 h-4 text-blue-400 shrink-0" />
                                : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              }
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono shrink-0">
                                {group.l1_code}
                              </span>
                              <span className="text-sm font-medium text-slate-700 truncate">{l1Name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              <span className="text-xs text-slate-400 hidden sm:block">{group.invoice_count} τιμολόγια</span>
                              <span className="text-sm font-semibold text-slate-700">{fmtEur(group.total_revenue)}</span>
                            </div>
                          </button>
                          {!isExp && (
                            <div className="px-3 pb-2 bg-white">
                              <div className="w-full bg-slate-100 rounded-sm h-1.5">
                                <div className="h-1.5 rounded-sm bg-blue-300 transition-all" style={{ width: `${groupBarPct}%` }} />
                              </div>
                            </div>
                          )}
                          {isExp && (
                            <div className="divide-y divide-slate-50">
                              {group.categories.map((cat: any) => {
                                const maxRev = Math.max(...group.categories.map((c: any) => parseFloat(c.net_revenue)), 1);
                                const barPct = Math.max((parseFloat(cat.net_revenue) / maxRev) * 100, 2);
                                return (
                                  <div key={cat.category_code} className="px-4 py-2.5 bg-white hover:bg-slate-50">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-4 shrink-0 flex justify-center">
                                          <div className="w-px h-4 bg-slate-200" />
                                        </div>
                                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-mono shrink-0 uppercase">
                                          {cat.short_name}
                                        </span>
                                        <span className="text-sm text-slate-700 truncate">{cat.full_name}</span>
                                      </div>
                                      <div className="flex items-center gap-3 shrink-0 ml-2">
                                        <span className="text-xs text-slate-400">{Math.round(parseFloat(cat.total_qty))} τεμ.</span>
                                        <span className="text-sm font-semibold text-slate-700">{fmtEur(parseFloat(cat.net_revenue))}</span>
                                      </div>
                                    </div>
                                    <div className="ml-6 w-full bg-slate-100 rounded-sm h-1.5">
                                      <div className="h-1.5 rounded-sm bg-indigo-400 transition-all" style={{ width: `${barPct}%` }} />
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
              </div>
            </>
          )}
        </section>

        {/* ORDERS & INVOICES */}
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-semibold">Παραγγελίες & Τιμολόγια</h2>
            </div>
            <select
              value={docPeriodIdx}
              onChange={e => setDocPeriodIdx(Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1 text-slate-600 focus:ring-2 focus:ring-indigo-500"
            >
              {DOC_PERIODS.map((p, i) => (
                <option key={p.label} value={i}>{p.label}</option>
              ))}
            </select>
          </div>
          {!docsLoading && documents.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{docCounts.order} παραγγελίες</span>
              <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">{docCounts.invoice} τιμολόγια</span>
              {docCounts.credit > 0 && (
                <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">{docCounts.credit} πιστωτικά</span>
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
                <button
                  key={t}
                  onClick={() => { setDocTypeFilter(t); setDocsExpanded(false); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    docTypeFilter === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
                  }`}
                >
                  {t === 'all' ? 'Όλα' : TYPE_CONFIG[t].label}
                </button>
              ))}
            </div>
          )}
          {docsLoading ? (
            <div className="text-sm text-slate-400">Φόρτωση...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Δεν βρέθηκαν έγγραφα</div>
          ) : (
            <>
              <div className="space-y-1">
                {visibleDocs.map((doc: any) => {
                  const cfg = TYPE_CONFIG[doc.type] ?? TYPE_CONFIG.invoice;
                  return (
                    <div key={doc.findoc} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                        <span className="font-mono text-xs text-slate-600 truncate">{doc.doc_number}</span>
                        <span className="text-xs text-slate-400 shrink-0">{formatDate(doc.trndate)}</span>
                      </div>
                      <div className={`font-medium shrink-0 ml-2 ${doc.netamnt < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        €{Math.abs(doc.netamnt).toLocaleString('el-GR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredDocs.length > 8 && (
                <button
                  onClick={() => setDocsExpanded(v => !v)}
                  className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium py-2 border border-dashed border-indigo-200 rounded-lg"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${docsExpanded ? 'rotate-180' : ''}`} />
                  {docsExpanded ? 'Show less' : `Show all ${filteredDocs.length} documents`}
                </button>
              )}
            </>
          )}
        </section>

        {/* ── CATEGORY INTELLIGENCE ────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-semibold">Κατηγορίες που Συζητήθηκαν</h2>
            </div>
            {categories.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{categories.length} κατηγορίες</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{totalDiscussions} αναφορές σύνολο</span>
              </div>
            )}
          </div>
          {categoriesLoading ? (
            <div className="text-sm text-slate-400">Φόρτωση...</div>
          ) : categories.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Καμία κατηγορία ακόμα</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {CAT_FILTER_LABELS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setCatFilter(f.key)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      catFilter === f.key ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {filteredGroups.length === 0 ? (
                <div className="text-sm text-slate-400 italic">Δεν βρέθηκαν κατηγορίες</div>
              ) : (
                <div className="space-y-1">
                  {filteredGroups.map(group => {
                    const isExpanded = expandedL1s.has(group.l1Code);
                    const { totalTimes, lastDate } = groupStats(group.items);
                    const subCount = group.items.length;
                    const l1Label = categoryMaster.get(group.l1Code) ?? getL1Label(group.l1Code, group.items);
                    const badgeStyle = getDiscussionBadgeStyle(totalTimes);
                    return (
                      <div key={group.l1Code} className="rounded-lg border border-slate-100 overflow-hidden">
                        <button
                          onClick={() => toggleL1(group.l1Code)}
                          className={`w-full flex items-center justify-between px-3 py-3 text-left transition-colors
                            ${isExpanded ? 'bg-indigo-50 border-b border-indigo-100' : 'bg-white hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-indigo-400 shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            }
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-mono shrink-0">{group.l1Code}</span>
                            <span className="text-sm font-medium text-slate-700 truncate">{l1Label}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-xs text-slate-400 hidden sm:block">{subCount} υποκατ.</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeStyle}`}>{totalTimes}×</span>
                            {lastDate && <span className="text-xs text-slate-400">{formatDate(lastDate)}</span>}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="divide-y divide-slate-50">
                            {group.filtered.map(cat => {
                              const n = cat.times_discussed ?? 0;
                              const subBadge = getDiscussionBadgeStyle(n);
                              return (
                                <div
                                  key={`${cat.category_code}-${cat.subcategory_code ?? ''}`}
                                  className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-4 shrink-0 flex justify-center">
                                      <div className="w-px h-4 bg-slate-200" />
                                    </div>
                                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-mono shrink-0 uppercase">
                                      {cat.short_name ?? cat.full_name?.slice(0, 6)}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="text-sm text-slate-700 truncate">{cat.full_name}</div>
                                      {cat.subcategory_code && (
                                        <div className="text-xs text-slate-400 font-mono">{cat.subcategory_code}</div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${subBadge}`}>{n}×</span>
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
        onSave={() => {
          setShowNewVisitDialog(false);
          setVisitsRefreshKey(k => k + 1);
        }}
      />
    </div>
  );
}
