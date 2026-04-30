import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Plus, Phone, UserCheck, Video, MessageSquare, Search } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { SmartDateInput, dateToISO } from '../ui/SmartDateInput';
import { CategorySelector } from '../ui/CategorySelector';
import type { SelectedCategory, CategoryItem } from '../ui/CategorySelector';

const BASE_URL = 'http://localhost:3001';

type Customer = {
  code: string;
  name: string;
  city?: string;
  area?: string;
};

type Task = {
  description: string;
  reminderDate?: string;
};

type NewVisitDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onSave?: () => void;
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

const todayDisplay = () => {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
};

export function NewVisitDialog({ isOpen, onClose, customers, onSave }: NewVisitDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const [selectedCustomerCode, setSelectedCustomerCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterCity, setFilterCity] = useState('');
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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<SelectedCategory[]>([]);

  useEffect(() => {
    if (isOpen && allCategories.length === 0) {
      authedFetch('/api/categories').then(setAllCategories).catch(console.error);
    }
  }, [isOpen]);

  const areas = useMemo(() =>
    [...new Set(customers.map(c => c.area).filter(Boolean))].sort() as string[], [customers]);

  const cities = useMemo(() => {
    const filtered = filterArea ? customers.filter(c => c.area === filterArea) : customers;
    return [...new Set(filtered.map(c => c.city).filter(Boolean))].sort() as string[];
  }, [customers, filterArea]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (filterArea && c.area !== filterArea) return false;
      if (filterCity && c.city !== filterCity) return false;
      if (searchQuery.length >= 3) {
        const q = searchQuery.toLowerCase();
        return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [customers, searchQuery, filterArea, filterCity]);

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
      const reminderISO = dateToISO(newTaskCustomDate);
      const visitISO = dateToISO(visitDate);
      if (reminderISO && visitISO && reminderISO < visitISO) {
        setError(`Reminder date cannot be before the visit date (${visitDate})`);
        return;
      }
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
    if (!selectedCustomerCode) { setError('Please select a customer'); return; }
    const isoDate = dateToISO(visitDate);
    if (!isoDate) { setError('Invalid date — use dd/mm/yyyy or dd/mm/yy'); return; }

    const invalidTask = tasks.find(t => t.reminderDate && t.reminderDate < isoDate);
    if (invalidTask) {
      setError(`Task reminder "${invalidTask.description}" is before the visit date (${visitDate})`);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await authedPost('/api/visits', {
        customer_code: selectedCustomerCode,
        visit_date: isoDate,
        visit_time: visitTime || null,
        visit_type: visitType,
        notes,
        tasks,
        categories: selectedCategories,
      });
      onSave?.();
      handleClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedCustomerCode('');
    setSearchQuery('');
    setFilterArea('');
    setFilterCity('');
    setNotes('');
    setTasks([]);
    setSelectedCategories([]);
    setNewTaskDescription('');
    setNewTaskReminderType('');
    setNewTaskCustomDate('');
    setVisitDate(todayDisplay());
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
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-bold">New Visit</h2>
          <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Customer Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Select Customer *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by code or name (min 3 characters)..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={filterArea} onChange={e => { setFilterArea(e.target.value); setFilterCity(''); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">All Areas</option>
                {areas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filterCity} onChange={e => setFilterCity(e.target.value)} disabled={!filterArea}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                <option value="">All Cities</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
              {filteredCustomers.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-500 text-sm">
                  {searchQuery.length > 0 && searchQuery.length < 3 ? 'Type at least 3 characters to search' : 'No customers found'}
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredCustomers.map(c => (
                    <button key={c.code} onClick={() => setSelectedCustomerCode(c.code)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                        selectedCustomerCode === c.code ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                      }`}>
                      <div className="font-medium text-gray-900 text-sm">
                        <span className="text-blue-600">{c.code}</span> — {c.name}
                      </div>
                      {c.city && <div className="text-xs text-gray-500">{c.city}{c.area ? `, ${c.area}` : ''}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedCustomerCode && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-800">
                Selected: {customers.find(c => c.code === selectedCustomerCode)?.name}
              </div>
            )}
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <SmartDateInput label="Date *" value={visitDate} onChange={setVisitDate} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time (optional, 24h)</label>
              <input type="text" value={visitTime} onChange={e => setVisitTime(e.target.value)}
                placeholder="15:30"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Visit Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Visit Type *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {visitTypeOptions.map(({ value, label, icon: Icon }) => (
                <button key={value} onClick={() => setVisitType(value as any)}
                  className={`px-4 py-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    visitType === value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-gray-400 text-gray-700'
                  }`}>
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <CategorySelector
            allCategories={allCategories}
            selected={selectedCategories}
            onChange={setSelectedCategories}
          />

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Visit Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Enter notes about the visit..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[100px]" />
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleAddTask()} />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Reminder (optional)</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['1week', '2weeks', '1month', 'custom'] as const).map(type => (
                    <button key={type} onClick={() => setNewTaskReminderType(newTaskReminderType === type ? '' : type)}
                      className={`px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                        newTaskReminderType === type ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}>
                      {type === '1week' ? '1 Week' : type === '2weeks' ? '2 Weeks' : type === '1month' ? '1 Month' : 'Choose Date'}
                    </button>
                  ))}
                </div>
                {newTaskReminderType === 'custom' && (
                  <div className="mt-2">
                    <SmartDateInput value={newTaskCustomDate} onChange={setNewTaskCustomDate} hint={true} minDate={visitDate} />
                  </div>
                )}
              </div>
              <button onClick={handleAddTask} disabled={!newTaskDescription.trim()}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium">
                <Plus className="w-4 h-4" />
                Add Task
              </button>
            </div>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 sticky bottom-0">
          <button onClick={handleClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isSaving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium">
            {isSaving ? 'Saving...' : 'Save Visit'}
          </button>
        </div>
      </div>
    </div>
  );
}