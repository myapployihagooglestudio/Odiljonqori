/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Firebase Client Configuration, Dynamic Lifecycle & Single Admin Verifier
 */

import {
  initializeApp,
  getApps,
  getApp,
  deleteApp,
  type FirebaseApp,
} from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { getAuth, type Auth, type User } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export const FIXED_ADMIN_UID = 'odiljon-qori-permanent-admin';

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
  isValidFormat: boolean;
  source: FirebaseConfigSource;
  config: FirebaseRuntimeConfig | null;
  missingKeys: string[];
  invalidKeys: string[];
  error?: string;
}

const STORAGE_CONFIG_KEY = 'odiljon_qori_firebase_config';

// Server runtime environment cache (populated from /api/firebase-config if needed)
let serverRuntimeEnvConfig: Partial<FirebaseRuntimeConfig> | null = null;

/**
 * Rejects placeholder or dummy strings so they can never be mistaken for real credentials.
 */
export function isPlaceholderValue(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return true;
  const v = val.trim();
  if (!v) return true;
  const lower = v.toLowerCase();
  if (
    lower.includes('your-project-id') ||
    lower.includes('aizasyxxxxxx') ||
    lower.startsWith('my_') ||
    lower.includes('placeholder') ||
    lower.includes('example') ||
    v === '123456789012' ||
    v === '123456789' ||
    lower.includes('abcdef123456') ||
    v.startsWith('<')
  ) {
    return true;
  }
  return false;
}

function cleanValue(val?: string | null): string {
  if (!val || isPlaceholderValue(val)) return '';
  return val.trim();
}

/**
 * Reads configuration strictly from Vite environment variables (import.meta.env)
 * and runtime server environment (if fetched from /api/firebase-config).
 */
export function getEnvFirebaseConfig(): Partial<FirebaseRuntimeConfig> {
  const apiKey =
    cleanValue(import.meta.env.VITE_FIREBASE_API_KEY) ||
    cleanValue(serverRuntimeEnvConfig?.apiKey);
  const authDomain =
    cleanValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) ||
    cleanValue(serverRuntimeEnvConfig?.authDomain);
  const projectId =
    cleanValue(import.meta.env.VITE_FIREBASE_PROJECT_ID) ||
    cleanValue(serverRuntimeEnvConfig?.projectId);
  const storageBucket =
    cleanValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) ||
    cleanValue(serverRuntimeEnvConfig?.storageBucket);
  const messagingSenderId =
    cleanValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
    cleanValue(serverRuntimeEnvConfig?.messagingSenderId);
  const appId =
    cleanValue(import.meta.env.VITE_FIREBASE_APP_ID) ||
    cleanValue(serverRuntimeEnvConfig?.appId);

  const cfg: Partial<FirebaseRuntimeConfig> = {};
  if (apiKey) cfg.apiKey = apiKey;
  if (authDomain) cfg.authDomain = authDomain;
  if (projectId) cfg.projectId = projectId;
  if (storageBucket) cfg.storageBucket = storageBucket;
  if (messagingSenderId) cfg.messagingSenderId = messagingSenderId;
  if (appId) cfg.appId = appId;

  return cfg;
}

interface StoredLocalConfig extends Partial<FirebaseRuntimeConfig> {
  explicitAdminOverride?: boolean;
  savedAt?: number;
}

/**
 * Reads configuration saved in localStorage by the administrator.
 */
export function getLocalStorageFirebaseConfig(): StoredLocalConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        const cleaned: StoredLocalConfig = {
          apiKey: cleanValue(parsed.apiKey) || undefined,
          authDomain: cleanValue(parsed.authDomain) || undefined,
          projectId: cleanValue(parsed.projectId) || undefined,
          storageBucket: cleanValue(parsed.storageBucket) || undefined,
          messagingSenderId: cleanValue(parsed.messagingSenderId) || undefined,
          appId: cleanValue(parsed.appId) || undefined,
          explicitAdminOverride: Boolean(parsed.explicitAdminOverride),
          savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : undefined,
        };
        const hasAnyValue = Boolean(
          cleaned.apiKey ||
            cleaned.authDomain ||
            cleaned.projectId ||
            cleaned.storageBucket ||
            cleaned.messagingSenderId ||
            cleaned.appId
        );
        if (hasAnyValue || cleaned.explicitAdminOverride) {
          return cleaned;
        }
      }
    }
  } catch (e) {
    console.warn('Could not read firebase config from localStorage:', e);
  }
  return null;
}

