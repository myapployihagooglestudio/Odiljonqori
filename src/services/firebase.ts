/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Firebase Client Configuration
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

// Firebase configuration can come from environment variables or runtime configuration
export interface FirebaseRuntimeConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

// Check local storage or environment
export function getStoredFirebaseConfig(): FirebaseRuntimeConfig | null {
  try {
    const raw = localStorage.getItem('odiljon_qori_firebase_config');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read firebase config from storage', e);
  }

  // Fallback to import.meta.env if present
  if (import.meta.env.VITE_FIREBASE_PROJECT_ID) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
  }

  return null;
}

export function saveStoredFirebaseConfig(config: FirebaseRuntimeConfig): void {
  localStorage.setItem('odiljon_qori_firebase_config', JSON.stringify(config));
}

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

export function initFirebase(): {
  isConfigured: boolean;
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
} {
  const config = getStoredFirebaseConfig();

  if (!config || !config.projectId) {
    return {
      isConfigured: false,
      app: null,
      db: null,
      auth: null,
    };
  }

  try {
    if (!getApps().length) {
      appInstance = initializeApp({
        apiKey: config.apiKey || 'placeholder-key',
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

    return {
      isConfigured: true,
      app: appInstance,
      db: dbInstance,
      auth: authInstance,
    };
  } catch (err) {
    console.warn('Firebase initialization notice:', err);
    return {
      isConfigured: false,
      app: null,
      db: null,
      auth: null,
    };
  }
}

export const { isConfigured: isFirebaseActive, db, auth } = initFirebase();
