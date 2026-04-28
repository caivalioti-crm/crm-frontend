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
  nameGreek?: string;
  city: string;

  areaCode: string; // ✅ canonical identifier
  area: string;     // ✅ display label

  type?: string;
  group?: string;
  lastVisitDate?: string;
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
     UI STATE
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
     DEMO ACCESS SCOPE (TEMP)
     ===================== */

  const demoAccessAreaCodes = useMemo(() => {
    return ['26', '90']; // TEMP demo access
  }, []);

  /* =====================
     FETCH DATA
     ===================== */

  useEffect(() => {
    fetch('http://localhost:3001/api/erp/customers')
      .then(res => res.json())
      .then(res => {
  const items = Array.isArray(res.items) ? res.items : [];

  const mapped = items.map((c: any) => ({
    ...c,
    areaCode: c.areaCode ?? c.area_code, // ✅ normalize once
  }));

  setCustomers(mapped);
  setCustomersTotal(typeof res.total === 'number' ? res.total : 0);
});
  }, []);

  useEffect(() => {
    fetch('http://localhost:3001/api/erp/sales')
      .then(res => res.json())
      .then(data => setSales(Array.isArray(data) ? data : []));
  }, []);

  /* =====================
     ACCESS-SCOPED CUSTOMERS
     ===================== */

  const scopedCustomers = useMemo(() => {
    return customers.filter(c =>
      demoAccessAreaCodes.includes(c.areaCode)
    );
  }, [customers, demoAccessAreaCodes]);

  /* =====================
     CUSTOMER LOOKUP
     ===================== */

  const customerByCode = useMemo(() => {
    const map = new Map<string, Customer>();
    scopedCustomers.forEach(c => map.set(c.code, c));
    return map;
  }, [scopedCustomers]);

  /* =====================
     SCOPED SALES
     ===================== */

  const scopedSales = useMemo(() => {
    const allowedCodes = new Set(scopedCustomers.map(c => c.code));
    return sales.filter(s => allowedCodes.has(s.customerCode));
  }, [sales, scopedCustomers]);

  /* =====================
     GEO-FILTERED SALES
     ===================== */

  const geoFilteredSales = useMemo(() => {
    return scopedSales.filter(s => {
      const c = customerByCode.get(s.customerCode);
      if (!c) return false;
      if (selectedArea && c.area !== selectedArea) return false;
      if (selectedCity && c.city !== selectedCity) return false;
      return true;
    });
  }, [scopedSales, customerByCode, selectedArea, selectedCity]);

  /* =====================
     KPIs
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
     GEO OPTIONS
     ===================== */

  const areas = useMemo(
    () => Array.from(new Set(scopedCustomers.map(c => c.area))).sort(),
    [scopedCustomers]
  );

  const cities = useMemo(() => {
    if (!selectedArea) return [];
    return Array.from(
      new Set(
        scopedCustomers
          .filter(c => c.area === selectedArea)
          .map(c => c.city)
      )
    ).sort();
  }, [scopedCustomers, selectedArea]);

  /* =====================
     FILTERED CUSTOMERS
     ===================== */

  const filteredCustomers = useMemo(() => {
    return scopedCustomers.filter(c => {
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
  }, [scopedCustomers, selectedArea, selectedCity, searchQuery]);

  /* =====================
     EXPORT
     ===================== */

  return {
    customers: scopedCustomers,
    customersTotal: scopedCustomers.length,

    totalRevenue,
    customersWithSales,

    areas,
    cities,

    selectedArea,
    setSelectedArea,

    selectedCity,
    setSelectedCity,

    searchQuery,
    setSearchQuery,

    filteredCustomers,
    customersInScope: filteredCustomers.length,

    showNewVisitDialog,
    setShowNewVisitDialog,

    showNewProspectDialog,
    setShowNewProspectDialog,

    currentUser,
    setCurrentUser,
  };
}