import {
  ArrowLeft, Plus, MapPin, Calendar,
  Lightbulb, ChevronDown, ChevronRight, User, Info, Pencil, Mic, Pause
} from 'lucide-react';

import { formatDate } from '../../utils/dateFormat';
import { UnifiedProspectDialog } from '../prospects/UnifiedProspectDialog';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { CommercialEntityBase } from '../../types/commercialEntity';
import { ProfileEditor } from '../ui/ProfileEditor';
import { SmartDateInput, dateToISO, isoToDisplay } from '../ui/SmartDateInput';

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

async function authedPatch(url: string, body: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
  return res.json();
}

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

// Visit expand/edit state
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [editingProspectVisitId, setEditingProspectVisitId] = useState<string | null>(null);
  const [pvEditNotes, setPvEditNotes] = useState('');
  const [pvEditType, setPvEditType] = useState('');
  const [pvEditDate, setPvEditDate] = useState('');
  const [pvEditSaving, setPvEditSaving] = useState(false);

  // Voice memo state
  const [pvPlayingMemoId, setPvPlayingMemoId] = useState<string | null>(null);
  const [pvMemoUrls, setPvMemoUrls] = useState<Record<string, string>>({});
  const [pvMemoLoading, setPvMemoLoading] = useState<Record<string, boolean>>({});
  const pvAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const currentStatusIndex = STATUS_FLOW.findIndex(s => s.key === initialProspect.status);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    business_name: initialProspect.businessName,
    owner_name: initialProspect.ownerName ?? '',
    phone: initialProspect.phone ?? '',
    mobile: initialProspect.mobile ?? '',
    email: initialProspect.email ?? '',
    address: initialProspect.address ?? '',
    notes: '',
  });

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

const handleSaveDetails = async () => {
  if (!editData.mobile.trim()) { setEditError('Το κινητό είναι υποχρεωτικό'); return; }
  if (!editData.email.trim()) { setEditError('Το email είναι υποχρεωτικό'); return; }
  setSaving(true);
  setEditError(null);
  try {
    await authedPatch(`/api/prospects/${initialProspect.id}`, {
      business_name: editData.business_name,
      owner_name: editData.owner_name || null,
      phone: editData.phone,
      mobile: editData.mobile,
      email: editData.email,
      address: editData.address || null,
    });
    setEditing(false);
  } catch (err: any) {
    setEditError(err.message);
  } finally {
    setSaving(false);
  }
};

