import {
  ArrowLeft, Info, Building2, Truck, Plus, Calendar, ShoppingCart, HatGlassesIcon,
  Lightbulb, FileText, Tag, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, BarChart2, Medal, TriangleAlert, AlertCircle, Receipt, User, RotateCcw,
  ClipboardList, Mic, Pause, Pencil, Bell, CheckCircle, Clock, PlayCircle, CalendarClock, Navigation, MapPin,
  MessageSquare, Trash2, Cloud as CloudIcon,
} from 'lucide-react';

import { formatDate } from '../../utils/dateFormat';
import { NewVisitDialog } from '../visits/NewVisitDialog';
import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { CustomerWordCloud } from './CustomerWordCloud';
import { ProfileEditor } from '../ui/ProfileEditor';
import { SmartDateInput, dateToISO, isoToDisplay } from '../ui/SmartDateInput';
import { CategorySelector } from '../ui/CategorySelector';
import { CategoryIntelligence } from './CategoryIntelligence';

import { CustomerMap } from '../customers/CustomerMap';

import type { CommercialEntityBase } from '../../types/commercialEntity';

const SHOP_TYPE_LABELS: Record<string, string> = {
  auto_parts_retailer: 'Ανταλλακτικά - Γενικά',
  auto_parts_jap: 'Ανταλλακτικά - JAP',
  auto_parts_eur: 'Ανταλλακτικά - EUR',
  auto_parts_korea: 'Ανταλλακτικά - KOREA',
  used_parts_general: 'Μεταχειρισμένα - Γενικά',
  used_parts_jap: 'Μεταχειρισμένα - JAP',
  used_parts_eur: 'Μεταχειρισμένα - EUR',
  accessories: 'Αξεσουάρ',
  garage: 'Συνεργείο',
  body_shop: 'Φανοποιείο',
  electrician: 'Ηλεκτρολογείο',
  specialist: 'Ειδικό - Ρεκτιφιέ/Τουρμπίνα/Diesel',
  vertical_unit: 'Κάθετη μονάδα',
  dealership: 'Αντιπροσωπεία',
  car_rental: 'Ενοικιάσεις αυτοκινήτων',
  cooperative: 'Συνεταιρισμός',
  company: 'Εταιρεία, π.χ. τεχνική',
  public_service: 'Δημόσια Υπηρεσία',
  electronics_shop: 'Ηλεκτρονικό κατάστημα',
  agricultural_machinery: 'Γεωργικά μηχανήματα',
  battery_lubs: 'Μπαταρίες/Λιπαντικά',
  bosch_car_service: 'Bosch Car Service',
  other: 'Άλλο',
};

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
    address?: string; phone?: string; mobile?: string; district?: string; email?: string;
    contactName?: string; vatNumber?: string; createdDate?: string;
    lastVisitDate?: string; transportCompany?: string; transportMeans?: string;
    overallDiscount?: number; afm?: string; fax?: string; zip?: string;
    shipmentName?: string; carrierName?: string; is_active?: boolean; prccategory?: number | null;
    inserted_date?: string | null;
    updated_date?: string | null;
    payment?: string | null;
    warning?: string | null;
  };
  onBack: () => void;
  currentUser?: { id: string; role: string; salesman_code: string | null; name: string };
  upcomingPlanned?: Map<string, { date: string; area: string }>;
  backLabel?: string;
}

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

function sumPeriod(sales: any[], fromMonth: string, toMonth: string): number {
  return sales.filter(s => s.month >= fromMonth && s.month <= toMonth).reduce((sum, s) => sum + (s.netamnt ?? 0), 0);
}

