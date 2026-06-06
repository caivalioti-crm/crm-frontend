import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { RotateCcw } from 'lucide-react';

// ── Domain knowledge ──────────────────────────────────────────────────────────

const CAR_BRANDS = new Set([
  'toyota','ford','bmw','mercedes','benz','audi','vw','volkswagen','opel',
  'peugeot','renault','citroen','fiat','nissan','honda','hyundai','kia',
  'mitsubishi','suzuki','mazda','isuzu','jeep','volvo','scania','man','daf',
  'iveco','alfa','seat','skoda','porsche','subaru','lexus','dacia','lada',
  'lancia','chrysler','dodge','land','rover','hino','saab','ssangyong',
  'great','wall','foton','mahindra','tata','avia','liaz','aro',
]);

const STOPWORDS = new Set([
  'για','με','και','του','της','των','στο','στη','από','προς','κατα',
  'το','τα','τη','οι','τον','την','κλπ','κτλ','ΓΙΑ','ΤΟ','ΤΑ','ΤΗ',
  'set','kit','of','and','for','the','a','an','to','in','by','с','для',
  'ΣΕΤ','ΤΟΥ','ΤΗΣ','ΚΑΙ','ΜΕ',
]);

// Stopwords too short or numeric
const isNoise = (w: string) =>
  w.length < 3 || /^\d+$/.test(w) || STOPWORDS.has(w) || STOPWORDS.has(w.toLowerCase());

