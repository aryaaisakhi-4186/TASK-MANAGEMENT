import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types';
import { Users, Plus, KeyRound, Phone, Mail, Trash2, Edit3, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { TeamMemberModal } from './TeamMemberModal';
import { TeamImportModal } from './TeamImportModal';
import { VoiceSearchBar } from '../common/VoiceSearchBar';

export const TeamMasterTable: React.FC = () => {
  const { team, deleteTeamMember } = useTasks();
  const { currentRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberForEdit, setSelectedMemberForEdit] = useState<UserProfile | null | 'NEW'>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const filteredTeam = team.filter(member => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      member.name.toLowerCase().includes(q) ||
      (member.designation && member.designation.toLowerCase().includes(q)) ||
      (member.email && member.email.toLowerCase().includes(q)) ||
      (member.phone && member.phone.toLowerCase().includes(q)) ||
      member.role.toLowerCase().includes(q)
    );
  });

  const handleDelete = (id: string, name: string) => {
    if (window.confirm('Are you sure you want to remove team member "' + name + '"?')) {
      deleteTeamMember(id);
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-serif tracking-tight flex items-center gap-2">
            <Users className="text-amber-500" /> Team & Staff Directory
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
            Manage partner profiles, article assistants, 4-digit security PINs & client workloads
          </p>
        </div>

        {currentRole === 'ADMIN' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300 text-xs font-bold shadow-sm transition-all"
            >
              <FileSpreadsheet size={15} /> Import Excel / PDF
            </button>

            <button
              onClick={() => setSelectedMemberForEdit('NEW')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95"
            >
              <Plus size={16} /> Add Team Member
            </button>
          </div>
        )}
      </div>

      {/* Voice Search Bar for Team Directory */}
      <GlassCard className="p-4">
        <VoiceSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search team members by name, designation, mobile (or speak in Hindi/English)..."
          className="w-full md:w-96"
        />
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredTeam.map(member => (
          <GlassCard key={member.id} className="p-5 relative overflow-hidden flex flex-col justify-between" variant="elevated">
            <div>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center text-base border border-amber-500/30 shrink-0">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name} className="w-full h-full rounded-2xl object-cover" />
                  ) : (
                    member.name.charAt(0)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{member.name}</h4>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold">{member.designation || 'Staff Associate'}</p>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                    <p className="flex items-center gap-1.5 truncate"><Mail size={12} className="text-slate-400 shrink-0" /> {member.email || 'N/A'}</p>
                    <p className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400 shrink-0" /> {member.phone || 'N/A'}</p>
                    <p className="flex items-center gap-1.5 font-mono text-emerald-700 dark:text-emerald-400 font-bold"><KeyRound size={12} className="text-emerald-500 shrink-0" /> PIN: {member.pin || '1234'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Assigned Clients: <strong className="text-slate-900 dark:text-white font-bold">{member.assignedClientIds?.length || 0}</strong>
              </span>
              
              <div className="flex items-center gap-1.5">
                {currentRole === 'ADMIN' && (
                  <>
                    <button
                      onClick={() => setSelectedMemberForEdit(member)}
                      title="Edit Team Member Profile"
                      className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 font-bold transition-all border border-amber-500/30 flex items-center gap-1 text-[11px] px-2"
                    >
                      <Edit3 size={13} /> Edit
                    </button>

                    <button
                      onClick={() => handleDelete(member.id, member.name)}
                      title="Delete Team Member"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Edit / Create Team Member Modal */}
      <TeamMemberModal
        isOpen={selectedMemberForEdit !== null}
        member={selectedMemberForEdit === 'NEW' ? null : selectedMemberForEdit}
        onClose={() => setSelectedMemberForEdit(null)}
      />

      {/* Bulk Team Staff Import Modal (Excel / PDF) */}
      <TeamImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

    </div>
  );
};
