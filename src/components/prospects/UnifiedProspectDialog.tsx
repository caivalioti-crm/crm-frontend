import { useState, useEffect, useRef } from 'react';
import { X, Plus, Phone, UserCheck, Video, MessageSquare, Search, AlertTriangle, CheckCircle, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { SmartDateInput, dateToISO } from '../ui/SmartDateInput';
import { CategorySelector } from '../ui/CategorySelector';
import { VoiceMemo } from '../ui/VoiceMemo';
import { EntityProfileForm, EMPTY_SHOP_PROFILE, EMPTY_COMPETITION_INFO } from '../ui/EntityProfileForm';
import type { CategoryItem, SelectedCategory } from '../ui/CategorySelector';
import type { ShopProfile, CompetitionInfo } from '../../types/commercialEntity';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Task = { description: string; reminderDate?: string; };

type VatStatus = 'not_found' | 'existing_customer' | 'inactive_customer' | 'existing_prospect' | null;

type Step = 'vat_check' | 'prospect_form' | 'visit_form';

export type UnifiedProspectDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  // If provided, skip VAT check and prospect creation — just log a visit
  prospectId?: string;
  prospectName?: string;
  areas: string[];
  cities: (area: string) => string[];
  onViewCustomer?: (customerCode: string) => void;
  onViewProspect?: (prospectId: string) => void;
  onSaved?: () => void;
};

