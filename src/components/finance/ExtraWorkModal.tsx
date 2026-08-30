import React, { useState, useEffect } from 'react';
import { ExtraWorkItem } from '../../types';
import { useTasks } from '../../context/TaskContext';
import { IndianRupee, X, Check } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  item: ExtraWorkItem | null;
  onClose: () => void;
}

export const ExtraWorkModal: React.FC<Props> = ({ isOpen, item, onClose }) => {
  const { clients, team, addExtraWork, updateExtraWork } = useTasks();
  const isEditing = !!item;

  useEscapeKey(onClose, isOpen);

  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [taskTitle, setTaskTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Income Tax Notice');
  const [agreedFee, setAgreedFee] = useState<number>(15000);
  const [advanceReceived, setAdvanceReceived] = useState<number>(5000);
  const [status, setStatus] = useState<'PENDING' | 'IN_PROGRESS' | 'BILLED' | 'SETTLED'>('IN_PROGRESS');
  const [assignedTeamId, setAssignedTeamId] = useState('');
  const [targetCompletionDate, setTargetCompletionDate] = useState('2026-09-15');

  useEffect(() => {
    if (item) {
      setClientId(item.clientId || clients[0]?.id || '');
      setTaskTitle(item.taskTitle || '');
      setDescription(item.description || '');
      setCategory(item.category || 'Income Tax Notice');
      setAgreedFee(item.agreedFee ?? 15000);
      setAdvanceReceived(item.advanceReceived ?? 0);
      setStatus(item.status || 'IN_PROGRESS');
      setAssignedTeamId(item.assignedTeamId || '');
      setTargetCompletionDate(item.targetCompletionDate || '2026-09-15');
    } else {
      setClientId(clients[0]?.id || '');
      setTaskTitle('');
      setDescription('');
      setCategory('Income Tax Notice');
      setAgreedFee(15000);
      setAdvanceReceived(0);
      setStatus('IN_PROGRESS');
      setAssignedTeamId('');
      setTargetCompletionDate('2026-09-15');
    }
  }, [item, clients]);

  if (!isOpen) return null;

  const balanceDue = Number(agreedFee) - Number(advanceReceived);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selClient = clients.find(c => c.id === clientId);
    const selTeam = team.find(t => t.id === assignedTeamId);

    const payload = {
      clientId,
      clientName: selClient?.tradeName || 'Client',
      taskTitle: taskTitle.trim(),
      description: description.trim(),
      category: category.trim(),
      agreedFee: Number(agreedFee),
      advanceReceived: Number(advanceReceived),
      balanceDue,
      status,
      assignedTeamId: assignedTeamId || '',
      assignedTeamName: selTeam ? selTeam.name : 'Unassigned',
      targetCompletionDate,
    };

    if (isEditing && item) {
      updateExtraWork(item.id, payload);
    } else {
      addExtraWork(payload);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in zoom-in-95 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-amber-400/40 rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          title="Close"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <IndianRupee size={22} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">
              {isEditing ? ('Edit Billable Assignment: ' + (item ? item.taskTitle : '')) : 'Record New Extra Billable Assignment'}
            </h3>
            <p className="text-xs text-slate-500">
              Update billing fees, advance receipt, assigned staff & status
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Select Client *</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.tradeName} ({c.pan})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Assignment / Service Title *</label>
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. IT Notice u/s 148 Assessment Reply"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Category / Work Type</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Income Tax Assessment / ROC Search Report"
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Assigned Partner / Staff</label>
              <select
                value={assignedTeamId}
                onChange={(e) => setAssignedTeamId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
              >
                <option value="">-- None / Unassigned (Blank) --</option>
                {team.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.designation})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Description / Scope of Work</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope of work, key deliverables or terms agreed..."
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Financials Row */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <h4 className="font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <IndianRupee size={14} className="text-amber-600" /> Commercial & Billing Details
            </h4>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Agreed Fee (₹) *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={agreedFee}
                  onChange={(e) => setAgreedFee(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Advance Received (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={advanceReceived}
                  onChange={(e) => setAdvanceReceived(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Balance Due (₹)</label>
                <div className="w-full px-3 py-2 rounded-xl bg-amber-50 dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 text-xs font-mono font-bold">
                  ₹{balanceDue.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Execution Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold"
              >
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="PENDING">PENDING</option>
                <option value="BILLED">BILLED</option>
                <option value="SETTLED">SETTLED (Paid in Full)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Target Completion Date</label>
              <input
                type="date"
                value={targetCompletionDate}
                onChange={(e) => setTargetCompletionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-300 dark:border-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 flex items-center gap-1.5"
            >
              <Check size={16} /> {isEditing ? 'Save Changes' : 'Record Assignment'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
