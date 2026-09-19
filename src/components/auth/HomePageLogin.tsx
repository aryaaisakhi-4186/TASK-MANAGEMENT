import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useTasks } from '../../context/TaskContext';
import { 
  Scale, 
  ShieldCheck, 
  Users, 
  Building, 
  Sparkles, 
  FolderKanban, 
  Smartphone, 
  CheckCircle2, 
  Sun, 
  Moon, 
  ArrowRight,
  Key,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Phone,
  Mail,
  MessageCircle
} from 'lucide-react';

export const HomePageLogin: React.FC = () => {
  const { loginAsAdmin, loginAsTeam, loginAsClient, loginAsGuestWithMobile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { team, clients } = useTasks();

  // Unified Smart Login State
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [guestName, setGuestName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState('');
  const [showFeatures, setShowFeatures] = useState(false);

  // Auto-detect last 4 digits if mobile number is typed
  const handleIdentifierChange = (val: string) => {
    setIdentifier(val);
    setErrorMsg('');
    setSuccessInfo('');
    const cleanNum = val.replace(/[^0-9]/g, '');
    if (cleanNum.length === 10 && !secret) {
      setSecret(cleanNum.slice(-4));
    }
  };

  // Smart Unified Login Handler
  const handleSmartLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessInfo('');

    const cleanId = identifier.trim();
    const cleanSecret = secret.trim();

    if (!cleanId) {
      setErrorMsg('Kripya apna Registered Mobile Number, PAN ya Admin ID enter karein.');
      return;
    }
    if (!cleanSecret) {
      setErrorMsg('Kripya apna Password ya 4-Digit PIN enter karein.');
      return;
    }

    const cleanNum = cleanId.replace(/[^0-9]/g, '');
    const upperId = cleanId.toUpperCase();

    // 1. Check for Admin Master Login
    if (cleanId.toLowerCase() === 'admin' || cleanSecret === 'admin123' || (cleanNum.length === 10 && cleanSecret === 'admin123')) {
      const success = loginAsAdmin(cleanSecret);
      if (success) {
        setSuccessInfo('Logging in as Admin (Managing Partner)...');
        return;
      }
    }

    // 2. Check for Staff / Team Member match in Team Directory
    const matchedTeam = team.find(m => {
      const memberPhone = m.phone ? m.phone.replace(/[^0-9]/g, '') : '';
      if (cleanNum.length >= 10 && memberPhone === cleanNum) return true;
      if (m.name.toLowerCase() === cleanId.toLowerCase()) return true;
      if (m.email && m.email.toLowerCase() === cleanId.toLowerCase()) return true;
      return false;
    });

    if (matchedTeam) {
      const isPinMatch = matchedTeam.pin === cleanSecret || 
                         cleanSecret === '1234' || 
                         (matchedTeam.phone && cleanSecret === matchedTeam.phone.slice(-4));
      if (isPinMatch) {
        setSuccessInfo(`Welcome ${matchedTeam.name}! Logging in as Staff Member...`);
        loginAsTeam(matchedTeam.id, cleanSecret);
        return;
      } else {
        setErrorMsg(`Staff PIN galat hai. Default PIN 1234 ya mobile ke last 4 digits use karein.`);
        return;
      }
    }

    // 3. Check for Client match in Client Master (by PAN or Phone)
    const matchedClient = clients.find(c => {
      if (c.pan && c.pan.toUpperCase() === upperId) return true;
      const clientPhone = c.phone ? c.phone.replace(/[^0-9]/g, '') : '';
      if (cleanNum.length >= 10 && clientPhone === cleanNum) return true;
      return false;
    });

    if (matchedClient) {
      const isClientPasswordMatch = !matchedClient.portalPassword || 
                                    matchedClient.portalPassword === cleanSecret || 
                                    cleanSecret === 'client123' || 
                                    (matchedClient.phone && cleanSecret === matchedClient.phone.slice(-4));
      if (isClientPasswordMatch) {
        setSuccessInfo(`Welcome ${matchedClient.tradeName}! Accessing Client Portal...`);
        loginAsClient(matchedClient.pan, cleanSecret);
        return;
      } else {
        setErrorMsg('Client Portal password galat hai. (Default: client123 ya mobile ke last 4 digits)');
        return;
      }
    }

    // 4. If 10-Digit Mobile Number -> Auto Guest 15-Day Free Demo Mode
    if (cleanNum.length === 10) {
      if (!guestName || !guestName.trim()) {
        setErrorMsg('Kripya apna Naam (Name) enter karein — Ye mandatory hai.');
        return;
      }
      const lastFour = cleanNum.slice(-4);
      if (cleanSecret === lastFour || cleanSecret === '1234') {
        setSuccessInfo('Logging in to Guest 15-Day Free Demo Mode...');
        const res = loginAsGuestWithMobile(cleanNum, cleanSecret, guestName.trim());
        if (!res.success) {
          setErrorMsg(res.error || 'Guest login failed.');
        }
        return;
      } else {
        setErrorMsg(`Mobile number ke liye password mobile ke aakhri 4 digits (${lastFour}) hona chahiye.`);
        return;
      }
    }

    // 5. Fallback check for Admin with standard password
    const adminTry = loginAsAdmin(cleanSecret);
    if (adminTry) {
      return;
    }

    setErrorMsg('Registered profile nahi mili. Registered Mobile No, PAN ya Admin credentials enter karein.');
  };

  // Quick Demo Autofills for easy testing
  const handleQuickFill = (type: 'ADMIN' | 'STAFF' | 'GUEST') => {
    setErrorMsg('');
    setSuccessInfo('');
    if (type === 'ADMIN') {
      setIdentifier('admin');
      setSecret('admin123');
      setGuestName('');
    } else if (type === 'STAFF') {
      const firstStaff = team[0];
      setIdentifier(firstStaff?.phone || firstStaff?.name || '9876500001');
      setSecret(firstStaff?.pin || '1234');
      setGuestName('');
    } else if (type === 'GUEST') {
      setIdentifier('9876543210');
      setSecret('3210');
      setGuestName('Demo CA Professional');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-300">
      
      {/* Top Minimal Header */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-300">
            <Scale size={22} className="text-slate-950 font-black" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider text-white font-serif flex items-center gap-2">
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

      {/* Center Aligned Unified Login Box */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 my-auto w-full">
        
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-slate-900/90 border-2 border-amber-500/40 p-6 sm:p-8 shadow-2xl shadow-amber-500/10 backdrop-blur-xl relative">
            
            {/* Logo and TASK-VAANI Title */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30 border border-amber-300">
                <Scale size={28} className="text-slate-950 font-black" />
              </div>
              <h2 className="text-2xl font-black text-white font-serif tracking-wide">
                TASK-VAANI
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Statutory Compliance & Practice Management
              </p>
            </div>

            {/* Smart Unified Login Form */}
            <form onSubmit={handleSmartLogin} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Smartphone size={13} className="text-amber-400" />
                  <span>Registered Mobile No. / PAN / ID *</span>
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => handleIdentifierChange(e.target.value)}
                  placeholder="e.g. 9876543210 / AAACA1234F / admin"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono font-bold text-white text-sm placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-all shadow-inner"
                />
              </div>

              {/* Mandatory Name Field for Guest Users */}
              {identifier.replace(/[^0-9]/g, '').length === 10 && (
                <div className="animate-in fade-in">
                  <label className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Users size={13} className="text-amber-400" />
                    <span>Your Name (Mandatory) *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Enter your full name (e.g. CA Amit Sharma / Demo User)"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-amber-500/50 text-white text-sm placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-all shadow-inner font-medium"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Key size={13} className="text-amber-400" />
                    <span>Password / 4-Digit PIN *</span>
                  </label>
                  {identifier.replace(/[^0-9]/g, '').length === 10 && (
                    <span className="text-[10px] text-amber-400 font-mono">
                      Guest PIN: <strong>{identifier.replace(/[^0-9]/g, '').slice(-4)}</strong>
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Enter Password / PIN (e.g. last 4 digits)"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-white text-sm placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-all shadow-inner"
                />
              </div>

              {/* Status Message */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium animate-in fade-in">
                  {errorMsg}
                </div>
              )}

              {successInfo && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span>{successInfo}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all mt-2"
              >
                <span>Sign In to TASK-VAANI</span>
                <ArrowRight size={16} />
              </button>

              {/* Quick Fill Demo Chips */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[10px]">
                <span className="text-slate-500">Quick Test:</span>
                <button
                  type="button"
                  onClick={() => handleQuickFill('ADMIN')}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-medium transition-colors"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('STAFF')}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-medium transition-colors"
                >
                  Staff
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('GUEST')}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 font-medium transition-colors"
                >
                  Guest Demo
                </button>
              </div>

            </form>

          </div>
        </div>

      </main>

      {/* Bottom Section: Expandable / Hide Details Button & Features */}
      <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-6">
        
        {/* Toggle / Hide Button with Tick Box */}
        <div className="flex items-center justify-center mb-4">
          <button
            type="button"
            onClick={() => setShowFeatures(prev => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-xs font-bold text-slate-300 transition-all shadow-md active:scale-95"
          >
            {showFeatures ? (
              <CheckSquare size={16} className="text-amber-400" />
            ) : (
              <Square size={16} className="text-slate-500" />
            )}
            <span>Explore Features & System Details ({showFeatures ? 'Hide Details' : 'Show Details'})</span>
            {showFeatures ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Collapsible Features Grid (Picture 4 Content) */}
        {showFeatures && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-950/80 border border-slate-800/90 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 space-y-6 text-left">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono mb-2">
                  <Sparkles size={13} className="text-amber-400" />
                  <span>AI-Powered CA Practice Operating System</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white font-serif">
                  Autonomous Statutory Compliance & Practice Management.
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              Automate monthly GST Returns, TDS Challans, ITR & ROC Compliances. Parse statutory PDF certificates with zero duplication and manage staff shifts seamlessly.
            </p>

            {/* 4 Core Pillars Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all">
                <div className="flex items-center gap-2.5 text-amber-400 font-bold text-xs mb-1.5">
                  <ShieldCheck size={16} />
                  <span>Statutory Compliance Matrix</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  GSTR-3B, GSTR-1, PMT-06, TDS 24Q/26Q, AOC-4, DIR-3 KYC with instant status flags.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 transition-all">
                <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-xs mb-1.5">
                  <Sparkles size={16} />
                  <span>TASK-VAANI Agentic AI</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Reads GST REG-06, PAN cards & Bank statements. Auto-merges existing profiles with 0 duplicates.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/40 transition-all">
                <div className="flex items-center gap-2.5 text-blue-400 font-bold text-xs mb-1.5">
                  <FolderKanban size={16} />
                  <span>Document Vault & Notices</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Client-indexed repository for Bank Statements, Invoices, and DRC-01/ASMT-10 notices.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 transition-all">
                <div className="flex items-center gap-2.5 text-purple-400 font-bold text-xs mb-1.5">
                  <Users size={16} />
                  <span>Staff Attendance & Shift Logs</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Office Shift IN, Lunch Break push timers, biometric punch logs, and extra billing.
                </p>
              </div>

            </div>

          </div>
        )}

      </section>

      {/* Footer with Contact Us & WhatsApp / Email / Phone */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950/70 backdrop-blur-xl py-4 px-4 sm:px-6 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="text-center md:text-left">
            <p className="font-bold text-white font-serif flex items-center justify-center md:justify-start gap-1.5">
              <span>TASK-VAANI</span>
              <span className="text-[10px] text-amber-400 font-sans font-normal">• Statutory Compliance Hub</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Built for Chartered Accountants & Tax Professionals
            </p>
          </div>

          {/* Contact Us Interactive Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mr-1">
              Contact Us:
            </span>

            {/* Direct Phone Call */}
            <a
              href="tel:+918982147763"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-200 hover:text-white font-mono text-[11px] font-bold transition-all shadow-sm active:scale-95"
              title="Call +91-8982147763"
            >
              <Phone size={13} className="text-amber-400" />
              <span>+91-8982147763</span>
            </a>

            {/* Direct WhatsApp Chat */}
            <a
              href="https://wa.me/918982147763?text=Namaste%20TASK-VAANI%20Support%2C%20I%20have%20a%20query%20regarding%20the%20app."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-[11px] font-bold transition-all shadow-sm active:scale-95"
              title="Direct WhatsApp Chat"
            >
              <MessageCircle size={13} className="text-emerald-400" />
              <span>WhatsApp Chat</span>
            </a>

            {/* Direct Email */}
            <a
              href="mailto:arya.taskmanagement@gmail.com"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-200 hover:text-white text-[11px] font-medium transition-all shadow-sm active:scale-95"
              title="Send Email"
            >
              <Mail size={13} className="text-amber-400" />
              <span>arya.taskmanagement@gmail.com</span>
            </a>
          </div>

        </div>
      </footer>

    </div>
  );
};
