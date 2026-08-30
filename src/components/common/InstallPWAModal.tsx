import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, CheckCircle2, QrCode, Share, PlusSquare, ArrowRight } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallPWAModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const localIpUrl = 'http://192.168.1.13:5173/';

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('To install on Android: Tap Chrome menu (⋮) -> "Add to Home screen"\nTo install on iPhone: Tap Safari Share (⎋) -> "Add to Home Screen"');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-amber-400/50 rounded-3xl p-6 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full">
          <X size={18} />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Smartphone size={28} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">Run TASK-VAANI on Mobile</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Install as a native full-screen standalone app on your Android or iPhone
          </p>
        </div>

        {/* Direct Mobile Wi-Fi URL Box */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Live Phone Wi-Fi URL</p>
              <p className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-0.5 select-all">{localIpUrl}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(localIpUrl); alert('Phone URL copied to clipboard!'); }}
              className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold shadow-sm"
            >
              Copy Link
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Open this URL on your phone's browser (Chrome on Android or Safari on iPhone) while connected to the same Wi-Fi.
          </p>
        </div>

        {/* 1-Click Install Button if supported */}
        {deferredPrompt && (
          <button
            onClick={handleInstallClick}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 mb-5 transition-all"
          >
            <Download size={18} /> Install Standalone Mobile App
          </button>
        )}

        {/* Quick Instructions for iOS & Android */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <p className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Android (Chrome):
            </p>
            <ol className="space-y-1 text-slate-600 dark:text-slate-400 text-[11px] list-decimal list-inside">
              <li>Open link in Google Chrome</li>
              <li>Tap menu (<strong>⋮</strong> top right)</li>
              <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></li>
            </ol>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <p className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span> iPhone (Safari):
            </p>
            <ol className="space-y-1 text-slate-600 dark:text-slate-400 text-[11px] list-decimal list-inside">
              <li>Open link in Apple Safari</li>
              <li>Tap Share button (<strong>⎋</strong> bottom)</li>
              <li>Scroll down & tap <strong>"Add to Home Screen"</strong></li>
            </ol>
          </div>
        </div>

        <div className="mt-5 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
};
