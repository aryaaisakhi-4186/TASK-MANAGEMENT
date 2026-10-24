import { Client, TaskItem, UserProfile, ExtraWorkItem, DocumentItem, AuditLog, SystemSettings, AttendanceRecord, AIMemoryItem, GuestLead } from '../types';
import { SEED_CLIENTS, SEED_TASKS, SEED_TEAM_MEMBERS, SEED_EXTRA_WORK, SEED_DOCUMENTS, SEED_AUDIT_LOGS, INITIAL_SYSTEM_SETTINGS } from '../data/seedData';

const KEYS = {
  CLIENTS: 'taskvaani_clients_v1',
  TASKS: 'taskvaani_tasks_v1',
  TEAM: 'taskvaani_team_v1',
  EXTRA_WORK: 'taskvaani_extra_work_v1',
  DOCUMENTS: 'taskvaani_documents_v1',
  AUDIT_LOGS: 'taskvaani_audit_logs_v1',
  ATTENDANCE: 'taskvaani_attendance_v1',
  SETTINGS: 'taskvaani_settings_v1',
  AUTH_SESSION: 'taskvaani_auth_session_v1',
  THEME: 'taskvaani_theme_v1',
  CLIENT_REMINDERS: 'taskvaani_client_reminders_v1',
  AI_LEARNED_MEMORY: 'taskvaani_ai_learned_memory_v1',
  GUEST_LEADS: 'taskvaani_guest_leads_v1',
};

