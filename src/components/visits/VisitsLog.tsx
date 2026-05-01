import { useState, useEffect, useCallback } from 'react';
import { Calendar, MapPin, User, ChevronDown, Search, CheckCircle, Clock, AlertCircle, Plus, ChevronRight, Tag, MessageSquare, Bell, Trash2, Pencil, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { SmartDateInput, dateToISO, isoToDisplay } from '../ui/SmartDateInput';
import { CategorySelector } from '../ui/CategorySelector';
import type { SelectedCategory, CategoryItem } from '../ui/CategorySelector';

const BASE_URL = 'http://localhost:3001';

type Task = {
  id: string;
  description: string;
  reminder_date: string | null;
  status: 'not-started' | 'in-progress' | 'completed';
};

type VisitCategory = {
  id: string;
  category_code: string;
  subcategory_code: string | null;
};

type VisitComment = {
  id: string;
  user_id: string;
  commenter_name: string;
  comment: string;
  is_read: boolean;
  read_at: string | null;
  read_by_name: string | null;
  reply_text: string | null;
  reply_at: string | null;
  created_at: string;
};

type Visit = {
  id: string;
  customer_code: string;
  salesman_code: string;
  user_id: string;
  visit_date: string;
  visit_time: string | null;
  visit_type: string;
  notes: string;
  created_at: string;
  crm_visit_tasks: Task[];
  crm_visit_categories: VisitCategory[];
  crm_visit_comments: VisitComment[];
};

type VisitsLogProps = {
  currentUser: {
    id: string;
    name: string;
    role: 'rep' | 'manager' | 'admin' | 'exec';
    salesman_code?: string | null;
  };
  onNewVisit: () => void;
  customers?: { code: string; name: string; city: string; area: string; trdr_id?: number }[];
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

async function authedRequest(method: string, url: string, body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export function VisitsLog({ currentUser, onNewVisit, customers = [] }: VisitsLogProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Edit state
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editType, setEditType] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCategories, setEditCategories] = useState<SelectedCategory[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // Comment state
  const [commentingVisitId, setCommentingVisitId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);

  // Reply state
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);

  const isFullAccess = ['admin', 'manager', 'exec'].includes(currentUser.role);

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const [visitsData, categoriesData] = await Promise.all([
        authedFetch('/api/visits'),
        authedFetch('/api/categories'),
      ]);
      setVisits(Array.isArray(visitsData) ? visitsData : []);
      setAllCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  const categoryMap = new Map(allCategories.map(c => [c.category_code, c]));
  const customerMap = new Map(customers.map(c => [c.code, c]));

  const areas = [...new Set(customers.map(c => c.area))].sort();
  const cities = selectedArea
    ? [...new Set(customers.filter(c => c.area === selectedArea).map(c => c.city))].sort()
    : [];

  const filteredVisits = visits.filter(v => {
    const customer = customerMap.get(v.customer_code);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!v.customer_code.includes(q) &&
          !(customer?.name.toLowerCase().includes(q)) &&
          !(v.notes?.toLowerCase().includes(q))) return false;
    }
    if (selectedArea && customer?.area !== selectedArea) return false;
    if (selectedCity && customer?.city !== selectedCity) return false;
    if (dateFrom && v.visit_date < dateFrom) return false;
    if (dateTo && v.visit_date > dateTo) return false;
    return true;
  });

  const hasActiveFilters = searchQuery || selectedArea || selectedCity || dateFrom || dateTo;

  const getTaskSummary = (tasks: Task[]) => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return { total, completed, pending: total - completed };
  };

  const formatVisitDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  };

  const groupVisitCategories = (visitCategories: VisitCategory[]) => {
    const groups = new Map<string, { general: boolean; subcats: string[] }>();
    for (const vc of visitCategories) {
      if (!vc.subcategory_code) {
        const name = categoryMap.get(vc.category_code)?.full_name ?? vc.category_code;
        if (!groups.has(name)) groups.set(name, { general: false, subcats: [] });
        groups.get(name)!.general = true;
      } else {
        const subCat = categoryMap.get(vc.subcategory_code);
        const parentCat = subCat?.parent_code ? categoryMap.get(subCat.parent_code) : null;
        const groupName = parentCat?.full_name ?? categoryMap.get(vc.category_code)?.full_name ?? vc.category_code;
        const subName = subCat?.full_name ?? vc.subcategory_code;
        if (!groups.has(groupName)) groups.set(groupName, { general: false, subcats: [] });
        groups.get(groupName)!.subcats.push(subName);
      }
    }
    return groups;
  };

  const canEditDelete = (visit: Visit) =>
    isFullAccess || visit.user_id === currentUser.id;

  const handleDelete = async (visitId: string) => {
    if (!confirm('Delete this visit? This cannot be undone.')) return;
    try {
      await authedRequest('DELETE', `/api/visits/${visitId}`);
      setVisits(prev => prev.filter(v => v.id !== visitId));
      if (expandedVisit === visitId) setExpandedVisit(null);
    } catch (err) {
      console.error(err);
      alert('Failed to delete visit');
    }
  };

  const startEdit = (visit: Visit) => {
    setEditingVisitId(visit.id);
    setEditNotes(visit.notes ?? '');
    setEditType(visit.visit_type);
    setEditDate(isoToDisplay(visit.visit_date));
    setEditCategories(
      (visit.crm_visit_categories ?? []).map(vc => ({
        categoryCode: vc.category_code,
        subcategoryCode: vc.subcategory_code ?? undefined,
      }))
    );
  };

  const handleSaveEdit = async (visitId: string) => {
    setEditSaving(true);
    try {
      const updated = await authedRequest('PATCH', `/api/visits/${visitId}`, {
        notes: editNotes,
        visit_type: editType,
        visit_date: dateToISO(editDate),
        categories: editCategories,
      });
      setVisits(prev => prev.map(v => v.id === visitId ? updated : v));
      setEditingVisitId(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save visit');
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddComment = async (visitId: string) => {
    if (!newComment.trim()) return;
    setCommentSaving(true);
    try {
      const comment = await authedRequest('POST', `/api/visits/${visitId}/comments`, { comment: newComment });
      setVisits(prev => prev.map(v =>
        v.id === visitId
          ? { ...v, crm_visit_comments: [...(v.crm_visit_comments ?? []), comment] }
          : v
      ));
      setNewComment('');
      setCommentingVisitId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setCommentSaving(false);
    }
  };

  const handleMarkRead = async (visitId: string, commentId: string) => {
    try {
      await authedRequest('PATCH', `/api/visits/comments/${commentId}/read`);
      setVisits(prev => prev.map(v =>
        v.id === visitId
          ? {
              ...v,
              crm_visit_comments: v.crm_visit_comments.map(c =>
                c.id === commentId
                  ? { ...c, is_read: true, read_at: new Date().toISOString(), read_by_name: currentUser.name }
                  : c
              )
            }
          : v
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (visitId: string, commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await authedRequest('DELETE', `/api/visits/comments/${commentId}`);
      setVisits(prev => prev.map(v =>
        v.id === visitId
          ? { ...v, crm_visit_comments: v.crm_visit_comments.filter(c => c.id !== commentId) }
          : v
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const handleReply = async (visitId: string, commentId: string) => {
    if (!replyText.trim()) return;
    setReplySaving(true);
    try {
      await authedRequest('PATCH', `/api/visits/comments/${commentId}/reply`, { reply_text: replyText });
      setVisits(prev => prev.map(v =>
        v.id === visitId
          ? {
              ...v,
              crm_visit_comments: v.crm_visit_comments.map(c =>
                c.id === commentId
                  ? { ...c, reply_text: replyText, reply_at: new Date().toISOString() }
                  : c
              )
            }
          : v
      ));
      setReplyText('');
      setReplyingCommentId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setReplySaving(false);
    }
  };

  const totalUnread = visits.reduce((sum, v) =>
    sum + (v.crm_visit_comments ?? []).filter(c => !c.is_read).length, 0
  );

  const visitTypeOptions = ['in-person', 'phone', 'video', 'other'];

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div
        className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(prev => !prev)}
      >
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Visit Log
            {totalUnread > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs font-bold">
                <Bell className="w-3 h-3" />
                {totalUnread}
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {filteredVisits.length} visit{filteredVisits.length !== 1 ? 's' : ''}
            {hasActiveFilters ? ' (filtered)' : ` · ${visits.length} total`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          <button
            onClick={e => { e.stopPropagation(); onNewVisit(); }}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Visit
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          {/* Filters */}
          <div className="px-4 sm:px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Customer or notes..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500" />
              </div>
              <select value={selectedArea} onChange={e => { setSelectedArea(e.target.value); setSelectedCity(''); }}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="">All Areas</option>
                {areas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} disabled={!selectedArea}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                <option value="">All Cities</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="text-xs text-gray-400 mb-1">From</div>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-400 mb-1">To</div>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">Filters:</span>
                {searchQuery && <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">"{searchQuery}"</span>}
                {selectedArea && <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs">{selectedArea}</span>}
                {selectedCity && <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">{selectedCity}</span>}
                {dateFrom && <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">From {dateFrom}</span>}
                {dateTo && <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">To {dateTo}</span>}
                <button onClick={() => { setSearchQuery(''); setSelectedArea(''); setSelectedCity(''); setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline ml-1">Clear all</button>
              </div>
            )}
          </div>

          {/* Visit list */}
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading visits...</div>
            ) : filteredVisits.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                {hasActiveFilters ? 'No visits match your filters.' : 'No visits recorded yet.'}
              </div>
            ) : (
              filteredVisits.map(visit => {
                const customer = customerMap.get(visit.customer_code);
                const taskSummary = getTaskSummary(visit.crm_visit_tasks);
                const isExpanded = expandedVisit === visit.id;
                const visitCategories = visit.crm_visit_categories ?? [];
                const categoryGroups = groupVisitCategories(visitCategories);
                const comments = visit.crm_visit_comments ?? [];
                const unreadComments = comments.filter(c => !c.is_read);
                const isEditing = editingVisitId === visit.id;
                const isCommenting = commentingVisitId === visit.id;

                return (
                  <div key={visit.id}>
                    <button
                      onClick={() => setExpandedVisit(isExpanded ? null : visit.id)}
                      className="w-full px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-gray-900">{formatVisitDate(visit.visit_date)}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-sm font-medium text-blue-600">{customer?.name ?? visit.customer_code}</span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">{visit.customer_code}</span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{visit.visit_type}</span>
                            {visitCategories.length > 0 && (
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs flex items-center gap-1">
                                <Tag className="w-3 h-3" />
                                {visitCategories.length}
                              </span>
                            )}
                            {unreadComments.length > 0 && (
                              <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs flex items-center gap-1 font-bold">
                                <Bell className="w-3 h-3" />
                                {unreadComments.length} new
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-1">
                            {customer && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {customer.city}, {customer.area}
                              </span>
                            )}
                            {isFullAccess && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {visit.salesman_code}
                              </span>
                            )}
                          </div>
                          {visit.notes && (
                            <p className="text-sm text-gray-600 line-clamp-2">{visit.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {taskSummary.total > 0 && (
                            taskSummary.pending > 0 ? (
                              <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                                <AlertCircle className="w-3 h-3" />
                                {taskSummary.pending}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                <CheckCircle className="w-3 h-3" />
                              </span>
                            )
                          )}
                          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 sm:px-6 pb-5 pt-3 bg-blue-50 border-t border-blue-100 space-y-4">

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {canEditDelete(visit) && !isEditing && (
                            <>
                              <button onClick={() => startEdit(visit)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-50 transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button onClick={() => handleDelete(visit.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-600 rounded-lg text-xs hover:bg-red-50 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </>
                          )}
                          {isFullAccess && !isCommenting && (
                            <button onClick={() => { setCommentingVisitId(visit.id); setNewComment(''); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 text-blue-600 rounded-lg text-xs hover:bg-blue-50 transition-colors">
                              <MessageSquare className="w-3.5 h-3.5" />
                              Add Comment
                            </button>
                          )}
                        </div>

                        {/* Edit form */}
                        {isEditing && (
                          <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-4">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Edit Visit</div>
                            <SmartDateInput label="Date" value={editDate} onChange={setEditDate} hint={false} />
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Visit Type</label>
                              <select value={editType} onChange={e => setEditType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                                {visitTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-h-[80px]" />
                            </div>
                            <CategorySelector
                              allCategories={allCategories}
                              selected={editCategories}
                              onChange={setEditCategories}
                            />
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveEdit(visit.id)} disabled={editSaving}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                                {editSaving ? 'Saving...' : 'Save'}
                              </button>
                              <button onClick={() => setEditingVisitId(null)}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Visit Notes */}
                        {!isEditing && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Visit Notes</div>
                            <p className="text-sm text-gray-700 leading-relaxed">{visit.notes || '—'}</p>
                          </div>
                        )}

                        {/* Categories Discussed */}
                        {!isEditing && categoryGroups.size > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Categories Discussed ({visitCategories.length})
                            </div>
                            <div className="space-y-2">
                              {Array.from(categoryGroups.entries()).map(([parentName, { general, subcats }]) => (
                                <div key={parentName} className="bg-white rounded-lg px-3 py-2.5 border border-gray-200">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-gray-800">{parentName}</span>
                                    {general && (
                                      <span className="px-2 py-0.5 border border-dashed border-blue-400 text-blue-500 rounded text-xs">general</span>
                                    )}
                                  </div>
                                  {subcats.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {subcats.map(sub => (
                                        <span key={sub} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{sub}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tasks */}
                        {visit.crm_visit_tasks.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Tasks ({taskSummary.completed}/{taskSummary.total} completed)
                            </div>
                            <div className="space-y-2">
                              {visit.crm_visit_tasks.map(task => (
                                <div key={task.id} className="flex items-start gap-3 bg-white rounded-lg px-3 py-2.5 border border-gray-200">
                                  <div className="mt-0.5">
                                    {task.status === 'completed' ? <CheckCircle className="w-4 h-4 text-green-500" />
                                      : task.status === 'in-progress' ? <Clock className="w-4 h-4 text-orange-500" />
                                      : <AlertCircle className="w-4 h-4 text-gray-400" />}
                                  </div>
                                  <div className="flex-1">
                                    <p className={`text-sm ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                      {task.description}
                                    </p>
                                    {task.reminder_date && (
                                      <div className="text-xs text-gray-400 mt-0.5">Reminder: {task.reminder_date}</div>
                                    )}
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                                    task.status === 'completed' ? 'bg-green-100 text-green-700' :
                                    task.status === 'in-progress' ? 'bg-orange-100 text-orange-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {task.status === 'not-started' ? 'Not started' :
                                     task.status === 'in-progress' ? 'In progress' : 'Completed'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Comments */}
                        {(comments.length > 0 || isCommenting) && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                              Manager Comments
                              {unreadComments.length > 0 && (
                                <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">{unreadComments.length} unread</span>
                              )}
                            </div>
                            <div className="space-y-3">
                              {comments.map(comment => {
                                const isReplying = replyingCommentId === comment.id;
                                const isOwnComment = comment.user_id === currentUser.id;

                                return (
                                  <div key={comment.id} className={`rounded-lg border overflow-hidden ${!comment.is_read ? 'border-red-300' : 'border-gray-200'}`}>

                                    {/* Comment */}
                                    <div className={`px-3 py-2.5 ${!comment.is_read ? 'bg-red-50' : 'bg-white'}`}>
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="text-xs font-semibold text-gray-700">{comment.commenter_name}</span>
                                            <span className="text-xs text-gray-400">{formatDateTime(comment.created_at)}</span>
                                            {!comment.is_read && (
                                              <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs font-medium">New</span>
                                            )}
                                            {comment.is_read && comment.read_by_name && (
                                              <span className="text-xs text-green-600 flex items-center gap-1">
                                                ✅ Read by {comment.read_by_name}
                                                {comment.read_at && ` · ${formatDateTime(comment.read_at)}`}
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-sm text-gray-700">{comment.comment}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {!comment.is_read && visit.user_id === currentUser.id && comment.user_id !== currentUser.id && (
                                            <button
                                              onClick={() => handleMarkRead(visit.id, comment.id)}
                                              className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50"
                                            >
                                              ✅ Mark read
                                            </button>
                                          )}
                                          {isFullAccess && isOwnComment && (
                                            <button
                                              onClick={() => handleDeleteComment(visit.id, comment.id)}
                                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Existing reply */}
                                    {comment.reply_text && (
                                      <div className="px-3 py-2.5 bg-blue-50 border-t border-blue-100">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-semibold text-blue-700">↩ Reply</span>
                                          {comment.reply_at && (
                                            <span className="text-xs text-gray-400">{formatDateTime(comment.reply_at)}</span>
                                          )}
                                        </div>
                                        <p className="text-sm text-blue-800">{comment.reply_text}</p>
                                      </div>
                                    )}

                                    {/* Reply button — only for rep, after reading, no existing reply */}
                                    {!comment.reply_text && !isFullAccess && comment.is_read && !isReplying && (
                                      <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                                        <button
                                          onClick={() => { setReplyingCommentId(comment.id); setReplyText(''); }}
                                          className="text-xs text-blue-600 hover:text-blue-800"
                                        >
                                          ↩ Reply
                                        </button>
                                      </div>
                                    )}

                                    {/* Reply input */}
                                    {isReplying && (
                                      <div className="px-3 py-2.5 bg-gray-50 border-t border-gray-100 space-y-2">
                                        <textarea
                                          value={replyText}
                                          onChange={e => setReplyText(e.target.value)}
                                          placeholder="Write your reply..."
                                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                                        />
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => handleReply(visit.id, comment.id)}
                                            disabled={replySaving || !replyText.trim()}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium"
                                          >
                                            {replySaving ? 'Sending...' : 'Send Reply'}
                                          </button>
                                          <button
                                            onClick={() => { setReplyingCommentId(null); setReplyText(''); }}
                                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Add comment form */}
                        {isCommenting && (
                          <div className="bg-white rounded-lg p-3 border border-blue-200 space-y-2">
                            <div className="text-xs font-semibold text-gray-600">New Comment</div>
                            <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                              placeholder="Write a comment for the rep..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-h-[80px]" />
                            <div className="flex gap-2">
                              <button onClick={() => handleAddComment(visit.id)} disabled={commentSaving || !newComment.trim()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                                {commentSaving ? 'Sending...' : 'Send'}
                              </button>
                              <button onClick={() => { setCommentingVisitId(null); setNewComment(''); }}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}