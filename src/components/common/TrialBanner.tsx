import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Clock, 
  ShieldAlert, 
  Phone, 
  MessageCircle, 
  Mail, 
  Sparkles, 
  X, 
  ExternalLink,
  Lock,
  ArrowRight
} from 'lucide-react';

interface Props {
  onOpenUpgradeModal?: () => void;
}

export const TrialBanner: React.FC<Props> = ({ onOpenUpgradeModal }) => {
  const { currentUser, currentRole, logout } = useAuth();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  if (currentRole !== 'GUEST' || !currentUser?.trialInfo) return null;

  const { daysRemaining, isExpired, endDate, firmName } = currentUser.trialInfo;
  const expiryFormatted = new Date(endDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return (
    <>
      <div className={`w-full px-4 py-2.5 text-xs font-bold border-b shadow-md flex flex-col sm:flex-row items-center justify-between gap-2.5 ${
        isExpired
          ? 'bg-gradient-to-r from-red-950 via-rose-900 to-red-950 text-red-100 border-red-500/40'
          : 'bg-gradient-to-r from-purple-950 via-indigo-900 to-purple-950 text-purple-100 border-purple-500/40'
      }`}>
        
        {/* Left Status Info */}
        <div className="flex items-center gap-2 flex-wrap text-center sm:text-left justify-center sm:justify-start">
          <span className={`w-2.5 h-2.5 rounded-full ${isExpired ? 'bg-red-400 animate-ping' : 'bg-purple-400 animate-pulse'}`}></span>
          
          {isExpired ? (
            <span className="flex items-center gap-1.5">
              <Lock size={14} className="text-red-300" />
              <strong>15-Day Free Demo Expired (Read-Only Mode):</strong> 
              <span className="font-normal text-red-200">Aap purane tasks read/view kar sakte hain. Full access ke liye Admin se contact karein.</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-amber-400" />
              <strong>15-Day Free Demo Active:</strong> 
              <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black font-mono">
                {daysRemaining} Days Left
              </span>
              <span className="font-normal text-purple-200">(Valid till {expiryFormatted})</span>
              {firmName && <span className="text-amber-300 font-medium">• {firmName}</span>}
            </span>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUpgradeDialog(true)}
            className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Sparkles size={13} />
            <span>{isExpired ? 'Upgrade to Continue' : 'Contact Admin & Pricing'}</span>
          </button>

          <button
            onClick={logout}
            className="px-2.5 py-1 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-[11px] font-medium transition-all"
          >
            Log Off
          </button>
        </div>

      </div>

      {/* Upgrade / Contact Administration Modal */}
      {showUpgradeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border-2 border-amber-500/50 p-6 sm:p-7 shadow-2xl shadow-amber-500/20 text-slate-100 relative">
            
            <button
              onClick={() => setShowUpgradeDialog(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center mx-auto mb-2 shadow-lg shadow-amber-500/30">
                <Sparkles size={24} />
              </div>
              <h3 className="text-lg font-black text-white font-serif">
                TASK-VAANI Administration Support
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isExpired 
                  ? 'Aapka 15-Day Demo complete ho gaya hai. Enterprise subscription ke liye sampark karein.' 
                  : 'Full Enterprise License, Multi-Staff & Cloud Sync ke liye Administration se connect karein.'}
              </p>
            </div>

            {/* Support Actions */}
            <div className="space-y-3 mb-5">
              
              {/* WhatsApp Direct */}
              <a
                href="https://wa.me/918982147763?text=Namaste%20TASK-VAANI%20Admin%2C%20I%20want%20to%20upgrade%2Fcontinue%20my%20practice%20subscription."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              >
                <MessageCircle size={16} />
                <span>Chat on WhatsApp (+91-8982147763)</span>
              </a>

              {/* Direct Call */}
              <a
                href="tel:+918982147763"
                className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
              >
                <Phone size={16} className="text-amber-400" />
                <span>Call Support (+91-8982147763)</span>
              </a>

              {/* Direct Email */}
              <a
                href="mailto:arya.taskmanagement@gmail.com?subject=TASK-VAANI%20Subscription%20Inquiry"
                className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
              >
                <Mail size={16} className="text-amber-400" />
                <span>Email: arya.taskmanagement@gmail.com</span>
              </a>

            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 text-center">
              💡 <strong>Note:</strong> Aapke banaye gaye sabhi tasks aur clients system me surakshit hain. Subscription activate hote hi aap instantly wahi se aage continue kar payenge.
            </div>

          </div>
        </div>
      )}
    </>
  );
};
