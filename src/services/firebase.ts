/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Firebase Client Configuration & Service Initializer
 * Hardened environment variable resolution, strict validation, and priority management.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, doc, getDoc, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth, type User } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export interface FirebaseRuntimeConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

export type FirebaseConfigSource = 'environment' | 'localStorage' | 'none';

export const FIREBASE_ENV_KEYS = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
} as const;

export interface FirebaseConfigValidation {
  isComplete: boolean;
  source: FirebaseConfigSource;
  config: FirebaseRuntimeConfig | null;
  missingKeys: string[];
  error?: string;
}

const STORAGE_CONFIG_KEY = 'odiljon_qori_firebase_config';

// Primary authorized admin emails (fallbacks for initial bootstrapping before Firestore admin document creation)
export const AUTHORIZED_SUPER_ADMIN_EMAILS = [
  'mirzayevulugbek024@gmail.com',
];

/**
 * Reads configuration strictly from Vite environment variables (import.meta.env).
 * Without any fake or invented fallback values.
 */
export function getEnvFirebaseConfig(): Partial<FirebaseRuntimeConfig> {
  const apiKey = (import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
  const authDomain = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
  const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim();
  const storageBucket = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim();
  const messagingSenderId = (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim();
  const appId = (import.meta.env.VITE_FIREBASE_APP_ID || '').trim();

  const cfg: Partial<FirebaseRuntimeConfig> = {};
  if (apiKey) cfg.apiKey = apiKey;
  if (authDomain) cfg.authDomain = authDomain;
  if (projectId) cfg.projectId = projectId;
  if (storageBucket) cfg.storageBucket = storageBucket;
  if (messagingSenderId) cfg.messagingSenderId = messagingSenderId;
  if (appId) cfg.appId = appId;

  return cfg;
}

/**
 * Reads configuration saved locally in localStorage by the administrator.
 */
export function getLocalStorageFirebaseConfig(): Partial<FirebaseRuntimeConfig> | null {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          apiKey: (parsed.apiKey || '').trim() || undefined,
          authDomain: (parsed.authDomain || '').trim() || undefined,
          projectId: (parsed.projectId || '').trim() || undefined,
          storageBucket: (parsed.storageBucket || '').trim() || undefined,
          messagingSenderId: (parsed.messagingSenderId || '').trim() || undefined,
          appId: (parsed.appId || '').trim() || undefined,
        };
      }
    }
  } catch (e) {
    console.warn('Could not read firebase config from localStorage:', e);
  }
  return null;
}

/**
 * Validates which of the 6 required keys are missing.
 */
function checkMissingKeys(cfg: Partial<FirebaseRuntimeConfig> | null | undefined): string[] {
  if (!cfg) {
    return Object.values(FIREBASE_ENV_KEYS);
  }
  const missing: string[] = [];
  if (!cfg.apiKey) missing.push(FIREBASE_ENV_KEYS.apiKey);
  if (!cfg.authDomain) missing.push(FIREBASE_ENV_KEYS.authDomain);
  if (!cfg.projectId) missing.push(FIREBASE_ENV_KEYS.projectId);
  if (!cfg.storageBucket) missing.push(FIREBASE_ENV_KEYS.storageBucket);
  if (!cfg.messagingSenderId) missing.push(FIREBASE_ENV_KEYS.messagingSenderId);
  if (!cfg.appId) missing.push(FIREBASE_ENV_KEYS.appId);
  return missing;
}

/**
 * Establishes strict priority and validates configuration:
 * Priority 1: Environment Variables (Vite / AI Studio Secrets / .env).
 *             If environment variables are provided, they take precedence over stale localStorage.
 * Priority 2: Admin-saved localStorage (only used if environment variables are not set or incomplete).
 * Priority 3: Reports exact missing parameters without fabricating fake values.
 */
