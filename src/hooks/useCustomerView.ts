import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { CommercialEntityBase } from '../types/commercialEntity';
import type { Visit } from '../types/visit';
import type { VisitApiDTO } from '../types/visitApi';

import { fetchCustomerVisits, createCustomerVisit } from '../api/visits';
import { mapVisitsFromApi } from '../mappers/visitMapper';
import { visitKeys } from '../queryKeys/visits';

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

  // ✅ ERP transport (read-only)
  transportCompany?: string;
  transportMeans?: string;

  // ✅ ERP pricing
  overallDiscount?: number;
}

export function useCustomerView(initialCustomer: CustomerEntity) {
  const queryClient = useQueryClient();

  const [customer] = useState<CustomerEntity>(initialCustomer);
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);

  /* ---------------- HOT + ADAPTIVE POLLING ---------------- */

  /**
   * Customer is considered "hot" when there is visit history
   */
  const isHotCustomer = Boolean(customer.lastVisitDate);

  const visitPollingInterval =
    showNewVisitDialog
      ? 10_000
      : isHotCustomer
      ? 30_000
      : false;

  /* ---------------- VISITS (QUERY) ---------------- */

  const { data: visits = [] } = useQuery({
    queryKey: visitKeys.customer(customer.code),
    queryFn: async () => {
      const data: VisitApiDTO[] = await fetchCustomerVisits(customer.code);
      return mapVisitsFromApi(data);
    },

    refetchInterval: visitPollingInterval,
    refetchIntervalInBackground: true,
  });

  /* ---------------- VISITS (MUTATION + OPTIMISTIC) ---------------- */

  const saveCustomerVisitMutation = useMutation({
    mutationFn: (visitData: any) =>
      createCustomerVisit({
        customerCode: customer.code,
        ...visitData,
      }),

    onMutate: async (visitData) => {
      await queryClient.cancelQueries({
        queryKey: visitKeys.customer(customer.code),
      });

      const previousVisits =
        queryClient.getQueryData<Visit[]>(
          visitKeys.customer(customer.code)
        ) ?? [];

      const optimisticVisit: Visit = {
        id: `optimistic-${Date.now()}`,
        date: visitData.date ?? new Date().toISOString().slice(0, 10),
        notes: visitData.notes ?? '',
        __optimistic: true,
      };

      queryClient.setQueryData<Visit[]>(
        visitKeys.customer(customer.code),
        [optimisticVisit, ...previousVisits]
      );

      return { previousVisits };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousVisits) {
        queryClient.setQueryData(
          visitKeys.customer(customer.code),
          context.previousVisits
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: visitKeys.customer(customer.code),
      });
    },
  });

  /* ---------------- PUBLIC API ---------------- */

  return {
    customer,

    visits,

    showNewVisitDialog,
    setShowNewVisitDialog,

    saveCustomerVisit: saveCustomerVisitMutation.mutateAsync,

    isSavingVisit: saveCustomerVisitMutation.isPending,
    saveVisitError: saveCustomerVisitMutation.isError
      ? 'Η αποθήκευση της επίσκεψης απέτυχε.'
      : null,
  };
}