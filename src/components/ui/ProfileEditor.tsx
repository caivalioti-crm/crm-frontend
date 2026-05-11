import { useState, useEffect } from 'react';
import { Store, Users, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { EntityProfileForm } from './EntityProfileForm';
import type { ShopProfile, CompetitionInfo } from '../../types/commercialEntity';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SHOP_TYPE_LABELS: Record<string, string> = {
  auto_parts_retailer: 'Ανταλλακτικά', garage: 'Γκαράζ', body_shop: 'Φανοποιείο',
  dealership: 'Αντιπροσωπεία', truck_parts: 'Φορτηγά', other: 'Άλλο',
};

const STOCK_BEHAVIOR_LABELS: Record<string, string> = {
  keeps_stock: 'Τηρεί Απόθεμα', on_demand: "Παραγγελία κατ'ανάγκη", mixed: 'Μικτό',
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

export function ProfileEditor({ entityType, entityId, shopProfile: initialShop, competitorInfo: initialComp, onSaved, accentColor = 'indigo' }: {
  entityType: 'customer' | 'prospect';
  entityId: string;
  shopProfile: any;
  competitorInfo: any;
  onSaved: (shop: any, comp: any) => void;
  accentColor?: 'indigo' | 'purple';
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<{id: string; name: string}[]>([]);

  const [shopType, setShopType] = useState(initialShop?.shop_type ?? '');
  const [shopProfile, setShopProfile] = useState<ShopProfile>({
    numberOfEmployees: initialShop?.number_of_employees ?? undefined,
    shopSizeM2: initialShop?.shop_size_m2 ?? undefined,
    stockBehavior: initialShop?.stock_behavior ?? undefined,
  });
  const [competitionInfo, setCompetitionInfo] = useState<CompetitionInfo>({
    mainCompetitor: initialComp?.main_competitor ?? '',
    otherCompetitors: initialComp?.other_competitors ?? '',
    estimatedMonthlySpend: initialComp?.estimated_monthly_spend ?? undefined,
    competitorStrengths: initialComp?.competitor_strengths ?? '',
    switchReason: initialComp?.switch_reason ?? '',
  });

  useEffect(() => {
    if (editing && competitors.length === 0) {
      authedFetch('/api/competitors')
        .then(d => setCompetitors(Array.isArray(d) ? d : []))
        .catch(console.error);
    }
  }, [editing]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${BASE_URL}/api/entity-profile/${entityType}/${entityId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          shop_profile: {
            shop_type: shopType || null,
            number_of_employees: shopProfile.numberOfEmployees ?? null,
            shop_size_m2: shopProfile.shopSizeM2 ?? null,
            stock_behavior: shopProfile.stockBehavior ?? null,
          },
          competitor_info: {
            main_competitor: competitionInfo.mainCompetitor || null,
            other_competitors: competitionInfo.otherCompetitors || null,
            estimated_monthly_spend: competitionInfo.estimatedMonthlySpend ?? null,
            competitor_strengths: competitionInfo.competitorStrengths || null,
            switch_reason: competitionInfo.switchReason || null,
          },
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      onSaved(
        { shop_type: shopType, number_of_employees: shopProfile.numberOfEmployees, shop_size_m2: shopProfile.shopSizeM2, stock_behavior: shopProfile.stockBehavior },
        { main_competitor: competitionInfo.mainCompetitor, other_competitors: competitionInfo.otherCompetitors, estimated_monthly_spend: competitionInfo.estimatedMonthlySpend, competitor_strengths: competitionInfo.competitorStrengths, switch_reason: competitionInfo.switchReason }
      );
      setEditing(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasData = initialShop || initialComp;
  const btnColor = accentColor === 'purple'
    ? 'border-purple-300 text-purple-600 bg-purple-50 hover:bg-purple-100'
    : 'border-indigo-300 text-indigo-600 bg-indigo-50 hover:bg-indigo-100';
  const saveColor = accentColor === 'purple'
    ? 'bg-purple-600 hover:bg-purple-700'
    : 'bg-indigo-600 hover:bg-indigo-700';

  return (
    <div>
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-blue-500" />
          <span className="text-base font-semibold text-slate-900">Προφίλ & Ανταγωνισμός</span>
        </div>
        <button onClick={() => setEditing(v => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${editing ? 'border-slate-300 text-slate-600 bg-slate-50' : btnColor}`}>
          {editing ? 'Ακύρωση' : (hasData ? 'Επεξεργασία' : '+ Προσθήκη')}
        </button>
      </div>

      {editing ? (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
          <EntityProfileForm
            shopProfile={shopProfile}
            competitionInfo={competitionInfo}
            onShopProfileChange={setShopProfile}
            onCompetitionInfoChange={setCompetitionInfo}
            shopType={shopType}
            onShopTypeChange={setShopType}
            competitors={competitors}
          />
          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
          <button onClick={handleSave} disabled={saving}
            className={`w-full px-4 py-2 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors ${saveColor}`}>
            {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
          </button>
        </div>
      ) : hasData ? (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
          {initialShop && (
            <div>
              <div className="flex items-center gap-2 mb-3"><Store className="w-4 h-4 text-blue-500" /><span className="text-sm font-semibold text-slate-700">Προφίλ Καταστήματος</span></div>
              <div className="space-y-2 text-sm text-slate-700">
                {initialShop.shop_type && <div className="flex justify-between"><span className="text-slate-500">Τύπος</span><span className="font-medium">{SHOP_TYPE_LABELS[initialShop.shop_type] ?? initialShop.shop_type}</span></div>}
                {initialShop.number_of_employees && <div className="flex justify-between"><span className="text-slate-500">Εργαζόμενοι</span><span className="font-medium flex items-center gap-1"><Users className="w-3.5 h-3.5" />{initialShop.number_of_employees}</span></div>}
                {initialShop.shop_size_m2 && <div className="flex justify-between"><span className="text-slate-500">Εμβαδό</span><span className="font-medium">{initialShop.shop_size_m2} m²</span></div>}
                {initialShop.stock_behavior && <div className="flex justify-between"><span className="text-slate-500">Απόθεμα</span><span className="font-medium">{STOCK_BEHAVIOR_LABELS[initialShop.stock_behavior] ?? initialShop.stock_behavior}</span></div>}
              </div>
            </div>
          )}
          {initialShop && initialComp && <div className="border-t border-slate-100" />}
          {initialComp && (
            <div>
              <div className="flex items-center gap-2 mb-3"><Building2 className="w-4 h-4 text-orange-500" /><span className="text-sm font-semibold text-slate-700">Ανταγωνισμός</span></div>
              <div className="space-y-2 text-sm text-slate-700">
                {initialComp.main_competitor && <div className="flex justify-between"><span className="text-slate-500">Κύριος</span><span className="font-medium">{initialComp.main_competitor}</span></div>}
                {initialComp.other_competitors && <div className="flex justify-between"><span className="text-slate-500">Άλλοι</span><span className="font-medium">{initialComp.other_competitors}</span></div>}
                {initialComp.estimated_monthly_spend && <div className="flex justify-between"><span className="text-slate-500">Μηνιαία Δαπάνη</span><span className="font-medium text-green-600">€{Number(initialComp.estimated_monthly_spend).toLocaleString('el-GR')}</span></div>}
                {initialComp.competitor_strengths && <div><div className="text-slate-500 mb-1">Δυνατά σημεία</div><div className="text-xs bg-slate-50 rounded p-2">{initialComp.competitor_strengths}</div></div>}
                {initialComp.switch_reason && <div><div className="text-slate-500 mb-1">Λόγος αλλαγής</div><div className="text-xs bg-slate-50 rounded p-2">{initialComp.switch_reason}</div></div>}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 pb-4 text-sm text-slate-400 italic">Δεν υπάρχουν στοιχεία προφίλ ή ανταγωνισμού</div>
      )}
    </div>
  );
}