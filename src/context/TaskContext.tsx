import React, { createContext, useContext, useState, useEffect } from 'react';
import { Client, TaskItem, UserProfile, ExtraWorkItem, DocumentItem, AuditLog, SystemSettings, AttendanceRecord, TaskStatus, ClientReminder } from '../types';
import { StorageService } from '../services/storage';
import { FirebaseService } from '../services/firebaseService';
import { AudioService } from '../services/audioService';
import { GoogleDriveService } from '../services/googleDriveService';
import { detectEntityCategoryFromPANAndGSTIN } from '../utils/masterImportExport';

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
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Task actions
  addTask: (task: Omit<TaskItem, 'id'>) => TaskItem;
  updateTaskStatus: (taskId: string, status: TaskStatus, completedBy?: string) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  deleteTask: (id: string) => void;
  bulkUpdateTasks: (taskIds: string[], status: TaskStatus) => void;

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
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clients, setClients] = useState<Client[]>(() => StorageService.getClients());
  const [tasks, setTasks] = useState<TaskItem[]>(() => StorageService.getTasks());
  const [team, setTeam] = useState<UserProfile[]>(() => StorageService.getTeam());
  const [extraWork, setExtraWork] = useState<ExtraWorkItem[]>(() => StorageService.getExtraWork());
  const [documents, setDocuments] = useState<DocumentItem[]>(() => StorageService.getDocuments());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => StorageService.getAuditLogs());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => StorageService.getAttendance());
  const [clientReminders, setClientReminders] = useState<ClientReminder[]>(() => StorageService.getClientReminders());
  const [settings, setSettings] = useState<SystemSettings>(() => StorageService.getSettings());

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

  // Synchronize state changes to Storage
  useEffect(() => { StorageService.saveClients(clients); }, [clients]);
  useEffect(() => { StorageService.saveTasks(tasks); }, [tasks]);
  useEffect(() => { StorageService.saveTeam(team); }, [team]);
  useEffect(() => { StorageService.saveExtraWork(extraWork); }, [extraWork]);
  useEffect(() => { StorageService.saveDocuments(documents); }, [documents]);
  useEffect(() => { StorageService.saveAttendance(attendanceRecords); }, [attendanceRecords]);
  useEffect(() => { StorageService.saveSettings(settings); }, [settings]);
  useEffect(() => { StorageService.saveClientReminders(clientReminders); }, [clientReminders]);

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
    // 1. Check if client already exists by PAN, GSTIN, or Trade Name (NO DUPLICATES)
    const normPan = clientData.pan?.trim().toUpperCase();
    const normGst = clientData.gstin?.trim().toUpperCase();
    const normName = clientData.tradeName?.trim().toLowerCase();

    // 2. Accurately resolve statutory entity constitution / category
    const resolvedCategory = clientData.category && clientData.category !== 'PVT_LTD'
      ? clientData.category
      : detectEntityCategoryFromPANAndGSTIN(normPan, normGst, clientData.tradeName, clientData.legalName);

    const existingIndex = clients.findIndex(c => {
      if (normPan && normPan !== 'PAN-PENDING' && c.pan?.trim().toUpperCase() === normPan) return true;
      if (normGst && c.gstin?.trim().toUpperCase() === normGst) return true;
      if (normName && c.tradeName?.trim().toLowerCase() === normName) return true;
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
        googleDriveFolderUrl: clientData.googleDriveFolderUrl || existing.googleDriveFolderUrl
      };

      const updated = [...clients];
      updated[existingIndex] = merged;
      setClients(updated);

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
    
    // Auto generate standard recurring tasks for new client
    const sampleTasks: TaskItem[] = [
      {
        id: 'tsk-' + Date.now() + '-1',
        clientId: newClient.id,
        clientName: newClient.tradeName,
        title: 'Monthly TDS Payment (Challan 281)',
        category: 'TDS',
        frequency: 'MONTHLY',
        dueDayOrDate: '7',
        dueDate: '2026-09-07',
        status: 'PENDING',
        assignedTeamId: newClient.assignedTeamId,
        assignedTeamName: newClient.assignedTeamName,
        priority: 'HIGH',
        financialYear: '2026-2027',
      },
      {
        id: 'tsk-' + Date.now() + '-2',
        clientId: newClient.id,
        clientName: newClient.tradeName,
        title: 'GSTR-1 Monthly Outward Return',
        category: 'GST',
        frequency: 'MONTHLY',
        dueDayOrDate: '11',
        dueDate: '2026-09-11',
        status: 'PENDING',
        assignedTeamId: newClient.assignedTeamId,
        assignedTeamName: newClient.assignedTeamName,
        priority: 'CRITICAL',
        financialYear: '2026-2027',
      },
      {
        id: 'tsk-' + Date.now() + '-3',
        clientId: newClient.id,
        clientName: newClient.tradeName,
        title: 'GSTR-3B Monthly Return & Tax Settlement',
        category: 'GST',
        frequency: 'MONTHLY',
        dueDayOrDate: '20',
        dueDate: '2026-09-20',
        status: 'PENDING',
        assignedTeamId: newClient.assignedTeamId,
        assignedTeamName: newClient.assignedTeamName,
        priority: 'CRITICAL',
        financialYear: '2026-2027',
      }
    ];
    setTasks(prev => [...sampleTasks, ...prev]);

    StorageService.addAuditLog({
      actorId: 'admin',
      actorName: 'Admin',
      role: 'ADMIN',
      action: 'ADD_CLIENT',
      category: 'CLIENT',
      details: `Created new client: ${newClient.tradeName} (PAN: ${newClient.pan})`
    });
    setAuditLogs(StorageService.getAuditLogs());
    return newClient;
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    StorageService.addAuditLog({
      actorId: 'admin',
      actorName: 'Admin',
      role: 'ADMIN',
      action: 'UPDATE_CLIENT',
      category: 'CLIENT',
      details: `Updated details for client ID ${id}`
    });
    setAuditLogs(StorageService.getAuditLogs());
  };

  const deleteClient = (id: string) => {
    const target = clients.find(c => c.id === id);
    setClients(prev => prev.filter(c => c.id !== id));
    setTasks(prev => prev.filter(t => t.clientId !== id));
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
  const addTask = (taskData: Omit<TaskItem, 'id'>): TaskItem => {
    const newTask: TaskItem = {
      ...taskData,
      id: 'tsk-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    };
    setTasks(prev => [newTask, ...prev]);
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

  const updateTaskStatus = (taskId: string, status: TaskStatus, completedBy = 'User') => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const isDone = status === 'DONE';
        if (isDone) AudioService.playSuccessSound();
        return {
          ...t,
          status,
          completedAt: isDone ? new Date().toISOString() : undefined,
          completedBy: isDone ? completedBy : undefined
        };
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
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const bulkUpdateTasks = (taskIds: string[], status: TaskStatus) => {
    setTasks(prev => prev.map(t => taskIds.includes(t.id) ? { ...t, status, completedAt: status === 'DONE' ? new Date().toISOString() : undefined } : t));
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
    setSettings((prev: SystemSettings) => ({ ...prev, ...updates }));
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
    setSettings(StorageService.getSettings());
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
      updateClient,
      deleteClient,
      addTask,
      updateTaskStatus,
      updateTask,
      deleteTask,
      bulkUpdateTasks,
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
      resetAllData
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
