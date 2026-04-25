import { useMemo, useState } from 'react';
import type { CommercialEntityBase, TransportDraft } from '../types/commercialEntity';
import { createProspectVisit } from '../api/visits';
import { fetchProspectVisits } from '../api/visits';

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

  const [isSavingVisit, setIsSavingVisit] = useState(false);
  const [saveVisitError, setSaveVisitError] = useState<string | null>(null);

  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  const [visits, setVisits] = useState<any[]>([]);

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

  const saveProspectVisit = async (visitData: any) => {
    try {
      setIsSavingVisit(true);
      setSaveVisitError(null);

      await createProspectVisit({
        prospectId: prospect.id,
        ...visitData,
      });

      await refetchVisits(); // ✅ refetch after save
    } catch (err) {
      setSaveVisitError('Η αποθήκευση της επίσκεψης απέτυχε.');
      throw err;
    } finally {
      setIsSavingVisit(false);
    }
  };
  
  const refetchVisits = async () => {
    const data = await fetchProspectVisits(prospect.id);
    setVisits(data);
  };

  return {
    prospect,
    STATUS_FLOW,
    currentStatusIndex,
    
    visits,
    refetchVisits,

    showNewVisitDialog,
    setShowNewVisitDialog,

    updateTransportDraft,
    setStatus,

    saveProspectVisit,
    
    isSavingVisit,
    saveVisitError,

  };
}
