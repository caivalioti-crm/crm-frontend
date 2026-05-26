import { useState } from 'react';
import { X, Star } from 'lucide-react';
import type { ShopProfile, CompetitionInfo, CompetitorEntry } from '../../types/commercialEntity';

const SHOP_TYPE_OPTIONS = [
  { value: 'auto_parts_retailer', label: 'Ανταλλακτικά - Γενικά' },
  { value: 'auto_parts_jap', label: 'Ανταλλακτικά - JAP' },
  { value: 'auto_parts_eur', label: 'Ανταλλακτικά - EUR' },
  { value: 'auto_parts_korea', label: 'Ανταλλακτικά - KOREA' },
  { value: 'used_parts_general', label: 'Μεταχειρισμένα - Γενικά' },
  { value: 'used_parts_jap', label: 'Μεταχειρισμένα - JAP' },
  { value: 'used_parts_eur', label: 'Μεταχειρισμένα - EUR' },
  { value: 'accessories', label: 'Αξεσουάρ' },
  { value: 'garage', label: 'Συνεργείο' },
  { value: 'body_shop', label: 'Φανοποιείο' },
  { value: 'electrician', label: 'Ηλεκτρολογείο' },
  { value: 'specialist', label: 'Ειδικό - Ρεκτιφιέ/Τουρμπίνα/Diesel' },
  { value: 'vertical_unit', label: 'Κάθετη μονάδα' },
  { value: 'dealership', label: 'Αντιπροσωπεία' },
  { value: 'car_rental', label: 'Ενοικιάσεις αυτοκινήτων' },
  { value: 'cooperative', label: 'Συνεταιρισμός' },
  { value: 'company', label: 'Εταιρεία, π.χ. τεχνική' },
  { value: 'public_service', label: 'Δημόσια Υπηρεσία' },
  { value: 'electronics_shop', label: 'Ηλεκτρονικό κατάστημα' },
  { value: 'agricultural_machinery', label: 'Γεωργικά μηχανήματα' },
  { value: 'other', label: 'Άλλο' },
];

const VEHICLE_TYPE_OPTIONS = ['Αγροτικό', 'Επιβατικό', 'Βαν', 'Φορτηγό', 'Άλλο'];

const VEHICLE_BRAND_OPTIONS = [
  'Nissan', 'Toyota', 'Mitsubishi', 'Mazda-Ford', 'Isuzu', 'Suzuki',
  'Daihatsu', 'Honda', 'VAG', 'Mercedes', 'Opel', 'Fiat', 'PSA',
  'Hyundai-Kia', 'Daewoo-Chevrolet', 'Άλλο',
];

const STOCK_BEHAVIOR_OPTIONS = [
  { value: 'keeps_stock', label: 'Τηρεί Απόθεμα' },
  { value: 'on_demand', label: "Παραγγελία κατ'ανάγκη" },
  { value: 'mixed', label: 'Μικτό' },
];

export type { ShopProfile, CompetitionInfo };

export const EMPTY_SHOP_PROFILE: ShopProfile = {
  numberOfEmployees: undefined,
  shopSizeM2: undefined,
  stockBehavior: undefined,
  vehicleTypes: [],
  vehicleBrands: [],
};

export const EMPTY_COMPETITION_INFO: CompetitionInfo = {
  competitors: [],
  estimatedMonthlySpend: undefined,
  switchReason: '',
};

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
}

type Props = {
  shopProfile: ShopProfile;
  competitionInfo: CompetitionInfo;
  onShopProfileChange: (p: ShopProfile) => void;
  onCompetitionInfoChange: (c: CompetitionInfo) => void;
  shopType?: string;
  onShopTypeChange?: (t: string) => void;
  competitors?: { id: string; name: string }[];
};

