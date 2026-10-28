import React, { createContext, useContext, useState, useEffect } from 'react';
import { Client, TaskItem, UserProfile, ExtraWorkItem, DocumentItem, AuditLog, SystemSettings, AttendanceRecord, TaskStatus, ClientReminder } from '../types';
import { StorageService, deduplicateTasks, mergeClients, deduplicateClients } from '../services/storage';
import { FirebaseService } from '../services/firebaseService';
import { OnlineDataService } from '../services/onlineDataService';
import { AudioService } from '../services/audioService';
import { GoogleDriveService } from '../services/googleDriveService';
import { detectEntityCategoryFromPANAndGSTIN, ParsedClientRow } from '../utils/masterImportExport';
import { resolveClientApplicability } from '../utils/complianceApplicability';
import { useAuth } from './AuthContext';
import { SEED_CLIENTS, SEED_TASKS, SEED_EXTRA_WORK, SEED_DOCUMENTS } from '../data/seedData';

interface TaskContextType {
  clients: Client[];
  tasks: TaskItem[];
  team: UserProfile[];
  extraWork: ExtraWorkItem[];
  documents: DocumentItem[];
  auditLogs: AuditLog[];
  attendanceRecords: AttendanceRecord[];
  clientReminders: ClientReminder[];
  settings: SystemSettings;

  // Client actions
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Client;
  bulkImportClients: (rows: ParsedClientRow[]) => { createdCount: number; updatedCount: number; totalCount: number };
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Task actions
  addTask: (task: Omit<TaskItem, 'id'>) => TaskItem;
  updateTaskStatus: (taskId: string, status: TaskStatus, completedBy?: string) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  deleteTask: (id: string) => void;
  bulkUpdateTasks: (taskIds: string[], status: TaskStatus) => void;
  cleanDuplicateTasks: () => number;

  // Team actions
  addTeamMember: (member: Omit<UserProfile, 'id' | 'role'> & { role?: 'ADMIN' | 'TEAM' }) => UserProfile;
  updateTeamMember: (id: string, updates: Partial<UserProfile>) => void;
  deleteTeamMember: (id: string) => void;

  // Extra Work actions
  addExtraWork: (work: Omit<ExtraWorkItem, 'id' | 'createdDate'>) => ExtraWorkItem;
  updateExtraWork: (id: string, updates: Partial<ExtraWorkItem>) => void;
  deleteExtraWork: (id: string) => void;

  // Documents
  addDocument: (doc: Omit<DocumentItem, 'id' | 'uploadedAt'>) => DocumentItem;
  deleteDocument: (id: string) => void;

  // Attendance
  recordPunchIn: (teamId: string, teamName: string, selfieDataUrl?: string, locationStamp?: string, notes?: string, minutesWorked?: number) => AttendanceRecord;
  recordPunchOut: (recordId: string, minutesWorked: number, notes?: string) => void;

  // Reminders
  sendClientReminder: (reminder: Omit<ClientReminder, 'id' | 'sentDate' | 'status'>) => ClientReminder;
  resolveClientReminder: (id: string) => void;

  // Office Shift & Lunch Break
  officeStatus: 'LOGGED_OFF' | 'LOGGED_IN' | 'ON_LUNCH_BREAK';
  officeLoginTime: string | null;
  lunchStartTime: string | null;
  totalLunchMinutesToday: number;
  loginOffice: (teamId?: string, teamName?: string) => void;
  logoffOffice: (teamId?: string, teamName?: string) => void;
  startLunchBreak: (teamId?: string, teamName?: string) => void;
  endLunchBreak: (teamId?: string, teamName?: string) => void;

