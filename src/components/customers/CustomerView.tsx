import { CommercialIntelligenceSection } from '../shared/CommercialIntelligenceSection';
import { TransportERPSection } from '../shared/TransportERPSection';
import {
  ArrowLeft,
  Info,
  User,
  Building2,
  Truck,
  ShoppingCart,
  Lightbulb,
  Plus,
  Calendar,
} from 'lucide-react';

import { formatDate } from '../../utils/dateFormat';
import { useCustomerView } from '../../hooks/useCustomerView';
import { NewVisitDialog } from '../visits/NewVisitDialog';
import { sortVisits } from '../../utils/sortVisits';

import type {
  CommercialEntityBase,
} from '../../types/commercialEntity';

export interface CustomerViewProps {
  customer: CommercialEntityBase & {
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
  };

  onBack: () => void;
}

export function CustomerView({
  customer: initialCustomer,
  onBack,
}: CustomerViewProps) {
  const {
    customer,
    visits,
    saveCustomerVisit,
    isSavingVisit,
    saveVisitError,
    showNewVisitDialog,
    setShowNewVisitDialog,
  } = useCustomerView(initialCustomer);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-blue-100 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>

          <button
            onClick={() => setShowNewVisitDialog(true)}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Visit
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3 py-1 bg-white/20 rounded font-mono">
            {customer.code}
          </span>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
        </div>

        {customer.nameGreek && (
          <div className="text-blue-100 mt-1">{customer.nameGreek}</div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-sm text-blue-100 mt-2">
          {customer.type && (
            <span className="px-3 py-1 bg-white/10 rounded-full">
              {customer.type}
            </span>
          )}
          {customer.group && (
            <span className="px-3 py-1 bg-white/10 rounded-full">
              {customer.group}
            </span>
          )}
          {(customer.city || customer.area) && (
            <span>
              {customer.city}
              {customer.city && customer.area ? ', ' : ''}
              {customer.area}
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Customer Details */}
        <section className="bg-white rounded-xl shadow-md p-6 border-l-4 border-indigo-500">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">Customer Details</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <div className="font-medium text-gray-600">Contact</div>
              {customer.address && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  {customer.address}
                </div>
              )}
              {customer.phone && <div>📞 {customer.phone}</div>}
              {customer.mobile && <div>📱 {customer.mobile}</div>}
              {customer.email && <div>✉️ {customer.email}</div>}
              {customer.contactName && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  {customer.contactName}
                </div>
              )}
              {customer.vatNumber && (
                <div className="font-mono text-xs bg-gray-100 inline-block px-2 py-1 rounded">
                  ΑΦΜ: {customer.vatNumber}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="font-medium text-gray-600">
                Transport Preferences
              </div>
              {customer.transportCompany && (
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-gray-400" />
                  {customer.transportCompany}
                </div>
              )}
              {customer.transportMeans && (
                <div>Preferred: {customer.transportMeans}</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="font-medium text-gray-600">Customer Info</div>
              {customer.overallDiscount !== undefined && (
                <div>
                  Discount:{' '}
                  <span className="font-semibold text-green-600">
                    {customer.overallDiscount}%
                  </span>
                </div>
              )}
              {customer.createdDate && (
                <div>
                  Customer since:{' '}
                  <span className="font-medium">
                    {formatDate(customer.createdDate)}
                  </span>
                </div>
              )}
              {customer.lastVisitDate && (
                <div>
                  Last visit:{' '}
                  <span className="font-medium">
                    {formatDate(customer.lastVisitDate)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        <CommercialIntelligenceSection
          competition={customer.competitionInfo}
          shopProfile={customer.shopProfile}
          editable
        />

        <TransportERPSection
          transportCompany={customer.transportCompany}
          transportMeans={customer.transportMeans}
        />

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

        {/* Sales Overview */}
        <section className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Sales Overview</h2>
          </div>
          <div className="text-sm text-gray-500">
            ERP-derived sales summary (placeholder)
          </div>
        </section>

        {/* Category Intelligence */}
        <section className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold">Category Intelligence</h2>
          </div>
          <div className="text-sm text-gray-500">
            Purchased, neglected, and cross-sell categories (placeholder)
          </div>
        </section>
      </main>

      <NewVisitDialog
        isOpen={showNewVisitDialog}
        onClose={() => setShowNewVisitDialog(false)}
        customers={[
          { code: customer.code, name: customer.name },
        ]}
        isSaving={isSavingVisit}
        error={saveVisitError}
        onSave={async visitData => {
          try {
            await saveCustomerVisit(visitData);
            setShowNewVisitDialog(false);
          } catch {}
        }}
      />
    </div>
  );
}