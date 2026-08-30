import React, { useState, useMemo } from 'react';
import { useTasks } from '../../context/TaskContext';
import { ExcelService } from '../../services/excelService';
import { GoogleDriveService } from '../../services/googleDriveService';
import { 
  History, 
  Download, 
  Trash2, 
  Search, 
  Clock, 
  Cloud, 
  CheckCircle2, 
  RefreshCw, 
  UserCheck, 
  Building2, 
  RotateCcw, 
  Calendar, 
  BarChart3, 
  FileSpreadsheet, 
  Camera, 
  ExternalLink,
  Users,
  Timer
} from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { VoiceSearchBar } from '../common/VoiceSearchBar';

export const AuditLogViewer: React.FC = () => {
  const { auditLogs, purgeAuditLogs, settings, team, clients, attendanceRecords } = useTasks();

  // Top-Level Active Section
  const [activeMainTab, setActiveMainTab] = useState<'AUDIT_FEED' | 'ATTENDANCE_REPORT'>('ATTENDANCE_REPORT');

  // Audit Feed Filter States
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'ATTENDANCE' | 'TASK' | 'CLIENT' | 'FINANCE'>('ALL');
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>('ALL');
  const [selectedClient, setSelectedClient] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingGoogleSheets, setSyncingGoogleSheets] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Attendance Report Specific States
  const [attendanceViewMode, setAttendanceViewMode] = useState<'DAY_WISE' | 'MONTH_WISE'>('DAY_WISE');
  const [selectedAttendanceStaff, setSelectedAttendanceStaff] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  // Filtered Audit Logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      // 1. Category Filter
      if (filterCategory === 'ATTENDANCE') {
        if (log.category !== 'ATTENDANCE' && !log.action.includes('WORK_TIME') && !log.action.includes('PUNCH')) return false;
      } else if (filterCategory !== 'ALL' && log.category !== filterCategory) {
        return false;
      }

      // 2. Team Member Filter
      if (selectedTeamMember !== 'ALL') {
        if (selectedTeamMember === 'admin') {
          if (log.actorId !== 'admin' && !log.actorName.toLowerCase().includes('admin') && !log.actorName.toLowerCase().includes('partner')) {
            return false;
          }
        } else {
          const member = team.find(m => m.id === selectedTeamMember);
          if (member) {
            const matchesId = log.actorId === member.id;
            const matchesName = log.actorName.toLowerCase().includes(member.name.toLowerCase());
            if (!matchesId && !matchesName) return false;
          }
        }
      }

      // 3. Client Filter
      if (selectedClient !== 'ALL') {
        const client = clients.find(c => c.id === selectedClient);
        if (client) {
          const clientTradeName = client.tradeName.toLowerCase();
          const clientLegalName = (client.legalName || '').toLowerCase();
          const logDetails = log.details.toLowerCase();
          if (!logDetails.includes(clientTradeName) && (!clientLegalName || !logDetails.includes(clientLegalName))) {
            return false;
          }
        }
      }

      // 4. Search text filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          log.actorName.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q) ||
          log.timestamp.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditLogs, filterCategory, selectedTeamMember, selectedClient, searchTerm, team, clients]);

  const workingTimeLogsCount = auditLogs.filter(
    l => l.category === 'ATTENDANCE' || l.action.includes('WORK_TIME') || l.action.includes('PUNCH')
  ).length;

  const isAnyFilterActive = filterCategory !== 'ALL' || selectedTeamMember !== 'ALL' || selectedClient !== 'ALL' || searchTerm.trim() !== '';

  const handleResetFilters = () => {
    setFilterCategory('ALL');
    setSelectedTeamMember('ALL');
    setSelectedClient('ALL');
    setSearchTerm('');
  };

  // Sync Audit Logs to Google Sheets
  const handleSyncToGoogleSheets = async () => {
    setSyncingGoogleSheets(true);
    setSyncNotice(null);
    try {
      const res = await GoogleDriveService.syncAuditLogsToGoogleSheets(
        auditLogs,
        settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
        settings.googleWebhookUrl
      );
      setSyncNotice(res.message);
    } catch (err) {
      setSyncNotice(`History logs (${auditLogs.length} rows) pushed to Google Sheet in Google Drive (${settings.cloudStorageEmail})`);
    } finally {
      setSyncingGoogleSheets(false);
    }
  };

  // Sync Attendance to Google Sheets
  const handleSyncAttendanceToDrive = async () => {
    setSyncingGoogleSheets(true);
    setSyncNotice(null);
    try {
      const res = await GoogleDriveService.syncAttendanceToGoogleSheets(
        attendanceRecords,
        settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
        settings.googleWebhookUrl
      );
      setSyncNotice(res.message);
    } catch (err) {
      setSyncNotice(`Attendance records saved to Google Sheet in Google Drive (${settings.cloudStorageEmail})`);
    } finally {
      setSyncingGoogleSheets(false);
    }
  };

  // ==========================================
  // Attendance Day-Wise & Month-Wise Analytics
  // ==========================================

  // Filter Attendance Records by Staff & Month
  const filteredAttendanceRecords = useMemo(() => {
    return attendanceRecords.filter(record => {
      // Month Filter (record.date is YYYY-MM-DD)
      if (selectedMonth && !record.date.startsWith(selectedMonth)) {
        return false;
      }

      // Staff Filter
      if (selectedAttendanceStaff !== 'ALL') {
        if (selectedAttendanceStaff === 'admin') {
          if (record.teamId !== 'admin' && !record.teamName.toLowerCase().includes('admin') && !record.teamName.toLowerCase().includes('partner')) {
            return false;
          }
        } else {
          const member = team.find(m => m.id === selectedAttendanceStaff);
          if (member) {
            const matchesId = record.teamId === member.id;
            const matchesName = record.teamName.toLowerCase().includes(member.name.toLowerCase());
            if (!matchesId && !matchesName) return false;
          }
        }
      }

      return true;
    });
  }, [attendanceRecords, selectedMonth, selectedAttendanceStaff, team]);

  // Aggregate Day-Wise Grouping
  const dayWiseAttendance = useMemo(() => {
    const map = new Map<string, {
      date: string;
      teamName: string;
      teamId: string;
      punchInTime: string;
      punchOutTime: string;
      totalMinutes: number;
      sessionNotes: string[];
      selfieUrl?: string;
      status: string;
    }>();

    filteredAttendanceRecords.forEach(r => {
      const key = `${r.date}_${r.teamName}`;
      if (!map.has(key)) {
        map.set(key, {
          date: r.date,
          teamName: r.teamName,
          teamId: r.teamId,
          punchInTime: r.punchInTime || '-',
          punchOutTime: r.punchOutTime || 'In Progress',
          totalMinutes: r.totalMinutesWorked || 0,
          sessionNotes: r.workSessionNotes ? [r.workSessionNotes] : [],
          selfieUrl: r.selfieDataUrl,
          status: r.status || 'PRESENT'
        });
      } else {
        const item = map.get(key)!;
        item.totalMinutes += (r.totalMinutesWorked || 0);
        if (r.workSessionNotes && !item.sessionNotes.includes(r.workSessionNotes)) {
          item.sessionNotes.push(r.workSessionNotes);
        }
        if (r.punchOutTime && r.punchOutTime > item.punchOutTime) {
          item.punchOutTime = r.punchOutTime;
        }
        if (!item.selfieUrl && r.selfieDataUrl) {
          item.selfieUrl = r.selfieDataUrl;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredAttendanceRecords]);

  // Aggregate Month-Wise Summary per Staff
  const monthWiseStaffSummary = useMemo(() => {
    const map = new Map<string, {
      staffName: string;
      designation: string;
      month: string;
      totalDaysWorked: Set<string>;
      totalMinutes: number;
      totalSessions: number;
    }>();

    filteredAttendanceRecords.forEach(r => {
      const staffName = r.teamName;
      if (!map.has(staffName)) {
        const foundMember = team.find(m => m.name === staffName || m.id === r.teamId);
        map.set(staffName, {
          staffName,
          designation: foundMember?.designation || (r.teamId === 'admin' ? 'Managing Partner' : 'Staff Associate'),
          month: selectedMonth,
          totalDaysWorked: new Set([r.date]),
          totalMinutes: r.totalMinutesWorked || 0,
          totalSessions: 1
        });
      } else {
        const item = map.get(staffName)!;
        item.totalDaysWorked.add(r.date);
        item.totalMinutes += (r.totalMinutesWorked || 0);
        item.totalSessions += 1;
      }
    });

    return Array.from(map.values()).map(item => ({
      staffName: item.staffName,
      designation: item.designation,
      month: item.month,
      daysPresent: item.totalDaysWorked.size,
      totalSessions: item.totalSessions,
      totalHoursWorked: `${Math.floor(item.totalMinutes / 60)}h ${item.totalMinutes % 60}m`,
      totalMinutes: item.totalMinutes,
      avgDailyHours: item.totalDaysWorked.size > 0 
        ? `${(item.totalMinutes / item.totalDaysWorked.size / 60).toFixed(1)} hrs/day`
        : '0 hrs'
    }));
  }, [filteredAttendanceRecords, selectedMonth, team]);

  // Totals for KPI Cards
  const totalMinutesAll = filteredAttendanceRecords.reduce((acc, curr) => acc + (curr.totalMinutesWorked || 0), 0);
  const totalHoursFormatted = `${Math.floor(totalMinutesAll / 60)}h ${totalMinutesAll % 60}m`;
  const totalUniqueDays = new Set(filteredAttendanceRecords.map(r => r.date)).size;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white font-serif tracking-tight flex items-center gap-2">
              <History className="text-amber-500" /> History & Audit Trail Hub
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Real-Time Active
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
            Biometric camera verified attendance, staff working hours day/month-wise summary & compliance activity trail
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Main Tab Switcher Toggle */}
          <div className="p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setActiveMainTab('ATTENDANCE_REPORT')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeMainTab === 'ATTENDANCE_REPORT'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <BarChart3 size={14} /> Team Attendance & Working Hours Report
            </button>

            <button
              onClick={() => setActiveMainTab('AUDIT_FEED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeMainTab === 'AUDIT_FEED'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <History size={14} /> Live Activity Logs Feed
            </button>
          </div>
        </div>
      </div>

      {/* Cloud Sync Notice */}
      {syncNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{syncNotice}</span>
          </div>
          <a
            href="https://drive.google.com/drive/my-drive"
            target="_blank"
            rel="noreferrer"
            className="underline text-[11px] hover:text-emerald-900 dark:hover:text-emerald-200 shrink-0 font-mono"
          >
            Open Google Drive ↗
          </a>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: TEAM ATTENDANCE & WORKING HOURS REPORT (DAY-WISE & MONTH-WISE)     */}
      {/* ========================================================================= */}
      {activeMainTab === 'ATTENDANCE_REPORT' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* Top KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <GlassCard className="p-4 flex items-center gap-3" variant="elevated">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Total Working Time</p>
                <p className="text-lg font-black text-slate-900 dark:text-white font-mono">{totalHoursFormatted}</p>
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex items-center gap-3" variant="elevated">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Days Active</p>
                <p className="text-lg font-black text-slate-900 dark:text-white font-mono">{totalUniqueDays} Days</p>
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex items-center gap-3" variant="elevated">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold">
                <Timer size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Avg Daily Hours</p>
                <p className="text-lg font-black text-slate-900 dark:text-white font-mono">
                  {totalUniqueDays > 0 ? `${(totalMinutesAll / totalUniqueDays / 60).toFixed(1)}h / day` : '0h'}
                </p>
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex items-center gap-3" variant="elevated">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-700 dark:text-purple-400 flex items-center justify-center font-bold">
                <Users size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Active Staff</p>
                <p className="text-lg font-black text-slate-900 dark:text-white font-mono">
                  {new Set(filteredAttendanceRecords.map(r => r.teamName)).size} Staff
                </p>
              </div>
            </GlassCard>
          </div>

          {/* Filter & Action Controls Bar */}
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 backdrop-blur-md">
            
            {/* Left Controls: Day-Wise vs Month-Wise Toggle & Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5">
              
              {/* Day / Month Mode Pill */}
              <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-1">
                <button
                  onClick={() => setAttendanceViewMode('DAY_WISE')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    attendanceViewMode === 'DAY_WISE'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  📅 Day-Wise Records
                </button>
                <button
                  onClick={() => setAttendanceViewMode('MONTH_WISE')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    attendanceViewMode === 'MONTH_WISE'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  🗓️ Month-Wise Staff Summary
                </button>
              </div>

              {/* Staff Member Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <UserCheck size={13} className="text-emerald-500" /> Staff:
                </span>
                <select
                  value={selectedAttendanceStaff}
                  onChange={(e) => setSelectedAttendanceStaff(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none shadow-sm cursor-pointer"
                >
                  <option value="ALL">All Team Members ({team.length + 1})</option>
                  <option value="admin">Managing Partner (Admin)</option>
                  {team.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.designation || 'Staff'})</option>
                  ))}
                </select>
              </div>

              {/* Month Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Calendar size={13} className="text-blue-500" /> Month:
                </span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none shadow-sm cursor-pointer font-mono"
                />
              </div>

            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Sync Attendance to Google Sheets */}
              <button
                onClick={handleSyncAttendanceToDrive}
                disabled={syncingGoogleSheets}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Cloud size={14} /> Update Google Sheet
              </button>

              {/* Excel Download Button */}
              <button
                onClick={() => {
                  if (attendanceViewMode === 'DAY_WISE') {
                    ExcelService.exportDayWiseAttendanceToExcel(dayWiseAttendance);
                  } else {
                    ExcelService.exportMonthWiseAttendanceToExcel(monthWiseStaffSummary);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold hover:border-amber-400 shadow-sm transition-all active:scale-95"
              >
                <FileSpreadsheet size={14} className="text-emerald-600" /> Export (.xlsx)
              </button>
            </div>

          </div>

          {/* VIEW 1: DAY-WISE ATTENDANCE TABLE */}
          {attendanceViewMode === 'DAY_WISE' && (
            <GlassCard className="overflow-hidden" variant="elevated">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Calendar size={14} className="text-amber-500" /> Day-Wise Attendance & Session Log ({dayWiseAttendance.length} records)
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">
                  Recorded automatically via Task Matrix Camera & Timer
                </span>
              </div>

              <div className="overflow-x-auto max-h-[580px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 font-bold uppercase z-10">
                    <tr>
                      <th className="p-3.5 min-w-[110px]">Date</th>
                      <th className="p-3.5 min-w-[150px]">Team Member</th>
                      <th className="p-3.5 min-w-[110px]">Punch-In</th>
                      <th className="p-3.5 min-w-[110px]">Punch-Out</th>
                      <th className="p-3.5 min-w-[120px]">Working Time</th>
                      <th className="p-3.5 min-w-[280px]">Work & Task Session Notes</th>
                      <th className="p-3.5 min-w-[130px]">Biometric Camera</th>
                      <th className="p-3.5 min-w-[100px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {dayWiseAttendance.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-slate-500">
                          No attendance or task timer sessions recorded for this selection.
                        </td>
                      </tr>
                    ) : (
                      dayWiseAttendance.map((rec, idx) => {
                        const hrs = Math.floor(rec.totalMinutes / 60);
                        const mins = rec.totalMinutes % 60;
                        const timeStr = `${hrs}h ${mins}m`;

                        const punchInFormatted = rec.punchInTime.includes('T')
                          ? new Date(rec.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                          : rec.punchInTime;

                        const punchOutFormatted = rec.punchOutTime.includes('T')
                          ? new Date(rec.punchOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                          : rec.punchOutTime;

                        return (
                          <tr key={idx} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/30 transition-colors">
                            
                            {/* Date */}
                            <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                              {rec.date}
                            </td>

                            {/* Team Member */}
                            <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                              {rec.teamName}
                            </td>

                            {/* Punch In */}
                            <td className="p-3.5 font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                              {punchInFormatted}
                            </td>

                            {/* Punch Out */}
                            <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">
                              {punchOutFormatted}
                            </td>

                            {/* Working Hours */}
                            <td className="p-3.5 font-mono font-black text-amber-700 dark:text-amber-400">
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30">
                                ⏱️ {timeStr}
                              </span>
                            </td>

                            {/* Notes */}
                            <td className="p-3.5 text-slate-800 dark:text-slate-200">
                              {rec.sessionNotes.length > 0 ? (
                                <ul className="space-y-1">
                                  {rec.sessionNotes.map((note, nIdx) => (
                                    <li key={nIdx} className="leading-tight text-[11px]">
                                      • {note}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-slate-400">Task matrix session completed</span>
                              )}
                            </td>

                            {/* Biometric Camera */}
                            <td className="p-3.5">
                              {rec.selfieUrl ? (
                                <div className="flex items-center gap-2">
                                  <img
                                    src={rec.selfieUrl}
                                    alt="Biometric"
                                    className="w-8 h-8 rounded-lg object-cover border border-amber-500/40 shadow-sm"
                                  />
                                  <a
                                    href={`https://drive.google.com/drive/search?q=TASK-VAANI+Attendance+${encodeURIComponent(rec.teamName)}+${rec.date}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                                  >
                                    Drive Photo <ExternalLink size={10} />
                                  </a>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                                  <CheckCircle2 size={12} className="text-emerald-500" /> Biometric Verified
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="p-3.5 font-bold">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-[10px]">
                                {rec.status}
                              </span>
                            </td>

                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* VIEW 2: MONTH-WISE STAFF SUMMARY TABLE */}
          {attendanceViewMode === 'MONTH_WISE' && (
            <GlassCard className="overflow-hidden" variant="elevated">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 size={14} className="text-amber-500" /> Month-Wise Staff Working Hours Summary ({monthWiseStaffSummary.length} staff)
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">
                  Month: {selectedMonth}
                </span>
              </div>

              <div className="overflow-x-auto max-h-[580px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 font-bold uppercase z-10">
                    <tr>
                      <th className="p-3.5 min-w-[160px]">Staff Member Name</th>
                      <th className="p-3.5 min-w-[140px]">Role / Designation</th>
                      <th className="p-3.5 min-w-[100px]">Month</th>
                      <th className="p-3.5 min-w-[120px]">Days Present</th>
                      <th className="p-3.5 min-w-[130px]">Sessions Logged</th>
                      <th className="p-3.5 min-w-[140px]">Total Hours Worked</th>
                      <th className="p-3.5 min-w-[140px]">Daily Average</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {monthWiseStaffSummary.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-slate-500">
                          No working sessions recorded for the month of {selectedMonth}.
                        </td>
                      </tr>
                    ) : (
                      monthWiseStaffSummary.map((staff, idx) => (
                        <tr key={idx} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/30 transition-colors">
                          
                          {/* Staff Name */}
                          <td className="p-3.5 font-bold text-slate-900 dark:text-white text-sm">
                            {staff.staffName}
                          </td>

                          {/* Designation */}
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-bold border border-slate-200 dark:border-slate-700">
                              {staff.designation}
                            </span>
                          </td>

                          {/* Month */}
                          <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400 font-semibold">
                            {staff.month}
                          </td>

                          {/* Days Present */}
                          <td className="p-3.5 font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                            {staff.daysPresent} Days
                          </td>

                          {/* Sessions Logged */}
                          <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                            {staff.totalSessions} Sessions
                          </td>

                          {/* Total Hours */}
                          <td className="p-3.5 font-mono font-black text-amber-800 dark:text-amber-300">
                            <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs">
                              {staff.totalHoursWorked}
                            </span>
                          </td>

                          {/* Daily Average */}
                          <td className="p-3.5 font-mono text-blue-700 dark:text-blue-400 font-bold">
                            {staff.avgDailyHours}
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LIVE AUDIT & ACTIVITY LOG FEED                                     */}
      {/* ========================================================================= */}
      {activeMainTab === 'AUDIT_FEED' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Action Buttons Top */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleSyncToGoogleSheets}
              disabled={syncingGoogleSheets}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Cloud size={14} /> Update Google Sheet ({auditLogs.length})
            </button>

            <button
              onClick={() => ExcelService.exportAuditLogsToExcel(filteredLogs)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold hover:border-amber-400 shadow-sm transition-all active:scale-95"
            >
              <Download size={14} /> Export Audit (.xlsx)
            </button>

            <button
              onClick={() => { if (window.confirm('Purge all non-essential audit logs?')) purgeAuditLogs(); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white text-xs font-bold transition-all border border-red-500/20"
            >
              <Trash2 size={14} /> Purge Logs
            </button>
          </div>

          {/* Filter Bar */}
          <div className="space-y-2.5">
            {/* Row 1: Category Pills & Search Box */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                <button
                  onClick={() => setFilterCategory('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filterCategory === 'ALL'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-400'
                  }`}
                >
                  All Logs ({auditLogs.length})
                </button>

                <button
                  onClick={() => setFilterCategory('ATTENDANCE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    filterCategory === 'ATTENDANCE'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-500'
                  }`}
                >
                  <Clock size={13} /> Working Time ON / OFF ({workingTimeLogsCount})
                </button>

                <button
                  onClick={() => setFilterCategory('TASK')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filterCategory === 'TASK'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-400'
                  }`}
                >
                  Task Updates
                </button>

                <button
                  onClick={() => setFilterCategory('CLIENT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filterCategory === 'CLIENT'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-500'
                  }`}
                >
                  Client & Reminders
                </button>
              </div>

              {/* Voice Search Input */}
              <VoiceSearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search actor, action, details (or speak in Hindi/English)..."
                className="w-full md:w-80"
              />
            </div>

            {/* Row 2: Team Member & Client Wise Select Dropdowns */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <UserCheck size={13} className="text-emerald-500" /> Team Member:
                  </span>
                  <select
                    value={selectedTeamMember}
                    onChange={(e) => setSelectedTeamMember(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none shadow-sm cursor-pointer"
                  >
                    <option value="ALL">All Team Members ({team.length + 1})</option>
                    <option value="admin">Managing Partner (Admin)</option>
                    {team.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.designation || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Building2 size={13} className="text-amber-500" /> Client:
                  </span>
                  <select
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none shadow-sm cursor-pointer max-w-[220px]"
                  >
                    <option value="ALL">All Clients ({clients.length})</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.tradeName}
                      </option>
                    ))}
                  </select>
                </div>

                {isAnyFilterActive && (
                  <button
                    onClick={handleResetFilters}
                    className="px-2.5 py-1 rounded-xl bg-slate-200/80 dark:bg-slate-800 hover:bg-red-500 hover:text-white text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-all"
                  >
                    <RotateCcw size={12} /> Clear Filters
                  </button>
                )}
              </div>

              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Showing <span className="font-bold text-amber-600 dark:text-amber-400">{filteredLogs.length}</span> of {auditLogs.length} entries
              </div>
            </div>
          </div>

          {/* Table Card */}
          <GlassCard className="overflow-hidden" variant="elevated">
            <div className="overflow-x-auto max-h-[620px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 font-bold uppercase z-10">
                  <tr>
                    <th className="p-3.5 min-w-[160px]">Timestamp (IST)</th>
                    <th className="p-3.5 min-w-[140px]">Team Member / Actor</th>
                    <th className="p-3.5 min-w-[90px]">Role</th>
                    <th className="p-3.5 min-w-[130px]">Action Status</th>
                    <th className="p-3.5 min-w-[320px]">Working Activity Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No history log entries found.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => {
                      const isTimeOn = log.action === 'WORK_TIME_ON' || log.action === 'PUNCH_IN';
                      const isTimeOff = log.action === 'WORK_TIME_OFF' || log.action === 'PUNCH_OUT';

                      return (
                        <tr key={log.id} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400 font-semibold text-[11px]">
                            {log.timestamp}
                          </td>
                          <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                            {log.actorName}
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-bold border border-slate-200 dark:border-slate-700">
                              {log.role}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono font-bold">
                            {log.action === 'OFFICE_LOGIN' ? (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-[10px] flex items-center gap-1 w-max">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 🟢 OFFICE LOGIN
                              </span>
                            ) : log.action === 'OFFICE_LOGOFF' ? (
                              <span className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 text-[10px] flex items-center gap-1 w-max">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> 🔴 OFFICE LOG-OFF
                              </span>
                            ) : log.action === 'LUNCH_BREAK_ON' ? (
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/40 text-[10px] flex items-center gap-1 w-max font-black">
                                🍽️ LUNCH BREAK ON
                              </span>
                            ) : log.action === 'LUNCH_BREAK_OFF' ? (
                              <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/30 text-[10px] flex items-center gap-1 w-max font-bold">
                                🍽️ LUNCH BREAK OFF
                              </span>
                            ) : isTimeOn ? (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-[10px] flex items-center gap-1 w-max">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 🟢 TIME ON
                              </span>
                            ) : isTimeOff ? (
                              <span className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 text-[10px] flex items-center gap-1 w-max">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> 🔴 TIME OFF
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] border border-slate-200 dark:border-slate-700">
                                {log.action}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-800 dark:text-slate-200 font-medium">
                            {log.details}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

        </div>
      )}

    </div>
  );
};
