import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storage';
import { OnlineDataService } from '../../services/onlineDataService';
import { useTasks } from '../../context/TaskContext';
import { GuestLead } from '../../types';
import { 
  Users, 
  Calendar, 
  Clock, 
  Phone, 
  MessageCircle, 
  Mail, 
  X, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Sparkles,
  Plus,
  Check,
  Ban,
  MessageSquare,
  Edit3,
  Trash2,
  XCircle,
  Tag
} from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GuestLeadsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  useEscapeKey(onClose, isOpen);
  const { clients, tasks, team, extraWork, documents, attendanceRecords, settings } = useTasks();

  const [leads, setLeads] = useState<GuestLead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Remark Modal State
  const [activeLeadForRemark, setActiveLeadForRemark] = useState<GuestLead | null>(null);
  const [remarkInput, setRemarkInput] = useState('');

  // Reject Confirmation Modal State
  const [activeLeadForReject, setActiveLeadForReject] = useState<GuestLead | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  const syncAllData = (updatedLeads: GuestLead[]) => {
    OnlineDataService.scheduleAutoOnlineSync({
      clients,
      tasks,
      team,
      extraWork,
      documents,
      attendanceRecords,
      settings,
      guestLeads: updatedLeads
    });
  };

  const refreshLeads = () => {
    const latest = StorageService.getGuestLeads();
    setLeads(latest);
    syncAllData(latest);
  };

  useEffect(() => {
    if (isOpen) {
      refreshLeads();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExtendTrial = (leadId: string) => {
    const success = StorageService.extendGuestTrial(leadId, 15);
    if (success) {
      refreshLeads();
      setSuccessMsg('Trial successfully extended by +15 days!');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleAcceptLead = (leadId: string) => {
    StorageService.updateGuestLeadApproval(leadId, 'ACCEPTED');
    refreshLeads();
    setSuccessMsg('Guest Lead Accepted & Demo Activated!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLeadForReject) return;
    StorageService.updateGuestLeadApproval(activeLeadForReject.id, 'REJECTED', rejectReasonInput.trim());
    setActiveLeadForReject(null);
    setRejectReasonInput('');
    refreshLeads();
    setSuccessMsg('Guest Lead marked as Rejected/Deactivated.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleOpenRemark = (lead: GuestLead) => {
    setActiveLeadForRemark(lead);
    setRemarkInput(lead.remark || lead.notes || '');
  };

  const handleSaveRemark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLeadForRemark) return;
    StorageService.updateGuestLeadRemark(activeLeadForRemark.id, remarkInput.trim());
    setActiveLeadForRemark(null);
    setRemarkInput('');
    refreshLeads();
    setSuccessMsg('Lead Remark / Follow-up Note saved successfully!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleDeleteLead = (lead: GuestLead) => {
    if (window.confirm(`Are you sure you want to remove lead "${lead.name}" (${lead.phone})?`)) {
      StorageService.deleteGuestLead(lead.id);
      refreshLeads();
      setSuccessMsg('Guest lead deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const quickRemarkPresets = [
    'Called & Demo Explained',
    'Interested in Subscription',
    'Follow up on Monday',
    'Price quotation sent on WhatsApp',
    'CA Firm - Key Account',
    'Invalid Number / Not Responding'
  ];

  const quickRejectPresets = [
    'Duplicate / Test Demo Request',
    'Non-Professional / Casual Enquiry',
    'Invalid Mobile / Spam',
    'Requested Account Closure'
  ];

  const filteredLeads = leads.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.phone.includes(searchTerm) ||
    (l.firmName && l.firmName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (l.city && l.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (l.remark && l.remark.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (l.approvalStatus && l.approvalStatus.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-5xl max-h-[92vh] rounded-3xl bg-slate-900 border-2 border-amber-500/40 p-6 sm:p-7 shadow-2xl shadow-amber-500/10 flex flex-col text-slate-100 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <Users size={22} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white font-serif flex items-center gap-2">
                <span>Guest Demo Leads & 15-Day Trial Records</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold">
                  {leads.length} Leads
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Manage registered guest demo users, Accept/Reject access, add remarks & track trial follow-ups.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar & Quick Filters */}
        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Guest Name, Mobile Number, Firm, City, Remark, or Status..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none text-xs"
            />
          </div>
        </div>

        {successMsg && (
          <div className="p-3 mb-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Leads Table */}
        <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl">
          {filteredLeads.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <Users size={36} className="mx-auto mb-2 text-slate-600" />
              <p className="font-bold text-slate-400">No Guest Leads Recorded Yet</p>
              <p className="mt-1">Whenever a guest logs in with their mobile number and name, their trial lead will be recorded here.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Guest & Practice</th>
                  <th className="p-3">Mobile & Contact</th>
                  <th className="p-3">Approval Status</th>
                  <th className="p-3">15-Day Trial</th>
                  <th className="p-3 text-right">Actions (Accept / Reject / Remark)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredLeads.map((lead) => {
                  const expiryMs = new Date(lead.trialEndDate).getTime();
                  const nowMs = Date.now();
                  const daysRemaining = Math.max(0, Math.ceil((expiryMs - nowMs) / (1000 * 60 * 60 * 24)));
                  const isExpired = daysRemaining <= 0;
                  const approvalStatus = lead.approvalStatus || 'ACCEPTED';

                  return (
                    <tr key={lead.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Guest & Practice */}
                      <td className="p-3 align-top min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-xs">{lead.name}</p>
                          {lead.isDemoSetup && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                              Custom Demo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-amber-400 font-medium">
                          {lead.firmName || 'Practice Name Pending'} {lead.city ? `(${lead.city})` : ''}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Reg: {new Date(lead.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>

                        {/* Remark Display */}
                        {lead.remark ? (
                          <div className="mt-1.5 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 flex items-start justify-between gap-1.5">
                            <div className="flex items-start gap-1">
                              <MessageSquare size={12} className="text-amber-400 shrink-0 mt-0.5" />
                              <span className="italic">{lead.remark}</span>
                            </div>
                            <button
                              onClick={() => handleOpenRemark(lead)}
                              title="Edit Remark"
                              className="text-amber-400 hover:text-white shrink-0 ml-1 p-0.5 rounded hover:bg-slate-800"
                            >
                              <Edit3 size={11} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenRemark(lead)}
                            className="mt-1 text-[10px] text-slate-500 hover:text-amber-400 flex items-center gap-1 font-medium transition-colors"
                          >
                            <Plus size={10} /> Add Remark / Follow-up Note
                          </button>
                        )}
                      </td>

                      {/* Mobile & Contact */}
                      <td className="p-3 align-top font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{lead.phone}</span>
                          <a
                            href={`https://wa.me/91${lead.phone}?text=Namaste%20${encodeURIComponent(lead.name)}%20ji%2C%20main%20M%2FS.%20ARYA%20ASSOCIATES%20se%20sampark%20kar%20raha%20hu.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-900 transition-colors"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle size={13} />
                          </a>
                          <a
                            href={`tel:+91${lead.phone}`}
                            className="p-1 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700 transition-colors"
                            title="Direct Call"
                          >
                            <Phone size={13} />
                          </a>
                        </div>
                        {lead.email && <p className="text-[10px] text-slate-400 font-sans mt-0.5">{lead.email}</p>}
                      </td>

                      {/* Approval Status */}
                      <td className="p-3 align-top">
                        {approvalStatus === 'ACCEPTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                            <CheckCircle2 size={12} className="text-emerald-400" /> Accepted
                          </span>
                        ) : approvalStatus === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] font-bold">
                            <XCircle size={12} className="text-red-400" /> Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                            <Clock size={12} className="text-amber-400" /> Pending Review
                          </span>
                        )}
                      </td>

                      {/* 15-Day Trial Status */}
                      <td className="p-3 align-top">
                        {isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-bold">
                            <AlertCircle size={12} /> Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                            <Clock size={12} /> {daysRemaining} Days Left
                          </span>
                        )}
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Valid till: {new Date(lead.trialEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="p-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Accept Button */}
                          {approvalStatus !== 'ACCEPTED' && (
                            <button
                              onClick={() => handleAcceptLead(lead.id)}
                              className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 transition-all"
                              title="Accept & Activate Lead"
                            >
                              <Check size={12} /> Accept
                            </button>
                          )}

                          {/* Reject Button */}
                          {approvalStatus !== 'REJECTED' && (
                            <button
                              onClick={() => { setActiveLeadForReject(lead); setRejectReasonInput(lead.remark || ''); }}
                              className="px-2.5 py-1 rounded-xl bg-red-600/25 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 font-bold text-[11px] flex items-center gap-1 transition-all"
                              title="Reject / Deactivate Lead"
                            >
                              <Ban size={12} /> Reject
                            </button>
                          )}

                          {/* Remark Button */}
                          <button
                            onClick={() => handleOpenRemark(lead)}
                            className="px-2.5 py-1 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 font-bold text-[11px] flex items-center gap-1 transition-all"
                            title="Add or Edit Remark"
                          >
                            <MessageSquare size={12} /> Remark
                          </button>

                          {/* +15 Days Trial */}
                          <button
                            onClick={() => handleExtendTrial(lead.id)}
                            className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 font-bold text-[11px] transition-all"
                            title="Add +15 Days Trial"
                          >
                            +15 Days
                          </button>

                          {/* Delete Lead */}
                          <button
                            onClick={() => handleDeleteLead(lead)}
                            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
                            title="Delete Lead"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Remark Modal Popup */}
        {activeLeadForRemark && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg rounded-3xl bg-slate-900 border-2 border-blue-500/50 p-6 shadow-2xl text-slate-100 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Lead Remark / Follow-Up Note</h4>
                    <p className="text-[11px] text-slate-400">
                      Guest: <strong className="text-amber-400">{activeLeadForRemark.name}</strong> ({activeLeadForRemark.phone})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveLeadForRemark(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveRemark} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Enter Note / Remark:
                  </label>
                  <textarea
                    rows={4}
                    value={remarkInput}
                    onChange={(e) => setRemarkInput(e.target.value)}
                    placeholder="e.g. Discussed pricing on call. Interested in CA Practice multi-user licence. Callback on Friday."
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none text-xs"
                    autoFocus
                  />
                </div>

                {/* Quick Presets */}
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
                    <Tag size={10} /> Quick Tags (Click to insert):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {quickRemarkPresets.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setRemarkInput(prev => prev ? `${prev} | ${preset}` : preset)}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-blue-600/30 text-slate-300 hover:text-blue-200 border border-slate-700 text-[10px] transition-colors"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveLeadForRemark(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Check size={14} /> Save Remark
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reject Confirmation Modal Popup */}
        {activeLeadForReject && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-3xl bg-slate-900 border-2 border-red-500/50 p-6 shadow-2xl text-slate-100 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-red-500/20 text-red-400">
                    <Ban size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Reject / Deactivate Guest Lead</h4>
                    <p className="text-[11px] text-slate-400">
                      Guest: <strong className="text-red-400">{activeLeadForReject.name}</strong> ({activeLeadForReject.phone})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveLeadForReject(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleConfirmReject} className="mt-4 space-y-3">
                <p className="text-xs text-slate-300">
                  Are you sure you want to <strong>Reject</strong> this guest demo lead? They will not be able to log in to demo mode until accepted again.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Rejection Reason / Remark (Optional):
                  </label>
                  <input
                    type="text"
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    placeholder="e.g. Verification failed / Spam request"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:border-red-500 focus:outline-none text-xs"
                    autoFocus
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {quickRejectPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectReasonInput(preset)}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-red-600/30 text-slate-300 hover:text-red-200 border border-slate-700 text-[10px] transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveLeadForReject(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Ban size={14} /> Confirm Rejection
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
