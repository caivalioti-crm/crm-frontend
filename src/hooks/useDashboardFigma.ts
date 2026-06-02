import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Customer } from '../types/customer';
import type { Sale } from '../types/sale';
import { mapErpCustomer } from '../mappers/customerMapper';
import { mapErpSale } from '../mappers/saleMapper';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const FULL_ACCESS_ROLES = ['admin', 'manager', 'exec'];

type SalesRep = {
  id: string;
  name: string;
  role: 'rep' | 'manager' | 'admin' | 'exec';
  salesman_code: string | null;
};

export type Period = {
  key: string;
  label: string;
  shortLabel: string;
  from: string;
  to: string;
  compareFrom: string;
  compareTo: string;
  compareLabel: string;
};

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const _now = new Date();

export function buildPeriods(syncDate: string, invoiceDate?: string): Period[] {
  const labelDate = new Date(syncDate);
  const cutoffDate = new Date(invoiceDate ?? syncDate);
  const ytdTo    = toLocalDateString(new Date(cutoffDate.getFullYear(), cutoffDate.getMonth(), cutoffDate.getDate() + 1));
  const ytdCmpTo = toLocalDateString(new Date(cutoffDate.getFullYear() - 1, cutoffDate.getMonth(), cutoffDate.getDate() + 1));
  const ytdLabel = labelDate.toLocaleString('en-GB', { day: 'numeric', month: 'short' });
  return [
    {
      key: '2026-YTD',
      label: `2026 Year to Date (Jan–${ytdLabel})`,
      shortLabel: `2026 YTD (έως ${ytdLabel})`,
      from: '2026-01-01', to: ytdTo,
      compareFrom: '2025-01-01', compareTo: ytdCmpTo,
      compareLabel: `vs Jan–${ytdLabel} 2025`,
    },
    {
      key: '2026-Q1', label: 'Q1 2026 (Jan–Mar)', shortLabel: 'Q1 2026',
      from: '2026-01-01', to: '2026-03-31',
      compareFrom: '2025-01-01', compareTo: '2025-03-31', compareLabel: 'vs Q1 2025',
    },
    {
      key: '2026-Q2', label: 'Q2 2026 (Apr–Jun)', shortLabel: 'Q2 2026',
      from: '2026-04-01', to: '2026-06-30',
      compareFrom: '2025-04-01', compareTo: '2025-06-30', compareLabel: 'vs Q2 2025',
    },
    {
      key: '2025-FULL', label: '2025 Full Year', shortLabel: '2025 Full Year',
      from: '2025-01-01', to: '2025-12-31',
      compareFrom: '2024-01-01', compareTo: '2024-12-31', compareLabel: 'vs 2024',
    },
    {
      key: '2025-Q4', label: 'Q4 2025 (Oct–Dec)', shortLabel: 'Q4 2025',
      from: '2025-10-01', to: '2025-12-31',
      compareFrom: '2024-10-01', compareTo: '2024-12-31', compareLabel: 'vs Q4 2024',
    },
    {
      key: '2025-Q3', label: 'Q3 2025 (Jul–Sep)', shortLabel: 'Q3 2025',
      from: '2025-07-01', to: '2025-09-30',
      compareFrom: '2024-07-01', compareTo: '2024-09-30', compareLabel: 'vs Q3 2024',
    },
    {
      key: '2025-Q2', label: 'Q2 2025 (Apr–Jun)', shortLabel: 'Q2 2025',
      from: '2025-04-01', to: '2025-06-30',
      compareFrom: '2024-04-01', compareTo: '2024-06-30', compareLabel: 'vs Q2 2024',
    },
    {
      key: '2025-Q1', label: 'Q1 2025 (Jan–Mar)', shortLabel: 'Q1 2025',
      from: '2025-01-01', to: '2025-03-31',
      compareFrom: '2024-01-01', compareTo: '2024-03-31', compareLabel: 'vs Q1 2024',
    },
    {
      key: '2024-FULL', label: '2024 Full Year', shortLabel: '2024 Full Year',
      from: '2024-01-01', to: '2024-12-31',
      compareFrom: '2023-01-01', compareTo: '2023-12-31', compareLabel: 'vs 2023',
    },
  ];
}

export const PERIODS = buildPeriods(toLocalDateString(_now));

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

