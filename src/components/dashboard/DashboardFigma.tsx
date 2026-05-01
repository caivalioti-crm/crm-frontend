import { useState, useMemo } from 'react';
import { User, TrendingUp, TrendingDown, LogOut, MapPin, Users, UserPlus, ClipboardList, Search, Clock } from 'lucide-react';
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

const DEFAULT_VISIBLE_ITEMS = 6;

function ExpandableFilterGroup({
  label,
  selected,
  items,
  onSelect,
  onClear,
}: {
  label: string;
  selected: string;
  items: string[];
  onSelect: (val: string) => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, DEFAULT_VISIBLE_ITEMS);
  const hasMore = items.length > DEFAULT_VISIBLE_ITEMS;

  return (
    <div>
      <div className="text-xs font-medium text-slate-500 mb-2">
        {label}: <span className="text-slate-900">{selected || 'All'}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onClear}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            !selected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
          }`}
        >
          All
        </button>
        {visibleItems.map(item => (
          <button
            key={item}
            onClick={() => onSelect(item)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              selected === item ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
            }`}
          >
            {item}
          </button>
        ))}
        {hasMore && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-dashed border-slate-400 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            {expanded ? 'Show less' : `+${items.length - DEFAULT_VISIBLE_ITEMS} more`}
          </button>
        )}
      </div>
    </div>
  );
}

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
  const [prospectsRefreshKey, setProspectsRefreshKey] = useState(0);
  const [geoAreasExpanded, setGeoAreasExpanded] = useState(false);
  const [geoCitiesExpanded, setGeoCitiesExpanded] = useState(false);

  const handleBackToAreas = () => {
    backToAreas();
    setGeoCitiesExpanded(false);
  };

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

  const displayedCustomers = useMemo(() => {
    if (!notVisitedDays) return filteredCustomers;
    return filteredCustomers.filter(c => getDaysSinceVisit(c.lastVisitDate) > notVisitedDays);
  }, [filteredCustomers, notVisitedDays, getDaysSinceVisit]);

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ================= HEADER ================= */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="shrink-0">
              <h1 className="text-lg font-extrabold leading-tight">Soft1 Auto Parts CRM</h1>
              <p className="text-blue-200 text-xs">Sales Representative Dashboard</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                <User className="w-4 h-4" />
                <span className="font-medium text-sm">{currentUser.name}</span>
              </div>
              <button
                onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>

          {/* Row 2: Nav buttons */}
          <div className="flex items-center gap-2 border-t border-white/20 pt-2">
            {[
              { icon: <TrendingUp className="w-4 h-4" />, label: 'Performance', id: 'section-performance' },
              { icon: <MapPin className="w-4 h-4" />, label: 'Geo', id: 'section-geo' },
              { icon: <ClipboardList className="w-4 h-4" />, label: 'Visits', id: 'section-visits' },
              { icon: <Search className="w-4 h-4" />, label: 'Customers', id: 'section-filter' },
              { icon: <Users className="w-4 h-4" />, label: 'List', id: 'section-customers' },
              { icon: <UserPlus className="w-4 h-4" />, label: 'Prospects', id: 'section-prospects' },
            ].map(({ icon, label, id }) => (
              <button
                key={id}
                onClick={() => {
                  const el = document.getElementById(id);
                  if (el) {
                    const headerHeight = 120;
                    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight;
                    window.scrollTo({ top, behavior: 'smooth' });
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/25 rounded-lg transition-colors text-white/90 text-sm font-medium"
                title={label}
              >
                {icon}
                <span className="hidden sm:block">{label}</span>
              </button>
            ))}
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
            <section id="section-performance" className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
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
                    {selectedArea && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {selectedArea}{selectedCity && ` › ${selectedCity}`}
                        <button onClick={() => { setSelectedArea(''); setSelectedCity(''); }} className="ml-1 hover:text-indigo-900">×</button>
                      </span>
                    )}
                    {notVisitedDays && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                        Not visited {notVisitedDays}+ days
                      </span>
                    )}
                    {searchQuery && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                        "{searchQuery}"
                      </span>
                    )}
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
              <section id="section-geo" className="bg-white rounded-xl shadow p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-base font-semibold text-slate-900">
                      {selectedGeoArea ? 'Performance by City' : 'Performance by Area'}
                    </h2>
                    {selectedGeoArea && (
                      <span className="text-sm font-medium text-indigo-600">{selectedGeoArea}</span>
                    )}
                    {selectedArea && !selectedGeoArea && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Filtered: {selectedArea}{selectedCity && ` › ${selectedCity}`}
                      </span>
                    )}
                  </div>
                  {selectedGeoArea && (
                    <button
                      onClick={handleBackToAreas}
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
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(geoAreasExpanded ? areaStats : areaStats.slice(0, 6)).map(area => (
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
                    {areaStats.length > 6 && (
                      <button
                        onClick={() => setGeoAreasExpanded(v => !v)}
                        className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors py-2 border border-dashed border-indigo-200 rounded-lg"
                      >
                        {geoAreasExpanded ? 'Show less' : `Show all ${areaStats.length} areas`}
                      </button>
                    )}
                  </>
                )}

                {selectedGeoArea && (
                  cityLoading ? (
                    <div className="text-slate-400 text-sm">Loading cities...</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(geoCitiesExpanded ? cityStats : cityStats.slice(0, 6)).map(city => (
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
                      {cityStats.length > 6 && (
                        <button
                          onClick={() => setGeoCitiesExpanded(v => !v)}
                          className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors py-2 border border-dashed border-indigo-200 rounded-lg"
                        >
                          {geoCitiesExpanded ? 'Show less' : `Show all ${cityStats.length} cities`}
                        </button>
                      )}
                    </>
                  )
                )}
              </section>
            )}

            {/* ===== VISITS LOG ===== */}
            <div id="section-visits">
              <VisitsLog
                key={`visits-${visitsRefreshKey}`}
                currentUser={currentUser}
                onNewVisit={() => setShowNewVisitDialog(true)}
                customers={customers}
              />
            </div>

            {/* ===== FILTERS ===== */}
            <section id="section-filter" className="bg-white rounded-xl shadow p-4 space-y-4">
              <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <MapPin className="w-4 h-4 text-indigo-500" />
                Filter Customers
              </div>

              {/* Search — TOP */}
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

              {/* Geographic Area */}
              <ExpandableFilterGroup
                label="Geographic Area"
                selected={selectedArea}
                items={areas}
                onSelect={(a) => { setSelectedArea(a); setSelectedCity(''); }}
                onClear={() => { setSelectedArea(''); setSelectedCity(''); }}
              />

              {/* City */}
              {selectedArea && cities.length > 0 && (
                <ExpandableFilterGroup
                  label="City"
                  selected={selectedCity}
                  items={cities}
                  onSelect={setSelectedCity}
                  onClear={() => setSelectedCity('')}
                />
              )}

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
            <div id="section-customers">
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
            </div>

            {/* ===== PROSPECTS ===== */}
            <div id="section-prospects">
              <ProspectsList
                key={`prospects-${prospectsRefreshKey}`}
                currentUser={currentUser}
                onNewProspect={() => setShowNewProspectDialog(true)}
                onSelectProspect={setSelectedProspect}
              />
            </div>
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
        onSave={() => {
          setShowNewProspectDialog(false);
          setProspectsRefreshKey(k => k + 1);
        }}
        areas={areas}
        cities={(area) => customers
          .filter(c => c.area === area)
          .map(c => c.city)
          .filter((v, i, a) => a.indexOf(v) === i)
          .sort()
        }
        onViewCustomer={(code) => {
          const customer = customers.find(c => c.code === code);
          if (customer) {
            setShowNewProspectDialog(false);
            setSelectedCustomer(customer);
          }
        }}
        onViewProspect={(_id) => {
          setShowNewProspectDialog(false);
        }}
      />
    </div>
  );
}