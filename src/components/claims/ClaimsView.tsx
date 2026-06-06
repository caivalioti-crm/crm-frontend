import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Plus, Search, Upload, FileText, Phone, Mail, MessageSquare, AlertCircle, Clock, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? '';
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Shared field wrapper — MUST be at module level (inside component = re-mount on every keystroke) ──

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>{children}</div>
);

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new:               { label: 'Νέα',            color: 'bg-blue-100 text-blue-700' },
  investigating:     { label: 'Διερεύνηση',     color: 'bg-amber-100 text-amber-700' },
  sent_to_factory:   { label: '→ Εργοστάσιο',  color: 'bg-orange-100 text-orange-700' },
  awaiting_factory:  { label: 'Αναμονή',        color: 'bg-yellow-100 text-yellow-700' },
  factory_responded: { label: 'Απάντηση',       color: 'bg-purple-100 text-purple-700' },
  resolved:          { label: 'Επιλύθηκε',      color: 'bg-green-100 text-green-700' },
  closed:            { label: 'Κλειστή',        color: 'bg-slate-100 text-slate-600' },
};

const COMPLAINT_TYPES = [
  { value: 'wrong_item',     label: 'Λάθος τεμάχιο' },
  { value: 'defective',      label: 'Ελαττωματικό προϊόν' },
  { value: 'arrived_broken', label: 'Έφτασε σπασμένο / κατεστραμμένο' },
  { value: 'missing',        label: 'Ελλιπής παραγγελία' },
  { value: 'quality',        label: 'Πρόβλημα ποιότητας' },
  { value: 'other',          label: 'Άλλο' },
];

const NEXT_ACTIONS = [
  { value: 'log_factory',       label: 'Καταχώρηση στο σύστημα εργοστασίου' },
  { value: 'await_engineer',    label: 'Αναμονή τεχνικού' },
  { value: 'await_credit_note', label: 'Αναμονή πιστωτικού' },
  { value: 'await_claims_exec', label: 'Αναμονή διαχειριστή αξιώσεων' },
  { value: 'await_customer',    label: 'Αναμονή πελάτη' },
  { value: 'await_factory',     label: 'Αναμονή εργοστασίου' },
  { value: 'send_replacement',  label: 'Αποστολή αντικατάστασης' },
  { value: 'close',             label: 'Κλείσιμο' },
];

const COMPENSATION_TYPES = [
  { value: 'pending',        label: 'Σε Εξέλιξη' },
  { value: 'credit_note',    label: 'Πιστωτικό Τιμολόγιο' },
  { value: 'replacement',    label: 'Αντικατάσταση' },
  { value: 'partial_refund', label: 'Μερική Επιστροφή' },
  { value: 'full_refund',    label: 'Πλήρης Επιστροφή' },
  { value: 'rejected',       label: 'Απορρίφθηκε' },
];

const COMM_TYPES = [
  { value: 'customer_call',    label: 'Κλήση Πελάτη' },
  { value: 'customer_email',   label: 'Email Πελάτη' },
  { value: 'customer_message', label: 'Μήνυμα Πελάτη' },
  { value: 'factory_email',    label: 'Email Εργοστασίου' },
  { value: 'factory_call',     label: 'Κλήση Εργοστασίου' },
  { value: 'factory_portal',   label: 'Portal Εργοστασίου' },
  { value: 'internal_note',    label: 'Εσωτερική Σημείωση' },
];