/**
 * Checks which of the 6 required keys are missing.
 */
export function checkMissingKeys(
  cfg: Partial<FirebaseRuntimeConfig> | null | undefined
): string[] {
  if (!cfg) {
    return Object.values(FIREBASE_ENV_KEYS);
  }
  const missing: string[] = [];
  if (!cleanValue(cfg.apiKey)) missing.push(FIREBASE_ENV_KEYS.apiKey);
  if (!cleanValue(cfg.authDomain)) missing.push(FIREBASE_ENV_KEYS.authDomain);
  if (!cleanValue(cfg.projectId)) missing.push(FIREBASE_ENV_KEYS.projectId);
  if (!cleanValue(cfg.storageBucket)) missing.push(FIREBASE_ENV_KEYS.storageBucket);
  if (!cleanValue(cfg.messagingSenderId)) missing.push(FIREBASE_ENV_KEYS.messagingSenderId);
  if (!cleanValue(cfg.appId)) missing.push(FIREBASE_ENV_KEYS.appId);
  return missing;
}

/**
 * Checks if any provided keys have an invalid credential format.
 */
export function checkInvalidFormatKeys(
  cfg: Partial<FirebaseRuntimeConfig> | null | undefined
): { invalidKeys: string[]; reason?: string } {
  if (!cfg) return { invalidKeys: [] };
  const invalidKeys: string[] = [];
  const reasons: string[] = [];

  if (cfg.apiKey && (!cfg.apiKey.startsWith('AIza') || cfg.apiKey.length < 25)) {
    invalidKeys.push(FIREBASE_ENV_KEYS.apiKey);
    reasons.push("VITE_FIREBASE_API_KEY noto'g'ri formatda ('AIza...' bilan boshlanishi shart)");
  }

  if (cfg.projectId && !/^[a-z0-9-]+$/i.test(cfg.projectId)) {
    invalidKeys.push(FIREBASE_ENV_KEYS.projectId);
    reasons.push("VITE_FIREBASE_PROJECT_ID faqat harf, raqam va chiziqchadan iborat bo'lishi kerak");
  }

  if (cfg.authDomain && !cfg.authDomain.includes('.')) {
    invalidKeys.push(FIREBASE_ENV_KEYS.authDomain);
    reasons.push("VITE_FIREBASE_AUTH_DOMAIN domen formatida bo'lishi kerak (masalan: project.firebaseapp.com)");
  }

  if (cfg.storageBucket && !cfg.storageBucket.includes('.')) {
    invalidKeys.push(FIREBASE_ENV_KEYS.storageBucket);
    reasons.push("VITE_FIREBASE_STORAGE_BUCKET bucket formatida bo'lishi kerak (masalan: project.appspot.com)");
  }

  if (cfg.messagingSenderId && !/^\d+$/.test(cfg.messagingSenderId)) {
    invalidKeys.push(FIREBASE_ENV_KEYS.messagingSenderId);
    reasons.push("VITE_FIREBASE_MESSAGING_SENDER_ID faqat raqamlardan iborat bo'lishi kerak");
  }

  if (cfg.appId && !cfg.appId.includes(':')) {
    invalidKeys.push(FIREBASE_ENV_KEYS.appId);
    reasons.push("VITE_FIREBASE_APP_ID haqiqiy Firebase App ID formatida bo'lishi kerak (masalan: 1:...:web:...)");
  }

  return {
    invalidKeys,
    reason: reasons.length > 0 ? reasons.join('; ') : undefined,
  };
}

/**
 * Validates and resolves the active Firebase configuration with clear priority:
 * 1. If the Admin explicitly saved a configuration in the Admin Panel (`explicitAdminOverride: true`),
 *    validate that exact saved configuration so Admin changes take effect immediately without stale values.
 * 2. Otherwise, if Environment Variables (Vite / AI Studio Secrets) are present, validate and use them
 *    (preventing stale legacy localStorage from overriding environment config).
 * 3. Fallback to localStorage if present.
 */
