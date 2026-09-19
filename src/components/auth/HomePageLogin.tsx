import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useTasks } from '../../context/TaskContext';
import { 
  Scale, 
  ShieldCheck, 
  Users, 
  Building, 
  Eye, 
  Sparkles, 
  FileText, 
  FolderKanban, 
  Lock, 
  Smartphone, 
  CheckCircle2, 
  Sun, 
  Moon, 
  ArrowRight,
  HelpCircle,
  Key,
  Flame,
  Check,
  Clock,
  Briefcase
} from 'lucide-react';
import { GlassCard } from '../common/GlassCard';

export const HomePageLogin: React.FC = () => {
  const { loginAsAdmin, loginAsTeam, loginAsClient, loginAsGuestWithMobile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { team, clients } = useTasks();

  const [activeTab, setActiveTab] = useState<'GUEST' | 'ADMIN' | 'TEAM' | 'CLIENT'>('GUEST');
  
  // Admin State
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  // Team State
  const [selectedTeamId, setSelectedTeamId] = useState(team[0]?.id || '');
  const [teamPin, setTeamPin] = useState('');
  const [teamError, setTeamError] = useState('');

  // Client State
  const [clientPan, setClientPan] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientError, setClientError] = useState('');

  // Guest State
  const [guestName, setGuestName] = useState('');
  const [guestMobile, setGuestMobile] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestError, setGuestError] = useState('');

  // Handlers
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    if (!adminPassword) {
      setAdminError('Please enter the Admin Master Password.');
      return;
    }
    const success = loginAsAdmin(adminPassword);
    if (!success) {
      setAdminError('Invalid Master Password. (Default: admin123)');
    }
  };

  const handleTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTeamError('');
    if (!selectedTeamId) {
      setTeamError('Please select a Staff Associate.');
      return;
    }
    if (!teamPin) {
      setTeamError('Please enter your 4-digit PIN.');
      return;
    }
    const success = loginAsTeam(selectedTeamId, teamPin);
    if (!success) {
      setTeamError('Invalid PIN. Please check or use default PIN 1234.');
    }
  };

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError('');
    if (!clientPan) {
      setClientError('Please enter your 10-digit PAN.');
      return;
    }
    const success = loginAsClient(clientPan, clientPassword || 'client123');
    if (!success) {
      setClientError('Client record with this PAN not found, or invalid password.');
    }
  };

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGuestError('');
    const cleanMobile = guestMobile.replace(/[^0-9]/g, '').trim();
    if (cleanMobile.length !== 10) {
      setGuestError('Please enter a valid 10-digit Mobile Number.');
      return;
    }
    if (!guestPassword) {
      setGuestError('Please enter the password (last 4 digits of mobile number).');
      return;
    }

    const res = loginAsGuestWithMobile(cleanMobile, guestPassword, guestName);
    if (!res.success) {
      setGuestError(res.error || 'Invalid credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-300">
      
      {/* Top Header Branding Bar */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-300">
            <Scale size={24} className="text-slate-950 font-black" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wider text-white font-serif flex items-center gap-2">
              <span>TASK-VAANI</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                v2.0
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium tracking-wide">
              Statutory Compliance Hub
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono">
            <Clock size={13} className="text-amber-400" />
            <span>10:30 AM Daily Statutory Bell</span>
          </div>

          <button
            onClick={toggleTheme}
            title="Toggle Theme"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 transition-all shadow-sm"
          >
            {theme === 'light' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-amber-400" />}
          </button>
        </div>
      </header>

      {/* Main Home Content Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
        
        {/* Left Hero & Feature Showcase */}
        <div className="flex-1 space-y-6 text-left">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono">
            <Sparkles size={14} className="text-amber-400" />
            <span>AI-Powered CA Practice Operating System</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white font-serif tracking-tight leading-tight">
            Autonomous Statutory Compliance & Practice Management.
          </h2>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl font-normal">
            Automate monthly GST Returns, TDS Challans, ITR & ROC Compliances. Parse statutory PDF certificates with zero duplication and manage staff shifts seamlessly.
          </p>

          {/* 4 Core Pillars Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-all">
              <div className="flex items-center gap-2.5 text-amber-400 font-bold text-xs mb-1">
                <ShieldCheck size={16} />
                <span>Statutory Compliance Matrix</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                GSTR-3B, GSTR-1, PMT-06, TDS 24Q/26Q, AOC-4, DIR-3 KYC with instant status flags.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all">
              <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-xs mb-1">
                <Sparkles size={16} />
                <span>TASK-VAANI Agentic AI</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Reads GST REG-06, PAN cards & Bank statements. Auto-merges existing profiles with 0 duplicates.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 transition-all">
              <div className="flex items-center gap-2.5 text-blue-400 font-bold text-xs mb-1">
                <FolderKanban size={16} />
                <span>Document Vault & Notices</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Client-indexed repository for Bank Statements, Invoices, and DRC-01/ASMT-10 notices.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 transition-all">
              <div className="flex items-center gap-2.5 text-purple-400 font-bold text-xs mb-1">
                <Users size={16} />
                <span>Staff Attendance & Shift Logs</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Office Shift IN, Lunch Break push timers, biometric punch logs, and extra billing.
              </p>
            </div>
          </div>

        </div>

        {/* Right Login Portal Window */}
        <div className="w-full max-w-md shrink-0">
          <div className="rounded-3xl bg-slate-900/90 border-2 border-amber-500/40 p-6 sm:p-7 shadow-2xl shadow-amber-500/10 backdrop-blur-xl relative">
            
            {/* Window Header */}
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center mx-auto mb-2 shadow-lg shadow-amber-500/20">
                <Lock size={22} className="font-bold text-slate-950" />
              </div>
              <h3 className="text-lg font-black text-white font-serif tracking-tight">
                Sign In to TASK-VAANI
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Select your role or explore as Guest Demo
              </p>
            </div>

            {/* Role Tab Switcher */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-slate-950 border border-slate-800 mb-5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => { setActiveTab('GUEST'); setGuestError(''); }}
                className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 ${
                  activeTab === 'GUEST'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye size={14} />
                <span>Guest</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('ADMIN'); setAdminError(''); }}
                className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 ${
                  activeTab === 'ADMIN'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck size={14} />
                <span>Admin</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('TEAM'); setTeamError(''); }}
                className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 ${
                  activeTab === 'TEAM'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users size={14} />
                <span>Staff</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('CLIENT'); setClientError(''); }}
                className={`py-2 rounded-xl transition-all flex flex-col items-center gap-1 ${
                  activeTab === 'CLIENT'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building size={14} />
                <span>Client</span>
              </button>
            </div>

            {/* TAB 1: GUEST DEMO LOGIN (Mobile No + Last 4 Digits Password) */}
            {activeTab === 'GUEST' && (
              <form onSubmit={handleGuestSubmit} className="space-y-3.5 text-xs animate-in fade-in">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
                  <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Guest Demo Mode:</strong> Enter your 10-digit mobile number. Your login password is the <strong>last 4 digits</strong> of your mobile.
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. Guest Visitor / Demo User"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-amber-400 uppercase mb-1">
                    10-Digit Mobile Number *
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={guestMobile}
                    onChange={(e) => {
                      const m = e.target.value.replace(/[^0-9]/g, '');
                      setGuestMobile(m);
                      if (m.length === 10 && !guestPassword) {
                        setGuestPassword(m.slice(-4));
                      }
                    }}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono font-bold text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-amber-400 uppercase">
                      Password (Last 4 Digits of Mobile) *
                    </label>
                    {guestMobile.length === 10 && (
                      <span className="text-[10px] text-amber-400 font-mono">
                        Password: <strong>{guestMobile.slice(-4)}</strong>
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    maxLength={4}
                    value={guestPassword}
                    onChange={(e) => setGuestPassword(e.target.value)}
                    placeholder="Enter last 4 digits (e.g. 3210)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono font-bold text-amber-400 text-center tracking-widest text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {guestError && (
                  <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-medium">
                    {guestError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
                >
                  <Eye size={15} />
                  <span>Explore App in Guest Read-Only Mode</span>
                  <ArrowRight size={14} />
                </button>
              </form>
            )}

            {/* TAB 2: ADMIN LOGIN */}
            {activeTab === 'ADMIN' && (
              <form onSubmit={handleAdminSubmit} className="space-y-3.5 text-xs animate-in fade-in">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-amber-400 shrink-0" />
                  <span>Principal Partner & Master Practice Control</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Master Admin Password
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter Master Password (default: admin123)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {adminError && (
                  <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-medium">
                    {adminError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
                >
                  <Key size={15} />
                  <span>Login as Admin / Managing Partner</span>
                </button>
              </form>
            )}

            {/* TAB 3: STAFF / TEAM LOGIN */}
            {activeTab === 'TEAM' && (
              <form onSubmit={handleTeamSubmit} className="space-y-3.5 text-xs animate-in fade-in">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                  <Users size={16} className="text-emerald-400 shrink-0" />
                  <span>Compliance Associates & Article Assistants</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Select Staff Member
                  </label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 focus:outline-none font-medium"
                  >
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.designation || 'Staff'} • {m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    4-Digit Staff Login PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={teamPin}
                    onChange={(e) => setTeamPin(e.target.value)}
                    placeholder="Enter 4-digit PIN (default: 1234)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-center tracking-widest text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {teamError && (
                  <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-medium">
                    {teamError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
                >
                  <Users size={15} />
                  <span>Staff Member Sign In</span>
                </button>
              </form>
            )}

            {/* TAB 4: CLIENT PORTAL LOGIN */}
            {activeTab === 'CLIENT' && (
              <form onSubmit={handleClientSubmit} className="space-y-3.5 text-xs animate-in fade-in">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                  <Building size={16} className="text-blue-400 shrink-0" />
                  <span>Client Compliance Status & Return Portal</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    10-Digit Client PAN Number
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={clientPan}
                    onChange={(e) => setClientPan(e.target.value.toUpperCase())}
                    placeholder="e.g. AAACA1234F"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono font-bold text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Portal Password / Phone Last 4 Digits
                  </label>
                  <input
                    type="password"
                    value={clientPassword}
                    onChange={(e) => setClientPassword(e.target.value)}
                    placeholder="Enter password (default: client123)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {clientError && (
                  <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-medium">
                    {clientError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
                >
                  <Building size={15} />
                  <span>Access Client Portal</span>
                </button>
              </form>
            )}

          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/60 bg-slate-950/40 py-3.5 px-6 text-center text-xs text-slate-500">
        TASK-VAANI • Statutory Compliance Hub • Built for Chartered Accountants & Tax Professionals
      </footer>

    </div>
  );
};
