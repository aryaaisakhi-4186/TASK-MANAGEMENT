import { Client, TaskItem, UserProfile, ExtraWorkItem, DocumentItem, AttendanceRecord, SystemSettings, GuestLead } from '../types';
import { getSavedFirebaseConfig, saveFirebaseConfig, initFirebase, FirebaseCustomConfig } from '../firebase/config';
import { FirebaseService } from './firebaseService';

export interface OnlineDatabaseSnapshot {
  clients: Client[];
  tasks: TaskItem[];
  team: UserProfile[];
  extraWork: ExtraWorkItem[];
  documents: DocumentItem[];
  attendanceRecords: AttendanceRecord[];
  settings: SystemSettings;
  guestLeads?: GuestLead[];
  firebaseConfig?: FirebaseCustomConfig | null;
  updatedAt?: string;
  updatedAtIST?: string;
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null;

export const OnlineDataService = {
  // 1. Fetch Live Online Database on Startup (Works on both GitHub Pages & Local Network)
  pullLiveOnlineData: async (): Promise<Partial<OnlineDatabaseSnapshot> | null> => {
    let snapshot: Partial<OnlineDatabaseSnapshot> | null = null;

    // A. Try live server endpoint first (/api/online-db), then fallback to published ./online-db.json
    try {
      const apiRes = await fetch(`/api/online-db?t=${Date.now()}`, { cache: 'no-store' });
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json && !json.empty && Array.isArray(json.clients)) {
          snapshot = json;
        }
      }
    } catch {}

    if (!snapshot) {
      try {
        const staticRes = await fetch(`./online-db.json?t=${Date.now()}`, { cache: 'no-store' });
        if (staticRes.ok) {
          const json = await staticRes.json();
          if (json && Array.isArray(json.clients)) {
            snapshot = json;
          }
        }
      } catch {}
    }

    // B. If snapshot includes Firebase credentials, auto-configure Firebase on this device!
    if (snapshot?.firebaseConfig && snapshot.firebaseConfig.projectId && snapshot.firebaseConfig.apiKey) {
      const existingCfg = getSavedFirebaseConfig();
      if (!existingCfg) {
        saveFirebaseConfig(snapshot.firebaseConfig);
        initFirebase(snapshot.firebaseConfig);
      }
    }

    // C. If Firebase Cloud is configured, pull real-time cloud records (highest priority)
    if (FirebaseService.isConfigured()) {
      try {
        const cloudData = await FirebaseService.pullAllFromCloud();
        if (cloudData.clients.length > 0 || cloudData.tasks.length > 0) {
          return {
            clients: cloudData.clients.length > 0 ? cloudData.clients : snapshot?.clients,
            tasks: cloudData.tasks.length > 0 ? cloudData.tasks : snapshot?.tasks,
            team: cloudData.team.length > 0 ? cloudData.team : snapshot?.team,
            extraWork: cloudData.extraWork.length > 0 ? cloudData.extraWork : snapshot?.extraWork,
            documents: cloudData.documents.length > 0 ? cloudData.documents : snapshot?.documents,
            attendanceRecords: cloudData.attendanceRecords.length > 0 ? cloudData.attendanceRecords : snapshot?.attendanceRecords,
            guestLeads: cloudData.guestLeads.length > 0 ? cloudData.guestLeads : snapshot?.guestLeads,
            settings: cloudData.settings || snapshot?.settings
          };
        }
      } catch (cloudErr) {
        console.warn('Firebase live pull fallback to online-db.json:', cloudErr);
      }
    }

    return snapshot;
  },

  // 2. Auto-Push Live Changes to Online DB (Debounced so UI stays super fast)
  scheduleAutoOnlineSync: (data: OnlineDatabaseSnapshot) => {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }

    syncTimeout = setTimeout(async () => {
      const payload: OnlineDatabaseSnapshot = {
        ...data,
        firebaseConfig: getSavedFirebaseConfig(),
        updatedAt: new Date().toISOString(),
        updatedAtIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      };

      // A. Save to live server online-db.json if connected to Admin server
      try {
        await fetch('/api/online-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch {}
    }, 500);
  }
};