const STATUS_FLOW: Record<string, string[]> = {
  new:               ['investigating'],
  investigating:     ['sent_to_factory', 'resolved'],
  sent_to_factory:   ['awaiting_factory'],
  awaiting_factory:  ['factory_responded'],
  factory_responded: ['resolved'],
  resolved:          ['closed'],
  closed:            [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'bg-slate-100 text-slate-600' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

// ── Main Component ────────────────────────────────────────────────────────────

interface CurrentUser { id: string; name: string; role: string; salesman_code?: string | null; }

export function ClaimsView({ currentUser, onBack, customers = [] }: { currentUser: CurrentUser; onBack: (() => void) | null; customers?: any[] }) {
  const [view, setView]               = useState<'list' | 'create' | 'detail'>('list');
  const [claims, setClaims]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]           = useState('');
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const factoryRole: 'full' | 'partial' | 'none' =
  ['admin', 'exec'].includes(currentUser.role) ? 'full'
  : currentUser.role === 'claims_exec'          ? 'partial'
  : 'none';

  const loadClaims = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      const data = await apiFetch(`/api/claims?${params}`);
      setClaims(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadClaims(); }, [statusFilter]);

  const openDetail = async (claim: any) => {
    setDetailLoading(true);
    setView('detail');
    try {
      const data = await apiFetch(`/api/claims/${claim.id}`);
      setSelectedClaim(data);
    } catch (err) { console.error(err); }
    finally { setDetailLoading(false); }
  };

  const refreshDetail = async () => {
    if (!selectedClaim) return;
    const data = await apiFetch(`/api/claims/${selectedClaim.id}`);
    setSelectedClaim(data);
  };

  const goBack = () => {
    if (view === 'detail' || view === 'create') { setView('list'); loadClaims(); }
    else if (onBack) onBack();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          {view !== 'list' ? (
            <button onClick={goBack} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition-colors text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> Claims
            </button>
            ) : onBack ? (
            <button onClick={onBack} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition-colors text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> Dashboard
            </button>
            ) : (
            <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition-colors text-sm font-medium">
                <LogOut className="w-4 h-4" /> Logout
            </button>
            )}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight">
              {view === 'list' ? 'Claims' : view === 'create' ? 'Νέα Αξίωση' : selectedClaim?.claim_number ?? '...'}
            </h1>
            {view === 'detail' && selectedClaim && (
              <p className="text-blue-200 text-xs truncate">{selectedClaim.customer_name}</p>
            )}
          </div>
          {view === 'list' && (
            <button onClick={() => setView('create')} className="flex items-center gap-1.5 bg-white text-indigo-700 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-blue-50 transition-colors shrink-0">
              <Plus className="w-4 h-4" /> Νέα
            </button>
          )}
          {view === 'detail' && selectedClaim && <StatusBadge status={selectedClaim.status} />}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {view === 'list' && (
          <ClaimsList claims={claims} loading={loading} statusFilter={statusFilter}
            setStatusFilter={setStatusFilter} search={search} setSearch={setSearch}
            onSearch={(e: React.KeyboardEvent) => { if (e.key === 'Enter') loadClaims(); }}
            onSelect={openDetail} />
        )}
        {view === 'create' && (
          <ClaimCreateForm currentUser={currentUser} customers={customers}
            onSaved={() => { setView('list'); loadClaims(); }}
            onCancel={() => setView('list')} />
        )}
        {view === 'detail' && (
          detailLoading
            ? <div className="text-center py-12 text-slate-400">Φόρτωση...</div>
            : selectedClaim
              ? <ClaimDetail claim={selectedClaim} currentUser={currentUser} factoryRole={factoryRole} onRefresh={refreshDetail} />
              : null
        )}
      </main>
    </div>
  );
}

// ── Claims List ───────────────────────────────────────────────────────────────

