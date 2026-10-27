import React, { useState, useMemo, useRef } from 'react';
import { 
  CalendarCheck2, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Building, 
  ArrowUpRight, 
  Calendar,
  AlertTriangle,
  Flame,
  Sparkles,
  CheckCheck,
  Copy,
  Edit3,
  Search,
  X,
  ArrowUp,
  Maximize2,
  Minimize2,
  Filter
} from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { TaskItem, TaskPriority, TaskStatus, Client } from '../../types';

export const TodayTomorrowFocus: React.FC<{ onOpenTaskModal: (task: TaskItem) => void }> = ({ onOpenTaskModal }) => {
  const { tasks, clients, updateTaskStatus, addTask } = useTasks();
  const { currentRole, currentUser } = useAuth();
  
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CRITICAL' | 'PENDING' | 'IN_PROGRESS'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [heightMode, setHeightMode] = useState<'EXPANDED' | 'FULL' | 'COMPACT'>('EXPANDED');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const roleFiltered = (currentRole === 'TEAM' && currentUser)
    ? tasks.filter(t => t.assignedTeamId === currentUser.id)
    : tasks;

  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    (clients || []).forEach(c => {
      if (c.id) map.set(c.id, c);
      if (c.tradeName) map.set(c.tradeName.toLowerCase().trim(), c);
      if (c.legalName) map.set(c.legalName.toLowerCase().trim(), c);
    });
    return map;
  }, [clients]);

  // Robust Category Matcher
  const isTaskInCategory = (t: TaskItem, catKey: string): boolean => {
    if (catKey === 'ALL') return true;
    const taskCat = (t.category || '').toUpperCase().trim();
    const taskTitle = (t.title || '').toUpperCase().trim();

    if (catKey === 'GST') {
      if (taskCat === 'TDS' || taskTitle.includes('TDS') || taskTitle.includes('CHALLAN 281') || taskTitle.includes('26Q') || taskTitle.includes('24Q')) {
        return false;
      }
      return taskCat === 'GST' || taskCat.includes('GST') || taskTitle.includes('GSTR') || taskTitle.includes('3B');
    }

    if (catKey === 'VAT') {
      return taskCat === 'VAT' || taskCat.includes('VAT') || taskTitle.includes('VAT');
    }

    if (catKey === 'TDS') {
      if (taskCat === 'GST' || taskTitle.includes('GSTR') || taskTitle.includes('GST') || taskTitle.includes('3B')) {
        return false;
      }
      return taskCat === 'TDS' || taskCat.includes('TDS') || taskTitle.includes('TDS') || taskTitle.includes('281') || taskTitle.includes('26Q') || taskTitle.includes('24Q');
    }

    if (catKey === 'INCOME_TAX') {
      return taskCat === 'INCOME_TAX' || taskCat.includes('INCOME') || taskTitle.includes('ITR') || taskTitle.includes('INCOME TAX');
    }

    if (catKey === 'AUDIT') {
      return taskCat === 'AUDIT' || taskCat.includes('AUDIT') || taskTitle.includes('AUDIT') || taskTitle.includes('44AB') || taskTitle.includes('3CD');
    }

    if (catKey === 'ROC') {
      return taskCat === 'ROC' || taskCat.includes('ROC') || taskCat.includes('MCA') || taskTitle.includes('ROC') || taskTitle.includes('MGT') || taskTitle.includes('AOC');
    }

    if (catKey === 'BOOKKEEPING') {
      return taskCat === 'BOOKKEEPING' || taskCat.includes('BOOK') || taskCat.includes('ACCOUNT') || taskTitle.includes('ACCOUNT') || taskTitle.includes('TALLY');
    }

    return taskCat === catKey.toUpperCase();
  };

  // Sorting: 1. Priority (CRITICAL -> HIGH -> MEDIUM -> LOW)
  //          2. Due Date (Earliest / Nearest deadline first)
  //          3. Status (Actionable Pending/In-Progress first, Done last)
  const priorityWeight: Record<TaskPriority, number> = {
    'CRITICAL': 1,
    'HIGH': 2,
    'MEDIUM': 3,
    'LOW': 4
  };

  const sortedTasks = useMemo(() => {
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

        // Compare dueDayOrDate numeric rule if string (e.g. 2 vs 5 vs 6 vs 15 vs 20)
        const numA = parseInt(a.dueDayOrDate, 10);
        const numB = parseInt(b.dueDayOrDate, 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;

        return a.clientName.localeCompare(b.clientName);
      });
  }, [roleFiltered, activeFilter]);

  const filteredTasks = useMemo(() => {
    return sortedTasks.filter(t => {
      if (selectedCategory !== 'ALL' && !isTaskInCategory(t, selectedCategory)) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        let client: Client | undefined;
        if (t.clientId && clientMap.has(t.clientId)) {
          client = clientMap.get(t.clientId);
        } else if (t.clientName && clientMap.has(t.clientName.toLowerCase().trim())) {
          client = clientMap.get(t.clientName.toLowerCase().trim());
        }

        const matchTitle = (t.title || '').toLowerCase().includes(q);
        const matchClient = (t.clientName || '').toLowerCase().includes(q);
        const matchStaff = (t.assignedTeamName || '').toLowerCase().includes(q);
        const matchCat = (t.category || '').toLowerCase().includes(q);
        const matchDate = (t.dueDate || t.dueDayOrDate || '').toLowerCase().includes(q);
        const matchPan = client?.pan ? client.pan.toLowerCase().includes(q) : false;
        const matchGst = client?.gstin ? client.gstin.toLowerCase().includes(q) : false;
        const matchVat = client?.vatNumber ? client.vatNumber.toLowerCase().includes(q) : false;

        if (!matchTitle && !matchClient && !matchStaff && !matchCat && !matchDate && !matchPan && !matchGst && !matchVat) {
          return false;
        }
      }
      return true;
    });
  }, [sortedTasks, selectedCategory, searchTerm, clientMap]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setShowScrollTop(scrollContainerRef.current.scrollTop > 160);
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
    <GlassCard className="p-4 sm:p-5" variant="elevated">
      
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-200 dark:border-slate-800">
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
            Prioritized Urgency: <strong className="text-red-600 dark:text-red-400">High to Low</strong> • <strong className="text-amber-600 dark:text-amber-400">Earliest Deadlines First</strong> • <span className="font-semibold text-emerald-600 dark:text-emerald-400">↕️ Up-to-Down Scrollable</span> ({filteredTasks.length} of {roleFiltered.length} items)
          </p>
        </div>

        {/* Viewport Height Toggle Button */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setHeightMode(prev => prev === 'EXPANDED' ? 'FULL' : prev === 'FULL' ? 'COMPACT' : 'EXPANDED')}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Toggle between Expanded, Full Page Scroll, and Compact View"
          >
            {heightMode === 'FULL' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>
              {heightMode === 'FULL' ? '↕ Full Table (Page Scroll)' : heightMode === 'EXPANDED' ? '↕ Expanded (750px)' : '↕ Compact (460px)'}
            </span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 mb-3">
        
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-2.5 text-amber-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by client, PAN, GSTIN, VAT, task, staff..."
            className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none shadow-xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Category & Status Filter Controls */}
        <div className="flex flex-wrap items-center gap-1.5 justify-end">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold focus:border-amber-500 focus:outline-none shadow-xs"
          >
            <option value="ALL">All Categories</option>
            <option value="GST">GST</option>
            <option value="VAT">VAT / State Tax</option>
            <option value="TDS">TDS / TCS</option>
            <option value="INCOME_TAX">Income Tax</option>
            <option value="AUDIT">Tax Audit</option>
            <option value="ROC">ROC / MCA</option>
            <option value="BOOKKEEPING">Accounts</option>
          </select>

          {/* Status Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-2 py-1 rounded-lg font-semibold transition-all text-[11px] ${activeFilter === 'ALL' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              All Actionable
            </button>
            <button
              onClick={() => setActiveFilter('CRITICAL')}
              className={`px-2 py-1 rounded-lg font-semibold transition-all text-[11px] ${activeFilter === 'CRITICAL' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Critical/High
            </button>
            <button
              onClick={() => setActiveFilter('IN_PROGRESS')}
              className={`px-2 py-1 rounded-lg font-semibold transition-all text-[11px] ${activeFilter === 'IN_PROGRESS' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              In Progress
            </button>
            <button
              onClick={() => setActiveFilter('PENDING')}
              className={`px-2 py-1 rounded-lg font-semibold transition-all text-[11px] ${activeFilter === 'PENDING' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Pending
            </button>
          </div>
        </div>

      </div>

      {/* Structured List Table in Scrollable Viewport (Up-to-Down Scroll Container) */}
      <div className="relative">
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          style={{ overscrollBehavior: 'auto' }}
          className={`overflow-x-auto overflow-y-auto ${heightMode === 'EXPANDED' ? 'max-h-[750px]' : heightMode === 'COMPACT' ? 'max-h-[460px]' : 'max-h-none'} rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner scrollbar-thin transition-all duration-200 bg-white dark:bg-slate-950`}
        >
          <table className="w-full text-left text-xs border-collapse min-w-[950px]">
            <thead className="sticky top-0 z-20 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-2.5 w-10 text-center sticky top-0 bg-slate-100/95 dark:bg-slate-900/95 shadow-xs font-mono">#</th>
                <th className="p-3 w-28 sticky top-0 bg-slate-100/95 dark:bg-slate-900/95 shadow-xs">Priority</th>
                <th className="p-3 sticky top-0 bg-slate-100/95 dark:bg-slate-900/95 shadow-xs">Client & Tax ID</th>
                <th className="p-3 sticky top-0 bg-slate-100/95 dark:bg-slate-900/95 shadow-xs">Compliance Task</th>
                <th className="p-3 sticky top-0 bg-slate-100/95 dark:bg-slate-900/95 shadow-xs">Category</th>
                <th className="p-3 sticky top-0 bg-slate-100/95 dark:bg-slate-900/95 shadow-xs">Due Rule / Date</th>
                <th className="p-3 sticky top-0 bg-slate-100/95 dark:bg-slate-900/95 shadow-xs">Assigned Staff</th>
                <th className="p-3 text-center sticky top-0 bg-slate-100/95 dark:bg-slate-900/95 shadow-xs">Status</th>
                <th className="p-3 text-right sticky top-0 bg-slate-100/95 dark:bg-slate-900/95 shadow-xs">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <CheckCheck size={28} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                    <p className="font-bold text-slate-700 dark:text-slate-300">No compliance tasks found matching this criteria!</p>
                    <p className="text-[11px] mt-0.5">Try resetting search or category filters.</p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task, idx) => {
                  let client: Client | undefined;
                  if (task.clientId && clientMap.has(task.clientId)) {
                    client = clientMap.get(task.clientId);
                  } else if (task.clientName && clientMap.has(task.clientName.toLowerCase().trim())) {
                    client = clientMap.get(task.clientName.toLowerCase().trim());
                  }

                  const gstin = client?.gstin && client.gstin !== 'N/A' ? client.gstin : null;
                  const vatNumber = client?.vatNumber && client.vatNumber !== 'N/A' ? client.vatNumber : null;
                  const pan = client?.pan && client.pan !== 'N/A' ? client.pan : null;

                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-amber-50/40 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* S.No. */}
                      <td className="p-2.5 text-center text-slate-400 font-mono text-[11px] font-bold">
                        {idx + 1}
                      </td>

                      {/* Priority Column */}
                      <td className="p-3">
                        {getPriorityBadge(task.priority)}
                      </td>

                      {/* Client Column with Tax ID */}
                      <td className="p-3">
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                          {task.clientName}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                          <span>{task.financialYear}</span>
                          {gstin && <span className="text-amber-600 dark:text-amber-400 font-semibold">• GST: {gstin}</span>}
                          {vatNumber && <span className="text-cyan-600 dark:text-cyan-400 font-semibold">• VAT: {vatNumber}</span>}
                          {!gstin && !vatNumber && pan && <span>• PAN: {pan}</span>}
                        </div>
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
                          <Calendar size={11} className="text-amber-500" /> Rule: {task.dueDayOrDate}
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

                      {/* Actions (Mark Done / Copy / Open Modal) */}
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
                            onClick={() => {
                              addTask({
                                clientId: task.clientId,
                                clientName: task.clientName,
                                title: `${task.title} (Copy)`,
                                description: task.description || '',
                                category: task.category,
                                frequency: task.frequency,
                                dueDayOrDate: task.dueDayOrDate,
                                dueDate: task.dueDate,
                                status: 'PENDING',
                                assignedTeamId: task.assignedTeamId,
                                assignedTeamName: task.assignedTeamName,
                                priority: task.priority,
                                financialYear: task.financialYear,
                                period: task.period
                              });
                            }}
                            title="Copy / Duplicate Task"
                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-600 text-blue-700 dark:text-blue-300 hover:text-white border border-blue-500/30 transition-all"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            onClick={() => onOpenTaskModal(task)}
                            title="Edit Task Details"
                            className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 border border-amber-500/30 transition-all font-bold"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Floating Scroll to Top Action Button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            title="Scroll to top of task list"
            className="absolute bottom-4 right-4 z-30 px-3 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-500/30 transition-all animate-in fade-in zoom-in-90 duration-150 flex items-center gap-1.5 text-xs cursor-pointer active:scale-95"
          >
            <ArrowUp size={14} />
            <span className="text-[11px] font-bold">Scroll to Top</span>
          </button>
        )}
      </div>

    </GlassCard>
  );
};
