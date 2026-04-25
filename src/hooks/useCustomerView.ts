import { useState } from 'react';
import type { CommercialEntityBase } from '../types/commercialEntity';

export interface CustomerEntity extends CommercialEntityBase {
  // ✅ ERP identity
  code: string;
  name: string;
  nameGreek?: string;
  city?: string;
  area?: string;
  type?: string;
  group?: string;

  address?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  contactName?: string;
  vatNumber?: string;

  createdDate?: string;
  lastVisitDate?: string;

  // ✅ ERP transport (read‑only)
  transportCompany?: string;
  transportMeans?: string;

  // ✅ ERP pricing
  overallDiscount?: number;
}

export function useCustomerView(initialCustomer: CustomerEntity) {
  const [customer, setCustomer] = useState<CustomerEntity>(initialCustomer);

  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);

  return {
    customer,
    setCustomer,

    showNewVisitDialog,
    setShowNewVisitDialog,
  };
}
``