import {
  ArrowLeft,
  Info,
  Building2,
  Truck,
  Plus,
  Calendar,
  ShoppingCart,
  Lightbulb,
  Users,
  Swords,
  Store,
  FileText,
  Tag,
  ChevronDown,
} from 'lucide-react';

import { formatDate } from '../../utils/dateFormat';
import { NewVisitDialog } from '../visits/NewVisitDialog';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { CommercialEntityBase } from '../../types/commercialEntity';

const BASE_URL = 'http://localhost:3001';

async function authedFetch(url: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

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

const SHOP_TYPE_LABELS: Record<string, string> = {
  auto_parts_retailer: 'Ανταλλακτικά',
  garage: 'Γκαράζ',
  body_shop: 'Φανοποιείο',
  dealership: 'Αντιπροσωπεία',
  truck_parts: 'Φορτηγά',
  other: 'Άλλο',
};

const STOCK_BEHAVIOR_LABELS: Record<string, string> = {
  keeps_stock: 'Τηρεί Απόθεμα',
  on_demand: "Παραγγελία κατ'ανάγκη",
  mixed: 'Μικτό',
};

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  order:   { label: 'Παραγγελία', bg: 'bg-blue-100',   text: 'text-blue-700' },
  invoice: { label: 'Τιμολόγιο',  bg: 'bg-green-100',  text: 'text-green-700' },
  credit:  { label: 'Πίστωση',    bg: 'bg-red-100',    text: 'text-red-700' },
};

const DOC_PERIODS = [
  { label: '2026 YTD', from: '2026-01-01', to: '2026-12-31' },
  { label: '2025',     from: '2025-01-01', to: '2025-12-31' },
  { label: '2024',     from: '2024-01-01', to: '2024-12-31' },
  { label: 'Όλα',      from: '2022-01-01', to: '2026-12-31' },
];

