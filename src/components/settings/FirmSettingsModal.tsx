import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { Settings, Shield, Bell, Save, Check, Mail, Cloud, Eye, EyeOff } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';

export const FirmSettingsModal: React.FC = () => {
  const { settings, updateSettings, resetAllData } = useTasks();

  const [firmName, setFirmName] = useState(settings.firmName);
  const [firmEmail, setFirmEmail] = useState(settings.firmEmail);
  const [firmPhone, setFirmPhone] = useState(settings.firmPhone);
  const [alarmTime, setAlarmTime] = useState(settings.morningAlarmTime || '10:30');
  const [enableSound, setEnableSound] = useState(settings.enableSoundChime);
  const [adminPassword, setAdminPassword] = useState(settings.adminPasswordHash);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [cloudStorageEmail, setCloudStorageEmail] = useState(settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com');
  const [googleDriveSync, setGoogleDriveSync] = useState(settings.googleDriveSyncEnabled ?? true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      firmName,
      firmEmail,
      firmPhone,
      morningAlarmTime: alarmTime,
      enableSoundChime: enableSound,
      adminPasswordHash: adminPassword,
      cloudStorageEmail,
      googleDriveSyncEnabled: googleDriveSync,
      lastCloudSyncTimestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => { if (window.confirm('Reset all demo data to default CA seed records?')) resetAllData(); }}
              className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white text-xs font-bold transition-all"
            >
              Reset Seed Data
            </button>

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
    </div>
  );
};
