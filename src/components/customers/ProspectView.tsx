import {
  ArrowLeft, Plus, MapPin, Building2, Calendar, Store,
  Lightbulb, Users, ChevronDown, ChevronRight, User, Info,
} from 'lucide-react';

import { formatDate } from '../../utils/dateFormat';
import { UnifiedProspectDialog } from '../prospects/UnifiedProspectDialog';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { CommercialEntityBase } from '../../types/commercialEntity';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

const SHOP_TYPE_LABELS: Record<string, string> = {
  auto_parts_retailer: 'Ανταλλακτικά', garage: 'Γκαράζ', body_shop: 'Φανοποιείο',
  dealership: 'Αντιπροσωπεία', truck_parts: 'Φορτηγά', other: 'Άλλο',
};

const STOCK_BEHAVIOR_LABELS: Record<string, string> = {
  keeps_stock: 'Τηρεί Απόθεμα', on_demand: "Παραγγελία κατ'ανάγκη", mixed: 'Μικτό',
};

const STATUS_FLOW = [
  { key: 'new_lead', label: 'Νέο Lead' },
  { key: 'contacted', label: 'Επαφή' },
  { key: 'visited', label: 'Επίσκεψη' },
  { key: 'offer_sent', label: 'Προσφορά' },
  { key: 'converted', label: 'Πελάτης' },
  { key: 'lost', label: 'Χαμένο' },
];

type CatFilterType = 'all' | '0' | '1' | '2' | '3+';
const CAT_FILTER_LABELS: { key: CatFilterType; label: string }[] = [
  { key: 'all', label: 'Όλες' }, { key: '0', label: 'Δεν συζητήθηκε' },
  { key: '1', label: '1 φορά' }, { key: '2', label: '2×' }, { key: '3+', label: '3+ φορές' },
];

function getDiscussionBadgeStyle(n: number): string {
  if (n === 0) return 'bg-slate-100 text-slate-400';
  if (n === 1) return 'bg-purple-100 text-purple-600';
  if (n === 2) return 'bg-purple-200 text-purple-700';
  return 'bg-purple-600 text-white';
}

function getL1Code(cat: any): string { return cat.category_code.split('.')[0]; }

