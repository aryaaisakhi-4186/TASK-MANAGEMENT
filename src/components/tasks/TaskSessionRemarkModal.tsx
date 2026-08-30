import React, { useState, useEffect } from 'react';
import { TaskItem, TaskStatus } from '../../types';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Check, X, FileText, Clock, Building, CheckCircle2, MessageSquare, UserCheck } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  task: TaskItem | null;
  durationSeconds: number;
  onClose: () => void;
  onConfirmSave: (remarks: string, status: TaskStatus, handoverInfo?: { assigneeId: string; assigneeName: string; nextTaskTitle: string; handoverNotes: string }) => void;
}

export const TaskSessionRemarkModal: React.FC<Props> = ({
  isOpen,
  task,
  durationSeconds,
  onClose,
  onConfirmSave
}) => {
  const { team, addTask } = useTasks();
  const { currentUser } = useAuth();

  const [remarks, setRemarks] = useState('');
  const [targetStatus, setTargetStatus] = useState<TaskStatus>('DONE');
  
  // Handover / Delegation State
  const [enableHandover, setEnableHandover] = useState(false);
  const [nextAssigneeId, setNextAssigneeId] = useState('admin');
  const [nextTaskTitle, setNextTaskTitle] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');

  useEscapeKey(onClose, isOpen);

  useEffect(() => {
    if (task) {
      setRemarks('');
      setTargetStatus('DONE');
      setEnableHandover(false);
      setNextAssigneeId('admin');
      setNextTaskTitle(`[Review & Verification] ${task.title}`);
      setHandoverNotes('');
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const minutesWorked = Math.max(1, Math.round(durationSeconds / 60));
  const hrs = Math.floor(durationSeconds / 3600);
  const mins = Math.floor((durationSeconds % 3600) / 60);
  const secs = durationSeconds % 60;
  const timeFormatted = hrs > 0 
    ? `${hrs}h ${mins}m ${secs}s`
    : `${mins}m ${secs}s (${durationSeconds}s)`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let handoverData: any = undefined;
    if (enableHandover && nextAssigneeId) {
      let assigneeName = 'Managing Partner (Admin)';
      if (nextAssigneeId !== 'admin') {
        const found = team.find(m => m.id === nextAssigneeId);
        if (found) assigneeName = found.name;
      }

      handoverData = {
        assigneeId: nextAssigneeId,
        assigneeName,
        nextTaskTitle: nextTaskTitle.trim() || `[Next Stage] ${task.title}`,
        handoverNotes: handoverNotes.trim() || remarks.trim()
      };

      // Automatically create the follow-up task in Task Matrix assigned to Admin/Manager
      addTask({
        clientId: task.clientId,
        clientName: task.clientName,
        title: handoverData.nextTaskTitle,
        description: `[Handed over by ${currentUser?.name || 'Staff'}] ${handoverData.handoverNotes}`,
        category: task.category,
        frequency: task.frequency,
        dueDayOrDate: task.dueDayOrDate,
        dueDate: task.dueDate,
        status: 'PENDING',
        assignedTeamId: nextAssigneeId,
        assignedTeamName: assigneeName,
        priority: 'HIGH',
        financialYear: task.financialYear,
        period: task.period
      });
    }

    onConfirmSave(remarks.trim(), targetStatus, handoverData);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in zoom-in-95 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          title="Close"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <MessageSquare size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-serif">
              Session Completion & Handover
            </h3>
            <p className="text-xs text-slate-500">
              Log work done and optionally delegate next stage to Admin/Manager
            </p>
          </div>
        </div>

        {/* Task & Time Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1 font-medium">
              <Building size={13} className="text-amber-500" /> Client:
            </span>
            <strong className="text-slate-900 dark:text-white font-bold">{task.clientName}</strong>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1 font-medium">
              <FileText size={13} className="text-blue-500" /> Task:
            </span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">{task.title}</span>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 flex items-center gap-1 font-medium">
              <Clock size={13} className="text-emerald-500" /> Time Logged:
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold font-mono">
              {timeFormatted} ({minutesWorked} mins)
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Work Remarks Field */}
          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
              <span>Work Done Remarks *</span>
              <span className="text-[10px] text-slate-400 font-normal">Saves in Attendance Log</span>
            </label>
            <textarea
              required
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter work details (e.g. Prepared computation, verified bank debits, reconciled 26AS)..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Handover / Delegation to Admin or Manager Toggle */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableHandover}
                  onChange={(e) => setEnableHandover(e.target.checked)}
                  className="rounded border-amber-400 text-amber-500 focus:ring-amber-400"
                />
                <span className="font-bold text-amber-900 dark:text-amber-300 text-xs flex items-center gap-1.5">
                  <UserCheck size={14} className="text-amber-600" /> Assign / Delegate next stage to Admin or Manager?
                </span>
              </label>
            </div>

            {enableHandover && (
              <div className="space-y-2.5 pt-2 border-t border-amber-500/20 animate-in fade-in">
                
                {/* Next Assignee Dropdown */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Select Next Assignee (Reviewer / Partner):
                  </label>
                  <select
                    value={nextAssigneeId}
                    onChange={(e) => setNextAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
                  >
                    <option value="admin">Managing Partner (Admin)</option>
                    {team.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.designation || 'Staff Associate'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Next Task Title */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Follow-Up Task Title (Auto-creates in Task Matrix):
                  </label>
                  <input
                    type="text"
                    required={enableHandover}
                    value={nextTaskTitle}
                    onChange={(e) => setNextTaskTitle(e.target.value)}
                    placeholder="e.g. [Review & Final Approval] GSTR-3B Return"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none font-semibold"
                  />
                </div>

                {/* Handover Instructions */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Instructions for Next Assignee:
                  </label>
                  <input
                    type="text"
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="e.g. Please review tax liability and approve portal OTP submission"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-300 dark:border-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Check size={16} /> Save & {enableHandover ? 'Delegate Next Task' : 'Log Work'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
