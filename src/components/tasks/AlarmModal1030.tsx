import React from 'react';
import { useNotification } from '../../context/NotificationContext';
import { useTasks } from '../../context/TaskContext';
import { Bell, X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export const AlarmModal1030: React.FC = () => {
  const { isAlarmOpen, dismissAlarm, snoozeAlarm } = useNotification();
  const { tasks } = useTasks();

  useEscapeKey(dismissAlarm, isAlarmOpen);

  if (!isAlarmOpen) return null;

  const alarmTasks = tasks.filter(t => t.status !== 'DONE').slice(0, 5);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in zoom-in-95 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) dismissAlarm(); }}
    >
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 shadow-[0_0_50px_rgba(245,158,11,0.3)] animate-bounce-subtle"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={dismissAlarm} title="Dismiss" className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 font-bold flex items-center justify-center shadow-lg shadow-amber-500/30 animate-pulse">
            <Bell size={24} />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-600 dark:text-amber-400 font-bold">10:30 AM STATUTORY ALARM</span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white font-serif">Daily Compliance Deadline Chime</h3>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 font-medium">
          Attention Partners & Article Assistants: Please review and execute today's priority statutory filings and reconciliations. (Press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 border rounded text-[10px]">Esc</kbd> to dismiss)
        </p>

        {/* Tasks List */}
        <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
          {alarmTasks.map(task => (
            <div key={task.id} className="p-3 rounded-xl bg-amber-50 dark:bg-slate-950 border border-amber-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{task.title}</p>
                <p className="text-[10px] text-slate-500">{task.clientName} • Due: {task.dueDayOrDate}</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                {task.category}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => snoozeAlarm(5)}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold"
            >
              Snooze (5m)
            </button>
            <button
              onClick={() => snoozeAlarm(15)}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold"
            >
              Snooze (15m)
            </button>
          </div>

          <button
            onClick={dismissAlarm}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/25"
          >
            Dismiss All
          </button>
        </div>

      </div>
    </div>
  );
};