  // Settings
  updateSettings: (updates: Partial<SystemSettings>) => void;
  purgeAuditLogs: () => void;
  resetAllData: () => void;
  fullAppReset: () => void;
  resetToBlankForGuestDemo: () => void;
  loadSampleForGuestDemo: () => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

// Helper to ensure every client referenced in tasks exists in the master client directory without creating duplicates
export const syncMissingClientsFromTasks = (currentClients: Client[], currentTasks: TaskItem[]): Client[] => {
  const cleanClients = deduplicateClients(currentClients || []);
  const idMap = new Map<string, Client>();
  const nameMap = new Map<string, Client>();

  cleanClients.forEach(c => {
    if (c.id) idMap.set(c.id, c);
    if (c.tradeName) nameMap.set(c.tradeName.trim().toLowerCase(), c);
    if (c.legalName) nameMap.set(c.legalName.trim().toLowerCase(), c);
  });

  const added: Client[] = [];
  let tasksUpdated = false;

  currentTasks.forEach(t => {
    if (!t.clientName && !t.clientId) return;

    // 1. If task already matches an existing client by clientId:
    if (t.clientId && idMap.has(t.clientId)) {
      const matchedClient = idMap.get(t.clientId)!;
      // Sync the task's clientName to match the current client's tradeName if they drifted
      if (t.clientName !== matchedClient.tradeName) {
        t.clientName = matchedClient.tradeName;
        tasksUpdated = true;
      }
      return; // DO NOT CREATE A SYNTHETIC CLIENT
    }

    // 2. If task matches an existing client by clientName:
    const norm = (t.clientName || '').trim().toLowerCase();
    if (norm && nameMap.has(norm)) {
      const matchedClient = nameMap.get(norm)!;
      if (t.clientId !== matchedClient.id) {
        t.clientId = matchedClient.id;
        tasksUpdated = true;
      }
      return; // DO NOT CREATE A SYNTHETIC CLIENT
    }

    // 3. Only if NEITHER clientId nor clientName matches ANY client in master directory:
    if (norm) {
      const cat = detectEntityCategoryFromPANAndGSTIN('', '', t.clientName, t.clientName);
      const synthClient: Client = {
        id: t.clientId || ('cli-' + Date.now() + '-' + Math.floor(Math.random() * 10000)),
        tradeName: t.clientName,
        legalName: t.clientName,
        pan: 'PAN-PENDING',
        category: cat,
        status: 'ACTIVE',
        contactPerson: '',
        phone: '',
        email: '',
        assignedTeamId: t.assignedTeamId || '',
        assignedTeamName: t.assignedTeamName || 'Assigned Staff',
        portalPassword: 'client123',
        createdAt: new Date().toISOString().split('T')[0],
        complianceApplicability: {
          GST: true,
          TDS: true,
          ITR: true,
          AUDIT: cat === 'PVT_LTD' || cat === 'LLP',
          VAT: false,
          E_INVOICE: false,
          RCM: false,
          RULE_86B: false
        }
      };
      nameMap.set(norm, synthClient);
      if (synthClient.id) idMap.set(synthClient.id, synthClient);
      added.push(synthClient);
    }
  });

  if (tasksUpdated) {
    StorageService.saveTasks(currentTasks);
  }

  if (added.length > 0) {
    const all = deduplicateClients([...cleanClients, ...added]);
    StorageService.saveClients(all);
    return all;
  }
  return cleanClients;
};

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>(() => StorageService.getTasks());
  const [clients, setClients] = useState<Client[]>(() => {
    const rawClients = StorageService.getClients();
    const rawTasks = StorageService.getTasks();
    return syncMissingClientsFromTasks(rawClients, rawTasks);
  });
  const [team, setTeam] = useState<UserProfile[]>(() => StorageService.getTeam());
  const [extraWork, setExtraWork] = useState<ExtraWorkItem[]>(() => StorageService.getExtraWork());
  const [documents, setDocuments] = useState<DocumentItem[]>(() => StorageService.getDocuments());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => StorageService.getAuditLogs());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => StorageService.getAttendance());
  const [clientReminders, setClientReminders] = useState<ClientReminder[]>(() => StorageService.getClientReminders());
  const [settings, setSettings] = useState<SystemSettings>(() => StorageService.getSettings());

  // Reload isolated workspace whenever user session changes (Admin vs Guest Mobile Demo)
  useEffect(() => {
    setClients(StorageService.getClients());
    setTasks(StorageService.getTasks());
    setExtraWork(StorageService.getExtraWork());
    setDocuments(StorageService.getDocuments());
  }, [currentUser?.id, currentUser?.phone, currentUser?.role]);

  // Guard for 15-Day Guest Trial Expiry (Read/View allowed, Write blocked after 15 days)
  const checkGuestWriteAllowed = (): boolean => {
    if (currentUser?.role === 'GUEST' && currentUser?.trialInfo?.isExpired) {
      alert(
        '🔒 15-Days Free Demo Expired (Read-Only Mode)!\n\nAapka 15 din ka free demo poora ho chuka hai. Aap apne purane tasks aur records Read / View kar sakte hain.\n\nAage kaam jari rakhne ke liye Administration (+91-8982147763 / arya.taskmanagement@gmail.com) se sampark karein.'
      );
      return false;
    }
    return true;
  };

  // On Startup: Pull All Live Online Data (Server online-db.json + Firebase Cloud) & attach Real-Time Listeners
  useEffect(() => {
    const isGuestDemo = currentUser?.role === 'GUEST' && !!currentUser?.phone;
    if (isGuestDemo) return;

    let unsubscribers: Array<() => void> = [];

    OnlineDataService.pullLiveOnlineData().then(onlineData => {
      if (onlineData) {
        if (Array.isArray(onlineData.clients) && onlineData.clients.length > 0) {
          const currentLocal = StorageService.getClients();
          const merged = mergeClients(currentLocal, onlineData.clients);
          const complete = syncMissingClientsFromTasks(merged, onlineData.tasks || StorageService.getTasks());
          setClients(complete);
          StorageService.saveClients(complete);
        }
        if (Array.isArray(onlineData.tasks)) {
          const cleanTasks = deduplicateTasks(onlineData.tasks, onlineData.clients || StorageService.getClients());
          setTasks(cleanTasks);
          StorageService.saveTasks(cleanTasks);
        }
        if (Array.isArray(onlineData.team) && onlineData.team.length > 0) {
          setTeam(onlineData.team);
          StorageService.saveTeam(onlineData.team);
        }
        if (Array.isArray(onlineData.extraWork)) {
          setExtraWork(onlineData.extraWork);
          StorageService.saveExtraWork(onlineData.extraWork);
        }
        if (Array.isArray(onlineData.documents)) {
          setDocuments(onlineData.documents);
          StorageService.saveDocuments(onlineData.documents);
        }
        if (Array.isArray(onlineData.attendanceRecords)) {
          setAttendanceRecords(onlineData.attendanceRecords);
          StorageService.saveAttendance(onlineData.attendanceRecords);
        }
        if (Array.isArray(onlineData.guestLeads)) {
          StorageService.saveGuestLeads(onlineData.guestLeads);
        }
        if (onlineData.settings) {
          const currentSavedSettings = StorageService.getSettings();
          const savedAdminPass = StorageService.getAdminPassword();
          const cleanSettings = { ...onlineData.settings };

          // Never revert a user-customized password back to default 'admin123' from static snapshot
          if (savedAdminPass && savedAdminPass !== 'admin123') {
            cleanSettings.adminPasswordHash = savedAdminPass;
          } else if (currentSavedSettings.adminPasswordHash && currentSavedSettings.adminPasswordHash !== 'admin123') {
            cleanSettings.adminPasswordHash = currentSavedSettings.adminPasswordHash;
          }

          if (!cleanSettings.firmName || cleanSettings.firmName.includes('VAANI') || cleanSettings.firmName.includes('Vaani')) {
            cleanSettings.firmName = currentSavedSettings.firmName || 'M/S. ARYA ASSOCIATES, ACCOUNTS & TAXATION';
          }
          if (currentSavedSettings.adminName) {
            cleanSettings.adminName = currentSavedSettings.adminName;
          }
          if (currentSavedSettings.adminDesignation) {
            cleanSettings.adminDesignation = currentSavedSettings.adminDesignation;
          }
          if (currentSavedSettings.selectedTaxYear) {
            cleanSettings.selectedTaxYear = currentSavedSettings.selectedTaxYear;
          }
          setSettings(cleanSettings);
          StorageService.saveSettings(cleanSettings);
        }
      }

      // Attach Real-Time Live Server Listener (/api/online-db across tabs & office devices)
      unsubscribers.push(
        OnlineDataService.subscribeToLiveServerUpdates((liveSnap) => {
          if (Array.isArray(liveSnap.clients) && liveSnap.clients.length > 0) {
            setClients(prev => {
              const currentLocal = StorageService.getClients();
              const merged = mergeClients(currentLocal, liveSnap.clients || []);
              StorageService.saveClients(merged);
              return merged;
            });
          }
          if (Array.isArray(liveSnap.tasks)) {
            const clean = deduplicateTasks(liveSnap.tasks, liveSnap.clients || StorageService.getClients());
            setTasks(clean);
            StorageService.saveTasks(clean);
          }
          if (Array.isArray(liveSnap.team)) setTeam(liveSnap.team);
          if (Array.isArray(liveSnap.extraWork)) setExtraWork(liveSnap.extraWork);
          if (Array.isArray(liveSnap.documents)) setDocuments(liveSnap.documents);
          if (Array.isArray(liveSnap.attendanceRecords)) setAttendanceRecords(liveSnap.attendanceRecords);
          if (liveSnap.settings) {
            const currentSavedSettings = StorageService.getSettings();
            const savedAdminPass = StorageService.getAdminPassword();
            const cleanSettings = { ...liveSnap.settings };

            if (savedAdminPass && savedAdminPass !== 'admin123') {
              cleanSettings.adminPasswordHash = savedAdminPass;
            } else if (currentSavedSettings.adminPasswordHash && currentSavedSettings.adminPasswordHash !== 'admin123') {
              cleanSettings.adminPasswordHash = currentSavedSettings.adminPasswordHash;
            }

            if (!cleanSettings.firmName || cleanSettings.firmName.includes('VAANI') || cleanSettings.firmName.includes('Vaani')) {
              cleanSettings.firmName = currentSavedSettings.firmName || 'M/S. ARYA ASSOCIATES, ACCOUNTS & TAXATION';
            }
            if (currentSavedSettings.adminName) {
              cleanSettings.adminName = currentSavedSettings.adminName;
            }
            if (currentSavedSettings.adminDesignation) {
              cleanSettings.adminDesignation = currentSavedSettings.adminDesignation;
            }
            if (currentSavedSettings.selectedTaxYear) {
              cleanSettings.selectedTaxYear = currentSavedSettings.selectedTaxYear;
            }
            setSettings(cleanSettings);
          }
        })
      );

      // Attach Real-Time Firebase Listeners if Firebase is configured
      if (FirebaseService.isConfigured()) {
        unsubscribers.push(
          FirebaseService.subscribeToCollection<Client>('clients', (items) => {
            if (items.length > 0) {
              setClients(prev => {
                const currentLocal = StorageService.getClients();
                const merged = mergeClients(currentLocal, items);
                StorageService.saveClients(merged);
                return merged;
              });
            }
          }),
          FirebaseService.subscribeToCollection<TaskItem>('tasks', (items) => {
            if (items.length > 0) {
              const clean = deduplicateTasks(items, StorageService.getClients());
              setTasks(clean);
              StorageService.saveTasks(clean);
            }
          }),
          FirebaseService.subscribeToCollection<UserProfile>('team', (items) => {
            if (items.length > 0) setTeam(items);
          }),
          FirebaseService.subscribeToCollection<ExtraWorkItem>('extraWork', (items) => {
            if (items.length > 0) setExtraWork(items);
          }),
          FirebaseService.subscribeToCollection<DocumentItem>('documents', (items) => {
            if (items.length > 0) setDocuments(items);
          }),
          FirebaseService.subscribeToCollection<AttendanceRecord>('attendance', (items) => {
            if (items.length > 0) setAttendanceRecords(items);
          })
        );
      }
    }).catch(err => {
      console.warn('Initial online data sync check:', err);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [currentUser?.role, currentUser?.phone]);

  // Office Shift & Lunch Break State
  const [officeShiftState, setOfficeShiftState] = useState<{
    status: 'LOGGED_OFF' | 'LOGGED_IN' | 'ON_LUNCH_BREAK';
    loginTime: string | null;
    lunchStartTime: string | null;
    totalLunchMinutes: number;
    lastDate: string;
  }>(() => {
    try {
      const saved = localStorage.getItem('taskvaani_office_shift_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        const today = new Date().toISOString().split('T')[0];
        if (parsed.lastDate === today) {
          return parsed;
        }
      }
    } catch {}
    return {
      status: 'LOGGED_OFF',
      loginTime: null,
      lunchStartTime: null,
      totalLunchMinutes: 0,
      lastDate: new Date().toISOString().split('T')[0]
    };
  });

  const saveShiftState = (newState: typeof officeShiftState) => {
    setOfficeShiftState(newState);
    try {
      localStorage.setItem('taskvaani_office_shift_state', JSON.stringify(newState));
    } catch {}
  };

  // Synchronize state changes to Storage + Live Online Database
  useEffect(() => { StorageService.saveClients(clients); }, [clients]);
  useEffect(() => { StorageService.saveTasks(tasks); }, [tasks]);
  useEffect(() => { StorageService.saveTeam(team); }, [team]);
  useEffect(() => { StorageService.saveExtraWork(extraWork); }, [extraWork]);
  useEffect(() => { StorageService.saveDocuments(documents); }, [documents]);
  useEffect(() => { StorageService.saveAttendance(attendanceRecords); }, [attendanceRecords]);
  useEffect(() => { StorageService.saveSettings(settings); }, [settings]);
  useEffect(() => { StorageService.saveClientReminders(clientReminders); }, [clientReminders]);

  // Auto-sync all master data changes to Online Database in real time
  useEffect(() => {
    const isGuestDemo = currentUser?.role === 'GUEST' && !!currentUser?.phone;
    if (isGuestDemo) return;

    OnlineDataService.scheduleAutoOnlineSync({
      clients,
      tasks,
      team,
      extraWork,
      documents,
      attendanceRecords,
      settings,
      guestLeads: StorageService.getGuestLeads()
    });
  }, [clients, tasks, team, extraWork, documents, attendanceRecords, settings, currentUser?.role, currentUser?.phone]);

  // Auto-correct any existing clients with inaccurate category on startup using PAN/GSTIN
  useEffect(() => {
    let hasChanges = false;
    const corrected = clients.map(c => {
      const accurateCategory = detectEntityCategoryFromPANAndGSTIN(c.pan, c.gstin, c.tradeName, c.legalName);
      if (c.category === 'PVT_LTD' && accurateCategory !== 'PVT_LTD') {
        hasChanges = true;
        return { ...c, category: accurateCategory };
      }
      return c;
    });
    if (hasChanges) {
      setClients(corrected);
    }
  }, []);

  // Clients
  const addClient = (clientData: Omit<Client, 'id' | 'createdAt'>): Client => {
    if (!checkGuestWriteAllowed()) {
      return clients[0] || ({ ...clientData, id: 'blocked', createdAt: '' } as Client);
    }
    // 1. Check if client already exists by PAN, GSTIN, Trade Name, or Legal Name (NO DUPLICATES)
    const normPan = clientData.pan?.trim().toUpperCase();
    const normGst = clientData.gstin?.trim().toUpperCase();
    const normName = clientData.tradeName?.trim().toLowerCase();
    const normLegalName = clientData.legalName?.trim().toLowerCase();

    // 2. Accurately resolve statutory entity constitution / category
    const resolvedCategory = clientData.category && clientData.category !== 'PVT_LTD'
      ? clientData.category
      : detectEntityCategoryFromPANAndGSTIN(normPan, normGst, clientData.tradeName, clientData.legalName);

    const existingIndex = clients.findIndex(c => {
      if (normPan && normPan !== 'PAN-PENDING' && c.pan?.trim().toUpperCase() === normPan) return true;
      if (normGst && c.gstin?.trim().toUpperCase() === normGst) return true;
      if (normName && c.tradeName?.trim().toLowerCase() === normName) return true;
      if (normLegalName && c.legalName?.trim().toLowerCase() === normLegalName) return true;
      if (normName && c.legalName?.trim().toLowerCase() === normName) return true;
      if (normLegalName && c.tradeName?.trim().toLowerCase() === normLegalName) return true;
      return false;
    });

    if (existingIndex !== -1) {
      // Merge and update existing client record (NO DUPLICATES!)
      const existing = clients[existingIndex];
      const categoryToUse = (existing.category && existing.category !== 'PVT_LTD')
        ? existing.category
        : (clientData.category || detectEntityCategoryFromPANAndGSTIN(normPan || existing.pan, normGst || existing.gstin, clientData.tradeName || existing.tradeName, clientData.legalName || existing.legalName));

      const merged: Client = {
        ...existing,
        ...clientData,
        id: existing.id,
        createdAt: existing.createdAt,
        pan: (normPan && normPan !== 'PAN-PENDING') ? normPan : existing.pan,
        gstin: normGst || existing.gstin,
        tan: clientData.tan || existing.tan,
        tradeName: clientData.tradeName || existing.tradeName,
        legalName: clientData.legalName || existing.legalName || clientData.tradeName || existing.tradeName,
        category: categoryToUse,
        phone: clientData.phone || existing.phone,
        email: clientData.email || existing.email,
        contactPerson: clientData.contactPerson || existing.contactPerson,
        employeeName: clientData.employeeName || existing.employeeName,
        employeePhone: clientData.employeePhone || existing.employeePhone,
        formationDate: clientData.formationDate || existing.formationDate,
        googleDriveFolderId: clientData.googleDriveFolderId || existing.googleDriveFolderId,
        googleDriveFolderUrl: clientData.googleDriveFolderUrl || existing.googleDriveFolderUrl,
        repositoryDocs: clientData.repositoryDocs || existing.repositoryDocs || [],
        complianceApplicability: clientData.complianceApplicability || existing.complianceApplicability
      };

      const updated = [...clients];
      updated[existingIndex] = merged;
      const cleanClients = deduplicateClients(updated);
      setClients(cleanClients);
      StorageService.saveClients(cleanClients);

      // Synchronize existing tasks if client's name changed
      const oldTradeName = existing.tradeName?.trim().toLowerCase();
      const oldLegalName = existing.legalName?.trim().toLowerCase();
      let tasksChanged = false;
      const updatedTasks = tasks.map(t => {
        if ((t.clientId && t.clientId === existing.id) ||
            (oldTradeName && (t.clientName || '').trim().toLowerCase() === oldTradeName) ||
            (oldLegalName && (t.clientName || '').trim().toLowerCase() === oldLegalName)) {
          tasksChanged = true;
          return {
            ...t,
            clientId: existing.id,
            clientName: merged.tradeName,
            assignedTeamId: merged.assignedTeamId || t.assignedTeamId,
            assignedTeamName: merged.assignedTeamName || t.assignedTeamName
          };
        }
        return t;
      });

      if (tasksChanged) {
        const cleanTasks = deduplicateTasks(updatedTasks, cleanClients);
        setTasks(cleanTasks);
        StorageService.saveTasks(cleanTasks);
      }

      OnlineDataService.scheduleAutoOnlineSync({
        clients: cleanClients,
        tasks: tasksChanged ? updatedTasks : tasks,
        team: StorageService.getTeam(),
        extraWork: StorageService.getExtraWork(),
        documents: StorageService.getDocuments(),
        attendanceRecords: StorageService.getAttendance(),
        settings: StorageService.getSettings(),
        guestLeads: StorageService.getGuestLeads()
      });

      if (FirebaseService.isConfigured()) {
        FirebaseService.upsertDoc('clients', existing.id, merged);
      }

      StorageService.addAuditLog({
        actorId: 'admin',
        actorName: 'Admin',
        role: 'ADMIN',
        action: 'UPDATE_CLIENT',
        category: 'CLIENT',
        details: `Updated/Merged client profile: ${merged.tradeName} (PAN: ${merged.pan})`
      });
      setAuditLogs(StorageService.getAuditLogs());
      return merged;
    }

    const newClient: Client = {
      ...clientData,
      id: 'cli-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString().split('T')[0],
      status: clientData.status || 'ACTIVE',
      category: resolvedCategory,
      portalPassword: clientData.portalPassword || 'client123'
    };
    const updated = [newClient, ...clients];
    setClients(updated);
    
    // Auto generate standard recurring tasks for new client ONLY if not already existing
    const randSuffix = Math.random().toString(36).substring(2, 7);
    const sampleTasks: TaskItem[] = [
      {
        id: 'tsk-' + Date.now() + '-' + randSuffix + '-1',
        clientId: newClient.id,
        clientName: newClient.tradeName,
        title: 'Monthly TDS Payment (Challan 281)',
        category: 'TDS',
        frequency: 'MONTHLY',
        dueDayOrDate: '2',
        dueDate: '2026-09-07',
        status: 'PENDING',
        assignedTeamId: newClient.assignedTeamId,
        assignedTeamName: newClient.assignedTeamName,
        priority: 'HIGH',
        financialYear: settings.selectedTaxYear || 'Tax Year 2026-27',
      },
      {
        id: 'tsk-' + Date.now() + '-' + randSuffix + '-2',
        clientId: newClient.id,
        clientName: newClient.tradeName,
        title: 'GSTR-1 Monthly Outward Return',
        category: 'GST',
        frequency: 'MONTHLY',
        dueDayOrDate: '6',
        dueDate: '2026-09-11',
        status: 'PENDING',
        assignedTeamId: newClient.assignedTeamId,
        assignedTeamName: newClient.assignedTeamName,
        priority: 'CRITICAL',
        financialYear: settings.selectedTaxYear || 'Tax Year 2026-27',
      },
      {
        id: 'tsk-' + Date.now() + '-' + randSuffix + '-3',
        clientId: newClient.id,
        clientName: newClient.tradeName,
        title: 'GSTR-3B Monthly Return & Tax Settlement',
        category: 'GST',
        frequency: 'MONTHLY',
        dueDayOrDate: '15',
        dueDate: '2026-09-20',
        status: 'PENDING',
        assignedTeamId: newClient.assignedTeamId,
        assignedTeamName: newClient.assignedTeamName,
        priority: 'CRITICAL',
        financialYear: settings.selectedTaxYear || 'Tax Year 2026-27',
      }
    ];

    // If client has VAT applicability or VAT registration number, seed VAT Quarterly Return & Monthly Tax tasks
    if (newClient.complianceApplicability?.VAT || (newClient.vatNumber && newClient.vatNumber.trim().length >= 3)) {
      sampleTasks.push(
        {
          id: 'tsk-' + Date.now() + '-' + randSuffix + '-vat-q',
          clientId: newClient.id,
          clientName: newClient.tradeName,
          title: 'VAT Quarterly Return Filing',
          category: 'VAT',
          frequency: 'QUARTERLY',
          dueDayOrDate: '25',
          dueDate: '2026-10-30',
          status: 'PENDING',
          assignedTeamId: newClient.assignedTeamId,
          assignedTeamName: newClient.assignedTeamName,
          priority: 'HIGH',
          financialYear: settings.selectedTaxYear || 'Tax Year 2026-27',
        },
        {
          id: 'tsk-' + Date.now() + '-' + randSuffix + '-vat-m',
          clientId: newClient.id,
          clientName: newClient.tradeName,
          title: 'Monthly VAT Tax Payment & Challan Deposit',
          category: 'VAT',
          frequency: 'MONTHLY',
          dueDayOrDate: '5',
          dueDate: '2026-09-10',
          status: 'PENDING',
          assignedTeamId: newClient.assignedTeamId,
          assignedTeamName: newClient.assignedTeamName,
          priority: 'HIGH',
          financialYear: settings.selectedTaxYear || 'Tax Year 2026-27',
        }
      );
    }

    // If client has GSTR-9 applicability
    if (newClient.complianceApplicability?.GSTR_9) {
      sampleTasks.push({
        id: 'tsk-' + Date.now() + '-' + randSuffix + '-gstr9',
        clientId: newClient.id,
        clientName: newClient.tradeName,
        title: 'GSTR-9 Annual Return',
        category: 'GST',
        frequency: 'YEARLY',
        dueDayOrDate: '26',
        dueDate: '2026-12-31',
        status: 'PENDING',
        assignedTeamId: newClient.assignedTeamId,
        assignedTeamName: newClient.assignedTeamName,
        priority: 'HIGH',
        financialYear: settings.selectedTaxYear || 'Tax Year 2026-27',
      });
    }

    // If client has GSTR-9C applicability
    if (newClient.complianceApplicability?.GSTR_9C) {
      sampleTasks.push({
        id: 'tsk-' + Date.now() + '-' + randSuffix + '-gstr9c',
        clientId: newClient.id,
        clientName: newClient.tradeName,
        title: 'GSTR-9C Reconciliation Statement & Audit Certification',
        category: 'GST',
        frequency: 'YEARLY',
        dueDayOrDate: '26',
        dueDate: '2026-12-31',
        status: 'PENDING',
        assignedTeamId: newClient.assignedTeamId,
        assignedTeamName: newClient.assignedTeamName,
        priority: 'HIGH',
        financialYear: settings.selectedTaxYear || 'Tax Year 2026-27',
      });
    }

    const normTrade = (newClient.tradeName || '').trim().toLowerCase();
    const nonDuplicateSampleTasks = sampleTasks.filter(st => {
      const normTitle = (st.title || '').trim().toLowerCase();
      const normDate = (st.dueDate || st.dueDayOrDate || '').trim().toLowerCase();
      return !tasks.some(existing =>
        ((existing.clientId && existing.clientId === newClient.id) || (existing.clientName || '').trim().toLowerCase() === normTrade) &&
        (existing.title || '').trim().toLowerCase() === normTitle &&
        (existing.dueDate || existing.dueDayOrDate || '').trim().toLowerCase() === normDate
      );
    });

    if (nonDuplicateSampleTasks.length > 0) {
      const cleanTasks = deduplicateTasks([...nonDuplicateSampleTasks, ...tasks], updated);
      setTasks(cleanTasks);
      StorageService.saveTasks(cleanTasks);
    }

    const isGuestDemo = currentUser?.role === 'GUEST' && !!currentUser?.phone;
    if (!isGuestDemo && FirebaseService.isConfigured() && nonDuplicateSampleTasks.length > 0) {
      FirebaseService.upsertDoc('clients', newClient.id, newClient);
      nonDuplicateSampleTasks.forEach(st => FirebaseService.upsertDoc('tasks', st.id, st));
    }

    StorageService.addAuditLog({
      actorId: 'admin',
      actorName: 'Admin',
      role: 'ADMIN',
      action: 'ADD_CLIENT',
      category: 'CLIENT',
      details: `Created new client: ${newClient.tradeName} (PAN: ${newClient.pan})`
    });
    setAuditLogs(StorageService.getAuditLogs());
    const cleanClients = deduplicateClients(updated);
    setClients(cleanClients);
    StorageService.saveClients(cleanClients);
    return newClient;
  };

  const bulkImportClients = (
    rows: ParsedClientRow[]
  ): { createdCount: number; updatedCount: number; totalCount: number } => {
    if (!checkGuestWriteAllowed()) {
      return { createdCount: 0, updatedCount: 0, totalCount: clients.length };
    }

    const currentClients = StorageService.getClients();
    const existingTasks: TaskItem[] = StorageService.getTasks();
    const updatedClientList: Client[] = [...currentClients];
    let createdCount = 0;
    let updatedCount = 0;
    const newTasksToCreate: TaskItem[] = [];
    const nowIso = new Date().toISOString().split('T')[0];

    rows.forEach((row, idx) => {
      const normPan = row.pan?.trim().toUpperCase();
      const normGst = row.gstin?.trim().toUpperCase();
      const normName = row.tradeName?.trim().toLowerCase();
      const normLegalName = row.legalName?.trim().toLowerCase();
      const normTan = row.tan?.trim().toUpperCase();
      const normVat = row.vatNumber?.trim();

      // Check if client already exists (by ID, PAN, GSTIN, Trade Name, Legal Name, TAN, or VAT)
      const existingIndex = updatedClientList.findIndex(c => {
        if (row.id && c.id && c.id === row.id) return true;
        if (normPan && normPan !== 'PAN-PENDING' && (c.pan || '').trim().toUpperCase() === normPan) return true;
        if (normGst && (c.gstin || '').trim().toUpperCase() === normGst) return true;
        if (normName && (c.tradeName || '').trim().toLowerCase() === normName) return true;
        if (normLegalName && (c.legalName || '').trim().toLowerCase() === normLegalName) return true;
        if (normName && (c.legalName || '').trim().toLowerCase() === normName) return true;
        if (normLegalName && (c.tradeName || '').trim().toLowerCase() === normLegalName) return true;
        if (normTan && (c.tan || '').trim().toUpperCase() === normTan) return true;
        if (normVat && normVat.length >= 4 && (c.vatNumber || '').trim() === normVat) return true;
        return false;
      });

      const categoryToUse = row.category || detectEntityCategoryFromPANAndGSTIN(normPan, normGst, row.tradeName, row.legalName);

      if (existingIndex !== -1) {
        // MERGE & UPDATE EXISTING CLIENT (ZERO DUPLICATES!)
        const existing = updatedClientList[existingIndex];
        const updatedPan = (normPan && normPan !== 'PAN-PENDING') ? normPan : (existing.pan && existing.pan !== 'PAN-PENDING' ? existing.pan : '');
        const updatedGst = normGst || existing.gstin || undefined;
        const updatedTan = row.tan || existing.tan || undefined;
        const updatedVat = (row.vatNumber && row.vatNumber.trim().length >= 4) ? row.vatNumber.trim() : undefined;

        const merged: Client = {
          ...existing,
          tradeName: row.tradeName || existing.tradeName,
          legalName: row.legalName || existing.legalName || row.tradeName || existing.tradeName,
          pan: updatedPan || (updatedGst && updatedGst.length === 15 ? updatedGst.substring(2, 12) : 'PAN-PENDING'),
          gstin: updatedGst,
          tan: updatedTan,
          vatNumber: updatedVat, // Accurately syncs real VAT or removes fake VAT
          category: categoryToUse || existing.category,
          contactPerson: row.contactPerson || existing.contactPerson,
          phone: row.phone || existing.phone,
          email: row.email || existing.email,
          dob: row.dob || existing.dob,
          aadharNumber: row.aadharNumber || existing.aadharNumber,
          formationDate: row.formationDate || existing.formationDate,
          employeeName: row.employeeName || existing.employeeName,
          employeePhone: row.employeePhone || existing.employeePhone,
          assignedTeamName: row.assignedTeamName || existing.assignedTeamName,
          googleDriveFolderId: row.googleDriveFolderId || existing.googleDriveFolderId,
          googleDriveFolderUrl: row.googleDriveFolderUrl || existing.googleDriveFolderUrl,
          complianceApplicability: {
            ...resolveClientApplicability(existing),
            GST: !!(updatedGst && updatedGst.length === 15),
            VAT: !!(updatedVat && updatedVat.length >= 4),
            TDS: !!(updatedTan && updatedTan.length === 10) || resolveClientApplicability(existing).TDS
          }
        };
        updatedClientList[existingIndex] = merged;
        updatedCount++;

        // Synchronize tasks if client's name changed
        const oldTradeName = existing.tradeName?.trim().toLowerCase();
        const oldLegalName = existing.legalName?.trim().toLowerCase();
        if (merged.tradeName && oldTradeName && merged.tradeName.trim().toLowerCase() !== oldTradeName) {
          existingTasks.forEach(t => {
            if ((t.clientId && t.clientId === existing.id) ||
                (oldTradeName && (t.clientName || '').trim().toLowerCase() === oldTradeName) ||
                (oldLegalName && (t.clientName || '').trim().toLowerCase() === oldLegalName)) {
              t.clientId = existing.id;
              t.clientName = merged.tradeName;
            }
          });
        }
      } else {
        // CREATE NEW CLIENT RECORD
        const clientId = 'cli-' + Date.now() + '-' + idx + '-' + Math.floor(Math.random() * 1000);
        const resolvedPan = (normPan && normPan !== 'PAN-PENDING') 
          ? normPan 
          : (normGst && normGst.length === 15 ? normGst.substring(2, 12) : 'PAN-PENDING');
        const resolvedVat = (row.vatNumber && row.vatNumber.trim().length >= 4) ? row.vatNumber.trim() : undefined;

        const newClient: Client = {
          id: clientId,
          createdAt: nowIso,
          tradeName: row.tradeName,
          legalName: row.legalName || row.tradeName,
          pan: resolvedPan,
          gstin: normGst,
          tan: row.tan,
          vatNumber: resolvedVat,
          category: categoryToUse,
          status: 'ACTIVE',
          contactPerson: row.contactPerson || '',
          phone: row.phone || '',
          email: row.email || '',
          employeeName: row.employeeName,
          employeePhone: row.employeePhone,
          aadharNumber: row.aadharNumber,
          dob: row.dob,
          formationDate: row.formationDate,
          assignedTeamId: '',
          assignedTeamName: row.assignedTeamName || 'Assigned Staff',
          portalPassword: 'client' + (row.phone ? row.phone.slice(-4) : '123'),
          googleDriveFolderId: row.googleDriveFolderId || '',
          googleDriveFolderUrl: row.googleDriveFolderUrl || '',
          complianceApplicability: {
            GST: !!(normGst && normGst.length === 15),
            TDS: !!(row.tan && row.tan.length === 10),
            ITR: true,
            AUDIT: false,
            VAT: !!(resolvedVat && resolvedVat.length >= 4),
            E_INVOICE: false,
            RCM: false,
            RULE_86B: false,
            GSTR_9: false,
            GSTR_9C: false
          },
          customFields: []
        };
        updatedClientList.push(newClient);
        createdCount++;

        // Add standard statutory compliance tasks for new client ONLY if not already existing
        const randSuffix = Math.random().toString(36).substring(2, 7);
        const tsk1: TaskItem = {
          id: 'tsk-' + Date.now() + '-' + idx + '-' + randSuffix + '-1',
          clientId: newClient.id,
          clientName: newClient.tradeName,
          title: 'Monthly TDS Payment (Challan 281)',
          category: 'TDS',
          frequency: 'MONTHLY',
          dueDayOrDate: '2',
          dueDate: '2026-09-07',
          status: 'PENDING',
          assignedTeamId: newClient.assignedTeamId || '',
          assignedTeamName: newClient.assignedTeamName || 'Assigned Staff',
          priority: 'HIGH',
          financialYear: settings.selectedTaxYear || 'Tax Year 2026-27'
        };
        const tsk2: TaskItem = {
          id: 'tsk-' + Date.now() + '-' + idx + '-' + randSuffix + '-2',
          clientId: newClient.id,
          clientName: newClient.tradeName,
          title: 'GSTR-1 Monthly Outward Return',
          category: 'GST',
          frequency: 'MONTHLY',
          dueDayOrDate: '6',
          dueDate: '2026-09-11',
          status: 'PENDING',
          assignedTeamId: newClient.assignedTeamId || '',
          assignedTeamName: newClient.assignedTeamName || 'Assigned Staff',
          priority: 'CRITICAL',
          financialYear: settings.selectedTaxYear || 'Tax Year 2026-27'
        };
        const tsk3: TaskItem = {
          id: 'tsk-' + Date.now() + '-' + idx + '-' + randSuffix + '-3',
          clientId: newClient.id,
          clientName: newClient.tradeName,
          title: 'GSTR-3B Monthly Return & Tax Settlement',
          category: 'GST',
          frequency: 'MONTHLY',
          dueDayOrDate: '15',
          dueDate: '2026-09-20',
          status: 'PENDING',
          assignedTeamId: newClient.assignedTeamId || '',
          assignedTeamName: newClient.assignedTeamName || 'Assigned Staff',
          priority: 'CRITICAL',
          financialYear: settings.selectedTaxYear || 'Tax Year 2026-27'
        };

        const taskAlreadyExists = (title: string, dueDate: string) => {
          const normTitle = title.trim().toLowerCase();
          const normDate = dueDate.trim().toLowerCase();
          const normClient = (newClient.tradeName || '').trim().toLowerCase();
          return (
            existingTasks.some(t =>
              ((t.clientId && t.clientId === newClient.id) || (t.clientName || '').trim().toLowerCase() === normClient) &&
              (t.title || '').trim().toLowerCase() === normTitle &&
              (t.dueDate || t.dueDayOrDate || '').trim().toLowerCase() === normDate
            ) ||
            newTasksToCreate.some(t =>
              ((t.clientId && t.clientId === newClient.id) || (t.clientName || '').trim().toLowerCase() === normClient) &&
              (t.title || '').trim().toLowerCase() === normTitle &&
              (t.dueDate || t.dueDayOrDate || '').trim().toLowerCase() === normDate
            )
          );
        };

        if (!taskAlreadyExists('Monthly TDS Payment (Challan 281)', '2026-09-07')) {
          newTasksToCreate.push(tsk1);
        }
        if (!taskAlreadyExists('GSTR-1 Monthly Outward Return', '2026-09-11')) {
          newTasksToCreate.push(tsk2);
        }
        if (!taskAlreadyExists('GSTR-3B Monthly Return & Tax Settlement', '2026-09-20')) {
          newTasksToCreate.push(tsk3);
        }

        // If client has VAT applicability or VAT registration number
        if (newClient.complianceApplicability?.VAT || (newClient.vatNumber && newClient.vatNumber.trim().length >= 3)) {
          if (!taskAlreadyExists('VAT Quarterly Return Filing', '2026-10-30')) {
            newTasksToCreate.push({
              id: 'tsk-' + Date.now() + '-' + idx + '-' + randSuffix + '-vat-q',
              clientId: newClient.id,
              clientName: newClient.tradeName,
              title: 'VAT Quarterly Return Filing',
              category: 'VAT',
              frequency: 'QUARTERLY',
              dueDayOrDate: '25',
              dueDate: '2026-10-30',
              status: 'PENDING',
              assignedTeamId: newClient.assignedTeamId || '',
              assignedTeamName: newClient.assignedTeamName || 'Assigned Staff',
              priority: 'HIGH',
              financialYear: settings.selectedTaxYear || 'Tax Year 2026-27'
            });
          }
          if (!taskAlreadyExists('Monthly VAT Tax Payment & Challan Deposit', '2026-09-10')) {
            newTasksToCreate.push({
              id: 'tsk-' + Date.now() + '-' + idx + '-' + randSuffix + '-vat-m',
              clientId: newClient.id,
              clientName: newClient.tradeName,
              title: 'Monthly VAT Tax Payment & Challan Deposit',
              category: 'VAT',
              frequency: 'MONTHLY',
              dueDayOrDate: '5',
              dueDate: '2026-09-10',
              status: 'PENDING',
              assignedTeamId: newClient.assignedTeamId || '',
              assignedTeamName: newClient.assignedTeamName || 'Assigned Staff',
              priority: 'HIGH',
              financialYear: settings.selectedTaxYear || 'Tax Year 2026-27'
            });
          }
        }
      }
    });

    // 1. Immediately deduplicate & write updated clients to state and LocalStorage
    const cleanClients = deduplicateClients(updatedClientList);
    setClients(cleanClients);
    StorageService.saveClients(cleanClients);

    // 2. Save tasks (Strictly Deduplicated)
    const combinedTasks = deduplicateTasks([...newTasksToCreate, ...existingTasks], cleanClients);
    setTasks(combinedTasks);
    StorageService.saveTasks(combinedTasks);

    // 3. Immediately trigger background auto-sync to online server & Firebase
    OnlineDataService.scheduleAutoOnlineSync({
      clients: cleanClients,
      tasks: combinedTasks,
      team: StorageService.getTeam(),
      extraWork: StorageService.getExtraWork(),
      documents: StorageService.getDocuments(),
      attendanceRecords: StorageService.getAttendance(),
      settings: StorageService.getSettings(),
      guestLeads: StorageService.getGuestLeads()
    });

    if (FirebaseService.isConfigured()) {
      cleanClients.forEach(c => FirebaseService.upsertDoc('clients', c.id, c));
      newTasksToCreate.forEach(t => FirebaseService.upsertDoc('tasks', t.id, t));
    }

    StorageService.addAuditLog({
      actorId: 'admin',
      actorName: 'Admin',
      role: 'ADMIN',
      action: 'BULK_IMPORT_CLIENTS',
      category: 'CLIENT',
      details: `Bulk imported clients: ${createdCount} new created, ${updatedCount} existing updated (Zero Duplicates). Total in directory: ${cleanClients.length}`
    });
    setAuditLogs(StorageService.getAuditLogs());

    return { createdCount, updatedCount, totalCount: cleanClients.length };
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    if (!checkGuestWriteAllowed()) return;

    // 1. Fetch previous client state before update
    const currentClients = StorageService.getClients();
    const oldClient = currentClients.find(c => c.id === id) || clients.find(c => c.id === id);
    const oldTradeName = oldClient?.tradeName?.trim().toLowerCase();
    const oldLegalName = oldClient?.legalName?.trim().toLowerCase();

    // 2. Compute updated clients list
    let targetUpdatedClient: Client | null = null;
    const updatedClientList = clients.map(c => {
      if (c.id === id) {
        const updated: Client = {
          ...c,
          ...updates,
          tradeName: updates.tradeName !== undefined ? updates.tradeName.trim() : c.tradeName,
          legalName: updates.legalName !== undefined ? updates.legalName.trim() : (updates.tradeName !== undefined ? updates.tradeName.trim() : c.legalName),
          pan: updates.pan !== undefined ? updates.pan.trim().toUpperCase() : c.pan,
          gstin: updates.gstin !== undefined ? updates.gstin.trim().toUpperCase() : c.gstin,
          tan: updates.tan !== undefined ? updates.tan.trim().toUpperCase() : c.tan,
        };
        targetUpdatedClient = updated;
        if (!(currentUser?.role === 'GUEST' && !!currentUser?.phone) && FirebaseService.isConfigured()) {
          FirebaseService.upsertDoc('clients', id, updated);
        }
        return updated;
      }
      return c;
    });

    // 3. Immediately deduplicate and persist clients list
    const cleanClients = deduplicateClients(updatedClientList);
    setClients(cleanClients);
    StorageService.saveClients(cleanClients);

    // 4. Synchronize all tasks referencing this client (by ID or old names)
    const newTradeName = updates.tradeName !== undefined ? updates.tradeName.trim() : oldClient?.tradeName;
    let tasksChanged = false;
    const updatedTasks = tasks.map(t => {
      const matchById = t.clientId && t.clientId === id;
      const matchByName = (oldTradeName && (t.clientName || '').trim().toLowerCase() === oldTradeName) ||
                          (oldLegalName && (t.clientName || '').trim().toLowerCase() === oldLegalName);

      if (matchById || matchByName) {
        tasksChanged = true;
        const taskUpdate: TaskItem = {
          ...t,
          clientId: id,
          clientName: newTradeName || t.clientName,
          assignedTeamId: updates.assignedTeamId !== undefined ? (updates.assignedTeamId || '') : t.assignedTeamId,
          assignedTeamName: updates.assignedTeamName !== undefined ? (updates.assignedTeamName || '') : t.assignedTeamName,
        };
        if (!(currentUser?.role === 'GUEST' && !!currentUser?.phone) && FirebaseService.isConfigured()) {
          FirebaseService.upsertDoc('tasks', t.id, taskUpdate);
        }
        return taskUpdate;
      }
      return t;
    });

    if (tasksChanged) {
      const cleanTasks = deduplicateTasks(updatedTasks, cleanClients);
      setTasks(cleanTasks);
      StorageService.saveTasks(cleanTasks);
    }

    // 5. Trigger Online Sync with updated data
    OnlineDataService.scheduleAutoOnlineSync({
      clients: cleanClients,
      tasks: tasksChanged ? updatedTasks : tasks,
      team: StorageService.getTeam(),
      extraWork: StorageService.getExtraWork(),
      documents: StorageService.getDocuments(),
      attendanceRecords: StorageService.getAttendance(),
      settings: StorageService.getSettings(),
      guestLeads: StorageService.getGuestLeads()
    });

    StorageService.addAuditLog({
      actorId: 'admin',
      actorName: 'Admin',
      role: 'ADMIN',
      action: 'UPDATE_CLIENT',
      category: 'CLIENT',
      details: `Updated details for client: ${newTradeName || id} (ID: ${id})`
    });
    setAuditLogs(StorageService.getAuditLogs());
  };

  const deleteClient = (id: string) => {
    if (!checkGuestWriteAllowed()) return;
    const target = clients.find(c => c.id === id);
    const clientTaskIds = tasks.filter(t => t.clientId === id).map(t => t.id);
    setClients(prev => prev.filter(c => c.id !== id));
    setTasks(prev => prev.filter(t => t.clientId !== id));
    if (!(currentUser?.role === 'GUEST' && !!currentUser?.phone) && FirebaseService.isConfigured()) {
      FirebaseService.deleteDoc('clients', id);
      clientTaskIds.forEach(tid => FirebaseService.deleteDoc('tasks', tid));
    }
    StorageService.addAuditLog({
      actorId: 'admin',
      actorName: 'Admin',
      role: 'ADMIN',
      action: 'DELETE_CLIENT',
      category: 'CLIENT',
      details: `Deleted client: ${target?.tradeName || id}`
    });
    setAuditLogs(StorageService.getAuditLogs());
  };

  // Tasks
  const addTask = (rawTaskData: Omit<TaskItem, 'id'>): TaskItem => {
    if (!checkGuestWriteAllowed()) {
      return tasks[0] || ({ ...rawTaskData, id: 'blocked' } as TaskItem);
    }

    // Auto-calculate statutory Due Rule / Day if not explicitly filled:
    // Monthly tasks: 5 days prior to statutory due date (e.g. 7th -> 2nd, 11th -> 6th, 20th -> 15th)
    // Daily tasks: 'Daily'
    const taskData = { ...rawTaskData };
    if (!taskData.dueDayOrDate || taskData.dueDayOrDate.trim() === '') {
      if (taskData.frequency === 'DAILY') {
        taskData.dueDayOrDate = 'Daily';
      } else if ((taskData.frequency === 'MONTHLY' || taskData.frequency === 'QUARTERLY') && taskData.dueDate) {
        const day = parseInt(taskData.dueDate.split('-')[2] || '0', 10);
        if (day > 0) {
          taskData.dueDayOrDate = Math.max(1, day - 5).toString();
        }
      }
    }

    const normClient = (taskData.clientName || '').trim().toLowerCase();
    const normTitle = (taskData.title || '').trim().toLowerCase();
    const normDate = (taskData.dueDate || taskData.dueDayOrDate || taskData.financialYear || '').trim().toLowerCase();
    
    // Check if an identical task already exists for this client and period
    const existingIdx = tasks.findIndex(t =>
      ((t.clientId && t.clientId === taskData.clientId) || (t.clientName || '').trim().toLowerCase() === normClient) &&
      (t.title || '').trim().toLowerCase() === normTitle &&
      (t.dueDate || t.dueDayOrDate || t.financialYear || '').trim().toLowerCase() === normDate
    );

    if (existingIdx !== -1) {
      const updated: TaskItem = { ...tasks[existingIdx], ...taskData };
      const nextList = [...tasks];
      nextList[existingIdx] = updated;
      const cleanList = deduplicateTasks(nextList, clients);
      setTasks(cleanList);
      StorageService.saveTasks(cleanList);
      if (!(currentUser?.role === 'GUEST' && !!currentUser?.phone) && FirebaseService.isConfigured()) {
        FirebaseService.upsertDoc('tasks', updated.id, updated);
      }
      return updated;
    }

    const newTask: TaskItem = {
      ...taskData,
      id: 'tsk-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    };
    const cleanList = deduplicateTasks([newTask, ...tasks], clients);
    setTasks(cleanList);
    StorageService.saveTasks(cleanList);
    if (!(currentUser?.role === 'GUEST' && !!currentUser?.phone) && FirebaseService.isConfigured()) {
      FirebaseService.upsertDoc('tasks', newTask.id, newTask);
    }
    StorageService.addAuditLog({
      actorId: 'system',
      actorName: 'System',
      role: 'ADMIN',
      action: 'CREATE_TASK',
      category: 'TASK',
      details: `Added compliance task "${newTask.title}" for ${newTask.clientName}`
    });
    setAuditLogs(StorageService.getAuditLogs());
    return newTask;
  };

  const cleanDuplicateTasks = (): number => {
    const current = StorageService.getTasks();
    const currentClients = StorageService.getClients();
    const clean = deduplicateTasks(current, currentClients);
    const removedCount = Math.max(0, current.length - clean.length);
    setTasks(clean);
    StorageService.saveTasks(clean);
    OnlineDataService.scheduleAutoOnlineSync({
      clients: currentClients,
      tasks: clean,
      team: StorageService.getTeam(),
      extraWork: StorageService.getExtraWork(),
      documents: StorageService.getDocuments(),
      attendanceRecords: StorageService.getAttendance(),
      settings: StorageService.getSettings(),
      guestLeads: StorageService.getGuestLeads()
    });
    StorageService.addAuditLog({
      actorId: 'system',
      actorName: 'System',
      role: 'ADMIN',
      action: 'BULK_UPDATE_TASKS',
      category: 'TASK',
      details: `Cleaned duplicate compliance tasks: Removed ${removedCount} duplicates. Unique remaining: ${clean.length}`
    });
    setAuditLogs(StorageService.getAuditLogs());
    return removedCount;
  };

  const updateTaskStatus = (taskId: string, status: TaskStatus, completedBy = 'User') => {
    if (!checkGuestWriteAllowed()) return;
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const isDone = status === 'DONE';
        if (isDone) AudioService.playSuccessSound();
        const updatedTask: TaskItem = {
          ...t,
          status,
          completedAt: isDone ? new Date().toISOString() : undefined,
          completedBy: isDone ? completedBy : undefined
        };
        if (!(currentUser?.role === 'GUEST' && !!currentUser?.phone) && FirebaseService.isConfigured()) {
          FirebaseService.upsertDoc('tasks', taskId, updatedTask);
        }
        return updatedTask;
      }
      return t;
    }));
    StorageService.addAuditLog({
      actorId: completedBy,
      actorName: completedBy,
      role: 'TEAM',
      action: 'UPDATE_TASK_STATUS',
      category: 'TASK',
      details: `Updated task ${taskId} status to ${status}`
    });
    setAuditLogs(StorageService.getAuditLogs());
  };

  const updateTask = (id: string, updates: Partial<TaskItem>) => {
    if (!checkGuestWriteAllowed()) return;
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        if (!(currentUser?.role === 'GUEST' && !!currentUser?.phone) && FirebaseService.isConfigured()) {
          FirebaseService.upsertDoc('tasks', id, updated);
        }
        return updated;
      }
      return t;
    }));
  };

  const deleteTask = (id: string) => {
    if (!checkGuestWriteAllowed()) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    if (!(currentUser?.role === 'GUEST' && !!currentUser?.phone) && FirebaseService.isConfigured()) {
      FirebaseService.deleteDoc('tasks', id);
    }
  };

  const bulkUpdateTasks = (taskIds: string[], status: TaskStatus) => {
    if (!checkGuestWriteAllowed()) return;
    setTasks(prev => prev.map(t => {
      if (taskIds.includes(t.id)) {
        const updated = { ...t, status, completedAt: status === 'DONE' ? new Date().toISOString() : undefined };
        if (!(currentUser?.role === 'GUEST' && !!currentUser?.phone) && FirebaseService.isConfigured()) {
          FirebaseService.upsertDoc('tasks', t.id, updated);
        }
        return updated;
      }
      return t;
    }));
  };

  // Team
  const addTeamMember = (memberData: Omit<UserProfile, 'id' | 'role'> & { role?: 'ADMIN' | 'TEAM' }): UserProfile => {
    const normEmail = memberData.email?.trim().toLowerCase();
    const normPhone = memberData.phone?.trim();
    const normName = memberData.name?.trim().toLowerCase();

    const existingIndex = team.findIndex(m => {
      if (normEmail && m.email?.trim().toLowerCase() === normEmail) return true;
      if (normPhone && m.phone?.trim() === normPhone) return true;
      if (normName && m.name?.trim().toLowerCase() === normName) return true;
      return false;
    });

    if (existingIndex !== -1) {
      const existing = team[existingIndex];
      const merged: UserProfile = {
        ...existing,
        ...memberData,
        id: existing.id,
        role: memberData.role || existing.role || 'TEAM',
        designation: memberData.designation || existing.designation,
        phone: memberData.phone || existing.phone,
        email: memberData.email || existing.email,
        pin: memberData.pin || existing.pin || '1234'
      };
      const updated = [...team];
      updated[existingIndex] = merged;
      setTeam(updated);
      return merged;
    }

    const newMember: UserProfile = {
      ...memberData,
      id: 'team-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      role: memberData.role || 'TEAM',
      pin: memberData.pin || (memberData.phone ? memberData.phone.slice(-4) : '1234'),
      assignedClientIds: memberData.assignedClientIds || []
    };
    setTeam(prev => [...prev, newMember]);
    return newMember;
  };

  const updateTeamMember = (id: string, updates: Partial<UserProfile>) => {
    setTeam(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const deleteTeamMember = (id: string) => {
    setTeam(prev => prev.filter(m => m.id !== id));
  };

  // Extra Work
  const addExtraWork = (workData: Omit<ExtraWorkItem, 'id' | 'createdDate'>): ExtraWorkItem => {
    const newWork: ExtraWorkItem = {
      ...workData,
      id: 'ew-' + Date.now(),
      createdDate: new Date().toISOString().split('T')[0],
    };
    setExtraWork(prev => [newWork, ...prev]);
    return newWork;
  };

  const updateExtraWork = (id: string, updates: Partial<ExtraWorkItem>) => {
    setExtraWork(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const deleteExtraWork = (id: string) => {
    setExtraWork(prev => prev.filter(w => w.id !== id));
  };

  // Documents
  const addDocument = (docData: Omit<DocumentItem, 'id' | 'uploadedAt'>): DocumentItem => {
    const newDoc: DocumentItem = {
      ...docData,
      id: 'doc-' + Date.now(),
      uploadedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
    };
    setDocuments(prev => [newDoc, ...prev]);
    return newDoc;
  };

  const deleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  // Attendance
  const recordPunchIn = (teamId: string, teamName: string, selfieDataUrl?: string, locationStamp?: string, notes = '', minutesWorked = 0): AttendanceRecord => {
    const isCompletedImmediately = minutesWorked > 0 || (!!selfieDataUrl && !notes.startsWith('[Live Session]'));
    const finalMinutes = minutesWorked > 0 ? minutesWorked : (isCompletedImmediately ? 1 : 0);
    
    const newRecord: AttendanceRecord = {
      id: 'att-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      teamId: teamId || 'admin',
      teamName: teamName || 'Staff Associate',
      date: new Date().toISOString().split('T')[0],
      punchInTime: new Date().toISOString(),
      punchOutTime: isCompletedImmediately ? new Date().toISOString() : undefined,
      totalMinutesWorked: finalMinutes,
      selfieDataUrl: selfieDataUrl || undefined,
      locationStamp: locationStamp || 'Office Geotag',
      workSessionNotes: notes || (selfieDataUrl ? 'Biometric camera attendance recorded' : 'Work session started'),
      status: 'PRESENT'
    };

    setAttendanceRecords(prev => {
      const updated = [newRecord, ...prev];
      StorageService.saveAttendance(updated);
    FirebaseService.upsertDoc('attendance', newRecord.id, newRecord);
      return updated;
    });

    StorageService.addAuditLog({
      actorId: teamId || 'admin',
      actorName: teamName || 'Staff Associate',
      role: 'TEAM',
      action: 'WORK_TIME_ON',
      category: 'ATTENDANCE',
      details: `🟢 WORKING TIME ON: ${newRecord.workSessionNotes} | Start Time: ${new Date().toLocaleTimeString('en-IN')}`
    });
    const allLogs = StorageService.getAuditLogs();
    setAuditLogs(allLogs);

    // Auto push audit record to Google Sheets in Google Drive
    GoogleDriveService.syncAuditLogsToGoogleSheets(
      allLogs,
      settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
      settings.googleWebhookUrl
    );

    return newRecord;
  };

  const recordPunchOut = (recordId: string, minutesWorked: number, notes = '') => {
    let actorId = 'admin';
    let actorName = 'Staff Associate';
    let sessionTitle = '';

    setAttendanceRecords(prev => {
      const updated = prev.map(r => {
        if (r.id === recordId) {
          actorId = r.teamId;
          actorName = r.teamName;
          sessionTitle = r.workSessionNotes || 'Work session';
          return {
            ...r,
            punchOutTime: new Date().toISOString(),
            totalMinutesWorked: minutesWorked,
            workSessionNotes: notes || r.workSessionNotes
          };
        }
        return r;
      });
      StorageService.saveAttendance(updated);
      return updated;
    });

    StorageService.addAuditLog({
      actorId,
      actorName,
      role: 'TEAM',
      action: 'WORK_TIME_OFF',
      category: 'ATTENDANCE',
      details: `🔴 WORKING TIME OFF: ${notes || sessionTitle} | Duration: ${minutesWorked} mins | End Time: ${new Date().toLocaleTimeString('en-IN')}`
    });
    const allLogs = StorageService.getAuditLogs();
    setAuditLogs(allLogs);

    // Auto push audit record to Google Sheets in Google Drive
    GoogleDriveService.syncAuditLogsToGoogleSheets(
      allLogs,
      settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
      settings.googleWebhookUrl
    );
  };


  const loginOffice = (teamId = 'admin', teamName = 'Staff Associate') => {
    const nowIso = new Date().toISOString();
    const today = nowIso.split('T')[0];
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const newState = {
      status: 'LOGGED_IN' as const,
      loginTime: nowIso,
      lunchStartTime: null,
      totalLunchMinutes: officeShiftState.lastDate === today ? officeShiftState.totalLunchMinutes : 0,
      lastDate: today
    };
    saveShiftState(newState);

    // Record in Attendance System
    const newAttRecord: AttendanceRecord = {
      id: 'att-shift-' + Date.now(),
      teamId,
      teamName,
      date: today,
      punchInTime: nowIso,
      totalMinutesWorked: 0,
      locationStamp: 'Office Geotag',
      workSessionNotes: `Office Shift In at ${timeStr}`,
      status: 'PRESENT'
    };

    setAttendanceRecords(prev => {
      const updated = [newAttRecord, ...prev];
      StorageService.saveAttendance(updated);
      return updated;
    });

    // Add Audit Log
    StorageService.addAuditLog({
      actorId: teamId,
      actorName: teamName,
      role: 'TEAM',
      action: 'OFFICE_LOGIN',
      category: 'ATTENDANCE',
      details: `🟢 OFFICE LOGIN (PUNCH-IN): Official office shift started at ${timeStr}`
    });
    const allLogs = StorageService.getAuditLogs();
    setAuditLogs(allLogs);

    GoogleDriveService.syncAuditLogsToGoogleSheets(
      allLogs,
      settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
      settings.googleWebhookUrl
    );
  };

  const startLunchBreak = (teamId = 'admin', teamName = 'Staff Associate') => {
    const nowIso = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const newState = {
      ...officeShiftState,
      status: 'ON_LUNCH_BREAK' as const,
      lunchStartTime: nowIso
    };
    saveShiftState(newState);

    StorageService.addAuditLog({
      actorId: teamId,
      actorName: teamName,
      role: 'TEAM',
      action: 'LUNCH_BREAK_ON',
      category: 'ATTENDANCE',
      details: `🍽️ LUNCH BREAK ON (STARTED): Employee went on lunch break at ${timeStr}`
    });
    const allLogs = StorageService.getAuditLogs();
    setAuditLogs(allLogs);

    GoogleDriveService.syncAuditLogsToGoogleSheets(
      allLogs,
      settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
      settings.googleWebhookUrl
    );
  };

  const endLunchBreak = (teamId = 'admin', teamName = 'Staff Associate') => {
    const now = Date.now();
    const start = officeShiftState.lunchStartTime ? new Date(officeShiftState.lunchStartTime).getTime() : now;
    const durationMinutes = Math.max(1, Math.round((now - start) / 60000));
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const newTotalLunch = officeShiftState.totalLunchMinutes + durationMinutes;

    const newState = {
      ...officeShiftState,
      status: 'LOGGED_IN' as const,
      lunchStartTime: null,
      totalLunchMinutes: newTotalLunch
    };
    saveShiftState(newState);

    StorageService.addAuditLog({
      actorId: teamId,
      actorName: teamName,
      role: 'TEAM',
      action: 'LUNCH_BREAK_OFF',
      category: 'ATTENDANCE',
      details: `🍽️ LUNCH BREAK OFF (ENDED): Employee resumed work at ${timeStr} | Break Duration: ${durationMinutes} mins (Total Lunch Today: ${newTotalLunch} mins)`
    });
    const allLogs = StorageService.getAuditLogs();
    setAuditLogs(allLogs);

    GoogleDriveService.syncAuditLogsToGoogleSheets(
      allLogs,
      settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
      settings.googleWebhookUrl
    );
  };

  const logoffOffice = (teamId = 'admin', teamName = 'Staff Associate') => {
    const now = Date.now();
    const login = officeShiftState.loginTime ? new Date(officeShiftState.loginTime).getTime() : now;
    const totalShiftMinutes = Math.max(1, Math.round((now - login) / 60000));
    const netWorkMinutes = Math.max(0, totalShiftMinutes - officeShiftState.totalLunchMinutes);
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const shiftHrs = Math.floor(totalShiftMinutes / 60);
    const shiftMins = totalShiftMinutes % 60;
    const netHrs = Math.floor(netWorkMinutes / 60);
    const netMins = netWorkMinutes % 60;

    const newState = {
      status: 'LOGGED_OFF' as const,
      loginTime: null,
      lunchStartTime: null,
      totalLunchMinutes: 0,
      lastDate: new Date().toISOString().split('T')[0]
    };
    saveShiftState(newState);

    // Update Attendance Record
    const today = new Date().toISOString().split('T')[0];
    setAttendanceRecords(prev => {
      let found = false;
      const updated = prev.map(r => {
        if (r.date === today && (r.teamId === teamId || r.teamName === teamName) && !r.punchOutTime) {
          found = true;
          return {
            ...r,
            punchOutTime: new Date().toISOString(),
            totalMinutesWorked: netWorkMinutes,
            workSessionNotes: `${r.workSessionNotes || 'Office Shift'} | Out at ${timeStr} (Shift: ${shiftHrs}h ${shiftMins}m, Lunch: ${officeShiftState.totalLunchMinutes}m, Net Work: ${netHrs}h ${netMins}m)`
          };
        }
        return r;
      });

      if (!found) {
        updated.unshift({
          id: 'att-shift-out-' + Date.now(),
          teamId,
          teamName,
          date: today,
          punchInTime: officeShiftState.loginTime || new Date().toISOString(),
          punchOutTime: new Date().toISOString(),
          totalMinutesWorked: netWorkMinutes,
          locationStamp: 'Office Geotag',
          workSessionNotes: `Office Shift Out at ${timeStr} (Shift: ${shiftHrs}h ${shiftMins}m, Lunch: ${officeShiftState.totalLunchMinutes}m, Net: ${netHrs}h ${netMins}m)`,
          status: 'PRESENT'
        });
      }

      StorageService.saveAttendance(updated);
      return updated;
    });

    StorageService.addAuditLog({
      actorId: teamId,
      actorName: teamName,
      role: 'TEAM',
      action: 'OFFICE_LOGOFF',
      category: 'ATTENDANCE',
      details: `🔴 OFFICE LOG-OFF (PUNCH-OUT): Shift ended at ${timeStr} | Total Shift: ${shiftHrs}h ${shiftMins}m | Lunch Break: ${officeShiftState.totalLunchMinutes}m | Net Working Time: ${netHrs}h ${netMins}m`
    });
    const allLogs = StorageService.getAuditLogs();
    setAuditLogs(allLogs);

    GoogleDriveService.syncAuditLogsToGoogleSheets(
      allLogs,
      settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com',
      settings.googleWebhookUrl
    );
  };

  const sendClientReminder = (reminderData: Omit<ClientReminder, 'id' | 'sentDate' | 'status'>): ClientReminder => {
    const newReminder: ClientReminder = {
      ...reminderData,
      id: 'rem-' + Date.now(),
      sentDate: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      status: 'PENDING_DOCS'
    };
    setClientReminders(prev => [newReminder, ...prev]);

    StorageService.addAuditLog({
      actorId: reminderData.senderId,
      actorName: reminderData.senderName,
      role: 'TEAM',
      action: 'CLIENT_REMINDER_SENT',
      category: 'CLIENT',
      details: `Sent document request to ${reminderData.clientName} & Employee ${reminderData.employeeName || 'Accountant'} for ${reminderData.complianceTitle}`
    });
    setAuditLogs(StorageService.getAuditLogs());
    return newReminder;
  };

  const resolveClientReminder = (id: string) => {
    setClientReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'RECEIVED' } : r));
  };

  const updateSettings = (updates: Partial<SystemSettings>) => {
    setSettings((prev: SystemSettings) => {
      const updated = { ...prev, ...updates };
      StorageService.saveSettings(updated);
      if (FirebaseService.isConfigured()) {
        FirebaseService.upsertDoc('system', 'settings', updated);
      }
      return updated;
    });
  };

  const purgeAuditLogs = () => {
    StorageService.saveAuditLogs([]);
    setAuditLogs([]);
  };

  const resetAllData = () => {
    StorageService.resetToDefaults();
    setClients(StorageService.getClients());
    setTasks(StorageService.getTasks());
    setTeam(StorageService.getTeam());
    setExtraWork(StorageService.getExtraWork());
    setDocuments(StorageService.getDocuments());
    setAuditLogs(StorageService.getAuditLogs());
    setAttendanceRecords([]);
    setSettings(StorageService.getSettings());
  };

  const fullAppReset = () => {
    StorageService.fullCleanWipe();
    setClients([]);
    setTasks([]);
    const cleanTeam = StorageService.getTeam();
    setTeam(cleanTeam);
    setExtraWork([]);
    setDocuments([]);
    setAuditLogs([]);
    setAttendanceRecords([]);
    const preservedSettings = StorageService.getSettings();
    setSettings(preservedSettings);

    // Immediately trigger auto-sync of this 0-data state to server / Firebase
    OnlineDataService.scheduleAutoOnlineSync({
      clients: [],
      tasks: [],
      team: cleanTeam,
      extraWork: [],
      documents: [],
      attendanceRecords: [],
      settings: preservedSettings,
      guestLeads: StorageService.getGuestLeads()
    });
  };

  const resetToBlankForGuestDemo = () => {
    setClients([]);
    setTasks([]);
    setExtraWork([]);
    setDocuments([]);
    StorageService.saveClients([]);
    StorageService.saveTasks([]);
    StorageService.saveExtraWork([]);
    StorageService.saveDocuments([]);
  };

  const loadSampleForGuestDemo = () => {
    setClients(SEED_CLIENTS);
    setTasks(SEED_TASKS);
    setExtraWork(SEED_EXTRA_WORK);
    setDocuments(SEED_DOCUMENTS);
    StorageService.saveClients(SEED_CLIENTS);
    StorageService.saveTasks(SEED_TASKS);
    StorageService.saveExtraWork(SEED_EXTRA_WORK);
    StorageService.saveDocuments(SEED_DOCUMENTS);
  };

  return (
    <TaskContext.Provider value={{
      clients,
      tasks,
      team,
      extraWork,
      documents,
      auditLogs,
      attendanceRecords,
      settings,
      addClient,
      bulkImportClients,
      updateClient,
      deleteClient,
      addTask,
      updateTaskStatus,
      updateTask,
      deleteTask,
      bulkUpdateTasks,
      cleanDuplicateTasks,
      addTeamMember,
      updateTeamMember,
      deleteTeamMember,
      addExtraWork,
      updateExtraWork,
      deleteExtraWork,
      addDocument,
      deleteDocument,
      recordPunchIn,
      recordPunchOut,
      updateSettings,
      purgeAuditLogs,
      clientReminders,
      sendClientReminder,
      resolveClientReminder,
      officeStatus: officeShiftState.status,
      officeLoginTime: officeShiftState.loginTime,
      lunchStartTime: officeShiftState.lunchStartTime,
      totalLunchMinutesToday: officeShiftState.totalLunchMinutes,
      loginOffice,
      logoffOffice,
      startLunchBreak,
      endLunchBreak,
      resetAllData,
      fullAppReset,
      resetToBlankForGuestDemo,
      loadSampleForGuestDemo
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTasks must be used within a TaskProvider');
  return context;
};