export function getFirebaseConfigValidation(): FirebaseConfigValidation {
  const envConfig = getEnvFirebaseConfig();
  const envMissing = checkMissingKeys(envConfig);
  const hasAnyEnv = Object.keys(envConfig).length > 0;

  const localConfig = getLocalStorageFirebaseConfig();

  // Case 1: Admin explicitly saved configuration in Admin Panel
  if (localConfig && localConfig.explicitAdminOverride) {
    const localMissing = checkMissingKeys(localConfig);
    if (localMissing.length > 0) {
      return {
        isComplete: false,
        isValidFormat: false,
        source: 'localStorage',
        config: null,
        missingKeys: localMissing,
        invalidKeys: [],
        error: `Admin panelda kiritilgan Firebase konfiguratsiyasi to'liq emas. Yetishmayotgan maydonlar: ${localMissing.join(', ')}`,
      };
    }

    const formatCheck = checkInvalidFormatKeys(localConfig);
    if (formatCheck.invalidKeys.length > 0) {
      return {
        isComplete: true,
        isValidFormat: false,
        source: 'localStorage',
        config: null,
        missingKeys: [],
        invalidKeys: formatCheck.invalidKeys,
        error: `Yaroqsiz Firebase kalitlari: ${formatCheck.reason}`,
      };
    }

    return {
      isComplete: true,
      isValidFormat: true,
      source: 'localStorage',
      config: {
        apiKey: localConfig.apiKey!,
        authDomain: localConfig.authDomain!,
        projectId: localConfig.projectId!,
        storageBucket: localConfig.storageBucket!,
        messagingSenderId: localConfig.messagingSenderId!,
        appId: localConfig.appId!,
      },
      missingKeys: [],
      invalidKeys: [],
    };
  }

  // Case 2: Environment configuration is complete
  if (hasAnyEnv && envMissing.length === 0) {
    const formatCheck = checkInvalidFormatKeys(envConfig);
    if (formatCheck.invalidKeys.length > 0) {
      return {
        isComplete: true,
        isValidFormat: false,
        source: 'environment',
        config: null,
        missingKeys: [],
        invalidKeys: formatCheck.invalidKeys,
        error: `Environment orqali berilgan Firebase kalitlari yaroqsiz: ${formatCheck.reason}`,
      };
    }

    return {
      isComplete: true,
      isValidFormat: true,
      source: 'environment',
      config: envConfig as FirebaseRuntimeConfig,
      missingKeys: [],
      invalidKeys: [],
    };
  }

  // Case 3: LocalStorage has a complete non-override config
  if (localConfig) {
    const localMissing = checkMissingKeys(localConfig);
    if (localMissing.length === 0) {
      const formatCheck = checkInvalidFormatKeys(localConfig);
      if (formatCheck.invalidKeys.length > 0) {
        return {
          isComplete: true,
          isValidFormat: false,
          source: 'localStorage',
          config: null,
          missingKeys: [],
          invalidKeys: formatCheck.invalidKeys,
          error: `Yaroqsiz Firebase kalitlari: ${formatCheck.reason}`,
        };
      }

      return {
        isComplete: true,
        isValidFormat: true,
        source: 'localStorage',
        config: {
          apiKey: localConfig.apiKey!,
          authDomain: localConfig.authDomain!,
          projectId: localConfig.projectId!,
          storageBucket: localConfig.storageBucket!,
          messagingSenderId: localConfig.messagingSenderId!,
          appId: localConfig.appId!,
        },
        missingKeys: [],
        invalidKeys: [],
      };
    }
  }

  // Case 4: Partial environment configuration -> report exact missing env keys
  if (hasAnyEnv) {
    return {
      isComplete: false,
      isValidFormat: false,
      source: 'environment',
      config: null,
      missingKeys: envMissing,
      invalidKeys: [],
      error: `Firebase konfiguratsiyasi to'liq emas. Environment orqali quyidagi parametr(lar) yetishmayapti: ${envMissing.join(', ')}`,
    };
  }

  // Case 5: Partial localStorage configuration -> report exact missing keys
  if (localConfig) {
    const localMissing = checkMissingKeys(localConfig);
    return {
      isComplete: false,
      isValidFormat: false,
      source: 'localStorage',
      config: null,
      missingKeys: localMissing,
      invalidKeys: [],
      error: `Brauzer xotirasi (localStorage) konfiguratsiyasi to'liq emas. Yetishmayotgan parametr(lar): ${localMissing.join(', ')}`,
    };
  }

  // Case 6: No configuration present anywhere
  return {
    isComplete: false,
    isValidFormat: false,
    source: 'none',
    config: null,
    missingKeys: Object.values(FIREBASE_ENV_KEYS),
    invalidKeys: [],
    error:
      "Firebase konfiguratsiyasi kiritilmagan. Yetishmayotgan maydonlar: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID",
  };
}

/**
 * Returns current config values to populate Admin UI inputs.
 */
