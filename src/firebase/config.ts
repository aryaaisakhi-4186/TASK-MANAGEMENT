import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

export interface FirebaseCustomConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

const STORAGE_KEY = 'taskvaani_firebase_config_v1';

export const getSavedFirebaseConfig = (): FirebaseCustomConfig | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.projectId && parsed.apiKey) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading saved Firebase config:', e);
  }

  // Fallback to import.meta.env
  const envConfig: FirebaseCustomConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
  };

  if (envConfig.projectId && envConfig.apiKey) {
    return envConfig;
  }

  return null;
};

export const saveFirebaseConfig = (config: FirebaseCustomConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

export const removeFirebaseConfig = () => {
  localStorage.removeItem(STORAGE_KEY);
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export const initFirebase = (customConfig?: FirebaseCustomConfig): { app: FirebaseApp | null; db: Firestore | null; auth: Auth | null } => {
  const config = customConfig || getSavedFirebaseConfig();

  if (!config || !config.projectId || !config.apiKey) {
    return { app: null, db: null, auth: null };
  }

  try {
    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }

    db = getFirestore(app);
    auth = getAuth(app);

    return { app, db, auth };
  } catch (error) {
    console.warn('Firebase initialization note:', error);
    return { app: null, db: null, auth: null };
  }
};

// Initial run
const initialized = initFirebase();
export const firebaseApp = initialized.app;
export const firestoreDb = initialized.db;
export const firebaseAuth = initialized.auth;
