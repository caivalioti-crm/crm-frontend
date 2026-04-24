import {
  Search,
  MapPin,
  ChevronDown,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  User,
  Calendar,
  UserPlus,
} from 'lucide-react';
import { useDashboardFigma } from '../../hooks/useDashboardFigma';


// UI-only components (no business logic)

import { NewVisitDialog } from '../visits/NewVisitDialog';
import { VisitsLog } from '../visits/VisitsLog';
import { ProspectsList } from '../prospects/ProspectsList';
import { NewProspectDialog } from '../prospects/NewProspectDialog';


// Utilities
import { formatDate } from '../../utils/dateFormat.ts';


// export function DashboardFigma() {
//   const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
//   const [showNewProspectDialog, setShowNewProspectDialog] = useState(false);

//   // Destructure filters for easier access
//   const {
//     selectedArea,
//     selectedCity,
//     searchQuery,
//     lastVisitFilter,
//     selectedPeriod,
//     geoView,
//     selectedGeoArea,
//   } = filters;

//   // Helper functions to update individual filter values
//   const updateFilter = (key: keyof DashboardFilters, value: any) => {
//     onFiltersChange({ ...filters, [key]: value });
//   };

//   const handleSaveVisit = (visitData: any) => {
//     console.log('New visit created:', visitData);
//     // TODO: Save to backend/state
//     alert('Visit saved successfully!');
//   };

//   const setSelectedArea = (value: string) => updateFilter('selectedArea', value);
//   const setSelectedCity = (value: string) => updateFilter('selectedCity', value);
//   const setSearchQuery = (value: string) => updateFilter('searchQuery', value);
//   const setLastVisitFilter = (value: string) => updateFilter('lastVisitFilter', value);
//   const setSelectedPeriod = (value: string) => updateFilter('selectedPeriod', value);
//   const setGeoView = (value: 'area' | 'city') => updateFilter('geoView', value);
//   const setSelectedGeoArea = (value: string) => updateFilter('selectedGeoArea', value);

//   // Filter customers by current user if they're a rep
//   const userCustomers = useMemo(() => {
//     if (currentUser.role === 'manager') {
//       return mockCustomers;
//     }
//     return mockCustomers.filter(c => c.assignedRepId === currentUser.id);
//   }, [currentUser]);

//   const getPeriodLabel = (period: string) => {
//     const labels: Record<string, string> = {
//       '2026-YTD': '2026 Year to Date (Jan-Apr)',
//       '2026-Q1': 'Q1 2026 (Jan-Mar)',
//       '2025-YTD': '2025 Full Year',
//       '2025-Q4': 'Q4 2025 (Oct-Dec)',
//       '2025-Q3': 'Q3 2025 (Jul-Sep)',
//       '2025-Q2': 'Q2 2025 (Apr-Jun)',
//       '2025-Q1': 'Q1 2025 (Jan-Mar)',
//       '2024-YTD': '2024 Full Year',
//     };
//     return labels[period] || period;
//   };

//   const getYTDSales = (repId: string) => {
//     // Mock YTD data - in production this would come from API
//     const ytdData: Record<string, number> = {
//       'john': 485000, // Q1 only so far in 2026
//       'maria': 620000,
//       'yannis': 340000,
//     };
//     return ytdData[repId] || 0;
//   };

//   const getFullYearSales = (repId: string, year: string) => {
//     // Mock full year data
//     if (year === '2025-YTD') {
//       const fullYear2025: Record<string, number> = {
//         'john': 1820000,
//         'maria': 2240000,
//         'yannis': 1280000,
//       };
//       return fullYear2025[repId] || 0;
//     }
//     if (year === '2024-YTD') {
//       const fullYear2024: Record<string, number> = {
//         'john': 1620000,
//         'maria': 1900000,
//         'yannis': 1150000,
//       };
//       return fullYear2024[repId] || 0;
//     }
//     return 0;
//   };

//   const getSalesForPeriod = (stat: any) => {
//     if (selectedPeriod === '2026-YTD') {
//       return getYTDSales(stat.repId);
//     } else if (selectedPeriod === '2025-YTD' || selectedPeriod === '2024-YTD') {
//       return getFullYearSales(stat.repId, selectedPeriod);
//     }
//     return stat.totalSales; // Use default Q1 2026 data
//   };

