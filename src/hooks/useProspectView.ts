import { useMemo, useState } from 'react';
import type { CommercialEntityBase, TransportDraft } from '../types/commercialEntity';

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
  const [prospect, setProspect] = useState<ProspectEntity>(initialProspect);

  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);

  const currentStatusIndex = useMemo(
    () => STATUS_FLOW.findIndex(s => s.key === prospect.status),
    [prospect.status]
  );

  const updateTransportDraft = (next: TransportDraft) => {
    setProspect(prev => ({
      ...prev,
      transportDraft: next,
    }));
  };

  const setStatus = (status: ProspectStatus) => {
    setProspect(prev => ({
      ...prev,
      status,
    }));
  };

  return {
    prospect,
    setProspect,

    STATUS_FLOW,
    currentStatusIndex,

    showNewVisitDialog,
    setShowNewVisitDialog,

    updateTransportDraft,
    setStatus,
  };
}
