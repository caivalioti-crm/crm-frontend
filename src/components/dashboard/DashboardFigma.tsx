import { useState } from 'react';
import { ChevronDown, User } from 'lucide-react';

import { useDashboardFigma } from '../../hooks/useDashboardFigma';

import { NewVisitDialog } from '../visits/NewVisitDialog';
import { VisitsLog } from '../visits/VisitsLog';
import { ProspectsList } from '../prospects/ProspectsList';
import { NewProspectDialog } from '../prospects/NewProspectDialog';
import { CustomerView } from '../customers/CustomerView';
import { ProspectView } from '../customers/ProspectView';

export function DashboardFigma() {
  const {
    customers,
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
    customersInScope,

    showNewVisitDialog,
    setShowNewVisitDialog,

    showNewProspectDialog,
    setShowNewProspectDialog,

    currentUser,
    setCurrentUser,
  } = useDashboardFigma();

  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);

  if (selectedCustomer) {
    return (
      <CustomerView
        customer={selectedCustomer}
        onBack={() => setSelectedCustomer(null)}
      />
    );
  }

  if (selectedProspect) {
    return (
      <ProspectView
        prospect={selectedProspect}
        onBack={() => setSelectedProspect(null)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Soft1 Auto Parts CRM</h1>
            <p className="text-blue-100">Sales Representative Dashboard</p>
          </div>

          <div className="flex items-center gap-2">
            <User />
            <select
              value={currentUser.id}
              onChange={e =>
                setCurrentUser({ ...currentUser, id: e.target.value })
              }
            >
              <option value="demo">Demo User</option>
            </select>
            <ChevronDown />
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="p-6 space-y-6">

        <div className="text-sm text-gray-600">
          You have access to <b>{customersTotal}</b> customers across{' '}
          <b>{areas.length}</b> areas
        </div>

        {/* FILTERS */}
        <div className="grid grid-cols-3 gap-4">
          <select
            value={selectedArea}
            onChange={e => {
              setSelectedArea(e.target.value);
              setSelectedCity('');
            }}
          >
            <option value="">All Areas</option>
            {areas.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            disabled={!selectedArea}
          >
            <option value="">All Cities</option>
            {cities.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search customer"
          />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4">
          <div>Total Revenue: €{totalRevenue.toLocaleString()}</div>
          <div>Customers with Sales: {customersWithSales}</div>
        </div>

        {/* CUSTOMERS */}
        <div>
          <h3>Customers ({customersInScope})</h3>
          {filteredCustomers.map(c => (
            <button
              key={c.code}
              onClick={() => setSelectedCustomer(c)}
              className="block w-full text-left"
            >
              {c.name} – {c.city}, {c.area}
            </button>
          ))}
        </div>

        <VisitsLog
          currentUser={currentUser}
          onNewVisit={() => setShowNewVisitDialog(true)}
        />

        <ProspectsList
          currentUser={currentUser}
          onNewProspect={() => setShowNewProspectDialog(true)}
          onSelectProspect={setSelectedProspect}
        />
      </div>

      {/* DIALOGS */}
      <NewVisitDialog
        isOpen={showNewVisitDialog}
        onClose={() => setShowNewVisitDialog(false)}
        customers={customers.map(c => ({
          code: c.code,
          name: c.name,
        }))}
        onSave={async () => {}}
      />

      <NewProspectDialog
        isOpen={showNewProspectDialog}
        onClose={() => setShowNewProspectDialog(false)}
        currentUser={currentUser}
        onSave={() => {}}
      />
    </div>
  );
}