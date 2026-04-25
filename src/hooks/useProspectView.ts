import { useMemo, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import type { CommercialEntityBase, TransportDraft } from '../types/commercialEntity';
import type { Visit } from '../types/visit';
import type { VisitApiDTO } from '../types/visitApi';

import { fetchProspectVisits, createProspectVisit } from '../api/visits';
import { mapVisitsFromApi } from '../mappers/visitMapper';
import { visitKeys } from '../queryKeys/visits';

/* ===================== TYPES ===================== */

type ProspectStatus =
  | 'new_lead'
  | 'contacted'
  | 'visited'
  | 'offer_sent'
  | 'converted'
  | 'lost';

export interface ProspectEntity extends CommercialEntityBase {
  id: string;
  businessName: string;

  ownerName?: string;
  city?: string;
  area?: string;
  shopType?: string;
  vatNumber?: string;

  phone?: string;
  mobile?: string;
  email?: string;
  address?: string;

  status: ProspectStatus;
  createdDate: string;

  transportDraft?: TransportDraft;
}

const STATUS_FLOW: { key: ProspectStatus; label: string }[] = [
  { key: 'new_lead', label: 'Νέο Lead' },
  { key: 'contacted', label: 'Επικοινωνία' },
  { key: 'visited', label: 'Επίσκεψη' },
  { key: 'offer_sent', label: 'Προσφορά' },
  { key: 'converted', label: 'Πελάτης ✓' },
  { key: 'lost', label: 'Χαμένο' },
];

type VisitsPage = {
  items: Visit[];
  nextCursor?: string;
};

/* ===================== HOOK ===================== */

export function useProspectView(initialProspect: ProspectEntity) {
  const queryClient = useQueryClient();

  const [prospect, setProspect] = useState<ProspectEntity>(initialProspect);
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);

  /* ---------- STATUS ---------- */

  const currentStatusIndex = useMemo(
    () => STATUS_FLOW.findIndex(s => s.key === prospect.status),
    [prospect.status]
  );

  const setStatus = (status: ProspectStatus) => {
    setProspect(prev => ({ ...prev, status }));
  };

  /* ---------- TRANSPORT DRAFT ---------- */

  const updateTransportDraft = (next: TransportDraft) => {
    setProspect(prev => ({
      ...prev,
      transportDraft: next,
    }));
  };

  /* ---------- HOT + ADAPTIVE POLLING ---------- */

  const isHotProspect =
    prospect.status !== 'new_lead' &&
    prospect.status !== 'lost';

  const visitPollingInterval =
    showNewVisitDialog
      ? 10_000
      : isHotProspect
      ? 30_000
      : false;

  /* ---------- VISITS (INFINITE QUERY) ---------- */

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<
    VisitsPage,
    Error,
    InfiniteData<VisitsPage>,
    ReturnType<typeof visitKeys.prospect>,
    string | undefined
  >({
    queryKey: visitKeys.prospect(prospect.id),

    queryFn: async ({ pageParam }) => {
      const res = await fetchProspectVisits(prospect.id, {
        cursor: pageParam,
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

  // ✅ Correctly typed: data is InfiniteData<VisitsPage>
  const visits = data?.pages.flatMap(p => p.items) ?? [];

  /* ---------- VISITS (MUTATION + OPTIMISTIC) ---------- */

  const saveProspectVisitMutation = useMutation({
    mutationFn: (visitData: any) =>
      createProspectVisit({
        prospectId: prospect.id,
        ...visitData,
      }),

    onMutate: async (visitData) => {
      await queryClient.cancelQueries({
        queryKey: visitKeys.prospect(prospect.id),
      });

      const optimisticVisit: Visit = {
        id: `optimistic-${Date.now()}`,
        date: visitData.date ?? new Date().toISOString().slice(0, 10),
        notes: visitData.notes ?? '',
        __optimistic: true,
      };

      queryClient.setQueryData<
        InfiniteData<VisitsPage>
      >(visitKeys.prospect(prospect.id), oldData => {
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
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: visitKeys.prospect(prospect.id),
      });
    },
  });

  /* ---------- PUBLIC API ---------- */

  return {
    prospect,
    STATUS_FLOW,
    currentStatusIndex,

    visits,

    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,

    showNewVisitDialog,
    setShowNewVisitDialog,

    updateTransportDraft,
    setStatus,

    saveProspectVisit: saveProspectVisitMutation.mutateAsync,

    isSavingVisit: saveProspectVisitMutation.isPending,
    saveVisitError: saveProspectVisitMutation.isError
      ? 'Η αποθήκευση της επίσκεψης απέτυχε.'
      : null,
  };
}