export function getStoredFirebaseConfig(): Partial<FirebaseRuntimeConfig> | null {
  const local = getLocalStorageFirebaseConfig();
  if (local && local.explicitAdminOverride) {
    return local;
  }
  const validation = getFirebaseConfigValidation();
  if (validation.config) return validation.config;
  const env = getEnvFirebaseConfig();
  if (Object.keys(env).length > 0) return env;
  return local;
}

// ============================================================================
// FIREBASE DYNAMIC LIFECYCLE & LIVE BINDINGS
// ============================================================================

export let isFirebaseActive: boolean = false;
export let firebaseConfigSource: FirebaseConfigSource = 'none';
export let app: FirebaseApp | null = null;
export let db: Firestore | null = null;
export let auth: Auth | null = null;
export let storage: FirebaseStorage | null = null;
export let firebaseConfigError: string | undefined = undefined;
export let firebaseMissingKeys: string[] = [];

type FirebaseLifecycleListener = () => void;
const lifecycleListeners = new Set<FirebaseLifecycleListener>();

export function onFirebaseLifecycleChange(listener: FirebaseLifecycleListener): () => void {
  lifecycleListeners.add(listener);
  return () => {
    lifecycleListeners.delete(listener);
  };
}

function notifyLifecycleListeners(): void {
  lifecycleListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('Firebase lifecycle listener error:', e);
    }
  });
}

/**
 * Synchronous initialization (used on initial module load).
 * Initializes App, Firestore, Auth, and Storage on the exact same FirebaseApp instance.
 */
export function initFirebase(): {
  isConfigured: boolean;
  source: FirebaseConfigSource;
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
  error?: string;
  missingKeys: string[];
} {
  const validation = getFirebaseConfigValidation();

  if (!validation.isComplete || !validation.isValidFormat || !validation.config) {
    isFirebaseActive = false;
    firebaseConfigSource = validation.source;
    app = null;
    db = null;
    auth = null;
    storage = null;
    firebaseConfigError = validation.error;
    firebaseMissingKeys = validation.missingKeys;
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
    const firebaseApp =
      getApps().length === 0
        ? initializeApp({
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
            storageBucket: config.storageBucket,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
          })
        : getApp();

    const firestoreInstance = getFirestore(firebaseApp);
    const authInstance = getAuth(firebaseApp);
    const bucketUrl = config.storageBucket.startsWith('gs://')
      ? config.storageBucket
      : `gs://${config.storageBucket}`;
    const storageInstance = getStorage(firebaseApp, bucketUrl);

    isFirebaseActive = true;
    firebaseConfigSource = validation.source;
    app = firebaseApp;
    db = firestoreInstance;
    auth = authInstance;
    storage = storageInstance;
    firebaseConfigError = undefined;
    firebaseMissingKeys = [];

    return {
      isConfigured: true,
      source: validation.source,
      app: firebaseApp,
      db: firestoreInstance,
      auth: authInstance,
      storage: storageInstance,
      missingKeys: [],
    };
  } catch (err: any) {
    console.error('Firebase initialization error:', err);
    const errMsg = `Firebase ishga tushirishda xatolik: ${err?.message || String(err)}`;
    isFirebaseActive = false;
    firebaseConfigSource = validation.source;
    app = null;
    db = null;
    auth = null;
    storage = null;
    firebaseConfigError = errMsg;
    firebaseMissingKeys = [];

    return {
      isConfigured: false,
      source: validation.source,
      app: null,
      db: null,
      auth: null,
      storage: null,
      error: errMsg,
      missingKeys: [],
    };
  }
}

/**
 * Dynamically tears down any existing FirebaseApp instance and re-initializes
 * Firebase App, Firestore, Auth, and Storage from the latest configuration.
 * Ensures zero stale configuration after Admin saves or resets settings.
 */
export async function reinitializeFirebase(): Promise<{
  isConfigured: boolean;
  source: FirebaseConfigSource;
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
  error?: string;
  missingKeys: string[];
}> {
  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      await Promise.all(existingApps.map((a) => deleteApp(a).catch(() => {})));
    }
  } catch (e) {
    console.warn('Error tearing down previous Firebase app instance:', e);
  }

  app = null;
  db = null;
  auth = null;
  storage = null;
  isFirebaseActive = false;

  const result = initFirebase();
  notifyLifecycleListeners();
  return result;
}

/**
 * Saves configuration from Admin Panel and immediately reinitializes Firebase.
 */