// Prospect visit edit helpers
  const startEditProspectVisit = (v: any) => {
    setEditingProspectVisitId(v.id);
    setPvEditNotes(v.notes ?? '');
    setPvEditType(v.visit_type ?? 'in-person');
    setPvEditDate(isoToDisplay(v.visit_date));
  };

  const saveEditProspectVisit = async (visitId: string) => {
    setPvEditSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${BASE_URL}/api/prospect-visits/${visitId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          notes: pvEditNotes,
          visit_type: pvEditType,
          visit_date: dateToISO(pvEditDate),
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      setVisits(prev => prev.map(v => v.id === visitId ? { ...v, ...updated } : v));
      setEditingProspectVisitId(null);
    } catch {
      alert('Αποτυχία αποθήκευσης');
    } finally {
      setPvEditSaving(false);
    }
  };

  // Voice memo helper
  const playPvMemo = async (visitId: string) => {
    if (pvPlayingMemoId && pvPlayingMemoId !== visitId) {
      pvAudioRefs.current[pvPlayingMemoId]?.pause();
      setPvPlayingMemoId(null);
    }
    if (pvPlayingMemoId === visitId) {
      pvAudioRefs.current[visitId]?.pause();
      setPvPlayingMemoId(null);
      return;
    }
    if (!pvMemoUrls[visitId]) {
      setPvMemoLoading(prev => ({ ...prev, [visitId]: true }));
      try {
        const data = await authedFetch(`/api/prospect-visits/${visitId}/voice-memo`);
        setPvMemoUrls(prev => ({ ...prev, [visitId]: data.url }));
      } catch {
        alert('Failed to load memo');
        return;
      } finally {
        setPvMemoLoading(prev => ({ ...prev, [visitId]: false }));
      }
    }
    setTimeout(() => {
      const audio = pvAudioRefs.current[visitId];
      if (audio) {
        audio.play();
        setPvPlayingMemoId(visitId);
        audio.onended = () => setPvPlayingMemoId(null);
      }
    }, 50);
  };

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
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <Info className="w-5 h-5 text-purple-600" />
      <h2 className="text-base font-semibold">Στοιχεία Prospect</h2>
    </div>
    <button onClick={() => { setEditing(v => !v); setEditError(null); }}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        editing ? 'border-slate-300 text-slate-600 bg-slate-50' : 'border-purple-300 text-purple-600 bg-purple-50 hover:bg-purple-100'
      }`}>
      <Pencil className="w-3.5 h-3.5" />
      {editing ? 'Ακύρωση' : 'Επεξεργασία'}
    </button>
  </div>

  {editing ? (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Επωνυμία *</label>
          <input type="text" value={editData.business_name}
            onChange={e => setEditData(d => ({ ...d, business_name: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ιδιοκτήτης</label>
          <input type="text" value={editData.owner_name}
            onChange={e => setEditData(d => ({ ...d, owner_name: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Τηλέφωνο</label>
          <input type="text" value={editData.phone}
            onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Κινητό *</label>
          <input type="text" value={editData.mobile}
            onChange={e => setEditData(d => ({ ...d, mobile: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
          <input type="email" value={editData.email}
            onChange={e => setEditData(d => ({ ...d, email: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Διεύθυνση</label>
          <input type="text" value={editData.address}
            onChange={e => setEditData(d => ({ ...d, address: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
        </div>
      </div>
      {editError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</div>}
      <button onClick={handleSaveDetails} disabled={saving}
        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
        {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
      </button>
    </div>
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-700">
      {(editData.phone || initialProspect.phone) && <div>📞 {editData.phone || initialProspect.phone}</div>}
      {(editData.mobile || initialProspect.mobile) && <div>📱 {editData.mobile || initialProspect.mobile}</div>}
      {(editData.email || initialProspect.email) && (
        <div>✉️ <a href={`mailto:${editData.email || initialProspect.email}`} className="text-blue-600 hover:underline">{editData.email || initialProspect.email}</a></div>
      )}
      {(editData.address || initialProspect.address) && (
        <div className="flex items-start gap-2 sm:col-span-2">
          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <span>{editData.address || initialProspect.address}</span>
        </div>
      )}
    </div>
  )}
  <div className="mt-3 text-xs text-slate-400">Δημιουργήθηκε: {formatDate(initialProspect.createdDate)}</div>
</section>

{/* SHOP PROFILE + COMPETITOR INFO */}
<section className="bg-white rounded-xl shadow overflow-hidden">
  {profileLoading ? (
    <div className="px-5 py-4 text-sm text-slate-400">Φόρτωση...</div>
  ) : (
    <ProfileEditor
      entityType="prospect"
      entityId={initialProspect.id}
      shopProfile={shopProfile}
      competitorInfo={competitorInfo}
      onSaved={(sp, ci) => { setShopProfile(sp); setCompetitorInfo(ci); }}
      accentColor="purple"
    />
  )}
</section>

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
              {visits.map((v: any) => {
                const isExpanded = expandedVisitId === v.id;
                const isEditing = editingProspectVisitId === v.id;
                const isPlaying = pvPlayingMemoId === v.id;

                return (
                  <div key={v.id} className="border border-slate-100 rounded-lg overflow-hidden">

                    {/* Visit row header */}
                    <button
                      onClick={() => setExpandedVisitId(isExpanded ? null : v.id)}
                      className="w-full flex items-start justify-between py-2.5 px-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-700">{formatDate(v.visit_date)}</div>
                        {v.notes && (
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{v.notes}</div>
                        )}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {v.visit_type && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                              {v.visit_type}
                            </span>
                          )}
                          {(v.crm_prospect_visit_categories ?? []).length > 0 && (
                            <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                              {v.crm_prospect_visit_categories.length} κατηγορίες
                            </span>
                          )}
                          {v.voice_memo_path && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-500 rounded flex items-center gap-1">
                              <Mic className="w-3 h-3" /> Memo
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-300 shrink-0 ml-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-2 bg-slate-50 border-t border-slate-100 space-y-3">

                        {/* Action buttons */}
                        {!isEditing && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => startEditProspectVisit(v)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-300 text-slate-600 rounded-lg text-xs hover:bg-slate-50"
                            >
                              <Pencil className="w-3 h-3" /> Επεξεργασία
                            </button>
                            {v.voice_memo_path && (
                              <>
                                <button
                                  onClick={() => playPvMemo(v.id)}
                                  disabled={pvMemoLoading[v.id]}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-purple-300 text-purple-600 rounded-lg text-xs hover:bg-purple-50 disabled:opacity-50"
                                >
                                  {pvMemoLoading[v.id] ? (
                                    <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                  ) : isPlaying ? (
                                    <Pause className="w-3 h-3" />
                                  ) : (
                                    <Mic className="w-3 h-3" />
                                  )}
                                  {pvMemoLoading[v.id] ? 'Loading...' : isPlaying ? 'Pause' : 'Play Memo'}
                                </button>
                                {pvMemoUrls[v.id] && (
                                  <audio
                                    ref={el => { pvAudioRefs.current[v.id] = el; }}
                                    src={pvMemoUrls[v.id]}
                                    className="hidden"
                                  />
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Edit form */}
                        {isEditing && (
                          <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-3">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Επεξεργασία Επίσκεψης</div>
                            <SmartDateInput label="Ημερομηνία" value={pvEditDate} onChange={setPvEditDate} hint={false} />
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Τύπος</label>
                              <select value={pvEditType} onChange={e => setPvEditType(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500">
                                {['in-person', 'phone', 'video', 'other'].map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Σημειώσεις</label>
                              <textarea value={pvEditNotes} onChange={e => setPvEditNotes(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 min-h-[80px]" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => saveEditProspectVisit(v.id)}
                                disabled={pvEditSaving}
                                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                                {pvEditSaving ? 'Αποθήκευση...' : 'Αποθήκευση'}
                              </button>
                              <button onClick={() => setEditingProspectVisitId(null)}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">
                                Ακύρωση
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Notes display */}
                        {!isEditing && v.notes && (
                          <div>
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Σημειώσεις</div>
                            <p className="text-sm text-slate-600">{v.notes}</p>
                          </div>
                        )}

                        {/* Categories */}
                        {!isEditing && (v.crm_prospect_visit_categories ?? []).length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Κατηγορίες</div>
                            <div className="flex flex-wrap gap-1">
                              {v.crm_prospect_visit_categories.map((c: any, i: number) => (
                                <span key={i} className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-mono">
                                  {categoryMaster.get(c.subcategory_code ?? c.category_code) ?? c.subcategory_code ?? c.category_code}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })}
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