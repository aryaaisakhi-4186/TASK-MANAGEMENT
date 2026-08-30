import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { KeyRound, ArrowLeft, X, Eye, EyeOff } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
}

export const AdminLoginModal: React.FC<Props> = ({ isOpen, onClose, onBack }) => {
  const { loginAsAdmin } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);

  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = loginAsAdmin(password);
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
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-amber-400/40 rounded-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onBack} className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full">
          <ArrowLeft size={16} />
        </button>
        <button onClick={onClose} title="Close" className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800">
          <X size={16} />
        </button>

        <div className="text-center mt-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center mx-auto mb-2">
            <KeyRound size={22} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-serif">Admin Authentication</h3>
          <p className="text-xs text-slate-500">Enter master password to access partner tools</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoFocus
              required
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="Admin Password (Default: admin123)"
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs text-center font-mono focus:border-amber-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              title={showPassword ? 'Hide Password' : 'Show Password'}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            {error && <p className="text-[10px] text-red-500 text-center mt-1">Incorrect password. Default is: admin123</p>}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            Authenticate Partner
          </button>
        </form>
      </div>
    </div>
  );
};
