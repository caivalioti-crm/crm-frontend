import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, AlertTriangle, CheckCircle, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { SmartDateInput } from '../ui/SmartDateInput';

const BASE_URL = 'http://localhost:3001';

type NewProspectDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    name: string;
    role: 'rep' | 'manager' | 'admin' | 'exec';
    salesman_code?: string | null;
  };
  onSave: () => void;
  areas: string[];
  cities: (area: string) => string[];
  onViewCustomer?: (customerCode: string) => void;
  onViewProspect?: (prospectId: string) => void;
};

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

async function authedPost(url: string, body: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export function NewProspectDialog({ isOpen, onClose, currentUser, onSave, areas, cities, onViewCustomer, onViewProspect }: NewProspectDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // VAT check
  const [vatSearch, setVatSearch] = useState('');
  const [vatChecked, setVatChecked] = useState(false);
  const [vatStatus, setVatStatus] = useState<'not_found' | 'existing_customer' | 'inactive_customer' | 'existing_prospect' | null>(null);
  const [vatMatch, setVatMatch] = useState<any>(null);
  const [step, setStep] = useState<'vat_check' | 'form'>('vat_check');
  const [vatChecking, setVatChecking] = useState(false);

  // Form fields
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Shop profile
  const [shopType, setShopType] = useState('auto_parts_retailer');
  const [numberOfEmployees, setNumberOfEmployees] = useState('');
  const [shopSizeM2, setShopSizeM2] = useState('');
  const [stockBehavior, setStockBehavior] = useState('mixed');

  // Competitor info
  const [competitors, setCompetitors] = useState<{ id: string; name: string }[]>([]);
  const [mainCompetitor, setMainCompetitor] = useState('');
  const [otherCompetitors, setOtherCompetitors] = useState('');
  const [estimatedMonthlySpend, setEstimatedMonthlySpend] = useState('');
  const [competitorStrengths, setCompetitorStrengths] = useState('');
  const [switchReason, setSwitchReason] = useState('');
  const [newCompetitorName, setNewCompetitorName] = useState('');
  const [addingCompetitor, setAddingCompetitor] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaCities = selectedArea ? cities(selectedArea) : [];

  useEffect(() => {
    if (isOpen) {
      authedFetch('/api/competitors')
        .then(data => setCompetitors(Array.isArray(data) ? data : []))
        .catch(console.error);
    }
  }, [isOpen]);

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
      setStep('form');
    }
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
    setMainCompetitor(newComp.name);
    setNewCompetitorName('');
  } catch (err) {
    console.error(err);
  } finally {
    setAddingCompetitor(false);
  }
};

  const handleSave = async () => {
    if (!businessName.trim()) { setError('Συμπληρώστε επωνυμία'); return; }
    if (!selectedArea) { setError('Συμπληρώστε περιοχή'); return; }

    setIsSaving(true);
    setError(null);
    try {
      await authedPost('/api/prospects', {
        business_name: businessName,
        owner_name: ownerName || null,
        phone: phone || null,
        mobile: mobile || null,
        email: email || null,
        address: address || null,
        city: city || null,
        area: selectedArea,
        vat_number: vatNumber || null,
        notes: notes || null,
        competitor_info: mainCompetitor ? {
          main_competitor: mainCompetitor,
          other_competitors: otherCompetitors || null,
          estimated_monthly_spend: parseFloat(estimatedMonthlySpend) || null,
          competitor_strengths: competitorStrengths || null,
          switch_reason: switchReason || null,
        } : undefined,
        shop_profile: (shopType || numberOfEmployees || shopSizeM2 || stockBehavior) ? {
          shop_type: shopType,
          number_of_employees: parseInt(numberOfEmployees) || null,
          shop_size_m2: parseInt(shopSizeM2) || null,
          stock_behavior: stockBehavior,
        } : undefined,
      });
      onSave();
      handleClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setVatSearch('');
    setVatChecked(false);
    setVatStatus(null);
    setVatMatch(null);
    setStep('vat_check');
    setBusinessName('');
    setOwnerName('');
    setPhone('');
    setMobile('');
    setEmail('');
    setAddress('');
    setCity('');
    setSelectedArea('');
    setVatNumber('');
    setNotes('');
    setShopType('auto_parts_retailer');
    setNumberOfEmployees('');
    setShopSizeM2('');
    setStockBehavior('mixed');
    setMainCompetitor('');
    setOtherCompetitors('');
    setEstimatedMonthlySpend('');
    setCompetitorStrengths('');
    setSwitchReason('');
    setNewCompetitorName('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-bold">Νέος Prospect</h2>
          <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* VAT Check */}
          <div className={`space-y-3 ${step === 'form' ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">Έλεγχος ΑΦΜ *</label>
              {step === 'form' && (
                <button onClick={() => { setStep('vat_check'); setVatChecked(false); setVatStatus(null); }}
                  className="text-xs text-purple-600 underline">Αλλαγή</button>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={vatSearch}
                  onChange={e => { setVatSearch(e.target.value); setVatChecked(false); setVatStatus(null); }}
                  placeholder="π.χ. 123456789"
                  disabled={step === 'form'}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
                />
              </div>
              {step === 'vat_check' && (
                <button
                  onClick={handleVatCheck}
                  disabled={vatSearch.length < 5 || vatChecking}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {vatChecking ? '...' : 'Έλεγχος'}
                </button>
              )}
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
                  <div className="space-y-1">
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
                      <button
                        onClick={() => { handleClose(); onViewCustomer(vatMatch?.trdr_code); }}
                        className="mt-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium"
                      >
                        Μετάβαση στον Πελάτη →
                      </button>
                    )}
                  </div>
                )}

                {vatStatus === 'inactive_customer' && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-orange-700">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-semibold text-sm">Υπάρχει ως ανενεργός πελάτης!</span>
                    </div>
                    <div className="text-sm text-orange-600">
                      <div className="font-medium">{vatMatch?.trdr_name}</div>
                      <div>{vatMatch?.city}, {vatMatch?.area_name}</div>
                      <div className="font-mono text-xs mt-1">Κωδικός: {vatMatch?.trdr_code}</div>
                      <div className="mt-2 p-2 bg-orange-100 rounded text-xs font-medium">
                        ⚠️ Επικοινωνήστε με το γραφείο για επανενεργοποίηση
                      </div>
                    </div>
                    {onViewCustomer && (
                      <button
                        onClick={() => { handleClose(); onViewCustomer(vatMatch?.trdr_code); }}
                        className="mt-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium"
                      >
                        Προβολή Καρτέλας →
                      </button>
                    )}
                  </div>
                )}
                {vatStatus === 'existing_prospect' && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-orange-700">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-semibold text-sm">Υπάρχει ήδη ως Prospect!</span>
                    </div>
                    <div className="text-sm text-orange-600">
                      <div className="font-medium">{vatMatch?.business_name}</div>
                      <div>{vatMatch?.city}, {vatMatch?.area}</div>
                    </div>
                    {onViewProspect && (
                      <button
                        onClick={() => { handleClose(); onViewProspect(vatMatch?.id); }}
                        className="mt-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium"
                      >
                        Μετάβαση στον Prospect →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form */}
          {step === 'form' && (
            <>
              {/* Basic info */}
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
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 resize-none" />
                  </div>
                </div>
              </div>

              {/* Shop profile */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Προφίλ Καταστήματος</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Τύπος</label>
                    <div className="relative">
                      <select value={shopType} onChange={e => setShopType(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-purple-500 pr-8">
                        <option value="auto_parts_retailer">Ανταλλακτικά</option>
                        <option value="garage">Γκαράζ</option>
                        <option value="body_shop">Φανοποιείο</option>
                        <option value="dealership">Αντιπροσωπεία</option>
                        <option value="truck_parts">Φορτηγά</option>
                        <option value="other">Άλλο</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Αρ. Εργαζομένων</label>
                    <input type="number" value={numberOfEmployees} onChange={e => setNumberOfEmployees(e.target.value)}
                      min="1" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Εμβαδό (m²)</label>
                    <input type="number" value={shopSizeM2} onChange={e => setShopSizeM2(e.target.value)}
                      min="1" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Πολιτική Αποθέματος</label>
                  <div className="flex gap-2 flex-wrap">
                    {[['keeps_stock', 'Τηρεί Απόθεμα'], ['on_demand', "Παραγγελία κατ'ανάγκη"], ['mixed', 'Μικτό']].map(([val, label]) => (
                      <button key={val} onClick={() => setStockBehavior(val)}
                        className={`px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                          stockBehavior === val ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Competitor info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Ανταγωνισμός</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Κύριος Ανταγωνιστής</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select value={mainCompetitor} onChange={e => setMainCompetitor(e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-purple-500 pr-8">
                          <option value="">Επιλογή...</option>
                          {competitors.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    {/* Add new competitor */}
                    <div className="flex gap-2 mt-2">
                      <input type="text" value={newCompetitorName} onChange={e => setNewCompetitorName(e.target.value)}
                        placeholder="Προσθήκη νέου..."
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500" />
                      <button onClick={handleAddCompetitor} disabled={!newCompetitorName.trim() || addingCompetitor}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg text-xs">
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Εκτιμώμενη Μηνιαία Δαπάνη (€)</label>
                    <input type="number" value={estimatedMonthlySpend} onChange={e => setEstimatedMonthlySpend(e.target.value)}
                      placeholder="π.χ. 5000"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Άλλοι Ανταγωνιστές</label>
                    <input type="text" value={otherCompetitors} onChange={e => setOtherCompetitors(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Δυνατά Σημεία Ανταγωνιστή</label>
                    <textarea value={competitorStrengths} onChange={e => setCompetitorStrengths(e.target.value)}
                      rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Λόγος Αλλαγής</label>
                    <textarea value={switchReason} onChange={e => setSwitchReason(e.target.value)}
                      rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 resize-none" />
                  </div>
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
          {step === 'form' && (
            <button onClick={handleSave} disabled={isSaving}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
              {isSaving ? 'Αποθήκευση...' : 'Αποθήκευση Prospect'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}