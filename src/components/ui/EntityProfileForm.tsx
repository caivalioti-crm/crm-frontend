import { useState } from 'react';
import type { ShopProfile, CompetitionInfo } from '../../types/commercialEntity';

const SHOP_TYPE_OPTIONS = [
  { value: 'auto_parts_retailer', label: 'Ανταλλακτικά' },
  { value: 'garage', label: 'Γκαράζ' },
  { value: 'body_shop', label: 'Φανοποιείο' },
  { value: 'dealership', label: 'Αντιπροσωπεία' },
  { value: 'truck_parts', label: 'Φορτηγά' },
  { value: 'other', label: 'Άλλο' },
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
};

export const EMPTY_COMPETITION_INFO: CompetitionInfo = {
  mainCompetitor: '',
  otherCompetitors: '',
  estimatedMonthlySpend: undefined,
  competitorStrengths: '',
  switchReason: '',
};

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
  competitors,
}: Props) {
  const [expanded, setExpanded] = useState(false);

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
        <div className="p-4 space-y-4">
          {/* Shop Profile */}
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Προφίλ Καταστήματος</div>
            <div className="space-y-3">
              {onShopTypeChange !== undefined && (
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Τύπος</label>
                  <select value={shopType} onChange={e => onShopTypeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Επιλέξτε...</option>
                    {SHOP_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
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

          {/* Competitor Info */}
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Ανταγωνισμός</div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Κύριος Ανταγωνιστής</label>
                {competitors && competitors.length > 0 ? (
                  <select value={competitionInfo.mainCompetitor ?? ''}
                    onChange={e => onCompetitionInfoChange({ ...competitionInfo, mainCompetitor: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Επιλέξτε...</option>
                    {competitors.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                ) : (
                  <input type="text" value={competitionInfo.mainCompetitor ?? ''}
                    onChange={e => onCompetitionInfoChange({ ...competitionInfo, mainCompetitor: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="π.χ. Γιώργης Ανταλλακτικά" />
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Άλλοι Ανταγωνιστές</label>
                <input type="text" value={competitionInfo.otherCompetitors ?? ''}
                  onChange={e => onCompetitionInfoChange({ ...competitionInfo, otherCompetitors: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Εκτιμώμενη Μηνιαία Δαπάνη (€)</label>
                <input type="number" value={competitionInfo.estimatedMonthlySpend ?? ''}
                  onChange={e => onCompetitionInfoChange({ ...competitionInfo, estimatedMonthlySpend: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="π.χ. 2000" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Δυνατά Σημεία Ανταγωνιστή</label>
                <textarea value={competitionInfo.competitorStrengths ?? ''}
                  onChange={e => onCompetitionInfoChange({ ...competitionInfo, competitorStrengths: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-h-[60px]" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Λόγος Πιθανής Αλλαγής</label>
                <textarea value={competitionInfo.switchReason ?? ''}
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