// Safe JSON parser
function safeGet<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item) as T;
  } catch (err) {
    console.warn(`Error reading ${key} from localStorage, using fallback:`, err);
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key} to localStorage:`, err);
  }
}

function getActiveGuestPhone(): string | null {
  try {
    const raw = localStorage.getItem(KEYS.AUTH_SESSION);
    if (!raw) return null;
    const session = JSON.parse(raw) as UserProfile | null;
    if (session && session.role === 'GUEST' && session.phone) {
      return session.phone.replace(/[^0-9]/g, '');
    }
  } catch {}
  return null;
}

function getScopedKey(baseKey: string): { key: string; isGuestWorkspace: boolean } {
  const guestPhone = getActiveGuestPhone();
  if (guestPhone) {
    return { key: `${baseKey}_guest_${guestPhone}`, isGuestWorkspace: true };
  }
  return { key: baseKey, isGuestWorkspace: false };
}

export const StorageService = {
  // Clients (Isolated blank workspace for Guest Demo users, Seed/Master data for Admin/Team)
  getClients: (): Client[] => {
    const { key, isGuestWorkspace } = getScopedKey(KEYS.CLIENTS);
    return safeGet<Client[]>(key, isGuestWorkspace ? [] : SEED_CLIENTS);
  },
  saveClients: (clients: Client[]) => {
    const { key } = getScopedKey(KEYS.CLIENTS);
    safeSet(key, clients);
  },

  // Tasks (Isolated blank workspace for Guest Demo users, Seed/Master data for Admin/Team)
  getTasks: (): TaskItem[] => {
    const { key, isGuestWorkspace } = getScopedKey(KEYS.TASKS);
    return safeGet<TaskItem[]>(key, isGuestWorkspace ? [] : SEED_TASKS);
  },
  saveTasks: (tasks: TaskItem[]) => {
    const { key } = getScopedKey(KEYS.TASKS);
    safeSet(key, tasks);
  },

  // Team
  getTeam: (): UserProfile[] => safeGet<UserProfile[]>(KEYS.TEAM, SEED_TEAM_MEMBERS),
  saveTeam: (team: UserProfile[]) => safeSet(KEYS.TEAM, team),

  // Extra Work
  getExtraWork: (): ExtraWorkItem[] => {
    const { key, isGuestWorkspace } = getScopedKey(KEYS.EXTRA_WORK);
    return safeGet<ExtraWorkItem[]>(key, isGuestWorkspace ? [] : SEED_EXTRA_WORK);
  },
  saveExtraWork: (work: ExtraWorkItem[]) => {
    const { key } = getScopedKey(KEYS.EXTRA_WORK);
    safeSet(key, work);
  },

  // Documents
  getDocuments: (): DocumentItem[] => {
    const { key, isGuestWorkspace } = getScopedKey(KEYS.DOCUMENTS);
    return safeGet<DocumentItem[]>(key, isGuestWorkspace ? [] : SEED_DOCUMENTS);
  },
  saveDocuments: (docs: DocumentItem[]) => {
    const { key } = getScopedKey(KEYS.DOCUMENTS);
    safeSet(key, docs);
  },

  // Audit Logs
  getAuditLogs: (): AuditLog[] => safeGet<AuditLog[]>(KEYS.AUDIT_LOGS, SEED_AUDIT_LOGS),
  saveAuditLogs: (logs: AuditLog[]) => safeSet(KEYS.AUDIT_LOGS, logs),
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
    const current = StorageService.getAuditLogs();
    const newLog: AuditLog = {
      ...log,
      id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
    };
    const updated = [newLog, ...current].slice(0, 500); // keep last 500
    StorageService.saveAuditLogs(updated);
    return newLog;
  },

  // Attendance
  getAttendance: (): AttendanceRecord[] => safeGet<AttendanceRecord[]>(KEYS.ATTENDANCE, []),
  saveAttendance: (records: AttendanceRecord[]) => safeSet(KEYS.ATTENDANCE, records),

  // Client Reminders
  getClientReminders: (): any[] => safeGet<any[]>(KEYS.CLIENT_REMINDERS, []),
  saveClientReminders: (reminders: any[]) => safeSet(KEYS.CLIENT_REMINDERS, reminders),

  // Settings
  getSettings: (): SystemSettings => {
    const settings = safeGet<SystemSettings>(KEYS.SETTINGS, INITIAL_SYSTEM_SETTINGS);
    if (!settings.firmName || settings.firmName.includes('VAANI') || settings.firmName.includes('Vaani')) {
      settings.firmName = 'M/S. ARYA ASSOCIATES, ACCOUNTS & TAXATION';
      if (!settings.firmEmail || settings.firmEmail.includes('vaaniassociates')) {
        settings.firmEmail = 'arya.taskmanagement@gmail.com';
      }
      if (!settings.cloudStorageEmail || settings.cloudStorageEmail.includes('vaaniassociates')) {
        settings.cloudStorageEmail = 'arya.taskmanagement@gmail.com';
      }
      safeSet(KEYS.SETTINGS, settings);
    }
    if (!settings.selectedTaxYear || settings.selectedTaxYear.includes('AY') || settings.selectedTaxYear.includes('/')) {
      settings.selectedTaxYear = 'Tax Year 2026-27';
      safeSet(KEYS.SETTINGS, settings);
    }
    return settings;
  },
  saveSettings: (settings: SystemSettings) => safeSet(KEYS.SETTINGS, settings),

  // Auth Session
  getAuthSession: (): UserProfile | null => {
    const session = safeGet<UserProfile | null>(KEYS.AUTH_SESSION, null);
    if (session && session.role === 'ADMIN') {
      let changed = false;
      if (!session.name || session.name.includes('VAANI') || session.name.includes('Vaani') || session.name === 'Managing Partner (Admin)') {
        session.name = 'M/S. ARYA ASSOCIATES, ACCOUNTS & TAXATION (Admin)';
        changed = true;
      }
      if (!session.email || session.email.includes('vaaniassociates')) {
        session.email = 'arya.taskmanagement@gmail.com';
        changed = true;
      }
      if (!session.phone) {
        session.phone = '+91-8982147763';
        changed = true;
      }
      if (changed) {
        safeSet(KEYS.AUTH_SESSION, session);
      }
    }
    return session;
  },
  saveAuthSession: (user: UserProfile | null) => safeSet(KEYS.AUTH_SESSION, user),

  // Guest Leads & 15-Day Trial Records
  getGuestLeads: (): GuestLead[] => safeGet<GuestLead[]>(KEYS.GUEST_LEADS, []),
  saveGuestLeads: (leads: GuestLead[]) => safeSet(KEYS.GUEST_LEADS, leads),
  getGuestLeadByPhone: (phone: string): GuestLead | undefined => {
    const leads = StorageService.getGuestLeads();
    const clean = phone.replace(/[^0-9]/g, '');
    return leads.find(l => l.phone.replace(/[^0-9]/g, '') === clean);
  },
  addOrUpdateGuestLead: (leadData: Partial<GuestLead> & { phone: string; name: string }): GuestLead => {
    const leads = StorageService.getGuestLeads();
    const cleanPhone = leadData.phone.replace(/[^0-9]/g, '');
    const existingIndex = leads.findIndex(l => l.phone.replace(/[^0-9]/g, '') === cleanPhone);

    const now = new Date();
    const expiry = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days trial

    if (existingIndex >= 0) {
      const existing = leads[existingIndex];
      const updated: GuestLead = {
        ...existing,
        name: leadData.name.trim() || existing.name,
        email: leadData.email || existing.email,
        firmName: leadData.firmName || existing.firmName,
        city: leadData.city || existing.city,
        notes: leadData.notes || existing.notes,
        isDemoSetup: leadData.isDemoSetup !== undefined ? leadData.isDemoSetup : existing.isDemoSetup,
        trialStatus: leadData.trialStatus || existing.trialStatus,
      };
      leads[existingIndex] = updated;
      StorageService.saveGuestLeads(leads);
      return updated;
    } else {
      const newLead: GuestLead = {
        id: 'lead-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        name: leadData.name.trim(),
        phone: cleanPhone,
        email: leadData.email || '',
        firmName: leadData.firmName || '',
        city: leadData.city || '',
        registeredAt: now.toISOString(),
        trialStartDate: now.toISOString(),
        trialEndDate: expiry.toISOString(),
        trialStatus: 'ACTIVE_DEMO',
        isDemoSetup: leadData.isDemoSetup || false,
        notes: leadData.notes || 'Registered via Home Page Guest Demo.'
      };
      leads.unshift(newLead);
      StorageService.saveGuestLeads(leads);
      return newLead;
    }
  },
  extendGuestTrial: (leadId: string, extraDays: number = 15): boolean => {
    const leads = StorageService.getGuestLeads();
    const index = leads.findIndex(l => l.id === leadId);
    if (index >= 0) {
      const currentExpiry = new Date(leads[index].trialEndDate);
      const baseDate = currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
      const newExpiry = new Date(baseDate.getTime() + extraDays * 24 * 60 * 60 * 1000);
      leads[index].trialEndDate = newExpiry.toISOString();
      leads[index].trialStatus = 'ACTIVE_DEMO';
      StorageService.saveGuestLeads(leads);
      return true;
    }
    return false;
  },


  // AI Learned Memory & Long-Term Knowledge
  getLearnedMemory: (): AIMemoryItem[] => safeGet<AIMemoryItem[]>(KEYS.AI_LEARNED_MEMORY, [
    {
      id: 'mem-1',
      category: 'GENERAL_NOTE',
      topic: 'Statutory Deadlines Priority',
      content: 'Statutory GST, TDS, and Tax Audit deadlines are given utmost priority with zero late filing penalty.',
      source: 'MANUAL',
      learnedAt: 'System Master'
    },
    {
      id: 'mem-2',
      category: 'PREFERENCE',
      topic: 'Tone & Communication',
      content: 'Always respond like a senior human CA partner with empathy, precision, and clear step-by-step guidance.',
      source: 'MANUAL',
      learnedAt: 'System Master'
    }
  ]),
  saveLearnedMemory: (memory: AIMemoryItem[]) => safeSet(KEYS.AI_LEARNED_MEMORY, memory),
  addLearnedMemoryItem: (item: Omit<AIMemoryItem, 'id' | 'learnedAt'>): AIMemoryItem => {
    const current = StorageService.getLearnedMemory();
    const newItem: AIMemoryItem = {
      ...item,
      id: 'mem-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      learnedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    };
    StorageService.saveLearnedMemory([newItem, ...current]);
    return newItem;
  },
  deleteLearnedMemoryItem: (id: string) => {
    const current = StorageService.getLearnedMemory();
    const updated = current.filter(m => m.id !== id);
    StorageService.saveLearnedMemory(updated);
  },
  clearLearnedMemory: () => {
    StorageService.saveLearnedMemory([]);
  },
  // Reset to initial seed data (App Reset)
  resetToDefaults: () => {
    safeSet(KEYS.CLIENTS, SEED_CLIENTS);
    safeSet(KEYS.TASKS, SEED_TASKS);
    safeSet(KEYS.TEAM, SEED_TEAM_MEMBERS);
    safeSet(KEYS.EXTRA_WORK, SEED_EXTRA_WORK);
    safeSet(KEYS.DOCUMENTS, SEED_DOCUMENTS);
    safeSet(KEYS.AUDIT_LOGS, SEED_AUDIT_LOGS);
    safeSet(KEYS.ATTENDANCE, []);
    safeSet(KEYS.CLIENT_REMINDERS, []);
    safeSet(KEYS.SETTINGS, INITIAL_SYSTEM_SETTINGS);
  },

  // Full clean factory wipeout (Full App Reset - 0 Data)
  fullCleanWipe: () => {
    safeSet(KEYS.CLIENTS, []);
    safeSet(KEYS.TASKS, []);
    safeSet(KEYS.TEAM, [SEED_TEAM_MEMBERS[0]]);
    safeSet(KEYS.EXTRA_WORK, []);
    safeSet(KEYS.DOCUMENTS, []);
    safeSet(KEYS.AUDIT_LOGS, []);
    safeSet(KEYS.ATTENDANCE, []);
    safeSet(KEYS.CLIENT_REMINDERS, []);
    safeSet(KEYS.SETTINGS, INITIAL_SYSTEM_SETTINGS);
    try {
      localStorage.removeItem('taskvaani_agentic_ai_chat_history');
    } catch {}
  }
};
