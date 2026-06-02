import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { User, TrendingUp, TrendingDown, LogOut, MapPin, Mail, Users, UserPlus, Bell, Eye, ClipboardList, Search, Clock, BarChart2, ChevronDown, ChevronRight, CalendarDays } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useDashboardFigma } from '../../hooks/useDashboardFigma';

import { NewVisitDialog } from '../visits/NewVisitDialog';
import { VisitsLog } from '../visits/VisitsLog';
import { ProspectsList } from '../prospects/ProspectsList';
import { UnifiedProspectDialog } from '../prospects/UnifiedProspectDialog';
import { CustomerView } from '../customers/CustomerView';
import { ProspectView } from '../customers/ProspectView';
import { CustomerListSection } from '../customers/CustomerListSection';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { VisitCalendar } from '../planning/VisitCalendar';
import { CustomerMap } from '../customers/CustomerMap';

const NOT_VISITED_OPTIONS = [
  { label: 'All', value: null },
  { label: '1 month', value: 30 },
  { label: '3 months', value: 90 },
  { label: '6 months', value: 180 },
  { label: '1 year', value: 365 },
];

const DEFAULT_VISIBLE_ITEMS = 6;
const LONG_PRESS_MS = 1500;

function MultiSelectFilterGroup({
  label,
  selected,
  items,
  onToggle,
  onClear,
}: {
  label: string;
  selected: string[];
  items: string[];
  onToggle: (item: string, multi: boolean) => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [multiMode, setMultiMode] = useState(false);
  
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  
  
  

  const visibleItems = expanded ? items : items.slice(0, DEFAULT_VISIBLE_ITEMS);
  const hasMore = items.length > DEFAULT_VISIBLE_ITEMS;

  const handlePointerDown = useCallback((item: string) => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setMultiMode(true);
      onToggle(item, true);
    }, LONG_PRESS_MS);
  }, [onToggle]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleClick = useCallback((item: string) => {
    if (didLongPress.current) return;
    if (multiMode) {
      onToggle(item, true);
    } else {
      onToggle(item, false);
    }
  }, [multiMode, onToggle]);

  const handleClear = useCallback(() => {
    setMultiMode(false);
    onClear();
  }, [onClear]);

  const selectedLabel = selected.length === 0
    ? 'All'
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selected`;

  return (
    <div>
      <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-2">
        {label}: <span className="text-slate-900">{selectedLabel}</span>
        {multiMode && (
          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-xs rounded-full font-medium">
            Multi-select
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleClear}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            selected.length === 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
          }`}
        >
          All
        </button>
        {visibleItems.map(item => {
          const isSelected = selected.includes(item);
          return (
            <button
              key={item}
              onPointerDown={() => handlePointerDown(item)}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onClick={() => handleClick(item)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors select-none ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
              }`}
            >
              {item}
              {isSelected && multiMode && (
                <span className="ml-1 text-white/70">✓</span>
              )}
            </button>
          );
        })}
        {hasMore && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-dashed border-slate-400 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            {expanded ? 'Show less' : `+${items.length - DEFAULT_VISIBLE_ITEMS} more`}
          </button>
        )}
      </div>
      {multiMode && (
        <p className="text-xs text-slate-400 mt-1.5">
          Long press to add more • <button onClick={() => setMultiMode(false)} className="text-indigo-500 hover:underline">Exit multi-select</button>
        </p>
      )}
    </div>
  );
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

function DrillContent({
  skus, skusLoading,
  topCustomers, topCustomersLoading,
}: {
  catIdKey: string;
  skus: any[]; skusLoading: boolean;
  topCustomers: any[]; topCustomersLoading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'skus' | 'customers'>('skus');

  return (
    <div className="bg-slate-50">
      <div className="flex border-b border-slate-200 px-4 pt-2">
        <button onClick={() => setActiveTab('skus')}
          className={`text-xs font-medium px-3 py-1.5 border-b-2 transition-colors mr-2 ${activeTab === 'skus' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Top SKUs
        </button>
        <button onClick={() => setActiveTab('customers')}
          className={`text-xs font-medium px-3 py-1.5 border-b-2 transition-colors ${activeTab === 'customers' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Top 10 Πελάτες
        </button>
      </div>

      {activeTab === 'skus' && (
        skusLoading ? <div className="px-8 py-3 text-xs text-slate-400">Φόρτωση...</div> :
        skus.length === 0 ? <div className="px-8 py-3 text-xs text-slate-400 italic">Δεν βρέθηκαν προϊόντα</div> :
        <div className="divide-y divide-slate-100">
          {skus.map((sku: any) => (
            <div key={sku.mtrl_id} className="flex items-center justify-between px-8 py-2">
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

      {activeTab === 'customers' && (
        topCustomersLoading ? <div className="px-8 py-3 text-xs text-slate-400">Φόρτωση...</div> :
        topCustomers.length === 0 ? <div className="px-8 py-3 text-xs text-slate-400 italic">Δεν βρέθηκαν πελάτες</div> :
        <div className="divide-y divide-slate-100">
          {topCustomers.map((c: any, i: number) => (
            <div key={c.customer_code} className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-bold w-5 shrink-0 text-center ${i < 3 ? 'text-amber-500' : 'text-slate-400'}`}>#{i + 1}</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-700 truncate">{c.customer_name}</div>
                  <div className="text-xs text-slate-400">{c.city}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <GrowthBadge pct={c.growth_pct ?? null} />
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs text-slate-400">{Math.round(parseFloat(c.qty))} τεμ.</span>
                    <div className="text-xs font-semibold text-slate-700">{fmtEur(parseFloat(c.revenue))}</div>
                  </div>
                  {parseFloat(c.prev_revenue) > 0 && (
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-slate-300">{Math.round(parseFloat(c.prev_qty ?? 0))} τεμ.</span>
                      <div className="text-xs text-slate-400">{fmtEur(parseFloat(c.prev_revenue))}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function generateJoinedPeriodOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3);

  for (let year = currentYear; year >= 2024; year--) {
    const maxQ = year === currentYear ? currentQuarter : 3;
    for (let q = maxQ; q >= 0; q--) {
      const month = String(q * 3 + 1).padStart(2, '0');
      options.push({
        label: `Q${q + 1} ${year}`,
        value: `${year}-${month}-01`,
      });
    }
  }
  return options;
}

const JOINED_PERIOD_OPTIONS = generateJoinedPeriodOptions();

export function DashboardFigma() {
  const [viewAsRepId, setViewAsRepId] = useState<string>('');
  const [repList, setRepList] = useState<any[]>([]);
  const viewAsRep = repList.find(r => r.id === viewAsRepId) ?? null;
  const {
    customers, customersTotal, totalRevenue, compareRevenue, revenueGrowth,
    customersWithSales, salesLoading, areaStats, cityStats, cityLoading,
    selectedGeoArea, drillDownToArea, backToAreas, selectedPeriod, setSelectedPeriod,
    areas, cities,
    selectedAreas, selectedCities, toggleArea, toggleCity, clearAreas, clearCities,
    setSelectedArea, setSelectedCity,
    searchQuery, setSearchQuery, filteredCustomers, getDaysSinceVisit,
    showNewVisitDialog, setShowNewVisitDialog, showUnifiedProspectDialog, setShowUnifiedProspectDialog,
    currentUser, categoryMaster, hasSalesSet,
    salesByCategory, salesByCategoryLoading, salesByCategoryExpanded,
    setSalesByCategoryExpanded, expandSalesByCategory,
    dashboardSkuData, dashboardSkuLoading, fetchDashboardSkus,
    topCustomersData, topCustomersLoading, fetchTopCustomers,
    clearTopCustomersCache, PERIODS, displayedCustomers,
    notVisitedDays, setNotVisitedDays,
    salesFilter, setSalesFilter,
    performanceFilter, setPerformanceFilter,
    activeFilter, setActiveFilter,
    joinedDirection, setJoinedDirection,
    joinedPeriod, setJoinedPeriod,
    customerSortMode, setCustomerSortMode, monthlySales, monthlySalesCompare, monthlySalesLoading,
    monthlySalesExpanded, setMonthlySalesExpanded, fetchMonthlySales, 
    dueTasks, unreadCommentCount, allCustomers,
    taskFilter, setTaskFilter,
    commentFilter, setCommentFilter, 

  } = useDashboardFigma(viewAsRep?.salesman_code ?? null);

  usePushNotifications(currentUser.id);
  useEffect(() => {
  if (!['admin', 'manager', 'exec'].includes(currentUser.role)) return;
const load = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/erp/reps`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const data = await res.json();
  setRepList(data ?? []);
};
  load().catch(console.error);
}, [currentUser.role]);
  
useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { data } = await supabase
          .from('crm_planned_visits')
          .select('customer_code, planned_date, area')
          .gte('planned_date', today)
          .lte('planned_date', twoWeeks)
          .not('customer_code', 'is', null);
        const map = new Map<string, { date: string; area: string }>();
        for (const v of data ?? []) {
          const code = String(v.customer_code);
          if (!map.has(code)) map.set(code, { date: v.planned_date, area: v.area ?? '' });
        }
        setUpcomingPlanned(map);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  const [upcomingPlanned, setUpcomingPlanned] = useState<Map<string, { date: string; area: string }>>(new Map());
  const [showCustomerMap, setShowCustomerMap] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);
  const [visitsRefreshKey, setVisitsRefreshKey] = useState(0);
  const scrollPositionRef = useRef<number>(0);
  const scrollAfterBackRef = useRef<number | null>(null);
  const cameFromCalendarRef = useRef(false);
  const [repOpen, setRepOpen] = useState(false);
  const [mapSingleCustomer, setMapSingleCustomer] = useState<any | null>(null);
  
  const [prospectsRefreshKey, setProspectsRefreshKey] = useState(0);
  const [geoAreasExpanded, setGeoAreasExpanded] = useState(false);
  const [geoCitiesExpanded, setGeoCitiesExpanded] = useState(false);
  const [expandedL1s, setExpandedL1s] = useState<Set<string>>(new Set());
  const [expandedL2s, setExpandedL2s] = useState<Set<string>>(new Set());
  const [expandedL3s, setExpandedL3s] = useState<Set<string>>(new Set());
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(
  (() => { try { return JSON.parse(sessionStorage.getItem('dashboardFilters') ?? '{}').filtersExpanded ?? false; } catch { return false; } })()
);

useEffect(() => {
  const savedY = sessionStorage.getItem('dashboardScrollY');
  if (savedY) {
    setTimeout(() => {
      window.scrollTo({ top: parseInt(savedY), behavior: 'instant' });
      sessionStorage.removeItem('dashboardScrollY');
      sessionStorage.removeItem('dashboardFilters');
    }, 150);
  }
}, []);

useEffect(() => {
  if (!selectedCustomer && !selectedProspect && scrollAfterBackRef.current !== null) {
    const y = scrollAfterBackRef.current;
    scrollAfterBackRef.current = null;
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: 'instant' });
    });
  }
}, [selectedCustomer, selectedProspect]);

  const handleBackToAreas = () => { backToAreas(); setGeoCitiesExpanded(false); };

  const notVisitedCounts = useMemo(() => {
    const counts: Record<number, number> = { 30: 0, 90: 0, 180: 0, 365: 0 };
    for (const c of filteredCustomers) {
      const days = getDaysSinceVisit(c.lastVisitDate);
      if (days > 30) counts[30]++;
      if (days > 90) counts[90]++;
      if (days > 180) counts[180]++;
      if (days > 365) counts[365]++;
    }
    return counts;
  }, [filteredCustomers, getDaysSinceVisit]);

  

  function toggleL1(code: string) { setExpandedL1s(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; }); }
  function toggleL2(code: string) { setExpandedL2s(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; }); }
  function toggleL3(code: string) { setExpandedL3s(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; }); }

  const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'exec';

  const hasActiveFilters = !!(
    selectedAreas.length > 0 || selectedCities.length > 0 || notVisitedDays ||
    searchQuery || salesFilter !== 'all' || performanceFilter !== 'all' ||
    activeFilter !== 'all' || joinedPeriod !== null
  );

  function clearAllFilters() {
    clearAreas();
    clearCities();
    setNotVisitedDays(null);
    setSearchQuery('');
    setSalesFilter('all');
    setPerformanceFilter('all');
    setActiveFilter('all');
    setJoinedPeriod(null);
  }

  const handleAreaToggle = useCallback((area: string, multi: boolean) => {
    if (multi) {
      toggleArea(area);
    } else {
      setSelectedArea(area);
      clearCities();
    }
  }, [toggleArea, setSelectedArea, clearCities]);

  const handleCityToggle = useCallback((city: string, multi: boolean) => {
    if (multi) {
      toggleCity(city);
    } else {
      setSelectedCity(city);
    }
  }, [toggleCity, setSelectedCity]);

  const filteredAreaStats = useMemo(() => {
    if (selectedAreas.length === 0) return areaStats;
    return areaStats.filter(a => selectedAreas.includes(a.area));
  }, [areaStats, selectedAreas]);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ================= HEADER ================= */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white sticky top-0 z-50 shadow-lg" style={{ display: (selectedCustomer || selectedProspect) ? 'none' : undefined }}>
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="shrink-0 cursor-pointer" onClick={() => { setSelectedCustomer(null); setSelectedProspect(null); }}>
              <h1 className="text-lg font-extrabold leading-tight">Aivaliotis CRM</h1>
              <p className="text-blue-200 text-xs">Sales Representative Dashboard</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
  <User className="w-4 h-4" />
  <span className="font-medium text-sm">{currentUser.name}</span>
</div>
{['admin', 'manager', 'exec'].includes(currentUser.role) && repList.length > 0 && (
  <div className="relative">
  <button
    onClick={() => setRepOpen(v => !v)}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-colors"
  >
    <Eye className="w-4 h-4" />
    <span className="hidden sm:block max-w-[120px] truncate">
      {viewAsRepId === currentUser.id ? 'Οι πελάτες μου' : viewAsRep ? viewAsRep.full_name : 'Όλοι οι πελάτες'}
    </span>
    <ChevronDown className="w-3.5 h-3.5 opacity-70" />
  </button>
  {repOpen && (
    <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 min-w-[180px] z-50">
      <button
        onClick={() => { setViewAsRepId(''); clearTopCustomersCache(); setRepOpen(false); }}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors ${!viewAsRepId ? 'text-indigo-600 font-medium' : 'text-slate-700'}`}
      >
        <Eye className="w-4 h-4 shrink-0" />
        Όλοι οι πελάτες
      </button>
      {currentUser.salesman_code && (
        <button
          onClick={() => { setViewAsRepId(currentUser.id); clearTopCustomersCache(); setRepOpen(false); }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors ${viewAsRepId === currentUser.id ? 'text-indigo-600 font-medium' : 'text-slate-700'}`}
        >
          <User className="w-4 h-4 shrink-0" />
          Οι πελάτες μου
        </button>
      )}
      <div className="border-t border-slate-100 my-1" />
      {repList.filter(r => r.id !== currentUser.id && r.salesman_code).map(r => (
        <button
          key={r.id}
          onClick={() => { setViewAsRepId(r.id); clearTopCustomersCache(); setRepOpen(false); }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors ${viewAsRepId === r.id ? 'text-indigo-600 font-medium' : 'text-slate-700'}`}
        >
          <Users className="w-4 h-4 shrink-0" />
          {r.full_name}
        </button>
      ))}
    </div>
  )}
</div>
)}

              <button onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-white/20 pt-2">
            {[
              { icon: <Search className="w-4 h-4" />, id: 'section-filter', roles: null, action: null },
              { icon: <Users className="w-4 h-4" />, id: 'section-customers', roles: null, action: null },
              { icon: <TrendingUp className="w-4 h-4" />, id: 'section-performance', roles: null, action: null },
              { icon: <MapPin className="w-4 h-4" />, id: 'section-geo', roles: null, action: null },
              { icon: <BarChart2 className="w-4 h-4" />, id: 'section-categories', roles: ['admin', 'manager', 'exec'], action: null },
              { icon: <ClipboardList className="w-4 h-4" />, id: 'section-visits', roles: null, action: null },
              { icon: <CalendarDays className="w-4 h-4" />, id: 'section-visits', roles: null, action: () => setShowCalendar(true), title: 'Ημερολόγιο' },
              { icon: <MapPin className="w-4 h-4" />, id: 'section-map', roles: null, action: () => setShowCustomerMap(true), title: 'Χάρτης Πελατών' },
              { icon: <UserPlus className="w-4 h-4" />, id: 'section-prospects', roles: null, action: null },
            ]
              .filter(item => !item.roles || item.roles.includes(currentUser.role))
              .map(({ icon, id, action }, idx) => (
                <button key={`${id}-${idx}`}
                  onClick={() => {
                    if (action) { action(); return; }
                    const el = document.getElementById(id);
                    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/25 rounded-lg transition-colors text-white/90 text-sm font-medium">
                  {icon}
                </button>
              ))}
            {hasActiveFilters && (
              <button onClick={clearAllFilters}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors text-white text-sm font-medium ml-auto">
                × Clear filters
              </button>
            )}
          </div>

          {/* Context bar */}
          {(selectedAreas.length > 0 || selectedCities.length > 0 || notVisitedDays || searchQuery || selectedCustomer || selectedProspect || salesFilter !== 'all' || activeFilter !== 'all' || joinedPeriod !== null) && (
            <div className="flex items-center gap-1.5 border-t border-white/10 pt-1.5 flex-wrap">
              {selectedCustomer ? (
                <>
                  <span className="text-white/40 text-xs">Πελάτης:</span>
                  <span className="text-white/70 text-xs bg-white/10 px-1.5 py-0.5 rounded font-medium">{selectedCustomer.name}</span>
                  <span className="text-white/40 text-xs font-mono">{selectedCustomer.code}</span>
                  {selectedCustomer.area && <span className="text-white/40 text-xs">· {selectedCustomer.area}{selectedCustomer.city && ` › ${selectedCustomer.city}`}</span>}
                </>
              ) : selectedProspect ? (
                <>
                  <span className="text-white/40 text-xs">Prospect:</span>
                  <span className="text-white/70 text-xs bg-white/10 px-1.5 py-0.5 rounded font-medium">{selectedProspect.name}</span>
                  {selectedProspect.area && <span className="text-white/40 text-xs">· {selectedProspect.area}</span>}
                </>
              ) : (
                <>
                  <span className="text-white/40 text-xs">Φίλτρα:</span>
                  
                  {selectedAreas.length > 0 && (
                    <span className="text-white/60 text-xs bg-white/10 px-1.5 py-0.5 rounded">
                      {selectedAreas.length === 1 ? selectedAreas[0] : `${selectedAreas.length} areas`}
                      {selectedCities.length > 0 && ` › ${selectedCities.length === 1 ? selectedCities[0] : `${selectedCities.length} cities`}`}
                    </span>
                  )}
                  {selectedCities.length > 0 && selectedAreas.length === 0 && (
                    <span className="text-white/60 text-xs bg-white/10 px-1.5 py-0.5 rounded">
                      {selectedCities.length === 1 ? selectedCities[0] : `${selectedCities.length} cities`}
                    </span>
                  )}
                  {notVisitedDays && <span className="text-white/60 text-xs bg-white/10 px-1.5 py-0.5 rounded">Δεν επισκέφθηκε {notVisitedDays}+ ημέρες</span>}
                  {searchQuery && <span className="text-white/60 text-xs bg-white/10 px-1.5 py-0.5 rounded">"{searchQuery}"</span>}
                  {salesFilter !== 'all' && <span className="text-white/60 text-xs bg-white/10 px-1.5 py-0.5 rounded">{salesFilter === 'with' ? 'Με πωλήσεις' : 'Χωρίς πωλήσεις'}</span>}
                  {activeFilter !== 'all' && <span className="text-white/60 text-xs bg-white/10 px-1.5 py-0.5 rounded">{activeFilter === 'active' ? 'Active' : 'Inactive'}</span>}
                  {joinedPeriod && (
                    <span className="text-white/60 text-xs bg-white/10 px-1.5 py-0.5 rounded">
                      Joined {joinedDirection} {JOINED_PERIOD_OPTIONS.find(o => o.value === joinedPeriod)?.label}
                    </span>
                  )}
                  <span className="text-white/40 text-xs ml-1">{selectedPeriod.shortLabel}</span>
                </>
              )}
            </div>
          )}
          {/* Task alerts bell */}
          {dueTasks.total > 0 && (
            <button
              onClick={() => {
                setTaskFilter(taskFilter === 'due' ? 'none' : 'due');
                setCommentFilter('none');
                const el = document.getElementById('section-visits');
                if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
              }}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${taskFilter === 'due' ? 'bg-white text-indigo-700' : 'bg-white/10 text-white/90 hover:bg-white/20'}`}
            >
              <Bell className="w-4 h-4" />
              {dueTasks.overdue.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-700 text-white text-xs font-bold">
                  {dueTasks.overdue.length}
                </span>
              )}
              {dueTasks.today.length > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-400 text-amber-900 rounded-full text-xs font-bold">
                  {dueTasks.today.length}
                </span>
              )}
            </button>
          )}

          {/* Unread comments mail */}
          {unreadCommentCount > 0 && (
            <button
              onClick={() => {
                setCommentFilter(commentFilter === 'unread' ? 'none' : 'unread');
                setTaskFilter('none');
                const el = document.getElementById('section-visits');
                if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
              }}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${commentFilter === 'unread' ? 'bg-white text-indigo-700' : 'bg-white/10 text-white/90 hover:bg-white/20'}`}
            >
              <Mail className="w-4 h-4" />
              <span className="px-1.5 py-0.5 bg-red-500 text-white rounded-full text-xs font-bold">
                {unreadCommentCount}
              </span>
            </button>
          )}
        </div>
      </header>
      

      {/* ================= BODY ================= */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6" style={{ display: (selectedCustomer || selectedProspect) ? 'none' : undefined }}>
            <div className="text-sm text-slate-600">
              You have access to <span className="font-semibold text-slate-900">{customersTotal}</span> customers across <span className="font-semibold text-slate-900">{areas.length}</span> areas
            </div>

        {/* ===== FILTERS ===== */}
            <section id="section-filter" className="bg-white rounded-xl shadow p-4 space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setFiltersExpanded(v => !v)}
                  className="flex items-center gap-2 text-base font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
                  <MapPin className="w-4 h-4 text-indigo-500" />
                  Filter Customers
                  {!filtersExpanded && hasActiveFilters && (
                    <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-xs rounded-full font-medium">
                      Active
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${filtersExpanded ? 'rotate-180' : ''}`} />
                </button>
                {hasActiveFilters && (
                  <button onClick={clearAllFilters}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                    × Clear all
                  </button>
                )}
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">Search Customer</div>
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Name, Code (e.g. 10234)" className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
              </div>

              {filtersExpanded && <>
              <MultiSelectFilterGroup
                label="Geographic Area"
                selected={selectedAreas}
                items={areas}
                onToggle={handleAreaToggle}
                onClear={clearAreas}
              />

              {selectedAreas.length > 0 && cities.length > 0 && (
                <MultiSelectFilterGroup
                  label="City"
                  selected={selectedCities}
                  items={cities}
                  onToggle={handleCityToggle}
                  onClear={clearCities}
                />
              )}

              <div>
                <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Not Visited Since</div>
                <div className="flex flex-wrap gap-2">
                  {NOT_VISITED_OPTIONS.map(opt => {
                    const count = opt.value ? notVisitedCounts[opt.value] : filteredCustomers.length;
                    return (
                      <button key={opt.label} onClick={() => setNotVisitedDays(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${notVisitedDays === opt.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'}`}>
                        {opt.label}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${notVisitedDays === opt.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />Πωλήσεις ({selectedPeriod.shortLabel})
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    { label: 'Όλοι', value: 'all' as const },
                    { label: 'Με πωλήσεις', value: 'with' as const },
                    { label: 'Χωρίς πωλήσεις', value: 'without' as const },
                  ]).map(opt => {
                    const count = opt.value === 'all' ? filteredCustomers.length
                      : opt.value === 'with' ? filteredCustomers.filter(c => hasSalesSet.has(String(c.trdr_id))).length
                      : filteredCustomers.filter(c => !hasSalesSet.has(String(c.trdr_id))).length;
                    return (
                      <button key={opt.value} onClick={() => setSalesFilter(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${salesFilter === opt.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'}`}>
                        {opt.label}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${salesFilter === opt.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />Performance ({selectedPeriod.shortLabel})
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    { label: 'Όλοι', value: 'all' as const, icon: undefined },
                    { label: 'Trending Up', value: 'up' as const, icon: <TrendingUp className="w-3 h-3" /> },
                    { label: 'Trending Down', value: 'down' as const, icon: <TrendingDown className="w-3 h-3" /> },
                  ]).map(opt => (
                    <button key={opt.value} onClick={() => setPerformanceFilter(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${performanceFilter === opt.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'}`}>
                      {opt.icon}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />Status
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    { label: 'All', value: 'all' as const },
                    { label: 'Active', value: 'active' as const },
                    { label: 'Inactive', value: 'inactive' as const },
                  ]).map(opt => (
                    <button key={opt.value} onClick={() => setActiveFilter(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${activeFilter === opt.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Since Filter */}
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" />Customer Since
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button onClick={() => setJoinedDirection('after')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                      joinedDirection === 'after'
                        ? 'border-indigo-600 text-indigo-600 bg-indigo-50'
                        : 'border-slate-300 text-slate-700 bg-white hover:border-indigo-400'
                    }`}>
                    Joined after
                  </button>
                  <button onClick={() => setJoinedDirection('before')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                      joinedDirection === 'before'
                        ? 'border-indigo-600 text-indigo-600 bg-indigo-50'
                        : 'border-slate-300 text-slate-700 bg-white hover:border-indigo-400'
                    }`}>
                    Joined before
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setJoinedPeriod(null)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${joinedPeriod === null ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'}`}>
                    All
                  </button>
                  {JOINED_PERIOD_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setJoinedPeriod(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${joinedPeriod === opt.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>}
            </section>

           {/* ===== CUSTOMERS ===== */}
            <div id="section-customers">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-slate-500">Order by:</span>
                <button onClick={() => setCustomerSortMode('name')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${customerSortMode === 'name' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'}`}>
                  Name A–Z
                </button>
                <button onClick={() => setCustomerSortMode('area_then_name')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${customerSortMode === 'area_then_name' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'}`}>
                  Area → Name
                </button>
              </div>

              <CustomerListSection
                title={currentUser.role === 'manager' || currentUser.role === 'admin' || currentUser.role === 'exec' ? 'All Customers' : 'Your Customers'}
                customers={displayedCustomers}
                currentUserRole={currentUser.role}
                upcomingPlanned={upcomingPlanned}
                onSelectCustomer={(customer) => {
                  scrollPositionRef.current = window.scrollY;
                  // Save filter state before navigating
                  sessionStorage.setItem('dashboardScrollY', String(window.scrollY));
                  sessionStorage.setItem('dashboardFilters', JSON.stringify({
                    selectedAreas,
                    selectedCities,
                    notVisitedDays,
                    searchQuery,
                    salesFilter,
                    performanceFilter,
                    activeFilter,
                    joinedDirection,
                    joinedPeriod,
                    customerSortMode,
                    filtersExpanded,
                    periodKey: selectedPeriod.key,
                  }));
                  setSelectedCustomer(customer);
                }}
                 
                getDaysSinceVisit={getDaysSinceVisit}
              onOpenMap={() => setShowCustomerMap(true)}
              />
            </div>

            {/* ===== PERFORMANCE ===== */}
            <section id="section-performance" className="bg-white rounded-xl shadow p-4">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h2 className="text-base font-semibold text-slate-900">{currentUser.role === 'rep' ? 'Your Performance' : 'Team Performance'}</h2>
                  <select value={selectedPeriod.key} onChange={e => setSelectedPeriod(e.target.value)} className="text-sm font-medium text-blue-600 bg-transparent border-none outline-none cursor-pointer">
                    {PERIODS.map(p => <option key={p.key} value={p.key}>{p.shortLabel}</option>)}
                  </select>
                  {selectedAreas.length > 0 && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {selectedAreas.length === 1 ? selectedAreas[0] : `${selectedAreas.length} areas`}
                      {selectedCities.length > 0 && ` › ${selectedCities.length === 1 ? selectedCities[0] : `${selectedCities.length} cities`}`}
                      <button onClick={clearAllFilters} className="ml-1 hover:text-indigo-900">×</button>
                    </span>
                  )}
                  {notVisitedDays && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">Not visited {notVisitedDays}+ days</span>}
                  {searchQuery && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">"{searchQuery}"</span>}
                </div>
                <p className="text-xs text-slate-500 mb-4">{selectedPeriod.label}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-sm text-slate-500 mb-1">Total Revenue</div>
                  {salesLoading ? <div className="text-slate-400 text-sm">Loading...</div> : (
                    <>
                      <div className="text-2xl font-bold text-slate-900">€{totalRevenue.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      
                      {revenueGrowth !== null && (
                        <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {revenueGrowth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
                          <span className="text-slate-400 font-normal text-xs ml-1">{selectedPeriod.compareLabel}</span>
                        </div>
                      )}
                      {compareRevenue > 0 && <div className="text-xs text-slate-400 mt-0.5">vs €{compareRevenue.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
                    </>
                  )}
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-sm text-slate-500 mb-1">Customers with Sales</div>
                  {salesLoading ? <div className="text-slate-400 text-sm">Loading...</div> : <div className="text-2xl font-bold text-slate-900">{customersWithSales}</div>}
                </div>
              </div>
              <button onClick={() => {
                if (!monthlySalesExpanded) fetchMonthlySales(selectedPeriod);
                setMonthlySalesExpanded(v => !v);
              }}
                className="w-full flex items-center justify-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 py-2 border-t border-slate-100 mt-4">
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${monthlySalesExpanded ? 'rotate-180' : ''}`} />
                {monthlySalesExpanded ? 'Απόκρυψη ανά μήνα' : 'Εμφάνιση ανά μήνα'}
              </button>

              {monthlySalesExpanded && (
                <div className="mt-3">
                  {monthlySalesLoading ? (
                    <div className="text-xs text-slate-400">Φόρτωση...</div>
                  ) : monthlySales.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">Δεν βρέθηκαν δεδομένα</div>
                  ) : (() => {
                    const maxAmt = Math.max(
                      ...monthlySales.map(m => m.netamnt),
                      ...monthlySalesCompare.map(m => m.netamnt),
                      1
                    );
                    return (
                      <div className="space-y-2">
                        {monthlySales.map((m, i) => {
                          const prevAmt = monthlySalesCompare[i]?.netamnt ?? null;
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
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-indigo-400 inline-block" />{selectedPeriod.shortLabel}</span>
                          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-sm bg-slate-300 inline-block" />{selectedPeriod.compareLabel}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </section>

 

            {/* ===== GEO PERFORMANCE ===== */}
            {areaStats.length > 0 && (
              <section id="section-geo" className="bg-white rounded-xl shadow p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-base font-semibold text-slate-900">{selectedGeoArea ? 'Performance by City' : 'Performance by Area'}</h2>
                    {selectedGeoArea && <span className="text-sm font-medium text-indigo-600">{selectedGeoArea}</span>}
                    {selectedAreas.length > 0 && !selectedGeoArea && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {selectedAreas.length === 1 ? selectedAreas[0] : `${selectedAreas.length} areas selected`}
                        {selectedCities.length > 0 && ` › ${selectedCities.length === 1 ? selectedCities[0] : `${selectedCities.length} cities`}`}
                      </span>
                    )}
                  </div>
                  {selectedGeoArea && <button onClick={handleBackToAreas} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1">← Back to Areas</button>}
                </div>
                <p className="text-xs text-slate-400 mb-4">{selectedPeriod.label} · {selectedPeriod.compareLabel}</p>

                {!selectedGeoArea && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(geoAreasExpanded ? filteredAreaStats : filteredAreaStats.slice(0, 6)).map(area => (
                        <div key={area.area} onClick={() => drillDownToArea(area.area)}
                          className={`bg-slate-50 rounded-xl p-4 border border-slate-100 border-l-4 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all ${selectedAreas.includes(area.area) ? 'border-l-indigo-600 bg-indigo-50' : 'border-l-indigo-500'}`}>
                          <div className="text-sm font-semibold text-slate-900 mb-2">{area.area}</div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <div className="text-xl font-bold text-slate-900">€{area.netAmount.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                            {area.growth !== null && <div className={`text-xs font-medium flex items-center gap-0.5 ${area.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{area.growth >= 0 ? '↑' : '↓'}{Math.abs(area.growth).toFixed(1)}%</div>}
                          </div>
                          
                          <div className="text-xs text-slate-400">{area.customerCount} customers with sales</div>
                          {area.compareAmount > 0 && <div className="text-xs text-slate-400 mt-0.5">vs €{area.compareAmount.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>}
                          <div className="text-xs text-indigo-400 mt-2">Click to view cities →</div>
                          
                        </div>
                      ))}
                    </div>
                    {filteredAreaStats.length > 6 && (
                      <button onClick={() => setGeoAreasExpanded(v => !v)} className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors py-2 border border-dashed border-indigo-200 rounded-lg">
                        {geoAreasExpanded ? 'Show less' : `Show all ${filteredAreaStats.length} areas`}
                      </button>
                    )}
                  </>
                )}

                {selectedGeoArea && (
                  cityLoading ? <div className="text-slate-400 text-sm">Loading cities...</div> : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(geoCitiesExpanded ? cityStats : cityStats.slice(0, 6)).map(city => (
                          <div key={`${city.area}|${city.city}`}
                            className={`bg-slate-50 rounded-xl p-4 border border-slate-100 border-l-4 ${selectedCities.includes(city.city) ? 'border-l-indigo-600 bg-indigo-50' : 'border-l-indigo-500'}`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="text-sm font-semibold text-slate-900">{city.city}</div>
                              <div className="text-xs text-slate-400">{city.area}</div>
                            </div>
                            <div className="flex items-baseline gap-2 mb-1">
                              <div className="text-xl font-bold text-slate-900">€{city.netAmount.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                              {city.growth !== null && <div className={`text-xs font-medium flex items-center gap-0.5 ${city.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{city.growth >= 0 ? '↑' : '↓'}{Math.abs(city.growth).toFixed(1)}%</div>}
                            </div>
                            
                            <div className="text-xs text-slate-400">{city.customerCount} customer{city.customerCount !== 1 ? 's' : ''} with sales</div>
                            {city.compareAmount > 0 && <div className="text-xs text-slate-400 mt-0.5">vs €{city.compareAmount.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>}
                          </div>
                        ))}
                      </div>
                      {cityStats.length > 6 && (
                        <button onClick={() => setGeoCitiesExpanded(v => !v)} className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors py-2 border border-dashed border-indigo-200 rounded-lg">
                          {geoCitiesExpanded ? 'Show less' : `Show all ${cityStats.length} cities`}
                        </button>
                      )}
                    </>
                  )
                )}
              </section>
            )}

            {/* ===== SALES BY CATEGORY ===== */}
            {isPrivileged && (
              <section id="section-categories" className="bg-white rounded-xl shadow">
                <button
                  onClick={() => { if (!salesByCategoryExpanded) expandSalesByCategory(); else setSalesByCategoryExpanded(false); }}
                  className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BarChart2 className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-base font-semibold text-slate-900">Sales by Category</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {selectedPeriod.shortLabel} · {selectedPeriod.compareLabel}
                        {selectedAreas.length > 0 && ` · ${selectedAreas.length === 1 ? selectedAreas[0] : `${selectedAreas.length} areas`}`}
                        {selectedCities.length > 0 && ` › ${selectedCities.length === 1 ? selectedCities[0] : `${selectedCities.length} cities`}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {salesByCategoryLoading && <span className="text-xs text-slate-400">Φόρτωση...</span>}
                    {!salesByCategoryExpanded && salesByCategory.length > 0 && <span className="text-xs text-slate-400">{salesByCategory.length} κατηγορίες</span>}
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${salesByCategoryExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {salesByCategoryExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100">
                    {salesByCategoryLoading ? (
                      <div className="py-4 text-sm text-slate-400">Φόρτωση κατηγοριών...</div>
                    ) : salesByCategory.length === 0 ? (
                      <div className="py-4 text-sm text-slate-400 italic">Δεν βρέθηκαν κατηγορίες για αυτή την περίοδο</div>
                    ) : (
                      <div className="space-y-1 mt-3">
                        {salesByCategory.map(group => {
                          const isL1Exp = expandedL1s.has(group.l1_code);
                          const maxGroupRev = Math.max(...salesByCategory.map((g: any) => g.total_revenue), 1);
                          const groupBarPct = Math.max((group.total_revenue / maxGroupRev) * 100, 2);

                          return (
                            <div key={group.l1_code} className="rounded-lg border border-slate-100 overflow-hidden">
                              <button onClick={() => toggleL1(group.l1_code)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${isL1Exp ? 'bg-blue-50 border-b border-blue-100' : 'bg-white hover:bg-slate-50'}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  {isL1Exp ? <ChevronDown className="w-4 h-4 text-blue-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono shrink-0">{group.l1_code}</span>
                                  <span className="text-sm font-medium text-slate-700 truncate">{categoryMaster.get(group.l1_code) ?? `Κατηγορία ${group.l1_code}`}</span>
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
                              {!isL1Exp && (
                                <div className="px-3 pb-2 bg-white">
                                  <div className="w-full bg-slate-100 rounded-sm h-1.5">
                                    <div className="h-1.5 rounded-sm bg-blue-300 transition-all" style={{ width: `${groupBarPct}%` }} />
                                  </div>
                                </div>
                              )}
                              {isL1Exp && (
                                <div className="divide-y divide-slate-50">
                                  {group.l2s.map((l2: any) => {
                                    const l2Key = String(l2.category_code);
                                    const l2IdKey = String(l2.category_id);
                                    const isL2Exp = expandedL2s.has(l2Key);
                                    const maxL2Rev = Math.max(...group.l2s.map((l: any) => l.net_revenue), 1);
                                    const hasL3 = l2.l3s && l2.l3s.length > 0;
                                    const l2Name = l2.full_name ?? categoryMaster.get(l2Key) ?? l2Key;
                                    return (
                                      <div key={l2Key} className="bg-white">
                                        <button onClick={() => { toggleL2(l2Key); if (!isL2Exp) { const effectiveId = l2.category_id ? l2IdKey : l2.l3s?.[0]?.category_id ? String(l2.l3s[0].category_id) : null; if (effectiveId) { fetchDashboardSkus(effectiveId); fetchTopCustomers(effectiveId); } } }}
                                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 text-left">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-3 shrink-0" />
                                            {isL2Exp ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-mono shrink-0">{l2.short_name ?? l2Key}</span>
                                            <span className="text-sm font-medium text-slate-700 truncate">{l2Name}</span>
                                            {hasL3 && <span className="text-xs text-slate-400 shrink-0">({l2.l3s.length} υποκατ.)</span>}
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
                                          <div className="border-t border-slate-100">
                                            {(() => { const effectiveId = l2.category_id ? l2IdKey : l2.l3s?.[0]?.category_id ? String(l2.l3s[0].category_id) : null; return effectiveId ? <DrillContent catIdKey={effectiveId} skus={dashboardSkuData[effectiveId] ?? []} skusLoading={dashboardSkuLoading.has(effectiveId)} topCustomers={topCustomersData[effectiveId] ?? []} topCustomersLoading={topCustomersLoading.has(effectiveId)} /> : null; })()}
                                            {hasL3 && (
                                              <div className="border-t border-slate-200 divide-y divide-slate-100">
                                                <div className="px-4 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide bg-slate-50">Υποκατηγορίες</div>
                                                {l2.l3s.map((l3: any) => {
                                                  const l3Key = String(l3.category_code);
                                                  const l3IdKey = String(l3.category_id);
                                                  const isL3Exp = expandedL3s.has(l3Key);
                                                  const maxL3Rev = Math.max(...l2.l3s.map((x: any) => x.net_revenue), 1);
                                                  return (
                                                    <div key={l3Key} className="bg-white">
                                                      <button onClick={() => { toggleL3(l3Key); if (!isL3Exp) { fetchDashboardSkus(l3IdKey); fetchTopCustomers(l3IdKey); } }}
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
                                                            <div className="flex items-center gap-2 justify-end"><span className="text-xs text-slate-400">{Math.round(l3.total_qty ?? 0)} τεμ.</span><div className="text-sm font-semibold text-slate-700">{fmtEur(l3.net_revenue)}</div></div>
                                                            {l3.prev_qty > 0 && <div className="flex items-center gap-2 justify-end"><span className="text-xs text-slate-300">{Math.round(l3.prev_qty)} τεμ.</span><div className="text-xs text-slate-400">{fmtEur(l3.prev_revenue)}</div></div>}
                                                          </div>
                                                        </div>
                                                      </button>
                                                      <div className="px-4 pb-1 bg-white"><div className="ml-10 w-full bg-slate-100 rounded-sm h-1"><div className="h-1 rounded-sm bg-indigo-200 transition-all" style={{ width: `${Math.max((l3.net_revenue / maxL3Rev) * 100, 2)}%` }} /></div></div>
                                                      {isL3Exp && <DrillContent catIdKey={l3IdKey} skus={dashboardSkuData[l3IdKey] ?? []} skusLoading={dashboardSkuLoading.has(l3IdKey)} topCustomers={topCustomersData[l3IdKey] ?? []} topCustomersLoading={topCustomersLoading.has(l3IdKey)} />}
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
                )}
              </section>
            )}

            {/* ===== VISITS LOG ===== */}
            <div id="section-visits">
              <VisitsLog
              key={`visits-${visitsRefreshKey}`}
              currentUser={currentUser}
              onNewVisit={() => setShowNewVisitDialog(true)}
              customers={allCustomers} 
              taskFilter={taskFilter}
              commentFilter={commentFilter}
              dueTasks={dueTasks}
              onClearFilters={() => { setTaskFilter('none'); setCommentFilter('none'); }}
              onSelectCustomer={(customer) => {
                scrollPositionRef.current = window.scrollY;
                sessionStorage.setItem('dashboardScrollY', String(window.scrollY));
                setSelectedCustomer(customer);
              }}
            />
            </div>

            {/* ===== PROSPECTS ===== */}
            <div id="section-prospects">
              <ProspectsList key={`prospects-${prospectsRefreshKey}`} currentUser={currentUser} onNewProspect={() => setShowUnifiedProspectDialog(true)} onSelectProspect={(prospect) => {
                scrollPositionRef.current = window.scrollY;
                sessionStorage.setItem('dashboardScrollY', String(window.scrollY));
                setSelectedProspect(prospect);
              }} />
            </div>
          
      </main>

      {selectedCustomer && (
        <CustomerView
          customer={selectedCustomer}
          currentUser={currentUser}
          upcomingPlanned={upcomingPlanned}
            onBack={() => {
              scrollAfterBackRef.current = scrollPositionRef.current;
              setSelectedCustomer(null);
              if (cameFromCalendarRef.current) {
                cameFromCalendarRef.current = false;
                setShowCalendar(true);
              }
            }}
        />
      )}
      {selectedProspect && (
        <ProspectView
          prospect={selectedProspect}
            onBack={() => {
              scrollAfterBackRef.current = scrollPositionRef.current;
              setSelectedProspect(null);
              if (cameFromCalendarRef.current) {
                cameFromCalendarRef.current = false;
                setShowCalendar(true);
              }
            }}
        />
      )}

      <NewVisitDialog 
        isOpen={showNewVisitDialog} 
        onClose={() => setShowNewVisitDialog(false)} 
        customers={filteredCustomers.filter(c => c.is_active !== false)}
        onSave={() => { setShowNewVisitDialog(false); setVisitsRefreshKey(k => k + 1); }} 
      />
      <UnifiedProspectDialog
        isOpen={showUnifiedProspectDialog}
        onClose={() => setShowUnifiedProspectDialog(false)}
        areas={areas}
        cities={(area) => customers.filter(c => c.area === area).map(c => c.city).filter((v, i, a) => a.indexOf(v) === i).sort()}
        onViewCustomer={(code) => { const customer = customers.find(c => c.code === code); if (customer) { setShowUnifiedProspectDialog(false); setSelectedCustomer(customer); } }}
        onViewProspect={(_id) => { setShowUnifiedProspectDialog(false); }}
        onSaved={() => { setShowUnifiedProspectDialog(false); setProspectsRefreshKey(k => k + 1); }}
      />

      {(showCustomerMap || mapSingleCustomer) && (
        <CustomerMap
          currentUser={currentUser}
          singleCustomer={mapSingleCustomer ?? undefined}
          onClose={() => { setShowCustomerMap(false); setMapSingleCustomer(null); }}
          onSelectCustomer={(customer) => {
            setShowCustomerMap(false);
            setMapSingleCustomer(null);
            setSelectedCustomer(customer);
          }}
          repList={repList}
        />
      )}

      {showCalendar && (
        <VisitCalendar
          hidden={!!mapSingleCustomer}
  currentUser={viewAsRep ? { ...currentUser, id: viewAsRep.id, name: viewAsRep.full_name, salesman_code: viewAsRep.salesman_code } : currentUser}
          onClose={() => setShowCalendar(false)}
          customers={allCustomers}
          repList={repList}
          onSelectCustomer={(customer) => {
            cameFromCalendarRef.current = true;
            setShowCalendar(false);
            setSelectedCustomer(customer);
          }}
          onOpenCustomerMap={(customer) => setMapSingleCustomer(customer)}
        />
      )}
    </div>
  );
}
