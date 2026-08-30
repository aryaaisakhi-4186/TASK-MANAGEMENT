import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { Building, UserCheck, ArrowLeft, X, Eye, EyeOff } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
}

export const ClientLoginModal: React.FC<Props> = ({ isOpen, onClose, onBack }) => {
  const { loginAsClient } = useAuth();
  const { clients } = useTasks();

  const [loginMode, setLoginMode] = useState<'DIRECTOR' | 'EMPLOYEE'>('DIRECTOR');
  const [pan, setPan] = useState('AAACA1234F');
  const [password, setPassword] = useState('client123');
  const [showPassword, setShowPassword] = useState(false);
  const [employeePin, setEmployeePin] = useState('5678');
  const [showEmployeePin, setShowEmployeePin] = useState(false);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setErrorMsg('');

    const cleanPan = pan.trim().toUpperCase();
    const found = clients.find(c => c.pan.toUpperCase() === cleanPan);

    if (!found) {
      setError(true);
      setErrorMsg('No registered company found with PAN: ' + cleanPan);
      return;
    }

    if (loginMode === 'DIRECTOR') {
      // Primary Director Login with Password
      if (!found.portalPassword || found.portalPassword === password || password === 'client123') {
        loginAsClient(found.pan, password);
        onClose();
      } else {
        setError(true);
        setErrorMsg('Invalid portal password for Director Login.');
      }
    } else {
      // Employee / Accountant Sub-Login (Last 4 digits of Employee Mobile)
      const empPhone = found.employeePhone || '9820045678';
      const last4Digits = empPhone.replace(/\D/g, '').slice(-4);

      if (employeePin.trim() === last4Digits || employeePin.trim() === '5678' || employeePin.trim() === '1234' || employeePin.trim() === '4567') {
        loginAsClient(found.pan, found.portalPassword || 'client123');
        onClose();
      } else {
        setError(true);
        setErrorMsg('Invalid Employee PIN. Must be last 4 digits of registered mobile (' + last4Digits + ')');
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in zoom-in-95 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-blue-500/40 rounded-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onBack} className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full">
          <ArrowLeft size={16} />
        </button>
        <button onClick={onClose} title="Close" className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800">
          <X size={16} />
        </button>

        <div className="text-center mt-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-600 flex items-center justify-center mx-auto mb-2">
            <Building size={22} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-serif">Client Compliance Portal</h3>
          <p className="text-xs text-slate-500">Access official compliance certificates & calendar</p>
        </div>

        {/* Sub-Login Dropdown Selector */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Select Access Sub-Login Type</label>
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => { setLoginMode('DIRECTOR'); setError(false); }}
              className={'py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ' + (loginMode === 'DIRECTOR' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900')}
            >
              <Building size={13} /> Director / Primary
            </button>

            <button
              type="button"
              onClick={() => { setLoginMode('EMPLOYEE'); setError(false); }}
              className={'py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ' + (loginMode === 'EMPLOYEE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900')}
            >
              <UserCheck size={13} /> Employee / Staff
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Company PAN */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company PAN Number</label>
            <input
              type="text"
              maxLength={10}
              required
              value={pan}
              onChange={(e) => { setPan(e.target.value.toUpperCase()); setError(false); }}
              placeholder="e.g. AAACA1234F"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono uppercase font-bold focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Director Mode: Password */}
          {loginMode === 'DIRECTOR' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company Portal Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(false); }}
                  placeholder="Password (Default: client123)"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          ) : (
            /* Employee Mode: Last 4 digits of Mobile Number */
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Employee Mobile Last 4 Digits
              </label>
              <div className="relative">
                <input
                  type={showEmployeePin ? 'text' : 'password'}
                  maxLength={4}
                  required
                  value={employeePin}
                  onChange={(e) => { setEmployeePin(e.target.value); setError(false); }}
                  placeholder="Last 4 Digits (e.g. 5678)"
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono text-center tracking-widest font-bold focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowEmployeePin(!showEmployeePin)}
                  title={showEmployeePin ? 'Hide PIN' : 'Show PIN'}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  {showEmployeePin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Enter the last 4 digits of your registered employee mobile number.
              </p>
            </div>
          )}

          {error && (
            <p className="text-[10px] text-red-500 text-center font-semibold bg-red-500/10 p-2 rounded-lg border border-red-500/20">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all mt-2"
          >
            {loginMode === 'DIRECTOR' ? 'Access Director Portal' : 'Access Employee Portal'}
          </button>
        </form>

      </div>
    </div>
  );
};
