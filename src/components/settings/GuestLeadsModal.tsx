import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storage';
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
  Plus
} from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GuestLeadsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  useEscapeKey(onClose, isOpen);

  const [leads, setLeads] = useState<GuestLead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLeads(StorageService.getGuestLeads());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExtendTrial = (leadId: string) => {
    const success = StorageService.extendGuestTrial(leadId, 15);
    if (success) {
      setLeads(StorageService.getGuestLeads());
      setSuccessMsg('Trial successfully extended by +15 days!');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const filteredLeads = leads.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.phone.includes(searchTerm) ||
    (l.firmName && l.firmName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (l.city && l.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-3xl bg-slate-900 border-2 border-amber-500/40 p-6 sm:p-7 shadow-2xl shadow-amber-500/10 flex flex-col text-slate-100">
        
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
                Track all registered guest demo users, trial expiry dates, and follow-up details.
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

        {/* Search Bar */}
        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Guest Name, Mobile Number, Firm, or City..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none text-xs"
            />
          </div>
        </div>

        {successMsg && (
          <div className="p-3 mb-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
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
                  <th className="p-3">Guest Name & Firm</th>
                  <th className="p-3">Mobile & Contact</th>
                  <th className="p-3">Registered On</th>
                  <th className="p-3">15-Day Trial Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredLeads.map((lead) => {
                  const expiryMs = new Date(lead.trialEndDate).getTime();
                  const nowMs = Date.now();
                  const daysRemaining = Math.max(0, Math.ceil((expiryMs - nowMs) / (1000 * 60 * 60 * 24)));
                  const isExpired = daysRemaining <= 0;

                  return (
                    <tr key={lead.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <p className="font-bold text-white text-xs">{lead.name}</p>
                        <p className="text-[11px] text-amber-400 font-medium">
                          {lead.firmName || 'Practice Name Pending'} {lead.city ? `(${lead.city})` : ''}
                        </p>
                      </td>

                      <td className="p-3 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{lead.phone}</span>
                          <a
                            href={`https://wa.me/91${lead.phone}?text=Namaste%20${encodeURIComponent(lead.name)}%20ji%2C%20main%20TASK-VAANI%20se%20sampark%20kar%20raha%20hu.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-900"
                            title="WhatsApp Lead"
                          >
                            <MessageCircle size={13} />
                          </a>
                          <a
                            href={`tel:+91${lead.phone}`}
                            className="p-1 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700"
                            title="Call Lead"
                          >
                            <Phone size={13} />
                          </a>
                        </div>
                        {lead.email && <p className="text-[10px] text-slate-400 font-sans mt-0.5">{lead.email}</p>}
                      </td>

                      <td className="p-3 text-[11px] text-slate-400">
                        {new Date(lead.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      <td className="p-3">
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

                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleExtendTrial(lead.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 font-bold text-[11px] transition-all"
                          title="Add +15 Days Trial"
                        >
                          +15 Days Trial
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
};
