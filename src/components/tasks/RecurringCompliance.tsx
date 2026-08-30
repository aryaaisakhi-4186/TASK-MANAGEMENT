import React from 'react';
import { Calendar, Layers, Clock, Award, Sun, CalendarRange } from 'lucide-react';
import { TaskFrequency } from '../../types';

export type TaskTabType = 'ALL' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

interface Props {
  activeTab: TaskTabType;
  setActiveTab: (tab: TaskTabType) => void;
}

export const RecurringCompliance: React.FC<Props> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
      
      {/* 1. All Master Tasks */}
      <button
        onClick={() => setActiveTab('ALL')}
        className={`p-3.5 rounded-2xl border text-left transition-all ${
          activeTab === 'ALL'
            ? 'bg-amber-500/15 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
            : 'bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Complete</span>
          <Layers size={16} className={activeTab === 'ALL' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'} />
        </div>
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">All Items</h4>
        <p className="text-[10px] text-slate-500 truncate mt-0.5">Master compliance grid</p>
      </button>

      {/* 2. Daily Tasks */}
      <button
        onClick={() => setActiveTab('DAILY')}
        className={`p-3.5 rounded-2xl border text-left transition-all ${
          activeTab === 'DAILY'
            ? 'bg-amber-500/20 border-amber-500/70 shadow-md ring-1 ring-amber-500/40'
            : 'bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Daily</span>
          <Sun size={16} className={activeTab === 'DAILY' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'} />
        </div>
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">Daily Tasks</h4>
        <p className="text-[10px] text-slate-500 truncate mt-0.5">Bank feeds & vouching</p>
      </button>

      {/* 3. Weekly Tasks */}
      <button
        onClick={() => setActiveTab('WEEKLY')}
        className={`p-3.5 rounded-2xl border text-left transition-all ${
          activeTab === 'WEEKLY'
            ? 'bg-blue-500/15 border-blue-500/60 shadow-md ring-1 ring-blue-500/30'
            : 'bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Weekly</span>
          <Clock size={16} className={activeTab === 'WEEKLY' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
        </div>
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">Weekly Tasks</h4>
        <p className="text-[10px] text-slate-500 truncate mt-0.5">Weekday cadences</p>
      </button>

      {/* 4. Monthly Compliance */}
      <button
        onClick={() => setActiveTab('MONTHLY')}
        className={`p-3.5 rounded-2xl border text-left transition-all ${
          activeTab === 'MONTHLY'
            ? 'bg-purple-500/15 border-purple-500/60 shadow-md ring-1 ring-purple-500/30'
            : 'bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Monthly</span>
          <Calendar size={16} className={activeTab === 'MONTHLY' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'} />
        </div>
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">Monthly Returns</h4>
        <p className="text-[10px] text-slate-500 truncate mt-0.5">7th TDS, 11th GSTR, 20th 3B</p>
      </button>

      {/* 5. Quarterly Compliance */}
      <button
        onClick={() => setActiveTab('QUARTERLY')}
        className={`p-3.5 rounded-2xl border text-left transition-all ${
          activeTab === 'QUARTERLY'
            ? 'bg-teal-500/15 border-teal-500/60 shadow-md ring-1 ring-teal-500/30'
            : 'bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">Quarterly</span>
          <CalendarRange size={16} className={activeTab === 'QUARTERLY' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'} />
        </div>
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">Quarterly Tasks</h4>
        <p className="text-[10px] text-slate-500 truncate mt-0.5">24Q/26Q, Adv Tax, CMP08</p>
      </button>

      {/* 6. Yearly / Annual Audit */}
      <button
        onClick={() => setActiveTab('YEARLY')}
        className={`p-3.5 rounded-2xl border text-left transition-all ${
          activeTab === 'YEARLY'
            ? 'bg-emerald-500/15 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/30'
            : 'bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Annual</span>
          <Award size={16} className={activeTab === 'YEARLY' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
        </div>
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">Annual Audit</h4>
        <p className="text-[10px] text-slate-500 truncate mt-0.5">Tax Audit, ITR, Form 11</p>
      </button>

    </div>
  );
};
