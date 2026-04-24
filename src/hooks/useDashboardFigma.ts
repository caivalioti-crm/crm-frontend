import { useState, useMemo } from 'react';

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

  const mockCustomers: Customer[] = [];
  const filteredCustomers: Customer[] = [];

  const [selectedPeriod, setSelectedPeriod] = useState('2026-YTD');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastVisitFilter, setLastVisitFilter] = useState('');
  const [geoView, setGeoView] = useState<'area' | 'city'>('area');
  const [selectedGeoArea, setSelectedGeoArea] = useState('');

  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  const [showNewProspectDialog, setShowNewProspectDialog] = useState(false);

  const currentUser: SalesRep = {
    id: 'demo',
    role: 'rep',
    name: 'Demo User',
  };

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

  // ✅ FIX 1 — userCustomers
  const userCustomers = useMemo(() => {
    if (currentUser.role === 'manager') return mockCustomers;
    return mockCustomers.filter(
      c => c.assignedRepId === currentUser.id
    );
  }, [mockCustomers, currentUser]);

  // ✅ FIX 2 — handlers
  const onUserChange = (_user: SalesRep) => {};
  const onSelectCustomer = (_customer: Customer) => {};
  const onSelectProspect = (_prospect: Prospect) => {};

  const handleSaveVisit = (_visitData: any) => {};

  const getPeriodLabel = (_period: string) => '';
  const getComparisonLabel = () => '';
  const getLastYearGrowth = (_repId: string): number => 0;
  const getSalesForPeriod = (_stat: SalesRepStat): number => 0;

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

  const cities = useMemo(() => {
    if (!selectedArea) return [];
    const citySet = new Set(
      mockCustomers
        .filter(c => c.area === selectedArea)
        .map(c => c.city)
    );
    return Array.from(citySet).sort();
  }, [selectedArea, mockCustomers]);

  return {
    visitsSummary,

    mockCustomers,
    filteredCustomers,
    userCustomers,
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