import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  writeBatch 
} from 'firebase/firestore';
import { firestoreDb, getSavedFirebaseConfig, initFirebase } from '../firebase/config';
import { Client, TaskItem, UserProfile, ExtraWorkItem, DocumentItem, AuditLog, SystemSettings, AttendanceRecord } from '../types';

export const FirebaseService = {
  isConfigured: (): boolean => {
    return !!getSavedFirebaseConfig();
  },

  // 1. Sync All Local Collections to Firebase Firestore Cloud
  syncAllToCloud: async (data: {
    clients: Client[];
    tasks: TaskItem[];
    team: UserProfile[];
    extraWork: ExtraWorkItem[];
    documents: DocumentItem[];
    attendanceRecords: AttendanceRecord[];
    settings: SystemSettings;
  }): Promise<{ success: boolean; message: string }> => {
    const { db } = initFirebase();
    if (!db) {
      throw new Error('Firebase is not configured. Please enter your Firebase project credentials in Cloud Settings.');
    }

    try {
      // A. Sync Clients
      for (const client of data.clients) {
        await setDoc(doc(db, 'clients', client.id), client);
      }

      // B. Sync Tasks
      for (const task of data.tasks) {
        await setDoc(doc(db, 'tasks', task.id), task);
      }

      // C. Sync Team
      for (const member of data.team) {
        await setDoc(doc(db, 'team', member.id), member);
      }

      // D. Sync Extra Work
      for (const item of data.extraWork) {
        await setDoc(doc(db, 'extraWork', item.id), item);
      }

      // E. Sync Attendance
      for (const att of data.attendanceRecords) {
        await setDoc(doc(db, 'attendance', att.id), att);
      }

      // F. Sync Settings
      await setDoc(doc(db, 'system', 'settings'), data.settings);

      return {
        success: true,
        message: `Successfully uploaded ${data.clients.length} clients, ${data.tasks.length} tasks & ${data.team.length} staff to Firebase Firestore!`
      };
    } catch (err: any) {
      console.error('Firebase sync error:', err);
      throw new Error(err.message || 'Failed to sync data to Firebase Cloud');
    }
  },

  // 2. Pull All Collections from Firebase Cloud
  pullAllFromCloud: async (): Promise<{
    clients: Client[];
    tasks: TaskItem[];
    team: UserProfile[];
    extraWork: ExtraWorkItem[];
    attendanceRecords: AttendanceRecord[];
    settings?: SystemSettings;
  }> => {
    const { db } = initFirebase();
    if (!db) {
      throw new Error('Firebase is not configured. Please enter your Firebase config.');
    }

    const clientsSnap = await getDocs(collection(db, 'clients'));
    const clients = clientsSnap.docs.map(d => d.data() as Client);

    const tasksSnap = await getDocs(collection(db, 'tasks'));
    const tasks = tasksSnap.docs.map(d => d.data() as TaskItem);

    const teamSnap = await getDocs(collection(db, 'team'));
    const team = teamSnap.docs.map(d => d.data() as UserProfile);

    const extraWorkSnap = await getDocs(collection(db, 'extraWork'));
    const extraWork = extraWorkSnap.docs.map(d => d.data() as ExtraWorkItem);

    const attSnap = await getDocs(collection(db, 'attendance'));
    const attendanceRecords = attSnap.docs.map(d => d.data() as AttendanceRecord);

    let settings: SystemSettings | undefined = undefined;
    try {
      const settingsSnap = await getDoc(doc(db, 'system', 'settings'));
      if (settingsSnap.exists()) {
        settings = settingsSnap.data() as SystemSettings;
      }
    } catch (e) {
      console.warn('Firebase settings pull note:', e);
    }

    return { clients, tasks, team, extraWork, attendanceRecords, settings };
  },

  // 3. Realtime Listener for Live Cross-Device Sync
  subscribeToCollection: <T>(
    collectionName: string, 
    onUpdate: (items: T[]) => void
  ) => {
    const { db } = initFirebase();
    if (!db) return () => {};

    const colRef = collection(db, collectionName);
    return onSnapshot(colRef, (snapshot) => {
      const items = snapshot.docs.map(doc => doc.data() as T);
      onUpdate(items);
    }, (error) => {
      console.warn(`Firebase realtime listener warning for ${collectionName}:`, error);
    });
  },

  // Single Item Upsert
  upsertDoc: async (collectionName: string, id: string, data: any) => {
    const { db } = initFirebase();
    if (!db) return;
    try {
      await setDoc(doc(db, collectionName, id), data, { merge: true });
    } catch (e) {
      console.warn(`Firebase upsert note (${collectionName}):`, e);
    }
  },

  // Single Item Delete
  deleteDoc: async (collectionName: string, id: string) => {
    const { db } = initFirebase();
    if (!db) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (e) {
      console.warn(`Firebase delete note (${collectionName}):`, e);
    }
  }
};