//   const getLastYearGrowth = (repId: string) => {
//     // Mock data - in production this would come from API
//     if (selectedPeriod === '2026-YTD') {
//       // YTD 2026 vs Q1 2025 (same period comparison)
//       const growthData: Record<string, number> = {
//         'john': 12.5,
//         'maria': 18.3,
//         'yannis': 8.7,
//       };
//       return growthData[repId] || 0;
//     } else if (selectedPeriod === '2025-YTD') {
//       // Full year 2025 vs 2024
//       const growthData: Record<string, number> = {
//         'john': 12.3,
//         'maria': 17.9,
//         'yannis': 11.3,
//       };
//       return growthData[repId] || 0;
//     } else if (selectedPeriod === '2024-YTD') {
//       // Full year 2024 vs 2023
//       const growthData: Record<string, number> = {
//         'john': 8.5,
//         'maria': 14.2,
//         'yannis': 6.8,
//       };
//       return growthData[repId] || 0;
//     }
//     // Q1 2026 vs Q1 2025
//     const growthData: Record<string, number> = {
//       'john': 12.5,
//       'maria': 18.3,
//       'yannis': 8.7,
//     };
//     return growthData[repId] || 0;
//   };

//   const getComparisonLabel = () => {
//     if (selectedPeriod === '2026-YTD') {
//       return 'vs Q1 2025';
//     } else if (selectedPeriod === '2025-YTD') {
//       return 'vs 2024';
//     } else if (selectedPeriod === '2024-YTD') {
//       return 'vs 2023';
//     } else if (selectedPeriod === '2026-Q1') {
//       return 'vs Q1 2025';
//     }
//     return 'vs same period last year';
//   };

//   const getGeoPerformance = () => {
//     // Get unique areas and cities from user's customers
//     const userAreas = [...new Set(userCustomers.map(c => c.area))];
//     const userCities = userCustomers.map(c => ({ city: c.city, area: c.area }));

//     // Mock geographic performance data - would come from API in production
//     const allAreaPerformance = [
//       { name: 'Attica', sales: 285000, growth: 15.2, customers: 3 },
//       { name: 'Central Macedonia', sales: 220000, growth: 18.3, customers: 1 },
//       { name: 'Crete', sales: 145000, growth: 8.5, customers: 2 },
//       { name: 'Western Greece', sales: 95000, growth: 12.1, customers: 1 },
//       { name: 'Thessaly', sales: 68000, growth: -5.2, customers: 2 },
//     ];

//     const allCityPerformance = [
//       { name: 'Athens', sales: 145000, growth: 16.0, customers: 1, area: 'Attica' },
//       { name: 'Thessaloniki', sales: 220000, growth: 18.3, customers: 1, area: 'Central Macedonia' },
//       { name: 'Piraeus', sales: 125000, growth: 14.2, customers: 1, area: 'Attica' },
//       { name: 'Heraklion', sales: 85000, growth: 10.5, customers: 1, area: 'Crete' },
//       { name: 'Patras', sales: 95000, growth: 12.1, customers: 1, area: 'Western Greece' },
//       { name: 'Chania', sales: 60000, growth: 6.0, customers: 1, area: 'Crete' },
//       { name: 'Larissa', sales: 42000, growth: -3.8, customers: 1, area: 'Thessaly' },
//       { name: 'Volos', sales: 26000, growth: -8.5, customers: 1, area: 'Thessaly' },
//     ];

//     if (geoView === 'area') {
//       // Filter to only show areas where user has customers
//       return allAreaPerformance
//         .filter(area => userAreas.includes(area.name))
//         .sort((a, b) => b.sales - a.sales);
//     } else {
//       // Filter cities by selected area (from filter dropdown or double-clicked area card)
//       const filterArea = selectedGeoArea || selectedArea;
//       const userCityNames = userCities.map(c => c.city);

//       let filteredCities = allCityPerformance.filter(city => userCityNames.includes(city.name));

//       if (filterArea) {
//         filteredCities = filteredCities.filter(city => city.area === filterArea);
//       }

//       return filteredCities.sort((a, b) => b.sales - a.sales);
//     }
//   };

//   const handleAreaDoubleClick = (areaName: string) => {
//     onFiltersChange({ ...filters, geoView: 'city', selectedGeoArea: areaName });
//   };

//   const handleSwitchToAreaView = () => {
//     onFiltersChange({ ...filters, geoView: 'area', selectedGeoArea: '' });
//   };

//   const handleClearGeoFilter = () => {
//     setSelectedGeoArea('');
//   };

//   const getLastVisitStats = useMemo(() => {
//     const now = new Date();
//     const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
//     const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
//     const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
//     const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

