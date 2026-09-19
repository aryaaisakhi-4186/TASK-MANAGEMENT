import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { 
  Sparkles, 
  Building2, 
  MapPin, 
  Mail, 
  CheckCircle2, 
  Calendar, 
  ArrowRight, 
  ShieldCheck
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GuestOnboardingModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { currentUser, updateGuestDemoSetup } = useAuth();
  const { resetToBlankForGuestDemo } = useTasks();

  const [firmName, setFirmName] = useState(currentUser?.trialInfo?.firmName || '');
  const [city, setCity] = useState(currentUser?.trialInfo?.city || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [demoMode, setDemoMode] = useState<'BLANK' | 'SAMPLE'>('BLANK');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !currentUser || currentUser.role !== 'GUEST') return null;

  const handleStartDemo = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Update guest lead details
    updateGuestDemoSetup(firmName.trim() || 'My CA Practice', city.trim() || 'India', email.trim());

    if (demoMode === 'BLANK' && resetToBlankForGuestDemo) {
      resetToBlankForGuestDemo();
    }

    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border-2 border-amber-500/50 p-6 sm:p-8 shadow-2xl shadow-amber-500/20 text-slate-100 relative">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
            <Sparkles size={28} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold mb-2">
            <Calendar size={13} />
            <span>15-Days Free Active Demo Setup</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white font-serif">
            Welcome, {currentUser.name}!
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Kya aap apne CA Firm / Tax Office ke liye 15-Days ka Full Active Free Demo chahte hain?
          </p>
        </div>

        <form onSubmit={handleStartDemo} className="space-y-4 text-xs">
          
          {/* Practice / Firm Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Building2 size={13} className="text-amber-400" />
              <span>CA Firm / Office Name</span>
            </label>
            <input
              type="text"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="e.g. Sharma and Associates / My Tax Consultancy"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* City */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <MapPin size={13} className="text-amber-400" />
                <span>City / State</span>
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Indore, MP"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Mail size={13} className="text-amber-400" />
                <span>Email Address</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. ca.sharma@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Workspace Choice: Blank vs Sample */}
          <div className="pt-2">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
              Select Demo Workspace Type:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              <div 
                onClick={() => setDemoMode('BLANK')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  demoMode === 'BLANK'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs mb-1 text-amber-300">
                  <span>🚀 Clean Blank Slate</span>
                  {demoMode === 'BLANK' && <CheckCircle2 size={14} className="text-amber-400" />}
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Start fresh with 0 sample clients. Create your own custom tasks and compliance matrix.
                </p>
              </div>

              <div 
                onClick={() => setDemoMode('SAMPLE')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  demoMode === 'SAMPLE'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs mb-1 text-amber-300">
                  <span>👁️ Pre-filled Sample Data</span>
                  {demoMode === 'SAMPLE' && <CheckCircle2 size={14} className="text-amber-400" />}
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Includes dummy GST/TDS sample tasks and clients for instant tour demonstration.
                </p>
              </div>

            </div>
          </div>

          {/* 15 Days Policy Note */}
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <p className="font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>15-Days Free Active Demo Policy:</span>
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-slate-400">
              <li>15 din tak aap full features (Clients, Tasks, Shifts, AI Bot) freely use kar sakte hain.</li>
              <li>15 din ke baad creation lock ho jayega, par aapke purane banaye gaye tasks read/view karne ke liye hamesha surakshit rahenge.</li>
              <li>Aage continue karne ke liye administration (Charges and License) se contact kar sakte hain.</li>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all mt-3"
          >
            <span>Start 15-Days Free Demo Workspace</span>
            <ArrowRight size={16} />
          </button>

        </form>

      </div>
    </div>
  );
};
