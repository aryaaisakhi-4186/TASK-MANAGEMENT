import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  X, 
  Users, 
  UserCheck, 
  IndianRupee, 
  History, 
  Settings, 
  ShieldCheck, 
  Smartphone,
  Sparkles,
  Download
} from 'lucide-react';
import { GlassCard } from './GlassCard';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenRoleModal: () => void;
  onOpenInstallModal: () => void;
}

export const MobileMoreDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  onOpenRoleModal,
  onOpenInstallModal,
}) => {
  const { currentRole } = useAuth();
  if (!isOpen) return null;

  const handleSelect = (tab: string) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Tap backdrop to close */}
      <div className="flex-1" onClick={onClose}></div>

      {/* Bottom Sheet */}
      <div className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-5 shadow-2xl pb-8 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
        
        {/* Grab bar */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4"></div>

        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base font-serif">TASK-VAANI Menu</h3>
            <p className="text-xs text-slate-500">More CA tools & system settings</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900">
            <X size={18} />
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => { onOpenInstallModal(); onClose(); }}
            className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-300 flex items-center gap-2.5 text-xs font-bold text-left"
          >
            <Smartphone size={18} className="text-amber-600" />
            <div>
              <p>Install Mobile App</p>
              <span className="text-[10px] text-amber-700 font-normal">Add to Home Screen</span>
            </div>
          </button>

          <button
            onClick={() => { onOpenRoleModal(); onClose(); }}
            className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-2.5 text-xs font-bold text-left"
          >
            <ShieldCheck size={18} className="text-amber-500" />
            <div>
              <p>Switch Role</p>
              <span className="text-[10px] text-slate-500 font-normal">{currentRole} Mode</span>
            </div>
          </button>
        </div>

        {/* Navigation List */}
        <div className="space-y-1.5">
          {currentRole !== 'CLIENT' && (
            <button
              onClick={() => handleSelect('clients')}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold"
            >
              <Users size={18} className="text-amber-500" />
              <span>Clients Master Directory</span>
            </button>
          )}

          {currentRole !== 'CLIENT' && (
            <button
              onClick={() => handleSelect('audit')}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold"
            >
              <History size={18} className="text-purple-500" />
              <span>History & Audit Log (Google Sheet Synced)</span>
            </button>
          )}

          {currentRole === 'ADMIN' && (
            <>
              <button
                onClick={() => handleSelect('team')}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold"
              >
                <UserCheck size={18} className="text-emerald-500" />
                <span>Team & Staff Directory</span>
              </button>

              <button
                onClick={() => handleSelect('extra-work')}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold"
              >
                <IndianRupee size={18} className="text-blue-500" />
                <span>Extra Billable Work Tracker</span>
              </button>

              <button
                onClick={() => handleSelect('settings')}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold"
              >
                <Settings size={18} className="text-slate-500" />
                <span>Firm Configuration & Alarm Settings</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
