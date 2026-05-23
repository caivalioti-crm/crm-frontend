import { useState, useEffect } from 'react';
import { Store, Building2 } from 'lucide-react';
import { Star } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { EntityProfileForm } from './EntityProfileForm';
import type { ShopProfile, CompetitionInfo } from '../../types/commercialEntity';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SHOP_TYPE_LABELS: Record<string, string> = {
  auto_parts_retailer: 'Ανταλλακτικά - Γενικά',
  auto_parts_jap: 'Ανταλλακτικά - JAP',
  auto_parts_eur: 'Ανταλλακτικά - EUR',
  auto_parts_korea: 'Ανταλλακτικά - KOREA',
  used_parts_general: 'Μεταχειρισμένα - Γενικά',
  used_parts_jap: 'Μεταχειρισμένα - JAP',
  used_parts_eur: 'Μεταχειρισμένα - EUR',
  accessories: 'Αξεσουάρ',
  garage: 'Συνεργείο',
  body_shop: 'Φανοποιείο',
  electrician: 'Ηλεκτρολογείο',
  specialist: 'Ειδικό - Ρεκτιφιέ/Τουρμπίνα/Diesel',
  vertical_unit: 'Κάθετη μονάδα',
  dealership: 'Αντιπροσωπεία',
  car_rental: 'Ενοικιάσεις αυτοκινήτων',
  cooperative: 'Συνεταιρισμός',
  company: 'Εταιρεία, π.χ. τεχνική',
  public_service: 'Δημόσια Υπηρεσία',
  other: 'Άλλο',
};

