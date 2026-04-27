import { useState } from 'react';
import {
  ChevronDown,
  TrendingUp,
  User,
} from 'lucide-react';

import { useDashboardFigma } from '../../hooks/useDashboardFigma';

// UI-only components
import { NewVisitDialog } from '../visits/NewVisitDialog';
import { VisitsLog } from '../visits/VisitsLog';
import { ProspectsList } from '../prospects/ProspectsList';
import { NewProspectDialog } from '../prospects/NewProspectDialog';
import { CustomerView } from '../customers/CustomerView';
import { ProspectView } from '../customers/ProspectView';

// Utilities
import { formatDate } from '../../utils/dateFormat';

/*
================================================================================
LEGACY / REFERENCE CODE (INTENTIONALLY KEPT COMMENTED OUT)
================================================================================
… unchanged legacy comments …
================================================================================
*/

export function DashboardFigma() {
  /**
   * ✅ Destructure ONLY what is actually used in JSX
   * This is what removes yellows.
   */
  const {
    filteredCustomers,
    customersTotal,
    currentUser,
    mockSalesReps,
    onUserChange,

    showNewVisitDialog,
    setShowNewVisitDialog,

    showNewProspectDialog,
    setShowNewProspectDialog,

    userCustomers,
    handleSaveVisit,
  } = useDashboardFigma();

  /**
   * ✅ Local navigation state (single source, no duplicates)
   */
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);

  /**
   * ✅ Navigation short-circuit (BEFORE JSX)
   */
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

  /**
   * ✅ Normal dashboard render
   */
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

          {/* User Selector */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-blue-100" />
              <div className="relative">
                <select
                  value={currentUser.id}
                  onChange={(e) => {
                    const user = mockSalesReps.find(
                      (r) => r.id === e.target.value
                    );
                    if (user) onUserChange(user);
                  }}
                  className="bg-transparent text-white font-medium border-none outline-none cursor-pointer appearance-none pr-8"
                >
                  {mockSalesReps.map((rep) => (
                    <option
                      key={rep.id}
                      value={rep.id}
                      className="text-gray-900"
                    >
                      {rep.name} {rep.role === 'manager' && '(Manager)'}
                    </option>
                  ))}
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

          {/* Visits */}
          
        <VisitsLog
          currentUser={currentUser}
          onNewVisit={() => setShowNewVisitDialog(true)}
        />


          {/* Customers */}
          <div className="bg-card text-card-foreground rounded-xl shadow-md overflow-hidden">
            <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {currentUser.role === 'manager'
                  ? 'All Customers'
                  : 'Your Customers'} ({customersTotal})
              </h2>
            </div>

            <div className="divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <button
                  key={customer.code}
                  onClick={() => setSelectedCustomer(customer)}
                  className="w-full px-4 sm:px-6 py-4 hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {customer.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {customer.city}, {customer.area}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Last visit:{' '}
                        {customer.lastVisitDate
                          ? formatDate(customer.lastVisitDate)
                          : '—'}
                      </div>
                    </div>
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Prospects */}
          <ProspectsList
            currentUser={currentUser}
            onNewProspect={() => setShowNewProspectDialog(true)}
            onSelectProspect={(prospect) => setSelectedProspect(prospect)}
          />
        </div>
      </div>

      {/* ================= DIALOGS ================= */}
      <NewVisitDialog
        isOpen={showNewVisitDialog}
        onClose={() => setShowNewVisitDialog(false)}
        customers={userCustomers}
        onSave={handleSaveVisit}
      />

      <NewProspectDialog
        isOpen={showNewProspectDialog}
        onClose={() => setShowNewProspectDialog(false)}
        currentUser={currentUser}
        onSave={(prospectData: any) => {
          console.log('New prospect:', prospectData);
        }}
      />
    </div>
  );
}