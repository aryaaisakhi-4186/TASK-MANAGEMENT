import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { TaskItem } from '../../types';
import { IndianGreeting } from '../common/IndianGreeting';
import { QuickMetrics } from './QuickMetrics';
import { TodayTomorrowFocus } from './TodayTomorrowFocus';
import { MetricReportModal, MetricReportType } from './MetricReportModal';
import { AnalogClock } from '../common/AnalogClock';
import { GlassCard } from '../common/GlassCard';
import { Shield, Calendar, ArrowRight } from 'lucide-react';

export const DashboardOverview: React.FC<{
  onOpenTaskModal: (task: TaskItem) => void;
  setActiveTab: (tab: string) => void;
}> = ({ onOpenTaskModal, setActiveTab }) => {
  const { currentUser } = useAuth();
  const { tasks, settings, updateSettings } = useTasks();
  const [now, setNow] = useState(new Date());
  const [selectedReportType, setSelectedReportType] = useState<MetricReportType | null>(null);

  const normalizeTaxYear = (val?: string | null): string => {
    if (!val) return 'Tax Year 2026-27';
    if (val.includes('2027-28')) return 'Tax Year 2027-28';
    if (val.includes('2026-27')) return 'Tax Year 2026-27';
    if (val.includes('2025-26')) return 'Tax Year 2025-26';
    if (val.includes('2024-25')) return 'Tax Year 2024-25';
    if (val.includes('2023-24')) return 'Tax Year 2023-24';
    if (val.includes('2022-23')) return 'Tax Year 2022-23';
    if (val.includes('2021-22')) return 'Tax Year 2021-22';
    if (val.includes('2020-21')) return 'Tax Year 2020-21';
    return val.startsWith('Tax Year') ? val : `Tax Year ${val}`;
  };

  const [selectedTaxYear, setSelectedTaxYear] = useState(() => {
    const raw = settings.selectedTaxYear || localStorage.getItem('taskvaani_selected_tax_year');
    return normalizeTaxYear(raw);
  });

  const handleTaxYearChange = (newYear: string) => {
    const normalized = normalizeTaxYear(newYear);
    setSelectedTaxYear(normalized);
    updateSettings({ selectedTaxYear: normalized });
    try {
      localStorage.setItem('taskvaani_selected_tax_year', normalized);
    } catch {}
  };

  useEffect(() => {
    if (settings.selectedTaxYear) {
      const normalized = normalizeTaxYear(settings.selectedTaxYear);
      if (normalized !== selectedTaxYear) {
        setSelectedTaxYear(normalized);
      }
    }
  }, [settings.selectedTaxYear]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = now.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <div className="space-y-6">
      
      {/* Header Banner with Greeting & Unified Wooden Analog Clock Card */}
      <GlassCard className="p-6 relative overflow-hidden" glow="gold" variant="elevated">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          
          {/* Left Greeting */}
          <div className="flex-1 w-full">
            <IndianGreeting userName={currentUser?.name} />
          </div>

          {/* Right Unified Clock & Live Date-Time Card */}
          <div className="w-full lg:w-auto bg-white/95 dark:bg-slate-950/85 p-4 rounded-3xl border border-amber-400/50 shadow-md dark:shadow-2xl flex flex-col gap-2.5 min-w-[320px]">
            
            {/* Top row: Analog Clock + Title */}
            <div className="flex items-center gap-3.5">
              <AnalogClock size={68} />
              <div className="text-left flex-1">
                <p className="text-xs font-serif font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">TASK-VAANI CHRONO</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Statutory 10:30 AM Chime</p>
                <div className="mt-1 inline-flex items-center gap-1 text-[9px] bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                  ● Auto-Sync Active
                </div>
              </div>
            </div>

            {/* Single Row: Live Date & Time directly below Clock */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 font-medium">
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="text-amber-500 shrink-0" />
                <span className="font-semibold text-slate-900 dark:text-white">{formattedDate}</span>
              </div>
              <span className="font-mono text-amber-700 dark:text-amber-400 font-bold tracking-wide">
                {formattedTime} (IST)
              </span>
            </div>

            {/* Statutory Tax Year Selector Row */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-amber-900 dark:text-amber-300 font-semibold gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <Shield size={13} className="text-amber-600 shrink-0" />
                <span className="font-bold whitespace-nowrap">Tax Year:</span>
              </div>
              <select
                value={selectedTaxYear}
                onChange={(e) => handleTaxYearChange(e.target.value)}
                className="w-full max-w-[210px] px-2.5 py-1 rounded-xl bg-amber-500/15 dark:bg-slate-900 border border-amber-500/40 text-slate-900 dark:text-amber-300 font-bold text-[11px] cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-sm transition-all"
              >
                <option value="Tax Year 2027-28">Tax Year 2027-28</option>
                <option value="Tax Year 2026-27">Tax Year 2026-27</option>
                <option value="Tax Year 2025-26">Tax Year 2025-26</option>
                <option value="Tax Year 2024-25">Tax Year 2024-25</option>
                <option value="Tax Year 2023-24">Tax Year 2023-24</option>
                <option value="Tax Year 2022-23">Tax Year 2022-23</option>
                <option value="Tax Year 2021-22">Tax Year 2021-22</option>
                <option value="Tax Year 2020-21">Tax Year 2020-21</option>
              </select>
            </div>

          </div>

        </div>
      </GlassCard>

      {/* Quick Metrics KPI Counters (Clickable) */}
      <QuickMetrics onSelectMetricReport={(type) => setSelectedReportType(type)} />

      {/* Today / Tomorrow Focus Section */}
      <TodayTomorrowFocus onOpenTaskModal={onOpenTaskModal} />

      {/* Quick Action Navigation Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard 
          onClick={() => setActiveTab('tasks')} 
          className="p-4 cursor-pointer hover:border-amber-500/50 transition-all flex items-center justify-between group"
        >
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-amber-600 dark:group-hover:text-amber-300">Open Task Matrix</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">View Weekly, Monthly (7th, 11th, 20th) & Yearly grid</p>
          </div>
          <ArrowRight size={18} className="text-slate-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
        </GlassCard>

        <GlassCard 
          onClick={() => setActiveTab('attendance')} 
          className="p-4 cursor-pointer hover:border-emerald-500/50 transition-all flex items-center justify-between group"
        >
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-300">Work Session & Selfie Attendance</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Punch-in with WebCam verification & timer</p>
          </div>
          <ArrowRight size={18} className="text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
        </GlassCard>

        <GlassCard 
          onClick={() => setActiveTab('ai-bot')} 
          className="p-4 cursor-pointer hover:border-blue-500/50 transition-all flex items-center justify-between group"
        >
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-300">Ask CA-CompliBot AI</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Get instant advice on IT Sections, GST & ROC</p>
          </div>
          <ArrowRight size={18} className="text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
        </GlassCard>
      </div>

      {/* Metric Drilldown Interactive Report Modal */}
      <MetricReportModal
        isOpen={selectedReportType !== null}
        reportType={selectedReportType}
        onClose={() => setSelectedReportType(null)}
        onOpenTaskModal={onOpenTaskModal}
      />

    </div>
  );
};