const STOCK_BEHAVIOR_LABELS: Record<string, string> = {
  keeps_stock: 'Τηρεί Απόθεμα',
  on_demand: "Παραγγελία κατ'ανάγκη",
  mixed: 'Μικτό',
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

function parseCompetitors(savedComp: any) {
  // New format
  if (savedComp?.competitors_v2 && Array.isArray(savedComp.competitors_v2)) {
    return savedComp.competitors_v2;
  }
  // Legacy format migration
  const result = [];
  if (savedComp?.main_competitor) {
    result.push({ name: savedComp.main_competitor, isPrimary: true, notes: savedComp.competitor_strengths ?? '' });
  }
  if (savedComp?.other_competitors) {
    result.push({ name: savedComp.other_competitors, isPrimary: false, notes: '' });
  }
  return result;
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
  const [competitors, setCompetitors] = useState<{ id: string; name: string }[]>([]);

  const [savedShop, setSavedShop] = useState<any>(initialShop);
  const [savedComp, setSavedComp] = useState<any>(initialComp);

  const [shopType, setShopType] = useState(initialShop?.shop_type ?? '');
  const [shopProfile, setShopProfile] = useState<ShopProfile>({
    numberOfEmployees: initialShop?.number_of_employees ?? undefined,
    shopSizeM2: initialShop?.shop_size_m2 ?? undefined,
    stockBehavior: initialShop?.stock_behavior ?? undefined,
    vehicleTypes: initialShop?.vehicle_types ?? [],
    vehicleBrands: initialShop?.vehicle_brands ?? [],
  });
  const [competitionInfo, setCompetitionInfo] = useState<CompetitionInfo>({
    competitors: parseCompetitors(initialComp),
    estimatedMonthlySpend: initialComp?.estimated_monthly_spend ?? undefined,
    switchReason: initialComp?.switch_reason ?? '',
  });

  useEffect(() => { setSavedShop(initialShop); }, [initialShop]);
  useEffect(() => { setSavedComp(initialComp); }, [initialComp]);

  useEffect(() => {
    setShopType(initialShop?.shop_type ?? '');
    setShopProfile({
      numberOfEmployees: initialShop?.number_of_employees ?? undefined,
      shopSizeM2: initialShop?.shop_size_m2 ?? undefined,
      stockBehavior: initialShop?.stock_behavior ?? undefined,
      vehicleTypes: initialShop?.vehicle_types ?? [],
      vehicleBrands: initialShop?.vehicle_brands ?? [],
    });
  }, [initialShop]);

  useEffect(() => {
    setCompetitionInfo({
      competitors: parseCompetitors(initialComp),
      estimatedMonthlySpend: initialComp?.estimated_monthly_spend ?? undefined,
      switchReason: initialComp?.switch_reason ?? '',
    });
  }, [initialComp]);

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
            vehicle_types: shopProfile.vehicleTypes ?? [],
            vehicle_brands: shopProfile.vehicleBrands ?? [],
          },
          competitor_info: {
            competitors_v2: competitionInfo.competitors ?? [],
            estimated_monthly_spend: competitionInfo.estimatedMonthlySpend ?? null,
            switch_reason: competitionInfo.switchReason || null,
          },
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const newShop = {
        shop_type: shopType,
        number_of_employees: shopProfile.numberOfEmployees,
        shop_size_m2: shopProfile.shopSizeM2,
        stock_behavior: shopProfile.stockBehavior,
        vehicle_types: shopProfile.vehicleTypes,
        vehicle_brands: shopProfile.vehicleBrands,
      };
      const newComp = {
        competitors_v2: competitionInfo.competitors ?? [],
        estimated_monthly_spend: competitionInfo.estimatedMonthlySpend,
        switch_reason: competitionInfo.switchReason,
      };
      setSavedShop(newShop);
      setSavedComp(newComp);
      onSaved(newShop, newComp);
      setEditing(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasData = savedShop || savedComp;
  const btnColor = accentColor === 'purple'
    ? 'border-purple-300 text-purple-600 bg-purple-50 hover:bg-purple-100'
    : 'border-indigo-300 text-indigo-600 bg-indigo-50 hover:bg-indigo-100';
  const saveColor = accentColor === 'purple'
    ? 'bg-purple-600 hover:bg-purple-700'
    : 'bg-indigo-600 hover:bg-indigo-700';

  const displayCompetitors = parseCompetitors(savedComp);

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
          {savedShop && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Store className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-slate-700">Προφίλ Καταστήματος</span>
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                {savedShop.shop_type && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Τύπος</span>
                    <span className="font-medium">{SHOP_TYPE_LABELS[savedShop.shop_type] ?? savedShop.shop_type}</span>
                  </div>
                )}
                {savedShop.vehicle_types?.length > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Οχήματα</span>
                    <span className="font-medium text-right">{savedShop.vehicle_types.join(', ')}</span>
                  </div>
                )}
                {savedShop.vehicle_brands?.length > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Μάρκες</span>
                    <span className="font-medium text-right">{savedShop.vehicle_brands.join(', ')}</span>
                  </div>
                )}
                {savedShop.number_of_employees && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Εργαζόμενοι</span>
                    <span className="font-medium">{savedShop.number_of_employees}</span>
                  </div>
                )}
                {savedShop.shop_size_m2 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Εμβαδό</span>
                    <span className="font-medium">{savedShop.shop_size_m2} m²</span>
                  </div>
                )}
                {savedShop.stock_behavior && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Απόθεμα</span>
                    <span className="font-medium">{STOCK_BEHAVIOR_LABELS[savedShop.stock_behavior] ?? savedShop.stock_behavior}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {savedShop && savedComp && <div className="border-t border-slate-100" />}

          {savedComp && displayCompetitors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold text-slate-700">Ανταγωνισμός</span>
              </div>
              <div className="space-y-2">
                {displayCompetitors.map((c: any) => (
                  <div key={c.name} className="rounded-lg border border-slate-100 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50">
                      {c.isPrimary && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                      <span className="text-sm font-medium text-slate-700">{c.name}</span>
                    </div>
                    {c.notes && (
                      <div className="px-3 py-2 text-xs text-slate-600">{c.notes}</div>
                    )}
                  </div>
                ))}
                {savedComp.estimated_monthly_spend && (
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-slate-500">Μηνιαία Δαπάνη</span>
                    <span className="font-medium text-green-600">€{Number(savedComp.estimated_monthly_spend).toLocaleString('el-GR')}</span>
                  </div>
                )}
                {savedComp.switch_reason && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Λόγος αλλαγής</div>
                    <div className="text-xs bg-slate-50 rounded p-2">{savedComp.switch_reason}</div>
                  </div>
                )}
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