function ClaimsList({ claims, loading, statusFilter, setStatusFilter, search, setSearch, onSearch, onSelect }: any) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {['all', 'new', 'investigating', 'sent_to_factory', 'awaiting_factory', 'factory_responded', 'resolved', 'closed'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
            }`}>
            {s === 'all' ? 'Όλες' : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={onSearch}
          placeholder="Αριθμός, πελάτης, SKU... (Enter)"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Φόρτωση...</div>
      ) : claims.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">Δεν βρέθηκαν αξιώσεις</p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((c: any) => (
            <button key={c.id} onClick={() => onSelect(c)}
              className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-left hover:shadow-md hover:border-indigo-300 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-sm font-semibold text-indigo-600">{c.claim_number}</span>
                    <StatusBadge status={c.status} />
                    {c.compensation_type && ['resolved', 'closed'].includes(c.status) && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                        {COMPENSATION_TYPES.find(x => x.value === c.compensation_type)?.label ?? c.compensation_type}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-slate-800 truncate">{c.customer_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {COMPLAINT_TYPES.find(x => x.value === c.complaint_type)?.label ?? c.complaint_type}
                    {c.sku && <span className="ml-2 font-mono text-slate-400">{c.sku}</span>}
                  </div>
                </div>
                <div className="text-xs text-slate-400 shrink-0 text-right">
                  <div>{formatDate(c.created_at)}</div>
                  {c.invoice_number && <div className="font-mono text-slate-300">{c.invoice_number}</div>}
                </div>
              </div>
              {c.complaint_description && (
                <p className="text-xs text-slate-500 mt-2 line-clamp-2">{c.complaint_description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create Form ───────────────────────────────────────────────────────────────

function ClaimCreateForm({ currentUser, customers, onSaved, onCancel }: any) {
  const [customerSearch, setCustomerSearch]     = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [skuSearch, setSkuSearch]               = useState('');
  const [selectedSku, setSelectedSku]           = useState<any>(null);
  const [skuResults, setSkuResults]             = useState<any[]>([]);
  const [skuLoading, setSkuLoading]             = useState(false);
  const [form, setForm] = useState({
    complaint_date:        new Date().toISOString().split('T')[0],
    complaint_type:        '',
    complaint_description: '',
    next_action:           '',
    quantity:              '',
    invoice_number:        '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const filteredCustomers = useMemo(() => {
    if (!customerSearch || customerSearch.length < 2) return [];
    const q = customerSearch.toLowerCase();
    return (customers ?? [])
      .filter((c: any) => c.name?.toLowerCase().includes(q) || String(c.code).includes(q))
      .slice(0, 8);
  }, [customerSearch, customers]);

  useEffect(() => {
    if (skuSearch.length < 3) { setSkuResults([]); return; }
    const t = setTimeout(async () => {
      setSkuLoading(true);
      try {
        const { data } = await supabase
          .from('stg_soft1_mtrl')
          .select('mtrl_code, mtrldesc')
          .or(`mtrl_code.ilike.%${skuSearch}%,mtrldesc.ilike.%${skuSearch}%`)
          .limit(8);
        setSkuResults(data ?? []);
      } catch { setSkuResults([]); }
      finally { setSkuLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [skuSearch]);

  const handleSubmit = async () => {
    if (!selectedCustomer)    { setError('Επιλέξτε πελάτη'); return; }
    if (!form.complaint_type) { setError('Επιλέξτε τύπο προβλήματος'); return; }
    if (!form.complaint_date) { setError('Συμπληρώστε ημερομηνία'); return; }
    setSaving(true); setError('');
    try {
      await apiFetch('/api/claims', {
        method: 'POST',
        body: JSON.stringify({
          customer_code:         selectedCustomer.code,
          customer_name:         selectedCustomer.name,
          sku:                   selectedSku?.mtrl_code ?? (skuSearch || null),
          sku_description:       selectedSku?.mtrldesc ?? null,
          quantity:              form.quantity ? parseInt(form.quantity) : null,
          invoice_number:        form.invoice_number || null,
          complaint_date:        form.complaint_date,
          complaint_type:        form.complaint_type,
          complaint_description: form.complaint_description || null,
          next_action:           form.next_action || null,
          created_by:            currentUser.id,
          assigned_to:           currentUser.id,
        }),
      });
      onSaved();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <FormField label="Πελάτης *">
        {selectedCustomer ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
            <span className="text-sm font-medium text-indigo-700 flex-1 truncate">{selectedCustomer.name}</span>
            <span className="text-xs font-mono text-indigo-400 shrink-0">{selectedCustomer.code}</span>
            <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
              className="text-indigo-300 hover:text-red-400 ml-1 text-lg leading-none">×</button>
          </div>
        ) : (
          <div className="relative">
            <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
              placeholder="Αναζήτηση ονόματος ή κωδικού..." className={inputCls} autoComplete="off" />
            {filteredCustomers.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {filteredCustomers.map((c: any) => (
                  <button key={c.code} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0">
                    <span className="text-xs font-mono text-slate-400 shrink-0 w-16">{c.code}</span>
                    <span className="text-sm text-slate-700 truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </FormField>

      <FormField label="Κωδικός Προϊόντος">
        {selectedSku ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
            <span className="text-xs font-mono text-indigo-600 shrink-0">{selectedSku.mtrl_code}</span>
            <span className="text-sm text-indigo-700 flex-1 truncate">{selectedSku.mtrldesc}</span>
            <button onClick={() => { setSelectedSku(null); setSkuSearch(''); }}
              className="text-indigo-300 hover:text-red-400 ml-1 text-lg leading-none">×</button>
          </div>
        ) : (
          <div className="relative">
            <input value={skuSearch} onChange={e => setSkuSearch(e.target.value)}
              placeholder="Κωδικός ή περιγραφή (min 3 χαρακτήρες)..." className={inputCls} autoComplete="off" />
            {skuLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">...</span>}
            {skuResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {skuResults.map((s: any) => (
                  <button key={s.mtrl_code} onClick={() => { setSelectedSku(s); setSkuSearch(''); setSkuResults([]); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0">
                    <span className="text-xs font-mono text-slate-400 shrink-0 w-28 truncate">{s.mtrl_code}</span>
                    <span className="text-sm text-slate-700 truncate">{s.mtrldesc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Ημ/νία Καταγγελίας *">
          <input type="date" value={form.complaint_date}
            onChange={e => setForm(f => ({ ...f, complaint_date: e.target.value }))} className={inputCls} />
        </FormField>
        <FormField label="Τύπος Προβλήματος *">
          <select value={form.complaint_type}
            onChange={e => setForm(f => ({ ...f, complaint_type: e.target.value }))} className={inputCls}>
            <option value="">Επιλέξτε...</option>
            {COMPLAINT_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </FormField>
      </div>

      <FormField label="Περιγραφή Προβλήματος">
        <textarea value={form.complaint_description}
          onChange={e => setForm(f => ({ ...f, complaint_description: e.target.value }))}
          rows={3} placeholder="Αναλυτική περιγραφή..." className={`${inputCls} resize-none`} />
      </FormField>

      <FormField label="Επόμενη Ενέργεια">
        <select value={form.next_action}
          onChange={e => setForm(f => ({ ...f, next_action: e.target.value }))} className={inputCls}>
          <option value="">— Επιλέξτε —</option>
          {NEXT_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </FormField>

      <details className="group">
        <summary className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer hover:text-slate-600 list-none select-none">
          <span className="transition-transform group-open:rotate-90 inline-block">▶</span>
          Προαιρετικά (αρ. τιμολογίου, ποσότητα)
        </summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <FormField label="Αρ. Τιμολογίου">
            <input value={form.invoice_number}
              onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
              placeholder="π.χ. ΤΔ-12345" className={inputCls} />
          </FormField>
          <FormField label="Ποσότητα">
            <input type="number" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className={inputCls} />
          </FormField>
        </div>
      </details>

      <div className="flex gap-3 pt-2">
        <button onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Ακύρωση
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Αποθήκευση...' : 'Δημιουργία'}
        </button>
      </div>
    </div>
  );
}

// ── Claim Detail ──────────────────────────────────────────────────────────────

function ClaimDetail({ claim, currentUser, factoryRole, onRefresh }: any) {
  const [activeTab, setActiveTab]   = useState<'info' | 'comms' | 'files' | 'factory' | 'history'>('info');
  const [statusLoading, setStatusLoading] = useState(false);

  const changeStatus = async (to_status: string) => {
    setStatusLoading(true);
    try {
      await apiFetch(`/api/claims/${claim.id}/status`, { method: 'POST', body: JSON.stringify({ to_status, changed_by: currentUser.id }) });
      onRefresh();
    } catch (err) { console.error(err); }
    finally { setStatusLoading(false); }
  };

  const nextStatuses = STATUS_FLOW[claim.status] ?? [];

  const tabs = [
    { id: 'info',    label: 'Στοιχεία' },
    { id: 'comms',   label: 'Επικοινωνία' },
    { id: 'files',   label: 'Αρχεία' },
    ...(factoryRole !== 'none' ? [{ id: 'factory', label: 'Εργοστάσιο' }] : []),
    { id: 'history', label: 'Ιστορικό' },
  ];

  return (
    <div className="space-y-4">
      {nextStatuses.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Αλλαγή Status</p>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map(s => (
              <button key={s} onClick={() => changeStatus(s)} disabled={statusLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 hover:opacity-80 ${STATUS_CONFIG[s]?.color ?? 'bg-slate-100 text-slate-700'}`}>
                → {STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id ? 'border-indigo-500 text-indigo-600 bg-indigo-50' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {activeTab === 'info'    && <InfoTab claim={claim} onRefresh={onRefresh} />}
          {activeTab === 'comms'   && <CommsTab claim={claim} currentUser={currentUser} onRefresh={onRefresh} />}
          {activeTab === 'files'   && <FilesTab claim={claim} currentUser={currentUser} onRefresh={onRefresh} />}
          {activeTab === 'factory' && factoryRole !== 'none' && <FactoryTab claim={claim} factoryRole={factoryRole} onRefresh={onRefresh} />}
          {activeTab === 'history' && <HistoryTab history={claim.history ?? []} />}
        </div>
      </div>
    </div>
  );
}

