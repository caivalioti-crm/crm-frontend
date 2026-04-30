import { useState } from 'react';
import { User, TrendingUp, TrendingDown } from 'lucide-react';

import { useDashboardFigma, PERIODS } from '../../hooks/useDashboardFigma';

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
    compareRevenue,
    revenueGrowth,
    customersWithSales,
    salesLoading,
    areaStats,

    selectedPeriod,
    setSelectedPeriod,

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

        {!selectedCustomer && !selectedProspect && (
          <>
            <div className="text-sm text-slate-600">
              You have access to{' '}
              <span className="font-semibold text-slate-900">{customersTotal}</span>{' '}
              customers across{' '}
              <span className="font-semibold text-slate-900">{areas.length}</span>{' '}
              areas
            </div>

            {/* ===== PERFORMANCE SECTION ===== */}
            <section className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold text-slate-900">
                      {currentUser.role === 'rep' ? 'Your Performance' : 'Team Performance'}
                    </h2>
                    <select
                      value={selectedPeriod.key}
                      onChange={e => setSelectedPeriod(e.target.value)}
                      className="text-sm font-medium text-blue-600 bg-transparent border-none outline-none cursor-pointer"
                    >
                      {PERIODS.map(p => (
                        <option key={p.key} value={p.key}>{p.shortLabel}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedPeriod.label}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Revenue KPI */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-sm text-slate-500 mb-1">Total Revenue</div>
                  {salesLoading ? (
                    <div className="text-slate-400 text-sm">Loading...</div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-slate-900">
                        €{totalRevenue.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      {revenueGrowth !== null && (
                        <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${
                          revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {revenueGrowth >= 0
                            ? <TrendingUp className="w-4 h-4" />
                            : <TrendingDown className="w-4 h-4" />
                          }
                          {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
                          <span className="text-slate-400 font-normal text-xs ml-1">
                            {selectedPeriod.compareLabel}
                          </span>
                        </div>
                      )}
                      {compareRevenue > 0 && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          vs €{compareRevenue.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Customers with Sales KPI */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-sm text-slate-500 mb-1">Customers with Sales</div>
                  {salesLoading ? (
                    <div className="text-slate-400 text-sm">Loading...</div>
                  ) : (
                    <div className="text-2xl font-bold text-slate-900">
                      {customersWithSales}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ===== GEO PERFORMANCE ===== */}
            {areaStats.length > 0 && (
              <section className="bg-white rounded-xl shadow p-4">
                <h2 className="text-base font-semibold text-slate-900 mb-1">
                  Performance by Area
                </h2>
                <p className="text-xs text-slate-400 mb-4">{selectedPeriod.label} · {selectedPeriod.compareLabel}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {areaStats.map(area => (
                    <div
                      key={area.area}
                      className="bg-slate-50 rounded-xl p-4 border border-slate-100 border-l-4 border-l-indigo-500"
                    >
                      <div className="text-sm font-semibold text-slate-900 mb-2">{area.area}</div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <div className="text-xl font-bold text-slate-900">
                          €{area.netAmount.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        {area.growth !== null && (
                          <div className={`text-xs font-medium flex items-center gap-0.5 ${
                            area.growth >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {area.growth >= 0 ? '↑' : '↓'}{Math.abs(area.growth).toFixed(1)}%
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {area.customerCount} customers with sales
                      </div>
                      {area.compareAmount > 0 && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          vs €{area.compareAmount.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ===== FILTERS ===== */}
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
                    <option key={a} value={a}>{a}</option>
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
                    <option key={c} value={c}>{c}</option>
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

            {/* ===== CUSTOMERS ===== */}
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