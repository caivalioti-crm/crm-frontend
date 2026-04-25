import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { CommercialEntityBase, TransportDraft } from '../types/commercialEntity';
import type { Visit } from '../types/visit';
import type { VisitApiDTO } from '../types/visitApi';

import { fetchProspectVisits, createProspectVisit } from '../api/visits';
import { mapVisitsFromApi } from '../mappers/visitMapper';
import { visitKeys } from '../queryKeys/visits';

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

export function useProspectView(initialProspect: ProspectEntity) {
  const queryClient = useQueryClient();

  const [prospect, setProspect] = useState<ProspectEntity>(initialProspect);
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);

  /* ---------------- STATUS ---------------- */

  const currentStatusIndex = useMemo(
    () => STATUS_FLOW.findIndex(s => s.key === prospect.status),
    [prospect.status]
  );

  const setStatus = (status: ProspectStatus) => {
    setProspect(prev => ({ ...prev, status }));
  };

  /* ---------------- TRANSPORT DRAFT ---------------- */

  const updateTransportDraft = (next: TransportDraft) => {
    setProspect(prev => ({
      ...prev,
      transportDraft: next,
    }));
  };

  /* ---------------- HOT LOGIC ---------------- */

  /**
   * Prospect is considered "hot" when actively engaged
   */
  const isHotProspect =
    prospect.status !== 'new_lead' &&
    prospect.status !== 'lost';

  /* ---------------- VISITS (QUERY + CONDITIONAL POLLING) ---------------- */

  const {
    data: visits = [],
  } = useQuery({
    queryKey: visitKeys.prospect(prospect.id),
    queryFn: async () => {
      const data: VisitApiDTO[] = await fetchProspectVisits(prospect.id);
      return mapVisitsFromApi(data);
    },

    // ✅ Poll ONLY when prospect is hot
    refetchInterval: isHotProspect ? 30_000 : false,
    refetchIntervalInBackground: true,
  });

  /* ---------------- VISITS (MUTATION + OPTIMISTIC) ---------------- */

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

      const previousVisits =
        queryClient.getQueryData<Visit[]>(
          visitKeys.prospect(prospect.id)
        ) ?? [];

      const optimisticVisit: Visit = {
        id: `optimistic-${Date.now()}`,
        date: visitData.date ?? new Date().toISOString().slice(0, 10),
        notes: visitData.notes ?? '',
        __optimistic: true,
      };

      queryClient.setQueryData<Visit[]>(
        visitKeys.prospect(prospect.id),
        [optimisticVisit, ...previousVisits]
      );

      return { previousVisits };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousVisits) {
        queryClient.setQueryData(
          visitKeys.prospect(prospect.id),
          context.previousVisits
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: visitKeys.prospect(prospect.id),
      });
    },
  });

  /* ---------------- PUBLIC API ---------------- */

  return {
    prospect,
    STATUS_FLOW,
    currentStatusIndex,

    visits,

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
