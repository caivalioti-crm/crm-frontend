import { useState, useEffect } from 'react';
import { X, Plus, Phone, UserCheck, Video, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { SmartDateInput, dateToISO } from '../ui/SmartDateInput';
import { CategorySelector } from '../ui/CategorySelector';
import { VoiceMemo } from '../ui/VoiceMemo';
import { EntityProfileForm, EMPTY_SHOP_PROFILE, EMPTY_COMPETITION_INFO } from '../ui/EntityProfileForm';
import type { CategoryItem, SelectedCategory } from '../ui/CategorySelector';
import type { ShopProfile, CompetitionInfo } from '../../types/commercialEntity';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Task = {
  description: string;
  reminderDate?: string;
};

interface NewProspectVisitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  prospectId: string;
  prospectName: string;
  onSave: (visitData: any) => Promise<void>;
  isSaving?: boolean;
  error?: string | null;
}

const todayDisplay = () => {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
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

export function NewProspectVisitDialog({
  isOpen, onClose, prospectId, prospectName, onSave,
}: NewProspectVisitDialogProps) {
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && allCategories.length === 0) {
      authedFetch('/api/categories').then(setAllCategories).catch(console.error);
    }
  }, [isOpen]);

  const getReminderDate = (type: string): string => {
    const base = new Date();
    if (type === '1week') base.setDate(base.getDate() + 7);
    else if (type === '2weeks') base.setDate(base.getDate() + 14);
    else if (type === '1month') base.setMonth(base.getMonth() + 1);
    return base.toISOString().split('T')[0];
  };

  const handleAddTask = () => {
    if (!newTaskDescription.trim()) return;
    const task: Task = { description: newTaskDescription };
    if (newTaskReminderType === 'custom') {
      const reminderISO = newTaskCustomDate.match(/^\d{4}-\d{2}-\d{2}$/) ? newTaskCustomDate : dateToISO(newTaskCustomDate);
      const visitISO = dateToISO(visitDate);
      if (reminderISO && visitISO && reminderISO < visitISO) { setError(`Reminder cannot be before visit date`); return; }
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

  const handleSave = async () => {
    const isoDate = dateToISO(visitDate);
    if (!isoDate) { setError('Invalid date'); return; }
    setSaving(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const formData = new FormData();
      formData.append('prospect_id', prospectId);
      formData.append('visit_date', isoDate);
      formData.append('visit_time', visitTime || '');
      formData.append('visit_type', visitType);
      formData.append('notes', notes);
      formData.append('tasks', JSON.stringify(tasks));
      formData.append('categories', JSON.stringify(selectedCategories));
      formData.append('shop_profile', JSON.stringify({ ...shopProfile, shop_type: shopType || undefined }));
      formData.append('competition_info', JSON.stringify(competitionInfo));
      if (voiceMemoBlob) formData.append('voice_memo', voiceMemoBlob, 'memo.webm');

       const res = await fetch(`${BASE_URL}/api/prospects/${prospectId}/visits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      await onSave({});
      handleClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setNotes('');
    setTasks([]);
    setSelectedCategories([]);
    setNewTaskDescription('');
    setNewTaskReminderType('');
    setNewTaskCustomDate('');
    setVisitDate(todayDisplay());
    setShopProfile(EMPTY_SHOP_PROFILE);
    setCompetitionInfo(EMPTY_COMPETITION_INFO);
    setShopType('');
    setVoiceMemoBlob(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const visitTypeOptions = [
    { value: 'in-person', label: 'In Person', icon: UserCheck },
    { value: 'phone', label: 'Phone Call', icon: Phone },
    { value: 'video', label: 'Video Call', icon: Video },
    { value: 'other', label: 'Other', icon: MessageSquare },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-green-600 to-teal-700 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold">Νέα Επίσκεψη</h2>
            <p className="text-green-100 text-sm">{prospectName}</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <SmartDateInput label="Ημερομηνία *" value={visitDate} onChange={setVisitDate} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ώρα (προαιρετικό)</label>
              <input type="text" value={visitTime} onChange={e => setVisitTime(e.target.value)}
                placeholder="15:30"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          {/* Visit Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Τύπος Επαφής *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {visitTypeOptions.map(({ value, label, icon: Icon }) => (
                <button key={value} onClick={() => setVisitType(value as any)}
                  className={`px-4 py-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    visitType === value ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 hover:border-gray-400 text-gray-700'
                  }`}>
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <CategorySelector allCategories={allCategories} selected={selectedCategories} onChange={setSelectedCategories} />

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Σημειώσεις</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Σημειώσεις από την επίσκεψη..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 min-h-[100px]" />
          </div>

          {/* Voice Memo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Voice Memo (προαιρετικό)</label>
            <VoiceMemo onRecordingComplete={(blob) => setVoiceMemoBlob(blob)} />
          </div>

          {/* Entity Profile */}
          <EntityProfileForm
            shopProfile={shopProfile}
            competitionInfo={competitionInfo}
            onShopProfileChange={setShopProfile}
            onCompetitionInfoChange={setCompetitionInfo}
            shopType={shopType}
            onShopTypeChange={setShopType}
          />

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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                onKeyDown={e => e.key === 'Enter' && handleAddTask()} />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Reminder (optional)</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['1week', '2weeks', '1month', 'custom'] as const).map(type => (
                    <button key={type} onClick={() => setNewTaskReminderType(newTaskReminderType === type ? '' : type)}
                      className={`px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                        newTaskReminderType === type ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}>
                      {type === '1week' ? '1 Week' : type === '2weeks' ? '2 Weeks' : type === '1month' ? '1 Month' : 'Choose Date'}
                    </button>
                  ))}
                </div>
                {newTaskReminderType === 'custom' && (
                  <div className="mt-2">
                    <input type="date" value={newTaskCustomDate} onChange={e => setNewTaskCustomDate(e.target.value)}
                      min={dateToISO(visitDate) ?? undefined}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
                  </div>
                )}
              </div>
              <button onClick={handleAddTask} disabled={!newTaskDescription.trim()}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium">
                <Plus className="w-4 h-4" />
                Add Task
              </button>
            </div>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>

        <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 sticky bottom-0">
          <button onClick={handleClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
            Άκυρο
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium">
            {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
          </button>
        </div>
      </div>
    </div>
  );
}