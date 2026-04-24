import { useState, useMemo, useEffect } from 'react';

type GeoPerformanceItem =
  | {
      name: string;
      sales: number;
      growth: number;
      customers: number;
    }
  | {
      name: string;
      sales: number;
      growth: number;
      customers: number;
      area: string;
    };

type SalesRep = {
  id: string;
  name: string;
  role: 'rep' | 'manager';
};

type SalesRepStat = {
  repId: string;
  repName: string;
  totalSales: number;
  customersVisited: number;
  tasksCompleted: number;
  tasksPending: number;
};

type Sale = {
  customerCode: string;
  trnDate: string;
  netAmount: number;
  series: number;
  salesRepId: string;
};

type Customer = {
  code: string;
  name: string;
  nameGreek: string;
  city: string;
  area: string;
  type: string;
  group: string;
  lastVisitDate: string;
  assignedRepId?: string;
};

type Prospect = {
  id: string;
  name: string;
};

export function useDashboardFigma() {
  const visitsSummary = null;

  /* =====================
     ERP DATA STATE
     ===================== */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  /* =====================
     UI STATE
     ===================== */
  const [selectedPeriod, setSelectedPeriod] = useState('2026-YTD');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastVisitFilter, setLastVisitFilter] = useState('');
  const [geoView, setGeoView] = useState<'area' | 'city'>('area');
  const [selectedGeoArea, setSelectedGeoArea] = useState('');

  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  const [showNewProspectDialog, setShowNewProspectDialog] = useState(false);

  /* =====================
     CURRENT USER (STATEFUL)
     ===================== */
  const [currentUser, setCurrentUser] = useState<SalesRep>({
    id: 'demo',
    role: 'manager',
    name: 'Demo User',
  });

  /* =====================
     FETCH ERP CUSTOMERS
     ===================== */
  useEffect(() => {
    fetch('http://localhost:3001/api/erp/customers')
      .then(res => res.json())
      .then((res: any) => {
        const list: Customer[] =
          Array.isArray(res)
            ? res
            : res.data
            ? res.data
            : res.customers
            ? res.customers
            : [];
        setCustomers(list);
      })
      .catch(err => {
        console.error('Failed to load ERP customers', err);
      });
  }, []);

  /* =====================
     FETCH ERP SALES
     ===================== */
  useEffect(() => {
    fetch('http://localhost:3001/api/erp/sales')
      .then(res => res.json())
      .then((data: Sale[]) => {
        setSales(data);
      })
      .catch(err => {
        console.error('Failed to load ERP sales', err);
      });
  }, []);

  /* =====================
     USER OPTIONS
     ===================== */
  const mockSalesReps: SalesRep[] = [
    { id: 'demo', name: 'Demo User', role: 'rep' },
    { id: 'manager', name: 'Manager', role: 'manager' },
  ];

  const mockSalesRepStats: SalesRepStat[] = [
    {
      repId: 'demo',
      repName: 'Demo User',
      totalSales: 0,
      customersVisited: 0,
      tasksCompleted: 0,
      tasksPending: 0,
    },
  ];

  /* =====================
     DERIVED DATA
     ===================== */
  const userCustomers = useMemo(() => {
    if (currentUser.role === 'manager') return customers;
    return customers.filter(
      (c: Customer) => c.assignedRepId === currentUser.id
    );
  }, [customers, currentUser]);

  const filteredCustomers = useMemo(() => {
    return userCustomers.filter((customer: Customer) => {
      const matchesArea =
        !selectedArea || customer.area === selectedArea;

      const matchesCity =
        !selectedCity || customer.city === selectedCity;

      const matchesSearch =
        !searchQuery ||
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (customer.nameGreek ?? '').includes(searchQuery) ||
        customer.code.includes(searchQuery);

      return matchesArea && matchesCity && matchesSearch;
    });
  }, [userCustomers, selectedArea, selectedCity, searchQuery]);

  const cities = useMemo(() => {
    if (!selectedArea) return [];
    const citySet = new Set(
      customers
        .filter((c: Customer) => c.area === selectedArea)
        .map((c: Customer) => c.city)
    );
    return Array.from(citySet).sort();
  }, [selectedArea, customers]);

  /* =====================
     HANDLERS
     ===================== */
  const onUserChange = (user: SalesRep) => {
    setCurrentUser(user);
  };

  const onSelectCustomer = (_customer: Customer) => {};
  const onSelectProspect = (_prospect: Prospect) => {};
  const handleSaveVisit = (_visitData: any) => {};

  /* =====================
     KPI / HELPERS
     ===================== */
  const getPeriodLabel = (_period: string) => '';
  const getComparisonLabel = () => '';
  const getLastYearGrowth = (_repId: string): number => 0;

  const getSalesForPeriod = (stat: SalesRepStat): number => {
    const repSales = sales.filter(
      (s: Sale) => s.salesRepId === stat.repId
    );

    let filteredSales = repSales;

    if (selectedPeriod.endsWith('YTD')) {
      const year = parseInt(selectedPeriod.slice(0, 4), 10);
      filteredSales = repSales.filter((s: Sale) => {
        const d = new Date(s.trnDate);
        return d.getFullYear() === year;
      });
    }

    return filteredSales.reduce(
      (sum: number, s: Sale) => sum + s.netAmount,
      0
    );
  };

  const getGeoPerformance = (): GeoPerformanceItem[] => [];

  const handleAreaDoubleClick = (areaName: string) => {
    setGeoView('city');
    setSelectedGeoArea(areaName);
  };

  const getLastVisitStats = useMemo(() => {
    return {
      month: 0,
      quarter: 0,
      halfYear: 0,
      year: 0,
    };
  }, []);

  const getDaysSinceVisit = (lastVisitDate: string): number => {
    const now = new Date();
    const lastVisit = new Date(lastVisitDate);
    const diffTime = Math.abs(now.getTime() - lastVisit.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  /* =====================
     EXPORT
     ===================== */
  return {
    visitsSummary,

    customers,
    userCustomers,
    filteredCustomers,
    cities,

    selectedPeriod,
    setSelectedPeriod,
    getPeriodLabel,
    getComparisonLabel,

    selectedArea,
    setSelectedArea,

    selectedCity,
    setSelectedCity,

    searchQuery,
    setSearchQuery,

    lastVisitFilter,
    setLastVisitFilter,

    geoView,
    setGeoView,

    selectedGeoArea,
    setSelectedGeoArea,

    showNewVisitDialog,
    setShowNewVisitDialog,

    showNewProspectDialog,
    setShowNewProspectDialog,

    getLastYearGrowth,
    getSalesForPeriod,
    getGeoPerformance,
    handleAreaDoubleClick,
    getLastVisitStats,
    getDaysSinceVisit,

    handleSaveVisit,

    currentUser,
    mockSalesReps,
    mockSalesRepStats,
    onUserChange,
    onSelectCustomer,
    onSelectProspect,
  };
}