async function authedFetch(url: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

async function authedPost(url: string, body: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Request failed'); }
  return res.json();
}

const todayDisplay = () => {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
};

const getReminderDate = (type: string): string => {
  const base = new Date();
  if (type === '1week') base.setDate(base.getDate() + 7);
  else if (type === '2weeks') base.setDate(base.getDate() + 14);
  else if (type === '1month') base.setMonth(base.getMonth() + 1);
  return base.toISOString().split('T')[0];
};

export function UnifiedProspectDialog({
  isOpen, onClose,
  prospectId: initialProspectId,
  prospectName: initialProspectName,
  areas, cities,
  onViewCustomer, onViewProspect, onSaved,
}: UnifiedProspectDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // ── Step / VAT ──────────────────────────────────────────────────────────
  const skipVat = !!initialProspectId;
  const [step, setStep] = useState<Step>(skipVat ? 'visit_form' : 'vat_check');
  const [vatSearch, setVatSearch] = useState('');
  const [vatChecking, setVatChecking] = useState(false);
  const [vatChecked, setVatChecked] = useState(false);
  const [vatStatus, setVatStatus] = useState<VatStatus>(null);
  const [vatMatch, setVatMatch] = useState<any>(null);

  // ── Prospect info (new prospect only) ───────────────────────────────────
  const [resolvedProspectId, setResolvedProspectId] = useState<string | null>(initialProspectId ?? null);
  const [resolvedProspectName, setResolvedProspectName] = useState(initialProspectName ?? '');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [prospectNotes, setProspectNotes] = useState('');

  // ── Visit form ───────────────────────────────────────────────────────────
  const [visitDate, setVisitDate] = useState(todayDisplay);
  const [visitTime, setVisitTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [visitType, setVisitType] = useState<'in-person' | 'phone' | 'video' | 'other'>('in-person');
  const [notes, setNotes] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskReminderType, setNewTaskReminderType] = useState<'1week' | '2weeks' | '1month' | 'custom' | ''>('');
  const [newTaskCustomDate, setNewTaskCustomDate] = useState('');
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<SelectedCategory[]>([]);
  const [voiceMemoBlob, setVoiceMemoBlob] = useState<Blob | null>(null);
  const [shopProfile, setShopProfile] = useState<ShopProfile>(EMPTY_SHOP_PROFILE);
  const [competitionInfo, setCompetitionInfo] = useState<CompetitionInfo>(EMPTY_COMPETITION_INFO);
  const [shopType, setShopType] = useState('');

  // ── Competitors ──────────────────────────────────────────────────────────
  const [competitors, setCompetitors] = useState<{ id: string; name: string }[]>([]);
  const [newCompetitorName, setNewCompetitorName] = useState('');
  const [addingCompetitor, setAddingCompetitor] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaCities = selectedArea ? cities(selectedArea) : [];

  useEffect(() => {
    if (isOpen) {
      if (allCategories.length === 0) authedFetch('/api/categories').then(setAllCategories).catch(console.error);
      authedFetch('/api/competitors').then(d => setCompetitors(Array.isArray(d) ? d : [])).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setStep(skipVat ? 'visit_form' : 'vat_check');
      setResolvedProspectId(initialProspectId ?? null);
      setResolvedProspectName(initialProspectName ?? '');
    }
  }, [isOpen, initialProspectId, initialProspectName]);

  // ── VAT check ────────────────────────────────────────────────────────────
  const handleVatCheck = async () => {
    if (vatSearch.length < 5) return;
    setVatChecking(true);
    try {
      const result = await authedFetch(`/api/vat-check/${encodeURIComponent(vatSearch.trim())}`);
      setVatStatus(result.type);
      setVatMatch(result.data ?? null);
      setVatChecked(true);
      if (result.type === 'not_found') {
        setVatNumber(vatSearch.trim());
        setStep('prospect_form');
      } else if (result.type === 'existing_prospect') {
        // Pre-fill prospect and go straight to visit form
        setResolvedProspectId(result.data.id);
        setResolvedProspectName(result.data.business_name);
        setStep('visit_form');
      }
      // existing_customer and inactive_customer — stay on vat_check to show message
    } catch (err) {
      console.error(err);
    } finally {
      setVatChecking(false);
    }
  };

  const handleAddCompetitor = async () => {
    if (!newCompetitorName.trim()) return;
    setAddingCompetitor(true);
    try {
      const newComp = await authedPost('/api/competitors', { name: newCompetitorName.trim() });
      setCompetitors(prev => [...prev, newComp]);
      setNewCompetitorName('');
    } catch (err) { console.error(err); }
    finally { setAddingCompetitor(false); }
  };

  // ── Create prospect then proceed to visit ────────────────────────────────
  const handleCreateProspect = async () => {
    if (!businessName.trim()) { setError('Συμπληρώστε επωνυμία'); return; }
    if (!selectedArea) { setError('Συμπληρώστε περιοχή'); return; }
    setSaving(true);
    setError(null);
    try {
      const prospect = await authedPost('/api/prospects', {
        business_name: businessName,
        owner_name: ownerName || null,
        phone: phone || null,
        mobile: mobile || null,
        email: email || null,
        address: address || null,
        city: city || null,
        area: selectedArea,
        vat_number: vatNumber || null,
        notes: prospectNotes || null,
      });
      setResolvedProspectId(prospect.id);
      setResolvedProspectName(businessName);
      setStep('visit_form');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Add task ─────────────────────────────────────────────────────────────
  const handleAddTask = () => {
    if (!newTaskDescription.trim()) return;
    const task: Task = { description: newTaskDescription };
    if (newTaskReminderType === 'custom') {
      const reminderISO = newTaskCustomDate.match(/^\d{4}-\d{2}-\d{2}$/) ? newTaskCustomDate : dateToISO(newTaskCustomDate);
      const visitISO = dateToISO(visitDate);
      if (reminderISO && visitISO && reminderISO < visitISO) { setError('Reminder cannot be before visit date'); return; }
      if (!reminderISO) { setError('Invalid reminder date'); return; }
      task.reminderDate = reminderISO;
    } else if (newTaskReminderType) {
      task.reminderDate = getReminderDate(newTaskReminderType);
    }
    setError(null);
    setTasks([...tasks, task]);
    setNewTaskDescription('');
    setNewTaskReminderType('');
    setNewTaskCustomDate('');
  };

  // ── Save visit ───────────────────────────────────────────────────────────
  const handleSaveVisit = async () => {
    if (!resolvedProspectId) { setError('No prospect selected'); return; }
    const isoDate = dateToISO(visitDate);
    if (!isoDate) { setError('Invalid date'); return; }
    setSaving(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const formData = new FormData();
      formData.append('visit_date', isoDate);
      formData.append('visit_time', visitTime || '');
      formData.append('visit_type', visitType);
      formData.append('notes', notes);
      formData.append('tasks', JSON.stringify(tasks));
      formData.append('categories', JSON.stringify(selectedCategories));
      formData.append('shop_profile', JSON.stringify({ ...shopProfile, shop_type: shopType || undefined }));
      formData.append('competition_info', JSON.stringify(competitionInfo));
      if (voiceMemoBlob) formData.append('voice_memo', voiceMemoBlob, 'memo.webm');

      const res = await fetch(`${BASE_URL}/api/prospects/${resolvedProspectId}/visits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      onSaved?.();
      handleClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleClose = () => {
    setStep(skipVat ? 'visit_form' : 'vat_check');
    setVatSearch(''); setVatChecked(false); setVatStatus(null); setVatMatch(null);
    setResolvedProspectId(initialProspectId ?? null);
    setResolvedProspectName(initialProspectName ?? '');
    setBusinessName(''); setOwnerName(''); setPhone(''); setMobile('');
    setEmail(''); setAddress(''); setCity(''); setSelectedArea('');
    setVatNumber(''); setProspectNotes('');
    setVisitDate(todayDisplay()); setNotes(''); setTasks([]);
    setSelectedCategories([]); setVoiceMemoBlob(null);
    setShopProfile(EMPTY_SHOP_PROFILE); setCompetitionInfo(EMPTY_COMPETITION_INFO);
    setShopType(''); setNewTaskDescription(''); setNewTaskReminderType('');
    setNewTaskCustomDate(''); setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const visitTypeOptions = [
    { value: 'in-person', label: 'In Person', icon: UserCheck },
    { value: 'phone', label: 'Phone Call', icon: Phone },
    { value: 'video', label: 'Video Call', icon: Video },
    { value: 'other', label: 'Other', icon: MessageSquare },
  ];

  const headerTitle = step === 'vat_check' ? 'Νέα Επαφή' :
    step === 'prospect_form' ? 'Στοιχεία Prospect' :
    resolvedProspectName ? `Επίσκεψη — ${resolvedProspectName}` : 'Νέα Επίσκεψη';

  return (
    <div ref={overlayRef} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === overlayRef.current) handleClose(); }}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold">{headerTitle}</h2>
            {step === 'visit_form' && resolvedProspectName && (
              <p className="text-purple-200 text-sm">{resolvedProspectName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === 'visit_form' && !skipVat && (
              <button onClick={() => setStep('vat_check')}
                className="text-xs text-purple-200 hover:text-white underline">← Αλλαγή</button>
            )}
            <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* ── VAT CHECK ── */}
          {step === 'vat_check' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Έλεγχος ΑΦΜ *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={vatSearch}
                      onChange={e => { setVatSearch(e.target.value); setVatChecked(false); setVatStatus(null); }}
                      onKeyDown={e => e.key === 'Enter' && handleVatCheck()}
                      placeholder="π.χ. 123456789"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <button onClick={handleVatCheck} disabled={vatSearch.length < 5 || vatChecking}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors">
                    {vatChecking ? '...' : 'Έλεγχος'}
                  </button>
                </div>
              </div>

              {vatChecked && vatStatus && (
                <div className={`rounded-lg p-4 border ${
                  vatStatus === 'not_found' ? 'bg-green-50 border-green-200' :
                  vatStatus === 'existing_customer' ? 'bg-red-50 border-red-200' :
                  'bg-orange-50 border-orange-200'
                }`}>
                  {vatStatus === 'not_found' && (
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium text-sm">ΑΦΜ δεν βρέθηκε — συνέχεια στη φόρμα</span>
                    </div>
                  )}
                  {vatStatus === 'existing_customer' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-semibold text-sm">Υπάρχει ήδη ως Πελάτης!</span>
                      </div>
                      <div className="text-sm text-red-600">
                        <div className="font-medium">{vatMatch?.trdr_name}</div>
                        <div>{vatMatch?.city}, {vatMatch?.area_name}</div>
                        <div className="font-mono text-xs mt-1">Κωδικός: {vatMatch?.trdr_code}</div>
                      </div>
                      {onViewCustomer && (
                        <button onClick={() => { handleClose(); onViewCustomer(vatMatch?.trdr_code); }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium">
                          Μετάβαση στον Πελάτη →
                        </button>
                      )}
                    </div>
                  )}
                  {vatStatus === 'inactive_customer' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-orange-700">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-semibold text-sm">Υπάρχει ως ανενεργός πελάτης!</span>
                      </div>
                      <div className="text-sm text-orange-600">
                        <div className="font-medium">{vatMatch?.trdr_name}</div>
                        <div>{vatMatch?.city}, {vatMatch?.area_name}</div>
                        <div className="font-mono text-xs mt-1">Κωδικός: {vatMatch?.trdr_code}</div>
                      </div>
                      <div className="p-3 bg-orange-100 rounded-lg text-sm font-medium text-orange-800">
                        ⚠️ Επικοινωνήστε με το γραφείο για επανενεργοποίηση
                      </div>
                    </div>
                  )}
                  {vatStatus === 'existing_prospect' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-orange-700">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-semibold text-sm">Υπάρχει ήδη ως Prospect!</span>
                      </div>
                      <div className="text-sm text-orange-600">
                        <div className="font-medium">{vatMatch?.business_name}</div>
                        <div>{vatMatch?.city}, {vatMatch?.area}</div>
                      </div>
                      <button onClick={() => { setResolvedProspectId(vatMatch.id); setResolvedProspectName(vatMatch.business_name); setStep('visit_form'); }}
                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium">
                        Καταχώρηση Επίσκεψης →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── PROSPECT FORM ── */}
          {step === 'prospect_form' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Στοιχεία Επιχείρησης</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Επωνυμία *</label>
                  <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ιδιοκτήτης / Επαφή</label>
                  <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Τηλέφωνο</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Κινητό</label>
                  <input type="text" value={mobile} onChange={e => setMobile(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ΑΦΜ</label>
                  <input type="text" value={vatNumber} onChange={e => setVatNumber(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 font-mono" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Διεύθυνση</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Περιοχή *</label>
                  <div className="relative">
                    <select value={selectedArea} onChange={e => { setSelectedArea(e.target.value); setCity(''); }}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-purple-500 pr-8">
                      <option value="">Επιλογή Περιοχής</option>
                      {areas.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Πόλη</label>
                  <div className="relative">
                    <select value={city} onChange={e => setCity(e.target.value)} disabled={!selectedArea}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-purple-500 pr-8 disabled:bg-gray-100">
                      <option value="">Επιλογή Πόλης</option>
                      {areaCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Σημειώσεις</label>
                  <textarea value={prospectNotes} onChange={e => setProspectNotes(e.target.value)} rows={2}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 resize-none" />
                </div>
              </div>
            </div>
          )}

          {/* ── VISIT FORM ── */}
          {step === 'visit_form' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <SmartDateInput label="Ημερομηνία *" value={visitDate} onChange={setVisitDate} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ώρα (προαιρετικό)</label>
                  <input type="text" value={visitTime} onChange={e => setVisitTime(e.target.value)}
                    placeholder="15:30"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Τύπος Επαφής *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {visitTypeOptions.map(({ value, label, icon: Icon }) => (
                    <button key={value} onClick={() => setVisitType(value as any)}
                      className={`px-4 py-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                        visitType === value ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 hover:border-gray-400 text-gray-700'
                      }`}>
                      <Icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <CategorySelector allCategories={allCategories} selected={selectedCategories} onChange={setSelectedCategories} />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Σημειώσεις</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Σημειώσεις από την επίσκεψη..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 min-h-[100px]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Voice Memo (προαιρετικό)</label>
                <VoiceMemo onRecordingComplete={blob => setVoiceMemoBlob(blob)} />
              </div>

              <EntityProfileForm
                shopProfile={shopProfile}
                competitionInfo={competitionInfo}
                onShopProfileChange={setShopProfile}
                onCompetitionInfoChange={setCompetitionInfo}
                shopType={shopType}
                onShopTypeChange={setShopType}
                competitors={competitors}
              />

              {/* Add competitor inline */}
              <div className="flex gap-2">
                <input type="text" value={newCompetitorName} onChange={e => setNewCompetitorName(e.target.value)}
                  placeholder="Προσθήκη νέου ανταγωνιστή..."
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500" />
                <button onClick={handleAddCompetitor} disabled={!newCompetitorName.trim() || addingCompetitor}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg text-xs">
                  + Ανταγωνιστής
                </button>
              </div>

              {/* Tasks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Tasks</label>
                {tasks.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {tasks.map((task, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-start gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900">{task.description}</div>
                          {task.reminderDate && <div className="text-xs text-gray-500 mt-0.5">Reminder: {task.reminderDate}</div>}
                        </div>
                        <button onClick={() => setTasks(tasks.filter((_, i) => i !== index))}
                          className="p-1 hover:bg-red-100 rounded text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-3">
                  <input type="text" value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)}
                    placeholder="Task description..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    onKeyDown={e => e.key === 'Enter' && handleAddTask()} />
                  <div className="grid grid-cols-2 gap-2">
                    {(['1week', '2weeks', '1month', 'custom'] as const).map(type => (
                      <button key={type} onClick={() => setNewTaskReminderType(newTaskReminderType === type ? '' : type)}
                        className={`px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                          newTaskReminderType === type ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}>
                        {type === '1week' ? '1 Week' : type === '2weeks' ? '2 Weeks' : type === '1month' ? '1 Month' : 'Choose Date'}
                      </button>
                    ))}
                  </div>
                  {newTaskReminderType === 'custom' && (
                    <input type="date" value={newTaskCustomDate} onChange={e => setNewTaskCustomDate(e.target.value)}
                      min={dateToISO(visitDate) ?? undefined}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                  )}
                  <button onClick={handleAddTask} disabled={!newTaskDescription.trim()}
                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg flex items-center justify-center gap-2 font-medium">
                    <Plus className="w-4 h-4" /> Add Task
                  </button>
                </div>
              </div>
            </>
          )}

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 sticky bottom-0 border-t border-gray-200">
          <button onClick={handleClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm transition-colors">
            Ακύρωση
          </button>
          {step === 'prospect_form' && (
            <button onClick={handleCreateProspect} disabled={saving}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm">
              {saving ? 'Αποθήκευση...' : 'Συνέχεια →'}
            </button>
          )}
          {step === 'visit_form' && (
            <button onClick={handleSaveVisit} disabled={saving}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm">
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση Επίσκεψης'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}