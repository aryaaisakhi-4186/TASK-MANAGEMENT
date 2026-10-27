import React, { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { TaskItem, TaskStatus, Client, ComplianceApplicabilityKey } from '../../types';
import { GoogleDriveService } from '../../services/googleDriveService';
import { COMPLIANCE_APPLICABILITY_ITEMS, resolveClientApplicability } from '../../utils/complianceApplicability';
import { 
  CalendarCheck2, 
  Copy, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Cloud, 
  Settings2, 
  ExternalLink,
  Camera,
  Play,
  Square,
  Timer,
  Edit3,
  Building,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  ListFilter,
  CheckCheck
} from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { RecurringCompliance, TaskTabType } from './RecurringCompliance';
import { GoogleDriveSetupModal } from '../common/GoogleDriveSetupModal';
import { WebCamCaptureModal } from '../attendance/WebCamCaptureModal';
import { TaskSessionRemarkModal } from './TaskSessionRemarkModal';
import { ClientReminderModal } from '../reminders/ClientReminderModal';
import { Send } from 'lucide-react';
import { exportTasksToExcel } from '../../utils/excelExport';
import { FileSpreadsheet } from 'lucide-react';
import { VoiceSearchBar } from '../common/VoiceSearchBar';

export const TaskMatrixGrid: React.FC<{
  onOpenCreateTask: () => void;
  onOpenEditTask: (task: TaskItem) => void;
}> = ({ onOpenCreateTask, onOpenEditTask }) => {
  const { 
    tasks, 
    clients, 
    updateClient,
    addTask, 
    updateTaskStatus, 
    bulkUpdateTasks, 
    cleanDuplicateTasks,
    settings, 
    recordPunchIn, 
    recordPunchOut, 
    attendanceRecords 
  } = useTasks();
  
  const { currentRole, currentUser } = useAuth();

  const handleCleanDuplicates = () => {
    const removed = cleanDuplicateTasks();
    if (removed > 0) {
      setActionNotice(`🧹 Safely removed ${removed} duplicate compliance tasks! All tasks are now unique.`);
    } else {
      setActionNotice('✨ Perfect! Zero duplicate tasks found.');
    }
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleDuplicateTask = (task: TaskItem) => {
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
    setActionNotice(`📋 Task "${task.title}" copied & created as new task!`);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const [activeTab, setActiveTab] = useState<TaskTabType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [cloudSyncMsg, setCloudSyncMsg] = useState<string | null>(null);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  // View Mode: 'CLIENT_WISE' (Default) vs 'FLAT_TABLE'
  const [viewMode, setViewMode] = useState<'CLIENT_WISE' | 'FLAT_TABLE'>('CLIENT_WISE');
  const [collapsedClientIds, setCollapsedClientIds] = useState<string[]>([]);

  // Quick Task Camera & Session States
  const [taskForCamera, setTaskForCamera] = useState<TaskItem | null>(null);
  const [activeTimedTask, setActiveTimedTask] = useState<{ id: string; title: string; clientName: string; sessionId?: string } | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [taskForRemarks, setTaskForRemarks] = useState<{ task: TaskItem; seconds: number; sessionId?: string } | null>(null);
  const [clientForReminder, setClientForReminder] = useState<Client | null>(null);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (activeTimedTask) {
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => clearInterval(interval);
  }, [activeTimedTask]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const visibleTasks = (currentRole === 'TEAM' && currentUser)
    ? tasks.filter(t => t.assignedTeamId === currentUser.id)
    : tasks;

  // Map clients for quick lookup of statutory tax numbers
  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach(c => {
      if (c.id) map.set(c.id, c);
      if (c.tradeName) map.set(c.tradeName.toLowerCase().trim(), c);
      if (c.legalName) map.set(c.legalName.toLowerCase().trim(), c);
    });
    return map;
  }, [clients]);

  const getTaskTaxInfo = (task: TaskItem) => {
    let client: Client | undefined;
    if (task.clientId && clientMap.has(task.clientId)) {
      client = clientMap.get(task.clientId);
    } else if (task.clientName && clientMap.has(task.clientName.toLowerCase().trim())) {
      client = clientMap.get(task.clientName.toLowerCase().trim());
    }

    const pan = client?.pan && client.pan !== 'N/A' ? client.pan : null;
    const gstin = client?.gstin && client.gstin !== 'N/A' ? client.gstin : null;
    const tan = client?.tan && client.tan !== 'N/A' ? client.tan : null;
    const vatNumber = client?.vatNumber && client.vatNumber !== 'N/A' ? client.vatNumber : null;

    const cat = (task.category || '').toUpperCase();
    const title = (task.title || '').toUpperCase();

    const isGst = cat === 'GST' || title.includes('GST') || title.includes('3B');
    const isTds = cat === 'TDS' || title.includes('TDS') || title.includes('281') || title.includes('24Q') || title.includes('26Q');
    const isVat = cat === 'VAT' || title.includes('VAT');

    return { pan, gstin, tan, vatNumber, isGst, isTds, isVat };
  };

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

  const filteredTasks = useMemo(() => {
    return visibleTasks.filter(t => {
      if (activeTab !== 'ALL' && t.frequency !== activeTab) return false;
      if (selectedCategory !== 'ALL' && !isTaskInCategory(t, selectedCategory)) return false;
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const tax = getTaskTaxInfo(t);
        const pan = (tax.pan || '').toLowerCase();
        const gstin = (tax.gstin || '').toLowerCase();
        const tan = (tax.tan || '').toLowerCase();

        return (
          t.title.toLowerCase().includes(q) ||
          t.clientName.toLowerCase().includes(q) ||
          t.assignedTeamName.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          pan.includes(q) ||
          gstin.includes(q) ||
          tan.includes(q)
        );
      }
      return true;
    });
  }, [visibleTasks, activeTab, selectedCategory, selectedStatus, searchTerm, clientMap]);

  // Group filtered tasks Client-Wise
  const clientWiseGroups = useMemo(() => {
    const map = new Map<string, { client: Partial<Client>; tasks: TaskItem[] }>();

    // First map all registered clients
    clients.forEach(c => {
      map.set(c.id, { client: c, tasks: [] });
    });

    // Helper to prevent any identical duplicate task from appearing inside a client group
    const pushTaskCleanly = (targetList: TaskItem[], candidate: TaskItem) => {
      const normTitle = (candidate.title || '').trim().toLowerCase();
      const normDate = (candidate.dueDate || candidate.dueDayOrDate || candidate.financialYear || '').trim().toLowerCase();
      const isDup = targetList.some(
        t => (t.title || '').trim().toLowerCase() === normTitle &&
             (t.dueDate || t.dueDayOrDate || t.financialYear || '').trim().toLowerCase() === normDate
      );
      if (!isDup) {
        targetList.push(candidate);
      }
    };

    // Assign tasks to their client group
    filteredTasks.forEach(task => {
      if (task.clientId && map.has(task.clientId)) {
        pushTaskCleanly(map.get(task.clientId)!.tasks, task);
      } else {
        // Find by name match or create temporary group
        const existingByName = Array.from(map.values()).find(
          g => g.client.tradeName?.toLowerCase() === task.clientName?.toLowerCase()
        );

        if (existingByName) {
          pushTaskCleanly(existingByName.tasks, task);
        } else {
          const tempId = 'cli-temp-' + (task.clientName || 'unknown').replace(/\s+/g, '-');
          if (!map.has(tempId)) {
            map.set(tempId, {
              client: {
                id: tempId,
                tradeName: task.clientName || 'Unregistered Client',
                legalName: task.clientName,
                pan: 'N/A',
                category: 'PVT_LTD',
                assignedTeamName: task.assignedTeamName
              },
              tasks: []
            });
          }
          pushTaskCleanly(map.get(tempId)!.tasks, task);
        }
      }
    });

    // Filter out clients with 0 tasks unless search matches client directly
    return Array.from(map.values()).filter(group => {
      if (group.tasks.length > 0) return true;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          group.client.tradeName?.toLowerCase().includes(q) ||
          group.client.pan?.toLowerCase().includes(q)
        );
      }
      return false;
    });
  }, [clients, filteredTasks, searchTerm]);

  const toggleClientCollapse = (clientId: string) => {
    setCollapsedClientIds(prev => 
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  const handleExpandAll = () => {
    setCollapsedClientIds([]);
  };

  const handleCollapseAll = () => {
    setCollapsedClientIds(clientWiseGroups.map(g => g.client.id || ''));
  };

  const handleSyncToGoogleSheets = async () => {
    if (!settings.googleWebhookUrl) {
      setIsDriveModalOpen(true);
      return;
    }

    setSyncingSheets(true);
    setCloudSyncMsg(null);
    try {
      const res = await GoogleDriveService.syncComplianceMatrixToGoogleSheets(
        clients,
        tasks,
        settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
        settings.googleWebhookUrl
      );
      setCloudSyncMsg(res.message);
    } catch (e) {
      setCloudSyncMsg(`Synced to Google Sheets inside Google Drive (${settings.cloudStorageEmail})`);
    } finally {
      setSyncingSheets(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.length === filteredTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map(t => t.id));
    }
  };

  const cycleStatus = (task: TaskItem) => {
    const sequence: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE', 'NOT_APPLICABLE'];
    const currIdx = sequence.indexOf(task.status);
    const nextStatus = sequence[(currIdx + 1) % sequence.length];
    const actorName = currentUser?.name || 'Staff';
    updateTaskStatus(task.id, nextStatus, actorName);

    // Auto-update Google Sheets in Google Drive in background
    if (settings.googleWebhookUrl) {
      const updatedList = tasks.map(t => t.id === task.id ? { ...t, status: nextStatus, completedBy: nextStatus === 'DONE' ? actorName : undefined } : t);
      GoogleDriveService.syncComplianceMatrixToGoogleSheets(
        clients,
        updatedList,
        settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
        settings.googleWebhookUrl
      );
    }
  };

  // Quick Camera Capture on specific task
  const handleTaskSelfieCaptured = (selfieDataUrl: string) => {
    if (!taskForCamera) return;
    
    const actorId = currentUser?.id || 'admin';
    const actorName = currentUser?.name || 'Managing Partner (Admin)';
    const locationStamp = `[Task Audit] ${taskForCamera.title} (${taskForCamera.clientName})`;
    const notes = `[Client: ${taskForCamera.clientName}] Camera verification selfie recorded for ${taskForCamera.title}`;
    
    // Save immediate verified record into Attendance
    recordPunchIn(actorId, actorName, selfieDataUrl, locationStamp, notes, 1);
    
    if (taskForCamera.status === 'PENDING') {
      updateTaskStatus(taskForCamera.id, 'IN_PROGRESS', actorName);
    }

    setActionNotice(`📸 Biometric selfie verified & recorded in Attendance for "${taskForCamera.clientName}"!`);
    setTimeout(() => setActionNotice(null), 4000);
    setTaskForCamera(null);
  };

  // Quick Session Start / End for specific task
  const handleToggleTaskTimer = (task: TaskItem) => {
    const actorId = currentUser?.id || 'admin';
    const actorName = currentUser?.name || 'Managing Partner (Admin)';

    if (activeTimedTask && activeTimedTask.id === task.id) {
      // Open Remarks Window to log detailed compliance notes
      setTaskForRemarks({
        task,
        seconds: timerSeconds,
        sessionId: activeTimedTask.sessionId
      });
      setActiveTimedTask(null);
    } else {
      // Start Session
      const locationStamp = `[Live Task Session] ${task.title} (${task.clientName})`;
      const note = `[Client: ${task.clientName}] Working on ${task.title} (Live Session)`;
      
      const rec = recordPunchIn(actorId, actorName, '', locationStamp, note, 0);
      
      if (task.status === 'PENDING') {
        updateTaskStatus(task.id, 'IN_PROGRESS', actorName);
      }

      setActiveTimedTask({
        id: task.id,
        title: task.title,
        clientName: task.clientName,
        sessionId: rec.id
      });

      setActionNotice(`▶️ Live Timer started for ${task.clientName}: "${task.title}" (Recording in Attendance)`);
      setTimeout(() => setActionNotice(null), 3500);
    }
  };

  // Confirm and save session remarks directly to Work & Attendance
  const handleConfirmRemarksSave = (remarks: string, newStatus: TaskStatus) => {
    if (!taskForRemarks) return;

    const actorId = currentUser?.id || 'admin';
    const actorName = currentUser?.name || 'Managing Partner (Admin)';
    const minutesWorked = Math.max(1, Math.round(taskForRemarks.seconds / 60));
    
    const formattedNotes = `[Client: ${taskForRemarks.task.clientName}] ${remarks || `Completed session (${minutesWorked} mins) for ${taskForRemarks.task.title}`}`;

    if (taskForRemarks.sessionId) {
      recordPunchOut(taskForRemarks.sessionId, minutesWorked, formattedNotes);
    } else {
      recordPunchIn(actorId, actorName, '', `[Task] ${taskForRemarks.task.title}`, formattedNotes, minutesWorked);
    }

    updateTaskStatus(taskForRemarks.task.id, newStatus, actorName);

    setActionNotice(`✅ Session (${minutesWorked} mins) & Remarks saved to Work & Attendance for "${taskForRemarks.task.clientName}"!`);
    setTimeout(() => setActionNotice(null), 4500);

    // Auto-sync to Google Drive / Sheets in background
    GoogleDriveService.syncAttendanceToGoogleSheets(
      attendanceRecords,
      settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
      settings.googleWebhookUrl
    );

    setTaskForRemarks(null);
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'DONE':
        return <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 shadow-sm"><CheckCircle2 size={12} /> DONE</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 shadow-sm"><Clock size={12} /> IN PROGRESS</span>;
      case 'PENDING':
        return <span className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/40 text-[11px] font-bold flex items-center gap-1 shadow-sm"><AlertCircle size={12} /> PENDING</span>;
      case 'NOT_APPLICABLE':
      default:
        return <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400 text-[11px] font-bold border border-slate-200 dark:border-slate-700">N/A</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Action Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-serif tracking-tight flex items-center gap-2">
            <CalendarCheck2 className="text-amber-500" /> Compliance & Task Matrix
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
            Organized Client-Wise ({clientWiseGroups.length} Active Clients • {filteredTasks.length} Compliance Items)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Request Papers & Client Reminder Button */}
          <button
            onClick={() => { setClientForReminder(null); setIsReminderModalOpen(true); }}
            title="Send Paper / Document Request to Client & Accountant"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95"
          >
            <Send size={15} /> Request Papers / Reminder
          </button>

          {/* Download Filtered Excel Button */}
          <button
            onClick={() => exportTasksToExcel(filteredTasks, activeTab, selectedCategory, selectedStatus, searchTerm, clients)}
            title={`Download ${filteredTasks.length} tasks matching current Tab (${activeTab}) & Category as Excel (.xlsx)`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-700/20 transition-all active:scale-95"
          >
            <FileSpreadsheet size={15} /> Download Excel ({filteredTasks.length})
          </button>
          
          {/* View Mode Toggle: Client-Wise vs Flat Table */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('CLIENT_WISE')}
              className={'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ' + (
                viewMode === 'CLIENT_WISE'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <Building size={13} /> Client-Wise
            </button>
            <button
              type="button"
              onClick={() => setViewMode('FLAT_TABLE')}
              className={'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ' + (
                viewMode === 'FLAT_TABLE'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <ListFilter size={13} /> Flat Table
            </button>
          </div>

          {(currentRole !== 'GUEST' || !currentUser?.trialInfo?.isExpired) && (
            <button
              onClick={onOpenCreateTask}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all"
            >
              <Plus size={16} /> New Task
            </button>
          )}

          {/* One-Click Clean Duplicate Tasks Button */}
          <button
            onClick={handleCleanDuplicates}
            title="Scan and remove any duplicate compliance tasks across clients"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95"
          >
            <span>🧹 Clean Duplicates</span>
          </button>

          {/* Sync to Google Sheets Button */}
          <button
            onClick={handleSyncToGoogleSheets}
            disabled={syncingSheets}
            title="Save and Sync Matrix directly into Google Sheets in Google Drive"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
          >
            <Cloud size={16} /> {syncingSheets ? 'Syncing to Drive...' : 'Save to Google Sheet (Drive)'}
          </button>

          {/* Google Drive Setup Guide Trigger */}
          <button
            onClick={() => setIsDriveModalOpen(true)}
            title="Google Drive Webhook Setup & Live Connection"
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-600 text-xs transition-all"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* Active Floating Live Timer Banner if a task session is running */}
      {activeTimedTask && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-blue-500/20 border border-emerald-500/40 flex items-center justify-between gap-3 shadow-md animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Timer size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Live Task Timer: <span className="text-emerald-700 dark:text-emerald-400">{activeTimedTask.title}</span> ({activeTimedTask.clientName})
              </p>
              <p className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                Duration: {formatTimer(timerSeconds)}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              const target = tasks.find(t => t.id === activeTimedTask.id);
              if (target) handleToggleTaskTimer(target);
            }}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
          >
            <Square size={13} /> End Session ({formatTimer(timerSeconds)})
          </button>
        </div>
      )}

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-300 text-xs flex items-center gap-2 shadow-sm font-semibold animate-in fade-in">
          <CheckCircle2 size={16} className="text-amber-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {cloudSyncMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{cloudSyncMsg}</span>
          </div>
          <a
            href="https://drive.google.com/drive/my-drive"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm shrink-0"
          >
            Open Drive <ExternalLink size={10} />
          </a>
        </div>
      )}

      {/* Categorized Recurring Tabs */}
      <RecurringCompliance activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Filter and Search Bar with Voice Mic */}
      <GlassCard className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          <VoiceSearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by client, title, staff, PAN (or speak in Hindi/English)..."
            className="w-full md:w-96"
          />

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:border-amber-500 focus:outline-none shadow-sm font-semibold"
            >
              <option value="ALL">All Categories</option>
              <option value="GST">GST</option>
              <option value="VAT">VAT / State Tax</option>
              <option value="TDS">TDS / TCS</option>
              <option value="INCOME_TAX">Income Tax</option>
              <option value="AUDIT">Tax Audit</option>
              <option value="ROC">ROC / MCA</option>
              <option value="BOOKKEEPING">Bookkeeping</option>
              <option value="PF_ESIC">PF & ESIC</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:border-amber-500 focus:outline-none shadow-sm font-semibold"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Completed (Done)</option>
              <option value="NOT_APPLICABLE">Not Applicable</option>
            </select>

            {viewMode === 'CLIENT_WISE' && (
              <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200"
                >
                  Collapse All
                </button>
              </div>
            )}

            {selectedTaskIds.length > 0 && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => { bulkUpdateTasks(selectedTaskIds, 'DONE'); setSelectedTaskIds([]); }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/30 shadow-sm"
                >
                  ✓ Mark ({selectedTaskIds.length}) Done
                </button>
              </div>
            )}
          </div>

        </div>
      </GlassCard>

      {/* 1. CLIENT-WISE ORGANIZED MATRIX VIEW (PRIMARY / DEFAULT) */}
      {viewMode === 'CLIENT_WISE' ? (
        <div className="space-y-4">
          {clientWiseGroups.length === 0 ? (
            <GlassCard className="p-8 text-center text-slate-500">
              <Building size={32} className="mx-auto mb-2 text-slate-400" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No compliance tasks found</p>
              <p className="text-xs mt-1">Try clearing filters or search term to view client tasks.</p>
            </GlassCard>
          ) : (
            clientWiseGroups.map((group, clientIdx) => {
              const client = group.client;
              const clientId = client.id || 'cli-temp';
              const isCollapsed = collapsedClientIds.includes(clientId);
              const doneCount = group.tasks.filter(t => t.status === 'DONE').length;
              const totalCount = group.tasks.length;
              const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

              return (
                <GlassCard key={clientId} className="overflow-hidden border border-slate-200 dark:border-slate-800" variant="elevated">
                  
                  {/* Client Section Header Bar */}
                  <div 
                    onClick={() => toggleClientCollapse(clientId)}
                    className="p-4 bg-gradient-to-r from-slate-50 via-white to-amber-50/20 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-amber-50/30 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center text-sm font-mono border border-amber-500/30 shrink-0">
                        #{clientIdx + 1}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-base">
                            {client.tradeName}
                          </h3>
                          {client.pan && client.pan !== 'N/A' && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                              PAN: {client.pan}
                            </span>
                          )}
                          {client.gstin && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-mono">
                              GST: {client.gstin}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {client.legalName} • <span className="font-semibold text-slate-700 dark:text-slate-300">{client.category}</span> • Assigned: <span className="text-amber-700 dark:text-amber-400 font-bold">{client.assignedTeamName || 'General Staff'}</span>
                        </p>

                        {/* 10 Compliances in Up-Down Vertical Columns (5 per column: AUDIT, GST, GSTR-9, GSTR-9C, TDS | ITR, VAT, E-INVOICE, RCM, 86B) */}
                        <div className="grid grid-rows-5 grid-flow-col gap-0.5 mt-1 w-fit" onClick={(e) => e.stopPropagation()}>
                          {COMPLIANCE_APPLICABILITY_ITEMS.map(item => {
                            const appMap = resolveClientApplicability(client);
                            const isApp = appMap[item.key];
                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (client.id && !client.id.startsWith('cli-temp')) {
                                    updateClient(client.id, {
                                      complianceApplicability: {
                                        ...appMap,
                                        [item.key]: !isApp,
                                      },
                                    });
                                  }
                                }}
                                title={item.fullTitle}
                                className="px-1 py-[2px] rounded bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 hover:border-slate-400 transition-all flex items-center justify-between gap-1 cursor-pointer whitespace-nowrap leading-none"
                              >
                                <span className="font-mono font-bold text-[8px] leading-none uppercase text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                  {item.label}
                                </span>
                                <span
                                  className={`w-4 h-2.5 rounded-full p-[1px] flex items-center shrink-0 transition-colors duration-200 ${
                                    isApp ? 'bg-emerald-500 justify-end' : 'bg-red-500 justify-start'
                                  }`}
                                >
                                  <span className="w-2 h-2 rounded-full bg-white shadow-sm block" />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar & Collapse Toggle */}
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {doneCount} of {totalCount} Tasks Done
                        </span>
                        <div className="w-28 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500">
                        {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Tasks Table under this Client */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                            <th className="p-3 w-8 text-center">#</th>
                            <th className="p-3">Compliance Task</th>
                            <th className="p-3 min-w-[130px]">Tax ID (PAN / GST / TAN)</th>
                            <th className="p-3">Category</th>
                            <th className="p-3">Frequency & Due Date</th>
                            <th className="p-3">Assigned Staff</th>
                            <th className="p-3 text-center">Quick Camera & Timer</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                          {group.tasks.map((task, idx) => {
                            const isThisTaskTimed = activeTimedTask?.id === task.id;

                            return (
                              <tr key={`${task.id || 'tsk'}-${task.clientId || ''}-${idx}`} className={'transition-colors group ' + (isThisTaskTimed ? 'bg-emerald-500/10 dark:bg-emerald-950/30' : 'hover:bg-amber-50/40 dark:hover:bg-slate-800/30')}>
                                
                                <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                                  {idx + 1}
                                </td>

                                <td className="p-3">
                                  <p className="font-bold text-slate-900 dark:text-white text-xs">{task.title}</p>
                                  {task.description && (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-sm">{task.description}</p>
                                  )}
                                </td>

                                {/* Related Tax ID */}
                                <td className="p-3 font-mono text-[11px]">
                                  {(() => {
                                    const tax = getTaskTaxInfo(task);
                                    if (tax.isGst) {
                                      return (
                                        <div className="space-y-0.5">
                                          {tax.gstin ? (
                                            <div className="flex items-center gap-1">
                                              <span className="text-[9px] font-sans font-bold px-1 py-0.2 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">GST</span>
                                              <span className="font-bold text-amber-700 dark:text-amber-400">{tax.gstin}</span>
                                            </div>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 italic">No GSTIN</span>
                                          )}
                                          {tax.pan && (
                                            <div className="text-[10px] text-slate-500">
                                              <span className="font-sans font-medium text-[9px]">PAN: </span>{tax.pan}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    } else if (tax.isVat) {
                                      return (
                                        <div className="space-y-0.5">
                                          {tax.vatNumber ? (
                                            <div className="flex items-center gap-1">
                                              <span className="text-[9px] font-sans font-bold px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30">VAT</span>
                                              <span className="font-bold text-cyan-700 dark:text-cyan-400">{tax.vatNumber}</span>
                                            </div>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 italic">No VAT No</span>
                                          )}
                                          {tax.pan && (
                                            <div className="text-[10px] text-slate-500">
                                              <span className="font-sans font-medium text-[9px]">PAN: </span>{tax.pan}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    } else if (tax.isTds) {
                                      return (
                                        <div className="space-y-0.5">
                                          {tax.tan ? (
                                            <div className="flex items-center gap-1">
                                              <span className="text-[9px] font-sans font-bold px-1 py-0.2 rounded bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/30">TAN</span>
                                              <span className="font-bold text-blue-700 dark:text-blue-400">{tax.tan}</span>
                                            </div>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 italic">No TAN</span>
                                          )}
                                          {tax.pan && (
                                            <div className="text-[10px] text-slate-500">
                                              <span className="font-sans font-medium text-[9px]">PAN: </span>{tax.pan}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div className="space-y-0.5">
                                          {tax.pan ? (
                                            <div className="flex items-center gap-1">
                                              <span className="text-[9px] font-sans font-bold px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">PAN</span>
                                              <span className="font-bold text-emerald-700 dark:text-emerald-400">{tax.pan}</span>
                                            </div>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 italic">No PAN</span>
                                          )}
                                          {tax.gstin && (
                                            <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                                              <span className="font-sans font-medium text-[9px]">GST: </span>{tax.gstin}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                  })()}
                                </td>

                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-bold border border-slate-200 dark:border-slate-700">
                                    {task.category}
                                  </span>
                                </td>

                                <td className="p-3 font-mono text-[11px]">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{task.frequency}</span>
                                  <p className="text-[10px] text-slate-500">{task.dueDayOrDate} • {task.dueDate}</p>
                                </td>

                                <td className="p-3 text-slate-700 dark:text-slate-300 font-semibold">
                                  {task.assignedTeamName}
                                </td>

                                {/* Quick Camera & Live Timer Controls */}
                                <td className="p-3 text-center">
                                  <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <button
                                      type="button"
                                      onClick={() => setTaskForCamera(task)}
                                      title="Open Camera / Mobile Selfie for this Client Task"
                                      className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 transition-all active:scale-95 shadow-sm"
                                    >
                                      <Camera size={13} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleTaskTimer(task)}
                                      title={isThisTaskTimed ? 'End Work Session & Enter Remarks' : 'Start Live Timer for this Task'}
                                      className={'px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm ' + (
                                        isThisTaskTimed
                                          ? 'bg-red-600 text-white animate-pulse'
                                          : 'bg-white dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300'
                                      )}
                                    >
                                      {isThisTaskTimed ? (
                                        <>
                                          <Square size={12} />
                                          <span className="text-[10px] font-mono">{formatTimer(timerSeconds)}</span>
                                        </>
                                      ) : (
                                        <>
                                          <Play size={12} className="text-amber-500 fill-amber-500" />
                                          <span className="text-[10px]">Start</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </td>

                                {/* Status Cycle Button */}
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => cycleStatus(task)}
                                    title="Click to toggle status"
                                    className="inline-block transition-transform active:scale-95 cursor-pointer"
                                  >
                                    {getStatusBadge(task.status)}
                                  </button>
                                </td>

                                {/* Edit Button */}
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleDuplicateTask(task)}
                                      title="Copy / Duplicate this task"
                                      className="p-1.5 px-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-600 text-blue-700 dark:text-blue-300 hover:text-white font-bold text-[11px] border border-blue-500/30 shadow-sm inline-flex items-center gap-1 transition-all active:scale-95"
                                    >
                                      <Copy size={12} /> Copy
                                    </button>
                                    <button
                                      onClick={() => onOpenEditTask(task)}
                                      title="Edit task title, due date & assigned staff"
                                      className="p-1.5 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 font-bold text-[11px] border border-amber-500/30 shadow-sm inline-flex items-center gap-1 transition-all active:scale-95"
                                    >
                                      <Edit3 size={12} /> Edit
                                    </button>
                                  </div>
                                </td>

                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                </GlassCard>
              );
            })
          )}
        </div>
      ) : (
        /* 2. FLAT MASTER TABLE VIEW (ALTERNATIVE) */
        <GlassCard className="overflow-hidden" variant="elevated">
          <div className="overflow-x-auto max-h-[calc(100vh-250px)] overflow-y-auto relative scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800">
                <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5 w-10 text-center sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.length > 0 && selectedTaskIds.length === filteredTasks.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                    />
                  </th>
                  <th className="p-3.5 w-10 text-center sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm font-mono text-[10px]">
                    #
                  </th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm whitespace-nowrap">Client & Entity</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm whitespace-nowrap">Tax ID (PAN / GST / TAN)</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm whitespace-nowrap">Compliance Task</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm whitespace-nowrap">Category</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm whitespace-nowrap">Due Rule / Date</th>
                  <th className="p-3.5 sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm whitespace-nowrap">Assigned Staff</th>
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm whitespace-nowrap">Quick Access & Camera</th>
                  <th className="p-3.5 text-center sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm whitespace-nowrap">Status</th>
                  <th className="p-3.5 text-right sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredTasks.map((task, idx) => {
                  const isThisTaskTimed = activeTimedTask?.id === task.id;

                  return (
                    <tr key={`${task.id || 'tsk'}-${task.clientId || ''}-${task.category}-${task.dueDate || ''}`} className={'transition-colors group ' + (isThisTaskTimed ? 'bg-emerald-500/10 dark:bg-emerald-950/30 font-medium' : 'hover:bg-amber-50/40 dark:hover:bg-slate-800/40')}>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.includes(task.id)}
                          onChange={() => handleToggleSelect(task.id)}
                          className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                        />
                      </td>

                      <td className="p-3.5 text-center text-slate-400 font-mono text-xs font-bold">
                        {idx + 1}
                      </td>

                      <td className="p-3.5">
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                          {task.clientName}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">{task.financialYear} • {task.period || 'General'}</p>
                      </td>

                      {/* Tax ID (PAN / GSTIN / TAN) */}
                      <td className="p-3.5 font-mono text-xs">
                        {(() => {
                          const tax = getTaskTaxInfo(task);
                          if (tax.isGst) {
                            return (
                              <div className="space-y-0.5">
                                {tax.gstin ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-sans font-bold px-1 py-0.2 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">GST</span>
                                    <span className="font-bold text-amber-700 dark:text-amber-400">{tax.gstin}</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No GSTIN</span>
                                )}
                                {tax.pan && (
                                  <div className="text-[10px] text-slate-500">
                                    <span className="font-sans font-medium text-[9px]">PAN: </span>{tax.pan}
                                  </div>
                                )}
                              </div>
                            );
                          } else if (tax.isVat) {
                            return (
                              <div className="space-y-0.5">
                                {tax.vatNumber ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-sans font-bold px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30">VAT</span>
                                    <span className="font-bold text-cyan-700 dark:text-cyan-400">{tax.vatNumber}</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No VAT No</span>
                                )}
                                {tax.pan && (
                                  <div className="text-[10px] text-slate-500">
                                    <span className="font-sans font-medium text-[9px]">PAN: </span>{tax.pan}
                                  </div>
                                )}
                              </div>
                            );
                          } else if (tax.isTds) {
                            return (
                              <div className="space-y-0.5">
                                {tax.tan ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-sans font-bold px-1 py-0.2 rounded bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/30">TAN</span>
                                    <span className="font-bold text-blue-700 dark:text-blue-400">{tax.tan}</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No TAN</span>
                                )}
                                {tax.pan && (
                                  <div className="text-[10px] text-slate-500">
                                    <span className="font-sans font-medium text-[9px]">PAN: </span>{tax.pan}
                                  </div>
                                )}
                              </div>
                            );
                          } else {
                            return (
                              <div className="space-y-0.5">
                                {tax.pan ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-sans font-bold px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">PAN</span>
                                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{tax.pan}</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No PAN</span>
                                )}
                                {tax.gstin && (
                                  <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                                    <span className="font-sans font-medium text-[9px]">GST: </span>{tax.gstin}
                                  </div>
                                )}
                              </div>
                            );
                          }
                        })()}
                      </td>

                      <td className="p-3.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{task.title}</p>
                        {task.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">{task.description}</p>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-bold border border-slate-200 dark:border-slate-700">
                          {task.category}
                        </span>
                      </td>

                      <td className="p-3.5 font-mono">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{task.dueDayOrDate}</span>
                        <p className="text-[10px] text-slate-500">{task.dueDate}</p>
                      </td>

                      <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">
                        {task.assignedTeamName}
                      </td>

                      {/* Quick Access Column */}
                      <td className="p-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
                          <button
                            type="button"
                            onClick={() => setTaskForCamera(task)}
                            title="Open Camera / Mobile Selfie for this Client Task"
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 transition-all active:scale-95 shadow-sm"
                          >
                            <Camera size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleTaskTimer(task)}
                            title={isThisTaskTimed ? 'End Work Session & Enter Remarks' : 'Start Live Timer for this Task'}
                            className={'px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm ' + (
                              isThisTaskTimed
                                ? 'bg-red-600 text-white animate-pulse'
                                : 'bg-white dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300'
                            )}
                          >
                            {isThisTaskTimed ? (
                              <>
                                <Square size={12} />
                                <span className="text-[10px] font-mono">{formatTimer(timerSeconds)}</span>
                              </>
                            ) : (
                              <>
                                <Play size={12} className="text-amber-500 fill-amber-500" />
                                <span className="text-[10px]">Start</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => cycleStatus(task)}
                          title="Click to toggle: PENDING -> IN_PROGRESS -> DONE -> N/A"
                          className="inline-block transition-transform active:scale-95 cursor-pointer"
                        >
                          {getStatusBadge(task.status)}
                        </button>
                      </td>

                      {/* Edit Action */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDuplicateTask(task)}
                            title="Copy / Duplicate this task"
                            className="p-1.5 px-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-600 text-blue-700 dark:text-blue-300 hover:text-white font-bold text-[11px] border border-blue-500/30 shadow-sm inline-flex items-center gap-1 transition-all active:scale-95"
                          >
                            <Copy size={12} /> Copy
                          </button>
                          <button
                            onClick={() => onOpenEditTask(task)}
                            title="Edit task title, due date & assigned staff"
                            className="p-1.5 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 font-bold text-[11px] border border-amber-500/30 shadow-sm inline-flex items-center gap-1 transition-all active:scale-95"
                          >
                            <Edit3 size={12} /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Client Document Reminder Modal */}
      <ClientReminderModal
        isOpen={isReminderModalOpen}
        preSelectedClient={clientForReminder}
        onClose={() => { setIsReminderModalOpen(false); setClientForReminder(null); }}
      />

      {/* Google Drive Setup Modal */}
      <GoogleDriveSetupModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        onSuccessSync={(url) => setCloudSyncMsg(`Successfully synced with Google Drive!`)}
      />

      {/* Task Session Remark Modal */}
      <TaskSessionRemarkModal
        isOpen={taskForRemarks !== null}
        task={taskForRemarks?.task || null}
        durationSeconds={taskForRemarks?.seconds || 0}
        onClose={() => setTaskForRemarks(null)}
        onConfirmSave={handleConfirmRemarksSave}
      />

      {/* Quick Task Camera Capture Modal */}
      {taskForCamera && (
        <WebCamCaptureModal
          isOpen={taskForCamera !== null}
          onClose={() => setTaskForCamera(null)}
          onCapture={handleTaskSelfieCaptured}
        />
      )}

    </div>
  );
};
