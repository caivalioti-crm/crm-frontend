import { useState, useMemo, useEffect } from 'react';

/* =====================
   TYPES
   ===================== */

type SalesRep = {
  id: string;
  name: string;
  role: 'rep' | 'manager';
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

/* =====================
   HOOK
   ===================== */

export function useDashboardFigma() {
  /* =====================
     DATA STATE
     ===================== */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [sales, setSales] = useState<Sale[]>([]);

  /* =====================
     FILTER / UI STATE
     ===================== */
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGeoArea, setSelectedGeoArea] = useState('');

  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  const [showNewProspectDialog, setShowNewProspectDialog] = useState(false);

  const [currentUser, setCurrentUser] = useState<SalesRep>({
    id: 'demo',
    role: 'manager',
    name: 'Demo User',
  });

  /* =====================
     FETCH DATA
     ===================== */

useEffect(() => {
  fetch('http://localhost:3001/api/erp/customers')
    .then(res => res.json())
    .then(res => {
      console.log('ERP customers payload:', res); // ✅ keep temporarily

      setCustomers(Array.isArray(res.items) ? res.items : []);
      setCustomersTotal(typeof res.total === 'number' ? res.total : 0);
    })
    .catch(err => {
      console.error('Failed to load ERP customers', err);
    });
}, []);


  useEffect(() => {
    fetch('http://localhost:3001/api/erp/sales')
      .then(res => res.json())
      .then(data => setSales(data));
  }, []);

  /* =====================
     DERIVED LOOKUPS
     ===================== */
  const customerByCode = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach(c => map.set(c.code, c));
    return map;
  }, [customers]);

  /* =====================
     GEO FILTERED SALES (SOURCE OF TRUTH)
     ===================== */
  const geoFilteredSales = useMemo(() => {
    if (!selectedArea && !selectedCity) return sales;

    return sales.filter(s => {
      const c = customerByCode.get(s.customerCode);
      if (!c) return false;

      if (selectedArea && c.area !== selectedArea) return false;
      if (selectedCity && c.city !== selectedCity) return false;

      return true;
    });
  }, [sales, customerByCode, selectedArea, selectedCity]);

  /* =====================
     KPIs (BASED ON GEO FILTERED SALES)
     ===================== */
  const totalRevenue = useMemo(
    () => geoFilteredSales.reduce((sum, s) => sum + s.netAmount, 0),
    [geoFilteredSales]
  );

  const customersWithSales = useMemo(
    () => new Set(geoFilteredSales.map(s => s.customerCode)).size,
    [geoFilteredSales]
  );

  /* =====================
     CUSTOMER FILTERING (LIST)
     ===================== */
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (selectedArea && c.area !== selectedArea) return false;
      if (selectedCity && c.city !== selectedCity) return false;
      if (
        searchQuery &&
        !c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.code.includes(searchQuery)
      ) {
        return false;
      }
      return true;
    });
  }, [customers, selectedArea, selectedCity, searchQuery]);

  /* =====================
     GEO OPTIONS
     ===================== */
  const areas = useMemo(
    () => Array.from(new Set(customers.map(c => c.area))).sort(),
    [customers]
  );

  const cities = useMemo(() => {
    if (!selectedArea) return [];
    return Array.from(
      new Set(customers.filter(c => c.area === selectedArea).map(c => c.city))
    ).sort();
  }, [customers, selectedArea]);

  /* =====================
     GEO PERFORMANCE
     ===================== */
  const revenueByArea = useMemo(() => {
    const map = new Map<string, number>();

    geoFilteredSales.forEach(s => {
      const c = customerByCode.get(s.customerCode);
      if (!c) return;
      map.set(c.area, (map.get(c.area) ?? 0) + s.netAmount);
    });

    return Array.from(map.entries()).map(([area, revenue]) => ({
      area,
      revenue,
    }));
  }, [geoFilteredSales, customerByCode]);

  const revenueByCity = useMemo(() => {
    if (!selectedGeoArea) return [];

    const map = new Map<string, number>();

    geoFilteredSales.forEach(s => {
      const c = customerByCode.get(s.customerCode);
      if (!c || c.area !== selectedGeoArea) return;
      map.set(c.city, (map.get(c.city) ?? 0) + s.netAmount);
    });

    return Array.from(map.entries()).map(([city, revenue]) => ({
      city,
      revenue,
    }));
  }, [geoFilteredSales, customerByCode, selectedGeoArea]);

  /* =====================
     EXPORT
     ===================== */
  return {
    customers,
    customersTotal,
    filteredCustomers,

    totalRevenue,
    customersWithSales,

    areas,
    cities,

    revenueByArea,
    revenueByCity,

    selectedArea,
    setSelectedArea,

    selectedCity,
    setSelectedCity,

    searchQuery,
    setSearchQuery,

    selectedGeoArea,
    setSelectedGeoArea,

    showNewVisitDialog,
    setShowNewVisitDialog,

    showNewProspectDialog,
    setShowNewProspectDialog,

    currentUser,
    setCurrentUser,
  };
}