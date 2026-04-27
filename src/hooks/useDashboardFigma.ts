import { useState, useMemo, useEffect } from 'react';

/* =====================
   TYPES
   ===================== */

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

/* =====================
   HOOK
   ===================== */

export function useDashboardFigma() {
  /* =====================
     ERP DATA STATE
     ===================== */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersTotal, setCustomersTotal] = useState<number>(0); // ✅ ADD THIS
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
     CURRENT USER
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
        .then(res => res.json())          // ✅ parse JSON
        .then((res: any) => {
          const list: Customer[] = res?.items ?? [];
          setCustomers(list);
          setCustomersTotal(res?.total ?? 0);
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
     FETCH SALES REPS
     ===================== */
  

  /* =====================
     AVAILABLE USERS
     ===================== */

    const availableSalesReps: SalesRep[] = [
      { id: 'demo', name: 'Demo User', role: 'rep' },
      { id: 'manager', name: 'Manager', role: 'manager' },
    ];


  /* =====================
     KPI CALCULATION
     ===================== */
  const salesRepStats: SalesRepStat[] = useMemo(() => {
    return availableSalesReps.map((rep) => {
      const repSales = sales.filter(
        (s) => s.salesRepId === rep.id
      );

      const totalSales = repSales.reduce(
        (sum, s) => sum + s.netAmount,
        0
      );

      const uniqueCustomers = new Set(
        repSales.map((s) => s.customerCode)
      );

      return {
        repId: rep.id,
        repName: rep.name,
        totalSales,
        customersVisited: uniqueCustomers.size,
        tasksCompleted: 0,
        tasksPending: 0,
      };
    });
  }, [sales, availableSalesReps]);

  /* =====================
     DERIVED DATA
     ===================== */
  const userCustomers = useMemo(() => {
    if (currentUser.role === 'manager') return customers;
    return customers.filter(
      (c) => c.assignedRepId === currentUser.id
    );
  }, [customers, currentUser]);

  const filteredCustomers = useMemo(() => {
    return userCustomers.filter((customer) => {
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
        .filter((c) => c.area === selectedArea)
        .map((c) => c.city)
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

  const handleSaveVisit = async (visitData: any): Promise<void> => {
    console.log('New visit created:', visitData);
  };

  /* =====================
     HELPERS (STUBBED)
     ===================== */
  const getPeriodLabel = (_period: string) => '';
  const getComparisonLabel = () => '';
  const getLastYearGrowth = (_repId: string): number => 0;
  const getGeoPerformance = (): GeoPerformanceItem[] => {
  const areaMap = new Map<
    string,
    { sales: number; customers: Set<string> }
  >();

  sales.forEach((s) => {
    const customer = customers.find(
      (c) => c.code === s.customerCode
    );
    if (!customer) return;

    const area = customer.area || 'Unknown';

    if (!areaMap.has(area)) {
      areaMap.set(area, {
        sales: 0,
        customers: new Set(),
      });
    }

    const entry = areaMap.get(area)!;
    entry.sales += s.netAmount;
    entry.customers.add(customer.code);
  });

  return Array.from(areaMap.entries()).map(
    ([name, data]) => ({
      name,
      sales: data.sales,
      growth: 0, // growth comes later
      customers: data.customers.size,
    })
  );
};

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
    visitsSummary: null,

    customers,
    customersTotal,
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
    getGeoPerformance,
    handleAreaDoubleClick,
    getLastVisitStats,
    getDaysSinceVisit,

    handleSaveVisit,

    currentUser,
    mockSalesReps: availableSalesReps,
    mockSalesRepStats: salesRepStats,
    onUserChange,
    onSelectCustomer,
    onSelectProspect,
  };
}