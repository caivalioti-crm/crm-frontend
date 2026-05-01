import { useState, useMemo } from 'react';
import { User, TrendingUp, TrendingDown, LogOut, MapPin, Search, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useDashboardFigma, PERIODS } from '../../hooks/useDashboardFigma';

import { NewVisitDialog } from '../visits/NewVisitDialog';
import { VisitsLog } from '../visits/VisitsLog';
import { ProspectsList } from '../prospects/ProspectsList';
import { NewProspectDialog } from '../prospects/NewProspectDialog';
import { CustomerView } from '../customers/CustomerView';
import { ProspectView } from '../customers/ProspectView';
import { CustomerListSection } from '../customers/CustomerListSection';

const NOT_VISITED_OPTIONS = [
  { label: 'All', value: null },
  { label: '1 month', value: 30 },
  { label: '3 months', value: 90 },
  { label: '6 months', value: 180 },
  { label: '1 year', value: 365 },
];

export function DashboardFigma() {
  const {
    customers,
    customersTotal,
    totalRevenue,
    compareRevenue,
    revenueGrowth,
    customersWithSales,
    salesLoading,
    areaStats,
    cityStats,
    cityLoading,
    selectedGeoArea,
    drillDownToArea,
    backToAreas,
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
  const [visitsRefreshKey, setVisitsRefreshKey] = useState(0);
  const [notVisitedDays, setNotVisitedDays] = useState<number | null>(null);

  // Compute "not visited since" counts
    const notVisitedCounts = useMemo(() => {
      const counts: Record<number, number> = { 30: 0, 90: 0, 180: 0, 365: 0 };
      for (const c of filteredCustomers) {
        const days = getDaysSinceVisit(c.lastVisitDate);
        if (days > 30) counts[30]++;
        if (days > 90) counts[90]++;
        if (days > 180) counts[180]++;
        if (days > 365) counts[365]++;
      }
      return counts;
    }, [filteredCustomers, getDaysSinceVisit]);

  // Apply not visited filter on top of filteredCustomers
  const displayedCustomers = useMemo(() => {
    if (!notVisitedDays) return filteredCustomers;
    return filteredCustomers.filter(c => getDaysSinceVisit(c.lastVisitDate) > notVisitedDays);
  }, [filteredCustomers, notVisitedDays, getDaysSinceVisit]);

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ================= HEADER ================= */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">Soft1 Auto Parts CRM</h1>
            <p className="text-blue-100">Sales Representative Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
              <User className="w-5 h-5" />
              <span className="font-medium">{currentUser.name}</span>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.reload();
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
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
                          {revenueGrowth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
                          <span className="text-slate-400 font-normal text-xs ml-1">{selectedPeriod.compareLabel}</span>
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

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-sm text-slate-500 mb-1">Customers with Sales</div>
                  {salesLoading ? (
                    <div className="text-slate-400 text-sm">Loading...</div>
                  ) : (
                    <div className="text-2xl font-bold text-slate-900">{customersWithSales}</div>
                  )}
                </div>
              </div>
            </section>

            {/* ===== GEO PERFORMANCE ===== */}
            {areaStats.length > 0 && (
              <section className="bg-white rounded-xl shadow p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold text-slate-900">
                      {selectedGeoArea ? 'Performance by City' : 'Performance by Area'}
                    </h2>
                    {selectedGeoArea && (
                      <span className="text-sm font-medium text-indigo-600">{selectedGeoArea}</span>
                    )}
                  </div>
                  {selectedGeoArea && (
                    <button
                      onClick={backToAreas}
                      className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      ← Back to Areas
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  {selectedPeriod.label} · {selectedPeriod.compareLabel}
                </p>

                {!selectedGeoArea && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {areaStats.map(area => (
                      <div
                        key={area.area}
                        onClick={() => drillDownToArea(area.area)}
                        className="bg-slate-50 rounded-xl p-4 border border-slate-100 border-l-4 border-l-indigo-500 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all"
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
                        <div className="text-xs text-slate-400">{area.customerCount} customers with sales</div>
                        {area.compareAmount > 0 && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            vs €{area.compareAmount.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        )}
                        <div className="text-xs text-indigo-400 mt-2">Click to view cities →</div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedGeoArea && (
                  cityLoading ? (
                    <div className="text-slate-400 text-sm">Loading cities...</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {cityStats.map(city => (
                        <div
                          key={`${city.area}|${city.city}`}
                          className="bg-slate-50 rounded-xl p-4 border border-slate-100 border-l-4 border-l-indigo-500"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="text-sm font-semibold text-slate-900">{city.city}</div>
                            <div className="text-xs text-slate-400">{city.area}</div>
                          </div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <div className="text-xl font-bold text-slate-900">
                              €{city.netAmount.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                            {city.growth !== null && (
                              <div className={`text-xs font-medium flex items-center gap-0.5 ${
                                city.growth >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {city.growth >= 0 ? '↑' : '↓'}{Math.abs(city.growth).toFixed(1)}%
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            {city.customerCount} customer{city.customerCount !== 1 ? 's' : ''} with sales
                          </div>
                          {city.compareAmount > 0 && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              vs €{city.compareAmount.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </section>
            )}

            {/* ===== VISITS LOG ===== */}
            <VisitsLog
              key={visitsRefreshKey}
              currentUser={currentUser}
              onNewVisit={() => setShowNewVisitDialog(true)}
              customers={customers}
            />

            {/* ===== FILTERS ===== */}
            <section className="bg-white rounded-xl shadow p-4 space-y-4">
              <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <MapPin className="w-4 h-4 text-indigo-500" />
                Filter Customers
              </div>

              {/* Geographic Area */}
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">
                  Geographic Area: <span className="text-slate-900">{selectedArea || 'All'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSelectedArea(''); setSelectedCity(''); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      !selectedArea
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
                    }`}
                  >
                    All
                  </button>
                  {areas.map(a => (
                    <button
                      key={a}
                      onClick={() => { setSelectedArea(a); setSelectedCity(''); }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        selectedArea === a
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* City */}
              {selectedArea && cities.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-2">
                    City: <span className="text-slate-900">{selectedCity || 'All'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCity('')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        !selectedCity
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
                      }`}
                    >
                      All
                    </button>
                    {cities.map(c => (
                      <button
                        key={c}
                        onClick={() => setSelectedCity(c)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          selectedCity === c
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search */}
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">Search Customer</div>
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Name, Code (e.g. 10234)"
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Not Visited Since */}
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Not Visited Since
                </div>
                <div className="flex flex-wrap gap-2">
                  {NOT_VISITED_OPTIONS.map(opt => {
                    const count = opt.value ? notVisitedCounts[opt.value] : filteredCustomers.length;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => setNotVisitedDays(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                          notVisitedDays === opt.value
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
                        }`}
                      >
                        {opt.label}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          notVisitedDays === opt.value
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ===== CUSTOMERS ===== */}
            <CustomerListSection
              title={
                currentUser.role === 'manager' || currentUser.role === 'admin' || currentUser.role === 'exec'
                  ? 'All Customers'
                  : 'Your Customers'
              }
              customers={displayedCustomers}
              currentUserRole={currentUser.role}
              onSelectCustomer={setSelectedCustomer}
              getDaysSinceVisit={getDaysSinceVisit}
            />

            <ProspectsList
              currentUser={currentUser}
              onNewProspect={() => setShowNewProspectDialog(true)}
              onSelectProspect={setSelectedProspect}
            />
          </>
        )}

        {selectedCustomer && (
          <CustomerView
            customer={selectedCustomer}
            onBack={() => setSelectedCustomer(null)}
          />
        )}

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
        customers={filteredCustomers}
        onSave={() => {
          setShowNewVisitDialog(false);
          setVisitsRefreshKey(k => k + 1);
        }}
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