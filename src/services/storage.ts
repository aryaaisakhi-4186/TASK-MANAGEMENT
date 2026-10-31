import { Client, TaskItem, UserProfile, ExtraWorkItem, DocumentItem, AuditLog, SystemSettings, AttendanceRecord, AIMemoryItem, GuestLead } from '../types';
import { SEED_CLIENTS, SEED_TASKS, SEED_TEAM_MEMBERS, SEED_EXTRA_WORK, SEED_DOCUMENTS, SEED_AUDIT_LOGS, INITIAL_SYSTEM_SETTINGS } from '../data/seedData';
import { resolveClientApplicability } from '../utils/complianceApplicability';

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
  ADMIN_PASSWORD: 'taskvaani_admin_master_password_v1',
  DELETED_TEAM_IDS: 'taskvaani_deleted_team_ids_v1',
  DELETED_CLIENT_IDS: 'taskvaani_deleted_client_ids_v1',
  DELETED_TASK_IDS: 'taskvaani_deleted_task_ids_v1',
  LAST_LOCAL_MODIFIED: 'taskvaani_last_local_modified_v1',
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

const normalizeTaskKey = (s?: string) => (s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Deduplicate compliance tasks across clients and periods.
 * Preserves completed ('DONE') or 'IN_PROGRESS' tasks over 'PENDING' duplicates.
 * Links tasks to actual client.id if matching by client name.
 */
export const deduplicateTasks = (taskList: TaskItem[], currentClients?: Client[]): TaskItem[] => {
  if (!Array.isArray(taskList)) return [];

  const nameToIdMap = new Map<string, string>();
  if (Array.isArray(currentClients)) {
    for (const c of currentClients) {
      if (c.tradeName) nameToIdMap.set(normalizeTaskKey(c.tradeName), c.id);
      if (c.legalName) nameToIdMap.set(normalizeTaskKey(c.legalName), c.id);
    }
  }

  const uniqueMap = new Map<string, TaskItem>();

  for (const t of taskList) {
    if (!t || !t.title) continue;

    const normClientName = normalizeTaskKey(t.clientName);
    const normTitle = normalizeTaskKey(t.title);
    const normCategory = normalizeTaskKey(t.category);
    const normDate = normalizeTaskKey(t.dueDate || t.dueDayOrDate || t.financialYear);

    // Harmonize client ID if client name matches a registered client
    let targetClientId = t.clientId;
    if (normClientName && nameToIdMap.has(normClientName)) {
      targetClientId = nameToIdMap.get(normClientName)!;
    }

    const clientKey = normClientName || normalizeTaskKey(targetClientId);
    
    // For standard recurring monthly tasks, ensure strictly one active task per client
    const isMonthly = t.frequency === 'MONTHLY' || normTitle.includes('monthly') || normTitle.includes('gstr') || normTitle.includes('challan 281');
    const dateKey = isMonthly ? '' : `::${normDate}`;
    const compositeKey = `${clientKey}::${normCategory}::${normTitle}${dateKey}`;

    const taskWithHarmonizedId: TaskItem = targetClientId && targetClientId !== t.clientId
      ? { ...t, clientId: targetClientId }
      : t;

    if (!uniqueMap.has(compositeKey)) {
      uniqueMap.set(compositeKey, taskWithHarmonizedId);
    } else {
      const existing = uniqueMap.get(compositeKey)!;
      // Prefer task with progress (DONE > IN_PROGRESS > PENDING)
      if (taskWithHarmonizedId.status === 'DONE' && existing.status !== 'DONE') {
        uniqueMap.set(compositeKey, taskWithHarmonizedId);
      } else if (taskWithHarmonizedId.status === 'IN_PROGRESS' && existing.status === 'PENDING') {
        uniqueMap.set(compositeKey, taskWithHarmonizedId);
      }
    }
  }

  return Array.from(uniqueMap.values());
};

/**
 * Deduplicate clients list strictly by ID, PAN, GSTIN, and Trade/Legal Name.
 * If duplicates exist, merges them together and ensures zero duplicate entries.
 */
export const deduplicateClients = (clients: Client[]): Client[] => {
  if (!Array.isArray(clients) || clients.length <= 1) return clients || [];

  const uniqueClients: Client[] = [];

  for (const c of clients) {
    if (!c) continue;
    const normId = (c.id || '').trim();
    const normPan = (c.pan || '').trim().toUpperCase();
    const normGst = (c.gstin || '').trim().toUpperCase();
    const normName = (c.tradeName || '').trim().toLowerCase();
    const normLegalName = (c.legalName || '').trim().toLowerCase();

    // Check if client already exists in uniqueClients
    const existingIdx = uniqueClients.findIndex(u => {
      // 1. Exact ID match
      if (normId && u.id && u.id === normId) return true;
      // 2. Real PAN match (ignore PAN-PENDING)
      if (normPan && normPan !== 'PAN-PENDING' && (u.pan || '').trim().toUpperCase() === normPan) return true;
      // 3. GSTIN match
      if (normGst && (u.gstin || '').trim().toUpperCase() === normGst) return true;
      // 4. Trade Name match
      if (normName && (u.tradeName || '').trim().toLowerCase() === normName) return true;
      // 5. Cross trade/legal name match
      if (normLegalName && (u.legalName || '').trim().toLowerCase() === normLegalName) return true;
      if (normName && (u.legalName || '').trim().toLowerCase() === normName) return true;
      if (normLegalName && (u.tradeName || '').trim().toLowerCase() === normLegalName) return true;
      return false;
    });

    if (existingIdx === -1) {
      uniqueClients.push(c);
    } else {
      const u = uniqueClients[existingIdx];
      const resolvedPan = (c.pan && c.pan !== 'PAN-PENDING')
        ? c.pan
        : (u.pan && u.pan !== 'PAN-PENDING' ? u.pan : (c.pan || u.pan || 'PAN-PENDING'));
      const resolvedGst = c.gstin || u.gstin || undefined;
      const resolvedTan = c.tan || u.tan || undefined;
      const resolvedVat = (c.vatNumber && c.vatNumber.trim().length >= 4)
        ? c.vatNumber.trim()
        : (u.vatNumber && u.vatNumber.trim().length >= 4 ? u.vatNumber.trim() : undefined);

      const baseApp = resolveClientApplicability(u);
      const newApp = c.complianceApplicability ? resolveClientApplicability(c) : baseApp;

      uniqueClients[existingIdx] = {
        ...u,
        ...c,
        id: u.id || c.id,
        serialNumber: u.serialNumber || c.serialNumber,
        createdAt: u.createdAt || c.createdAt,
        tradeName: c.tradeName || u.tradeName,
        legalName: c.legalName || u.legalName || c.tradeName || u.tradeName,
        pan: resolvedPan,
        gstin: resolvedGst,
        tan: resolvedTan,
        vatNumber: resolvedVat,
        category: (c.category && c.category !== 'PVT_LTD') ? c.category : (u.category || c.category),
        phone: c.phone || u.phone,
        email: c.email || u.email,
        contactPerson: c.contactPerson || u.contactPerson,
        employeeName: c.employeeName || u.employeeName,
        employeePhone: c.employeePhone || u.employeePhone,
        dob: c.dob || u.dob,
        formationDate: c.formationDate || u.formationDate,
        aadharNumber: c.aadharNumber || u.aadharNumber,
        assignedTeamId: c.assignedTeamId || u.assignedTeamId,
        assignedTeamName: c.assignedTeamName || u.assignedTeamName,
        googleDriveFolderId: c.googleDriveFolderId || u.googleDriveFolderId,
        googleDriveFolderUrl: c.googleDriveFolderUrl || u.googleDriveFolderUrl,
        repositoryDocs: (c.repositoryDocs && c.repositoryDocs.length > 0) ? c.repositoryDocs : u.repositoryDocs,
        customFields: (c.customFields && c.customFields.length > 0) ? c.customFields : u.customFields,
        complianceApplicability: {
          ...baseApp,
          ...newApp,
          GST: !!(resolvedGst && resolvedGst.length === 15),
          VAT: !!(resolvedVat && resolvedVat.length >= 4),
          TDS: !!(resolvedTan && resolvedTan.length === 10) || baseApp.TDS || newApp.TDS
        }
      };
    }
  }

  return uniqueClients;
};

/**
 * Merge two client lists safely without dropping any clients.
 * Updates matching clients (by ID, PAN, GSTIN, or Trade/Legal Name) and appends non-existing ones.
 */
export const mergeClients = (localClients: Client[], incomingClients: Client[]): Client[] => {
  if (!Array.isArray(incomingClients) || incomingClients.length === 0) return deduplicateClients(localClients || []);
  if (!Array.isArray(localClients) || localClients.length === 0) return deduplicateClients(incomingClients || []);

  const cleanLocal = deduplicateClients(localClients);
  const cleanIncoming = deduplicateClients(incomingClients);
  const mergedList: Client[] = [...cleanLocal];

  for (const inc of cleanIncoming) {
    if (!inc || !inc.tradeName) continue;
    const normId = (inc.id || '').trim();
    const normPan = (inc.pan || '').trim().toUpperCase();
    const normGst = (inc.gstin || '').trim().toUpperCase();
    const normName = (inc.tradeName || '').trim().toLowerCase();
    const normLegalName = (inc.legalName || '').trim().toLowerCase();

    const existingIdx = mergedList.findIndex(c => {
      // 1. Match by ID first
      if (normId && c.id && c.id === normId) return true;
      // 2. Match by valid PAN
      if (normPan && normPan !== 'PAN-PENDING' && (c.pan || '').trim().toUpperCase() === normPan) return true;
      // 3. Match by GSTIN
      if (normGst && (c.gstin || '').trim().toUpperCase() === normGst) return true;
      // 4. Match by Trade Name
      if (normName && (c.tradeName || '').trim().toLowerCase() === normName) return true;
      // 5. Match by Legal Name or Cross Match
      if (normLegalName && (c.legalName || '').trim().toLowerCase() === normLegalName) return true;
      if (normName && (c.legalName || '').trim().toLowerCase() === normName) return true;
      if (normLegalName && (c.tradeName || '').trim().toLowerCase() === normLegalName) return true;
      return false;
    });

    if (existingIdx !== -1) {
      const existing = mergedList[existingIdx];
      // Keep local changes as primary, enrich with any missing fields from incoming
      const resolvedPan = (existing.pan && existing.pan !== 'PAN-PENDING') 
        ? existing.pan 
        : (inc.pan && inc.pan !== 'PAN-PENDING' ? inc.pan : (existing.pan || inc.pan || 'PAN-PENDING'));
      const resolvedGst = existing.gstin || inc.gstin || undefined;
      const resolvedTan = existing.tan || inc.tan || undefined;
      const resolvedVat = (existing.vatNumber && existing.vatNumber.trim().length >= 4)
        ? existing.vatNumber.trim()
        : ((inc.vatNumber && inc.vatNumber.trim().length >= 4) ? inc.vatNumber.trim() : undefined);

      const baseApp = resolveClientApplicability(existing);
      const incApp = inc.complianceApplicability ? resolveClientApplicability(inc) : baseApp;

      mergedList[existingIdx] = {
        ...inc,
        ...existing,
        serialNumber: existing.serialNumber || inc.serialNumber,
        tradeName: existing.tradeName || inc.tradeName,
        legalName: existing.legalName || existing.tradeName || inc.legalName || inc.tradeName,
        pan: resolvedPan,
        gstin: resolvedGst,
        tan: resolvedTan,
        vatNumber: resolvedVat,
        phone: existing.phone || inc.phone,
        email: existing.email || inc.email,
        contactPerson: existing.contactPerson || inc.contactPerson,
        employeeName: existing.employeeName || inc.employeeName,
        employeePhone: existing.employeePhone || inc.employeePhone,
        dob: existing.dob || inc.dob,
        formationDate: existing.formationDate || inc.formationDate,
        aadharNumber: existing.aadharNumber || inc.aadharNumber,
        assignedTeamName: existing.assignedTeamName || inc.assignedTeamName,
        googleDriveFolderId: existing.googleDriveFolderId || inc.googleDriveFolderId,
        googleDriveFolderUrl: existing.googleDriveFolderUrl || inc.googleDriveFolderUrl,
        complianceApplicability: {
          ...incApp,
          ...baseApp,
          VAT: !!(resolvedVat && resolvedVat.length >= 4),
          GST: !!(resolvedGst && resolvedGst.length === 15),
          TDS: !!(resolvedTan && resolvedTan.length === 10) || baseApp.TDS || incApp.TDS
        }
      };
    } else {
      mergedList.push(inc);
    }
  }

  return deduplicateClients(mergedList);
};

/**
 * Ensures clients have consistent sequential S.No. (1, 2, 3...)
 * Preserves already assigned serial numbers and gives next sequential numbers to any new ones without disturbing previous ones.
 */
export const normalizeClientSerialNumbers = (clients: Client[]): Client[] => {
  if (!Array.isArray(clients) || clients.length === 0) return [];

  // Track max assigned serial number
  let maxSNo = 0;
  clients.forEach(c => {
    if (typeof c.serialNumber === 'number' && c.serialNumber > maxSNo) {
      maxSNo = c.serialNumber;
    }
  });

  let counter = maxSNo;
  return clients.map((c, idx) => {
    if (typeof c.serialNumber === 'number' && c.serialNumber > 0) {
      return c;
    }
    const assigned = idx + 1;
    if (assigned > counter) counter = assigned;
    return {
      ...c,
      serialNumber: assigned
    };
  });
};

export const StorageService = {
  // Local Modification & Tombstone tracking
  markLocalChange: () => {
    try {
      localStorage.setItem(KEYS.LAST_LOCAL_MODIFIED, new Date().toISOString());
    } catch {}
  },
  getLastLocalModified: (): string => {
    return safeGet<string>(KEYS.LAST_LOCAL_MODIFIED, '');
  },

  getDeletedTeamIds: (): string[] => safeGet<string[]>(KEYS.DELETED_TEAM_IDS, []),
  recordDeletedTeamId: (id: string) => {
    const list = safeGet<string[]>(KEYS.DELETED_TEAM_IDS, []);
    if (!list.includes(id)) {
      list.push(id);
      safeSet(KEYS.DELETED_TEAM_IDS, list);
    }
    StorageService.markLocalChange();
  },
  unmarkDeletedTeamId: (id: string) => {
    const list = safeGet<string[]>(KEYS.DELETED_TEAM_IDS, []);
    safeSet(KEYS.DELETED_TEAM_IDS, list.filter(i => i !== id));
    StorageService.markLocalChange();
  },

  getDeletedClientIds: (): string[] => safeGet<string[]>(KEYS.DELETED_CLIENT_IDS, []),
  recordDeletedClientId: (id: string) => {
    const list = safeGet<string[]>(KEYS.DELETED_CLIENT_IDS, []);
    if (!list.includes(id)) {
      list.push(id);
      safeSet(KEYS.DELETED_CLIENT_IDS, list);
    }
    StorageService.markLocalChange();
  },
  unmarkDeletedClientId: (id: string) => {
    const list = safeGet<string[]>(KEYS.DELETED_CLIENT_IDS, []);
    safeSet(KEYS.DELETED_CLIENT_IDS, list.filter(i => i !== id));
    StorageService.markLocalChange();
  },

  getDeletedTaskIds: (): string[] => safeGet<string[]>(KEYS.DELETED_TASK_IDS, []),
  recordDeletedTaskId: (id: string) => {
    const list = safeGet<string[]>(KEYS.DELETED_TASK_IDS, []);
    if (!list.includes(id)) {
      list.push(id);
      safeSet(KEYS.DELETED_TASK_IDS, list);
    }
    StorageService.markLocalChange();
  },
  unmarkDeletedTaskId: (id: string) => {
    const list = safeGet<string[]>(KEYS.DELETED_TASK_IDS, []);
    safeSet(KEYS.DELETED_TASK_IDS, list.filter(i => i !== id));
    StorageService.markLocalChange();
  },

  // Clients (Defaults to 0 for Clean Production Practice Start, Always Deduplicated & Normalized S.No.)
  getClients: (): Client[] => {
    const { key } = getScopedKey(KEYS.CLIENTS);
    const deleted = new Set(StorageService.getDeletedClientIds());
    const raw = safeGet<Client[]>(key, []);
    const filtered = raw.filter(c => !deleted.has(c.id));
    return normalizeClientSerialNumbers(deduplicateClients(filtered));
  },
  saveClients: (clients: Client[]) => {
    const { key } = getScopedKey(KEYS.CLIENTS);
    const deleted = new Set(StorageService.getDeletedClientIds());
    const filtered = clients.filter(c => !deleted.has(c.id));
    safeSet(key, normalizeClientSerialNumbers(deduplicateClients(filtered)));
    StorageService.markLocalChange();
  },

  // Tasks (Defaults to 0 for Clean Production Practice Start, Always Deduplicated)
  getTasks: (): TaskItem[] => {
    const { key } = getScopedKey(KEYS.TASKS);
    const deleted = new Set(StorageService.getDeletedTaskIds());
    const raw = safeGet<TaskItem[]>(key, []);
    const filtered = raw.filter(t => !deleted.has(t.id));
    return deduplicateTasks(filtered);
  },
  saveTasks: (tasks: TaskItem[]) => {
    const { key } = getScopedKey(KEYS.TASKS);
    const deleted = new Set(StorageService.getDeletedTaskIds());
    const filtered = tasks.filter(t => !deleted.has(t.id));
    safeSet(key, deduplicateTasks(filtered));
    StorageService.markLocalChange();
  },

  // Team (Defaults to Partner Ravi Katara)
  getTeam: (): UserProfile[] => {
    const deleted = new Set(StorageService.getDeletedTeamIds());
    const raw = safeGet<UserProfile[]>(KEYS.TEAM, [
      {
        id: 'team-1',
        name: 'RAVI KATARA',
        role: 'ADMIN',
        email: 'arya4186@gmail.com',
        phone: '+91 8982147763',
        pin: '1517',
        designation: 'Head of Department / Senior Partner',
        assignedClientIds: []
      }
    ]);
    return raw.filter(m => !deleted.has(m.id));
  },
  saveTeam: (team: UserProfile[]) => {
    const deleted = new Set(StorageService.getDeletedTeamIds());
    const filtered = team.filter(m => !deleted.has(m.id));
    safeSet(KEYS.TEAM, filtered);
    StorageService.markLocalChange();
  },

  // Extra Work (Defaults to 0)
  getExtraWork: (): ExtraWorkItem[] => {
    const { key } = getScopedKey(KEYS.EXTRA_WORK);
    return safeGet<ExtraWorkItem[]>(key, []);
  },
  saveExtraWork: (work: ExtraWorkItem[]) => {
    const { key } = getScopedKey(KEYS.EXTRA_WORK);
    safeSet(key, work);
  },

  // Documents (Defaults to 0)
  getDocuments: (): DocumentItem[] => {
    const { key } = getScopedKey(KEYS.DOCUMENTS);
    return safeGet<DocumentItem[]>(key, []);
  },
  saveDocuments: (docs: DocumentItem[]) => {
    const { key } = getScopedKey(KEYS.DOCUMENTS);
    safeSet(key, docs);
  },

  // Audit Logs (Defaults to 0)
  getAuditLogs: (): AuditLog[] => safeGet<AuditLog[]>(KEYS.AUDIT_LOGS, []),
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
  getAdminPassword: (): string => {
    try {
      const raw = localStorage.getItem(KEYS.ADMIN_PASSWORD);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
        } catch {
          if (raw.trim()) return raw.trim();
        }
      }
    } catch {}
    const settings = safeGet<SystemSettings>(KEYS.SETTINGS, INITIAL_SYSTEM_SETTINGS);
    return settings.adminPasswordHash || 'admin123';
  },
  saveAdminPassword: (password: string): void => {
    const clean = password.trim() || 'admin123';
    try {
      localStorage.setItem(KEYS.ADMIN_PASSWORD, JSON.stringify(clean));
    } catch {}
    const settings = safeGet<SystemSettings>(KEYS.SETTINGS, INITIAL_SYSTEM_SETTINGS);
    settings.adminPasswordHash = clean;
    safeSet(KEYS.SETTINGS, settings);
  },
  getSettings: (): SystemSettings => {
    const settings = safeGet<SystemSettings>(KEYS.SETTINGS, INITIAL_SYSTEM_SETTINGS);
    const customPassword = StorageService.getAdminPassword();
    if (customPassword) {
      settings.adminPasswordHash = customPassword;
    }
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
  saveSettings: (settings: SystemSettings) => {
    if (settings.adminPasswordHash) {
      safeSet(KEYS.ADMIN_PASSWORD, settings.adminPasswordHash);
    }
    safeSet(KEYS.SETTINGS, settings);
  },

  // Auth Session
  getAuthSession: (): UserProfile | null => {
    const session = safeGet<UserProfile | null>(KEYS.AUTH_SESSION, null);
    if (session && session.role === 'ADMIN') {
      let changed = false;
      const settings = safeGet<SystemSettings>(KEYS.SETTINGS, INITIAL_SYSTEM_SETTINGS);
      const team = safeGet<UserProfile[]>(KEYS.TEAM, []);
      const memberName = settings.adminName || (team.length > 0 ? team[0].name : 'RAVI KATARA');
      const memberPost = settings.adminDesignation || (team.length > 0 ? team[0].designation : 'Senior Partner (Tax & Audit)');

      // If session name was incorrectly set to firm name or placeholder, set to member name & post
      if (!session.name || session.name.includes('VAANI') || session.name.includes('Vaani') || session.name.includes('ARYA ASSOCIATES') || session.name === 'Managing Partner (Admin)') {
        session.name = memberName;
        session.designation = memberPost;
        changed = true;
      }
      if (!session.designation) {
        session.designation = memberPost;
        changed = true;
      }
      if (!session.email || session.email.includes('vaaniassociates')) {
        session.email = settings.firmEmail || 'arya.taskmanagement@gmail.com';
        changed = true;
      }
      if (!session.phone) {
        session.phone = settings.firmPhone || '+91-8815052555';
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
        remark: leadData.remark !== undefined ? leadData.remark : existing.remark,
        approvalStatus: leadData.approvalStatus || existing.approvalStatus || 'ACCEPTED',
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
        approvalStatus: 'ACCEPTED',
        remark: '',
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
  updateGuestLeadApproval: (leadId: string, status: 'ACCEPTED' | 'REJECTED' | 'PENDING', remark?: string): boolean => {
    const leads = StorageService.getGuestLeads();
    const index = leads.findIndex(l => l.id === leadId);
    if (index >= 0) {
      leads[index].approvalStatus = status;
      if (remark !== undefined) {
        leads[index].remark = remark;
      }
      StorageService.saveGuestLeads(leads);
      return true;
    }
    return false;
  },
  updateGuestLeadRemark: (leadId: string, remark: string): boolean => {
    const leads = StorageService.getGuestLeads();
    const index = leads.findIndex(l => l.id === leadId);
    if (index >= 0) {
      leads[index].remark = remark;
      StorageService.saveGuestLeads(leads);
      return true;
    }
    return false;
  },
  deleteGuestLead: (leadId: string): boolean => {
    const leads = StorageService.getGuestLeads();
    const filtered = leads.filter(l => l.id !== leadId);
    if (filtered.length !== leads.length) {
      StorageService.saveGuestLeads(filtered);
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
    safeSet(KEYS.EXTRA_WORK, []);
    safeSet(KEYS.DOCUMENTS, []);
    safeSet(KEYS.AUDIT_LOGS, []);
    safeSet(KEYS.ATTENDANCE, []);
    safeSet(KEYS.CLIENT_REMINDERS, []);
    
    // PRESERVE active Team member (Partner Ravi Katara)
    const currentTeam = StorageService.getTeam();
    safeSet(KEYS.TEAM, currentTeam.length > 0 ? currentTeam : [
      {
        id: 'team-1',
        name: 'RAVI KATARA',
        role: 'TEAM',
        email: 'arya4186@gmail.com',
        phone: '+91-8815052555',
        pin: '1517',
        designation: 'Senior Partner (Tax & Audit)',
        assignedClientIds: []
      }
    ]);

    // STRICTLY PRESERVE firm settings & custom admin password!
    const currentSettings = StorageService.getSettings();
    const currentAdminPass = StorageService.getAdminPassword();
    currentSettings.adminPasswordHash = currentAdminPass;
    safeSet(KEYS.SETTINGS, currentSettings);
    try {
      localStorage.setItem(KEYS.ADMIN_PASSWORD, JSON.stringify(currentAdminPass));
    } catch {}

    try {
      localStorage.removeItem('taskvaani_agentic_ai_chat_history');
    } catch {}
  }
};
