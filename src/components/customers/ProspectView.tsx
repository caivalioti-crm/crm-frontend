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

    status: 'new_lead' | 'contacted' | 'visited' | 'offer_sent' | 'converted' | 'lost';
    createdDate: string;

    // ✅ Prospect‑only
    transportDraft?: TransportDraft;
  };

  onBack: () => void;
  onNewVisit: () => void;
}

export function ProspectView({
  prospect: initialProspect,
  onBack,
  onNewVisit,
}: ProspectViewProps) {

  const {
    prospect,
    STATUS_FLOW,
    currentStatusIndex,
    updateTransportDraft,
    showNewVisitDialog,
    setShowNewVisitDialog,
    saveProspectVisit,

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
            className="flex items-center gap-2 text-purple-100 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Πίσω στο Dashboard</span>
          </button>

          <button
            onClick={onNewVisit}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Νέα Επίσκεψη
          </button>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{prospect.businessName}</h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-purple-100">
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
            {prospect.vatNumber && (
              <span className="font-mono text-xs">
                ΑΦΜ: {prospect.vatNumber}
              </span>
            )}
          </div>
        </div>

        {/* Status Flow */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {STATUS_FLOW.map((status, idx) => (
            <div
              key={status.key}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                idx === currentStatusIndex
                  ? 'bg-white text-purple-700 shadow'
                  : idx < currentStatusIndex
                  ? 'bg-white/30 text-white'
                  : 'bg-white/10 text-purple-200'
              }`}
            >
              {idx < currentStatusIndex && '✓ '}
              {status.label}
            </div>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full space-y-6">
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
            editable={true}
            />

            
            <TransportDraftSection
            value={prospect.transportDraft}
            onChange={updateTransportDraft}
            />



        
        {/* Categories Discussed */}
        <section>
          <CategoriesDiscussed entityId={prospect.id} />
        </section>

        {/* Visits */}
        <section className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold">Επισκέψεις</h2>
          </div>

          <div className="text-sm text-gray-500">
            Prospect visit history (placeholder)
          </div>
        </section>

        {/* Actions */}
        <section className="flex gap-3">
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg">
            Νέα Επίσκεψη
          </button>
          <button className="px-4 py-2 bg-gray-100 rounded-lg">
            Προσθήκη Σημείωσης
          </button>
        </section>
      </main>
   
   
    <NewProspectVisitDialog
      isOpen={showNewVisitDialog}
      onClose={() => setShowNewVisitDialog(false)}
      prospectId={prospect.id}
      prospectName={prospect.businessName}
      isSaving={isSavingVisit}
      error={saveVisitError}
      onSave={async (visitData) => {
        try {
          await saveProspectVisit(visitData);
          setShowNewVisitDialog(false);
        } catch {
          // error already set in hook
        }
      }}
    />

    </div>
  
);
}