//     return {
//       month: userCustomers.filter(c => new Date(c.lastVisitDate) < oneMonthAgo).length,
//       quarter: userCustomers.filter(c => new Date(c.lastVisitDate) < threeMonthsAgo).length,
//       halfYear: userCustomers.filter(c => new Date(c.lastVisitDate) < sixMonthsAgo).length,
//       year: userCustomers.filter(c => new Date(c.lastVisitDate) < oneYearAgo).length,
//     };
//   }, [userCustomers]);

//   const filteredCustomers = useMemo(() => {
//     return userCustomers.filter(customer => {
//       const matchesArea = !selectedArea || customer.area === selectedArea;
//       const matchesCity = !selectedCity || customer.city === selectedCity;
//       const matchesSearch = !searchQuery ||
//         customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//         customer.nameGreek.includes(searchQuery) ||
//         customer.code.includes(searchQuery);

//       let matchesLastVisit = true;
//       if (lastVisitFilter) {
//         const now = new Date();
//         const lastVisit = new Date(customer.lastVisitDate);

//         switch (lastVisitFilter) {
//           case '1m':
//             const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
//             matchesLastVisit = lastVisit < oneMonthAgo;
//             break;
//           case '3m':
//             const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
//             matchesLastVisit = lastVisit < threeMonthsAgo;
//             break;
//           case '6m':
//             const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
//             matchesLastVisit = lastVisit < sixMonthsAgo;
//             break;
//           case '1y':
//             const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
//             matchesLastVisit = lastVisit < oneYearAgo;
//             break;
//         }
//       }

//       return matchesArea && matchesCity && matchesSearch && matchesLastVisit;
//     });
//   }, [userCustomers, selectedArea, selectedCity, searchQuery, lastVisitFilter]);

//   // Visits Summary based on filtered customers
//   const visitsSummary = useMemo(() => {
//     const filteredCustomerCodes = new Set(filteredCustomers.map(c => c.code));
//     const relevantVisits = mockVisits.filter(v => filteredCustomerCodes.has(v.customerCode));

//     const now = new Date();
//     const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
//     const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

//     const visitsThisWeek = relevantVisits.filter(v => new Date(v.date) >= weekAgo).length;
//     const visitsThisMonth = relevantVisits.filter(v => new Date(v.date) >= monthAgo).length;

//     const allTasks = relevantVisits.flatMap(v => v.tasks);
//     const pendingTasks = allTasks.filter(t => t.status !== 'completed').length;
//     const completedTasks = allTasks.filter(t => t.status === 'completed').length;

//     const customersWithVisits = new Set(relevantVisits.map(v => v.customerCode)).size;
//     const customersWithoutVisits = filteredCustomers.length - customersWithVisits;

//     return {
//       totalVisits: relevantVisits.length,
//       visitsThisWeek,
//       visitsThisMonth,
//       totalTasks: allTasks.length,
//       pendingTasks,
//       completedTasks,
//       customersWithVisits,
//       customersWithoutVisits
//     };
//   }, [filteredCustomers]);

//   const cities = selectedArea ? citiesByArea[selectedArea] || [] : [];

//   const getDaysSinceVisit = (lastVisitDate: string): number => {
//     const now = new Date();
//     const lastVisit = new Date(lastVisitDate);
//     const diffTime = Math.abs(now.getTime() - lastVisit.getTime());
//     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
//     return diffDays;
//   };