export function getFirebaseConfigValidation(): FirebaseConfigValidation {
  const envConfig = getEnvFirebaseConfig();
  const envMissing = checkMissingKeys(envConfig);

  const hasAnyEnv = Boolean(
    envConfig.projectId ||
    envConfig.apiKey ||
    envConfig.authDomain ||
    envConfig.storageBucket ||
    envConfig.messagingSenderId ||
    envConfig.appId
  );

  // 1. If environment variables are set and complete
  if (hasAnyEnv && envMissing.length === 0) {
    return {
      isComplete: true,
      source: 'environment',
      config: envConfig as FirebaseRuntimeConfig,
      missingKeys: [],
    };
  }

  // 2. If environment variables are partially set, check if localStorage was intentionally configured
  const localConfig = getLocalStorageFirebaseConfig();
  if (localConfig) {
    const localMissing = checkMissingKeys(localConfig);
    if (localMissing.length === 0) {
      return {
        isComplete: true,
        source: 'localStorage',
        config: localConfig as FirebaseRuntimeConfig,
        missingKeys: [],
      };
    }
  }

  // 3. If environment variables were partially provided, report which env keys are missing
  if (hasAnyEnv) {
    return {
      isComplete: false,
      source: 'environment',
      config: null,
      missingKeys: envMissing,
      error: `Firebase konfiguratsiyasi to'liq emas. Environment orqali quyidagi parametr(lar) yetishmayapti: ${envMissing.join(', ')}`,
    };
  }

  // 4. If localStorage was partially provided, report missing keys
  if (localConfig) {
    const localMissing = checkMissingKeys(localConfig);
    return {
      isComplete: false,
      source: 'localStorage',
      config: null,
      missingKeys: localMissing,
      error: `Brauzer xotirasi (localStorage) konfiguratsiyasi to'liq emas. Yetishmayotgan parametr(lar): ${localMissing.join(', ')}`,
    };
  }

  // 5. Neither is configured
  return {
    isComplete: false,
    source: 'none',
    config: null,
    missingKeys: Object.values(FIREBASE_ENV_KEYS),
    error: "Firebase konfiguratsiyasi kiritilmagan. Iltimos, .env fayli yoki Google AI Studio Secrets orqali barcha 6 ta VITE_FIREBASE_* parametrlarini belgilang.",
  };
}

/**
 * Returns active configuration for Admin UI view and forms.
 */
export function getStoredFirebaseConfig(): Partial<FirebaseRuntimeConfig> | null {
  const validation = getFirebaseConfigValidation();
  if (validation.config) return validation.config;
  const env = getEnvFirebaseConfig();
  if (Object.keys(env).length > 0) return env;
  return getLocalStorageFirebaseConfig();
}

export function saveStoredFirebaseConfig(config: Partial<FirebaseRuntimeConfig>): void {
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
  source: FirebaseConfigSource;
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
  error?: string;
  missingKeys?: string[];
} {
  const validation = getFirebaseConfigValidation();

  if (!validation.isComplete || !validation.config) {
    return {
      isConfigured: false,
      source: validation.source,
      app: null,
      db: null,
      auth: null,
      storage: null,
      error: validation.error,
      missingKeys: validation.missingKeys,
    };
  }

  const { config } = validation;

  try {
    if (!getApps().length) {
      appInstance = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
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
      source: validation.source,
      app: appInstance,
      db: dbInstance,
      auth: authInstance,
      storage: storageInstance,
    };
  } catch (err: any) {
    console.error('Firebase initialization error:', err);
    return {
      isConfigured: false,
      source: validation.source,
      app: null,
      db: null,
      auth: null,
      storage: null,
      error: `Firebase ishga tushirishda xatolik yuz berdi: ${err?.message || err}`,
      missingKeys: [],
    };
  }
}

// Initialized singletons
export const { 
  isConfigured: isFirebaseActive, 
  source: firebaseConfigSource,
  app, 
  db, 
  auth, 
  storage,
  error: firebaseConfigError,
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