function tokenize(name: string): string[] {
  return name
    .split(/[\s\/\-\(\)\[\]\,\.\:]+/)
    .map(w => w.replace(/[^α-ωΑ-Ωa-zA-Z0-9]/g, ''))
    .filter(w => !isNoise(w));
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SkuRow { sku_name: string; netamnt: number; qty: number; }
interface WordEntry { word: string; revenue: number; count: number; isBrand: boolean; }

// ── Visual config ─────────────────────────────────────────────────────────────

const SIZE_STOPS = [10, 12, 14, 17, 21, 26, 32, 40];

function toSize(revenue: number, max: number): number {
  const ratio = Math.sqrt(revenue / max); // sqrt for less extreme differences
  const idx = Math.min(Math.floor(ratio * SIZE_STOPS.length), SIZE_STOPS.length - 1);
  return SIZE_STOPS[idx];
}

const PRODUCT_COLORS = [
  '#4f46e5','#0284c7','#0f766e','#7c3aed','#1d4ed8','#0369a1','#6d28d9','#1e40af',
];
const BRAND_COLORS = ['#c2410c','#b45309','#be123c','#9f1239'];

function pickColor(word: string, isBrand: boolean, idx: number): string {
  if (isBrand) return BRAND_COLORS[idx % BRAND_COLORS.length];
  // Deterministic color from word chars
  const hash = word.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PRODUCT_COLORS[hash % PRODUCT_COLORS.length];
}

// ── Tier helper ───────────────────────────────────────────────────────────────

function customerTier(revenue: number): { label: string; color: string; desc: string } {
  if (revenue >= 50000) return { label: 'Α', color: 'bg-amber-100 text-amber-700 border-amber-300', desc: 'Μεγάλος πελάτης' };
  if (revenue >= 15000) return { label: 'Β', color: 'bg-blue-100 text-blue-700 border-blue-300', desc: 'Μεσαίος πελάτης' };
  if (revenue >= 3000)  return { label: 'Γ', color: 'bg-slate-100 text-slate-600 border-slate-300', desc: 'Μικρός πελάτης' };
  return { label: 'Δ', color: 'bg-rose-50 text-rose-500 border-rose-200', desc: 'Ανενεργός / Μικροπελάτης' };
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CustomerWordCloud({ customerCode }: { customerCode: string }) {
  const [skus, setSkus]       = useState<SkuRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const from = new Date();
      from.setFullYear(from.getFullYear() - 3);
      const fromMonth = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;

      // Try trdr_code first, fall back to customer_code
      let { data, error: err } = await supabase
        .from('mv_crm_sku_sales')
        .select('sku_name, netamnt, qty')
        .eq('trdr_code', customerCode)
        .gte('month', fromMonth)
        .limit(500);

      if (err || !data?.length) {
        const fallback = await supabase
          .from('mv_crm_sku_sales')
          .select('sku_name, netamnt, qty')
          .eq('customer_code', customerCode)
          .gte('month', fromMonth)
          .limit(500);
        data = fallback.data;
      }

      setSkus(data ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Σφάλμα φόρτωσης');
    } finally {
      setLoading(false);
    }
  }, [customerCode]);

  useEffect(() => { load(); }, [load]);

  // ── Process ────────────────────────────────────────────────────────────────

  const analysis = useMemo(() => {
    if (!skus.length) return null;

    const wordMap = new Map<string, { revenue: number; count: number }>();
    let totalRevenue = 0;
    let totalQty = 0;
    const skuSet = new Set<string>();
    const brandSet = new Set<string>();

    for (const row of skus) {
      totalRevenue += row.netamnt;
      totalQty     += row.qty;
      skuSet.add(row.sku_name);

      const tokens = tokenize(row.sku_name);
      for (const t of tokens) {
        const key = t.toUpperCase();
        const existing = wordMap.get(key);
        if (existing) {
          existing.revenue += row.netamnt;
          existing.count   += 1;
        } else {
          wordMap.set(key, { revenue: row.netamnt, count: 1 });
        }
        if (CAR_BRANDS.has(t.toLowerCase())) brandSet.add(t.toUpperCase());
      }
    }

    const words: WordEntry[] = Array.from(wordMap.entries())
      .map(([word, d]) => ({ word, revenue: d.revenue, count: d.count, isBrand: brandSet.has(word) }))
      .filter(w => w.count >= 1 && w.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 55);

    return {
      words,
      totalRevenue,
      totalQty: Math.round(totalQty),
      uniqueSkus: skuSet.size,
      brands: Array.from(brandSet),
      tier: customerTier(totalRevenue),
    };
  }, [skus]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center gap-2 py-6 justify-center">
      <span className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      <span className="text-sm text-slate-400">Ανάλυση αγορών 3 ετών...</span>
    </div>
  );

  if (error) return (
    <div className="text-xs text-red-500 py-2 flex items-center gap-2">
      Σφάλμα: {error}
      <button onClick={load} className="underline">Retry</button>
    </div>
  );

  if (!analysis || !analysis.words.length) return (
    <div className="text-sm text-slate-400 italic py-4 text-center">Δεν βρέθηκαν δεδομένα αγορών για τα τελευταία 3 χρόνια</div>
  );

  const maxRevenue = analysis.words[0].revenue;

  // Shuffle for visual variety (stable by customerCode seed)
  const seed = customerCode.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const displayWords = [...analysis.words].sort((a, b) => {
    const ha = (a.word.charCodeAt(0) + seed) % 7;
    const hb = (b.word.charCodeAt(0) + seed) % 7;
    return ha - hb;
  });

  return (
    <div className="space-y-4">

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <div className={`rounded-lg p-3 border text-center ${analysis.tier.color}`}>
          <div className="text-2xl font-black leading-none">{analysis.tier.label}</div>
          <div className="text-xs mt-0.5 opacity-70">{analysis.tier.desc}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
          <div className="text-base font-bold text-slate-700">€{Math.round(analysis.totalRevenue).toLocaleString('el-GR')}</div>
          <div className="text-xs text-slate-400">3ετία τζίρος</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
          <div className="text-base font-bold text-slate-700">{analysis.uniqueSkus}</div>
          <div className="text-xs text-slate-400">Διαφ. κωδικοί</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
          <div className="text-base font-bold text-slate-700">{analysis.totalQty.toLocaleString('el-GR')}</div>
          <div className="text-xs text-slate-400">Τεμάχια</div>
        </div>
      </div>

      {/* Brands */}
      {analysis.brands.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Εντοπισμένες μάρκες οχημάτων</div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.brands.map(b => (
              <span key={b} className="px-2 py-0.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-full text-xs font-bold">
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Word cloud */}
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 p-5 min-h-[180px]">
        <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1.5">
          {displayWords.map((w, i) => {
            const size = toSize(w.revenue, maxRevenue);
            const color = pickColor(w.word, w.isBrand, i);
            const opacity = 0.55 + 0.45 * (w.revenue / maxRevenue);
            return (
              <span
                key={w.word}
                className="font-semibold leading-tight cursor-default transition-all hover:scale-110 hover:opacity-100 select-none"
                style={{ fontSize: `${size}px`, color, opacity }}
                title={`€${Math.round(w.revenue).toLocaleString('el-GR')} · ${w.count} SKU${w.count !== 1 ? 's' : ''}${w.isBrand ? ' · Μάρκα' : ''}`}
              >
                {w.word}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full inline-block bg-orange-400" /> Μάρκα οχήματος
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full inline-block bg-indigo-400" /> Κατηγορία/Τεμάχιο
          </span>
          <span className="ml-auto">Μέγεθος = τζίρος 3ετίας</span>
        </div>
      </div>

      <button onClick={load}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors">
        <RotateCcw className="w-3 h-3" /> Ανανέωση
      </button>
    </div>
  );
}