export function DashboardFigma() {


const {
  cities,
  visitsSummary,
  filteredCustomers,
  currentUser,
  mockSalesReps,
  mockSalesRepStats,
  onUserChange,
  onSelectCustomer,
  showNewVisitDialog,
  setShowNewVisitDialog,
  selectedPeriod,
  setSelectedPeriod,
  getPeriodLabel,
  getComparisonLabel,
  getLastVisitStats,
  getDaysSinceVisit,
  selectedArea,
  showNewProspectDialog,
  setShowNewProspectDialog,
  setSelectedArea,
  selectedCity,
  setSelectedCity,
  searchQuery,
  setSearchQuery,
  lastVisitFilter,
  setLastVisitFilter,
  userCustomers,
  onSelectProspect,
  handleSaveVisit,
  geoView,
  setGeoView,
  selectedGeoArea,
  setSelectedGeoArea,
  getLastYearGrowth,
  getSalesForPeriod,
  getGeoPerformance,
  handleAreaDoubleClick,
} = useDashboardFigma();

  return (
    <div className="h-full flex flex-col">
        {visitsSummary && null}
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 sm:px-8 py-4 sm:py-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2">Soft1 Auto Parts CRM</h1>
            <p className="text-sm sm:text-base text-blue-100">Sales Representative Dashboard</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            
            {/* User Selector */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-blue-100" />
                <div className="relative">
                  <select
                    value={currentUser.id}
                    onChange={(e) => {
                      const user = mockSalesReps.find(r => r.id === e.target.value);
                      if (user) onUserChange(user);
                    }}
                    className="bg-transparent text-white font-medium border-none outline-none cursor-pointer appearance-none pr-8 text-sm sm:text-base min-h-[44px]"
                  >
                    {mockSalesReps.map(rep => (
                      <option key={rep.id} value={rep.id} className="text-gray-900">
                        {rep.name} {rep.role === 'manager' && '(Manager)'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-100 pointer-events-none" />
                </div>
              </div>
            </div>
            {/* Section jump links */}
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => document.getElementById('section-performance')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5 text-xs text-white min-h-[40px]"
              >
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Performance</span>
              </button>
              <button
                onClick={() => document.getElementById('section-geo')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5 text-xs text-white min-h-[40px]"
              >
                <MapPin className="w-4 h-4" />
                <span className="hidden sm:inline">Geo</span>
              </button>
              <button
                onClick={() => document.getElementById('section-visits')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5 text-xs text-white min-h-[40px]"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Visits</span>
              </button>
              <button
                onClick={() => document.getElementById('section-filters')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5 text-xs text-white min-h-[40px]"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </button>
              <button
                onClick={() => document.getElementById('section-customers')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5 text-xs text-white min-h-[40px]"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Customers</span>
              </button>
              <button
                onClick={() => document.getElementById('section-prospects')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5 text-xs text-white min-h-[40px]"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Prospects</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          {/* Sales Rep Statistics */}
          <div id="section-performance">
            <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                    {currentUser.role === 'manager' ? 'Team Performance' : 'Your Performance'}
                  </h2>
                  <div className="relative">
                    <select
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                      className="text-sm font-medium text-blue-600 bg-transparent border-none outline-none cursor-pointer appearance-none pr-5 hover:text-blue-700"
                    >
                      <option value="2026-YTD">2026 YTD</option>
                      <option value="2026-Q1">Q1 2026</option>
                      <option value="2025-YTD">2025 Full Year</option>
                      <option value="2025-Q4">Q4 2025</option>
                      <option value="2025-Q3">Q3 2025</option>
                      <option value="2025-Q2">Q2 2025</option>
                      <option value="2025-Q1">Q1 2025</option>
                      <option value="2024-YTD">2024 Full Year</option>
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-600 pointer-events-none" />
                  </div>
                </div>
                <p className="text-sm text-gray-600">{getPeriodLabel(selectedPeriod)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {(currentUser.role === 'manager' ? mockSalesRepStats : mockSalesRepStats.filter(s => s.repId === currentUser.id)).map((stat, idx) => {
              const growth = getLastYearGrowth(stat.repId);
              const sales = getSalesForPeriod(stat);
              return (
              <div
                key={stat.repId}
                className="bg-white rounded-xl p-5 shadow-md border-l-4"
                style={{
                  borderLeftColor: idx === 0 ? '#3b82f6' : idx === 1 ? '#10b981' : '#f59e0b'
                }}
              >
                <div className="text-sm text-gray-600 mb-1">{stat.repName}</div>
                <div className="flex items-baseline gap-2 mb-3">
                  <div className="text-2xl font-bold text-gray-900">
                    €{(sales / 1000).toFixed(0)}k
                  </div>
                  {growth !== 0 && (
                    <div className={`text-xs font-medium flex items-center gap-0.5 ${
                      growth > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {growth > 0 ? '↑' : '↓'}
                      {Math.abs(growth).toFixed(1)}%
                    </div>
                  )}
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    {stat.customersVisited} visits
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                    {stat.tasksCompleted} completed
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-orange-600" />
                    {stat.tasksPending} pending
                  </div>
                </div>
                {growth !== 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      {getComparisonLabel()}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
            </div>
          </div>

          {/* Geographic Performance */}
          <div id="section-geo">
            <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                    Performance by {geoView === 'area' ? 'Geographic Area' : 'City'}
                  </h2>
                  {geoView === 'city' && (selectedGeoArea || selectedArea) && (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                        {selectedGeoArea || selectedArea}
                      </span>
                  </div>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {getPeriodLabel(selectedPeriod)}
                  {geoView === 'area' && <span className="text-gray-400 ml-2">• Double-click area to view cities</span>}
                </p>
              </div>
              {geoView === 'city' && (
                <button
                  onClick={() => {
                  setGeoView('area');
                  setSelectedGeoArea('');
                }}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1.5"
                >
                  ← Back to Areas
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {getGeoPerformance().length === 0 ? (
                <div className="col-span-full bg-white rounded-xl p-8 shadow-md text-center text-gray-500">
                  {geoView === 'city' && (selectedGeoArea || selectedArea)
                    ? `No cities found in ${selectedGeoArea || selectedArea}`
                    : 'No geographic data available'}
                </div>
              ) : (
                getGeoPerformance().map((geo) => (
                <div
                  key={geo.name}
                  onDoubleClick={() => {
                    if (geoView === 'area') {
                      handleAreaDoubleClick(geo.name);
                    }
                  }}
                  className={`bg-white rounded-xl p-4 shadow-md border-t-4 border-indigo-500 transition-all ${
                    geoView === 'area' ? 'cursor-pointer hover:shadow-lg hover:scale-105' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-sm font-semibold text-gray-900">{geo.name}</div>
                    {geoView === 'city' && 'area' in geo && (
                      <div className="text-xs text-gray-500">{geo.area}</div>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2 mb-2">
                    <div className="text-xl font-bold text-gray-900">
                      €{(geo.sales / 1000).toFixed(0)}k
                    </div>
                    {geo.growth !== 0 && (
                      <div className={`text-xs font-medium flex items-center gap-0.5 ${
                        geo.growth > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {geo.growth > 0 ? '↑' : '↓'}
                        {Math.abs(geo.growth).toFixed(1)}%
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Users className="w-3.5 h-3.5" />
                    {geo.customers} customer{geo.customers > 1 ? 's' : ''}
                  </div>

                  {geo.growth !== 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="text-xs text-gray-500">
                        {getComparisonLabel()}
                      </div>
                    </div>
                  )}
                </div>
              ))
              )}
            </div>
          </div>

          <div id="section-visits">
             <VisitsLog
              currentUser={currentUser}
              onNewVisit={() => setShowNewVisitDialog(true)}
              onSelectCustomer={(code) => {
                const customer = userCustomers.find(c => c.code === code);
                if (customer) onSelectCustomer(customer);
              }}
            />
          </div>

          {/* Filters Section */}
          <div id="section-filters" className="bg-white rounded-xl shadow-md p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Filter Customers
            </h2>

            <div className="space-y-4">
              {/* Area Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Geographic Area: {selectedArea || 'All'}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedArea('')}
                    className={`px-3 py-2 rounded-lg border-2 text-sm ${
                      !selectedArea
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedArea('Attica')}
                    className={`px-3 py-2 rounded-lg border-2 text-sm ${
                      selectedArea === 'Attica'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Attica
                  </button>
                  <button
                    onClick={() => setSelectedArea('Central Macedonia')}
                    className={`px-3 py-2 rounded-lg border-2 text-sm ${
                      selectedArea === 'Central Macedonia'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Central Macedonia
                  </button>
                  <button
                    onClick={() => setSelectedArea('Western Greece')}
                    className={`px-3 py-2 rounded-lg border-2 text-sm ${
                      selectedArea === 'Western Greece'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Western Greece
                  </button>
                  <button
                    onClick={() => setSelectedArea('Crete')}
                    className={`px-3 py-2 rounded-lg border-2 text-sm ${
                      selectedArea === 'Crete'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Crete
                  </button>
                  <button
                    onClick={() => setSelectedArea('Thessaly')}
                    className={`px-3 py-2 rounded-lg border-2 text-sm ${
                      selectedArea === 'Thessaly'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Thessaly
                  </button>
                </div>
              </div>

                            {/* City Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City: {selectedCity || 'All'}
                </label>

                {!selectedArea ? (
                  <div className="text-sm text-gray-500 italic">
                    Select an area first
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      key="all"
                      onClick={() => setSelectedCity('')}
                      className={`px-3 py-2 rounded-lg border-2 text-sm ${
                        !selectedCity
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      All
                    </button>

                    {cities.map((city) => (
                      <button
                        key={city}
                        onClick={() => setSelectedCity(city)}
                        className={`px-3 py-2 rounded-lg border-2 text-sm ${
                          selectedCity === city
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                )}
              </div>


              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Customer
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Name, Code (e.g. 10234)"
                    className="w-full pl-10 pr-3 sm:pr-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Last Visit Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Not Visited Since
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setLastVisitFilter('')}
                    className={`px-3 py-2 rounded-lg border-2 text-sm ${
                      lastVisitFilter === ''
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setLastVisitFilter('1m')}
                    className={`px-3 py-2 rounded-lg border-2 text-sm ${
                      lastVisitFilter === '1m'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    1 month ({getLastVisitStats.month})
                  </button>
                  <button
                    onClick={() => setLastVisitFilter('3m')}
                    className={`px-3 py-2 rounded-lg border-2 text-sm ${
                      lastVisitFilter === '3m'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    3 months ({getLastVisitStats.quarter})
                  </button>
                  <button
                    onClick={() => setLastVisitFilter('6m')}
                    className={`px-3 py-2 rounded-lg border-2 text-sm ${
                      lastVisitFilter === '6m'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    6 months ({getLastVisitStats.halfYear})
                  </button>
                  <button
                    onClick={() => setLastVisitFilter('1y')}
                    className={`px-3 py-2 rounded-lg border-2 text-sm ${
                      lastVisitFilter === '1y'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    1 year ({getLastVisitStats.year})
                  </button>
                </div>
              </div>
            </div>

            {/* Active Filters */}
            {(selectedArea || selectedCity || searchQuery || lastVisitFilter) && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="text-gray-600">Active filters:</span>
                {selectedArea && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                    {selectedArea}
                  </span>
                )}
                {selectedCity && (
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                    {selectedCity}
                  </span>
                )}
                {searchQuery && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                    "{searchQuery}"
                  </span>
                )}
                {lastVisitFilter && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full">
                    {lastVisitFilter === '1m' && 'Not visited: 1 month'}
                    {lastVisitFilter === '3m' && 'Not visited: 3 months'}
                    {lastVisitFilter === '6m' && 'Not visited: 6 months'}
                    {lastVisitFilter === '1y' && 'Not visited: 1 year'}
                  </span>
                )}
                <button
                  onClick={() => {
                    setSelectedArea('');
                    setSelectedCity('');
                    setSearchQuery('');
                    setLastVisitFilter('');
                  }}
                  className="ml-2 text-gray-500 hover:text-gray-700 underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Customer List */}
          <div id="section-customers" className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                {currentUser.role === 'manager' ? 'All Customers' : 'Your Customers'} ({filteredCustomers.length})
              </h2>
            </div>

            <div className="divide-y divide-gray-200">
              {filteredCustomers.map((customer, index) => (
                <button
                  key={`${customer.code ?? 'customer'}-${index}`}
                  onClick={() => onSelectCustomer(customer)}
                  className="w-full px-4 sm:px-6 py-4 sm:py-5 hover:bg-blue-50 active:bg-blue-100 transition-colors text-left group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-2">
                        <span className="px-2 py-1 bg-gray-900 text-white text-xs font-mono rounded shrink-0">
                          {customer.code}
                        </span>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 group-hover:text-blue-600 break-words">
                          {customer.name}
                        </h3>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">{customer.nameGreek}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          {customer.city}, {customer.area}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {customer.type}
                        </span>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          {customer.group}
                        </span>
                        {currentUser.role === 'manager' && customer.assignedRepId && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {mockSalesReps.find(r => r.id === customer.assignedRepId)?.name.split(' ')[0]}
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm mt-1">
                        <span className="text-gray-500">Last visit: </span>
                        <span className={getDaysSinceVisit(customer.lastVisitDate) > 90 ? 'text-orange-600 font-medium' : 'text-gray-500'}>
                          {formatDate(customer.lastVisitDate)}
                          {getDaysSinceVisit(customer.lastVisitDate) > 90 && (
                            <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
                              {getDaysSinceVisit(customer.lastVisitDate)} days ago
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                    <TrendingUp className="w-5 h-5 text-gray-400 group-hover:text-blue-600 shrink-0 mt-1" />
                  </div>
                </button>
              ))}

              {filteredCustomers.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-500">
                  No customers found matching your criteria
                </div>
              )}
            </div>
          </div>
        
      {/* Prospects */}
          <div id="section-prospects">
            <ProspectsList
              currentUser={currentUser}
              onNewProspect={() => setShowNewProspectDialog(true)}
              onSelectProspect={onSelectProspect}
            />
          </div>

        </div>
      </div>
      
      {/* New Visit Dialog */}
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
          alert('Prospect αποθηκεύτηκε!');
        }}
      />
    </div>
  );
}
