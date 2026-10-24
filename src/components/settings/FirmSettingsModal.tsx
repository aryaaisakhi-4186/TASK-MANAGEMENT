import React, { useState, useEffect } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { FirebaseService } from '../../services/firebaseService';
import { getSavedFirebaseConfig, saveFirebaseConfig, removeFirebaseConfig, initFirebase } from '../../firebase/config';
import { StorageService } from '../../services/storage';
import { OnlineDataService } from '../../services/onlineDataService';
import { Settings, Flame, Shield, Bell, Save, Check, Mail, Cloud, Eye, EyeOff, RefreshCw, Trash2, AlertTriangle, AlertCircle, Users, Rocket } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { GuestLeadsModal } from './GuestLeadsModal';
import { OnlineUpdateModal } from '../common/OnlineUpdateModal';

export const FirmSettingsModal: React.FC = () => {
  const { settings, updateSettings, resetAllData, fullAppReset, clients, tasks, team, extraWork, documents, attendanceRecords } = useTasks();
  const { refreshAdminSession } = useAuth();
  const [isGuestLeadsOpen, setIsGuestLeadsOpen] = useState(false);
  const [isOnlineUpdateOpen, setIsOnlineUpdateOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [firmName, setFirmName] = useState(settings.firmName || 'M/S. ARYA ASSOCIATES, ACCOUNTS & TAXATION');
  const [firmEmail, setFirmEmail] = useState(settings.firmEmail || 'arya.taskmanagement@gmail.com');
  const [firmPhone, setFirmPhone] = useState(settings.firmPhone || '+91-8982147763');
  const [alarmTime, setAlarmTime] = useState(settings.morningAlarmTime || '10:30');
  const [enableSound, setEnableSound] = useState(settings.enableSoundChime ?? true);
  const [adminPassword, setAdminPassword] = useState(() => StorageService.getAdminPassword() || settings.adminPasswordHash || 'admin123');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [cloudStorageEmail, setCloudStorageEmail] = useState(settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com');
  const [googleDriveSync, setGoogleDriveSync] = useState(settings.googleDriveSyncEnabled ?? true);
  const [saved, setSaved] = useState(false);

  // Firebase Real-Time Cloud Config State
  const existingFb = getSavedFirebaseConfig();
  const [showFirebaseSetup, setShowFirebaseSetup] = useState(false);
  const [fbApiKey, setFbApiKey] = useState(existingFb?.apiKey || '');
  const [fbProjectId, setFbProjectId] = useState(existingFb?.projectId || '');
  const [fbAppId, setFbAppId] = useState(existingFb?.appId || '');
  const [fbAuthDomain, setFbAuthDomain] = useState(existingFb?.authDomain || '');
  const [fbStatusMsg, setFbStatusMsg] = useState<string | null>(null);
  const isFirebaseActive = FirebaseService.isConfigured();

  // Sync internal form state whenever settings are updated from Cloud, but ONLY if user hasn't typed modifications
  useEffect(() => {
    if (settings && !isDirty) {
      if (settings.firmName) setFirmName(settings.firmName);
      if (settings.firmEmail) setFirmEmail(settings.firmEmail);
      if (settings.firmPhone) setFirmPhone(settings.firmPhone);
      if (settings.morningAlarmTime) setAlarmTime(settings.morningAlarmTime);
      if (typeof settings.enableSoundChime === 'boolean') setEnableSound(settings.enableSoundChime);
      const savedPass = StorageService.getAdminPassword();
      setAdminPassword(savedPass || settings.adminPasswordHash || 'admin123');
      if (settings.cloudStorageEmail) setCloudStorageEmail(settings.cloudStorageEmail);
      if (typeof settings.googleDriveSyncEnabled === 'boolean') setGoogleDriveSync(settings.googleDriveSyncEnabled);
    }
  }, [settings, isDirty]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFirmName = firmName.trim() || 'M/S. ARYA ASSOCIATES, ACCOUNTS & TAXATION';
    const cleanFirmEmail = firmEmail.trim() || 'arya.taskmanagement@gmail.com';
    const cleanFirmPhone = firmPhone.trim() || '+91-8982147763';
    const cleanCloudEmail = cloudStorageEmail.trim() || 'arya.taskmanagement@gmail.com';
    const cleanPassword = adminPassword.trim() || 'admin123';

    // Save master admin password immediately into dedicated permanent local key
    StorageService.saveAdminPassword(cleanPassword);

    const updatedPayload = {
      firmName: cleanFirmName,
      firmEmail: cleanFirmEmail,
      firmPhone: cleanFirmPhone,
      morningAlarmTime: alarmTime,
      enableSoundChime: enableSound,
      adminPasswordHash: cleanPassword,
      cloudStorageEmail: cleanCloudEmail,
      googleDriveSyncEnabled: googleDriveSync,
      lastCloudSyncTimestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };

    // 1. Update React Context state
    updateSettings(updatedPayload);

    // 2. Write directly to persistent LocalStorage
    StorageService.saveSettings({
      ...settings,
      ...updatedPayload
    });

    // 3. Immediately refresh admin session so navbar and header reflect new firm details
    refreshAdminSession();
    setIsDirty(false);

    // 4. Immediately trigger auto sync to online DB
    OnlineDataService.scheduleAutoOnlineSync({
      clients,
      tasks,
      team,
      extraWork,
      documents,
      attendanceRecords,
      settings: { ...settings, ...updatedPayload },
      guestLeads: StorageService.getGuestLeads()
    });

    // 5. Sync to Firebase Firestore online cloud if configured
    try {
      if (FirebaseService.isConfigured()) {
        await FirebaseService.upsertDoc('system', 'settings', updatedPayload);
      }
    } catch (err) {
      console.warn('Firebase settings save note:', err);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white font-serif tracking-tight flex items-center gap-2">
          <Settings className="text-amber-500" /> Firm Configuration & Cloud Storage
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-400 mt-0.5">
          Configure firm details, Google Drive cloud sync & email destinations for zero device storage consumption
        </p>
      </div>

      <GlassCard className="p-6 max-w-2xl mx-auto" variant="elevated">
        
        {/* Cloud Archival Active Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-blue-500/15 border border-amber-500/30 flex items-start gap-3">
          <Cloud size={24} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-xs">Zero Device Storage Policy (Active)</h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              All compliance Excel reports are automatically pushed into <strong>Google Drive / Google Sheets</strong> and PDF reports are emailed directly to <strong>{cloudStorageEmail}</strong>. Neither app cache nor mobile phone storage is filled.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          
          {/* Cloud Storage Destination Email */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
              <Mail size={14} className="text-amber-600" /> Cloud Storage Target Email (PDF & Excel Reports)
            </label>
            <input
              type="email"
              required
              value={cloudStorageEmail}
              onChange={(e) => { setCloudStorageEmail(e.target.value); setIsDirty(true); }}
              placeholder="arya.taskmanagement@gmail.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono font-bold focus:border-amber-500 focus:outline-none shadow-sm"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              All generated PDFs will be mailed to this address as attachments.
            </p>
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="googleDriveSync"
              checked={googleDriveSync}
              onChange={(e) => { setGoogleDriveSync(e.target.checked); setIsDirty(true); }}
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
            <label htmlFor="googleDriveSync" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Auto-sync compliance matrix to Google Sheets in Google Drive
            </label>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Firm Name (Header & PDF Certificates)</label>
            <input
              type="text"
              value={firmName}
              onChange={(e) => { setFirmName(e.target.value); setIsDirty(true); }}
              placeholder="M/S. ARYA ASSOCIATES, ACCOUNTS & TAXATION"
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Official Firm Email</label>
              <input
                type="email"
                value={firmEmail}
                onChange={(e) => { setFirmEmail(e.target.value); setIsDirty(true); }}
                placeholder="arya.taskmanagement@gmail.com"
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Firm Phone Number</label>
              <input
                type="text"
                value={firmPhone}
                onChange={(e) => { setFirmPhone(e.target.value); setIsDirty(true); }}
                placeholder="+91-8982147763"
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Morning Statutory Alarm Time</label>
              <input
                type="text"
                value={alarmTime}
                onChange={(e) => setAlarmTime(e.target.value)}
                placeholder="10:30"
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Admin Master Password</label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); setIsDirty(true); }}
                  placeholder="Enter Admin Master Password"
                  className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  title={showAdminPassword ? 'Hide Password' : 'Show Password'}
                  className="absolute right-3 top-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="soundChime"
              checked={enableSound}
              onChange={(e) => setEnableSound(e.target.checked)}
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
            <label htmlFor="soundChime" className="text-xs text-slate-700 dark:text-slate-300">
              Enable Indian Temple / Meditative Harmonic Sound Chime on 10:30 AM Alarm
            </label>
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg flex items-center gap-2"
            >
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? 'Cloud Settings Saved!' : 'Save Cloud Configuration'}
            </button>
          </div>
        </form>
      </GlassCard>

      {/* 1-Click Online App Updater & Real-Time Cloud Sync Card */}
      <GlassCard className="p-6 max-w-2xl mx-auto border-emerald-500/30 space-y-4" variant="elevated">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
              <Rocket size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">🚀 Real-Time Online Database & GitHub Publisher</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  ● Auto-Sync ON
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Har naya Client, Task aur Compliance change real-time me save hota hai. Live GitHub Pages par publish karne ke liye button dabayein.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowFirebaseSetup(!showFirebaseSetup)}
              className="px-3 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Flame size={14} className="text-amber-500" />
              <span>{isFirebaseActive ? 'Firebase Connected' : 'Setup Firebase'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOnlineUpdateOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
            >
              <Rocket size={14} />
              <span>Update App Online</span>
            </button>
          </div>
        </div>

        {showFirebaseSetup && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-amber-500/30 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Flame size={15} className="text-amber-500" />
                <span>Firebase Firestore Real-Time Cloud Sync (Optional Cross-City Cloud DB)</span>
              </h4>
              {isFirebaseActive && (
                <button
                  type="button"
                  onClick={() => {
                    removeFirebaseConfig();
                    setFbApiKey('');
                    setFbProjectId('');
                    setFbAppId('');
                    setFbAuthDomain('');
                    setFbStatusMsg('Firebase configuration removed. Using Server & GitHub Online DB.');
                  }}
                  className="text-[10px] text-red-500 hover:underline font-bold"
                >
                  Disconnect Firebase
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Aapka data pehle se <strong>Local Server (`public/online-db.json`)</strong> aur <strong>GitHub Pages</strong> par save hota hai. Agar aap 24x7 Firebase Firestore bhi jodna chahein, to apना Firebase Project ID aur API Key yahan save karein:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={fbProjectId}
                onChange={(e) => setFbProjectId(e.target.value)}
                placeholder="Firebase Project ID (e.g. task-vaani-db)"
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
              />
              <input
                type="text"
                value={fbApiKey}
                onChange={(e) => setFbApiKey(e.target.value)}
                placeholder="Firebase Web API Key (AIzaSy...)"
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
              />
              <input
                type="text"
                value={fbAppId}
                onChange={(e) => setFbAppId(e.target.value)}
                placeholder="Firebase App ID (1:123456:web:...)"
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
              />
              <input
                type="text"
                value={fbAuthDomain}
                onChange={(e) => setFbAuthDomain(e.target.value)}
                placeholder="Auth Domain (optional: project.firebaseapp.com)"
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
              />
            </div>
            {fbStatusMsg && (
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{fbStatusMsg}</p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!fbProjectId.trim() || !fbApiKey.trim()) {
                    alert('Kripya Firebase Project ID aur API Key enter karein.');
                    return;
                  }
                  const cfg = {
                    projectId: fbProjectId.trim(),
                    apiKey: fbApiKey.trim(),
                    appId: fbAppId.trim() || '1:000000:web:000000',
                    authDomain: fbAuthDomain.trim() || `${fbProjectId.trim()}.firebaseapp.com`,
                    storageBucket: `${fbProjectId.trim()}.appspot.com`,
                    messagingSenderId: '0000000000'
                  };
                  saveFirebaseConfig(cfg);
                  initFirebase(cfg);
                  setFbStatusMsg('✅ Firebase Real-Time Cloud Connected! All changes will now sync live to Firestore.');
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm"
              >
                Save & Connect Firebase
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Guest Demo Leads & Trial Tracking Card */}
      <GlassCard className="p-6 max-w-2xl mx-auto" variant="elevated">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Guest Demo Leads & 15-Day Trial Tracking</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                View all registered guest mobile numbers, names, trial days remaining, and follow-ups.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsGuestLeadsOpen(true)}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Users size={14} />
            <span>Open Leads Viewer</span>
          </button>
        </div>
      </GlassCard>

      <GuestLeadsModal 
        isOpen={isGuestLeadsOpen}
        onClose={() => setIsGuestLeadsOpen(false)}
      />

      <OnlineUpdateModal
        isOpen={isOnlineUpdateOpen}
        onClose={() => setIsOnlineUpdateOpen(false)}
      />

      {/* Danger Zone: App Reset & Full App Reset */}
      <GlassCard className="p-6 max-w-2xl mx-auto border-red-500/30" variant="elevated" glow="gold">
        <div className="flex items-center gap-2.5 mb-4 text-red-600 dark:text-red-400">
          <AlertTriangle size={20} className="shrink-0" />
          <h3 className="font-bold text-sm tracking-tight">Danger Zone & System Reset Center</h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 mb-5">
          Select an option below to reset demo data or completely wipe out all local data for a fresh practice setup.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Card 1: App Reset (Seed Data) */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-amber-900 dark:text-amber-300">
                <RefreshCw size={15} className="text-amber-600" />
                <span>🔄 App Reset (Seed Data)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Resets clients, compliance tasks, and team staff back to the standard CA seed demo templates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to restore default seed demo data? Any custom tasks added will be replaced.')) {
                  resetAllData();
                  alert('App data successfully reset to default seed records!');
                }
              }}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={13} /> Reset to Demo Data
            </button>
          </div>

          {/* Card 2: Full App Reset (Zero Data Wipeout) */}
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-xs text-red-900 dark:text-red-300">
                <Trash2 size={15} className="text-red-600" />
                <span>💥 Full App Reset (0 Data)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Completely purges all clients, tasks, extra work, and chat history. Sets database to 0 for a 100% fresh practice start.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const conf = window.prompt('⚠️ WARNING: This will permanently delete ALL clients, tasks, extra billing & attendance (0 data).\n\nTo confirm, type "RESET" in the box below:');
                if (conf === 'RESET' || conf === 'reset') {
                  fullAppReset();
                  alert('💥 Full App Reset Complete! All records have been cleared to zero for a clean start.');
                }
              }}
              className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/30 transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 size={13} /> Full App Reset (Zero Wipe)
            </button>
          </div>

        </div>
      </GlassCard>
    </div>
  );
};
