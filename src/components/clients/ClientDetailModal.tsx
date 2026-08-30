import React from 'react';
import { Client } from '../../types';
import { useTasks } from '../../context/TaskContext';
import { X, Building, CalendarCheck2 } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  client: Client | null;
  onClose: () => void;
}

export const ClientDetailModal: React.FC<Props> = ({ isOpen, client, onClose }) => {
  const { tasks } = useTasks();
  useEscapeKey(onClose, isOpen);

  if (!isOpen || !client) return null;

  const clientTasks = tasks.filter(t => t.clientId === client.id);
  const doneCount = clientTasks.filter(t => t.status === 'DONE').length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in zoom-in-95 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-amber-400/40 rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} title="Close" className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800">
          <X size={18} />
        </button>

        <div className="flex items-start gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Building size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">{client.tradeName}</h3>
            <p className="text-xs text-slate-500 font-semibold">{client.legalName} • <span className="text-amber-700 dark:text-amber-400 font-mono font-bold">PAN: {client.pan}</span></p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Entity Type</p>
            <p className="font-bold text-slate-900 dark:text-white mt-0.5">{client.category}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">GSTIN</p>
            <p className="font-bold font-mono text-slate-900 dark:text-white mt-0.5">{client.gstin || 'N/A'}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Assigned Staff</p>
            <p className="font-bold text-slate-900 dark:text-white mt-0.5">{client.assignedTeamName}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Compliance Ratio</p>
            <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{doneCount} / {clientTasks.length} Done</p>
          </div>
        </div>

        {/* Tasks List */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <CalendarCheck2 size={14} className="text-amber-500" /> Active Statutory Tasks ({clientTasks.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {clientTasks.map(t => (
              <div key={t.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{t.title}</p>
                  <p className="text-[10px] text-slate-500">Due: {t.dueDayOrDate} ({t.dueDate}) • {t.category}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  t.status === 'DONE' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' :
                  t.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'bg-red-500/20 text-red-700 dark:text-red-300'
                }`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
