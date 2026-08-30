import React, { useState, useMemo } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { TaskItem, TaskStatus, TaskPriority } from '../../types';
import { 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowUpRight, 
  Flame, 
  Calendar, 
  Building, 
  User, 
  CheckCheck,
  AlertTriangle
} from 'lucide-react';
import { GlassCard } from '../common/GlassCard';

export const TodayTomorrowFocus: React.FC<{ onOpenTaskModal: (task: TaskItem) => void }> = ({ onOpenTaskModal }) => {
  const { tasks, updateTaskStatus } = useTasks();
  const { currentRole, currentUser } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CRITICAL' | 'PENDING' | 'IN_PROGRESS'>('ALL');

  const roleFiltered = (currentRole === 'TEAM' && currentUser)
    ? tasks.filter(t => t.assignedTeamId === currentUser.id)
    : tasks;

  // Sorting: 1. Priority (CRITICAL -> HIGH -> MEDIUM -> LOW)
  //          2. Due Date (Earliest / Nearest deadline first)
  //          3. Status (Actionable Pending/In-Progress first, Done last)
  const priorityWeight: Record<TaskPriority, number> = {
    'CRITICAL': 1,
    'HIGH': 2,
    'MEDIUM': 3,
    'LOW': 4
  };

  const sortedAndFilteredTasks = useMemo(() => {
    return [...roleFiltered]
      .filter(t => {
        if (activeFilter === 'CRITICAL') return t.priority === 'CRITICAL' || t.priority === 'HIGH';
        if (activeFilter === 'PENDING') return t.status === 'PENDING';
        if (activeFilter === 'IN_PROGRESS') return t.status === 'IN_PROGRESS';
        return true;
      })
      .sort((a, b) => {
        // Status: Active tasks before Done
        const aDone = a.status === 'DONE' ? 1 : 0;
        const bDone = b.status === 'DONE' ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;

        // 1. Priority: CRITICAL (1) -> HIGH (2) -> MEDIUM (3) -> LOW (4)
        const pA = priorityWeight[a.priority] || 3;
        const pB = priorityWeight[b.priority] || 3;
        if (pA !== pB) return pA - pB;

        // 2. Due Date: Early deadline first
        // If daily frequency, place at highest urgency
        if (a.frequency === 'DAILY' && b.frequency !== 'DAILY') return -1;
        if (b.frequency === 'DAILY' && a.frequency !== 'DAILY') return 1;

        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
        if (dateA !== dateB) return dateA - dateB;

        // Compare dueDayOrDate numeric rule if string (e.g. 7 vs 11 vs 20)
        const numA = parseInt(a.dueDayOrDate, 10);
        const numB = parseInt(b.dueDayOrDate, 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;

        return a.clientName.localeCompare(b.clientName);
      });
  }, [roleFiltered, activeFilter]);

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 text-[10px] font-black tracking-wider shadow-sm animate-pulse">
            <Flame size={11} className="text-red-600 fill-red-500" /> CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold">
            <AlertTriangle size={10} className="text-amber-600" /> HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[10px] font-semibold">
            MEDIUM
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium">
            LOW
          </span>
        );
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'DONE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-bold">
            <CheckCircle2 size={11} /> DONE
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg font-bold">
            <Clock size={11} /> IN PROGRESS
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 px-2.5 py-1 rounded-lg font-bold">
            <AlertCircle size={11} /> PENDING
          </span>
        );
      default:
        return (
          <span className="text-[10px] bg-slate-500/20 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-lg font-bold">
            N/A
          </span>
        );
    }
  };

  const cycleStatus = (task: TaskItem) => {
    const sequence: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE', 'NOT_APPLICABLE'];
    const currIdx = sequence.indexOf(task.status);
    const nextStatus = sequence[(currIdx + 1) % sequence.length];
    updateTaskStatus(task.id, nextStatus, currentUser?.name || 'Staff');
  };

  return (
    <GlassCard className="p-5" variant="elevated">
      
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Sparkles size={16} />
            </span>
            <h3 className="font-bold text-slate-900 dark:text-white text-base font-serif">
              Today's Statutory Focus & Upcoming Deadlines
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Prioritized by Urgency: <strong className="text-red-600 dark:text-red-400">High to Low Priority</strong> • <strong className="text-amber-600 dark:text-amber-400">Early Due Dates First</strong> ({sortedAndFilteredTasks.length} Actionable Items)
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${activeFilter === 'ALL' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            All Actionable
          </button>
          <button
            onClick={() => setActiveFilter('CRITICAL')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${activeFilter === 'CRITICAL' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Critical & High
          </button>
          <button
            onClick={() => setActiveFilter('IN_PROGRESS')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${activeFilter === 'IN_PROGRESS' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            In Progress
          </button>
          <button
            onClick={() => setActiveFilter('PENDING')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${activeFilter === 'PENDING' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Pending Only
          </button>
        </div>
      </div>

      {/* Structured List Table Format */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/80 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <th className="p-3 w-28">Priority</th>
              <th className="p-3">Client & Entity</th>
              <th className="p-3">Compliance Task</th>
              <th className="p-3">Category</th>
              <th className="p-3">Due Rule / Date</th>
              <th className="p-3">Assigned Staff</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {sortedAndFilteredTasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  <CheckCheck size={28} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                  <p className="font-bold text-slate-700 dark:text-slate-300">All compliance tasks in this filter are up to date!</p>
                  <p className="text-[11px] mt-0.5">Switch filter to "All Actionable" to view complete list.</p>
                </td>
              </tr>
            ) : (
              sortedAndFilteredTasks.map((task, idx) => (
                <tr
                  key={task.id}
                  className="hover:bg-amber-50/40 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  
                  {/* Priority Column */}
                  <td className="p-3">
                    {getPriorityBadge(task.priority)}
                  </td>

                  {/* Client Column */}
                  <td className="p-3">
                    <p className="font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                      {task.clientName}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">{task.financialYear} • {task.period || 'General'}</p>
                  </td>

                  {/* Task Title & Description */}
                  <td className="p-3">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{task.title}</p>
                    {task.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">{task.description}</p>
                    )}
                  </td>

                  {/* Category */}
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-bold border border-slate-200 dark:border-slate-700">
                      {task.category}
                    </span>
                  </td>

                  {/* Due Rule & Earliest Date */}
                  <td className="p-3 font-mono">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                      <Calendar size={11} className="text-amber-500" /> {task.dueDayOrDate}
                    </span>
                    <p className="text-[10px] text-slate-500">{task.dueDate}</p>
                  </td>

                  {/* Assigned Staff */}
                  <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                    {task.assignedTeamName}
                  </td>

                  {/* Status Cycle Button */}
                  <td className="p-3 text-center">
                    <button
                      onClick={() => cycleStatus(task)}
                      title="Click to toggle status"
                      className="cursor-pointer transition-transform active:scale-95 inline-block"
                    >
                      {getStatusBadge(task.status)}
                    </button>
                  </td>

                  {/* Actions (Mark Done / Open Modal) */}
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {task.status !== 'DONE' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'DONE', currentUser?.name || 'Staff')}
                          title="Mark this task as completed"
                          className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-700 dark:text-emerald-300 hover:text-white text-[11px] font-bold transition-all border border-emerald-500/30"
                        >
                          ✓ Done
                        </button>
                      )}
                      <button
                        onClick={() => onOpenTaskModal(task)}
                        title="View Full Task Details"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-all"
                      >
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </td>

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </GlassCard>
  );
};