// ── Info Tab ──────────────────────────────────────────────────────────────────

function InfoTab({ claim, onRefresh }: any) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ complaint_description: claim.complaint_description ?? '', resolution_notes: claim.resolution_notes ?? '' });
  const [saving, setSaving]   = useState(false);

  const Row = ({ label, value }: { label: string; value?: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 w-40 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-800 flex-1">{value ?? '—'}</span>
    </div>
  );

  const save = async () => {
    setSaving(true);
    try { await apiFetch(`/api/claims/${claim.id}`, { method: 'PATCH', body: JSON.stringify(form) }); onRefresh(); setEditing(false); }
    catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-1">
      <Row label="Αρ. Αξίωσης"       value={<span className="font-mono font-semibold text-indigo-600">{claim.claim_number}</span>} />
      <Row label="Κωδικός Πελάτη"    value={claim.customer_code} />
      <Row label="Επωνυμία"          value={claim.customer_name} />
      <Row label="SKU"               value={<span className="font-mono">{claim.sku}</span>} />
      <Row label="Περιγραφή SKU"     value={claim.sku_description} />
      <Row label="Ποσότητα"          value={claim.quantity} />
      <Row label="Αρ. Τιμολογίου"   value={<span className="font-mono">{claim.invoice_number}</span>} />
      <Row label="Ημ/νία Αγοράς"    value={formatDate(claim.purchase_date)} />
      <Row label="Ημ/νία Καταγγελίας" value={formatDate(claim.complaint_date)} />
      <Row label="Τύπος"             value={COMPLAINT_TYPES.find(c => c.value === claim.complaint_type)?.label ?? claim.complaint_type} />
      <Row label="Status"            value={<StatusBadge status={claim.status} />} />
      {claim.next_action && (
        <Row label="Επόμενη Ενέργεια" value={
          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-medium">
            {NEXT_ACTIONS.find(a => a.value === claim.next_action)?.label ?? claim.next_action}
          </span>
        } />
      )}

      {editing ? (
        <div className="space-y-3 pt-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Περιγραφή Προβλήματος</label>
            <textarea value={form.complaint_description} onChange={e => setForm(f => ({ ...f, complaint_description: e.target.value }))}
              rows={4} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Σημειώσεις Επίλυσης</label>
            <textarea value={form.resolution_notes} onChange={e => setForm(f => ({ ...f, resolution_notes: e.target.value }))}
              rows={3} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700">Ακύρωση</button>
            <button onClick={save} disabled={saving} className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-2 space-y-3">
          {claim.complaint_description && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Περιγραφή Προβλήματος</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{claim.complaint_description}</p>
            </div>
          )}
          {claim.resolution_notes && (
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs font-medium text-green-700 mb-1">Σημειώσεις Επίλυσης</p>
              <p className="text-sm text-green-800 whitespace-pre-wrap">{claim.resolution_notes}</p>
            </div>
          )}
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">Επεξεργασία</button>
        </div>
      )}
    </div>
  );
}

