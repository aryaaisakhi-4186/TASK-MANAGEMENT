import React, { useState, useEffect } from 'react';
import { 
  X, 
  Cloud, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  UploadCloud, 
  DownloadCloud, 
  Flame, 
  Key, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useTasks } from '../../context/TaskContext';
import { 
  getSavedFirebaseConfig, 
  saveFirebaseConfig, 
  removeFirebaseConfig, 
  FirebaseCustomConfig,
  initFirebase 
} from '../../firebase/config';
import { FirebaseService } from '../../services/firebaseService';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseSyncModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { clients, tasks, team, extraWork, documents, attendanceRecords, settings } = useTasks();
  
  useEscapeKey(onClose, isOpen);

  const [config, setConfig] = useState<FirebaseCustomConfig>({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  });

  const [rawJsonInput, setRawJsonInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const saved = getSavedFirebaseConfig();
    if (saved) {
      setConfig(saved);
      setIsConnected(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleParseJson = () => {
    try {
      const cleaned = rawJsonInput.trim().replace(/^[^{]*/, '').replace(/[^}]*$/, '');
      const parsed = JSON.parse(cleaned);
      if (parsed.projectId && parsed.apiKey) {
        const newCfg: FirebaseCustomConfig = {
          apiKey: parsed.apiKey || '',
          authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
          projectId: parsed.projectId || '',
          storageBucket: parsed.storageBucket || `${parsed.projectId}.appspot.com`,
          messagingSenderId: parsed.messagingSenderId || '',
          appId: parsed.appId || '',
          measurementId: parsed.measurementId || ''
        };
        setConfig(newCfg);
        setStatusMessage({ type: 'info', text: 'Firebase config extracted from JSON! Click "Save & Connect Firebase" to activate.' });
      } else {
        setStatusMessage({ type: 'error', text: 'JSON must contain at least "projectId" and "apiKey".' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Invalid JSON format. Please paste valid Firebase config snippet.' });
    }
  };

  const handleSaveAndConnect = () => {
    if (!config.projectId || !config.apiKey) {
      setStatusMessage({ type: 'error', text: 'Project ID and API Key are required.' });
      return;
    }

    try {
      saveFirebaseConfig(config);
      const { db } = initFirebase(config);
      if (db) {
        setIsConnected(true);
        setStatusMessage({ type: 'success', text: 'Firebase Connected Successfully! You can now sync all data to the cloud.' });
      } else {
        setStatusMessage({ type: 'error', text: 'Could not connect to Firebase with provided credentials.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to connect to Firebase.' });
    }
  };

  const handleDisconnect = () => {
    removeFirebaseConfig();
    setConfig({
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: ''
    });
    setIsConnected(false);
    setStatusMessage({ type: 'info', text: 'Firebase disconnected. Application is now using browser local storage.' });
  };

  const handleSyncToCloud = async () => {
    setSyncing(true);
    setStatusMessage(null);

    try {
      const res = await FirebaseService.syncAllToCloud({
        clients,
        tasks,
        team,
        extraWork,
        documents,
        attendanceRecords,
        settings
      });
      setStatusMessage({ type: 'success', text: res.message });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error syncing data to Firebase.' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-amber-400/40 rounded-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          title="Close Modal"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800 transition-all"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0">
            <Flame size={26} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif flex items-center gap-2">
              <span>Firebase Cloud & Online Sync</span>
              {isConnected ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Cloud Connected
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                  Local Mode
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Real-time Firestore Database • Zero Device Storage • 100% Online Cross-Device Sync
            </p>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`mb-4 p-3.5 rounded-2xl text-xs flex items-center gap-2 ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-red-500/15 border border-red-500/30 text-red-800 dark:text-red-300'
              : 'bg-blue-500/15 border border-blue-500/30 text-blue-800 dark:text-blue-300'
          }`}>
            {statusMessage.type === 'success' ? <Check size={16} className="text-emerald-500" /> : <AlertCircle size={16} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto space-y-4 text-xs">
          
          {/* Section 1: Cloud Sync Controls (When Connected) */}
          {isConnected && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Cloud className="text-amber-500" size={16} /> Live Cloud Sync Actions
                </span>
                <span className="text-[11px] font-mono text-slate-500">Project: <strong>{config.projectId}</strong></span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleSyncToCloud}
                  disabled={syncing}
                  className="p-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {syncing ? <RefreshCw size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                  {syncing ? 'Syncing to Cloud...' : '⚡ Push All Data to Firebase Cloud'}
                </button>

                <button
                  onClick={handleDisconnect}
                  className="p-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-red-500/20 hover:text-red-600 text-slate-700 dark:text-slate-300 font-bold transition-all"
                >
                  Disconnect Firebase
                </button>
              </div>

              <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                <span>Total: {clients.length} Clients • {tasks.length} Tasks • {team.length} Staff</span>
                <span className="text-emerald-600 font-bold">● Auto Realtime Active</span>
              </div>
            </div>
          )}

          {/* Section 2: Firebase Credentials Form */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">Firebase Project Configuration</span>
              <a
                href="https://console.firebase.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
              >
                <ExternalLink size={12} /> Open Firebase Console
              </a>
            </div>

            {/* Quick Paste JSON */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <label className="block font-bold text-[11px] text-amber-900 dark:text-amber-300">
                ⚡ Quick Setup: Paste Firebase Config snippet (from Firebase Console Project Settings):
              </label>
              <div className="flex items-center gap-2">
                <textarea
                  rows={2}
                  value={rawJsonInput}
                  onChange={(e) => setRawJsonInput(e.target.value)}
                  placeholder='const firebaseConfig = { apiKey: "...", projectId: "...", ... };'
                  className="flex-1 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleParseJson}
                  className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] shrink-0"
                >
                  Auto-Fill
                </button>
              </div>
            </div>

            {/* Manual Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[10px] uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Project ID *
                </label>
                <input
                  type="text"
                  value={config.projectId}
                  onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
                  placeholder="e.g. task-vaani-ca"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-[10px] uppercase text-slate-600 dark:text-slate-400 mb-1">
                  API Key *
                </label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-[10px] uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Auth Domain
                </label>
                <input
                  type="text"
                  value={config.authDomain}
                  onChange={(e) => setConfig({ ...config, authDomain: e.target.value })}
                  placeholder="project-id.firebaseapp.com"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-[10px] uppercase text-slate-600 dark:text-slate-400 mb-1">
                  App ID
                </label>
                <input
                  type="text"
                  value={config.appId}
                  onChange={(e) => setConfig({ ...config, appId: e.target.value })}
                  placeholder="1:123456789:web:abcdef..."
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              onClick={handleSaveAndConnect}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all"
            >
              <Key size={14} /> Save & Connect Firebase
            </button>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 mt-3 text-xs">
          <span className="text-slate-500 text-[11px]">
            Data is stored securely in your private Firebase Firestore database.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
