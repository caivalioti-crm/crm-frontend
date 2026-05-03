import { useState, useMemo } from 'react';
import { User, TrendingUp, TrendingDown, LogOut, MapPin, Users, UserPlus, ClipboardList, Search, Clock, BarChart2, ChevronDown, ChevronRight } from 'lucide-react';
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

function ExpandableFilterGroup({ label, selected, items, onSelect, onClear }: {
  label: string; selected: string; items: string[];
  onSelect: (val: string) => void; onClear: () => void;
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
        <button onClick={onClear} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${!selected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'}`}>All</button>
        {visibleItems.map(item => (
          <button key={item} onClick={() => onSelect(item)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selected === item ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'}`}>{item}</button>
        ))}
        {hasMore && (
          <button onClick={() => setExpanded(v => !v)} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-dashed border-slate-400 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
            {expanded ? 'Show less' : `+${items.length - DEFAULT_VISIBLE_ITEMS} more`}
          </button>
        )}
      </div>
    </div>
  );
}

function fmtEur(n: number): string {
  return '€' + Math.round(n).toLocaleString('el-GR');
}

function GrowthBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

// ─── Reusable SKU + Top Customers tab panel ───────────────────────────────────
function DrillContent({
  catIdKey,
  skus, skusLoading,
  topCustomers, topCustomersLoading,
}: {
  catIdKey: string;
  skus: any[]; skusLoading: boolean;
  topCustomers: any[]; topCustomersLoading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'skus' | 'customers'>('skus');

  return (
    <div className="bg-slate-50">
      <div className="flex border-b border-slate-200 px-4 pt-2">
        <button onClick={() => setActiveTab('skus')}
          className={`text-xs font-medium px-3 py-1.5 border-b-2 transition-colors mr-2 ${activeTab === 'skus' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Top SKUs
        </button>
        <button onClick={() => setActiveTab('customers')}
          className={`text-xs font-medium px-3 py-1.5 border-b-2 transition-colors ${activeTab === 'customers' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Top 10 Πελάτες
        </button>
      </div>

      {activeTab === 'skus' && (
        skusLoading ? <div className="px-8 py-3 text-xs text-slate-400">Φόρτωση...</div> :
        skus.length === 0 ? <div className="px-8 py-3 text-xs text-slate-400 italic">Δεν βρέθηκαν προϊόντα</div> :
        <div className="divide-y divide-slate-100">
          {skus.map((sku: any) => (
            <div key={sku.mtrl_id} className="flex items-center justify-between px-8 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-slate-400 shrink-0">{sku.sku_code}</span>
                <span className="text-xs text-slate-600 truncate">{sku.sku_name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="text-xs text-slate-400">{Math.round(sku.qty)} τεμ.</span>
                <span className="text-xs font-semibold text-slate-700">{fmtEur(sku.revenue)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'customers' && (
        topCustomersLoading ? <div className="px-8 py-3 text-xs text-slate-400">Φόρτωση...</div> :
        topCustomers.length === 0 ? <div className="px-8 py-3 text-xs text-slate-400 italic">Δεν βρέθηκαν πελάτες</div> :
        <div className="divide-y divide-slate-100">
          {topCustomers.map((c: any, i: number) => (
            <div key={c.customer_code} className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-bold w-5 shrink-0 text-center ${i < 3 ? 'text-amber-500' : 'text-slate-400'}`}>#{i + 1}</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-700 truncate">{c.customer_name}</div>
                  <div className="text-xs text-slate-400">{c.city}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <GrowthBadge pct={c.growth_pct ?? null} />
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs text-slate-400">{Math.round(parseFloat(c.qty))} τεμ.</span>
                    <div className="text-xs font-semibold text-slate-700">{fmtEur(parseFloat(c.revenue))}</div>
                  </div>
                  {parseFloat(c.prev_revenue) > 0 && (
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-slate-300">{Math.round(parseFloat(c.prev_qty ?? 0))} τεμ.</span>
                      <div className="text-xs text-slate-400">{fmtEur(parseFloat(c.prev_revenue))}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardFigma() {
  const {
    customers, customersTotal, totalRevenue, compareRevenue, revenueGrowth,
    customersWithSales, salesLoading, areaStats, cityStats, cityLoading,
    selectedGeoArea, drillDownToArea, backToAreas, selectedPeriod, setSelectedPeriod,
    areas, cities, selectedArea, setSelectedArea, selectedCity, setSelectedCity,
    searchQuery, setSearchQuery, filteredCustomers, getDaysSinceVisit,
    showNewVisitDialog, setShowNewVisitDialog, showNewProspectDialog, setShowNewProspectDialog,
    currentUser, categoryMaster, customersWithSalesSet,
    salesByCategory, salesByCategoryLoading, salesByCategoryExpanded,
    setSalesByCategoryExpanded, expandSalesByCategory,
    dashboardSkuData, dashboardSkuLoading, fetchDashboardSkus,
    topCustomersData, topCustomersLoading, fetchTopCustomers,
    repModeOverride, setRepModeOverride,
  } = useDashboardFigma();

  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);
  const [visitsRefreshKey, setVisitsRefreshKey] = useState(0);
  const [notVisitedDays, setNotVisitedDays] = useState<number | null>(null);
  const [prospectsRefreshKey, setProspectsRefreshKey] = useState(0);
  const [geoAreasExpanded, setGeoAreasExpanded] = useState(false);
  const [geoCitiesExpanded, setGeoCitiesExpanded] = useState(false);
  const [expandedL1s, setExpandedL1s] = useState<Set<string>>(new Set());
  const [expandedL2s, setExpandedL2s] = useState<Set<string>>(new Set());
  const [expandedL3s, setExpandedL3s] = useState<Set<string>>(new Set());
  const [salesFilter, setSalesFilter] = useState<'all' | 'with' | 'without'>('all');

  const handleBackToAreas = () => { backToAreas(); setGeoCitiesExpanded(false); };

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
      let result = filteredCustomers;
      if (notVisitedDays) result = result.filter(c => getDaysSinceVisit(c.lastVisitDate) > notVisitedDays);
      if (salesFilter === 'with') result = result.filter(c => customersWithSalesSet.has(String(c.trdr_id)));
      if (salesFilter === 'without') result = result.filter(c => !customersWithSalesSet.has(String(c.trdr_id)));
      return result;
    }, [filteredCustomers, notVisitedDays, getDaysSinceVisit, salesFilter, customersWithSalesSet]);

  function toggleL1(code: string) { setExpandedL1s(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; }); }
  function toggleL2(code: string) { setExpandedL2s(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; }); }
  function toggleL3(code: string) { setExpandedL3s(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; }); }

  const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'exec';

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
              {currentUser.role === 'manager' && (
                <button onClick={() => setRepModeOverride(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${repModeOverride ? 'bg-white text-indigo-700 border-white' : 'bg-white/10 text-white/90 border-white/20 hover:bg-white/20'}`}>
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:block">{repModeOverride ? 'My Customers' : 'All Customers'}</span>
                </button>
              )}
              <button onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-white/20 pt-2">
            {[
              { icon: <TrendingUp className="w-4 h-4" />, label: 'Performance', id: 'section-performance', roles: null },
              { icon: <MapPin className="w-4 h-4" />, label: 'Geo', id: 'section-geo', roles: null },
              { icon: <BarChart2 className="w-4 h-4" />, label: 'Categories', id: 'section-categories', roles: ['admin', 'manager', 'exec'] },
              { icon: <ClipboardList className="w-4 h-4" />, label: 'Visits', id: 'section-visits', roles: null },
              { icon: <Search className="w-4 h-4" />, label: 'Customers', id: 'section-filter', roles: null },
              { icon: <Users className="w-4 h-4" />, label: 'List', id: 'section-customers', roles: null },
              { icon: <UserPlus className="w-4 h-4" />, label: 'Prospects', id: 'section-prospects', roles: null },
            ]
              .filter(item => !item.roles || item.roles.includes(currentUser.role))
              .map(({ icon, label, id }) => (
                <button key={id}
                  onClick={() => { const el = document.getElementById(id); if (el) { const top = el.getBoundingClientRect().top + window.scrollY - 120; window.scrollTo({ top, behavior: 'smooth' }); } }}
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/25 rounded-lg transition-colors text-white/90 text-sm font-medium" title={label}>
                  {icon}
                  <span className="hidden sm:block">{label}</span>
                </button>
              ))}
          </div>
            {/* Context bar */}
            {(selectedArea || selectedCity || notVisitedDays || searchQuery || repModeOverride || selectedCustomer || selectedProspect || salesFilter !== 'all') && (
            <div className="flex items-center gap-1.5 border-t border-white/10 pt-1.5 flex-wrap">
              {selectedCustomer ? (
                <>
                  <span className="text-white/40 text-xs">Πελάτης:</span>
                  <span className="text-white/70 text-xs bg-white/10 px-1.5 py-0.5 rounded font-medium">{selectedCustomer.name}</span>
                  <span className="text-white/40 text-xs font-mono">{selectedCustomer.code}</span>
                  {selectedCustomer.area && <span className="text-white/40 text-xs">· {selectedCustomer.area}{selectedCustomer.city && ` › ${selectedCustomer.city}`}</span>}
                </>
              ) : selectedProspect ? (
                <>
                  <span className="text-white/40 text-xs">Prospect:</span>
                  <span className="text-white/70 text-xs bg-white/10 px-1.5 py-0.5 rounded font-medium">{selectedProspect.name}</span>
                  {selectedProspect.area && <span className="text-white/40 text-xs">· {selectedProspect.area}</span>}
                </>
              ) : (
                <>
                  {(selectedArea || selectedCity || notVisitedDays || searchQuery || repModeOverride || salesFilter !== 'all') && (
                    <span className="text-white/40 text-xs">Φίλτρα:</span>
                  )}
                  {repModeOverride && <span className="text-white/60 text-xs bg-white/10 px-1.5 py-0.5 rounded">Οι πελάτες μου</span>}
                  {selectedArea && <span className="text-white/60 text-xs bg-white/10 px-1.5 py-0.5 rounded">{selectedArea}{selectedCity && ` › ${selectedCity}`}</span>}
                  {notVisitedDays && <span className="text-white/60 text-xs bg-white/10 px-1.5 py-0.5 rounded">Δεν επισκέφθηκε {notVisitedDays}+ ημέρες</span>}
                  {searchQuery && <span className="text-white/60 text-xs bg-white/10 px-1.5 py-0.5 rounded">"{searchQuery}"</span>}
                  {salesFilter !== 'all' && (
                    <span className="text-white/60 text-xs bg-white/10 px-1.5 py-0.5 rounded">
                      {salesFilter === 'with' ? 'Με πωλήσεις' : 'Χωρίς πωλήσεις'}
                    </span>
                  )}
                  <span className="text-white/40 text-xs ml-1">{selectedPeriod.shortLabel}</span>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ================= BODY ================= */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {!selectedCustomer && !selectedProspect && (
          <>
            <div className="text-sm text-slate-600">
              You have access to <span className="font-semibold text-slate-900">{customersTotal}</span> customers across <span className="font-semibold text-slate-900">{areas.length}</span> areas
            </div>

            {/* ===== PERFORMANCE ===== */}
            <section id="section-performance" className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-base font-semibold text-slate-900">{currentUser.role === 'rep' ? 'Your Performance' : 'Team Performance'}</h2>
                    <select value={selectedPeriod.key} onChange={e => setSelectedPeriod(e.target.value)} className="text-sm font-medium text-blue-600 bg-transparent border-none outline-none cursor-pointer">
                      {PERIODS.map(p => <option key={p.key} value={p.key}>{p.shortLabel}</option>)}
                    </select>
                    {selectedArea && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{selectedArea}{selectedCity && ` › ${selectedCity}`}
                        <button onClick={() => { setSelectedArea(''); setSelectedCity(''); }} className="ml-1 hover:text-indigo-900">×</button>
                      </span>
                    )}
                    {notVisitedDays && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">Not visited {notVisitedDays}+ days</span>}
                    {searchQuery && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">"{searchQuery}"</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedPeriod.label}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-sm text-slate-500 mb-1">Total Revenue</div>
                  {salesLoading ? <div className="text-slate-400 text-sm">Loading...</div> : (
                    <>
                      <div className="text-2xl font-bold text-slate-900">€{totalRevenue.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      {revenueGrowth !== null && (
                        <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {revenueGrowth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
                          <span className="text-slate-400 font-normal text-xs ml-1">{selectedPeriod.compareLabel}</span>
                        </div>
                      )}
                      {compareRevenue > 0 && <div className="text-xs text-slate-400 mt-0.5">vs €{compareRevenue.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
                    </>
                  )}
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-sm text-slate-500 mb-1">Customers with Sales</div>
                  {salesLoading ? <div className="text-slate-400 text-sm">Loading...</div> : <div className="text-2xl font-bold text-slate-900">{customersWithSales}</div>}
                </div>
              </div>
            </section>

            {/* ===== GEO PERFORMANCE ===== */}
            {areaStats.length > 0 && (
              <section id="section-geo" className="bg-white rounded-xl shadow p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-base font-semibold text-slate-900">{selectedGeoArea ? 'Performance by City' : 'Performance by Area'}</h2>
                    {selectedGeoArea && <span className="text-sm font-medium text-indigo-600">{selectedGeoArea}</span>}
                    {selectedArea && !selectedGeoArea && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" />Filtered: {selectedArea}{selectedCity && ` › ${selectedCity}`}
                      </span>
                    )}
                  </div>
                  {selectedGeoArea && <button onClick={handleBackToAreas} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1">← Back to Areas</button>}
                </div>
                <p className="text-xs text-slate-400 mb-4">{selectedPeriod.label} · {selectedPeriod.compareLabel}</p>

                {!selectedGeoArea && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(geoAreasExpanded ? areaStats : areaStats.slice(0, 6)).map(area => (
                        <div key={area.area} onClick={() => drillDownToArea(area.area)} className="bg-slate-50 rounded-xl p-4 border border-slate-100 border-l-4 border-l-indigo-500 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all">
                          <div className="text-sm font-semibold text-slate-900 mb-2">{area.area}</div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <div className="text-xl font-bold text-slate-900">€{area.netAmount.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                            {area.growth !== null && <div className={`text-xs font-medium flex items-center gap-0.5 ${area.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{area.growth >= 0 ? '↑' : '↓'}{Math.abs(area.growth).toFixed(1)}%</div>}
                          </div>
                          <div className="text-xs text-slate-400">{area.customerCount} customers with sales</div>
                          {area.compareAmount > 0 && <div className="text-xs text-slate-400 mt-0.5">vs €{area.compareAmount.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>}
                          <div className="text-xs text-indigo-400 mt-2">Click to view cities →</div>
                        </div>
                      ))}
                    </div>
                    {areaStats.length > 6 && (
                      <button onClick={() => setGeoAreasExpanded(v => !v)} className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors py-2 border border-dashed border-indigo-200 rounded-lg">
                        {geoAreasExpanded ? 'Show less' : `Show all ${areaStats.length} areas`}
                      </button>
                    )}
                  </>
                )}

                {selectedGeoArea && (
                  cityLoading ? <div className="text-slate-400 text-sm">Loading cities...</div> : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(geoCitiesExpanded ? cityStats : cityStats.slice(0, 6)).map(city => (
                          <div key={`${city.area}|${city.city}`} className="bg-slate-50 rounded-xl p-4 border border-slate-100 border-l-4 border-l-indigo-500">
                            <div className="flex items-start justify-between mb-2">
                              <div className="text-sm font-semibold text-slate-900">{city.city}</div>
                              <div className="text-xs text-slate-400">{city.area}</div>
                            </div>
                            <div className="flex items-baseline gap-2 mb-1">
                              <div className="text-xl font-bold text-slate-900">€{city.netAmount.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                              {city.growth !== null && <div className={`text-xs font-medium flex items-center gap-0.5 ${city.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{city.growth >= 0 ? '↑' : '↓'}{Math.abs(city.growth).toFixed(1)}%</div>}
                            </div>
                            <div className="text-xs text-slate-400">{city.customerCount} customer{city.customerCount !== 1 ? 's' : ''} with sales</div>
                            {city.compareAmount > 0 && <div className="text-xs text-slate-400 mt-0.5">vs €{city.compareAmount.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>}
                          </div>
                        ))}
                      </div>
                      {cityStats.length > 6 && (
                        <button onClick={() => setGeoCitiesExpanded(v => !v)} className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors py-2 border border-dashed border-indigo-200 rounded-lg">
                          {geoCitiesExpanded ? 'Show less' : `Show all ${cityStats.length} cities`}
                        </button>
                      )}
                    </>
                  )
                )}
              </section>
            )}

            {/* ===== SALES BY CATEGORY ===== */}
            {isPrivileged && (
              <section id="section-categories" className="bg-white rounded-xl shadow">
                <button
                  onClick={() => { if (!salesByCategoryExpanded) expandSalesByCategory(); else setSalesByCategoryExpanded(false); }}
                  className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BarChart2 className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-base font-semibold text-slate-900">Sales by Category</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {selectedPeriod.shortLabel} · {selectedPeriod.compareLabel}
                        {selectedArea && ` · ${selectedArea}`}{selectedCity && ` › ${selectedCity}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {salesByCategoryLoading && <span className="text-xs text-slate-400">Φόρτωση...</span>}
                    {!salesByCategoryExpanded && salesByCategory.length > 0 && <span className="text-xs text-slate-400">{salesByCategory.length} κατηγορίες</span>}
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${salesByCategoryExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {salesByCategoryExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100">
                    {salesByCategoryLoading ? (
                      <div className="py-4 text-sm text-slate-400">Φόρτωση κατηγοριών...</div>
                    ) : salesByCategory.length === 0 ? (
                      <div className="py-4 text-sm text-slate-400 italic">Δεν βρέθηκαν κατηγορίες για αυτή την περίοδο</div>
                    ) : (
                      <div className="space-y-1 mt-3">
                        {salesByCategory.map(group => {
                          const isL1Exp = expandedL1s.has(group.l1_code);
                          const maxGroupRev = Math.max(...salesByCategory.map((g: any) => g.total_revenue), 1);
                          const groupBarPct = Math.max((group.total_revenue / maxGroupRev) * 100, 2);

                          return (
                            <div key={group.l1_code} className="rounded-lg border border-slate-100 overflow-hidden">
                              {/* L1 */}
                              <button onClick={() => toggleL1(group.l1_code)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${isL1Exp ? 'bg-blue-50 border-b border-blue-100' : 'bg-white hover:bg-slate-50'}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  {isL1Exp ? <ChevronDown className="w-4 h-4 text-blue-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono shrink-0">{group.l1_code}</span>
                                  <span className="text-sm font-medium text-slate-700 truncate">{categoryMaster.get(group.l1_code) ?? `Κατηγορία ${group.l1_code}`}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <GrowthBadge pct={group.growth_pct ?? null} />
                                  <span className="text-xs text-slate-400 hidden sm:block">{group.invoice_count} τιμολόγια</span>
                                  <div className="text-right">
                                    <div className="text-sm font-semibold text-slate-700">{fmtEur(group.total_revenue)}</div>
                                    {group.prev_revenue > 0 && <div className="text-xs text-slate-400">{fmtEur(group.prev_revenue)}</div>}
                                  </div>
                                </div>
                              </button>

                              {!isL1Exp && (
                                <div className="px-3 pb-2 bg-white">
                                  <div className="w-full bg-slate-100 rounded-sm h-1.5">
                                    <div className="h-1.5 rounded-sm bg-blue-300 transition-all" style={{ width: `${groupBarPct}%` }} />
                                  </div>
                                </div>
                              )}

                              {/* L2 rows */}
                              {isL1Exp && (
                                <div className="divide-y divide-slate-50">
                                  {group.l2s.map((l2: any) => {
                                    const l2Key = String(l2.category_code);
                                    const l2IdKey = String(l2.category_id);
                                    const isL2Exp = expandedL2s.has(l2Key);
                                    const maxL2Rev = Math.max(...group.l2s.map((l: any) => l.net_revenue), 1);
                                    const hasL3 = l2.l3s && l2.l3s.length > 0;
                                    const l2Name = l2.full_name ?? categoryMaster.get(l2Key) ?? l2Key;

                                    return (
                                      <div key={l2Key} className="bg-white">
                                        {/* L2 button */}
                                        <button
                                          onClick={() => {
                                            toggleL2(l2Key);
                                            if (!isL2Exp && l2.category_id) {
                                              fetchDashboardSkus(l2IdKey);
                                              fetchTopCustomers(l2IdKey);
                                            }
                                          }}
                                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 text-left"
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-3 shrink-0" />
                                            {isL2Exp ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-mono shrink-0">{l2.short_name ?? l2Key}</span>
                                            <span className="text-sm font-medium text-slate-700 truncate">{l2Name}</span>
                                            {hasL3 && <span className="text-xs text-slate-400 shrink-0">({l2.l3s.length} υποκατ.)</span>}
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0 ml-2">
                                            <GrowthBadge pct={l2.growth_pct ?? null} />
                                            <div className="text-right">
                                              <div className="flex items-center gap-2 justify-end">
                                                <span className="text-xs text-slate-400">{Math.round(l2.total_qty)} τεμ.</span>
                                                <div className="text-sm font-semibold text-slate-700">{fmtEur(l2.net_revenue)}</div>
                                              </div>
                                              {l2.prev_qty > 0 && (
                                                <div className="flex items-center gap-2 justify-end">
                                                  <span className="text-xs text-slate-300">{Math.round(l2.prev_qty)} τεμ.</span>
                                                  <div className="text-xs text-slate-400">{fmtEur(l2.prev_revenue)}</div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </button>

                                        {/* L2 bar */}
                                        <div className="px-3 pb-1 bg-white">
                                          <div className="ml-8 w-full bg-slate-100 rounded-sm h-1">
                                            <div className="h-1 rounded-sm bg-blue-200 transition-all" style={{ width: `${Math.max((l2.net_revenue / maxL2Rev) * 100, 2)}%` }} />
                                          </div>
                                        </div>

                                        {/* L2 expanded */}
                                        {isL2Exp && (
                                          <div className="border-t border-slate-100">
                                            {/* L2 SKUs + Top Customers */}
                                            {l2.category_id && (
                                              <DrillContent
                                                catIdKey={l2IdKey}
                                                skus={dashboardSkuData[l2IdKey] ?? []}
                                                skusLoading={dashboardSkuLoading.has(l2IdKey)}
                                                topCustomers={topCustomersData[l2IdKey] ?? []}
                                                topCustomersLoading={topCustomersLoading.has(l2IdKey)}
                                              />
                                            )}

                                            {/* L3 children */}
                                            {hasL3 && (
                                              <div className="border-t border-slate-200 divide-y divide-slate-100">
                                                <div className="px-4 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide bg-slate-50">Υποκατηγορίες</div>
                                                {l2.l3s.map((l3: any) => {
                                                  const l3Key = String(l3.category_code);
                                                  const l3IdKey = String(l3.category_id);
                                                  const isL3Exp = expandedL3s.has(l3Key);
                                                  const maxL3Rev = Math.max(...l2.l3s.map((x: any) => x.net_revenue), 1);

                                                  return (
                                                    <div key={l3Key} className="bg-white">
                                                      {/* L3 button */}
                                                      <button
                                                        onClick={() => {
                                                          toggleL3(l3Key);
                                                          if (!isL3Exp) {
                                                            fetchDashboardSkus(l3IdKey);
                                                            fetchTopCustomers(l3IdKey);
                                                          }
                                                        }}
                                                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-left"
                                                      >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                          <div className="w-4 shrink-0 flex justify-center"><div className="w-px h-4 bg-slate-200" /></div>
                                                          {isL3Exp ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                                                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-mono shrink-0 uppercase">{l3.short_name ?? l3Key}</span>
                                                          <span className="text-sm text-slate-700 truncate">{l3.full_name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                                          <GrowthBadge pct={l3.growth_pct ?? null} />
                                                          <div className="text-right">
                                                            <div className="flex items-center gap-2 justify-end">
                                                              <span className="text-xs text-slate-400">{Math.round(l3.total_qty ?? 0)} τεμ.</span>
                                                              <div className="text-sm font-semibold text-slate-700">{fmtEur(l3.net_revenue)}</div>
                                                            </div>
                                                            {l3.prev_qty > 0 && (
                                                              <div className="flex items-center gap-2 justify-end">
                                                                <span className="text-xs text-slate-300">{Math.round(l3.prev_qty)} τεμ.</span>
                                                                <div className="text-xs text-slate-400">{fmtEur(l3.prev_revenue)}</div>
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                      </button>

                                                      {/* L3 bar */}
                                                      <div className="px-4 pb-1 bg-white">
                                                        <div className="ml-10 w-full bg-slate-100 rounded-sm h-1">
                                                          <div className="h-1 rounded-sm bg-indigo-200 transition-all" style={{ width: `${Math.max((l3.net_revenue / maxL3Rev) * 100, 2)}%` }} />
                                                        </div>
                                                      </div>

                                                      {/* L3 expanded */}
                                                      {isL3Exp && (
                                                        <DrillContent
                                                          catIdKey={l3IdKey}
                                                          skus={dashboardSkuData[l3IdKey] ?? []}
                                                          skusLoading={dashboardSkuLoading.has(l3IdKey)}
                                                          topCustomers={topCustomersData[l3IdKey] ?? []}
                                                          topCustomersLoading={topCustomersLoading.has(l3IdKey)}
                                                        />
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ===== VISITS LOG ===== */}
            <div id="section-visits">
              <VisitsLog key={`visits-${visitsRefreshKey}`} currentUser={currentUser} onNewVisit={() => setShowNewVisitDialog(true)} customers={customers} />
            </div>

            {/* ===== FILTERS ===== */}
            <section id="section-filter" className="bg-white rounded-xl shadow p-4 space-y-4">
              <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <MapPin className="w-4 h-4 text-indigo-500" />Filter Customers
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">Search Customer</div>
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Name, Code (e.g. 10234)" className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
              </div>
              <ExpandableFilterGroup label="Geographic Area" selected={selectedArea} items={areas} onSelect={(a) => { setSelectedArea(a); setSelectedCity(''); }} onClear={() => { setSelectedArea(''); setSelectedCity(''); }} />
              {selectedArea && cities.length > 0 && <ExpandableFilterGroup label="City" selected={selectedCity} items={cities} onSelect={setSelectedCity} onClear={() => setSelectedCity('')} />}
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Not Visited Since</div>
                <div className="flex flex-wrap gap-2">
                  {NOT_VISITED_OPTIONS.map(opt => {
                    const count = opt.value ? notVisitedCounts[opt.value] : filteredCustomers.length;
                    return (
                      <button key={opt.label} onClick={() => setNotVisitedDays(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${notVisitedDays === opt.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'}`}>
                        {opt.label}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${notVisitedDays === opt.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sales Filter */}
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Πωλήσεις ({selectedPeriod.shortLabel})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { label: 'Όλοι', value: 'all' as const },
                      { label: 'Με πωλήσεις', value: 'with' as const },
                      { label: 'Χωρίς πωλήσεις', value: 'without' as const },
                    ]).map(opt => {
                      const count = opt.value === 'all'
                        ? filteredCustomers.length
                        : opt.value === 'with'
                        ? filteredCustomers.filter(c => customersWithSalesSet.has(String(c.trdr_id))).length
                        : filteredCustomers.filter(c => !customersWithSalesSet.has(String(c.trdr_id))).length;
                      return (
                        <button key={opt.value} onClick={() => setSalesFilter(opt.value)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                            salesFilter === opt.value
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
                          }`}>
                          {opt.label}
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${salesFilter === opt.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* ===== CUSTOMERS ===== */}
            <div id="section-customers">
              <CustomerListSection
                title={currentUser.role === 'manager' || currentUser.role === 'admin' || currentUser.role === 'exec' ? 'All Customers' : 'Your Customers'}
                customers={displayedCustomers} currentUserRole={currentUser.role}
                onSelectCustomer={setSelectedCustomer} getDaysSinceVisit={getDaysSinceVisit}
              />
            </div>

            {/* ===== PROSPECTS ===== */}
            <div id="section-prospects">
              <ProspectsList key={`prospects-${prospectsRefreshKey}`} currentUser={currentUser} onNewProspect={() => setShowNewProspectDialog(true)} onSelectProspect={setSelectedProspect} />
            </div>
          </>
        )}

        {selectedCustomer && <CustomerView customer={selectedCustomer} onBack={() => setSelectedCustomer(null)} />}
        {selectedProspect && <ProspectView prospect={selectedProspect} onBack={() => setSelectedProspect(null)} />}
      </main>

      <NewVisitDialog isOpen={showNewVisitDialog} onClose={() => setShowNewVisitDialog(false)} customers={filteredCustomers}
        onSave={() => { setShowNewVisitDialog(false); setVisitsRefreshKey(k => k + 1); }} />
      <NewProspectDialog isOpen={showNewProspectDialog} onClose={() => setShowNewProspectDialog(false)} currentUser={currentUser}
        onSave={() => { setShowNewProspectDialog(false); setProspectsRefreshKey(k => k + 1); }}
        areas={areas}
        cities={(area) => customers.filter(c => c.area === area).map(c => c.city).filter((v, i, a) => a.indexOf(v) === i).sort()}
        onViewCustomer={(code) => { const customer = customers.find(c => c.code === code); if (customer) { setShowNewProspectDialog(false); setSelectedCustomer(customer); } }}
        onViewProspect={(_id) => { setShowNewProspectDialog(false); }}
      />
    </div>
  );
}
