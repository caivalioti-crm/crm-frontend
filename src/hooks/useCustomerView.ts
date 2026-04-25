import { useState } from 'react';
import { fetchCustomerVisits, createCustomerVisit } from '../api/visits';
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
  
  const [visits, setVisits] = useState<any[]>([]);
  const [isSavingVisit, setIsSavingVisit] = useState(false);
  const [saveVisitError, setSaveVisitError] = useState<string | null>(null);

  
  const refetchVisits = async () => {
    const data = await fetchCustomerVisits(customer.code);
    setVisits(data);
  };

  const saveCustomerVisit = async (visitData: any) => {
    try {
      setIsSavingVisit(true);
      setSaveVisitError(null);

      await createCustomerVisit({
        customerCode: customer.code,
        ...visitData,
      });

      await refetchVisits(); // ✅ THIS is the whole point of Step 4
    } catch (err) {
      setSaveVisitError('Η αποθήκευση της επίσκεψης απέτυχε.');
      throw err;
    } finally {
      setIsSavingVisit(false);
    }
  };

return {
  customer,
  setCustomer,

  showNewVisitDialog,
  setShowNewVisitDialog,

  visits,
  refetchVisits,

  saveCustomerVisit,
  isSavingVisit,
  saveVisitError,
};
}