export function useDashboardFigma(viewAsSalesmanCode?: string | null) {
  /* ===================== SAVED FILTERS (session restore) ===================== */
  const savedFilters = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('dashboardFilters') ?? '{}'); }
    catch { return {}; }
  }, []);

  /* ===================== DATA STATE ===================== */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [compareSales, setCompareSales] = useState<Sale[]>([]);
  const [_areaStatsRpc, setAreaStatsRpc] = useState<any[]>([]);
  const [cityStats, setCityStats] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [repModeOverride, setRepModeOverride] = useState(false);

  const [salesByCategory, setSalesByCategory] = useState<any[]>([]);
  const [salesByCategoryLoading, setSalesByCategoryLoading] = useState(false);
  const [salesByCategoryExpanded, setSalesByCategoryExpanded] = useState(false);

  const [dashboardSkuData, setDashboardSkuData] = useState<Record<string, any[]>>({});
  const [dashboardSkuLoading, setDashboardSkuLoading] = useState<Set<string>>(new Set());
  const [topCustomersData, setTopCustomersData] = useState<Record<string, any[]>>({});
  const [topCustomersLoading, setTopCustomersLoading] = useState<Set<string>>(new Set());

 /* ===================== UI STATE ===================== */
  const [lastSyncDate, setLastSyncDate] = useState<string>(toLocalDateString(_now));
  const [lastInvoiceDate, setLastInvoiceDate] = useState<string>(toLocalDateString(_now));
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>(savedFilters.periodKey ?? '2026-YTD');
  const [selectedGeoArea, setSelectedGeoArea] = useState<string | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<string[]>(savedFilters.selectedAreas ?? []);
  const [selectedCities, setSelectedCities] = useState<string[]>(savedFilters.selectedCities ?? []);
  const [searchQuery, setSearchQuery] = useState<string>(savedFilters.searchQuery ?? '');
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  const [showUnifiedProspectDialog, setShowUnifiedProspectDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState<SalesRep>({
    id: '', role: 'rep', name: 'Loading...', salesman_code: null,
  });
  const [categoryMaster, setCategoryMaster] = useState<Map<string, string>>(new Map());
  const [monthlySales, setMonthlySales] = useState<{month: string; netamnt: number}[]>([]);
  const [monthlySalesCompare, setMonthlySalesCompare] = useState<{month: string; netamnt: number}[]>([]);
  const [monthlySalesLoading, setMonthlySalesLoading] = useState(false);
  const [monthlySalesExpanded, setMonthlySalesExpanded] = useState(false);
  const [dueTasks, setDueTasks] = useState<{ today: any[]; overdue: any[]; total: number }>({ today: [], overdue: [], total: 0 });
  const [unreadCommentCount, setUnreadCommentCount] = useState(0);
  const [taskFilter, setTaskFilter] = useState<'none' | 'due'>('none');
  const [commentFilter, setCommentFilter] = useState<'none' | 'unread'>('none');

  /* ===================== FILTER STATE ===================== */
  const [notVisitedDays, setNotVisitedDays] = useState<number | null>(savedFilters.notVisitedDays ?? null);
  const [salesFilter, setSalesFilter] = useState<'all' | 'with' | 'without'>(savedFilters.salesFilter ?? 'all');
  const [performanceFilter, setPerformanceFilter] = useState<'all' | 'up' | 'down'>(savedFilters.performanceFilter ?? 'all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>(savedFilters.activeFilter ?? 'all');
  const [joinedDirection, setJoinedDirection] = useState<'before' | 'after'>(savedFilters.joinedDirection ?? 'after');
  const [joinedPeriod, setJoinedPeriod] = useState<string | null>(savedFilters.joinedPeriod ?? null);
  const [customerSortMode, setCustomerSortMode] = useState<'name' | 'area_then_name'>(savedFilters.customerSortMode ?? 'name');

  /* ===================== DYNAMIC PERIODS ===================== */
  const periods = useMemo(() => buildPeriods(lastSyncDate, lastInvoiceDate), [lastSyncDate, lastInvoiceDate]);

  const selectedPeriod: Period = useMemo(
    () => periods.find(p => p.key === selectedPeriodKey) ?? periods[0],
    [selectedPeriodKey, periods]
  );

  /* ===================== EFFECTS ===================== */
  useEffect(() => {
    authedFetch('/api/categories')
      .then((data: any[]) => {
        const map = new Map<string, string>();
        if (Array.isArray(data)) {
          data.forEach(c => { if (c.category_code) map.set(String(c.category_code), c.full_name ?? c.category_code); });
        }
        setCategoryMaster(map);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    authedFetch('/api/erp/last-sync-date')
      .then(res => { if (res.date) setLastSyncDate(res.date); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    authedFetch('/api/erp/last-invoice-date')
      .then(res => { if (res.date) setLastInvoiceDate(res.date); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    authedFetch('/api/me')
      .then(profile => setCurrentUser({ id: profile.id, name: profile.full_name, role: profile.role, salesman_code: profile.salesman_code }))
      .catch(console.error);
  }, []);

  useEffect(() => {
    authedFetch('/api/erp/customers')
      .then(res => {
        const items = Array.isArray(res.items) ? res.items : [];
        setCustomers(items.map(mapErpCustomer));
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!currentUser.id) return;
    authedFetch('/api/tasks/due')
      .then(data => setDueTasks(data))
      .catch(console.error);
    authedFetch('/api/comments/unread')
      .then(data => setUnreadCommentCount(data.count ?? 0))
      .catch(console.error);
  }, [currentUser.id]);

  /* ===================== FETCH SALES ===================== */
  const fetchSales = useCallback(async (period: Period) => {
    setSalesLoading(true);
    try {
      const effectiveSalesmanCode = viewAsSalesmanCode ?? (repModeOverride ? currentUser.salesman_code : null);
const salesmanParam = effectiveSalesmanCode ? `&salesmanCode=${effectiveSalesmanCode}` : '';
      const [current, compare, areas] = await Promise.all([
        authedFetch(`/api/erp/sales?from=${period.from}&to=${period.to}${salesmanParam}`),
        authedFetch(`/api/erp/sales?from=${period.compareFrom}&to=${period.compareTo}${salesmanParam}`),
        authedFetch(`/api/erp/sales/by-area?from=${period.from}&to=${period.to}&compareFrom=${period.compareFrom}&compareTo=${period.compareTo}${salesmanParam}`),
      ]);
      setSales(Array.isArray(current) ? current.map(mapErpSale) : []);
      setCompareSales(Array.isArray(compare) ? compare.map(mapErpSale) : []);
      setAreaStatsRpc(Array.isArray(areas) ? areas : []);
      setCityStats([]);
      setSelectedGeoArea(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSalesLoading(false);
    }
 }, [repModeOverride, currentUser.salesman_code, viewAsSalesmanCode]);

  useEffect(() => { fetchSales(selectedPeriod); }, [selectedPeriod, fetchSales]);

  const fetchMonthlySales = useCallback(async (period: Period) => {
  setMonthlySalesLoading(true);
  try {
    const effectiveSalesmanCode = viewAsSalesmanCode ?? (repModeOverride ? currentUser.salesman_code : null);
const salesmanParam = effectiveSalesmanCode ? `&salesmanCode=${effectiveSalesmanCode}` : '';
    const [current, compare] = await Promise.all([
      authedFetch(`/api/erp/sales/monthly?from=${period.from}&to=${period.to}${salesmanParam}`),
      authedFetch(`/api/erp/sales/monthly?from=${period.compareFrom}&to=${period.compareTo}${salesmanParam}`),
    ]);
    setMonthlySales(Array.isArray(current) ? current : []);
    setMonthlySalesCompare(Array.isArray(compare) ? compare : []);
  } catch (err) {
    console.error(err);
  } finally {
    setMonthlySalesLoading(false);
  }
}, [repModeOverride, currentUser.salesman_code, viewAsSalesmanCode]);

  useEffect(() => {
    if (monthlySalesExpanded) fetchMonthlySales(selectedPeriod);
  }, [selectedPeriod, monthlySalesExpanded, fetchMonthlySales]);



  /* ===================== FETCH SALES BY CATEGORY ===================== */
  const fetchSalesByCategory = useCallback(async (period: Period, areas: string[], cities: string[]) => {
    setSalesByCategoryLoading(true);
    setSalesByCategory([]);
    setDashboardSkuData({});
    setTopCustomersData({});
    try {
      const params = new URLSearchParams({
        from: period.from, to: period.to,
        prevFrom: period.compareFrom, prevTo: period.compareTo,
      });
      if (areas.length === 1) params.set('area', areas[0]);
      if (cities.length === 1) params.set('city', cities[0]);
      const effectiveSalesmanCode = viewAsSalesmanCode ?? (repModeOverride ? currentUser.salesman_code : null);
if (effectiveSalesmanCode) params.set('salesmanCode', effectiveSalesmanCode);
      const data = await authedFetch(`/api/erp/sales-by-category?${params.toString()}`);
      setSalesByCategory(data.grouped ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setSalesByCategoryLoading(false);
    }
  }, [repModeOverride, currentUser.salesman_code, viewAsSalesmanCode]);

  useEffect(() => {
    if (salesByCategoryExpanded) {
      fetchSalesByCategory(selectedPeriod, selectedAreas, selectedCities);
    }
  }, [selectedPeriod, selectedAreas, selectedCities, salesByCategoryExpanded, repModeOverride, fetchSalesByCategory]);

  const expandSalesByCategory = useCallback(() => {
    if (!FULL_ACCESS_ROLES.includes(currentUser.role)) return;
    setSalesByCategoryExpanded(true);
    if (salesByCategory.length === 0) {
      fetchSalesByCategory(selectedPeriod, selectedAreas, selectedCities);
    }
  }, [currentUser.role, salesByCategory.length, selectedPeriod, selectedAreas, selectedCities, fetchSalesByCategory]);



  /* ===================== FETCH SKUs ===================== */
  const fetchDashboardSkus = useCallback(async (categoryId: string) => {
    if (dashboardSkuData[categoryId] || dashboardSkuLoading.has(categoryId)) return;
    const params = new URLSearchParams({ from: selectedPeriod.from, to: selectedPeriod.to });
    if (selectedAreas.length === 1) params.set('area', selectedAreas[0]);
    if (selectedCities.length === 1) params.set('city', selectedCities[0]);
    const effectiveSalesmanCode = viewAsSalesmanCode ?? (repModeOverride ? currentUser.salesman_code : null);
if (effectiveSalesmanCode) params.set('salesmanCode', effectiveSalesmanCode);
    setDashboardSkuLoading(prev => new Set(prev).add(categoryId));
    try {
      const data = await authedFetch(`/api/erp/skus-by-category?${params.toString()}&categoryId=${categoryId}`);
      setDashboardSkuData(prev => ({ ...prev, [categoryId]: data[categoryId] ?? [] }));
    } catch (err) {
      console.error(err);
    } finally {
      setDashboardSkuLoading(prev => { const n = new Set(prev); n.delete(categoryId); return n; });
    }
  }, [selectedPeriod, selectedAreas, selectedCities, dashboardSkuData, dashboardSkuLoading, repModeOverride, currentUser.salesman_code, viewAsSalesmanCode]);

  /* ===================== FETCH TOP CUSTOMERS ===================== */
  const fetchTopCustomers = useCallback(async (categoryId: string) => {
    if (topCustomersData[categoryId] || topCustomersLoading.has(categoryId)) return;
    const params = new URLSearchParams({
      from: selectedPeriod.from, to: selectedPeriod.to,
      prevFrom: selectedPeriod.compareFrom, prevTo: selectedPeriod.compareTo,
      categoryId,
    });
    if (selectedAreas.length === 1) params.set('area', selectedAreas[0]);
    if (selectedCities.length === 1) params.set('city', selectedCities[0]);
    const effectiveSalesmanCode = viewAsSalesmanCode ?? (repModeOverride ? currentUser.salesman_code : null);
if (effectiveSalesmanCode) params.set('salesmanCode', effectiveSalesmanCode);
    setTopCustomersLoading(prev => new Set(prev).add(categoryId));
    try {
      const data = await authedFetch(`/api/erp/top-customers-by-category?${params.toString()}`);
      setTopCustomersData(prev => ({ ...prev, [categoryId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error(err);
    } finally {
      setTopCustomersLoading(prev => { const n = new Set(prev); n.delete(categoryId); return n; });
    }
  }, [selectedPeriod, selectedAreas, selectedCities, topCustomersData, topCustomersLoading, repModeOverride, currentUser.salesman_code, viewAsSalesmanCode]);

  /* ===================== PERIOD SETTER ===================== */
  const setSelectedPeriod = useCallback((periodKey: string) => {
    setSelectedPeriodKey(periodKey);
  }, []);

  /* ===================== MULTI-SELECT TOGGLES ===================== */
  const toggleArea = useCallback((area: string) => {
    setSelectedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
    setSelectedCities([]);
  }, []);

  const toggleCity = useCallback((city: string) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
    setSelectedAreas([]);
  }, []);

  const clearAreas = useCallback(() => { setSelectedAreas([]); setSelectedCities([]); }, []);
  const clearCities = useCallback(() => setSelectedCities([]), []);

  /* ===================== GEO DRILL-DOWN ===================== */
  const drillDownToArea = useCallback(async (area: string) => {
    setSelectedGeoArea(area);
    setCityLoading(true);
    try {
      const effectiveSalesmanCode = viewAsSalesmanCode ?? (repModeOverride ? currentUser.salesman_code : null);
const salesmanParam = effectiveSalesmanCode ? `&salesmanCode=${effectiveSalesmanCode}` : '';
      const data = await authedFetch(
        `/api/erp/sales/by-city?from=${selectedPeriod.from}&to=${selectedPeriod.to}&compareFrom=${selectedPeriod.compareFrom}&compareTo=${selectedPeriod.compareTo}&area=${encodeURIComponent(area)}${salesmanParam}`
      );
      setCityStats(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setCityLoading(false);
    }
  }, [selectedPeriod, repModeOverride, currentUser.salesman_code, viewAsSalesmanCode]);

  const backToAreas = useCallback(() => { setSelectedGeoArea(null); setCityStats([]); }, []);

  /* ===================== VISIT INTELLIGENCE ===================== */
  const getDaysSinceVisit = (lastVisitDate: string | undefined | null): number => {
    if (!lastVisitDate) return 99999;
    const now = new Date();
    const lastVisit = new Date(lastVisitDate);
    if (isNaN(lastVisit.getTime())) return 99999;
    return Math.ceil(Math.abs(now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
  };

  /* ===================== CUSTOMER SCOPING ===================== */
const scopedCustomers = useMemo(() => {
  const code = viewAsSalesmanCode ?? (repModeOverride ? currentUser.salesman_code : null);
  if (code) return customers.filter(c => c.salesmanCode === code);
  return customers;
}, [customers, repModeOverride, currentUser.salesman_code, viewAsSalesmanCode]);

  const customerByTrdrId = useMemo(() => {
    const map = new Map<string, Customer>();
    scopedCustomers.forEach(c => { if (c.trdr_id) map.set(String(c.trdr_id), c); });
    return map;
  }, [scopedCustomers]);

  /* ===================== SCOPED SALES ===================== */
  const scopedSales = useMemo(() => {
    const ids = new Set(scopedCustomers.map(c => String(c.trdr_id)));
    return sales.filter(s => ids.has(String(s.customerCode)));
  }, [sales, scopedCustomers]);

  const scopedCompareSales = useMemo(() => {
    const ids = new Set(scopedCustomers.map(c => String(c.trdr_id)));
    return compareSales.filter(s => ids.has(String(s.customerCode)));
  }, [compareSales, scopedCustomers]);

  /* ===================== GEO OPTIONS ===================== */
  const areas = useMemo(() => Array.from(new Set(scopedCustomers.map(c => c.area))).sort(), [scopedCustomers]);

  const cities = useMemo(() => {
    if (selectedAreas.length === 0) return [];
    return Array.from(new Set(
      scopedCustomers
        .filter(c => selectedAreas.includes(c.area))
        .map(c => c.city)
    )).sort();
  }, [scopedCustomers, selectedAreas]);

  /* ===================== FILTERED CUSTOMERS (area/city/search) ===================== */
  const filteredCustomers = useMemo(() => scopedCustomers.filter(c => {
    if (selectedAreas.length > 0 && !selectedAreas.includes(c.area)) return false;
    if (selectedCities.length > 0 && !selectedCities.includes(c.city)) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.code.includes(searchQuery)) return false;
    return true;
  }), [scopedCustomers, selectedAreas, selectedCities, searchQuery]);

  /* ===================== REVENUE MAPS (for performance filter) ===================== */
  const currentRevMap = useMemo(() => {
    const map = new Map<string, number>();
    scopedSales.forEach(s => {
      const key = String(s.customerCode);
      map.set(key, (map.get(key) ?? 0) + s.netAmount);
    });
    return map;
  }, [scopedSales]);

  const compareRevMap = useMemo(() => {
    const map = new Map<string, number>();
    scopedCompareSales.forEach(s => {
      const key = String(s.customerCode);
      map.set(key, (map.get(key) ?? 0) + s.netAmount);
    });
    return map;
  }, [scopedCompareSales]);

  const hasSalesSet = useMemo(() => new Set(scopedSales.map(s => String(s.customerCode))), [scopedSales]);

  /* ===================== FULLY FILTERED CUSTOMER IDs ===================== */
  const fullyFilteredCustomerIds = useMemo(() => {
    let result = filteredCustomers;

    if (notVisitedDays) {
      result = result.filter(c => getDaysSinceVisit(c.lastVisitDate) > notVisitedDays);
    }
    if (salesFilter === 'with') {
      result = result.filter(c => hasSalesSet.has(String(c.trdr_id)));
    }
    if (salesFilter === 'without') {
      result = result.filter(c => !hasSalesSet.has(String(c.trdr_id)));
    }
    if (performanceFilter !== 'all') {
      result = result.filter(c => {
        const key = String(c.trdr_id);
        const curr = currentRevMap.get(key) ?? 0;
        const prev = compareRevMap.get(key) ?? 0;
        const g = prev === 0 ? null : ((curr - prev) / prev) * 100;
        if (performanceFilter === 'up') return g === null || g >= 0;
        if (performanceFilter === 'down') return g !== null && g < 0;
        return true;
      });
    }
    if (activeFilter === 'active') {
      result = result.filter(c => c.is_active === true || (c.is_active as any) === 'true');
    }
    if (activeFilter === 'inactive') {
      result = result.filter(c => c.is_active === false || (c.is_active as any) === 'false');
    }
    if (joinedPeriod) {
      result = result.filter(c => {
        if (!c.inserted_date) return true;
        if (joinedDirection === 'after') return c.inserted_date >= joinedPeriod;
        if (joinedDirection === 'before') return c.inserted_date < joinedPeriod;
        return true;
      });
    }
    return new Set(result.map(c => String(c.trdr_id)));
  }, [
    filteredCustomers, notVisitedDays, getDaysSinceVisit,
    salesFilter, hasSalesSet,
    performanceFilter, currentRevMap, compareRevMap,
    activeFilter, joinedDirection, joinedPeriod,
  ]);

  /* ===================== GEO+ALL FILTERED SALES ===================== */
  const geoFilteredSales = useMemo(() =>
    scopedSales.filter(s => fullyFilteredCustomerIds.has(String(s.customerCode))),
    [scopedSales, fullyFilteredCustomerIds]
  );

  const geoFilteredCompareSales = useMemo(() =>
    scopedCompareSales.filter(s => fullyFilteredCustomerIds.has(String(s.customerCode))),
    [scopedCompareSales, fullyFilteredCustomerIds]
  );

  /* ===================== KPIs ===================== */
  const totalRevenue   = useMemo(() => geoFilteredSales.reduce((sum, s) => sum + s.netAmount, 0), [geoFilteredSales]);
  const compareRevenue = useMemo(() => geoFilteredCompareSales.reduce((sum, s) => sum + s.netAmount, 0), [geoFilteredCompareSales]);
  const revenueGrowth  = useMemo(() => compareRevenue === 0 ? null : ((totalRevenue - compareRevenue) / compareRevenue) * 100, [totalRevenue, compareRevenue]);
  const customersWithSales = useMemo(() => new Set(geoFilteredSales.map(s => s.customerCode)).size, [geoFilteredSales]);
  const customersWithSalesSet = useMemo(() => new Set(geoFilteredSales.map(s => String(s.customerCode))), [geoFilteredSales]);

  
/* ===================== CLIENT-SIDE AREA STATS ===================== */
const areaStats = useMemo(() => {
  const currentMap = new Map<string, { revenue: number; customers: Set<string>; qty: number }>();
  const compareMap = new Map<string, { revenue: number; customers: Set<string>; qty: number }>();

  for (const s of geoFilteredSales) {
    const c = customerByTrdrId.get(String(s.customerCode));
    if (!c?.area) continue;
    if (!currentMap.has(c.area)) currentMap.set(c.area, { revenue: 0, customers: new Set(), qty: 0 });
    const entry = currentMap.get(c.area)!;
    entry.revenue += s.netAmount;

    entry.customers.add(String(s.customerCode));
  }

  for (const s of geoFilteredCompareSales) {
    const c = customerByTrdrId.get(String(s.customerCode));
    if (!c?.area) continue;
    if (!compareMap.has(c.area)) compareMap.set(c.area, { revenue: 0, customers: new Set(), qty: 0 });
    const entry = compareMap.get(c.area)!;
    entry.revenue += s.netAmount;
    
    entry.customers.add(String(s.customerCode));
  }

  const allAreas = new Set([...currentMap.keys(), ...compareMap.keys()]);
  return Array.from(allAreas).map(area => {
    const curr = currentMap.get(area);
    const comp = compareMap.get(area);
    const netAmount = curr?.revenue ?? 0;
    const compareAmount = comp?.revenue ?? 0;
    const growth = compareAmount > 0 ? ((netAmount - compareAmount) / compareAmount) * 100 : null;
    return {
      area,
      netAmount,
      compareAmount,
      qty: Math.round(curr?.qty ?? 0),
      customerCount: curr?.customers.size ?? 0,
      growth,
    };
  }).sort((a, b) => b.netAmount - a.netAmount);
}, [geoFilteredSales, geoFilteredCompareSales, customerByTrdrId]);

  /* ===================== CUSTOMERS WITH GROWTH ===================== */
  const customersWithGrowth = useMemo(() => {
    return filteredCustomers.map(c => {
      const key = String(c.trdr_id);
      const curr = currentRevMap.get(key) ?? 0;
      const prev = compareRevMap.get(key) ?? 0;
      const growth_pct = prev === 0 ? null : ((curr - prev) / prev) * 100;
      return { ...c, growth_pct, current_revenue: curr, prev_revenue: prev };
    });
  }, [filteredCustomers, currentRevMap, compareRevMap]);

  /* ===================== DISPLAYED CUSTOMERS (sorted, all filters) ===================== */
  const displayedCustomers = useMemo(() => {
    const filtered = customersWithGrowth.filter(c => fullyFilteredCustomerIds.has(String(c.trdr_id)));
    return [...filtered].sort((a, b) => {
      if (customerSortMode === 'area_then_name') {
        const areaCompare = (a.area ?? '').localeCompare(b.area ?? '');
        if (areaCompare !== 0) return areaCompare;
        return a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [customersWithGrowth, fullyFilteredCustomerIds, customerSortMode]);

  /* ===================== EXPORT ===================== */
  return {
    customers: customersWithGrowth,
    allCustomers: customers,
    displayedCustomers,
    customersTotal: scopedCustomers.length,
    totalRevenue, compareRevenue, revenueGrowth, customersWithSales,
    salesLoading, areaStats, cityStats, cityLoading,
    selectedGeoArea, drillDownToArea, backToAreas,
    selectedPeriod, setSelectedPeriod,
    areas, cities,
    selectedAreas, selectedCities,
    toggleArea, toggleCity, clearAreas, clearCities,
    selectedArea: selectedAreas[0] ?? '',
    selectedCity: selectedCities[0] ?? '',
    setSelectedArea: (a: string) => a ? setSelectedAreas([a]) : setSelectedAreas([]),
    setSelectedCity: (c: string) => c ? setSelectedCities([c]) : setSelectedCities([]),
    searchQuery, setSearchQuery,
    categoryMaster,
    filteredCustomers,
    customersInScope: filteredCustomers.length,
    getDaysSinceVisit,
    showNewVisitDialog, setShowNewVisitDialog,
    showUnifiedProspectDialog, setShowUnifiedProspectDialog,
    currentUser, setCurrentUser,
    customerByTrdrId, scopedSales, customersWithSalesSet, hasSalesSet,
    repModeOverride, setRepModeOverride,
    clearTopCustomersCache: () => { setTopCustomersData({}); setDashboardSkuData({}); },
    salesByCategory, salesByCategoryLoading, salesByCategoryExpanded,
    setSalesByCategoryExpanded, expandSalesByCategory,
    dashboardSkuData, dashboardSkuLoading, fetchDashboardSkus,
    topCustomersData, topCustomersLoading, fetchTopCustomers,
    PERIODS: periods,
    notVisitedDays, setNotVisitedDays,
    salesFilter, setSalesFilter,
    performanceFilter, setPerformanceFilter,
    activeFilter, setActiveFilter,
    joinedDirection, setJoinedDirection,
    joinedPeriod, setJoinedPeriod,
    customerSortMode, setCustomerSortMode,
    fullyFilteredCustomerIds, monthlySales, monthlySalesCompare, monthlySalesLoading,
    monthlySalesExpanded, setMonthlySalesExpanded, fetchMonthlySales, geoFilteredCompareSales, geoFilteredSales, 
    dueTasks, unreadCommentCount, 
    taskFilter, setTaskFilter,
    commentFilter, setCommentFilter,
    };
  }
