import { useState } from 'react';
import { User } from 'lucide-react';

import { useDashboardFigma } from '../../hooks/useDashboardFigma';

import { NewVisitDialog } from '../visits/NewVisitDialog';
import { VisitsLog } from '../visits/VisitsLog';
import { ProspectsList } from '../prospects/ProspectsList';
import { NewProspectDialog } from '../prospects/NewProspectDialog';
import { CustomerView } from '../customers/CustomerView';
import { ProspectView } from '../customers/ProspectView';
import { CustomerListSection } from '../customers/CustomerListSection';

export function DashboardFigma() {
  const {
    customersTotal,
    totalRevenue,
    customersWithSales,

    areas,
    cities,

    selectedArea,
    setSelectedArea,

    selectedCity,
    setSelectedCity,

    searchQuery,
    setSearchQuery,

    filteredCustomers,
    getDaysSinceVisit,

    showNewVisitDialog,
    setShowNewVisitDialog,

    showNewProspectDialog,
    setShowNewProspectDialog,

    currentUser,
  } = useDashboardFigma();

  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ================= HEADER ================= */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">
              Soft1 Auto Parts CRM
            </h1>
            <p className="text-blue-100">
              Sales Representative Dashboard
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
            <User className="w-5 h-5" />
            <span className="font-medium">{currentUser.name}</span>
          </div>
        </div>
      </header>

      {/* ================= BODY ================= */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ===== DASHBOARD VIEW ===== */}
        {!selectedCustomer && !selectedProspect && (
          <>
            <div className="text-sm text-slate-600">
              You have access to{' '}
              <span className="font-semibold text-slate-900">
                {customersTotal}
              </span>{' '}
              customers across{' '}
              <span className="font-semibold text-slate-900">
                {areas.length}
              </span>{' '}
              areas
            </div>

            {/* FILTERS */}
            <section className="bg-white rounded-xl shadow p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  value={selectedArea}
                  onChange={e => {
                    setSelectedArea(e.target.value);
                    setSelectedCity('');
                  }}
                  className="rounded-md border px-3 py-2"
                >
                  <option value="">All Areas</option>
                  {areas.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedCity}
                  onChange={e => setSelectedCity(e.target.value)}
                  disabled={!selectedArea}
                  className="rounded-md border px-3 py-2"
                >
                  <option value="">All Cities</option>
                  {cities.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search customer"
                  className="rounded-md border px-3 py-2"
                />
              </div>
            </section>

            {/* KPIs */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow p-4">
                <div className="text-sm text-slate-500">
                  Total Revenue
                </div>
                <div className="text-2xl font-bold">
                  €{totalRevenue.toLocaleString()}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow p-4">
                <div className="text-sm text-slate-500">
                  Customers with Sales
                </div>
                <div className="text-2xl font-bold">
                  {customersWithSales}
                </div>
              </div>
            </section>

            {/* CUSTOMERS */}
            <CustomerListSection
              title={
                currentUser.role === 'manager' || currentUser.role === 'admin' || currentUser.role === 'exec'
                  ? 'All Customers'
                  : 'Your Customers'
              }
              customers={filteredCustomers}
              currentUserRole={currentUser.role}
              onSelectCustomer={setSelectedCustomer}
              getDaysSinceVisit={getDaysSinceVisit}
            />

            <VisitsLog
              currentUser={currentUser}
              onNewVisit={() => setShowNewVisitDialog(true)}
            />

            <ProspectsList
              currentUser={currentUser}
              onNewProspect={() => setShowNewProspectDialog(true)}
              onSelectProspect={setSelectedProspect}
            />
          </>
        )}

        {/* ===== CUSTOMER VIEW ===== */}
        {selectedCustomer && (
          <CustomerView
            customer={selectedCustomer}
            onBack={() => setSelectedCustomer(null)}
          />
        )}

        {/* ===== PROSPECT VIEW ===== */}
        {selectedProspect && (
          <ProspectView
            prospect={selectedProspect}
            onBack={() => setSelectedProspect(null)}
          />
        )}
      </main>

      {/* ================= DIALOGS ================= */}
      <NewVisitDialog
        isOpen={showNewVisitDialog}
        onClose={() => setShowNewVisitDialog(false)}
        customers={filteredCustomers.map(c => ({
          code: c.code,
          name: c.name,
        }))}
        onSave={async () => {}}
      />

      <NewProspectDialog
        isOpen={showNewProspectDialog}
        onClose={() => setShowNewProspectDialog(false)}
        currentUser={currentUser}
        onSave={async () => {}}
      />
    </div>
  );
}