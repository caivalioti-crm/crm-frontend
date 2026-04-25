import { CommercialIntelligenceSection } from '../shared/CommercialIntelligenceSection';
import { TransportDraftSection } from '../shared/TransportDraftSection';
import {
  ArrowLeft,
  Plus,
  MapPin,
  User,
  Building2,
  Calendar,
} from 'lucide-react';

import { formatDate } from '../../utils/dateFormat';
import CategoriesDiscussed from '../prospects/CategoriesDiscussed';
import { useProspectView } from '../../hooks/useProspectView';
import { NewProspectVisitDialog } from '../prospects/NewProspectVisitDialog';
import { sortVisits } from '../../utils/sortVisits';

import type {
  CommercialEntityBase,
  TransportDraft,
} from '../../types/commercialEntity';

export interface ProspectViewProps {
  prospect: CommercialEntityBase & {
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

    status:
      | 'new_lead'
      | 'contacted'
      | 'visited'
      | 'offer_sent'
      | 'converted'
      | 'lost';

    createdDate: string;
    transportDraft?: TransportDraft;
  };

  onBack: () => void;
}

export function ProspectView({
  prospect: initialProspect,
  onBack,
}: ProspectViewProps) {
  const {
    prospect,
    STATUS_FLOW,
    currentStatusIndex,
    visits,
    saveProspectVisit,
    updateTransportDraft,
    showNewVisitDialog,
    setShowNewVisitDialog,
    isSavingVisit,
    saveVisitError,
  } = useProspectView(initialProspect);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-800 to-orange-600 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-purple-100 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            Πίσω στο Dashboard
          </button>

          <button
            onClick={() => setShowNewVisitDialog(true)}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Νέα Επίσκεψη
          </button>
        </div>

        <h1 className="text-2xl font-bold">{prospect.businessName}</h1>

        <div className="flex flex-wrap gap-3 text-sm text-purple-100 mt-2">
          {prospect.ownerName && (
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {prospect.ownerName}
            </span>
          )}
          {(prospect.city || prospect.area) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {prospect.city}
              {prospect.city && prospect.area ? ', ' : ''}
              {prospect.area}
            </span>
          )}
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          {STATUS_FLOW.map((status, idx) => (
            <div
              key={status.key}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                idx === currentStatusIndex
                  ? 'bg-white text-purple-700'
                  : idx < currentStatusIndex
                  ? 'bg-white/30'
                  : 'bg-white/10'
              }`}
            >
              {status.label}
            </div>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6 max-w-5xl mx-auto space-y-6">
        {/* Prospect Info */}
        <section className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold">Στοιχεία Prospect</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {prospect.phone && <div>📞 {prospect.phone}</div>}
            {prospect.mobile && <div>📱 {prospect.mobile}</div>}
            {prospect.email && <div>✉️ {prospect.email}</div>}
            {prospect.address && (
              <div className="sm:col-span-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                {prospect.address}
              </div>
            )}
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Δημιουργήθηκε: {formatDate(prospect.createdDate)}
          </div>
        </section>

        <CommercialIntelligenceSection
          competition={prospect.competitionInfo}
          shopProfile={prospect.shopProfile}
          editable
        />

        <TransportDraftSection
          value={prospect.transportDraft}
          onChange={updateTransportDraft}
        />

        <CategoriesDiscussed entityId={prospect.id} />

        {/* Visits */}
        <section className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold">Επισκέψεις</h2>
          </div>

          {visits.length === 0 ? (
            <div className="text-sm text-gray-500">Καμία επίσκεψη ακόμα</div>
          ) : (
            <ul className="text-sm space-y-1">
              {sortVisits(visits).map(v => (
                <li
                  key={v.id}
                  className={v.__optimistic ? 'opacity-60 italic' : ''}
                >
                  {v.date} — {v.notes || '—'}
                  {v.__optimistic && (
                    <span className="ml-2 text-xs text-gray-400">
                      (αποθήκευση…)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <NewProspectVisitDialog
        isOpen={showNewVisitDialog}
        onClose={() => setShowNewVisitDialog(false)}
        prospectId={prospect.id}
        prospectName={prospect.businessName}
        isSaving={isSavingVisit}
        error={saveVisitError}
        onSave={async visitData => {
          try {
            await saveProspectVisit(visitData);
            setShowNewVisitDialog(false);
          } catch {}
        }}
      />
    </div>
  );
}