export function EntityProfileForm({
  shopProfile, competitionInfo,
  onShopProfileChange, onCompetitionInfoChange,
  shopType = '', onShopTypeChange,
  competitors = [],
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedCompetitorName, setSelectedCompetitorName] = useState('');
  const [customCompetitorName, setCustomCompetitorName] = useState('');

  const knownShopTypeValues = SHOP_TYPE_OPTIONS.map(o => o.value);
  const isCustomShopType = shopType !== '' && !knownShopTypeValues.includes(shopType) && shopType !== '__other__';

  const vehicleTypes = shopProfile.vehicleTypes ?? [];
  const vehicleBrands = shopProfile.vehicleBrands ?? [];
  const selectedCompetitors: CompetitorEntry[] = competitionInfo.competitors ?? [];
  const primaryCount = selectedCompetitors.filter(c => c.isPrimary).length;

  function addCompetitor() {
    const name = selectedCompetitorName === '__other__'
      ? customCompetitorName.trim()
      : selectedCompetitorName.trim();
    if (!name) return;
    if (selectedCompetitors.some(c => c.name === name)) return;
    onCompetitionInfoChange({
      ...competitionInfo,
      competitors: [...selectedCompetitors, { name, isPrimary: false, notes: '' }],
    });
    setSelectedCompetitorName('');
    setCustomCompetitorName('');
  }

  function removeCompetitor(name: string) {
    onCompetitionInfoChange({
      ...competitionInfo,
      competitors: selectedCompetitors.filter(c => c.name !== name),
    });
  }

  function togglePrimary(name: string) {
    const entry = selectedCompetitors.find(c => c.name === name);
    if (!entry) return;
    if (!entry.isPrimary && primaryCount >= 3) return;
    onCompetitionInfoChange({
      ...competitionInfo,
      competitors: selectedCompetitors.map(c =>
        c.name === name ? { ...c, isPrimary: !c.isPrimary } : c
      ),
    });
  }

  function updateNotes(name: string, notes: string) {
    onCompetitionInfoChange({
      ...competitionInfo,
      competitors: selectedCompetitors.map(c =>
        c.name === name ? { ...c, notes } : c
      ),
    });
  }

  const availableCompetitors = competitors.filter(
    c => !selectedCompetitors.some(s => s.name === c.name)
  );

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
      >
        Προφίλ & Ανταγωνισμός (προαιρετικό)
        <span className="text-slate-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="p-4 space-y-5">

          {/* ── SHOP PROFILE ── */}
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Προφίλ Καταστήματος</div>
            <div className="space-y-3">

              {/* Shop Type */}
              {onShopTypeChange !== undefined && (
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Τύπος</label>
                  <select
                    value={isCustomShopType ? 'other' : (shopType === '__other__' ? 'other' : shopType)}
                    onChange={e => {
                      if (e.target.value === 'other') {
                        onShopTypeChange('__other__');
                      } else {
                        onShopTypeChange(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Επιλέξτε...</option>
                    {SHOP_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {(shopType === '__other__' || isCustomShopType) && (
                    <input
                      type="text"
                      autoFocus
                      value={isCustomShopType ? shopType : ''}
                      onChange={e => onShopTypeChange(e.target.value)}
                      className="w-full mt-2 px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="Περιγράψτε τον τύπο..." />
                  )}
                </div>
              )}

              {/* Vehicle Types */}
              <div>
                <label className="block text-xs text-slate-600 mb-1">Τύπος Οχήματος</label>
                <div className="flex flex-wrap gap-2">
                  {VEHICLE_TYPE_OPTIONS.map(opt => (
                    <button key={opt} type="button"
                      onClick={() => onShopProfileChange({ ...shopProfile, vehicleTypes: toggleItem(vehicleTypes, opt) })}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-colors ${
                        vehicleTypes.includes(opt)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-300 text-slate-600 hover:border-slate-400'
                      }`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vehicle Brands */}
              <div>
                <label className="block text-xs text-slate-600 mb-1">Μάρκες</label>
                <div className="flex flex-wrap gap-2">
                  {VEHICLE_BRAND_OPTIONS.map(opt => (
                    <button key={opt} type="button"
                      onClick={() => onShopProfileChange({ ...shopProfile, vehicleBrands: toggleItem(vehicleBrands, opt) })}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-colors ${
                        vehicleBrands.includes(opt)
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-300 text-slate-600 hover:border-slate-400'
                      }`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Employees + Size */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Εργαζόμενοι</label>
                  <input type="number"
                    value={shopProfile.numberOfEmployees ?? ''}
                    onChange={e => onShopProfileChange({ ...shopProfile, numberOfEmployees: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="π.χ. 3" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Εμβαδό (m²)</label>
                  <input type="number"
                    value={shopProfile.shopSizeM2 ?? ''}
                    onChange={e => onShopProfileChange({ ...shopProfile, shopSizeM2: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="π.χ. 150" />
                </div>
              </div>

              {/* Stock Behavior */}
              <div>
                <label className="block text-xs text-slate-600 mb-1">Απόθεμα</label>
                <div className="flex gap-2 flex-wrap">
                  {STOCK_BEHAVIOR_OPTIONS.map(o => (
                    <button key={o.value} type="button"
                      onClick={() => onShopProfileChange({ ...shopProfile, stockBehavior: o.value as ShopProfile['stockBehavior'] })}
                      className={`px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                        shopProfile.stockBehavior === o.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-300 text-slate-600 hover:border-slate-400'
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── COMPETITOR INFO ── */}
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Ανταγωνισμός</div>
            <div className="space-y-3">

              {/* Add competitor dropdown */}
              <div className="flex gap-2">
                <select
                  value={selectedCompetitorName}
                  onChange={e => { setSelectedCompetitorName(e.target.value); setCustomCompetitorName(''); }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="">+ Προσθήκη ανταγωνιστή...</option>
                  {availableCompetitors.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="__other__">Άλλος...</option>
                </select>
                <button
                  type="button"
                  onClick={addCompetitor}
                  disabled={!selectedCompetitorName || (selectedCompetitorName === '__other__' && !customCompetitorName.trim())}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
                  Προσθήκη
                </button>
              </div>

              {/* Free text for Άλλος */}
              {selectedCompetitorName === '__other__' && (
                <input
                  type="text"
                  autoFocus
                  value={customCompetitorName}
                  onChange={e => setCustomCompetitorName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCompetitor()}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Όνομα ανταγωνιστή..." />
              )}

              {/* Primary count hint */}
              {selectedCompetitors.length > 0 && (
                <div className="text-xs text-slate-400">
                  ★ = Κύριος ανταγωνιστής (έως 3) — {primaryCount}/3 επιλεγμένοι
                </div>
              )}

              {/* Selected competitors list */}
              {selectedCompetitors.map(comp => (
                <div key={comp.name} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => togglePrimary(comp.name)}
                      disabled={!comp.isPrimary && primaryCount >= 3}
                      title={comp.isPrimary ? 'Κύριος ανταγωνιστής' : 'Ορισμός ως κύριος'}
                      className={`shrink-0 transition-colors disabled:opacity-30 ${
                        comp.isPrimary ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
                      }`}>
                      <Star className={`w-4 h-4 ${comp.isPrimary ? 'fill-amber-500' : ''}`} />
                    </button>
                    <span className="flex-1 text-sm font-medium text-slate-700">{comp.name}</span>
                    <button
                      type="button"
                      onClick={() => removeCompetitor(comp.name)}
                      className="shrink-0 text-slate-400 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="px-3 py-2">
                    <textarea
                      value={comp.notes ?? ''}
                      onChange={e => updateNotes(comp.name, e.target.value)}
                      placeholder={`Σημειώσεις για ${comp.name}...`}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-slate-600 focus:ring-2 focus:ring-blue-500 min-h-[50px] resize-none" />
                  </div>
                </div>
              ))}

              {/* Shared fields */}
              <div>
                <label className="block text-xs text-slate-600 mb-1">Εκτιμώμενη Μηνιαία Δαπάνη (€)</label>
                <input type="number"
                  value={competitionInfo.estimatedMonthlySpend ?? ''}
                  onChange={e => onCompetitionInfoChange({ ...competitionInfo, estimatedMonthlySpend: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="π.χ. 2000" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Λόγος Πιθανής Αλλαγής</label>
                <textarea
                  value={competitionInfo.switchReason ?? ''}
                  onChange={e => onCompetitionInfoChange({ ...competitionInfo, switchReason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-h-[60px]" />
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}