export function CustomerView({ customer, onBack }: CustomerViewProps) {
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  const [visitsRefreshKey, setVisitsRefreshKey] = useState(0);

  // Visits
  const [visits, setVisits] = useState<any[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);

  // Sales (monthly summary)
  const [sales, setSales] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);

  // Documents (orders & invoices)
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docPeriodIdx, setDocPeriodIdx] = useState(0);
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'order' | 'invoice' | 'credit'>('all');
  const [docsExpanded, setDocsExpanded] = useState(false);

  // Entity profile
  const [competitorInfo, setCompetitorInfo] = useState<any>(null);
  const [shopProfile, setShopProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  // Categories discussed
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

useEffect(() => {
  authedFetch(`/api/customers/${customer.code}/categories`)
    .then(data => setCategories(Array.isArray(data) ? data : []))
    .catch(console.error)
    .finally(() => setCategoriesLoading(false));
}, [customer.code, visitsRefreshKey]);

  useEffect(() => {
    authedFetch(`/api/visits?customer_code=${customer.code}`)
      .then(data => setVisits(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setVisitsLoading(false));
  }, [customer.code, visitsRefreshKey]);

  useEffect(() => {
    const from = '2025-01-01';
    const to = '2026-12-31';
    authedFetch(`/api/erp/customers/${customer.code}/sales?from=${from}&to=${to}`)
      .then(data => setSales(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setSalesLoading(false));
  }, [customer.code]);

    useEffect(() => {
      setDocsLoading(true);
      setDocsExpanded(false);
      const { from, to } = DOC_PERIODS[docPeriodIdx];
      authedFetch(`/api/erp/customers/${customer.code}/documents?from=${from}&to=${to}`)
        .then(data => {
          console.log('Documents sample:', data.slice(0, 3));
          setDocuments(Array.isArray(data) ? data : []);
        })
        .catch(console.error)
        .finally(() => setDocsLoading(false));
    }, [customer.code, docPeriodIdx]);

  useEffect(() => {
    authedFetch(`/api/entity-profile/customer/${customer.code}`)
      .then(data => {
        setCompetitorInfo(data.competitor_info ?? null);
        setShopProfile(data.shop_profile ?? null);
      })
      .catch(console.error)
      .finally(() => setProfileLoading(false));
  }, [customer.code]);

  const totalSales = sales.reduce((sum: number, s: any) => sum + (s.netamnt ?? 0), 0);

  const filteredDocs = docTypeFilter === 'all' ? documents : documents.filter(d => d.type === docTypeFilter);
  const visibleDocs = docsExpanded ? filteredDocs : filteredDocs.slice(0, 8);

  const docCounts = {
    order: documents.filter(d => d.type === 'order').length,
    invoice: documents.filter(d => d.type === 'invoice').length,
    credit: documents.filter(d => d.type === 'credit').length,
  };

  const lastInvoice = documents.find(d => d.type === 'invoice');
  const lastOrder = documents.find(d => d.type === 'order');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* HEADER */}
      <header className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="flex items-center gap-2 text-white/90 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </button>
            <button
              onClick={() => setShowNewVisitDialog(true)}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              New Visit
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 bg-white/20 rounded-md font-mono text-sm">{customer.code}</span>
            <h1 className="text-xl font-bold">{customer.name}</h1>
          </div>
          {(customer.city || customer.area) && (
            <div className="text-white/70 text-sm">
              {customer.city}{customer.city && customer.area ? ', ' : ''}{customer.area}
            </div>
          )}
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-4">

        {/* CUSTOMER DETAILS */}
        <section className="bg-white rounded-xl shadow p-5 border-l-4 border-indigo-500">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold">Στοιχεία Πελάτη</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm text-slate-700">
            <div className="space-y-2">
              <div className="font-medium text-slate-400 text-xs uppercase tracking-wide">Επικοινωνία</div>
              {customer.address && (
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <span>{customer.address}{customer.zip ? `, ${customer.zip}` : ''}{customer.city ? `, ${customer.city}` : ''}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2">
                  <span>✉️</span>
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline truncate">{customer.email}</a>
                </div>
              )}
              {customer.fax && <div>📠 {customer.fax}</div>}
              {customer.afm && (
                <div className="inline-block font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                  ΑΦΜ: {customer.afm}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="font-medium text-slate-400 text-xs uppercase tracking-wide">Μεταφορά</div>
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
                <div className="text-slate-400 text-xs italic">Δεν υπάρχουν στοιχεία</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="font-medium text-slate-400 text-xs uppercase tracking-wide">Πληροφορίες</div>
              {customer.area && <div>Περιοχή: <span className="font-medium">{customer.area}</span></div>}
              {customer.lastVisitDate ? (
                <div>Τελευταία επίσκεψη: <span className="font-medium">{formatDate(customer.lastVisitDate)}</span></div>
              ) : (
                <div className="text-slate-400 text-xs italic">Καμία επίσκεψη ακόμα</div>
              )}
            </div>
          </div>
        </section>

        {/* SHOP PROFILE + COMPETITOR INFO */}
        {!profileLoading && (shopProfile || competitorInfo) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {shopProfile && (
              <section className="bg-white rounded-xl shadow p-5 border-l-4 border-blue-400">
                <div className="flex items-center gap-2 mb-3">
                  <Store className="w-5 h-5 text-blue-500" />
                  <h2 className="text-base font-semibold">Προφίλ Καταστήματος</h2>
                </div>
                <div className="space-y-2 text-sm text-slate-700">
                  {shopProfile.shop_type && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Τύπος</span>
                      <span className="font-medium">{SHOP_TYPE_LABELS[shopProfile.shop_type] ?? shopProfile.shop_type}</span>
                    </div>
                  )}
                  {shopProfile.number_of_employees && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Εργαζόμενοι</span>
                      <span className="font-medium flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />{shopProfile.number_of_employees}
                      </span>
                    </div>
                  )}
                  {shopProfile.shop_size_m2 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Εμβαδό</span>
                      <span className="font-medium">{shopProfile.shop_size_m2} m²</span>
                    </div>
                  )}
                  {shopProfile.stock_behavior && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Απόθεμα</span>
                      <span className="font-medium">{STOCK_BEHAVIOR_LABELS[shopProfile.stock_behavior] ?? shopProfile.stock_behavior}</span>
                    </div>
                  )}
                </div>
              </section>
            )}
            {competitorInfo && (
              <section className="bg-white rounded-xl shadow p-5 border-l-4 border-orange-400">
                <div className="flex items-center gap-2 mb-3">
                  <Swords className="w-5 h-5 text-orange-500" />
                  <h2 className="text-base font-semibold">Ανταγωνισμός</h2>
                </div>
                <div className="space-y-2 text-sm text-slate-700">
                  {competitorInfo.main_competitor && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Κύριος</span>
                      <span className="font-medium">{competitorInfo.main_competitor}</span>
                    </div>
                  )}
                  {competitorInfo.other_competitors && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Άλλοι</span>
                      <span className="font-medium">{competitorInfo.other_competitors}</span>
                    </div>
                  )}
                  {competitorInfo.estimated_monthly_spend && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Μηνιαία Δαπάνη</span>
                      <span className="font-medium text-green-600">
                        €{Number(competitorInfo.estimated_monthly_spend).toLocaleString('el-GR')}
                      </span>
                    </div>
                  )}
                  {competitorInfo.competitor_strengths && (
                    <div>
                      <div className="text-slate-500 mb-1">Δυνατά σημεία</div>
                      <div className="text-xs bg-slate-50 rounded p-2">{competitorInfo.competitor_strengths}</div>
                    </div>
                  )}
                  {competitorInfo.switch_reason && (
                    <div>
                      <div className="text-slate-500 mb-1">Λόγος αλλαγής</div>
                      <div className="text-xs bg-slate-50 rounded p-2">{competitorInfo.switch_reason}</div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* VISITS */}
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-semibold">Επισκέψεις</h2>
            </div>
            {visits.length > 0 && (
              <span className="text-xs text-slate-500">{visits.length} σύνολο</span>
            )}
          </div>
          {visitsLoading ? (
            <div className="text-sm text-slate-400">Φόρτωση...</div>
          ) : visits.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Καμία επίσκεψη ακόμα</div>
          ) : (
            <div className="space-y-2">
              {visits.slice(0, 5).map((v: any) => (
                <div key={v.id} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{formatDate(v.visit_date)}</div>
                    {v.notes && <div className="text-xs text-slate-500 mt-0.5">{v.notes}</div>}
                    {v.visit_type && (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded mt-1 inline-block">
                        {v.visit_type}
                      </span>
                    )}
                  </div>
                  {v.owner_name && <span className="text-xs text-slate-400">{v.owner_name}</span>}
                </div>
              ))}
              {visits.length > 5 && (
                <div className="text-xs text-indigo-500 pt-1">+{visits.length - 5} ακόμα επισκέψεις</div>
              )}
            </div>
          )}
        </section>

        {/* SALES */}
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold">Sales Overview</h2>
            </div>
            {!salesLoading && sales.length > 0 && (
              <span className="text-sm font-semibold text-green-600">
                €{totalSales.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
          {salesLoading ? (
            <div className="text-sm text-slate-400">Φόρτωση...</div>
          ) : sales.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Δεν βρέθηκαν πωλήσεις</div>
          ) : (
            <div className="space-y-1">
              {sales.map((s: any) => (
                <div key={s.month} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0 text-sm">
                  <div className="text-slate-600">{s.month}</div>
                  <div className={`font-medium ${s.netamnt < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    €{s.netamnt.toLocaleString('el-GR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ORDERS & INVOICES */}
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-semibold">Παραγγελίες & Τιμολόγια</h2>
            </div>
            {/* Period selector */}
            <select
              value={docPeriodIdx}
              onChange={e => setDocPeriodIdx(Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1 text-slate-600 focus:ring-2 focus:ring-indigo-500"
            >
              {DOC_PERIODS.map((p, i) => (
                <option key={p.label} value={i}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Summary badges */}
          {!docsLoading && documents.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                {docCounts.order} παραγγελίες
              </span>
              <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                {docCounts.invoice} τιμολόγια
              </span>
              {docCounts.credit > 0 && (
                <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  {docCounts.credit} πιστωτικά
                </span>
              )}
            </div>
          )}

          {/* Last invoice + last order */}
          {!docsLoading && (lastInvoice || lastOrder) && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {lastInvoice && (
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <div className="text-xs text-green-600 font-medium mb-1">Τελευταίο Τιμολόγιο</div>
                  <div className="text-sm font-semibold text-slate-800">{lastInvoice.doc_number}</div>
                  <div className="text-xs text-slate-500">{formatDate(lastInvoice.trndate)}</div>
                  <div className="text-sm font-bold text-green-700 mt-1">
                    €{lastInvoice.netamnt.toLocaleString('el-GR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}
              {lastOrder && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="text-xs text-blue-600 font-medium mb-1">Τελευταία Παραγγελία</div>
                  <div className="text-sm font-semibold text-slate-800">{lastOrder.doc_number}</div>
                  <div className="text-xs text-slate-500">{formatDate(lastOrder.trndate)}</div>
                  <div className="text-sm font-bold text-blue-700 mt-1">
                    €{lastOrder.netamnt.toLocaleString('el-GR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Type filter */}
          {!docsLoading && documents.length > 0 && (
            <div className="flex gap-2 mb-3">
              {(['all', 'order', 'invoice', 'credit'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setDocTypeFilter(t); setDocsExpanded(false); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    docTypeFilter === t
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
                  }`}
                >
                  {t === 'all' ? 'Όλα' : TYPE_CONFIG[t].label}
                </button>
              ))}
            </div>
          )}

          {/* Document list */}
          {docsLoading ? (
            <div className="text-sm text-slate-400">Φόρτωση...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Δεν βρέθηκαν έγγραφα</div>
          ) : (
            <>
              <div className="space-y-1">
                {visibleDocs.map((doc: any) => {
                  const cfg = TYPE_CONFIG[doc.type] ?? TYPE_CONFIG.invoice;
                  return (
                    <div key={doc.findoc} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                        <span className="font-mono text-xs text-slate-600 truncate">{doc.doc_number}</span>
                        <span className="text-xs text-slate-400 shrink-0">{formatDate(doc.trndate)}</span>
                      </div>
                      <div className={`font-medium shrink-0 ml-2 ${doc.netamnt < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        €{Math.abs(doc.netamnt).toLocaleString('el-GR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredDocs.length > 8 && (
                <button
                  onClick={() => setDocsExpanded(v => !v)}
                  className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium py-2 border border-dashed border-indigo-200 rounded-lg"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${docsExpanded ? 'rotate-180' : ''}`} />
                  {docsExpanded ? 'Show less' : `Show all ${filteredDocs.length} documents`}
                </button>
              )}
            </>
          )}
        </section>

{/* CATEGORY INTELLIGENCE */}
<section className="bg-white rounded-xl shadow p-5">
  <div className="flex items-center gap-2 mb-4">
    <Lightbulb className="w-5 h-5 text-purple-600" />
    <h2 className="text-base font-semibold">Category Intelligence</h2>
    {categories.length > 0 && (
      <span className="text-xs text-slate-400 ml-auto">{categories.length} κατηγορίες</span>
    )}
  </div>

  {categoriesLoading ? (
    <div className="text-sm text-slate-400">Φόρτωση...</div>
  ) : categories.length === 0 ? (
    <div className="text-sm text-slate-400 italic">Καμία κατηγορία ακόμα</div>
  ) : (
    <div className="space-y-2">
      {categories.map((cat: any) => (
        <div
          key={`${cat.category_code}-${cat.subcategory_code ?? ''}`}
          className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Tag className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-700 truncate">
                {cat.full_name}
              </div>
              <div className="text-xs text-slate-400">
                {cat.subcategory_code
                  ? `${cat.category_code} › ${cat.subcategory_code}`
                  : cat.category_code}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0 ml-3">
            <div className="text-xs font-medium text-purple-600">
              {cat.times_discussed}×
            </div>
            <div className="text-xs text-slate-400">
              {formatDate(cat.last_discussed)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</section>

      </main>

      <NewVisitDialog
        isOpen={showNewVisitDialog}
        onClose={() => setShowNewVisitDialog(false)}
        customers={[{ code: customer.code, name: customer.name, city: customer.city, area: customer.area }]}
        onSave={() => {
          setShowNewVisitDialog(false);
          setVisitsRefreshKey(k => k + 1);
        }}
      />
    </div>
  );
}