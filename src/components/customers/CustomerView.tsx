import {
  ArrowLeft,
  Info,
  Building2,
  Truck,
  Plus,
  Calendar,
  ShoppingCart,
  Lightbulb,
} from 'lucide-react';

import { formatDate } from '../../utils/dateFormat';
import { NewVisitDialog } from '../visits/NewVisitDialog';
import { useState } from 'react';
import type { CommercialEntityBase } from '../../types/commercialEntity';

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
    afm?: string;
    fax?: string;
    zip?: string;
    shipmentName?: string;
    carrierName?: string;
  };
  onBack: () => void;
}

export function CustomerView({ customer, onBack }: CustomerViewProps) {
  console.log('CustomerView customer:', customer); // ← add this
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* HEADER */}
      <header className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-5 space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="flex items-center gap-2 text-white/90 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Dashboard</span>
            </button>
            <button
              onClick={() => setShowNewVisitDialog(true)}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg font-medium"
            >
              <Plus className="w-4 h-4" />
              New Visit
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 bg-white/20 rounded-md font-mono text-sm">{customer.code}</span>
            <h1 className="text-2xl font-bold">{customer.name}</h1>
          </div>

          {customer.nameGreek && <div className="text-white/80">{customer.nameGreek}</div>}

          <div className="flex flex-wrap gap-2 text-sm text-white/80">
            {customer.type && <span className="px-3 py-1 bg-white/10 rounded-full">{customer.type}</span>}
            {customer.group && <span className="px-3 py-1 bg-white/10 rounded-full">{customer.group}</span>}
            {(customer.city || customer.area) && (
              <span>{customer.city}{customer.city && customer.area ? ', ' : ''}{customer.area}</span>
            )}
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 space-y-6">

        {/* CUSTOMER DETAILS */}
        <section className="bg-white rounded-xl shadow p-6 border-l-4 border-indigo-500">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">Customer Details</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm text-slate-700">

            {/* Contact */}
            <div className="space-y-2">
              <div className="font-medium text-slate-500">Contact</div>
              {customer.address && (
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <span>{customer.address}{customer.zip ? `, ${customer.zip}` : ''}{customer.city ? `, ${customer.city}` : ''}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2">
                  <span>✉️</span>
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">{customer.email}</a>
                </div>
              )}
              {customer.fax && <div>📠 {customer.fax}</div>}
              {customer.afm && (
                <div className="inline-block font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                  ΑΦΜ: {customer.afm}
                </div>
              )}
            </div>

            {/* Transport */}
            <div className="space-y-2">
              <div className="font-medium text-slate-500">Transport</div>
              {customer.shipmentName && (
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-400" />
                  <span>{customer.shipmentName}</span>
                </div>
              )}
              {customer.carrierName && (
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-400" />
                  <span>{customer.carrierName}</span>
                </div>
              )}
              {!customer.shipmentName && !customer.carrierName && (
                <div className="text-slate-400 text-xs italic">No transport info</div>
              )}
            </div>

            {/* Info */}
            <div className="space-y-2">
              <div className="font-medium text-slate-500">Customer Info</div>
              {customer.area && <div>Area: <span className="font-medium">{customer.area}</span></div>}
              {customer.lastVisitDate ? (
                <div>Last visit: <span className="font-medium">{formatDate(customer.lastVisitDate)}</span></div>
              ) : (
                <div className="text-slate-400 text-xs italic">No visits yet</div>
              )}
            </div>
          </div>
        </section>

        {/* VISITS */}
        <section className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold">Επισκέψεις</h2>
          </div>
          <div className="text-sm text-slate-500 italic">
            Visit history coming soon
          </div>
        </section>

        {/* SALES */}
        <section className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Sales Overview</h2>
          </div>
          <div className="text-sm text-slate-500 italic">
            ERP-derived sales summary coming soon
          </div>
        </section>

        {/* CATEGORY */}
        <section className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold">Category Intelligence</h2>
          </div>
          <div className="text-sm text-slate-500 italic">
            Purchased, neglected, and cross-sell categories coming soon
          </div>
        </section>

      </main>

      <NewVisitDialog
        isOpen={showNewVisitDialog}
        onClose={() => setShowNewVisitDialog(false)}
        customers={[{ code: customer.code, name: customer.name, city: customer.city, area: customer.area }]}
        onSave={() => setShowNewVisitDialog(false)}
      />
    </div>
  );
}