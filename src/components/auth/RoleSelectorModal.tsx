import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Users, Building, Eye, X } from 'lucide-react';
import { AdminLoginModal } from './AdminLoginModal';
import { TeamLoginModal } from './TeamLoginModal';
import { ClientLoginModal } from './ClientLoginModal';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleSelectorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { loginAsGuest } = useAuth();
  const [activeModal, setActiveModal] = useState<'NONE' | 'ADMIN' | 'TEAM' | 'CLIENT'>('NONE');

  useEscapeKey(onClose, isOpen && activeModal === 'NONE');

  if (!isOpen) return null;

  return (
    <>
      {activeModal === 'NONE' && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in zoom-in-95 duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div 
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-amber-400/40 rounded-3xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} title="Close" className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800">
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto mb-2">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">Select Access Privilege</h3>
              <p className="text-xs text-slate-500 mt-0.5">Choose your role to authenticate</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Admin */}
              <button
                onClick={() => setActiveModal('ADMIN')}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-500 text-left transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center mb-2">
                  <ShieldCheck size={18} />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-amber-600">Admin / Partner</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Master control, billing, audit logs & settings</p>
              </button>

              {/* Team */}
              <button
                onClick={() => setActiveModal('TEAM')}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-left transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center mb-2">
                  <Users size={18} />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-emerald-600">Team / Staff</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">4-digit PIN, punch-in & assigned tasks</p>
              </button>

              {/* Client */}
              <button
                onClick={() => setActiveModal('CLIENT')}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-left transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-600 flex items-center justify-center mb-2">
                  <Building size={18} />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-blue-600">Client Portal</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">PAN login & compliance report certificates</p>
              </button>

              {/* Guest */}
              <button
                onClick={() => { loginAsGuest(); onClose(); }}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-purple-500 text-left transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-600 flex items-center justify-center mb-2">
                  <Eye size={18} />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-purple-600">Guest Mode</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Read-only live portal inspection</p>
              </button>
            </div>

          </div>
        </div>
      )}

      <AdminLoginModal
        isOpen={activeModal === 'ADMIN'}
        onClose={() => { setActiveModal('NONE'); onClose(); }}
        onBack={() => setActiveModal('NONE')}
      />

      <TeamLoginModal
        isOpen={activeModal === 'TEAM'}
        onClose={() => { setActiveModal('NONE'); onClose(); }}
        onBack={() => setActiveModal('NONE')}
      />

      <ClientLoginModal
        isOpen={activeModal === 'CLIENT'}
        onClose={() => { setActiveModal('NONE'); onClose(); }}
        onBack={() => setActiveModal('NONE')}
      />
    </>
  );
};
