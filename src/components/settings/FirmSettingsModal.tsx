import React, { useState, useEffect } from 'react';
import { useTasks } from '../../context/TaskContext';
import { FirebaseService } from '../../services/firebaseService';
import { StorageService } from '../../services/storage';
import { Settings, Flame, Shield, Bell, Save, Check, Mail, Cloud, Eye, EyeOff, RefreshCw, Trash2, AlertTriangle, AlertCircle, Users } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { GuestLeadsModal } from './GuestLeadsModal';

export const FirmSettingsModal: React.FC = () => {
  const { settings, updateSettings, resetAllData, fullAppReset } = useTasks();
  const [isGuestLeadsOpen, setIsGuestLeadsOpen] = useState(false);

  const [firmName, setFirmName] = useState(settings.firmName || '');
  const [firmEmail, setFirmEmail] = useState(settings.firmEmail || '');
  const [firmPhone, setFirmPhone] = useState(settings.firmPhone || '');
  const [alarmTime, setAlarmTime] = useState(settings.morningAlarmTime || '10:30');
  const [enableSound, setEnableSound] = useState(settings.enableSoundChime ?? true);
  const [adminPassword, setAdminPassword] = useState(settings.adminPasswordHash || 'admin123');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [cloudStorageEmail, setCloudStorageEmail] = useState(settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com');
  const [googleDriveSync, setGoogleDriveSync] = useState(settings.googleDriveSyncEnabled ?? true);
  const [saved, setSaved] = useState(false);

  // Sync internal form state whenever settings are updated or loaded from Cloud
  useEffect(() => {
    if (settings) {
      if (settings.firmName) setFirmName(settings.firmName);
      if (settings.firmEmail) setFirmEmail(settings.firmEmail);
      if (settings.firmPhone) setFirmPhone(settings.firmPhone);
      if (settings.morningAlarmTime) setAlarmTime(settings.morningAlarmTime);
      if (typeof settings.enableSoundChime === 'boolean') setEnableSound(settings.enableSoundChime);
      if (settings.adminPasswordHash) setAdminPassword(settings.adminPasswordHash);
      if (settings.cloudStorageEmail) setCloudStorageEmail(settings.cloudStorageEmail);
      if (typeof settings.googleDriveSyncEnabled === 'boolean') setGoogleDriveSync(settings.googleDriveSyncEnabled);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPayload = {
      firmName: firmName.trim(),
      firmEmail: firmEmail.trim(),
      firmPhone: firmPhone.trim(),
      morningAlarmTime: alarmTime,
      enableSoundChime: enableSound,
      adminPasswordHash: adminPassword,
      cloudStorageEmail: cloudStorageEmail.trim(),
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

    // 3. Sync to Firebase Firestore online cloud if configured
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
              onChange={(e) => setCloudStorageEmail(e.target.value)}
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
              onChange={(e) => setGoogleDriveSync(e.target.checked)}
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
              onChange={(e) => setFirmName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Official Firm Email</label>
              <input
                type="email"
                value={firmEmail}
                onChange={(e) => setFirmEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Firm Phone Number</label>
              <input
                type="text"
                value={firmPhone}
                onChange={(e) => setFirmPhone(e.target.value)}
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
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
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
