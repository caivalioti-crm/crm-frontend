import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Customer } from '../types/customer';
import type { Sale } from '../types/sale';
import { mapErpCustomer } from '../mappers/customerMapper';
import { mapErpSale } from '../mappers/saleMapper';

const BASE_URL = 'http://localhost:3001';

type SalesRep = {
  id: string;
  name: string;
  role: 'rep' | 'manager' | 'admin' | 'exec';
  salesman_code: string | null;
};

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

  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  const [showNewProspectDialog, setShowNewProspectDialog] = useState(false);

  const [currentUser, setCurrentUser] = useState<SalesRep>({
    id: '',
    role: 'rep',
    name: 'Loading...',
    salesman_code: null,
  });

  /* =====================
     LOAD CURRENT USER
     ===================== */
  useEffect(() => {
    authedFetch('/api/me')
      .then(profile => {
        setCurrentUser({
          id: profile.id,
          name: profile.full_name,
          role: profile.role,
          salesman_code: profile.salesman_code,
        });
      })
      .catch(console.error);
  }, []);

  /* =====================
     FETCH DATA
     ===================== */
  useEffect(() => {
    authedFetch('/api/erp/customers')
      .then(res => {
        const items = Array.isArray(res.items) ? res.items : [];
        setCustomers(items.map(mapErpCustomer));
        setCustomersTotal(typeof res.total === 'number' ? res.total : 0);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    authedFetch('/api/erp/sales')
      .then(data => {
        const items = Array.isArray(data) ? data : [];
        setSales(items.map(mapErpSale));
      })
      .catch(console.error);
  }, []);

  /* =====================
     ACCESS-SCOPED CUSTOMERS
     ===================== */
  const scopedCustomers = useMemo(() => customers, [customers]);

  /* =====================
     CUSTOMER LOOKUP BY CODE
     ===================== */
  const customerByCode = useMemo(() => {
    const map = new Map<string, Customer>();
    scopedCustomers.forEach(c => map.set(c.code, c));
    return map;
  }, [scopedCustomers]);

  /* =====================
     CUSTOMER LOOKUP BY TRDR_ID
     ===================== */
  const customerByTrdrId = useMemo(() => {
    const map = new Map<string, Customer>();
    scopedCustomers.forEach(c => {
      if (c.trdr_id) map.set(String(c.trdr_id), c);
    });
    return map;
  }, [scopedCustomers]);

  /* =====================
     SCOPED SALES
     ===================== */
  const scopedSales = useMemo(() => {
    const allowedTrdrIds = new Set(scopedCustomers.map(c => String(c.trdr_id)));
    return sales.filter(s => allowedTrdrIds.has(String(s.customerCode)));
  }, [sales, scopedCustomers]);

  /* =====================
     GEO-FILTERED SALES
     ===================== */
  const geoFilteredSales = useMemo(() => {
    return scopedSales.filter(s => {
      const c = customerByTrdrId.get(String(s.customerCode));
      if (!c) return false;
      if (selectedArea && c.area !== selectedArea) return false;
      if (selectedCity && c.city !== selectedCity) return false;
      return true;
    });
  }, [scopedSales, customerByTrdrId, selectedArea, selectedCity]);

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
     VISIT INTELLIGENCE
     ===================== */
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

    getDaysSinceVisit,

    showNewVisitDialog,
    setShowNewVisitDialog,

    showNewProspectDialog,
    setShowNewProspectDialog,

    currentUser,
    setCurrentUser,
  };
}