import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import { useTasks } from '../../context/TaskContext';
import { Users, X, Check, KeyRound, Phone, Mail, Building, Search, Eye, EyeOff } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  member: UserProfile | null;
  onClose: () => void;
}

export const TeamMemberModal: React.FC<Props> = ({ isOpen, member, onClose }) => {
  const { clients, addTeamMember, updateTeamMember } = useTasks();
  const isEditing = !!member;

  useEscapeKey(onClose, isOpen);

  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('Senior Partner (Tax & Audit)');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('1234');
  const [showPin, setShowPin] = useState(false);
  const [avatar, setAvatar] = useState('');
  const [assignedClientIds, setAssignedClientIds] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    if (member) {
      setName(member.name || '');
      setDesignation(member.designation || 'Staff Associate');
      setEmail(member.email || '');
      setPhone(member.phone || '');
      setPin(member.pin || '1234');
      setAvatar(member.avatar || '');
      setAssignedClientIds(member.assignedClientIds || []);
    } else {
      setName('');
      setDesignation('Audit Associate');
      setEmail('');
      setPhone('');
      setPin('1234');
      setAvatar('');
      setAssignedClientIds([]);
    }
    setClientSearch('');
    setShowPin(false);
  }, [member, isOpen]);

  if (!isOpen) return null;

  const filteredClients = clients.filter(c => {
    if (!clientSearch) return true;
    const q = clientSearch.toLowerCase();
    return (
      c.tradeName.toLowerCase().includes(q) ||
      c.legalName.toLowerCase().includes(q) ||
      c.pan.toLowerCase().includes(q) ||
      (c.gstin && c.gstin.toLowerCase().includes(q))
    );
  });

  const handleToggleClient = (clientId: string) => {
    setAssignedClientIds(prev =>
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredClients.map(c => c.id);
    const allSelected = ids.every(id => assignedClientIds.includes(id));
    if (allSelected) {
      setAssignedClientIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setAssignedClientIds(prev => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: name.trim(),
      designation: designation.trim(),
      email: email.trim(),
      phone: phone.trim(),
      pin: pin.trim(),
      avatar: avatar.trim() || undefined,
      assignedClientIds,
    };

    if (isEditing && member) {
      updateTeamMember(member.id, payload);
    } else {
      addTeamMember(payload);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in zoom-in-95 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-amber-400/40 rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          title="Close"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">
              {isEditing ? ('Edit Team Member: ' + (member ? member.name : '')) : 'Add New Team Member / Associate'}
            </h3>
            <p className="text-xs text-slate-500">
              Update partner details, role designation, 4-digit login PIN & client portfolio
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CA Rajesh Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Designation / Role Title *</label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Senior Partner (Tax & Audit)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Official Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rajesh@vaaniassociates.in"
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Mobile / WhatsApp No</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98111 22334"
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">4-Digit Login PIN *</label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={4}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="1234"
                  className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono font-bold tracking-widest text-center focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  title={showPin ? 'Hide PIN' : 'Show PIN'}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Avatar / Photo URL (Optional)</label>
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Assigned Client Workload with Live Search Tab */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Building size={14} className="text-amber-500" /> Assigned Client Workload ({assignedClientIds.length} of {clients.length} Selected)
              </h4>
              
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-[10px] text-amber-700 dark:text-amber-400 font-bold hover:underline self-start sm:self-auto"
              >
                {filteredClients.length > 0 && filteredClients.every(c => assignedClientIds.includes(c.id))
                  ? 'Deselect Filtered'
                  : 'Select All Filtered (' + filteredClients.length + ')'}
              </button>
            </div>

            {/* Client Search Tab */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search clients by trade name, legal name, PAN..."
                className="w-full pl-8 pr-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none shadow-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
              {filteredClients.length === 0 ? (
                <div className="col-span-2 text-center py-4 text-slate-400 italic">
                  No clients matching "{clientSearch}"
                </div>
              ) : (
                filteredClients.map(c => {
                  const isSelected = assignedClientIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={'flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-all ' + (
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/50 text-slate-900 dark:text-white font-semibold shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleClient(c.id)}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-semibold">{c.tradeName}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{c.pan} • {c.category}</p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-300 dark:border-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 flex items-center gap-1.5"
            >
              <Check size={16} /> {isEditing ? 'Save Member Changes' : 'Create Team Member'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