function sumQtyPeriod(sales: any[], fromMonth: string, toMonth: string): number {
  return sales.filter(s => s.month >= fromMonth && s.month <= toMonth).reduce((sum, s) => sum + (s.qty ?? 0), 0);
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

export function CustomerView({ customer, onBack, backLabel, currentUser: propCurrentUser, upcomingPlanned = new Map() }: CustomerViewProps) {
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  const [visitsRefreshKey, setVisitsRefreshKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [visits, setVisits] = useState<any[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesPeriodIdx, setSalesPeriodIdx] = useState(2);
  const [dayTotals, setDayTotals] = useState<{
    current: number; prev: number; currentQty: number; prevQty: number;
    currentCredit: number; prevCredit: number; currentCreditQty: number; prevCreditQty: number;
  } | null>(null);
  const [dayTotalsLoading, setDayTotalsLoading] = useState(false);
  const [salesByCategory, setSalesByCategory] = useState<any[]>([]);
  const [salesByCategoryLoading, setSalesByCategoryLoading] = useState(true);
  const [balance, setBalance] = useState<{ balance: number; entries: any[] } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [discounts, setDiscounts] = useState<{ general: number | null; categories: any[]; brands: any[]; prccategory: number | null } | null>(null);
  const [discountsLoading, setDiscountsLoading] = useState(true);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [salesExpanded, setSalesExpanded] = useState(false);
  const [lastSyncDate, setLastSyncDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lastInvoiceDate, setLastInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [salesByBranch, setSalesByBranch] = useState<any[]>([]);
  const [salesByBranchLoading, setSalesByBranchLoading] = useState(false);

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
  const [docCounts, setDocCounts] = useState<{ order: number; invoice: number; credit: number } | null>(null);

  const [competitorInfo, setCompetitorInfo] = useState<any>(null);
  const [shopProfile, setShopProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<CatFilterType>('all');
  const [expandedDiscL1s, setExpandedDiscL1s] = useState<Set<string>>(new Set());
  const [categoryMaster, setCategoryMaster] = useState<Map<string, string>>(new Map());
  const [payment, setPayment] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [salesman, setSalesman] = useState<{ code: string | null; name: string | null } | null>(null);
  const [locationCapturing, setLocationCapturing] = useState(false);
  const [locationCaptured, setLocationCaptured] = useState(false);  
  const [showMap, setShowMap] = useState(false);
  const [coordStatus, setCoordStatus] = useState<{ lat: number | null; captured_by: string | null; captured_at: string | null; coord_source: string | null } | null>(null);
  const [prepNotes, setPrepNotes] = useState<any[]>([]);
  const [standaloneComments, setStandaloneComments] = useState<any[]>([]);
  const [newPrepNote, setNewPrepNote] = useState('');
  const [newStandaloneComment, setNewStandaloneComment] = useState('');
  const [addingPrepNote, setAddingPrepNote] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);
  const currentUser = propCurrentUser ?? { id: '', role: 'rep', salesman_code: null, name: '' };

  const docsRef = useRef<HTMLDivElement>(null);

    useEffect(() => { window.scrollTo(0, 0); }, []);

  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [showAllVisits, setShowAllVisits] = useState(false);
  const [editingVisitInCustomer, setEditingVisitInCustomer] = useState<string | null>(null);
  const [cvEditNotes, setCvEditNotes] = useState('');
  const [cvEditType, setCvEditType] = useState('');
  const [cvEditDate, setCvEditDate] = useState('');
  const [cvEditSaving, setCvEditSaving] = useState(false);
  const [cvEditCategories, setCvEditCategories] = useState<any[]>([]);
const [allCategories, setAllCategories] = useState<any[]>([]);

  const [cvPlayingMemoId, setCvPlayingMemoId] = useState<string | null>(null);
  const [cvMemoUrls, setCvMemoUrls] = useState<Record<string, string>>({});
  const [cvMemoLoading, setCvMemoLoading] = useState<Record<string, boolean>>({});
  const cvAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const [taskUpdating, setTaskUpdating] = useState<string | null>(null);
  const [renewingTaskId, setRenewingTaskId] = useState<string | null>(null);
  const [renewDate, setRenewDate] = useState('');

  const SALES_PERIODS = useMemo(() => {
   // YTD = year-to-date ΜΕΧΡΙ ΤΗΝ ΗΜΕΡΟΜΗΝΙΑ του τελευταίου παραστατικού (lastInvoiceDate),
    // συγκρινόμενο με την ΙΔΙΑ μέρα/μήνα πέρσι. Day-level μέσω RPC → ταυτίζεται με το dashboard.
    // lastInvoiceDate μορφή 'YYYY-MM-DD'.
    const ytdYear = Number(lastInvoiceDate.slice(0, 4));
    const ytdMonthStr = lastInvoiceDate.slice(5, 7);                 // 'MM'
    const ytdMonthIdx = Number(ytdMonthStr) - 1;
    const ytdLabel = new Date(ytdYear, ytdMonthIdx, 1).toLocaleString('el-GR', { month: 'short' });
    const ytdDateTo = lastInvoiceDate;                              // inclusive (το RPC κάνει trndate < p_to + 1)
    const ytdPrevTo = `${ytdYear - 1}${lastInvoiceDate.slice(4)}`;   // ίδια μέρα/μήνα, προηγ. έτος
    return [
      { label: 'Q1 2026', from: '2026-01', to: '2026-03', prevFrom: '2025-01', prevTo: '2025-03', prevLabel: 'Q1 2025', dateFrom: '2026-01-01', dateTo: '2026-03-31', prevDateFrom: '2025-01-01', prevDateTo: '2025-03-31' },
      { label: 'Q2 2026', from: '2026-04', to: '2026-06', prevFrom: '2025-04', prevTo: '2025-06', prevLabel: 'Q2 2025', dateFrom: '2026-04-01', dateTo: '2026-06-30', prevDateFrom: '2025-04-01', prevDateTo: '2025-06-30' },
      { label: `2026 YTD (έως ${ytdLabel})`, from: '2026-01', to: `2026-${ytdMonthStr}`, prevFrom: '2025-01', prevTo: `2025-${ytdMonthStr}`, prevLabel: `Ιαν–${ytdLabel} 2025`, dateFrom: '2026-01-01', dateTo: ytdDateTo, prevDateFrom: '2025-01-01', prevDateTo: ytdPrevTo },
      { label: '2025 Full', from: '2025-01', to: '2025-12', prevFrom: '2024-01', prevTo: '2024-12', prevLabel: '2024', dateFrom: '2025-01-01', dateTo: '2025-12-31', prevDateFrom: '2024-01-01', prevDateTo: '2024-12-31' },
      { label: 'Q4 2025', from: '2025-10', to: '2025-12', prevFrom: '2024-10', prevTo: '2024-12', prevLabel: 'Q4 2024', dateFrom: '2025-10-01', dateTo: '2025-12-31', prevDateFrom: '2024-10-01', prevDateTo: '2024-12-31' },
      { label: 'Q3 2025', from: '2025-07', to: '2025-09', prevFrom: '2024-07', prevTo: '2024-09', prevLabel: 'Q3 2024', dateFrom: '2025-07-01', dateTo: '2025-09-30', prevDateFrom: '2024-07-01', prevDateTo: '2024-09-30' },
      { label: 'Q2 2025', from: '2025-04', to: '2025-06', prevFrom: '2024-04', prevTo: '2024-06', prevLabel: 'Q2 2024', dateFrom: '2025-04-01', dateTo: '2025-06-30', prevDateFrom: '2024-04-01', prevDateTo: '2024-06-30' },
      { label: 'Q1 2025', from: '2025-01', to: '2025-03', prevFrom: '2024-01', prevTo: '2024-03', prevLabel: 'Q1 2024', dateFrom: '2025-01-01', dateTo: '2025-03-31', prevDateFrom: '2024-01-01', prevDateTo: '2024-03-31' },
    ];
  }, [lastSyncDate, lastInvoiceDate]);

  useEffect(() => {
    authedFetch('/api/categories')
      .then((data: any[]) => {
        const map = new Map<string, string>();
        if (Array.isArray(data)) data.forEach(c => { if (c.category_code) map.set(String(c.category_code), c.full_name ?? c.short_name ?? c.category_code); });
        setCategoryMaster(map);
      }).catch(console.error);
  }, []);

  useEffect(() => {
    authedFetch(`/api/erp/customers/${customer.code}/summary`)
      .then(data => {
        setSales(Array.isArray(data.sales) ? data.sales : []);
        setBalance(data.balance ?? null);
        setDiscounts(data.discounts ?? null);
        setVisits(Array.isArray(data.visits) ? data.visits : []);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setShopProfile(data.profile?.shop_profile ?? null);
        setCompetitorInfo(data.profile?.competitor_info ?? null);
        if (data.lastSyncDate) setLastSyncDate(data.lastSyncDate);
        if (data.lastInvoiceDate) setLastInvoiceDate(data.lastInvoiceDate);
        if (data.payment) setPayment(data.payment);
        if (data.warning) setWarning(data.warning);
        if (data.salesman) setSalesman(data.salesman);
      })
      .catch(console.error)
      .finally(() => {
        setSalesLoading(false);
        setBalanceLoading(false);
        setDiscountsLoading(false);
        setVisitsLoading(false);
        setCategoriesLoading(false);
        setProfileLoading(false);
      });
  }, [customer.code, visitsRefreshKey, refreshKey]);

  useEffect(() => {
    setSalesByCategoryLoading(true);
    setExpandedL1s(new Set()); setExpandedL2s(new Set()); setExpandedL3s(new Set());
    setSkuData({}); setRankData({});
    const { dateFrom, dateTo, prevDateFrom, prevDateTo } = SALES_PERIODS[salesPeriodIdx];
    authedFetch(`/api/erp/customers/${customer.code}/sales-by-category?from=${dateFrom}&to=${dateTo}&prevFrom=${prevDateFrom}&prevTo=${prevDateTo}`)
      .then(data => setSalesByCategory(data.grouped ?? []))
      .catch(console.error).finally(() => setSalesByCategoryLoading(false));
  }, [customer.code, salesPeriodIdx, SALES_PERIODS]);

  useEffect(() => {
    setSalesByBranchLoading(true);
    const { dateFrom, dateTo, prevDateFrom, prevDateTo } = SALES_PERIODS[salesPeriodIdx];
    authedFetch(`/api/erp/customers/${customer.code}/sales-by-branch?from=${dateFrom}&to=${dateTo}&prevFrom=${prevDateFrom}&prevTo=${prevDateTo}`)
      .then(data => setSalesByBranch(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setSalesByBranchLoading(false));
  }, [customer.code, salesPeriodIdx, SALES_PERIODS]);

  useEffect(() => {
    const { dateFrom, dateTo, prevDateFrom, prevDateTo } = SALES_PERIODS[salesPeriodIdx];
    let cancelled = false;
    setDayTotals(null);
    setDayTotalsLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_customer_sales_totals', {
          p_trdr_code: String(customer.code),
          p_from: dateFrom,
          p_to: dateTo,
          p_prev_from: prevDateFrom,
          p_prev_to: prevDateTo,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!cancelled && row) {
          setDayTotals({
            current: Number(row.current_net) || 0,
            prev: Number(row.prev_net) || 0,
            currentQty: Number(row.current_qty) || 0,
            prevQty: Number(row.prev_qty) || 0,
            currentCredit: Number(row.current_credit_net) || 0,
            prevCredit: Number(row.prev_credit_net) || 0,
            currentCreditQty: Number(row.current_credit_qty) || 0,
            prevCreditQty: Number(row.prev_credit_qty) || 0,
          });
        }
      } catch (e) {
        console.error('sales totals RPC failed, using monthly fallback', e);
        if (!cancelled) setDayTotals(null);
      } finally {
        if (!cancelled) setDayTotalsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customer.code, salesPeriodIdx, SALES_PERIODS, refreshKey]);

  useEffect(() => {
    setDocsLoading(true);
    setDocsExpanded(false);
    setExpandedDocId(null);
    const { from, to } = DOC_PERIODS[docPeriodIdx];
    authedFetch(`/api/erp/customers/${customer.code}/documents?from=${from}&to=${to}`)
      .then(data => {
        setDocuments(Array.isArray(data) ? data : (data.docs ?? []));
        setDocCounts(data.counts ?? null);
      })
      .catch(console.error)
      .finally(() => setDocsLoading(false));
  }, [customer.code, docPeriodIdx]);

  useEffect(() => {
  authedFetch('/api/categories').then(setAllCategories).catch(console.error);
}, []);

useEffect(() => {
    supabase.from('crm_customer_prep_notes')
      .select('*').eq('customer_code', customer.code).eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPrepNotes(data ?? []));
    supabase.from('crm_customer_standalone_comments')
      .select('*').eq('customer_code', customer.code)
      .order('created_at', { ascending: false })
      .then(({ data }) => setStandaloneComments(data ?? []));
  }, [customer.code, notesRefreshKey]);

  useEffect(() => {
    authedFetch(`/api/coordinates?customer_code=${customer.code}`)
      .then((data: any[]) => {
        const row = Array.isArray(data) ? (data[0] ?? null) : null;
        setCoordStatus(row);
      })
      .catch(() => setCoordStatus(null));
  }, [customer.code, locationCaptured, refreshKey]);

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
  // Headline totals: day-accurate από το RPC (ταυτίζονται πάντα με το dashboard),
  // fallback σε monthly όσο φορτώνει ή αν αποτύχει.
  const currentTotal = dayTotals ? dayTotals.current : sumPeriod(sales, sp.from, sp.to);
  const prevTotal = dayTotals ? dayTotals.prev : sumPeriod(sales, sp.prevFrom, sp.prevTo);
  const currentQty = dayTotals ? dayTotals.currentQty : sumQtyPeriod(sales, sp.from, sp.to);
  const prevQty = dayTotals ? dayTotals.prevQty : sumQtyPeriod(sales, sp.prevFrom, sp.prevTo);
  const growthPct = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : null;
  const isUp = growthPct !== null && growthPct >= 0;
  const diffAbs = currentTotal - prevTotal;
  const totalsLoading = dayTotalsLoading && !dayTotals;

  const filteredDocs = docTypeFilter === 'all' ? documents : documents.filter(d => d.type === docTypeFilter);
  const visibleDocs = docsExpanded ? filteredDocs : filteredDocs.slice(0, 8);
  const displayCounts = docCounts ?? {
    order: documents.filter(d => d.type === 'order').length,
    invoice: documents.filter(d => d.type === 'invoice').length,
    credit: documents.filter(d => d.type === 'credit').length,
  };
  const lastInvoice = documents.find(d => d.type === 'invoice');
  const lastOrder = documents.find(d => d.type === 'order');
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

  function renderDocLines(findoc: number, sumamnt: number | null) {
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
              <th className="text-right px-4 py-2">Τιμή</th>
              <th className="text-right px-3 py-2">Έκπτ.</th>
              <th className="text-right px-3 py-2">ΦΠΑ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line: any, i: number) => (
              <tr key={i} className="hover:bg-white transition-colors">
                <td className="px-4 py-2 font-mono text-slate-600 whitespace-nowrap">{line.sku_code}</td>
                <td className="px-4 py-2 text-slate-600 hidden sm:table-cell truncate max-w-xs">{line.sku_name}</td>
                <td className="px-3 py-2 text-right text-slate-500">{Math.round(Number(line.qty ?? 0))}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">
                  {line.price != null
                    ? '€' + Number(line.price).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '€' + Number(line.netlineval ?? 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-right text-slate-400">{line.disc1prc ? `${line.disc1prc}%` : '—'}</td>
                <td className="px-3 py-2 text-right text-slate-400">{line.vatprc != null ? `${line.vatprc}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-white">
              <td colSpan={2} className="px-4 py-2 text-slate-400 text-xs hidden sm:table-cell">{lines.length} γραμμές</td>
              <td colSpan={2} className="px-4 py-2 text-slate-400 text-xs sm:hidden">{lines.length} γραμμές</td>
              <td className="px-3 py-2 text-right text-xs text-slate-400">
                <div>χωρίς ΦΠΑ</div>
                <div>με ΦΠΑ</div>
              </td>
              <td className="px-4 py-2 text-right">
                <div className="font-bold text-slate-800">
                  {(() => {
                    const net = lines.reduce((sum: number, l: any) => sum + Number(l.netlineval ?? 0), 0);
                    return '€' + net.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  })()}
                </div>
                <div className="font-bold text-slate-600">
                  {sumamnt != null
                    ? '€' + Number(sumamnt).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '—'}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

const startEditVisitInCustomer = (v: any) => {
  setEditingVisitInCustomer(v.id);
  setCvEditNotes(v.notes ?? '');
  setCvEditType(v.visit_type ?? 'in-person');
  setCvEditDate(isoToDisplay(v.visit_date));
  setCvEditCategories(v.crm_visit_categories ?? []);
};

  const saveEditVisitInCustomer = async (visitId: string) => {
    setCvEditSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${BASE_URL}/api/visits/${visitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ 
  notes: cvEditNotes, 
  visit_type: cvEditType, 
  visit_date: dateToISO(cvEditDate),
  categories: cvEditCategories,
}),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      setVisits((prev: any[]) => prev.map(v => v.id === visitId ? { ...v, ...updated } : v));
      setEditingVisitInCustomer(null);
    } catch {
      alert('Αποτυχία αποθήκευσης');
    } finally {
      setCvEditSaving(false);
    }
  };

  const playCvMemo = async (visitId: string) => {
    if (cvPlayingMemoId && cvPlayingMemoId !== visitId) {
      cvAudioRefs.current[cvPlayingMemoId]?.pause();
      setCvPlayingMemoId(null);
    }
    if (cvPlayingMemoId === visitId) {
      cvAudioRefs.current[visitId]?.pause();
      setCvPlayingMemoId(null);
      return;
    }
    if (!cvMemoUrls[visitId]) {
      setCvMemoLoading(prev => ({ ...prev, [visitId]: true }));
      try {
        const data = await authedFetch(`/api/visits/${visitId}/voice-memo`);
        setCvMemoUrls(prev => ({ ...prev, [visitId]: data.url }));
      } catch {
        alert('Failed to load memo');
        return;
      } finally {
        setCvMemoLoading(prev => ({ ...prev, [visitId]: false }));
      }
    }
    setTimeout(() => {
      const audio = cvAudioRefs.current[visitId];
      if (audio) {
        audio.play();
        setCvPlayingMemoId(visitId);
        audio.onended = () => setCvPlayingMemoId(null);
      }
    }, 50);
  };

  const today = new Date().toISOString().split('T')[0];

  const updateTaskStatus = async (taskId: string, status: string, visitId: string) => {
    setTaskUpdating(taskId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status }),
      });
      setVisits(prev => prev.map(v =>
        v.id === visitId
          ? { ...v, crm_visit_tasks: (v.crm_visit_tasks ?? []).map((t: any) => t.id === taskId ? { ...t, status } : t) }
          : v
      ));
    } catch { alert('Αποτυχία ενημέρωσης'); }
    finally { setTaskUpdating(null); }
  };

  const renewTaskReminder = async (taskId: string, visitId: string) => {
    if (!renewDate) return;
    setTaskUpdating(taskId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ reminder_date: renewDate }),
      });
      setVisits(prev => prev.map(v =>
        v.id === visitId
          ? { ...v, crm_visit_tasks: (v.crm_visit_tasks ?? []).map((t: any) => t.id === taskId ? { ...t, reminder_date: renewDate } : t) }
          : v
      ));
      setRenewingTaskId(null);
      setRenewDate('');
    } catch { alert('Αποτυχία ενημέρωσης'); }
    finally { setTaskUpdating(null); }
  };

  const isPrivilegedUser = ['admin', 'manager', 'exec'].includes(currentUser.role);

  const addPrepNote = async () => {
    if (!newPrepNote.trim()) return;
    await supabase.from('crm_customer_prep_notes').insert({
      customer_code: customer.code,
      created_by: currentUser.id,
      created_by_name: currentUser.name,
      text: newPrepNote.trim(),
    });
    setNewPrepNote(''); setAddingPrepNote(false);
    setNotesRefreshKey(k => k + 1);
  };

  const resolvePrepNote = async (id: string) => {
    await supabase.from('crm_customer_prep_notes').update({
      is_resolved: true, resolved_by: currentUser.id,
      resolved_by_name: currentUser.name, resolved_at: new Date().toISOString(),
    }).eq('id', id);
    setPrepNotes(prev => prev.filter(n => n.id !== id));
  };

  const addStandaloneComment = async () => {
    if (!newStandaloneComment.trim()) return;
    const { data } = await supabase.from('crm_customer_standalone_comments').insert({
      customer_code: customer.code, user_id: currentUser.id,
      user_name: currentUser.name, text: newStandaloneComment.trim(),
    }).select().single();
    if (data) { setStandaloneComments(prev => [data, ...prev]); setNewStandaloneComment(''); setAddingComment(false); }
  };

  const deleteStandaloneComment = async (id: string) => {
    await supabase.from('crm_customer_standalone_comments').delete().eq('id', id);
    setStandaloneComments(prev => prev.filter(c => c.id !== id));
  };

  const navUrl = `https://maps.google.com/?daddr=${encodeURIComponent([customer.address, customer.city, customer.area, 'Greece'].filter(Boolean).join(', '))}`;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      <header className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-2">

          <div className="flex items-center justify-between">
            <button onClick={onBack} className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />{backLabel ?? 'Back to Dashboard'}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSalesLoading(true); setBalanceLoading(true); setDiscountsLoading(true);
                  setVisitsLoading(true); setCategoriesLoading(true); setProfileLoading(true);
                  setRefreshKey(k => k + 1);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {(() => {
                const allTasks = visits.flatMap((v: any) => (v.crm_visit_tasks ?? []).map((t: any) => ({ ...t, visit_id: v.id })));
                const overdue = allTasks.filter((t: any) => t.status !== 'completed' && t.reminder_date && t.reminder_date < today);
                const todayDue = allTasks.filter((t: any) => t.status !== 'completed' && t.reminder_date === today);
                const pending = allTasks.filter((t: any) => t.status !== 'completed' && t.reminder_date);
                if (overdue.length > 0) return (
                  <span className="flex items-center gap-1 px-2.5 py-1.5 bg-red-800 text-white rounded-lg text-xs font-bold">
                    <Bell className="w-4 h-4" />{overdue.length} ληξιπρόθεσμες
                  </span>
                );
                if (todayDue.length > 0) return (
                  <span className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-400 text-amber-900 rounded-lg text-xs font-bold">
                    <Bell className="w-4 h-4" />{todayDue.length} για σήμερα
                  </span>
                );
                if (pending.length > 0) return (
                  <span className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium">
                    <Bell className="w-4 h-4" />{pending.length} εκκρεμείς
                  </span>
                );
                return null;
              })()}

              {(customer.address || customer.city) && (
  <>
    <a
      href={navUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
      title="Πλοήγηση"
    >
      <Navigation className="w-4 h-4" />
    </a>
    <button
      onClick={async () => {
        if (!navigator.geolocation) { alert('Geolocation not supported'); return; }

        // Check if rep-captured coordinates already exist
        const { data: existingCoord } = await supabase
          .from('crm_customer_coordinates')
          .select('captured_by, captured_at')
          .eq('customer_code', String(customer.code))
          .single();

        if (existingCoord?.captured_by) {
          const capturedDate = existingCoord.captured_at
            ? new Date(existingCoord.captured_at).toLocaleDateString('el-GR')
            : '—';
          const confirm = window.confirm(
            `Υπάρχουν ήδη συντεταγμένες που καταγράφηκαν επιτόπου στις ${capturedDate}.\n\nΘέλετε να τις αντικαταστήσετε;`
          );
          if (!confirm) return;
        }

        setLocationCapturing(true);
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const token = session?.access_token;
              await fetch(`${BASE_URL}/api/customers/${customer.code}/coordinates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  accuracy_meters: pos.coords.accuracy,
                }),
              });
              setLocationCaptured(true);
              setTimeout(() => setLocationCaptured(false), 3000);
            } catch { alert('Αποτυχία αποθήκευσης τοποθεσίας'); }
            finally { setLocationCapturing(false); }
          },
          () => { alert('Αδυναμία εντοπισμού τοποθεσίας'); setLocationCapturing(false); },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }}
      disabled={locationCapturing}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${locationCaptured ? 'bg-green-500 text-white' : 'bg-white/20 hover:bg-white/30'}`}
      title="Καταγραφή τοποθεσίας"
    >
      {locationCapturing ? (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : locationCaptured ? (
        <CheckCircle className="w-4 h-4" />
      ) : (
        <MapPin className="w-4 h-4" />
      )}
    </button>
  </>
)}

              <button
                onClick={() => setShowNewVisitDialog(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />New Visit
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 bg-white/20 rounded font-mono text-sm font-bold shrink-0">{customer.code}</span>
            <h1 className="text-lg font-extrabold leading-tight">{customer.name}</h1>
            {customer.is_active === false && (
              <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-xs font-semibold rounded-full shrink-0">Inactive</span>
            )}
            {customer.prccategory === 105 && (
              <span className="px-2 py-0.5 bg-orange-400 text-white text-xs font-semibold rounded-full shrink-0">Συν/Φαν/Ηλ</span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {customer.type && <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">{customer.type}</span>}
            {customer.group && <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">{customer.group}</span>}
            {customer.city && <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/70">{customer.city}{customer.area ? `, ${customer.area}` : ''}</span>}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-2">
            <div className="flex items-center gap-1">
              {[
                { icon: <User className="w-4 h-4" />, id: 'section-customer', title: 'Στοιχεία Πελάτη' },
                { icon: <HatGlassesIcon className="w-4 h-4" />, id: 'section-comp', title: 'Ανταγωνισμός' },
                { icon: <BarChart2 className="w-4 h-4" />, id: 'section-sales', title: 'Πωλήσεις' },
                { icon: <ClipboardList className="w-4 h-4" />, id: 'section-visits', title: 'Επισκέψεις' },
                { icon: <FileText className="w-4 h-4" />, id: 'section-docs', title: 'Έγγραφα' },
                { icon: <MessageSquare className="w-4 h-4" />, id: 'section-comments', title: 'Σχόλια & Σημειώσεις' },
                { icon: <Lightbulb className="w-4 h-4" />, id: 'section-intelligence', title: 'Intelligence' },
                { icon: <CloudIcon className="w-4 h-4" />, id: 'section-wordcloud', title: 'Ανάλυση Αγορών' },
                ].map((item, i) => (
                <button key={i}
                  onClick={() => { const el = document.getElementById(item.id); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 170, behavior: 'smooth' }); }}
                  title={item.title}
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  {item.icon}
                </button>
              ))}
            </div>
            <select value={salesPeriodIdx} onChange={e => setSalesPeriodIdx(Number(e.target.value))}
              className="text-xs bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white focus:ring-2 focus:ring-white/30">
              {SALES_PERIODS.map((p, i) => <option key={p.label} value={i} className="text-slate-800">{p.label}</option>)}
            </select>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-4">


{isPrivilegedUser && prepNotes.length === 0 && !addingPrepNote && (
          <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
            <div className="flex items-center gap-1.5 text-amber-600">
              <TriangleAlert className="w-3.5 h-3.5" />
              <span>Σημειώσεις επόμενης επίσκεψης</span>
            </div>
            <button onClick={() => setAddingPrepNote(true)} className="text-amber-700 hover:text-amber-900 font-medium">+ Νέα</button>
          </div>
        )}


        {/* PREP NOTES — alert for rep on next visit */}
        {(prepNotes.length > 0 || (isPrivilegedUser && addingPrepNote)) && (
          <section className="bg-amber-50 rounded-xl border-2 border-amber-300 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TriangleAlert className="w-5 h-5 text-amber-600" />
                <h2 className="text-sm font-bold text-amber-900">Σημειώσεις για Επόμενη Επίσκεψη</h2>
                {prepNotes.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-400 text-amber-900 rounded-full text-xs font-bold">{prepNotes.length}</span>
                )}
              </div>
              {isPrivilegedUser && (
                <button onClick={() => setAddingPrepNote(v => !v)}
                  className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium">
                  <Plus className="w-3.5 h-3.5" /> Νέα
                </button>
              )}
            </div>
            {addingPrepNote && (
              <div className="mb-3 space-y-2">
                <textarea value={newPrepNote} onChange={e => setNewPrepNote(e.target.value)}
                  placeholder="Ερώτηση ή σημείωση για τον εκπρόσωπο..."
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white min-h-[70px] focus:ring-2 focus:ring-amber-400" />
                <div className="flex gap-2">
                  <button onClick={addPrepNote} disabled={!newPrepNote.trim()}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">Αποθήκευση</button>
                  <button onClick={() => { setAddingPrepNote(false); setNewPrepNote(''); }}
                    className="px-3 py-1.5 bg-white text-slate-600 rounded-lg text-xs border border-slate-200">Ακύρωση</button>
                </div>
              </div>
            )}
            {prepNotes.length === 0 && !addingPrepNote && (
              <div className="text-xs text-amber-600 italic">Δεν υπάρχουν ενεργές σημειώσεις</div>
            )}
            <div className="space-y-2">
              {prepNotes.map(note => (
                <div key={note.id} className="flex items-start gap-2 p-3 bg-white rounded-lg border border-amber-200">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800">{note.text}</p>
                    <p className="text-xs text-slate-400 mt-1">{note.created_by_name} · {new Date(note.created_at).toLocaleDateString('el-GR')}</p>
                  </div>
                  <button onClick={() => resolvePrepNote(note.id)}
                    className="shrink-0 p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Επιλύθηκε">
                    <CheckCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {upcomingPlanned.has(String(customer.code)) && (() => {
          const planned = upcomingPlanned.get(String(customer.code))!;
          const dt = new Date(planned.date + 'T12:00:00');
          const label = dt.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' });
          return (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700">
              <span className="text-lg shrink-0">📅</span>
              <div>
                <span className="font-semibold">Προγραμματισμένη επίσκεψη: {label}</span>
                {planned.area && <span className="text-indigo-500 ml-2">· {planned.area}</span>}
              </div>
            </div>
          );
        })()}

        {/* CUSTOMER DETAILS */}
        <section id="section-customer" className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center gap-2 mb-4"><Info className="w-5 h-5 text-indigo-600" /><h2 className="text-base font-semibold">Στοιχεία Πελάτη</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm text-slate-700">
            <div className="space-y-2">
              <div className="font-medium text-slate-400 text-xs uppercase tracking-wide">Επικοινωνία</div>
              {customer.address && <div className="flex items-start gap-2"><Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" /><span>{customer.address}{customer.zip ? `, ${customer.zip}` : ''}{customer.city ? `, ${customer.city}` : ''}</span></div>}
              {(customer.address || customer.city) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowMap(true)}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Προβολή/Επεξεργασία θέσης
                  </button>
                  {coordStatus?.coord_source === 'gps' ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <Navigation className="w-3 h-3" />
                      Επιτόπου GPS{coordStatus.captured_at ? ` · ${new Date(coordStatus.captured_at).toLocaleDateString('el-GR')}` : ''}
                    </span>
                  ) : coordStatus?.coord_source === 'map' ? (
                    <span className="flex items-center gap-1 text-xs text-indigo-500 font-medium">
                      <MapPin className="w-3 h-3" />
                      Χάρτης{coordStatus.captured_at ? ` · ${new Date(coordStatus.captured_at).toLocaleDateString('el-GR')}` : ''}
                    </span>
                  ) : coordStatus?.lat ? (
                    <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
                      <TriangleAlert className="w-3 h-3" />
                      Αυτόματη θέση — χωρίς επαλήθευση
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <MapPin className="w-3 h-3" />
                      Χωρίς συντεταγμένες
                    </span>
                  )}
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <span>📞</span>
                  <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">{customer.phone}</a>
                  <span className="text-xs text-slate-400">Κύριο</span>
                </div>
              )}
              {customer.mobile && (
                <div className="flex items-center gap-2">
                  <span>📱</span>
                  <a href={`tel:${customer.mobile}`} className="text-blue-600 hover:underline">{customer.mobile}</a>
                </div>
              )}
              {customer.fax && (
                <div className="flex items-center gap-2">
                  <span>📞</span>
                  <span className="text-slate-600">{customer.fax}</span>
                  <span className="text-xs text-slate-400">2ο τηλ.</span>
                </div>
              )}
              {customer.email && <div className="flex items-center gap-2"><span>✉️</span><a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline truncate">{customer.email}</a></div>}
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
              {salesman?.name && (
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-400" />
                  Πωλητής: <span className="font-medium">{salesman.name}</span>
                </div>
              )}
              {customer.area && <div>Περιοχή: <span className="font-medium">{customer.area}</span></div>}
              {customer.district && <div>Νομός: <span className="font-medium">{customer.district}</span></div>}
              {customer.lastVisitDate ? <div>Τελευταία επίσκεψη: <span className="font-medium">{formatDate(customer.lastVisitDate)}</span></div> : <div className="text-slate-400 text-xs italic">Καμία επίσκεψη ακόμα</div>}
              {customer.inserted_date && <div>Πελάτης από: <span className="font-medium">{formatDate(customer.inserted_date)}</span></div>}
              {customer.updated_date && <div className="text-xs text-slate-400">Ενημέρωση ERP: {formatDate(customer.updated_date)}</div>}
              {payment && <div>Όροι Πληρωμής: <span className="font-medium">{payment}</span></div>}
              {warning && (
                <div className="flex items-center gap-1.5 mt-1 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <TriangleAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{warning}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* DISCOUNTS */}
        {(discountsLoading || (discounts && (discounts.general !== null || discounts.categories.length > 0 || discounts.brands.length > 0))) && (
          <section className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-5 h-5 text-green-600" />
              <h2 className="text-base font-semibold">Πολιτική Εκπτώσεων</h2>
              {discounts?.prccategory === 105 && (
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 text-xs font-semibold rounded-full">
                  Συν/Φαν/Ηλ — Ειδική Τιμολόγηση
                </span>
              )}
            </div>
            {discountsLoading ? (
              <div className="text-sm text-slate-400">Φόρτωση...</div>
            ) : !discounts ? (
              <div className="text-sm text-slate-400 italic">Δεν βρέθηκαν εκπτώσεις</div>
            ) : (
              <div className="space-y-4">
                {discounts.general !== null ? (
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600 font-medium">Γενική Έκπτωση Πελάτη</span>
                    <span className="text-lg font-bold text-green-600">{discounts.general}%</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">Δεν υπάρχει γενική έκπτωση</div>
                )}
                {discounts.categories.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Εκπτώσεις ανά Κατηγορία</div>
                    <div className="space-y-1">
                      {(showAllCategories ? discounts.categories : discounts.categories.slice(0, 5)).map((c: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50">
                          <span className="text-sm text-slate-700">{c.category}</span>
                          <span className="text-sm font-bold text-indigo-600">{c.discount}%</span>
                        </div>
                      ))}
                    </div>
                    {discounts.categories.length > 5 && (
                      <button onClick={() => setShowAllCategories(v => !v)} className="text-xs text-indigo-500 hover:underline mt-1">
                        {showAllCategories ? 'Show less' : `+${discounts.categories.length - 5} more`}
                      </button>
                    )}
                  </div>
                )}
                {discounts.brands.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Επιπρόσθετες εκπτώσεις ανά Μάρκα</div>
                    <div className="space-y-1">
                      {(showAllBrands ? discounts.brands : discounts.brands.slice(0, 5)).map((b: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50">
                          <span className="text-sm text-slate-700">{b.brand}</span>
                          <span className="text-sm font-bold text-blue-600">{b.discount}%</span>
                        </div>
                      ))}
                    </div>
                    {discounts.brands.length > 5 && (
                      <button onClick={() => setShowAllBrands(v => !v)} className="text-xs text-indigo-500 hover:underline mt-1">
                        {showAllBrands ? 'Show less' : `+${discounts.brands.length - 5} more`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* SHOP PROFILE + COMPETITOR INFO */}
        <section id="section-comp" className="bg-white rounded-xl shadow overflow-hidden">
          {profileLoading ? (
            <div className="px-5 py-4 text-sm text-slate-400">Φόρτωση...</div>
          ) : (
            <ProfileEditor
              entityType="customer"
              entityId={customer.code}
              shopProfile={shopProfile}
              competitorInfo={competitorInfo}
              onSaved={(sp, ci) => { setShopProfile(sp); setCompetitorInfo(ci); }}
            />
          )}
        </section>

        {/* SALES ANALYSIS */}
        <section id="section-sales" className="bg-white rounded-xl shadow p-5">
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
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                  <div className="text-xs text-indigo-500 font-medium mb-1">Τρέχουσα Περίοδος ({sp.label})</div>
                  {totalsLoading ? (
                    <div className="space-y-2 mt-1">
                      <div className="h-7 w-28 bg-indigo-200/60 rounded animate-pulse" />
                      <div className="h-3 w-16 bg-indigo-100 rounded animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-indigo-700 leading-tight">{fmtEur(currentTotal)}</div>
                      <div className="text-xs text-indigo-400 mt-0.5">{currentQty.toLocaleString('el-GR')} τεμ.</div>
                      {dayTotals && (dayTotals.currentCredit > 0 || dayTotals.prevCredit > 0) && (
                        <div className="text-xs text-red-400 mt-0.5">Επιστροφές: {fmtEur(dayTotals.currentCredit)} · {Math.round(dayTotals.currentCreditQty).toLocaleString('el-GR')} τεμ.</div>
                      )}
                      {growthPct !== null && (
                        <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${isUp ? 'text-green-600' : 'text-red-500'}`}>
                          {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {isUp ? '+' : ''}{growthPct.toFixed(1)}% vs {sp.prevLabel}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium mb-1">Ίδια Περίοδος Πέρσι ({sp.prevLabel})</div>
                  {totalsLoading ? (
                    <div className="space-y-2 mt-1">
                      <div className="h-7 w-28 bg-slate-200 rounded animate-pulse" />
                      <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-slate-600 leading-tight">{fmtEur(prevTotal)}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{prevQty.toLocaleString('el-GR')} τεμ.</div>
                      {dayTotals && (dayTotals.currentCredit > 0 || dayTotals.prevCredit > 0) && (
                        <div className="text-xs text-red-400 mt-0.5">Επιστροφές: {fmtEur(dayTotals.prevCredit)} · {Math.round(dayTotals.prevCreditQty).toLocaleString('el-GR')} τεμ.</div>
                      )}
                      {growthPct !== null && (
                        <div className={`text-xs mt-2 font-medium ${isUp ? 'text-green-600' : 'text-red-500'}`}>
                          {isUp ? '+' : ''}{fmtEur(Math.abs(diffAbs))} {isUp ? 'αύξηση' : 'μείωση'}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <button onClick={() => setSalesExpanded(v => !v)}
                className="w-full flex items-center justify-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 py-2 border-t border-slate-100 mt-2">
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${salesExpanded ? 'rotate-180' : ''}`} />
                {salesExpanded ? 'Απόκρυψη λεπτομερειών' : 'Εμφάνιση λεπτομερειών'}
              </button>

              {salesExpanded && <>
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
                    <div className="mt-3">
                      <div className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wide">Ανά Μήνα</div>
                      <div className="space-y-2">
                        {months.map(m => {
                          const prevKey = toPrevMonth(m.month);
                          const prevAmt = prevMonthMap.get(prevKey) ?? null;
                          const curPct = Math.max((m.netamnt / maxAmt) * 100, 2);
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

                {salesByBranch.length > 1 && (
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="text-xs text-slate-400 font-medium mb-3 uppercase tracking-wide">Ανά Υποκατάστημα</div>
                    {salesByBranchLoading ? (
                      <div className="text-xs text-slate-400">Φόρτωση...</div>
                    ) : (
                      <div className="space-y-2">
                        {salesByBranch.map(b => {
                          const growth = b.prev > 0 ? ((b.current - b.prev) / b.prev) * 100 : null;
                          return (
                            <div key={b.trdbranch ?? 'hq'} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50">
                              <span className="text-sm font-medium text-slate-700">{b.label}</span>
                              <div className="flex items-center gap-3">
                                {growth !== null && <GrowthBadge pct={growth} />}
                                <span className="text-sm font-semibold text-slate-800">{fmtEur(b.current)}</span>
                                {b.prev > 0 && <span className="text-xs text-slate-400">vs {fmtEur(b.prev)}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

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
                                          const effectiveId = l2.category_id ? l2IdKey : l2.l3s?.[0]?.category_id ? String(l2.l3s[0].category_id) : null;
                                          if (effectiveId) handleExpandCategory(effectiveId);
                                        }
                                      }} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 text-left">
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
                                            const effectiveId = l2.category_id ? l2IdKey : l2.l3s?.[0]?.category_id ? String(l2.l3s[0].category_id) : null;
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
              </>}
            </>
          )}
        </section>

        {/* VISITS */}
        <section id="section-visits" className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-semibold">Επισκέψεις</h2>
            </div>
            {visits.length > 0 && (
              <span className="text-xs text-slate-500">{visits.length} σύνολο</span>
            )}
          </div>

          {visitsLoading ? (
            <div className="text-sm text-slate-400">Φόρτωση...</div>
          ) : visits.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Καμία επίσκεψη ακόμα</div>
          ) : (
            <div className="space-y-2">
              {visits.slice(0, showAllVisits ? undefined : 5).map((v: any) => {
                const isExpanded = expandedVisitId === v.id;
                const isEditing = editingVisitInCustomer === v.id;
                const isPlaying = cvPlayingMemoId === v.id;

                return (
                  <div key={v.id} className="border border-slate-100 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedVisitId(isExpanded ? null : v.id)}
                      className="w-full flex items-start justify-between py-2.5 px-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-700">{formatDate(v.visit_date)}</div>
                        {v.notes && <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{v.notes}</div>}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {v.visit_type && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{v.visit_type}</span>}
                          {(v as any).outcome && (
                            <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">
                              🚫 {({ not_in: 'Δεν ήταν εκεί', closed: 'Κλειστό', rescheduled: 'Αναβλήθηκε', no_answer: 'Δεν απάντησε', no_time: 'Δεν πρόλαβα' } as Record<string, string>)[(v as any).outcome] ?? (v as any).outcome}
                            </span>
                          )}
                          {v.voice_memo_path && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-500 rounded flex items-center gap-1">
                              <Mic className="w-3 h-3" /> Memo
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {v.owner_name && <span className="text-xs text-slate-400">{v.owner_name}</span>}
                        {(() => {
                          const tasks = v.crm_visit_tasks ?? [];
                          const overdue = tasks.filter((t: any) => t.status !== 'completed' && t.reminder_date && t.reminder_date < today);
                          const todayDue = tasks.filter((t: any) => t.status !== 'completed' && t.reminder_date === today);
                          const pending = tasks.filter((t: any) => t.status !== 'completed');
                          if (overdue.length > 0) return (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-800 text-white rounded-full text-xs font-bold">
                              <Bell className="w-3 h-3" />{overdue.length}
                            </span>
                          );
                          if (todayDue.length > 0) return (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-400 text-amber-900 rounded-full text-xs font-bold">
                              <Bell className="w-3 h-3" />{todayDue.length}
                            </span>
                          );
                          if (pending.length > 0) return (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
                              <Bell className="w-3 h-3" />{pending.length}
                            </span>
                          );
                          return null;
                        })()}
                        <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 pt-2 bg-slate-50 border-t border-slate-100 space-y-3">

                        {!isEditing && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => startEditVisitInCustomer(v)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-300 text-slate-600 rounded-lg text-xs hover:bg-slate-50"
                            >
                              <Pencil className="w-3 h-3" /> Επεξεργασία
                            </button>
                            {v.voice_memo_path && (
                              <>
                                <button
                                  onClick={() => playCvMemo(v.id)}
                                  disabled={cvMemoLoading[v.id]}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-purple-300 text-purple-600 rounded-lg text-xs hover:bg-purple-50 disabled:opacity-50"
                                >
                                  {cvMemoLoading[v.id] ? (
                                    <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                  ) : isPlaying ? (
                                    <Pause className="w-3 h-3" />
                                  ) : (
                                    <Mic className="w-3 h-3" />
                                  )}
                                  {cvMemoLoading[v.id] ? 'Loading...' : isPlaying ? 'Pause' : 'Play Memo'}
                                </button>
                                {cvMemoUrls[v.id] && (
                                  <audio ref={el => { cvAudioRefs.current[v.id] = el; }} src={cvMemoUrls[v.id]} className="hidden" />
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {isEditing && (
                          <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-3">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Επεξεργασία Επίσκεψης</div>
                            <SmartDateInput label="Ημερομηνία" value={cvEditDate} onChange={setCvEditDate} hint={false} />
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Τύπος</label>
                              <select value={cvEditType} onChange={e => setCvEditType(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500">
                                {['in-person', 'phone', 'video', 'other'].map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Σημειώσεις</label>
                              <textarea value={cvEditNotes} onChange={e => setCvEditNotes(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 min-h-[80px]" />
                            </div>
                            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Κατηγορίες</label>
              <CategorySelector
                allCategories={allCategories}
                selected={cvEditCategories}
                onChange={setCvEditCategories}
              />
            </div>
                            <div className="flex gap-2">
                              <button onClick={() => saveEditVisitInCustomer(v.id)} disabled={cvEditSaving}
                                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                                {cvEditSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}
                              </button>
                              <button onClick={() => setEditingVisitInCustomer(null)}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">
                                Ακύρωση
                              </button>
                            </div>
                          </div>
                        )}

                        {!isEditing && (v.crm_visit_tasks ?? []).length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                              Εργασίες ({(v.crm_visit_tasks ?? []).filter((t: any) => t.status === 'completed').length}/{(v.crm_visit_tasks ?? []).length})
                            </div>
                            <div className="space-y-2">
                              {(v.crm_visit_tasks ?? []).map((task: any) => {
                                const isOverdue = task.status !== 'completed' && task.reminder_date && task.reminder_date < today;
                                const isTodayDue = task.status !== 'completed' && task.reminder_date === today;
                                const isRenewing = renewingTaskId === task.id;
                                return (
                                  <div key={task.id} className={`rounded-lg border p-2.5 text-xs ${isOverdue ? 'border-red-200 bg-red-50' : isTodayDue ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-start gap-2 flex-1 min-w-0">
                                        {task.status === 'completed'
                                          ? <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                                          : task.status === 'in-progress'
                                          ? <Clock className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                                          : isOverdue
                                          ? <Bell className="w-3.5 h-3.5 text-red-700 mt-0.5 shrink-0" />
                                          : isTodayDue
                                          ? <Bell className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                                          : <AlertCircle className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />}
                                        <div className="min-w-0">
                                          <p className={`${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.description}</p>
                                          {task.reminder_date && (
                                            <div className={`mt-0.5 ${isOverdue ? 'text-red-600 font-medium' : isTodayDue ? 'text-amber-700 font-medium' : 'text-slate-400'}`}>
                                              📅 {task.reminder_date}
                                              {isOverdue && ' — Ληξιπρόθεσμη'}
                                              {isTodayDue && ' — Σήμερα'}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {task.status !== 'completed' && (
                                          <button onClick={() => updateTaskStatus(task.id, 'completed', v.id)} disabled={taskUpdating === task.id}
                                            className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50" title="Ολοκλήρωση">
                                            <CheckCircle className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        {task.status === 'not-started' && (
                                          <button onClick={() => updateTaskStatus(task.id, 'in-progress', v.id)} disabled={taskUpdating === task.id}
                                            className="p-1.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50" title="Σε εξέλιξη">
                                            <PlayCircle className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        {task.status !== 'completed' && (
                                          <button onClick={() => { setRenewingTaskId(task.id); setRenewDate(''); }}
                                            className="p-1.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200" title="Ανανέωση υπενθύμισης">
                                            <CalendarClock className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    {isRenewing && (
                                      <div className="mt-2 space-y-1.5">
                                        {task.reminder_date && (
                                          <div className="text-xs text-slate-400">
                                            Τρέχουσα υπενθύμιση: <span className="font-medium text-slate-600">{task.reminder_date}</span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                          <input type="date" value={renewDate} onChange={e => setRenewDate(e.target.value)}
                                            className="px-2 py-1 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500" />
                                          <button onClick={() => renewTaskReminder(task.id, v.id)} disabled={!renewDate || taskUpdating === task.id}
                                            className="px-2 py-1 bg-indigo-600 text-white rounded text-xs disabled:opacity-50">Ανανέωση</button>
                                          <button onClick={() => setRenewingTaskId(null)}
                                            className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">×</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {!isEditing && v.notes && (
                          <div>
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Σημειώσεις</div>
                            <p className="text-sm text-slate-600">{v.notes}</p>
                          </div>
                        )}

                        {!isEditing && (v.shop_profile || v.competitor_info) && (
                          <div className="space-y-2">
                            {v.shop_profile && (v.shop_profile.shop_type || v.shop_profile.number_of_employees || v.shop_profile.shop_size_m2 || v.shop_profile.stock_behavior || v.shop_profile.vehicle_types?.length > 0 || v.shop_profile.vehicle_brands?.length > 0) && (
                              <div>
                                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Προφίλ Καταστήματος</div>
                                <div className="space-y-1 text-xs text-slate-600">
                                  {v.shop_profile.shop_type && <div className="flex justify-between"><span className="text-slate-400">Τύπος</span><span>{SHOP_TYPE_LABELS[v.shop_profile.shop_type] ?? v.shop_profile.shop_type}</span></div>}
                                  {v.shop_profile.vehicle_types?.length > 0 && <div className="flex justify-between gap-2"><span className="text-slate-400 shrink-0">Οχήματα</span><span className="text-right">{v.shop_profile.vehicle_types.join(', ')}</span></div>}
                                  {v.shop_profile.vehicle_brands?.length > 0 && <div className="flex justify-between gap-2"><span className="text-slate-400 shrink-0">Μάρκες</span><span className="text-right">{v.shop_profile.vehicle_brands.join(', ')}</span></div>}
                                  {v.shop_profile.number_of_employees && <div className="flex justify-between"><span className="text-slate-400">Εργαζόμενοι</span><span>{v.shop_profile.number_of_employees}</span></div>}
                                  {v.shop_profile.shop_size_m2 && <div className="flex justify-between"><span className="text-slate-400">Εμβαδό</span><span>{v.shop_profile.shop_size_m2} m²</span></div>}
                                  {v.shop_profile.stock_behavior && <div className="flex justify-between"><span className="text-slate-400">Απόθεμα</span><span>{v.shop_profile.stock_behavior}</span></div>}
                                </div>
                              </div>
                            )}
                            {v.competitor_info && (() => {
                              const ci = v.competitor_info;
                              const comps: any[] = Array.isArray(ci.competitors_v2) ? ci.competitors_v2 : [];
                              const hasData = comps.length > 0 || ci.main_competitor || ci.other_competitors || ci.estimated_monthly_spend || ci.competitor_strengths || ci.switch_reason;
                              if (!hasData) return null;
                              return (
                                <div>
                                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Ανταγωνισμός</div>
                                  <div className="space-y-1 text-xs text-slate-600">
                                    {comps.length > 0 && comps.map((c: any) => (
                                      <div key={c.name} className="flex items-center gap-1.5">
                                        {c.isPrimary && <span className="text-amber-500">★</span>}
                                        <span className={c.isPrimary ? 'font-medium' : ''}>{c.name}</span>
                                        {c.notes && <span className="text-slate-400 truncate">— {c.notes}</span>}
                                      </div>
                                    ))}
                                    {!comps.length && ci.main_competitor && <div className="flex justify-between"><span className="text-slate-400">Κύριος</span><span className="font-medium">{ci.main_competitor}</span></div>}
                                    {!comps.length && ci.other_competitors && <div className="flex justify-between"><span className="text-slate-400">Άλλοι</span><span>{ci.other_competitors}</span></div>}
                                    {ci.estimated_monthly_spend && <div className="flex justify-between"><span className="text-slate-400">Μηνιαία Δαπάνη</span><span className="font-medium text-green-600">€{Number(ci.estimated_monthly_spend).toLocaleString('el-GR')}</span></div>}
                                    {ci.competitor_strengths && <div><div className="text-slate-400 mb-0.5">Δυνατά σημεία</div><div className="bg-white rounded p-1.5">{ci.competitor_strengths}</div></div>}
                                    {ci.switch_reason && <div><div className="text-slate-400 mb-0.5">Λόγος αλλαγής</div><div className="bg-white rounded p-1.5">{ci.switch_reason}</div></div>}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })}

              {visits.length > 5 && (
                <button onClick={() => setShowAllVisits(prev => !prev)} className="text-xs text-indigo-500 hover:text-indigo-700 pt-1">
                  {showAllVisits ? 'Εμφάνιση λιγότερων' : `+${visits.length - 5} ακόμα επισκέψεις`}
                </button>
              )}
            </div>
          )}
        </section>

        {/* CATEGORY INTELLIGENCE */}
        <section id="section-categories" className="bg-white rounded-xl shadow p-5">
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

        {/* ORDERS & INVOICES */}
        <div ref={docsRef} id="section-docs" className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-semibold">Παραγγελίες & Τιμολόγια</h2>
            </div>
            <select value={docPeriodIdx} onChange={e => setDocPeriodIdx(Number(e.target.value))} className="text-xs border border-slate-300 rounded-lg px-2 py-1 text-slate-600 focus:ring-2 focus:ring-indigo-500">
              {DOC_PERIODS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
            </select>
          </div>

          {(!docsLoading && documents.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{displayCounts.order} παραγγελίες</span>
              <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">{displayCounts.invoice} τιμολόγια</span>
              {displayCounts.credit > 0 && <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">{displayCounts.credit} πιστωτικά</span>}
            </div>
          )}

          {!balanceLoading && balance !== null && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${balance.balance > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                <AlertCircle className="w-3 h-3" />
                Υπόλοιπο €{Math.abs(balance.balance).toLocaleString('el-GR', { minimumFractionDigits: 2 })}
              </span>
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
                          {doc.disc1prc ? <span className="text-xs text-slate-400">-{doc.disc1prc}%</span> : null}
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {isExpanded && renderDocLines(doc.findoc, doc.sumamnt ?? null)}
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
        </div>

{showMap && (
  <CustomerMap
    currentUser={currentUser}
    singleCustomer={{ code: customer.code, name: customer.name, address: customer.address, city: customer.city, area: customer.area }}
    onClose={() => setShowMap(false)}
  />
)}

       {/* WORD CLOUD */}
        <section id="section-wordcloud" className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center gap-2 mb-4">
            <CloudIcon className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-semibold">Ανάλυση Αγορών — Τελευταία 3 Χρόνια</h2>
          </div>
          <CustomerWordCloud customerCode={String(customer.code)} />
        </section>

        {/* STANDALONE COMMENTS */}
        <section id="section-comments" className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold">Σχόλια & Σημειώσεις</h2>
              {standaloneComments.length > 0 && (
                <span className="text-xs text-slate-400">{standaloneComments.length}</span>
              )}
            </div>
            <button onClick={() => setAddingComment(v => !v)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
              <Plus className="w-3.5 h-3.5" /> Νέο
            </button>
          </div>
          {addingComment && (
            <div className="mb-3 space-y-2">
              <textarea value={newStandaloneComment} onChange={e => setNewStandaloneComment(e.target.value)}
                placeholder="Σχόλιο ή σημείωση για τον πελάτη..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm min-h-[70px] focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-2">
                <button onClick={addStandaloneComment} disabled={!newStandaloneComment.trim()}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">Αποθήκευση</button>
                <button onClick={() => { setAddingComment(false); setNewStandaloneComment(''); }}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs">Ακύρωση</button>
              </div>
            </div>
          )}
          {standaloneComments.length === 0 && !addingComment && (
            <div className="text-sm text-slate-400 italic">Δεν υπάρχουν σχόλια</div>
          )}
          <div className="space-y-2">
            {standaloneComments.map(comment => (
              <div key={comment.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.text}</p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">{comment.user_name} · {new Date(comment.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                {(comment.user_id === currentUser.id || isPrivilegedUser) && (
                  <button onClick={() => deleteStandaloneComment(comment.id)}
                    className="shrink-0 p-1 text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CATEGORY INTELLIGENCE */}
        {!salesLoading && (
          <section id="section-intelligence">
            <CategoryIntelligence
              customerCode={customer.code}
              competitorInfo={competitorInfo}
              salesPeriod={SALES_PERIODS[salesPeriodIdx]}
            />
          </section>
        )}

      </main>

      <NewVisitDialog
        isOpen={showNewVisitDialog}
        onClose={() => setShowNewVisitDialog(false)}
        customers={[{ code: customer.code, name: customer.name, city: customer.city, area: customer.area }]}
        currentUser={currentUser}
        onSave={() => { setShowNewVisitDialog(false); setVisitsRefreshKey(k => k + 1); }}
      />
    </div>
  );
}
