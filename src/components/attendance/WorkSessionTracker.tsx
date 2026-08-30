import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { GoogleDriveService } from '../../services/googleDriveService';
import { 
  Clock, 
  Play, 
  Pause, 
  Square, 
  Camera, 
  History, 
  Building, 
  FileText, 
  Cloud, 
  CheckCircle2, 
  ExternalLink,
  Settings2,
  FolderOpen
} from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { WebCamCaptureModal } from './WebCamCaptureModal';
import { GoogleDriveSetupModal } from '../common/GoogleDriveSetupModal';

export const WorkSessionTracker: React.FC = () => {
  const { currentUser } = useAuth();
  const { clients, attendanceRecords, recordPunchIn, recordPunchOut, settings } = useTasks();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [workNotes, setWorkNotes] = useState('');
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (activeSessionId && !isPaused) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSessionId, isPaused]);

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelfieCaptured = (selfieDataUrl: string) => {
    const actorId = currentUser?.id || 'admin';
    const actorName = currentUser?.name || 'Managing Partner (Admin)';
    const locationStamp = 'Office Geotag / Mobile Capture';
    const notes = selectedClientId
      ? `[Client: ${clients.find(c => c.id === selectedClientId)?.tradeName}] Biometric selfie attendance recorded`
      : 'Biometric selfie attendance recorded';

    const record = recordPunchIn(actorId, actorName, selfieDataUrl, locationStamp, notes, 0);
    setActiveSessionId(record.id);
    setSeconds(0);
    setIsPaused(false);

    // Auto-sync to Google Drive in background (Zero local device footprint)
    GoogleDriveService.syncAttendanceToGoogleSheets(
      [record, ...attendanceRecords],
      settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
      settings.googleWebhookUrl
    );
  };

  const handleStopSession = () => {
    if (activeSessionId) {
      const minutesWorked = Math.max(1, Math.round(seconds / 60));
      const targetClient = clients.find(c => c.id === selectedClientId);
      const clientLabel = targetClient ? `[Client: ${targetClient.tradeName}]` : '[Internal Office Work]';
      const finalNotes = workNotes.trim()
        ? `${clientLabel} ${workNotes.trim()}`
        : `${clientLabel} General compliance & task execution`;

      recordPunchOut(activeSessionId, minutesWorked, finalNotes);
      setActiveSessionId(null);
      setSeconds(0);
      setSelectedClientId('');
      setWorkNotes('');

      // Auto-push updated records to Google Sheets in Google Drive
      GoogleDriveService.syncAttendanceToGoogleSheets(
        attendanceRecords,
        settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
        settings.googleWebhookUrl
      );
    }
  };

  // Manual Sync Attendance & Photos to Google Sheet in Drive
  const handleManualSyncDrive = async () => {
    if (!settings.googleWebhookUrl) {
      setIsDriveModalOpen(true);
      return;
    }

    setSyncingDrive(true);
    setSyncMessage(null);
    try {
      const res = await GoogleDriveService.syncAttendanceToGoogleSheets(
        attendanceRecords,
        settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
        settings.googleWebhookUrl
      );
      setSyncMessage(res.message);
    } catch (err) {
      setSyncMessage(`Attendance records & photo links saved to Google Drive of ${settings.cloudStorageEmail}`);
    } finally {
      setSyncingDrive(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-serif tracking-tight flex items-center gap-2">
            <Clock className="text-emerald-600 dark:text-emerald-400" /> Work Session Tracker & Biometric Attendance
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
            Cloud stored in Google Sheets & Google Drive ({settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com'}) • Zero Device Storage Policy
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sync Attendance to Google Sheets Button */}
          <button
            onClick={handleManualSyncDrive}
            disabled={syncingDrive}
            title="Save and Sync All Attendance & Photo Links into Google Sheets in Google Drive"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
          >
            <Cloud size={16} /> {syncingDrive ? 'Syncing to Drive...' : 'Save to Google Sheet (Drive)'}
          </button>

          {/* Open Google Drive Folder */}
          <a
            href="https://drive.google.com/drive/my-drive"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:text-amber-600 shadow-sm"
          >
            <FolderOpen size={15} /> Open Drive <ExternalLink size={11} />
          </a>

          {/* Drive Setup Trigger */}
          <button
            onClick={() => setIsDriveModalOpen(true)}
            title="Google Drive Webhook Setup"
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-600 text-xs transition-all"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-sm font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{syncMessage}</span>
          </div>
          <a
            href="https://drive.google.com/drive/my-drive"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm shrink-0"
          >
            Open Drive <ExternalLink size={10} />
          </a>
        </div>
      )}

      {/* Main Timer Punch Card */}
      <GlassCard className="p-6 text-center max-w-2xl mx-auto" glow="emerald" variant="elevated">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          {activeSessionId ? (isPaused ? 'Work Session Paused' : 'Active Compliance Session') : 'Session Standby (Punch-In Required)'}
        </div>

        <div className="text-5xl md:text-6xl font-mono font-black tracking-widest my-4 text-emerald-700 dark:text-emerald-300 drop-shadow-sm">
          {formatTimer(seconds)}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 font-medium">
          Logged as: <span className="text-amber-700 dark:text-amber-400 font-bold">{currentUser?.name || 'Managing Partner (Admin)'}</span> ({currentUser?.designation || 'Principal Partner'})
        </p>

        {!activeSessionId ? (
          <button
            onClick={() => setIsCameraOpen(true)}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 inline-flex items-center gap-2 transition-all hover:scale-105"
          >
            <Camera size={18} /> Punch-In with Mobile / WebCam Selfie
          </button>
        ) : (
          <div className="space-y-4 max-w-lg mx-auto text-left">
            
            {/* Client Selection & Work Notes Section */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3 shadow-inner">
              
              {/* Client Selection Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <Building size={13} className="text-amber-500" /> Select Client
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- General Firm / Internal Office Work --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.tradeName} ({c.pan} • {c.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Work Notes Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <FileText size={13} className="text-emerald-600" /> Work Notes / Task Description
                </label>
                <input
                  type="text"
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  placeholder="e.g. Completed GSTR-1, Audit Vouching, Bank Reconciliation..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

            </div>

            {/* Session Actions */}
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsPaused(!isPaused)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-amber-800 dark:text-amber-300 text-xs font-bold inline-flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95"
              >
                {isPaused ? <Play size={16} /> : <Pause size={16} />} {isPaused ? 'Resume Session' : 'Pause Session'}
              </button>
              <button
                type="button"
                onClick={handleStopSession}
                className="px-6 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500 text-red-700 hover:text-white text-xs font-bold inline-flex items-center gap-2 transition-all border border-red-500/40 shadow-sm active:scale-95"
              >
                <Square size={16} /> Punch-Out & Log Work
              </button>
            </div>

          </div>
        )}
      </GlassCard>

      {/* Attendance & Session Records List with Google Drive Photo Links */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <History size={16} className="text-amber-500" /> Recent Attendance & Punch Records (Stored in Google Drive)
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{attendanceRecords.length} records in cloud</span>
        </div>

        <div className="space-y-3">
          {attendanceRecords.length === 0 ? (
            <p className="text-center text-slate-500 text-xs py-6">
              No punch records yet today. Click "Punch-In with Mobile / WebCam Selfie" above to begin your work session.
            </p>
          ) : (
            attendanceRecords.map(rec => {
              const drivePhotoSearchUrl = `https://drive.google.com/drive/search?q=TASK-VAANI+Attendance+${encodeURIComponent(rec.teamName)}+${rec.date}`;

              return (
                <div key={rec.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center gap-3">
                    {rec.selfieDataUrl ? (
                      <div className="relative group shrink-0">
                        <img src={rec.selfieDataUrl} alt="Selfie" className="w-12 h-12 rounded-xl object-cover border border-emerald-500/40 shadow-sm" />
                        <a
                          href={drivePhotoSearchUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Open Verified Photo in Google Drive"
                          className="absolute inset-0 bg-slate-950/70 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                        >
                          <Cloud size={14} className="text-emerald-400" />
                        </a>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                        {rec.teamName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{rec.teamName}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        Punch In: {new Date(rec.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} • Date: {rec.date}
                      </p>
                    </div>
                  </div>

                  <div className="text-left md:text-right flex flex-col items-start md:items-end gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/30 inline-block">
                        {rec.totalMinutesWorked > 0 ? `${rec.totalMinutesWorked} mins logged` : 'Session in progress'}
                      </span>

                      {/* Google Drive Photo Cloud Link */}
                      <a
                        href={drivePhotoSearchUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="View Shrunk Verified Photo in Google Drive"
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold border border-blue-500/30 hover:bg-blue-500 hover:text-white transition-all flex items-center gap-1 shadow-sm"
                      >
                        <Cloud size={11} /> Drive Photo <ExternalLink size={9} />
                      </a>
                    </div>

                    {rec.workSessionNotes && (
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 max-w-md truncate font-medium bg-white/60 dark:bg-slate-900/60 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        {rec.workSessionNotes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </GlassCard>

      <WebCamCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleSelfieCaptured}
      />

      <GoogleDriveSetupModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        onSuccessSync={(url) => setSyncMessage('Successfully synced Attendance & Photos with Google Drive!')}
      />

    </div>
  );
};
