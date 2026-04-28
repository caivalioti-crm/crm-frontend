import { useState } from 'react';
import { ChevronDown, User } from 'lucide-react';

import { useDashboardFigma } from '../../hooks/useDashboardFigma';

// UI-only components
import { NewVisitDialog } from '../visits/NewVisitDialog';
import { VisitsLog } from '../visits/VisitsLog';
import { ProspectsList } from '../prospects/ProspectsList';
import { NewProspectDialog } from '../prospects/NewProspectDialog';
import { CustomerView } from '../customers/CustomerView';
import { ProspectView } from '../customers/ProspectView';

// Utilities
//import { formatDate } from '../../utils/dateFormat';

export function DashboardFigma() {
  const {
    customers: allCustomers,
    filteredCustomers,
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

    revenueByArea,
    revenueByCity,

    selectedGeoArea,
    setSelectedGeoArea,

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

      {/* ================= HEADER ================= */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 sm:px-8 py-4 sm:py-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2">
              Soft1 Auto Parts CRM
            </h1>
            <p className="text-sm sm:text-base text-blue-100">
              Sales Representative Dashboard
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-blue-100" />
              <div className="relative">
                <select
                  value={currentUser.id}
                  onChange={(e) =>
                    setCurrentUser({ ...currentUser, id: e.target.value })
                  }
                  className="bg-transparent text-white font-medium border-none outline-none cursor-pointer appearance-none pr-8"
                >
                  <option value="demo">Demo User</option>
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-100 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MAIN ================= */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 bg-background">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ================= GEO FILTERS ================= */}
          <div className="bg-card rounded-xl shadow-md p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <select
                value={selectedArea}
                onChange={(e) => {
                  setSelectedArea(e.target.value);
                  setSelectedCity('');
                }}
                className="border rounded-md px-3 py-2"
              >
                <option value="">All Areas</option>
                {areas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>

              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                disabled={!selectedArea}
                className="border rounded-md px-3 py-2"
              >
                <option value="">All Cities</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>

              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer"
                className="border rounded-md px-3 py-2"
              />
            </div>
          </div>

          {/* ================= KPIs ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl shadow-md p-4">
              <div className="text-sm text-gray-500">Total Revenue</div>
              <div className="text-2xl font-bold">€{totalRevenue.toLocaleString()}</div>
            </div>
            <div className="bg-card rounded-xl shadow-md p-4">
              <div className="text-sm text-gray-500">Customers with Sales</div>
              <div className="text-2xl font-bold">{customersWithSales}</div>
            </div>
          </div>

          {/* ================= GEO PERFORMANCE ================= */}
          {selectedGeoArea && (
            <button
              onClick={() => setSelectedGeoArea('')}
              className="text-sm text-blue-600"
            >
              ← Back to areas
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {!selectedGeoArea &&
              revenueByArea.map(({ area, revenue }) => (
                <button
                  key={area}
                  onClick={() => setSelectedGeoArea(area)}
                  className="bg-card rounded-xl shadow-md p-4 text-left"
                >
                  <div className="text-sm text-gray-500">{area}</div>
                  <div className="text-xl font-bold">€{revenue.toLocaleString()}</div>
                </button>
              ))}

            {selectedGeoArea &&
              revenueByCity.map(({ city, revenue }) => (
                <div key={city} className="bg-card rounded-xl shadow-md p-4">
                  <div className="text-sm text-gray-500">{city}</div>
                  <div className="text-xl font-bold">€{revenue.toLocaleString()}</div>
                </div>
              ))}
          </div>

          <VisitsLog
            currentUser={currentUser}
            onNewVisit={() => setShowNewVisitDialog(true)}
          />

          {/* ================= CUSTOMERS ================= */}
          <div className="bg-card rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-3 bg-gray-50 border-b">
              <h2 className="font-semibold">
                Customers ({customersTotal})
              </h2>
            </div>

            {filteredCustomers.map(c => (
              <button
                key={c.code}
                onClick={() => setSelectedCustomer(c)}
                className="w-full px-6 py-4 text-left hover:bg-blue-50"
              >
                <div className="font-semibold">{c.name}</div>
                <div className="text-sm text-gray-600">{c.city}, {c.area}</div>
              </button>
            ))}
          </div>

          <ProspectsList
            currentUser={currentUser}
            onNewProspect={() => setShowNewProspectDialog(true)}
            onSelectProspect={setSelectedProspect}
          />
        </div>
      </div>

      {/* ================= DIALOGS ================= */}
      <NewVisitDialog
        isOpen={showNewVisitDialog}
        onClose={() => setShowNewVisitDialog(false)}
        customers={Array.isArray(allCustomers)
          ? allCustomers
              .filter(c => c && typeof c === 'object')
              .map(c => ({
                code: String(c.code),
                name: c.name || c.nameGreek || c.code,
              }))
          : []}
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
