/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Firebase Client Configuration & Service Initializer
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, doc, getDoc, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth, type User } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export interface FirebaseRuntimeConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

const STORAGE_CONFIG_KEY = 'odiljon_qori_firebase_config';

// Primary authorized admin emails (fallbacks for initial bootstrapping before Firestore admin document creation)
export const AUTHORIZED_SUPER_ADMIN_EMAILS = [
  'mirzayevulugbek024@gmail.com',
];

/**
 * Reads stored Firebase configuration from localStorage or Vite environment variables.
 */
export function getStoredFirebaseConfig(): FirebaseRuntimeConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.projectId && parsed.apiKey) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read firebase config from storage', e);
  }

  // Fallback to Vite environment variables if present
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (envProjectId) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${envProjectId}.appspot.com`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_Sender_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };
  }

  return null;
}

export function saveStoredFirebaseConfig(config: FirebaseRuntimeConfig): void {
  localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
}

export function clearStoredFirebaseConfig(): void {
  localStorage.removeItem(STORAGE_CONFIG_KEY);
}

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;

export function initFirebase(): {
  isConfigured: boolean;
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
} {
  const config = getStoredFirebaseConfig();

  if (!config || !config.projectId || !config.apiKey) {
    return {
      isConfigured: false,
      app: null,
      db: null,
      auth: null,
      storage: null,
    };
  }

  try {
    if (!getApps().length) {
      appInstance = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
        projectId: config.projectId,
        storageBucket: config.storageBucket || `${config.projectId}.appspot.com`,
        messagingSenderId: config.messagingSenderId || '123456789',
        appId: config.appId || '1:123456789:web:abcdef',
      });
    } else {
      appInstance = getApp();
    }

    if (!dbInstance && appInstance) {
      dbInstance = getFirestore(appInstance);
    }

    if (!authInstance && appInstance) {
      authInstance = getAuth(appInstance);
    }

    if (!storageInstance && appInstance) {
      storageInstance = getStorage(appInstance, config.storageBucket);
    }

    return {
      isConfigured: true,
      app: appInstance,
      db: dbInstance,
      auth: authInstance,
      storage: storageInstance,
    };
  } catch (err) {
    console.error('Firebase initialization error:', err);
    return {
      isConfigured: false,
      app: null,
      db: null,
      auth: null,
      storage: null,
    };
  }
}

// Initialized singletons
export const { 
  isConfigured: isFirebaseActive, 
  app, 
  db, 
  auth, 
  storage 
} = initFirebase();

/**
 * Verifies whether the given user has verified administrator privileges:
 * 1. Checks if a document exists in /admins/{uid} in Firestore
 * 2. Checks if the user's email matches the verified master admin list
 * Never grants admin rights via client-side localStorage.
 */
export async function checkIsUserAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;

  // 1. Check verified email
  if (user.email && AUTHORIZED_SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return true;
  }

  // 2. Check Firestore /admins/{uid} collection
  if (db) {
    try {
      const adminDocRef = doc(db, 'admins', user.uid);
      const adminSnap = await getDoc(adminDocRef);
      if (adminSnap.exists() && adminSnap.data()?.isActive === true) {
        return true;
      }
    } catch (e) {
      console.warn('Error verifying admin document in Firestore:', e);
    }
  }

  return false;
}
