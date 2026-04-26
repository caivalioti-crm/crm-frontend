import { useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import type { CommercialEntityBase } from '../types/commercialEntity';
import type { Visit } from '../types/visit';
import type { VisitApiDTO } from '../types/visitApi';

import { fetchCustomerVisits, createCustomerVisit } from '../api/visits';
import { mapVisitsFromApi } from '../mappers/visitMapper';
import { visitKeys } from '../queryKeys/visits';

export interface CustomerEntity extends CommercialEntityBase {
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

  transportCompany?: string;
  transportMeans?: string;
  overallDiscount?: number;
}

type VisitsPage = {
  items: Visit[];
  nextCursor?: string;
};

export function useCustomerView(initialCustomer: CustomerEntity) {
  const queryClient = useQueryClient();

  const [customer] = useState<CustomerEntity>(initialCustomer);
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);

  /* ---------------- HOT + ADAPTIVE POLLING ---------------- */

  const isHotCustomer = Boolean(customer.lastVisitDate);

  const visitPollingInterval =
    showNewVisitDialog
      ? 10_000
      : isHotCustomer
      ? 30_000
      : false;

  /* ---------------- VISITS (INFINITE QUERY) ---------------- */

 
    const {
      data,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isError,
      error,
      refetch,

  } = useInfiniteQuery<
    VisitsPage,
    Error,
    InfiniteData<VisitsPage>,
    ReturnType<typeof visitKeys.customer>,
    string | undefined
  >({
    queryKey: visitKeys.customer(customer.code),

    queryFn: async ({ pageParam }) => {
      const res = await fetchCustomerVisits(customer.code, {
        cursor: pageParam as string | undefined, // ✅ REQUIRED
        limit: 20,
      });

      return {
        items: mapVisitsFromApi(res.items as VisitApiDTO[]),
        nextCursor: res.nextCursor,
      };
    },

    initialPageParam: undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,

    refetchInterval: visitPollingInterval,
    refetchIntervalInBackground: true,
  });

  const visits = data?.pages.flatMap(p => p.items) ?? [];

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

      const optimisticVisit: Visit = {
        id: `optimistic-${Date.now()}`,
        date: visitData.date ?? new Date().toISOString().slice(0, 10),
        notes: visitData.notes ?? '',
        __optimistic: true,
      };

      queryClient.setQueryData<InfiniteData<VisitsPage>>(
        visitKeys.customer(customer.code),
        oldData => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: [
              {
                ...oldData.pages[0],
                items: [optimisticVisit, ...oldData.pages[0].items],
              },
              ...oldData.pages.slice(1),
            ],
          };
        }
      );
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

    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,

    isVisitsError: isError,
    visitsError: error,
    refetchVisits: refetch,

    showNewVisitDialog,
    setShowNewVisitDialog,

    saveCustomerVisit: saveCustomerVisitMutation.mutateAsync,

    isSavingVisit: saveCustomerVisitMutation.isPending,
    saveVisitError: saveCustomerVisitMutation.isError
      ? 'Η αποθήκευση της επίσκεψης απέτυχε.'
      : null,
  };
}