import React from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, Clock, AlertTriangle, Users, IndianRupee, ArrowUpRight } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { MetricReportType } from './MetricReportModal';

interface Props {
  onSelectMetricReport?: (type: MetricReportType) => void;
}

export const QuickMetrics: React.FC<Props> = ({ onSelectMetricReport }) => {
  const { tasks, clients, extraWork } = useTasks();
  const { currentRole, currentUser } = useAuth();

  const visibleTasks = (currentRole === 'TEAM' && currentUser)
    ? tasks.filter(t => t.assignedTeamId === currentUser.id)
    : tasks;

  const totalTasks = visibleTasks.length;
  const completedTasks = visibleTasks.filter(t => t.status === 'DONE').length;
  const inProgressTasks = visibleTasks.filter(t => t.status === 'IN_PROGRESS').length;
  const pendingTasks = visibleTasks.filter(t => t.status === 'PENDING').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const totalExtraReceivable = extraWork.reduce((acc, curr) => acc + curr.balanceDue, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      
      {/* 1. Completed Compliance */}
      <GlassCard 
        onClick={() => onSelectMetricReport && onSelectMetricReport('COMPLIANCE_DONE')}
        className="p-4 relative overflow-hidden cursor-pointer hover:border-emerald-500/60 hover:shadow-lg hover:scale-[1.01] transition-all group" 
        glow="emerald"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors flex items-center gap-1">
              Compliance Done <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{completedTasks} <span className="text-xs text-slate-500 font-normal">/ {totalTasks}</span></h3>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">{completionRate}% Completed</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-white transition-all">
            <CheckCircle2 size={22} />
          </div>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }}></div>
        </div>
      </GlassCard>

      {/* 2. In Progress Work */}
      <GlassCard 
        onClick={() => onSelectMetricReport && onSelectMetricReport('IN_PROGRESS')}
        className="p-4 relative overflow-hidden cursor-pointer hover:border-amber-500/60 hover:shadow-lg hover:scale-[1.01] transition-all group" 
        glow="gold"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors flex items-center gap-1">
              In Progress <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <h3 className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">{inProgressTasks}</h3>
            <p className="text-[11px] text-amber-600 dark:text-amber-400/80 font-medium mt-0.5">Active audit & filings</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
            <Clock size={22} />
          </div>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${totalTasks > 0 ? (inProgressTasks/totalTasks)*100 : 0}%` }}></div>
        </div>
      </GlassCard>

      {/* 3. Pending / Overdue */}
      <GlassCard 
        onClick={() => onSelectMetricReport && onSelectMetricReport('ACTION_PENDING')}
        className="p-4 relative overflow-hidden cursor-pointer hover:border-red-500/60 hover:shadow-lg hover:scale-[1.01] transition-all group"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors flex items-center gap-1">
              Action Pending <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <h3 className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{pendingTasks}</h3>
            <p className="text-[11px] text-red-500 dark:text-red-400/80 font-medium mt-0.5">Challans & returns due</p>
          </div>
          <div className="p-2.5 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 group-hover:bg-red-500 group-hover:text-white transition-all">
            <AlertTriangle size={22} />
          </div>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${totalTasks > 0 ? (pendingTasks/totalTasks)*100 : 0}%` }}></div>
        </div>
      </GlassCard>

      {/* 4. Active Clients or Extra Work Fee */}
      <GlassCard 
        onClick={() => onSelectMetricReport && onSelectMetricReport('EXTRA_FEES')}
        className="p-4 relative overflow-hidden cursor-pointer hover:border-blue-500/60 hover:shadow-lg hover:scale-[1.01] transition-all group"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1">
              {currentRole === 'ADMIN' ? 'Extra Fees Due' : 'Active Retainers'} <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {currentRole === 'ADMIN' ? `₹${totalExtraReceivable.toLocaleString('en-IN')}` : clients.length}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {currentRole === 'ADMIN' ? `Across ${extraWork.length} ad-hoc items` : 'GST & Tax audit clients'}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 group-hover:bg-blue-500 group-hover:text-white transition-all">
            {currentRole === 'ADMIN' ? <IndianRupee size={22} /> : <Users size={22} />}
          </div>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div className="bg-blue-500 h-full rounded-full" style={{ width: '85%' }}></div>
        </div>
      </GlassCard>

    </div>
  );
};