// ── Comms Tab ─────────────────────────────────────────────────────────────────

function CommsTab({ claim, currentUser, onRefresh }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ comm_type: 'internal_note', direction: 'internal', subject: '', body: '', contact_person: '' });
  const [saving, setSaving]   = useState(false);

  const COMM_ICON: Record<string, React.ReactNode> = {
    customer_call: <Phone className="w-3.5 h-3.5" />, customer_email: <Mail className="w-3.5 h-3.5" />,
    customer_message: <MessageSquare className="w-3.5 h-3.5" />, factory_email: <Mail className="w-3.5 h-3.5" />,
    factory_call: <Phone className="w-3.5 h-3.5" />, factory_portal: <FileText className="w-3.5 h-3.5" />,
    internal_note: <Clock className="w-3.5 h-3.5" />,
  };
  const COMM_COLOR: Record<string, string> = {
    customer_call: 'bg-blue-50 border-blue-200 text-blue-700', customer_email: 'bg-blue-50 border-blue-200 text-blue-700',
    customer_message: 'bg-blue-50 border-blue-200 text-blue-700', factory_email: 'bg-orange-50 border-orange-200 text-orange-700',
    factory_call: 'bg-orange-50 border-orange-200 text-orange-700', factory_portal: 'bg-orange-50 border-orange-200 text-orange-700',
    internal_note: 'bg-slate-50 border-slate-200 text-slate-600',
  };

  const save = async () => {
    if (!form.body.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/claims/${claim.id}/communications`, { method: 'POST', body: JSON.stringify({ ...form, authored_by: currentUser.id }) });
      setForm({ comm_type: 'internal_note', direction: 'internal', subject: '', body: '', contact_person: '' });
      setShowAdd(false); onRefresh();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:underline">
        <Plus className="w-4 h-4" /> Προσθήκη Επικοινωνίας
      </button>

      {showAdd && (
        <div className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Τύπος</label>
              <select value={form.comm_type} onChange={e => setForm(f => ({ ...f, comm_type: e.target.value }))} className={inputCls}>
                {COMM_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Κατεύθυνση</label>
              <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} className={inputCls}>
                <option value="inbound">Εισερχόμενη</option>
                <option value="outbound">Εξερχόμενη</option>
                <option value="internal">Εσωτερική</option>
              </select>
            </div>
          </div>
          <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Θέμα (προαιρετικό)" className={inputCls} />
          <input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} placeholder="Επαφή (προαιρετικό)" className={inputCls} />
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} placeholder="Περιγραφή επικοινωνίας... *" className={`${inputCls} resize-none`} />
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700">Ακύρωση</button>
            <button onClick={save} disabled={saving || !form.body.trim()} className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </button>
          </div>
        </div>
      )}

      {(claim.communications ?? []).length === 0
        ? <p className="text-sm text-slate-400 italic">Δεν υπάρχουν καταγεγραμμένες επικοινωνίες</p>
        : <div className="space-y-3">
            {(claim.communications ?? []).map((c: any) => (
              <div key={c.id} className={`rounded-lg border p-3 ${COMM_COLOR[c.comm_type] ?? 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap text-current">
                  {COMM_ICON[c.comm_type]}
                  <span className="text-xs font-semibold">{COMM_TYPES.find(t => t.value === c.comm_type)?.label ?? c.comm_type}</span>
                  {c.direction && c.direction !== 'internal' && <span className="text-xs opacity-60">({c.direction === 'inbound' ? 'Εισερχόμενη' : 'Εξερχόμενη'})</span>}
                  {c.contact_person && <span className="text-xs opacity-60">· {c.contact_person}</span>}
                  <span className="text-xs opacity-50 ml-auto">{formatDateTime(c.created_at)}</span>
                </div>
                {c.subject && <p className="text-xs font-medium mb-0.5">{c.subject}</p>}
                <p className="text-sm whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Files Tab ─────────────────────────────────────────────────────────────────


function FilesTab({ claim, currentUser, onRefresh }: any) {
  const [uploading, setUploading]         = useState(false);
  const [description, setDescription]     = useState('');
  const [isFactoryFacing, setIsFactoryFacing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { upload_url, storage_path } = await apiFetch(`/api/claims/${claim.id}/attachments/upload-url`, {
        method: 'POST',
        body: JSON.stringify({ file_name: file.name, mime_type: file.type }),
      });
      const uploadRes = await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!uploadRes.ok) throw new Error('Upload failed');

      const fileType = file.type.startsWith('image/') ? 'photo' : file.type.startsWith('video/') ? 'video' : 'document';
      await apiFetch(`/api/claims/${claim.id}/attachments/confirm`, {
        method: 'POST',
        body: JSON.stringify({ storage_path, file_name: file.name, file_type: fileType, file_size_bytes: file.size, mime_type: file.type, description, is_factory_facing: isFactoryFacing, uploaded_by: currentUser.id }),
      });
      setDescription(''); setIsFactoryFacing(false);
      if (fileRef.current) fileRef.current.value = '';
      onRefresh();
    } catch (err) { console.error(err); alert('Σφάλμα κατά το ανέβασμα'); }
    finally { setUploading(false); }
  };

  const deleteAttachment = async (id: string) => {
    if (!confirm('Διαγραφή αρχείου;')) return;
    try { await apiFetch(`/api/claims/${claim.id}/attachments/${id}`, { method: 'DELETE' }); onRefresh(); }
    catch (err) { console.error(err); }
  };

  const FILE_EMOJI: Record<string, string> = { photo: '🖼️', video: '🎥', document: '📄', factory_doc: '🏭' };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
        <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm text-slate-500 mb-3">Φωτογραφία, βίντεο ή έγγραφο</p>
        <div className="space-y-2 mb-3 max-w-xs mx-auto">
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Περιγραφή (προαιρετικό)" className={inputCls} />
          <label className="flex items-center gap-2 justify-center text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={isFactoryFacing} onChange={e => setIsFactoryFacing(e.target.checked)} className="rounded" />
            Αρχείο για εργοστάσιο
          </label>
        </div>
        <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${uploading ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
          <Upload className="w-4 h-4" />
          {uploading ? 'Ανέβασμα...' : 'Επιλογή Αρχείου'}
          <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileChange} disabled={uploading} />
        </label>
      </div>

      {(claim.attachments ?? []).length === 0
        ? <p className="text-sm text-slate-400 italic">Δεν υπάρχουν επισυναπτόμενα αρχεία</p>
        : <div className="space-y-2">
            {(claim.attachments ?? []).map((att: any) => (
              <div key={att.id} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <span className="text-lg shrink-0">{FILE_EMOJI[att.file_type] ?? '📎'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-700 truncate">{att.file_name}</p>
                    {att.is_factory_facing && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full shrink-0">Εργοστάσιο</span>}
                  </div>
                  {att.description && <p className="text-xs text-slate-500 truncate">{att.description}</p>}
                  <p className="text-xs text-slate-400">{formatDateTime(att.uploaded_at)}</p>
                </div>
                <div className="flex gap-3 shrink-0">
                  {att.signed_url && <a href={att.signed_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline font-medium">Άνοιγμα</a>}
                  <button onClick={() => deleteAttachment(att.id)} className="text-xs text-red-400 hover:text-red-600">Διαγραφή</button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── Factory Tab ───────────────────────────────────────────────────────────────

function FactoryTab({ claim, factoryRole, onRefresh }: any) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    factory_code: claim.factory_code ?? '', factory_name: claim.factory_name ?? '',
    factory_reference: claim.factory_reference ?? '', factory_sent_date: claim.factory_sent_date ?? '',
    factory_contact: claim.factory_contact ?? '', factory_sent_method: claim.factory_sent_method ?? '',
    factory_response_date: claim.factory_response_date ?? '', compensation_type: claim.compensation_type ?? '',
    compensation_value: String(claim.compensation_value ?? ''), compensation_notes: claim.compensation_notes ?? '',
    credit_note_number: claim.credit_note_number ?? '', replacement_ref: claim.replacement_ref ?? '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/claims/${claim.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...form, compensation_value: form.compensation_value ? parseFloat(form.compensation_value) : null }),
      });
      setEditing(false); onRefresh();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const Row = ({ label, value }: { label: string; value?: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 w-44 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-800 flex-1">{value ?? '—'}</span>
    </div>
  );

 if (!editing) return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Στοιχεία Εργοστασίου</h3>
        {factoryRole !== 'none' && (
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">Επεξεργασία</button>
        )}
      </div>

      {/* Factory identity — μόνο full (admin/exec) */}
      {factoryRole === 'full' && <>
        <Row label="Εργοστάσιο / Προμηθευτής" value={claim.factory_name} />
        <Row label="Κωδικός"                  value={claim.factory_code} />
        <Row label="Αρ. Αναφοράς"             value={<span className="font-mono">{claim.factory_reference}</span>} />
        <Row label="Ημ/νία Αποστολής"         value={formatDate(claim.factory_sent_date)} />
        <Row label="Επαφή"                    value={claim.factory_contact} />
        <Row label="Μέθοδος"                  value={claim.factory_sent_method} />
      </>}

      {/* Αποζημίωση — full + partial (claims_exec) */}
      <div className={factoryRole === 'full' ? 'border-t border-slate-200 mt-4 pt-4' : ''}>
        {factoryRole === 'full' && <h4 className="text-sm font-semibold text-slate-700 mb-2">Αποζημίωση</h4>}
        <Row label="Ημ/νία Απάντησης"    value={formatDate(claim.factory_response_date)} />
        <Row label="Τύπος Αποζημίωσης"   value={COMPENSATION_TYPES.find(c => c.value === claim.compensation_type)?.label} />
        <Row label="Αξία (€)"            value={claim.compensation_value ? `€${Number(claim.compensation_value).toLocaleString('el-GR', { minimumFractionDigits: 2 })}` : undefined} />
        <Row label="Αρ. Πιστωτικού (ΠΤ)" value={<span className="font-mono">{claim.credit_note_number}</span>} />
        <Row label="Ref Αντικατάστασης"  value={<span className="font-mono">{claim.replacement_ref}</span>} />
        {claim.compensation_notes && (
          <div className="bg-orange-50 rounded-lg p-3 mt-2">
            <p className="text-xs font-medium text-orange-700 mb-1">Σχόλια</p>
            <p className="text-sm text-orange-800 whitespace-pre-wrap">{claim.compensation_notes}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Factory identity — μόνο full */}
      {factoryRole === 'full' && <>
        <h3 className="text-sm font-semibold text-slate-700">Αποστολή στο Εργοστάσιο</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[['factory_name','Εργοστάσιο / Προμηθευτής'],['factory_code','Κωδικός'],['factory_reference','Αρ. Αναφοράς'],['factory_contact','Επαφή']].map(([k,l]) => (
            <div key={k}><label className="text-xs text-slate-500 block mb-1">{l}</label><input value={(form as any)[k]} onChange={e => set(k, e.target.value)} className={inputCls} /></div>
          ))}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Μέθοδος</label>
            <select value={form.factory_sent_method} onChange={e => set('factory_sent_method', e.target.value)} className={inputCls}>
              <option value="">Επιλέξτε...</option>
              <option value="email">Email</option><option value="portal">Portal</option><option value="courier">Courier</option>
            </select>
          </div>
          <div><label className="text-xs text-slate-500 block mb-1">Ημ/νία Αποστολής</label><input type="date" value={form.factory_sent_date} onChange={e => set('factory_sent_date', e.target.value)} className={inputCls} /></div>
        </div>
      </>}

      {/* Αποζημίωση — full + partial */}
      <div className={factoryRole === 'full' ? 'border-t border-slate-200 pt-4 space-y-3' : 'space-y-3'}>
        <h4 className="text-sm font-semibold text-slate-700">Απόφαση Εργοστασίου</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="text-xs text-slate-500 block mb-1">Ημ/νία Απάντησης</label><input type="date" value={form.factory_response_date} onChange={e => set('factory_response_date', e.target.value)} className={inputCls} /></div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Τύπος Αποζημίωσης</label>
            <select value={form.compensation_type} onChange={e => set('compensation_type', e.target.value)} className={inputCls}>
              <option value="">Επιλέξτε...</option>
              {COMPENSATION_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-slate-500 block mb-1">Αξία (€)</label><input type="number" step="0.01" value={form.compensation_value} onChange={e => set('compensation_value', e.target.value)} placeholder="0.00" className={inputCls} /></div>
          <div><label className="text-xs text-slate-500 block mb-1">Αρ. Πιστωτικού (ΠΤ)</label><input value={form.credit_note_number} onChange={e => set('credit_note_number', e.target.value)} placeholder="ΠΤ-ΧΧΧΧ" className={inputCls} /></div>
          <div><label className="text-xs text-slate-500 block mb-1">Ref Αντικατάστασης</label><input value={form.replacement_ref} onChange={e => set('replacement_ref', e.target.value)} className={inputCls} /></div>
        </div>
        <div><label className="text-xs text-slate-500 block mb-1">Σχόλια Εργοστασίου</label><textarea value={form.compensation_notes} onChange={e => set('compensation_notes', e.target.value)} rows={3} className={`${inputCls} resize-none`} /></div>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={() => setEditing(false)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700">Ακύρωση</button>
        <button onClick={save} disabled={saving} className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
        </button>
      </div>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({ history }: { history: any[] }) {
  if (!history.length) return <p className="text-sm text-slate-400 italic">Δεν υπάρχει ιστορικό</p>;
  return (
    <div className="space-y-3">
      {history.map((h: any) => (
        <div key={h.id} className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {h.from_status && <><StatusBadge status={h.from_status} /><span className="text-slate-400 text-xs">→</span></>}
              <StatusBadge status={h.to_status} />
              <span className="text-xs text-slate-400 ml-auto">{formatDateTime(h.changed_at)}</span>
            </div>
            {h.notes && <p className="text-xs text-slate-500 mt-1">{h.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}