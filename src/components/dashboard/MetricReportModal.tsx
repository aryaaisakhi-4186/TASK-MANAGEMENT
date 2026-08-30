import React, { useState, useMemo } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { TaskItem, TaskStatus, ExtraWorkItem } from '../../types';
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
  DollarSign
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
  const [searchTerm, setSearchTerm] = useState('');

  useEscapeKey(onClose, isOpen);

  const visibleTasks = (currentRole === 'TEAM' && currentUser)
    ? tasks.filter(t => t.assignedTeamId === currentUser.id)
    : tasks;

  // Filter tasks based on selected metric
  const filteredTasks = useMemo(() => {
    let list: TaskItem[] = [];
    if (reportType === 'COMPLIANCE_DONE') {
      list = visibleTasks.filter(t => t.status === 'DONE');
    } else if (reportType === 'IN_PROGRESS') {
      list = visibleTasks.filter(t => t.status === 'IN_PROGRESS');
    } else if (reportType === 'ACTION_PENDING') {
      list = visibleTasks.filter(t => t.status === 'PENDING');
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(t => 
        t.title.toLowerCase().includes(q) ||
        t.clientName.toLowerCase().includes(q) ||
        t.assignedTeamName.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [visibleTasks, reportType, searchTerm]);

  // Filter extra work items if reportType === 'EXTRA_FEES'
  const filteredExtraWork = useMemo(() => {
    if (reportType !== 'EXTRA_FEES') return [];
    let list = extraWork;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(w =>
        w.taskTitle.toLowerCase().includes(q) ||
        w.clientName.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [extraWork, reportType, searchTerm]);

  if (!isOpen || !reportType) return null;

  // Header Details
  const getHeaderInfo = () => {
    switch (reportType) {
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

  // Export Extra Work to Excel
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
    XLSX.writeFile(workbook, `TASK-VAANI_Extra_Fees_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in zoom-in-95 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1550px] bg-white dark:bg-slate-900 border border-amber-400/40 rounded-3xl p-5 md:p-7 shadow-2xl max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          title="Close"
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 pr-10">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl border ${headerInfo.bgBadge}`}>
              {headerInfo.icon}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">
                {headerInfo.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {headerInfo.subtitle}
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {reportType === 'EXTRA_FEES' ? (
              <button
                onClick={handleExportExtraWorkExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all"
              >
                <FileSpreadsheet size={15} /> Export Report (.xlsx)
              </button>
            ) : (
              <button
                onClick={() => exportTasksToExcel(filteredTasks, reportType)}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all"
              >
                <FileSpreadsheet size={15} /> Export Report ({filteredTasks.length})
              </button>
            )}
          </div>
        </div>

        {/* Search Bar & Stats */}
        <div className="my-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full max-w-lg">
            <Search size={16} className="absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by client, compliance title, staff, or category..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900 dark:text-white">{reportType === 'EXTRA_FEES' ? filteredExtraWork.length : filteredTasks.length}</strong> items
          </div>
        </div>

        {/* Scrollable Report Content */}
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-[350px] border border-slate-200 dark:border-slate-800 rounded-2xl">
          
          {reportType === 'EXTRA_FEES' ? (
            /* Extra Fees Due Table */
            <table className="w-full min-w-[950px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase text-[11px] sticky top-0 z-10 shadow-sm">
                  <th className="p-3.5">Client</th>
                  <th className="p-3.5">Assignment / Extra Work</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5 text-right">Agreed Fee</th>
                  <th className="p-3.5 text-right">Advance Paid</th>
                  <th className="p-3.5 text-right text-red-600 dark:text-red-400">Balance Due</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5">Assigned Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredExtraWork.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No extra fee items found.
                    </td>
                  </tr>
                ) : (
                  filteredExtraWork.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                        {item.clientName}
                      </td>
                      <td className="p-3.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{item.taskTitle}</p>
                        {item.description && (
                          <p className="text-[11px] text-slate-500 truncate max-w-sm">{item.description}</p>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        ₹{item.agreedFee.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5 text-right font-mono text-emerald-600 font-semibold">
                        ₹{item.advanceReceived.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-red-600 dark:text-red-400">
                        ₹{item.balanceDue.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">
                        {item.assignedTeamName}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* Compliance Tasks Table */
            <table className="w-full min-w-[1000px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase text-[11px] sticky top-0 z-10 shadow-sm">
                  <th className="p-3.5 w-10 text-center">#</th>
                  <th className="p-3.5 min-w-[160px]">Client</th>
                  <th className="p-3.5 min-w-[260px]">Compliance Task</th>
                  <th className="p-3.5 min-w-[100px]">Category</th>
                  <th className="p-3.5 min-w-[150px]">Frequency & Due Date</th>
                  <th className="p-3.5 min-w-[130px]">Assigned Staff</th>
                  <th className="p-3.5 text-center min-w-[110px]">Status</th>
                  <th className="p-3.5 text-right min-w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No tasks found in this statement.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task, idx) => (
                    <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                      <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                          {task.clientName}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">{task.financialYear}</p>
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
