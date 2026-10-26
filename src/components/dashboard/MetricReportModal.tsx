import React, { useState, useMemo, useEffect } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { TaskItem, TaskStatus, ExtraWorkItem, Client } from '../../types';
import { 
  X, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  IndianRupee, 
  Search, 
  FileSpreadsheet, 
  ArrowUpRight, 
  Calendar, 
  Building, 
  User, 
  FileText,
  DollarSign,
  Filter
} from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { exportTasksToExcel } from '../../utils/excelExport';
import * as XLSX from 'xlsx';

export type MetricReportType = 'COMPLIANCE_DONE' | 'IN_PROGRESS' | 'ACTION_PENDING' | 'EXTRA_FEES';

interface Props {
  isOpen: boolean;
  reportType: MetricReportType | null;
  onClose: () => void;
  onOpenTaskModal: (task: TaskItem) => void;
}

export const MetricReportModal: React.FC<Props> = ({
  isOpen,
  reportType,
  onClose,
  onOpenTaskModal
}) => {
  const { tasks, clients, extraWork, updateTaskStatus } = useTasks();
  const { currentRole, currentUser } = useAuth();
  
  const [activeReportTab, setActiveReportTab] = useState<MetricReportType>('ACTION_PENDING');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Sync prop when opened
  useEffect(() => {
    if (reportType) {
      setActiveReportTab(reportType);
      setSelectedCategory('ALL');
      setSearchTerm('');
    }
  }, [reportType, isOpen]);

  useEscapeKey(onClose, isOpen);

  const visibleTasks = (currentRole === 'TEAM' && currentUser)
    ? tasks.filter(t => t.assignedTeamId === currentUser.id)
    : tasks;

  // Counts for Top 4 Metric Tabs
  const pendingCount = useMemo(() => visibleTasks.filter(t => t.status === 'PENDING').length, [visibleTasks]);
  const inProgressCount = useMemo(() => visibleTasks.filter(t => t.status === 'IN_PROGRESS').length, [visibleTasks]);
  const doneCount = useMemo(() => visibleTasks.filter(t => t.status === 'DONE').length, [visibleTasks]);
  const extraFeesCount = useMemo(() => extraWork.length, [extraWork]);

  // Base list of tasks for the currently active report tab
  const baseTasksForTab = useMemo(() => {
    if (activeReportTab === 'COMPLIANCE_DONE') {
      return visibleTasks.filter(t => t.status === 'DONE');
    } else if (activeReportTab === 'IN_PROGRESS') {
      return visibleTasks.filter(t => t.status === 'IN_PROGRESS');
    } else if (activeReportTab === 'ACTION_PENDING') {
      return visibleTasks.filter(t => t.status === 'PENDING');
    }
    return visibleTasks;
  }, [visibleTasks, activeReportTab]);

  // Robust Category Matcher
  const isTaskInCategory = (t: TaskItem, catKey: string): boolean => {
    if (catKey === 'ALL') return true;
    const taskCat = (t.category || '').toUpperCase().trim();
    const taskTitle = (t.title || '').toUpperCase().trim();

    if (catKey === 'GST') {
      // Must NOT be TDS or other obligations
      if (taskCat === 'TDS' || taskTitle.includes('TDS') || taskTitle.includes('CHALLAN 281') || taskTitle.includes('26Q') || taskTitle.includes('24Q')) {
        return false;
      }
      return taskCat === 'GST' || taskCat.includes('GST') || taskTitle.includes('GSTR') || taskTitle.includes('3B');
    }

    if (catKey === 'VAT') {
      return taskCat === 'VAT' || taskCat.includes('VAT') || taskTitle.includes('VAT');
    }

    if (catKey === 'TDS') {
      // Must NOT be GST obligations
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

    if (catKey === 'OTHER') {
      const known = ['GST', 'VAT', 'TDS', 'INCOME_TAX', 'AUDIT', 'ROC', 'BOOKKEEPING'];
      return !known.some(k => isTaskInCategory(t, k));
    }

    return taskCat === catKey.toUpperCase();
  };

  // Counts per Category for Category Sub-Tabs
  const categoryCounts = useMemo(() => {
    return {
      ALL: baseTasksForTab.length,
      GST: baseTasksForTab.filter(t => isTaskInCategory(t, 'GST')).length,
      VAT: baseTasksForTab.filter(t => isTaskInCategory(t, 'VAT')).length,
      TDS: baseTasksForTab.filter(t => isTaskInCategory(t, 'TDS')).length,
      INCOME_TAX: baseTasksForTab.filter(t => isTaskInCategory(t, 'INCOME_TAX')).length,
      AUDIT: baseTasksForTab.filter(t => isTaskInCategory(t, 'AUDIT')).length,
      ROC: baseTasksForTab.filter(t => isTaskInCategory(t, 'ROC')).length,
      BOOKKEEPING: baseTasksForTab.filter(t => isTaskInCategory(t, 'BOOKKEEPING')).length,
      OTHER: baseTasksForTab.filter(t => isTaskInCategory(t, 'OTHER')).length
    };
  }, [baseTasksForTab]);

  // Filter tasks based on Category
  const tasksAfterCategory = useMemo(() => {
    if (selectedCategory === 'ALL') return baseTasksForTab;
    return baseTasksForTab.filter(t => isTaskInCategory(t, selectedCategory));
  }, [baseTasksForTab, selectedCategory]);

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

  // Filter tasks with Search Term (Client, Title, Category, Staff, FY, Due Date, Tax IDs)
  const filteredTasks = useMemo(() => {
    if (!searchTerm.trim()) return tasksAfterCategory;
    const q = searchTerm.toLowerCase().trim();
    return tasksAfterCategory.filter(t => {
      const title = (t.title || '').toLowerCase();
      const clientName = (t.clientName || '').toLowerCase();
      const assigned = (t.assignedTeamName || '').toLowerCase();
      const category = (t.category || '').toLowerCase();
      const dueDate = (t.dueDate || '').toLowerCase();
      const dueDayOrDate = (t.dueDayOrDate || '').toLowerCase();
      const fy = (t.financialYear || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();

      const tax = getTaskTaxInfo(t);
      const pan = (tax.pan || '').toLowerCase();
      const gstin = (tax.gstin || '').toLowerCase();
      const tan = (tax.tan || '').toLowerCase();

      return (
        title.includes(q) ||
        clientName.includes(q) ||
        assigned.includes(q) ||
        category.includes(q) ||
        dueDate.includes(q) ||
        dueDayOrDate.includes(q) ||
        fy.includes(q) ||
        desc.includes(q) ||
        pan.includes(q) ||
        gstin.includes(q) ||
        tan.includes(q)
      );
    });
  }, [tasksAfterCategory, searchTerm, clientMap]);

  // Filter extra work items if activeReportTab === 'EXTRA_FEES'
  const filteredExtraWork = useMemo(() => {
    if (activeReportTab !== 'EXTRA_FEES') return [];
    let list = extraWork;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(w =>
        (w.taskTitle || '').toLowerCase().includes(q) ||
        (w.clientName || '').toLowerCase().includes(q) ||
        (w.category || '').toLowerCase().includes(q) ||
        (w.assignedTeamName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [extraWork, activeReportTab, searchTerm]);

  if (!isOpen) return null;

  // Header Info based on activeReportTab
  const getHeaderInfo = () => {
    switch (activeReportTab) {
      case 'COMPLIANCE_DONE':
        return {
          title: 'Completed Compliance Audit Report',
          subtitle: `Detailed statement of ${filteredTasks.length} successfully filed & verified tasks`,
          icon: <CheckCircle2 className="text-emerald-500" size={24} />,
          bgBadge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
        };
      case 'IN_PROGRESS':
        return {
          title: 'In-Progress Work & Filings Report',
          subtitle: `Statement of ${filteredTasks.length} active statutory tasks currently underway`,
          icon: <Clock className="text-amber-500" size={24} />,
          bgBadge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
        };
      case 'ACTION_PENDING':
        return {
          title: 'Action Pending & Upcoming Deadlines Report',
          subtitle: `Statement of ${filteredTasks.length} pending statutory challans and return obligations`,
          icon: <AlertTriangle className="text-red-500" size={24} />,
          bgBadge: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30'
        };
      case 'EXTRA_FEES':
      default:
        const totalDue = filteredExtraWork.reduce((acc, curr) => acc + curr.balanceDue, 0);
        return {
          title: 'Extra Work & Outstanding Fees Report',
          subtitle: `₹${totalDue.toLocaleString('en-IN')} outstanding receivable across ${filteredExtraWork.length} ad-hoc items`,
          icon: <IndianRupee className="text-blue-500" size={24} />,
          bgBadge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'
        };
    }
  };

  const headerInfo = getHeaderInfo();

  // Export Extra Work to Excel with specific search label
  const handleExportExtraWorkExcel = () => {
    const rows = filteredExtraWork.map((w, idx) => ({
      'Sr No': idx + 1,
      'Client Name': w.clientName,
      'Ad-Hoc Assignment Title': w.taskTitle,
      'Category': w.category,
      'Agreed Fee (₹)': w.agreedFee,
      'Advance Received (₹)': w.advanceReceived,
      'Balance Due (₹)': w.balanceDue,
      'Billing Status': w.status,
      'Assigned Staff': w.assignedTeamName,
      'Created Date': w.createdDate,
      'Target Date': w.targetCompletionDate
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Extra_Work_Fees');
    const cleanSearch = searchTerm.trim().replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20);
    const searchSuffix = cleanSearch ? `_Search_${cleanSearch}` : '';
    XLSX.writeFile(workbook, `TASK-VAANI_Extra_Fees_Report${searchSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Available categories for sub-tabs
  const categoryTabs = [
    { key: 'ALL', label: 'All Obligations', count: categoryCounts.ALL },
    { key: 'GST', label: 'GST Returns', count: categoryCounts.GST },
    { key: 'VAT', label: 'VAT Returns & Tax', count: categoryCounts.VAT },
    { key: 'TDS', label: 'TDS / TCS', count: categoryCounts.TDS },
    { key: 'INCOME_TAX', label: 'Income Tax', count: categoryCounts.INCOME_TAX },
    { key: 'AUDIT', label: 'Tax Audit', count: categoryCounts.AUDIT },
    { key: 'ROC', label: 'ROC / MCA', count: categoryCounts.ROC },
    { key: 'BOOKKEEPING', label: 'Accounts', count: categoryCounts.BOOKKEEPING }
  ].filter(tab => tab.key === 'ALL' || tab.count > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-hidden overscroll-none animate-in zoom-in-95 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-[98vw] xl:max-w-7xl 2xl:max-w-[1550px] bg-white dark:bg-slate-900 border border-amber-400/40 rounded-3xl p-4 md:p-6 shadow-2xl max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          title="Close Modal (Esc)"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800 transition-colors z-10"
        >
          <X size={18} />
        </button>

        {/* Modal Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 pr-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${headerInfo.bgBadge}`}>
              {headerInfo.icon}
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white font-serif">
                {headerInfo.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {headerInfo.subtitle}
              </p>
            </div>
          </div>

          {/* Excel Export Action */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            {activeReportTab === 'EXTRA_FEES' ? (
              <button
                onClick={handleExportExtraWorkExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95"
                title={`Export ${filteredExtraWork.length} extra work items to Excel`}
              >
                <FileSpreadsheet size={15} /> Export Excel ({filteredExtraWork.length})
              </button>
            ) : (
              <button
                onClick={() => exportTasksToExcel(filteredTasks, activeReportTab, selectedCategory, 'ALL', searchTerm, clients)}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95"
                title={`Export ${filteredTasks.length} filtered tasks to separate Excel`}
              >
                <FileSpreadsheet size={15} /> Export Filtered Excel ({filteredTasks.length})
              </button>
            )}
          </div>
        </div>

        {/* 1. Report Status Switcher Tabs (Action Pending | In Progress | Done | Extra Fees) */}
        <div className="flex flex-wrap items-center gap-2 pt-3 pb-2 shrink-0">
          <button
            type="button"
            onClick={() => { setActiveReportTab('ACTION_PENDING'); setSelectedCategory('ALL'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
              activeReportTab === 'ACTION_PENDING'
                ? 'bg-red-500 text-white border-red-600 shadow-md ring-2 ring-red-400/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <AlertTriangle size={14} /> Action Pending ({pendingCount})
          </button>

          <button
            type="button"
            onClick={() => { setActiveReportTab('IN_PROGRESS'); setSelectedCategory('ALL'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
              activeReportTab === 'IN_PROGRESS'
                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-400/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Clock size={14} /> In Progress ({inProgressCount})
          </button>

          <button
            type="button"
            onClick={() => { setActiveReportTab('COMPLIANCE_DONE'); setSelectedCategory('ALL'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
              activeReportTab === 'COMPLIANCE_DONE'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <CheckCircle2 size={14} /> Compliance Done ({doneCount})
          </button>

          <button
            type="button"
            onClick={() => { setActiveReportTab('EXTRA_FEES'); setSelectedCategory('ALL'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
              activeReportTab === 'EXTRA_FEES'
                ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-400/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <IndianRupee size={14} /> Extra Work & Fees ({extraFeesCount})
          </button>
        </div>

        {/* 2. Search Bar & Category Filter Tabs */}
        <div className="my-2 space-y-2.5 shrink-0">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            {/* Search Input Box */}
            <div className="relative flex-1 max-w-xl">
              <Search size={16} className="absolute left-3.5 top-2.5 text-amber-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by task title (e.g. GSTR-1, 3B, TDS), client name, staff, date..."
                className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-amber-500/50 dark:border-amber-500/40 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-sm"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Live Count & Search Tag */}
            <div className="flex items-center gap-2 text-xs font-medium self-end md:self-center">
              <span className="text-slate-500">
                Showing <strong className="text-slate-900 dark:text-white font-bold">{activeReportTab === 'EXTRA_FEES' ? filteredExtraWork.length : filteredTasks.length}</strong> of {activeReportTab === 'EXTRA_FEES' ? extraWork.length : baseTasksForTab.length} items
              </span>
              {(searchTerm || selectedCategory !== 'ALL') && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold text-[10px] border border-amber-500/30">
                  Filtered
                </span>
              )}
            </div>
          </div>

          {/* Category Tabs (GST | TDS | Income Tax | Audit | ROC) */}
          {activeReportTab !== 'EXTRA_FEES' && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 pb-1 shrink-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                <Filter size={11} /> Category:
              </span>
              {categoryTabs.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedCategory(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap border shadow-sm ${
                    selectedCategory === tab.key
                      ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                      : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                  }`}
                >
                  {tab.label} <span className="opacity-70 font-mono">({tab.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable Report Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl scrollbar-thin">
          
          {activeReportTab === 'EXTRA_FEES' ? (
            /* Extra Fees Due Table */
            <table className="w-full min-w-[950px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase text-[11px] sticky top-0 z-10 shadow-sm">
                  <th className="p-3">Client</th>
                  <th className="p-3">Assignment / Extra Work</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Agreed Fee</th>
                  <th className="p-3 text-right">Advance Paid</th>
                  <th className="p-3 text-right text-red-600 dark:text-red-400">Balance Due</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Assigned Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredExtraWork.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No extra fee items found matching search.
                    </td>
                  </tr>
                ) : (
                  filteredExtraWork.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">
                        {item.clientName}
                      </td>
                      <td className="p-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{item.taskTitle}</p>
                        {item.description && (
                          <p className="text-[11px] text-slate-500 truncate max-w-sm">{item.description}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        ₹{item.agreedFee.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-semibold">
                        ₹{item.advanceReceived.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-red-600 dark:text-red-400">
                        ₹{item.balanceDue.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                        {item.assignedTeamName}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* Compliance Tasks Table */
            <table className="w-full min-w-[1050px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase text-[11px] sticky top-0 z-10 shadow-sm">
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3 min-w-[160px]">Client</th>
                  <th className="p-3 min-w-[155px]">Tax ID (PAN / GST / TAN)</th>
                  <th className="p-3 min-w-[240px]">Compliance Task</th>
                  <th className="p-3 min-w-[90px]">Category</th>
                  <th className="p-3 min-w-[140px]">Frequency & Due Date</th>
                  <th className="p-3 min-w-[125px]">Assigned Staff</th>
                  <th className="p-3 text-center min-w-[105px]">Status</th>
                  <th className="p-3 text-right min-w-[115px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      No tasks found matching your search and category filter.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task, idx) => (
                    <tr key={`${task.id || 'tsk'}-${task.clientId || task.clientName}-${task.category}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                      <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                          {task.clientName}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">{task.financialYear}</p>
                      </td>

                      {/* Task-Related Tax Statutory ID (PAN / GSTIN / TAN) */}
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
                                  <div className="text-[10px] text-slate-500 truncate max-w-[130px]">
                                    <span className="font-sans font-medium text-[9px]">GST: </span>{tax.gstin}
                                  </div>
                                )}
                              </div>
                            );
                          }
                        })()}
                      </td>

                      <td className="p-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{task.title}</p>
                        {task.description && (
                          <p className="text-[11px] text-slate-500 truncate max-w-sm">{task.description}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-bold border border-slate-200 dark:border-slate-700">
                          {task.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{task.dueDayOrDate}</span>
                        <p className="text-[10px] text-slate-500">{task.dueDate}</p>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                        {task.assignedTeamName}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                          task.status === 'DONE'
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                            : 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {task.status !== 'DONE' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'DONE', currentUser?.name || 'Staff')}
                              className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500 text-emerald-700 hover:text-white text-[11px] font-bold transition-all border border-emerald-500/30"
                            >
                              ✓ Done
                            </button>
                          )}
                          <button
                            onClick={() => { onClose(); onOpenTaskModal(task); }}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
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
          )}

        </div>

      </div>
    </div>
  );
};
