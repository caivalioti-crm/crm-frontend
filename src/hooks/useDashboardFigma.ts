import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Customer } from '../types/customer';
import type { Sale } from '../types/sale';
import { mapErpCustomer } from '../mappers/customerMapper';
import { mapErpSale } from '../mappers/saleMapper';

const BASE_URL = 'http://localhost:3001';
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

export const PERIODS: Period[] = [
  { key: '2026-YTD',   label: '2026 Year to Date (Jan-Apr)', shortLabel: '2026 YTD',       from: '2026-01-01', to: '2026-04-30', compareFrom: '2025-01-01', compareTo: '2025-04-30', compareLabel: 'vs Jan-Apr 2025' },
  { key: '2026-Q1',    label: 'Q1 2026 (Jan-Mar)',           shortLabel: 'Q1 2026',         from: '2026-01-01', to: '2026-03-31', compareFrom: '2025-01-01', compareTo: '2025-03-31', compareLabel: 'vs Q1 2025' },
  { key: '2025-FULL',  label: '2025 Full Year',              shortLabel: '2025 Full Year',  from: '2025-01-01', to: '2025-12-31', compareFrom: '2024-01-01', compareTo: '2024-12-31', compareLabel: 'vs 2024' },
  { key: '2025-Q4',    label: 'Q4 2025 (Oct-Dec)',           shortLabel: 'Q4 2025',         from: '2025-10-01', to: '2025-12-31', compareFrom: '2024-10-01', compareTo: '2024-12-31', compareLabel: 'vs Q4 2024' },
  { key: '2025-Q3',    label: 'Q3 2025 (Jul-Sep)',           shortLabel: 'Q3 2025',         from: '2025-07-01', to: '2025-09-30', compareFrom: '2024-07-01', compareTo: '2024-09-30', compareLabel: 'vs Q3 2024' },
  { key: '2025-Q2',    label: 'Q2 2025 (Apr-Jun)',           shortLabel: 'Q2 2025',         from: '2025-04-01', to: '2025-06-30', compareFrom: '2024-04-01', compareTo: '2024-06-30', compareLabel: 'vs Q2 2024' },
  { key: '2025-Q1',    label: 'Q1 2025 (Jan-Mar)',           shortLabel: 'Q1 2025',         from: '2025-01-01', to: '2025-03-31', compareFrom: '2024-01-01', compareTo: '2024-03-31', compareLabel: 'vs Q1 2024' },
  { key: '2024-FULL',  label: '2024 Full Year',              shortLabel: '2024 Full Year',  from: '2024-01-01', to: '2024-12-31', compareFrom: '2023-01-01', compareTo: '2023-12-31', compareLabel: 'vs 2023' },
];

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