export async function saveStoredFirebaseConfig(
  config: Partial<FirebaseRuntimeConfig>
): Promise<{
  isConfigured: boolean;
  error?: string;
  missingKeys: string[];
}> {
  const payload: StoredLocalConfig = {
    apiKey: cleanValue(config.apiKey),
    authDomain: cleanValue(config.authDomain),
    projectId: cleanValue(config.projectId),
    storageBucket: cleanValue(config.storageBucket),
    messagingSenderId: cleanValue(config.messagingSenderId),
    appId: cleanValue(config.appId),
    explicitAdminOverride: true,
    savedAt: Date.now(),
  };

  localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(payload));
  const res = await reinitializeFirebase();
  return {
    isConfigured: res.isConfigured,
    error: res.error,
    missingKeys: res.missingKeys,
  };
}

/**
 * Clears localStorage override and immediately reinitializes Firebase from environment.
 */
export async function clearStoredFirebaseConfig(): Promise<void> {
  localStorage.removeItem(STORAGE_CONFIG_KEY);
  await reinitializeFirebase();
}

/**
 * Hydrates runtime environment variables from the backend (/api/firebase-config)
 * if build-time import.meta.env was not populated (e.g., Cloud Run runtime secrets).
 */
export async function syncServerFirebaseConfig(): Promise<void> {
  try {
    const resp = await fetch('/api/firebase-config');
    if (!resp.ok) return;
    const data = await resp.json();
    if (data && data.config) {
      const hasServerValues = Object.values(data.config).some((v) => Boolean(v));
      if (hasServerValues) {
        serverRuntimeEnvConfig = data.config;
        const local = getLocalStorageFirebaseConfig();
        if (!local?.explicitAdminOverride) {
          await reinitializeFirebase();
        }
      }
    }
  } catch {
    // Ignore network error during static preview
  }
}

// Initial boot execution
initFirebase();
if (typeof window !== 'undefined') {
  syncServerFirebaseConfig();
}

// ============================================================================
// SINGLE PERMANENT ADMIN AUTHORIZATION CHECK
// ============================================================================

const SESSION_STORAGE_KEY = 'odiljon_qori_admin_session_v2';

export function getStoredAdminSessionToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.sessionToken || !parsed.expiresAt) return null;
    if (Date.now() > Number(parsed.expiresAt)) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed.sessionToken;
  } catch {
    return null;
  }
}

/**
 * Verifies whether the current session belongs to the single permanent administrator:
 * 1. Verifies the cryptographic session token directly with the backend (/api/admin/session).
 * 2. If a Firebase Auth user is passed or active, verifies uid === FIXED_ADMIN_UID ('odiljon-qori-permanent-admin').
 * 3. If Firestore is connected and Firebase Auth is signed in, ensures /admins/odiljon-qori-permanent-admin is active.
 * Never grants admin privileges based on email lists or unverified client flags.
 */
export async function checkIsUserAdmin(user?: User | null): Promise<boolean> {
  // 1. If a Firebase User exists and its UID is NOT the single permanent admin UID, reject immediately
  const activeFbUser = user ?? auth?.currentUser ?? null;
  if (activeFbUser && activeFbUser.uid !== FIXED_ADMIN_UID) {
    return false;
  }

  // 2. Verify session with backend server
  const token = getStoredAdminSessionToken();
  if (!token) {
    return false;
  }

  try {
    const resp = await fetch('/api/admin/session', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!resp.ok) {
      if (resp.status === 401) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
      return false;
    }

    const data = await resp.json();
    if (
      !data ||
      data.authenticated !== true ||
      data.admin?.uid !== FIXED_ADMIN_UID ||
      data.admin?.role !== 'admin'
    ) {
      return false;
    }

    // 3. If Firestore & Firebase Auth are active, verify/sync /admins/odiljon-qori-permanent-admin
    if (db && activeFbUser && activeFbUser.uid === FIXED_ADMIN_UID) {
      try {
        const adminDocRef = doc(db, 'admins', FIXED_ADMIN_UID);
        const adminSnap = await getDoc(adminDocRef);
        if (!adminSnap.exists()) {
          await setDoc(adminDocRef, {
            uid: FIXED_ADMIN_UID,
            username: data.admin.username,
            role: 'admin',
            isActive: true,
            permanent: true,
            updatedAt: new Date().toISOString(),
          });
          return true;
        }
        const docData = adminSnap.data();
        return docData?.isActive === true && docData?.role === 'admin';
      } catch (e) {
        console.warn('Firestore admin document check notice:', e);
      }
    }

    return true;
  } catch (err) {
    console.error('Server admin session check failed:', err);
    return false;
  }
}
