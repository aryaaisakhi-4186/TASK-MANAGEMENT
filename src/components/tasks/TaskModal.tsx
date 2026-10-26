import React, { useState, useEffect } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { TaskItem, ComplianceCategory, TaskFrequency, TaskStatus } from '../../types';
import { X, Calendar, Copy, User, Tag, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface TaskModalProps {
  isOpen: boolean;
  task?: TaskItem | null;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, task, onClose }) => {
  const { clients, team, addTask, updateTask, deleteTask } = useTasks();
  const { currentUser } = useAuth();

  // Escape key handler
  useEscapeKey(onClose, isOpen);

  const isEditing = !!task;

  const [clientId, setClientId] = useState(task?.clientId || clients[0]?.id || '');
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [category, setCategory] = useState<ComplianceCategory>(task?.category || 'GST');
  const [frequency, setFrequency] = useState<TaskFrequency>(task?.frequency || 'MONTHLY');
  const [dueDayOrDate, setDueDayOrDate] = useState(task?.dueDayOrDate || '20');
  const [dueDate, setDueDate] = useState(task?.dueDate || new Date().toISOString().split('T')[0]);
  const [assignedTeamId, setAssignedTeamId] = useState(task?.assignedTeamId || team[0]?.id || '');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'PENDING');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>(task?.priority || 'HIGH');
  const [financialYear, setFinancialYear] = useState(task?.financialYear || '2026-2027');

  useEffect(() => {
    if (task) {
      setClientId(task.clientId);
      setTitle(task.title);
      setDescription(task.description || '');
      setCategory(task.category);
      setFrequency(task.frequency);
      setDueDayOrDate(task.dueDayOrDate);
      setDueDate(task.dueDate);
      setAssignedTeamId(task.assignedTeamId);
      setStatus(task.status);
      setPriority(task.priority);
      setFinancialYear(task.financialYear);
    } else {
      setClientId(clients[0]?.id || '');
      setTitle('');
      setDescription('');
      setCategory('GST');
      setFrequency('MONTHLY');
      const today = new Date().toISOString().split('T')[0];
      setDueDate(today);
      const dayNum = parseInt(today.split('-')[2] || '20', 10);
      setDueDayOrDate(Math.max(1, dayNum - 5).toString());
      setAssignedTeamId(team[0]?.id || '');
      setStatus('PENDING');
      setPriority('HIGH');
      setFinancialYear('2026-2027');
    }
  }, [task, clients, team]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedClient = clients.find(c => c.id === clientId);
    const selectedTeamMember = team.find(t => t.id === assignedTeamId);

    const taskPayload = {
      clientId,
      clientName: selectedClient?.tradeName || 'Client',
      title,
      description,
      category,
      frequency,
      dueDayOrDate,
      dueDate,
      status,
      assignedTeamId,
      assignedTeamName: selectedTeamMember?.name || 'Staff',
      priority,
      financialYear,
      period: frequency === 'MONTHLY' ? `Month: ${dueDayOrDate}` : frequency,
      completedAt: status === 'DONE' ? new Date().toISOString() : undefined,
      completedBy: status === 'DONE' ? currentUser?.name : undefined,
    };

    if (isEditing && task) {
      updateTask(task.id, taskPayload);
    } else {
      addTask(taskPayload);
    }
    onClose();
  };

  const handleDelete = () => {
    if (task && window.confirm('Are you sure you want to delete this compliance task?')) {
      deleteTask(task.id);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-hidden overscroll-none select-none animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-amber-400/40 rounded-3xl p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto overflow-x-hidden select-text"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          title="Close" 
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="mb-4 select-none">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-serif flex items-center gap-2">
            {isEditing ? 'Edit Statutory Compliance Task' : 'Create New Statutory Task'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure compliance parameters, statutory deadlines & staff assignments
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Client Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Select Client Entity</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none shadow-sm"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.tradeName} ({c.pan})
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Compliance Task Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. GSTR-3B Monthly Return Filing"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none shadow-sm"
            />
          </div>

          {/* Category & Frequency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplianceCategory)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold"
              >
                <option value="GST">GST Compliance</option>
                <option value="VAT">VAT / State Tax</option>
                <option value="TDS">TDS / TCS</option>
                <option value="INCOME_TAX">Income Tax</option>
                <option value="AUDIT">Tax & Statutory Audit</option>
                <option value="ROC">ROC / MCA Filings</option>
                <option value="BOOKKEEPING">Bookkeeping / Accounting</option>
                <option value="PF_ESIC">PF & ESIC</option>
                <option value="ADVANCE_TAX">Advance Tax</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => {
                  const newFreq = e.target.value as TaskFrequency;
                  setFrequency(newFreq);
                  if (newFreq === 'DAILY') {
                    setDueDayOrDate('Daily');
                  } else if ((newFreq === 'MONTHLY' || newFreq === 'QUARTERLY') && dueDate) {
                    const day = parseInt(dueDate.split('-')[2] || '0', 10);
                    if (day > 0) {
                      setDueDayOrDate(Math.max(1, day - 5).toString());
                    }
                  }
                }}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold"
              >
                <option value="DAILY">Daily (Daily Task)</option>
                <option value="WEEKLY">Weekly (Days)</option>
                <option value="MONTHLY">Monthly (Specific Date)</option>
                <option value="QUARTERLY">Quarterly (After Quarter End)</option>
                <option value="YEARLY">Yearly (Annual Due Date)</option>
                <option value="ONE_TIME">One-Time Assignment</option>
              </select>
            </div>
          </div>

          {/* Quick Frequency & Filing Presets for GST and VAT */}
          {category === 'VAT' && (
            <div className="p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-1.5 animate-in fade-in duration-150">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block">
                ⚡ VAT Preset Options (Quarterly / Yearly Return & Monthly Tax)
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setTitle('VAT Quarterly Return Filing');
                    setFrequency('QUARTERLY');
                    setDueDate('2026-10-30');
                    setDueDayOrDate('25');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-[11px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shadow-xs"
                >
                  📄 VAT Return (Quarterly - 30th / Rule 25)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle('VAT Annual Return Filing');
                    setFrequency('YEARLY');
                    setDueDate('2027-04-30');
                    setDueDayOrDate('25');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-[11px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shadow-xs"
                >
                  📅 VAT Return (Yearly - 30th / Rule 25)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle('Monthly VAT Tax Payment');
                    setFrequency('MONTHLY');
                    setDueDate('2026-09-10');
                    setDueDayOrDate('5');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-[11px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shadow-xs"
                >
                  💰 Monthly VAT Tax Payment (10th / Rule 5)
                </button>
              </div>
            </div>
          )}

          {category === 'GST' && (
            <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1.5 animate-in fade-in duration-150">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 block">
                ⚡ GST Preset Options (Monthly / Quarterly QRMP / GSTR-9 / 9C)
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setTitle('GSTR-1 Monthly Outward Return');
                    setFrequency('MONTHLY');
                    setDueDate('2026-09-11');
                    setDueDayOrDate('6');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-xs"
                >
                  GSTR-1 (Monthly - 11th)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle('GSTR-1 Quarterly Return (QRMP Scheme)');
                    setFrequency('QUARTERLY');
                    setDueDate('2026-10-13');
                    setDueDayOrDate('8');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-xs"
                >
                  GSTR-1 (Quarterly / QRMP - 13th)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle('GSTR-3B Monthly Return & Tax Settlement');
                    setFrequency('MONTHLY');
                    setDueDate('2026-09-20');
                    setDueDayOrDate('15');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-xs"
                >
                  GSTR-3B (Monthly - 20th)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle('GSTR-3B Quarterly Return (QRMP Scheme)');
                    setFrequency('QUARTERLY');
                    setDueDate('2026-10-22');
                    setDueDayOrDate('17');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-xs"
                >
                  GSTR-3B (Quarterly / QRMP - 22nd)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle('GSTR-9 Annual Return');
                    setFrequency('YEARLY');
                    setDueDate('2026-12-31');
                    setDueDayOrDate('26');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-xs"
                >
                  GSTR-9 (Annual Return - 31 Dec)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle('GSTR-9C Reconciliation Statement & Audit Certification');
                    setFrequency('YEARLY');
                    setDueDate('2026-12-31');
                    setDueDayOrDate('26');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-xs"
                >
                  GSTR-9C (Reconciliation / Audit - 31 Dec)
                </button>
              </div>
            </div>
          )}

          {/* Due Rule & Due Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">Due Rule / Day</label>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                  {frequency === 'MONTHLY' || frequency === 'QUARTERLY' ? '5 Days Prior' : frequency === 'DAILY' ? 'Daily' : ''}
                </span>
              </div>
              <input
                type="text"
                value={dueDayOrDate}
                onChange={(e) => setDueDayOrDate(e.target.value)}
                placeholder={frequency === 'DAILY' ? 'Daily' : 'e.g. 5, 6, 15, 25, Daily'}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Target Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setDueDate(newDate);
                  if ((frequency === 'MONTHLY' || frequency === 'QUARTERLY') && newDate) {
                    const day = parseInt(newDate.split('-')[2] || '0', 10);
                    if (day > 0) {
                      setDueDayOrDate(Math.max(1, day - 5).toString());
                    }
                  } else if (frequency === 'DAILY') {
                    setDueDayOrDate('Daily');
                  }
                }}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold"
              >
                <option value="PENDING">PENDING</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="DONE">COMPLETED (DONE)</option>
                <option value="NOT_APPLICABLE">NOT APPLICABLE</option>
              </select>
            </div>
          </div>

          {/* Assigned Staff & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Assigned Team Member</label>
              <select
                value={assignedTeamId}
                onChange={(e) => setAssignedTeamId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
              >
                <option value="">-- None / Unassigned (Blank) --</option>
                {team.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.designation || 'Staff'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Description & Statutory Notes</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide filing instructions or challan details..."
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white text-xs font-bold transition-all"
              >
                Delete Task
              </button>
            ) : <div></div>}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-300 dark:border-slate-700"
              >
                Cancel <span className="text-[10px] text-slate-400 font-mono"></span>
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
              >
                {isEditing ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