export function useDashboardFigma() {
  /* ===================== DATA STATE ===================== */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [compareSales, setCompareSales] = useState<Sale[]>([]);
  const [areaStats, setAreaStats] = useState<any[]>([]);
  const [cityStats, setCityStats] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [repModeOverride, setRepModeOverride] = useState(false);
  
  // Sales by category
  const [salesByCategory, setSalesByCategory] = useState<any[]>([]);
  const [salesByCategoryLoading, setSalesByCategoryLoading] = useState(false);
  const [salesByCategoryExpanded, setSalesByCategoryExpanded] = useState(false);

  // SKU data
  const [dashboardSkuData, setDashboardSkuData] = useState<Record<string, any[]>>({});
  const [dashboardSkuLoading, setDashboardSkuLoading] = useState<Set<string>>(new Set());

  // Top customers data
  const [topCustomersData, setTopCustomersData] = useState<Record<string, any[]>>({});
  const [topCustomersLoading, setTopCustomersLoading] = useState<Set<string>>(new Set());

  /* ===================== UI STATE ===================== */
  const [selectedPeriod, setSelectedPeriodState] = useState<Period>(PERIODS[0]);
  const [selectedGeoArea, setSelectedGeoArea] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  const [showNewProspectDialog, setShowNewProspectDialog] = useState(false);

  const [currentUser, setCurrentUser] = useState<SalesRep>({
    id: '', role: 'rep', name: 'Loading...', salesman_code: null,
  });
  const [categoryMaster, setCategoryMaster] = useState<Map<string, string>>(new Map());

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

  /* ===================== FETCH SALES ===================== */
  const fetchSales = useCallback(async (period: Period) => {
    setSalesLoading(true);
    try {
      const [current, compare, areas] = await Promise.all([
        authedFetch(`/api/erp/sales?from=${period.from}&to=${period.to}`),
        authedFetch(`/api/erp/sales?from=${period.compareFrom}&to=${period.compareTo}`),
        authedFetch(`/api/erp/sales/by-area?from=${period.from}&to=${period.to}&compareFrom=${period.compareFrom}&compareTo=${period.compareTo}`),
      ]);
      setSales(Array.isArray(current) ? current.map(mapErpSale) : []);
      setCompareSales(Array.isArray(compare) ? compare.map(mapErpSale) : []);
      setAreaStats(Array.isArray(areas) ? areas : []);
      setCityStats([]);
      setSelectedGeoArea(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSalesLoading(false);
    }
  }, []);

  useEffect(() => { fetchSales(selectedPeriod); }, [selectedPeriod, fetchSales]);

  /* ===================== FETCH SALES BY CATEGORY ===================== */
  const fetchSalesByCategory = useCallback(async (period: Period, area: string, city: string) => {
    setSalesByCategoryLoading(true);
    setSalesByCategory([]);
    setDashboardSkuData({});
    setTopCustomersData({});
    try {
      const params = new URLSearchParams({
        from: period.from, to: period.to,
        prevFrom: period.compareFrom, prevTo: period.compareTo,
      });
      if (area) params.set('area', area);
      if (city) params.set('city', city);
      if (repModeOverride && currentUser.salesman_code) params.set('salesmanCode', currentUser.salesman_code);
      const data = await authedFetch(`/api/erp/sales-by-category?${params.toString()}`);
      setSalesByCategory(data.grouped ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setSalesByCategoryLoading(false);
    }
  }, [repModeOverride, currentUser.salesman_code]);

  useEffect(() => {
    if (salesByCategoryExpanded) {
      fetchSalesByCategory(selectedPeriod, selectedArea, selectedCity);
    }
  }, [selectedPeriod, selectedArea, selectedCity, salesByCategoryExpanded, repModeOverride, fetchSalesByCategory]);

  const expandSalesByCategory = useCallback(() => {
    if (!FULL_ACCESS_ROLES.includes(currentUser.role)) return;
    setSalesByCategoryExpanded(true);
    if (salesByCategory.length === 0) {
      fetchSalesByCategory(selectedPeriod, selectedArea, selectedCity);
    }
  }, [currentUser.role, salesByCategory.length, selectedPeriod, selectedArea, selectedCity, fetchSalesByCategory]);

  /* ===================== FETCH SKUs ===================== */
  const fetchDashboardSkus = useCallback(async (categoryId: string) => {
    if (dashboardSkuData[categoryId] || dashboardSkuLoading.has(categoryId)) return;
    const params = new URLSearchParams({ from: selectedPeriod.from, to: selectedPeriod.to });
    if (selectedArea) params.set('area', selectedArea);
    if (selectedCity) params.set('city', selectedCity);
    setDashboardSkuLoading(prev => new Set(prev).add(categoryId));
    try {
      const data = await authedFetch(`/api/erp/skus-by-category?${params.toString()}&categoryId=${categoryId}`);
      setDashboardSkuData(prev => ({ ...prev, [categoryId]: data[categoryId] ?? [] }));
    } catch (err) {
      console.error(err);
    } finally {
      setDashboardSkuLoading(prev => { const n = new Set(prev); n.delete(categoryId); return n; });
    }
  }, [selectedPeriod, selectedArea, selectedCity, dashboardSkuData, dashboardSkuLoading]);

  /* ===================== FETCH TOP CUSTOMERS ===================== */
  const fetchTopCustomers = useCallback(async (categoryId: string) => {
    if (topCustomersData[categoryId] || topCustomersLoading.has(categoryId)) return;
    const params = new URLSearchParams({
      from: selectedPeriod.from, to: selectedPeriod.to,
      prevFrom: selectedPeriod.compareFrom, prevTo: selectedPeriod.compareTo,
      categoryId,
    });
    if (selectedArea) params.set('area', selectedArea);
    if (selectedCity) params.set('city', selectedCity);
    setTopCustomersLoading(prev => new Set(prev).add(categoryId));
    try {
      const data = await authedFetch(`/api/erp/top-customers-by-category?${params.toString()}`);
      setTopCustomersData(prev => ({ ...prev, [categoryId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error(err);
    } finally {
      setTopCustomersLoading(prev => { const n = new Set(prev); n.delete(categoryId); return n; });
    }
  }, [selectedPeriod, selectedArea, selectedCity, topCustomersData, topCustomersLoading]);

  const setSelectedPeriod = useCallback((periodKey: string) => {
    const period = PERIODS.find(p => p.key === periodKey) ?? PERIODS[0];
    setSelectedPeriodState(period);
  }, []);

  /* ===================== GEO DRILL-DOWN ===================== */
  const drillDownToArea = useCallback(async (area: string) => {
    setSelectedGeoArea(area);
    setCityLoading(true);
    try {
      const data = await authedFetch(
        `/api/erp/sales/by-city?from=${selectedPeriod.from}&to=${selectedPeriod.to}&compareFrom=${selectedPeriod.compareFrom}&compareTo=${selectedPeriod.compareTo}&area=${encodeURIComponent(area)}`
      );
      setCityStats(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setCityLoading(false);
    }
  }, [selectedPeriod]);

  const backToAreas = useCallback(() => { setSelectedGeoArea(null); setCityStats([]); }, []);

  /* ===================== CUSTOMER SCOPING ===================== */
  const scopedCustomers = useMemo(() => {
    if (repModeOverride && currentUser.salesman_code) {
      return customers.filter(c => c.salesmanCode === currentUser.salesman_code);
    }
    return customers;
  }, [customers, repModeOverride, currentUser.salesman_code]);

 
  const customerByTrdrId = useMemo(() => {
    const map = new Map<string, Customer>();
    scopedCustomers.forEach(c => { if (c.trdr_id) map.set(String(c.trdr_id), c); });
    return map;
  }, [scopedCustomers]);

  /* ===================== SCOPED + GEO FILTERED SALES ===================== */
  const scopedSales = useMemo(() => {
    const ids = new Set(scopedCustomers.map(c => String(c.trdr_id)));
    return sales.filter(s => ids.has(String(s.customerCode)));
  }, [sales, scopedCustomers]);

  const scopedCompareSales = useMemo(() => {
    const ids = new Set(scopedCustomers.map(c => String(c.trdr_id)));
    return compareSales.filter(s => ids.has(String(s.customerCode)));
  }, [compareSales, scopedCustomers]);

  const geoFilteredSales = useMemo(() => scopedSales.filter(s => {
    const c = customerByTrdrId.get(String(s.customerCode));
    if (!c) return false;
    if (selectedArea && c.area !== selectedArea) return false;
    if (selectedCity && c.city !== selectedCity) return false;
    return true;
  }), [scopedSales, customerByTrdrId, selectedArea, selectedCity]);

  const geoFilteredCompareSales = useMemo(() => scopedCompareSales.filter(s => {
    const c = customerByTrdrId.get(String(s.customerCode));
    if (!c) return false;
    if (selectedArea && c.area !== selectedArea) return false;
    if (selectedCity && c.city !== selectedCity) return false;
    return true;
  }), [scopedCompareSales, customerByTrdrId, selectedArea, selectedCity]);

  /* ===================== KPIs ===================== */
  const totalRevenue    = useMemo(() => geoFilteredSales.reduce((sum, s) => sum + s.netAmount, 0), [geoFilteredSales]);
  const compareRevenue  = useMemo(() => geoFilteredCompareSales.reduce((sum, s) => sum + s.netAmount, 0), [geoFilteredCompareSales]);
  const revenueGrowth   = useMemo(() => compareRevenue === 0 ? null : ((totalRevenue - compareRevenue) / compareRevenue) * 100, [totalRevenue, compareRevenue]);
  const customersWithSales = useMemo(() => new Set(geoFilteredSales.map(s => s.customerCode)).size, [geoFilteredSales]);

  /* ===================== GEO OPTIONS ===================== */
  const areas = useMemo(() => Array.from(new Set(scopedCustomers.map(c => c.area))).sort(), [scopedCustomers]);
  const cities = useMemo(() => {
    if (!selectedArea) return [];
    return Array.from(new Set(scopedCustomers.filter(c => c.area === selectedArea).map(c => c.city))).sort();
  }, [scopedCustomers, selectedArea]);

  /* ===================== FILTERED CUSTOMERS ===================== */
  const filteredCustomers = useMemo(() => scopedCustomers.filter(c => {
    if (selectedArea && c.area !== selectedArea) return false;
    if (selectedCity && c.city !== selectedCity) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.code.includes(searchQuery)) return false;
    return true;

  }), [scopedCustomers, selectedArea, selectedCity, searchQuery]);
  const customersWithSalesSet = useMemo(
  () => new Set(geoFilteredSales.map(s => String(s.customerCode))),
  [geoFilteredSales]
  );

  /* ===================== VISIT INTELLIGENCE ===================== */
  const getDaysSinceVisit = (lastVisitDate: string | undefined | null): number => {
    if (!lastVisitDate) return 99999;
    const now = new Date();
    const lastVisit = new Date(lastVisitDate);
    if (isNaN(lastVisit.getTime())) return 99999;
    return Math.ceil(Math.abs(now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
  };

  /* ===================== EXPORT ===================== */
  return {
    customers: scopedCustomers, customersTotal: scopedCustomers.length,
    totalRevenue, compareRevenue, revenueGrowth, customersWithSales,
    salesLoading, areaStats, cityStats, cityLoading,
    selectedGeoArea, drillDownToArea, backToAreas,
    selectedPeriod, setSelectedPeriod,
    areas, cities,
    selectedArea, setSelectedArea,
    selectedCity, setSelectedCity,
    searchQuery, setSearchQuery,
    categoryMaster,
    filteredCustomers, customersInScope: filteredCustomers.length,
    getDaysSinceVisit,
    showNewVisitDialog, setShowNewVisitDialog,
    showNewProspectDialog, setShowNewProspectDialog,
    currentUser, setCurrentUser,
    customerByTrdrId, scopedSales, customersWithSalesSet,
    repModeOverride, setRepModeOverride,
    salesByCategory, salesByCategoryLoading, salesByCategoryExpanded,
    setSalesByCategoryExpanded, expandSalesByCategory,
    dashboardSkuData, dashboardSkuLoading, fetchDashboardSkus,
    topCustomersData, topCustomersLoading, fetchTopCustomers,
  };
}