function CollapsibleSection({ title, icon, children, defaultCollapsed = false }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <button onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-base font-semibold text-slate-900">{title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      </button>
      {!collapsed && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

export interface ProspectViewProps {
  prospect: CommercialEntityBase & {
    id: string;
    businessName: string;
    ownerName?: string;
    city?: string;
    area?: string;
    shopType?: string;
    vatNumber?: string;
    phone?: string;
    mobile?: string;
    email?: string;
    address?: string;
    status: 'new_lead' | 'contacted' | 'visited' | 'offer_sent' | 'converted' | 'lost';
    createdDate: string;
  };
  onBack: () => void;
}

export function ProspectView({ prospect: initialProspect, onBack }: ProspectViewProps) {
  const [showNewVisitDialog, setShowNewVisitDialog] = useState(false);
  const [visitsRefreshKey, setVisitsRefreshKey] = useState(0);
  const [visits, setVisits] = useState<any[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [competitorInfo, setCompetitorInfo] = useState<any>(null);
  const [shopProfile, setShopProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<CatFilterType>('all');
  const [expandedDiscL1s, setExpandedDiscL1s] = useState<Set<string>>(new Set());
  const [categoryMaster, setCategoryMaster] = useState<Map<string, string>>(new Map());

  const currentStatusIndex = STATUS_FLOW.findIndex(s => s.key === initialProspect.status);

  useEffect(() => {
    authedFetch('/api/categories')
      .then((data: any[]) => {
        const map = new Map<string, string>();
        if (Array.isArray(data)) data.forEach(c => { if (c.category_code) map.set(String(c.category_code), c.full_name ?? c.short_name ?? c.category_code); });
        setCategoryMaster(map);
      }).catch(console.error);
  }, []);

  useEffect(() => {
    authedFetch(`/api/prospects/${initialProspect.id}/visits`)
      .then(data => setVisits(Array.isArray(data) ? data : []))
      .catch(console.error).finally(() => setVisitsLoading(false));
  }, [initialProspect.id, visitsRefreshKey]);

  useEffect(() => {
    authedFetch(`/api/entity-profile/prospect/${initialProspect.id}`)
      .then(data => { setCompetitorInfo(data.competitor_info ?? null); setShopProfile(data.shop_profile ?? null); })
      .catch(console.error).finally(() => setProfileLoading(false));
  }, [initialProspect.id]);

  // Categories discussed from prospect visits
  useEffect(() => {
  if (visits.length === 0) { setCategoriesLoading(false); return; }
  const catMap = new Map<string, any>();
  visits.forEach((v: any) => {
    (v.crm_prospect_visit_categories ?? []).forEach((c: any) => {
      const key = `${c.category_code}__${c.subcategory_code ?? ''}`;
      if (!catMap.has(key)) {
        catMap.set(key, {
          category_code: c.category_code,
          subcategory_code: c.subcategory_code ?? null,
          last_discussed: v.visit_date,
          times_discussed: 1,
        });
      } else {
        const existing = catMap.get(key);
        existing.times_discussed++;
        if (v.visit_date > existing.last_discussed) existing.last_discussed = v.visit_date;
      }
    });
  });
  const result = Array.from(catMap.values()).map(item => {
    const displayCode = item.subcategory_code ?? item.category_code;
    return {
      ...item,
      full_name: categoryMaster.get(displayCode) ?? categoryMaster.get(item.category_code) ?? displayCode,
      short_name: displayCode,
    };
  }).sort((a, b) => (b.last_discussed ?? '').localeCompare(a.last_discussed ?? ''));
  setCategories(result);
  setCategoriesLoading(false);
}, [visits, categoryMaster]);

  function matchesFilter(cat: any): boolean {
    const n = cat.times_discussed ?? 0;
    if (catFilter === 'all') return true;
    if (catFilter === '0') return n === 0;
    if (catFilter === '1') return n === 1;
    if (catFilter === '2') return n === 2;
    if (catFilter === '3+') return n >= 3;
    return true;
  }

  const l1Groups = (() => {
    const map = new Map<string, { l1Code: string; items: any[] }>();
    categories.forEach(cat => { const l1 = getL1Code(cat); if (!map.has(l1)) map.set(l1, { l1Code: l1, items: [] }); map.get(l1)!.items.push(cat); });
    return Array.from(map.values());
  })();

  const filteredGroups = l1Groups.map(g => ({ ...g, filtered: g.items.filter(matchesFilter) })).filter(g => g.filtered.length > 0);
  const totalDiscussions = categories.reduce((s, c) => s + (c.times_discussed ?? 0), 0);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      <header className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />Πίσω στο Dashboard
            </button>
            <button onClick={() => setShowNewVisitDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />Νέα Επίσκεψη
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-semibold shrink-0">PROSPECT</span>
            <h1 className="text-lg font-extrabold leading-tight">{initialProspect.businessName}</h1>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {initialProspect.ownerName && <span className="flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-full text-xs"><User className="w-3 h-3" />{initialProspect.ownerName}</span>}
            {(initialProspect.city || initialProspect.area) && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/70">
                <MapPin className="w-3 h-3" />{initialProspect.city}{initialProspect.city && initialProspect.area ? ', ' : ''}{initialProspect.area}
              </span>
            )}
            {initialProspect.vatNumber && <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs font-mono text-white/70">ΑΦΜ: {initialProspect.vatNumber}</span>}
          </div>

          {/* Status flow */}
          <div className="flex gap-1.5 flex-wrap border-t border-white/10 pt-2">
            {STATUS_FLOW.map((status, idx) => (
              <div key={status.key} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                idx === currentStatusIndex ? 'bg-white text-purple-700' :
                idx < currentStatusIndex ? 'bg-white/30 text-white' : 'bg-white/10 text-white/50'
              }`}>
                {status.label}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-4">

        {/* PROSPECT DETAILS */}
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center gap-2 mb-4"><Info className="w-5 h-5 text-purple-600" /><h2 className="text-base font-semibold">Στοιχεία Prospect</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-700">
            {initialProspect.phone && <div>📞 {initialProspect.phone}</div>}
            {initialProspect.mobile && <div>📱 {initialProspect.mobile}</div>}
            {initialProspect.email && <div>✉️ <a href={`mailto:${initialProspect.email}`} className="text-blue-600 hover:underline">{initialProspect.email}</a></div>}
            {initialProspect.address && (
              <div className="flex items-start gap-2 sm:col-span-2">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" /><span>{initialProspect.address}</span>
              </div>
            )}
          </div>
          <div className="mt-3 text-xs text-slate-400">Δημιουργήθηκε: {formatDate(initialProspect.createdDate)}</div>
        </section>

        {/* SHOP PROFILE + COMPETITOR INFO */}
        <section className="bg-white rounded-xl shadow overflow-hidden">
          {profileLoading ? (
            <div className="px-5 py-4 text-sm text-slate-400">Φόρτωση...</div>
          ) : (!shopProfile && !competitorInfo) ? (
            <div className="px-5 py-4 flex items-center gap-2 text-sm text-slate-400">
              <Store className="w-4 h-4 shrink-0" />
              <span>Δεν υπάρχουν στοιχεία προφίλ ή ανταγωνισμού</span>
            </div>
          ) : (
            <CollapsibleSection title="Προφίλ & Ανταγωνισμός" icon={<Store className="w-5 h-5 text-purple-500" />} defaultCollapsed={false}>
              <div className="space-y-4">
                {shopProfile && (
                  <div>
                    <div className="flex items-center gap-2 mb-3"><Store className="w-4 h-4 text-purple-500" /><span className="text-sm font-semibold text-slate-700">Προφίλ Καταστήματος</span></div>
                    <div className="space-y-2 text-sm text-slate-700">
                      {shopProfile.shop_type && <div className="flex justify-between"><span className="text-slate-500">Τύπος</span><span className="font-medium">{SHOP_TYPE_LABELS[shopProfile.shop_type] ?? shopProfile.shop_type}</span></div>}
                      {shopProfile.number_of_employees && <div className="flex justify-between"><span className="text-slate-500">Εργαζόμενοι</span><span className="font-medium flex items-center gap-1"><Users className="w-3.5 h-3.5" />{shopProfile.number_of_employees}</span></div>}
                      {shopProfile.shop_size_m2 && <div className="flex justify-between"><span className="text-slate-500">Εμβαδό</span><span className="font-medium">{shopProfile.shop_size_m2} m²</span></div>}
                      {shopProfile.stock_behavior && <div className="flex justify-between"><span className="text-slate-500">Απόθεμα</span><span className="font-medium">{STOCK_BEHAVIOR_LABELS[shopProfile.stock_behavior] ?? shopProfile.stock_behavior}</span></div>}
                    </div>
                  </div>
                )}
                {shopProfile && competitorInfo && <div className="border-t border-slate-100" />}
                {competitorInfo && (
                  <div>
                    <div className="flex items-center gap-2 mb-3"><Building2 className="w-4 h-4 text-orange-500" /><span className="text-sm font-semibold text-slate-700">Ανταγωνισμός</span></div>
                    <div className="space-y-2 text-sm text-slate-700">
                      {competitorInfo.main_competitor && <div className="flex justify-between"><span className="text-slate-500">Κύριος</span><span className="font-medium">{competitorInfo.main_competitor}</span></div>}
                      {competitorInfo.other_competitors && <div className="flex justify-between"><span className="text-slate-500">Άλλοι</span><span className="font-medium">{competitorInfo.other_competitors}</span></div>}
                      {competitorInfo.estimated_monthly_spend && <div className="flex justify-between"><span className="text-slate-500">Μηνιαία Δαπάνη</span><span className="font-medium text-green-600">€{Number(competitorInfo.estimated_monthly_spend).toLocaleString('el-GR')}</span></div>}
                      {competitorInfo.competitor_strengths && <div><div className="text-slate-500 mb-1">Δυνατά σημεία</div><div className="text-xs bg-slate-50 rounded p-2">{competitorInfo.competitor_strengths}</div></div>}
                      {competitorInfo.switch_reason && <div><div className="text-slate-500 mb-1">Λόγος αλλαγής</div><div className="text-xs bg-slate-50 rounded p-2">{competitorInfo.switch_reason}</div></div>}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}
        </section>

        {/* VISITS */}
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-purple-600" /><h2 className="text-base font-semibold">Επισκέψεις</h2></div>
            {visits.length > 0 && <span className="text-xs text-slate-500">{visits.length} σύνολο</span>}
          </div>
          {visitsLoading ? <div className="text-sm text-slate-400">Φόρτωση...</div> : visits.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Καμία επίσκεψη ακόμα</div>
          ) : (
            <div className="space-y-2">
              {visits.map((v: any) => (
                <div key={v.id} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{formatDate(v.visit_date)}</div>
                    {v.notes && <div className="text-xs text-slate-500 mt-0.5">{v.notes}</div>}
                    {v.visit_type && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded mt-1 inline-block">{v.visit_type}</span>}
                    {(v.crm_prospect_visit_categories ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {v.crm_prospect_visit_categories.map((c: any, i: number) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-mono">
                            {categoryMaster.get(c.subcategory_code ?? c.category_code) ?? c.subcategory_code ?? c.category_code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* CATEGORY INTELLIGENCE */}
        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2"><Lightbulb className="w-5 h-5 text-purple-600" /><h2 className="text-base font-semibold">Κατηγορίες που Συζητήθηκαν</h2></div>
            {categories.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{categories.length} κατηγορίες</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{totalDiscussions} αναφορές</span>
              </div>
            )}
          </div>
          {categoriesLoading ? <div className="text-sm text-slate-400">Φόρτωση...</div> : categories.length === 0 ? (
            <div className="text-sm text-slate-400 italic">Καμία κατηγορία ακόμα</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {CAT_FILTER_LABELS.map(f => (
                  <button key={f.key} onClick={() => setCatFilter(f.key)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${catFilter === f.key ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              {filteredGroups.length === 0 ? <div className="text-sm text-slate-400 italic">Δεν βρέθηκαν κατηγορίες</div> : (
                <div className="space-y-1">
                  {filteredGroups.map(group => {
                    const isExpanded = expandedDiscL1s.has(group.l1Code);
                    const totalTimes = group.items.reduce((s, c) => s + (c.times_discussed ?? 0), 0);
                    const lastDate = group.items.map(c => c.last_discussed).filter(Boolean).sort().reverse()[0] ?? null;
                    const l1Label = categoryMaster.get(group.l1Code) ?? `Κατηγορία ${group.l1Code}`;
                    return (
                      <div key={group.l1Code} className="rounded-lg border border-slate-100 overflow-hidden">
                        <button onClick={() => setExpandedDiscL1s(prev => { const n = new Set(prev); n.has(group.l1Code) ? n.delete(group.l1Code) : n.add(group.l1Code); return n; })}
                          className={`w-full flex items-center justify-between px-3 py-3 text-left transition-colors ${isExpanded ? 'bg-purple-50 border-b border-purple-100' : 'bg-white hover:bg-slate-50'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-purple-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-mono shrink-0">{group.l1Code}</span>
                            <span className="text-sm font-medium text-slate-700 truncate">{l1Label}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getDiscussionBadgeStyle(totalTimes)}`}>{totalTimes}×</span>
                            {lastDate && <span className="text-xs text-slate-400">{formatDate(lastDate)}</span>}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="divide-y divide-slate-50">
                            {group.filtered.map(cat => {
                              const n = cat.times_discussed ?? 0;
                              return (
                                <div key={`${cat.category_code}-${cat.subcategory_code ?? ''}`} className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-4 shrink-0 flex justify-center"><div className="w-px h-4 bg-slate-200" /></div>
                                    <div className="min-w-0">
                                      <div className="text-sm text-slate-700 truncate">{cat.full_name}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getDiscussionBadgeStyle(n)}`}>{n}×</span>
                                    {cat.last_discussed && <span className="text-xs text-slate-400">{formatDate(cat.last_discussed)}</span>}
                                  </div>
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
            </>
          )}
        </section>

      </main>

      <UnifiedProspectDialog
        isOpen={showNewVisitDialog}
        onClose={() => setShowNewVisitDialog(false)}
        prospectId={initialProspect.id}
        prospectName={initialProspect.businessName}
        areas={[]}
        cities={() => []}
        onSaved={() => { setShowNewVisitDialog(false); setVisitsRefreshKey(k => k + 1); }}
      />
    </div>
  );
}