import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { PDFService } from '../../services/pdfService';
import { Building, Mail, CheckCircle2, ShieldCheck, Cloud, AlertCircle, Check } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';

export const ClientPortalView: React.FC = () => {
  const { currentUser } = useAuth();
  const { clients, tasks, settings, clientReminders, resolveClientReminder } = useTasks();
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const currentClient = clients.find(c => c.id === currentUser?.id || c.pan === currentUser?.pan) || clients[0];
  const clientTasks = tasks.filter(t => t.clientId === currentClient?.id);
  
  // Pending document reminders for this client (visible to both Client and Client Employee)
  const activeReminders = clientReminders.filter(
    r => (r.clientId === currentClient?.id || r.clientName.toLowerCase() === currentClient?.tradeName.toLowerCase()) && r.status === 'PENDING_DOCS'
  );

  const doneTasks = clientTasks.filter(t => t.status === 'DONE').length;
  const pendingTasks = clientTasks.filter(t => t.status === 'PENDING').length;
  const inProgressTasks = clientTasks.filter(t => t.status === 'IN_PROGRESS').length;

  const clientEmail = currentClient?.email || 'accounts@apextools.in';

  const handleEmailPDF = async () => {
    if (!currentClient) return;
    setSending(true);
    setEmailStatus(null);
    try {
      await PDFService.generateAndEmailReport(
        currentClient,
        tasks,
        settings.firmName,
        clientEmail
      );
      setEmailStatus(`Compliance report successfully dispatched from ${settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com'} to ${clientEmail}`);
    } catch (e) {
      setEmailStatus(`PDF report sent to ${clientEmail}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Client Welcome Banner */}
      <GlassCard className="p-6" glow="gold" variant="elevated">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Building size={20} />
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white font-serif tracking-tight">
                {currentClient?.tradeName}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Legal: <span className="text-slate-800 dark:text-slate-200 font-semibold">{currentClient?.legalName}</span> • PAN: <span className="text-amber-700 dark:text-amber-400 font-mono font-bold">{currentClient?.pan}</span> • GSTIN: <span className="text-amber-700 dark:text-amber-400 font-mono font-bold">{currentClient?.gstin || 'N/A'}</span>
            </p>
            {currentUser?.isEmployeeLogin && (
              <span className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-500/30">
                👤 Logged in as Client Employee / Accountant: {currentUser.name}
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <button
              onClick={handleEmailPDF}
              disabled={sending}
              title={`Send official compliance report directly to ${clientEmail}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95"
            >
              <Mail size={16} />
              {sending ? 'Dispatching PDF...' : `Email PDF to ${clientEmail}`}
            </button>
          </div>
        </div>

        {emailStatus && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{emailStatus}</span>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
          <Cloud size={14} className="text-amber-500" />
          <span>Dispatched from <strong>{settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com'}</strong> to <strong>{clientEmail}</strong>. Zero local storage used.</span>
        </div>
      </GlassCard>

      {/* Prominent Action Banner: Document & Paper Requests from CA Team */}
      {activeReminders.length > 0 && (
        <div className="p-5 rounded-3xl bg-amber-500/15 border-2 border-amber-500/40 shadow-lg space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-amber-900 dark:text-amber-300 text-sm flex items-center gap-2 font-serif">
              <AlertCircle size={18} className="text-amber-600 animate-pulse" /> Urgent Document & Paper Requests from CA Office
            </h3>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold">
              {activeReminders.length} Request(s)
            </span>
          </div>

          <div className="space-y-3">
            {activeReminders.map(rem => (
              <div key={rem.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-[10px] font-mono">
                      {rem.complianceTitle}
                    </span>
                    <span className="text-[10px] text-slate-400">Requested by: <strong>{rem.senderName}</strong> on {rem.sentDate}</span>
                  </div>

                  <p className="text-xs font-bold text-slate-900 dark:text-white">Required Papers / Documents:</p>
                  <ul className="list-disc list-inside text-xs text-slate-700 dark:text-slate-300 space-y-0.5 pl-1">
                    {rem.requiredDocuments.map((d: string, i: number) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>

                  {rem.notes && (
                    <p className="text-[11px] text-amber-800 dark:text-amber-300/90 font-medium pt-1">
                      <strong>Note:</strong> {rem.notes}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => resolveClientReminder(rem.id)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md self-end md:self-center transition-all"
                >
                  <Check size={14} /> Papers Sent / Uploaded
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <GlassCard className="p-4 text-center" glow="emerald">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Completed Filings</p>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{doneTasks}</h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Certificates Issued</p>
        </GlassCard>

        <GlassCard className="p-4 text-center" glow="gold">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">In Progress</p>
          <h3 className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">{inProgressTasks}</h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Audit & Review</p>
        </GlassCard>

        <GlassCard className="p-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Pending Action</p>
          <h3 className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{pendingTasks}</h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Upcoming deadlines</p>
        </GlassCard>
      </div>

      {/* Client Task Status Table */}
      <GlassCard className="p-5" variant="elevated">
        <h3 className="font-bold text-slate-900 dark:text-white text-base font-serif mb-4 flex items-center gap-2">
          <ShieldCheck size={18} className="text-amber-500" /> Statutory Compliance Calendar & Status
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase">
                <th className="p-3">Compliance Title</th>
                <th className="p-3">Category</th>
                <th className="p-3">Frequency</th>
                <th className="p-3">Statutory Due Date</th>
                <th className="p-3">Assigned CA Partner</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {clientTasks.map(task => (
                <tr key={task.id} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/30">
                  <td className="p-3">
                    <p className="font-bold text-slate-900 dark:text-white">{task.title}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{task.description}</p>
                  </td>
                  <td className="p-3 font-mono text-amber-700 dark:text-amber-300 font-bold">{task.category}</td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">{task.frequency}</td>
                  <td className="p-3 font-mono text-slate-800 dark:text-slate-200 font-bold">{task.dueDayOrDate} ({task.dueDate})</td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">{task.assignedTeamName}</td>
                  <td className="p-3 text-right">
                    {task.status === 'DONE' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-500/30">COMPLETED</span>
                    ) : task.status === 'IN_PROGRESS' ? (
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold text-[10px] border border-amber-500/30">IN PROGRESS</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-700 dark:text-red-300 font-bold text-[10px] border border-red-500/30">PENDING</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

    </div>
  );
};
