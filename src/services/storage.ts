import { Client, TaskItem, UserProfile, ExtraWorkItem, DocumentItem, AuditLog, SystemSettings, AttendanceRecord, AIMemoryItem } from '../types';
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

export const StorageService = {
  // Clients
  getClients: (): Client[] => safeGet<Client[]>(KEYS.CLIENTS, SEED_CLIENTS),
  saveClients: (clients: Client[]) => safeSet(KEYS.CLIENTS, clients),

  // Tasks
  getTasks: (): TaskItem[] => safeGet<TaskItem[]>(KEYS.TASKS, SEED_TASKS),
  saveTasks: (tasks: TaskItem[]) => safeSet(KEYS.TASKS, tasks),

  // Team
  getTeam: (): UserProfile[] => safeGet<UserProfile[]>(KEYS.TEAM, SEED_TEAM_MEMBERS),
  saveTeam: (team: UserProfile[]) => safeSet(KEYS.TEAM, team),

  // Extra Work
  getExtraWork: (): ExtraWorkItem[] => safeGet<ExtraWorkItem[]>(KEYS.EXTRA_WORK, SEED_EXTRA_WORK),
  saveExtraWork: (work: ExtraWorkItem[]) => safeSet(KEYS.EXTRA_WORK, work),

  // Documents
  getDocuments: (): DocumentItem[] => safeGet<DocumentItem[]>(KEYS.DOCUMENTS, SEED_DOCUMENTS),
  saveDocuments: (docs: DocumentItem[]) => safeSet(KEYS.DOCUMENTS, docs),

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
  getSettings: (): SystemSettings => safeGet<SystemSettings>(KEYS.SETTINGS, INITIAL_SYSTEM_SETTINGS),
  saveSettings: (settings: SystemSettings) => safeSet(KEYS.SETTINGS, settings),

  // Auth Session
  getAuthSession: (): UserProfile | null => safeGet<UserProfile | null>(KEYS.AUTH_SESSION, null),
  saveAuthSession: (user: UserProfile | null) => safeSet(KEYS.AUTH_SESSION, user),


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
