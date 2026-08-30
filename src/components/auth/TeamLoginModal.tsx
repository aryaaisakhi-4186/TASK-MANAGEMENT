import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { Users, ArrowLeft, X, Eye, EyeOff } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
}

export const TeamLoginModal: React.FC<Props> = ({ isOpen, onClose, onBack }) => {
  const { loginAsTeam } = useAuth();
  const { team } = useTasks();
  const [selectedStaffId, setSelectedStaffId] = useState(team[0]?.id || '');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState(false);

  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = loginAsTeam(selectedStaffId, pin);
    if (success) {
      onClose();
    } else {
      setError(true);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in zoom-in-95 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onBack} className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full">
          <ArrowLeft size={16} />
        </button>
        <button onClick={onClose} title="Close" className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800">
          <X size={16} />
        </button>

        <div className="text-center mt-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto mb-2">
            <Users size={22} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-serif">Staff / Article Punch-In</h3>
          <p className="text-xs text-slate-500">Select your name and enter 4-digit security PIN</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Associate Name</label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold"
            >
              {team.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.designation})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">4-Digit Security PIN</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={4}
                required
                value={pin}
                onChange={(e) => { setPin(e.target.value); setError(false); }}
                placeholder="PIN (Default: 1234)"
                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs text-center font-mono tracking-widest focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                title={showPin ? 'Hide PIN' : 'Show PIN'}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="text-[10px] text-red-500 text-center mt-1">Invalid PIN. Try: 1234</p>}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all"
          >
            Unlock Staff Portal
          </button>
        </form>
      </div>
    </div>
  );
};
