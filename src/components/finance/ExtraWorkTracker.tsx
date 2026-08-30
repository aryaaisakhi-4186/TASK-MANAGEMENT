import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { ExcelService } from '../../services/excelService';
import { ExtraWorkItem } from '../../types';
import { IndianRupee, Plus, Download, Edit3, Trash2 } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { ExtraWorkModal } from './ExtraWorkModal';
import { VoiceSearchBar } from '../common/VoiceSearchBar';

export const ExtraWorkTracker: React.FC = () => {
  const { extraWork, deleteExtraWork } = useTasks();
  const { currentRole } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<ExtraWorkItem | null | 'NEW'>(null);

  const filteredExtraWork = extraWork.filter(item => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.taskTitle.toLowerCase().includes(q) ||
      item.clientName.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.assignedTeamName.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q)
    );
  });

  const totalFee = extraWork.reduce((a, c) => a + c.agreedFee, 0);
  const totalReceived = extraWork.reduce((a, c) => a + c.advanceReceived, 0);
  const totalDue = extraWork.reduce((a, c) => a + c.balanceDue, 0);

  const handleDelete = (id: string, title: string) => {
    if (window.confirm('Are you sure you want to delete assignment "' + title + '"?')) {
      deleteExtraWork(id);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-serif tracking-tight flex items-center gap-2">
            <IndianRupee className="text-amber-500" /> Financial Extra Work & Billing Tracker
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
            Track ad-hoc billable services: Income tax notices, company incorporations, GST revocation and advisory
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentRole === 'ADMIN' && (
            <button
              onClick={() => setSelectedItemForEdit('NEW')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95"
            >
              <Plus size={16} /> Record Extra Work
            </button>
          )}

          <button
            onClick={() => ExcelService.exportExtraWorkToExcel(extraWork)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:border-emerald-500 shadow-sm"
          >
            <Download size={14} /> Export Excel
          </button>
        </div>
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <GlassCard className="p-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Total Agreed Fees</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">₹{totalFee.toLocaleString('en-IN')}</h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{extraWork.length} Billable items</p>
        </GlassCard>

        <GlassCard className="p-4 text-center" glow="emerald">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Advance Received</p>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">₹{totalReceived.toLocaleString('en-IN')}</h3>
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400/80 font-bold">Realized Cashflow</p>
        </GlassCard>

        <GlassCard className="p-4 text-center" glow="gold">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Outstanding Balance</p>
          <h3 className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">₹{totalDue.toLocaleString('en-IN')}</h3>
          <p className="text-[10px] text-amber-700 dark:text-amber-400/80 font-bold">Receivable Upon Delivery</p>
        </GlassCard>
      </div>

      {/* Voice Search Bar for Extra Work */}
      <GlassCard className="p-4">
        <VoiceSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search by assignment, client, staff, category (or speak in Hindi/English)..."
          className="w-full md:w-96"
        />
      </GlassCard>

      {/* Extra Work Master Table with Edit & Delete */}
      <GlassCard className="overflow-hidden" variant="elevated">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="p-3.5">Client & Assignment</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Agreed Fee</th>
                <th className="p-3.5">Advance Recd</th>
                <th className="p-3.5">Balance Due</th>
                <th className="p-3.5">Assigned Staff</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredExtraWork.map(item => (
                <tr key={item.id} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/40 transition-colors group">
                  
                  <td className="p-3.5">
                    <p className="font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300">{item.taskTitle}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{item.clientName}</p>
                  </td>

                  <td className="p-3.5 font-mono text-amber-700 dark:text-amber-300 font-bold">{item.category}</td>
                  
                  <td className="p-3.5 font-bold text-slate-900 dark:text-white">₹{item.agreedFee.toLocaleString('en-IN')}</td>
                  
                  <td className="p-3.5 text-emerald-700 dark:text-emerald-400 font-bold">₹{item.advanceReceived.toLocaleString('en-IN')}</td>
                  
                  <td className="p-3.5 font-bold text-amber-700 dark:text-amber-400">₹{item.balanceDue.toLocaleString('en-IN')}</td>
                  
                  <td className="p-3.5 text-slate-700 dark:text-slate-300 font-semibold">
                    {item.assignedTeamName && item.assignedTeamName !== 'Unassigned' ? (
                      item.assignedTeamName
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 italic font-normal">-- Blank / Unassigned --</span>
                    )}
                  </td>
                  
                  <td className="p-3.5">
                    <span className={'px-2 py-0.5 rounded text-[10px] font-bold border ' + (
                      item.status === 'SETTLED' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' :
                      item.status === 'BILLED' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' :
                      'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                    )}>
                      {item.status}
                    </span>
                  </td>

                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Direct Edit Button */}
                      <button
                        onClick={() => setSelectedItemForEdit(item)}
                        title="Edit Assignment Details & Billing"
                        className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 font-bold transition-all border border-amber-500/30 flex items-center gap-1 text-[11px] px-2"
                      >
                        <Edit3 size={13} /> Edit
                      </button>

                      {currentRole === 'ADMIN' && (
                        <button
                          onClick={() => handleDelete(item.id, item.taskTitle)}
                          title="Delete Record"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white text-slate-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Edit / Create Extra Work Modal */}
      <ExtraWorkModal
        isOpen={selectedItemForEdit !== null}
        item={selectedItemForEdit === 'NEW' ? null : selectedItemForEdit}
        onClose={() => setSelectedItemForEdit(null)}
      />

    </div>
  );
};
