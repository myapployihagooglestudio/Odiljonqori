/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Single Permanent Administrator Authentication Client Service
 */

import { signInWithCustomToken, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, FIXED_ADMIN_UID } from './firebase';

const SESSION_STORAGE_KEY = 'odiljon_qori_admin_session_v2';

export interface VerifiedAdminIdentity {
  uid: string;
  username: string;
  role: 'admin';
  isActive: boolean;
  expiresAt: number;
  firebaseAdminReady?: boolean;
  firebaseDiagnostic?: string;
}

export interface AdminLoginResult {
  authenticated: boolean;
  admin?: VerifiedAdminIdentity;
  error?: string;
  message?: string;
}

export interface AdminSessionCheckResult {
  authenticated: boolean;
  expired?: boolean;
  admin?: VerifiedAdminIdentity;
  error?: string;
}

function saveSessionToken(sessionToken: string, expiresAt: number): void {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      sessionToken,
      expiresAt,
    })
  );
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function readStoredSession(): { sessionToken: string; expiresAt: number } | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.sessionToken !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Synchronizes Firebase Client Auth using the server-issued Custom Token
 * and ensures the active administrator record exists in Firestore.
 */
async function syncFirebaseCustomToken(
  customToken: string | null | undefined,
  username: string
): Promise<void> {
  if (!customToken || !auth) return;

  try {
    const cred = await signInWithCustomToken(auth, customToken);
    if (db && cred.user.uid === FIXED_ADMIN_UID) {
      await setDoc(
        doc(db, 'admins', FIXED_ADMIN_UID),
        {
          uid: FIXED_ADMIN_UID,
          username,
          role: 'admin',
          isActive: true,
          permanent: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch(() => {});
    }
  } catch (err) {
    console.warn('Firebase Custom Token sign-in notice:', err);
  }
}

/**
 * Authenticates the single permanent administrator against the backend server (/api/admin/login).
 * Never exposes or stores plaintext passwords.
 */
export async function loginPermanentAdmin(
  username: string,
  password: string
): Promise<AdminLoginResult> {
  const cleanUsername = username.trim();
  if (!cleanUsername || !password) {
    return {
      authenticated: false,
      error: 'Foydalanuvchi nomi va parol kiritilishi shart.',
    };
  }

  try {
    const resp = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: cleanUsername,
        password,
      }),
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok || !data || data.authenticated !== true) {
      return {
        authenticated: false,
        error:
          data?.error ||
          (resp.status === 401
            ? "Foydalanuvchi nomi yoki maxfiy parol noto'g'ri."
            : `Server bilan aloqa xatoligi (${resp.status}).`),
      };
    }

    saveSessionToken(data.sessionToken, data.expiresAt);

    // If Firebase Custom Token was minted by server, sign in on Firebase Client SDK
    if (data.firebaseCustomToken) {
      await syncFirebaseCustomToken(data.firebaseCustomToken, data.admin.username);
    }

    return {
      authenticated: true,
      message: data.message || 'Tizimga muvaffaqiyatli kirdingiz.',
      admin: {
        uid: data.admin.uid,
        username: data.admin.username,
        role: 'admin',
        isActive: true,
        expiresAt: data.expiresAt,
        firebaseAdminReady: data.firebaseAdminReady,
        firebaseDiagnostic: data.firebaseDiagnostic,
      },
    };
  } catch (err: any) {
    return {
      authenticated: false,
      error: `Server bilan ulanishda xatolik yuz berdi: ${err?.message || 'Tarmoq xatosi'}`,
    };
  }
}

/**
 * Validates the current administrator session with the backend server (/api/admin/session).
 * Handles session expiry, revocation, and automatic Firebase Custom Token restoration on page refresh.
 */
export async function verifyPermanentAdminSession(): Promise<AdminSessionCheckResult> {
  const stored = readStoredSession();
  if (!stored) {
    return {
      authenticated: false,
    };
  }

  if (Date.now() > stored.expiresAt) {
    clearSessionToken();
    if (auth?.currentUser) {
      await signOut(auth).catch(() => {});
    }
    return {
      authenticated: false,
      expired: true,
      error: 'Sessiya muddati tugadi. Iltimos, qaytadan tizimga kiring.',
    };
  }

  try {
    const needsFbToken = Boolean(auth && auth.currentUser?.uid !== FIXED_ADMIN_UID);
    const url = needsFbToken
      ? '/api/admin/session?refreshFirebaseToken=1'
      : '/api/admin/session';

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${stored.sessionToken}`,
      },
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok || !data || data.authenticated !== true) {
      clearSessionToken();
      if (auth?.currentUser) {
        await signOut(auth).catch(() => {});
      }
      const isExpired = data?.reason === 'session_expired';
      return {
        authenticated: false,
        expired: isExpired,
        error:
          data?.error ||
          (isExpired
            ? 'Sessiya muddati tugadi. Iltimos, qaytadan tizimga kiring.'
            : undefined),
      };
    }

    if (data.firebaseCustomToken && (!auth?.currentUser || auth.currentUser.uid !== FIXED_ADMIN_UID)) {
      await syncFirebaseCustomToken(data.firebaseCustomToken, data.admin.username);
    }

    return {
      authenticated: true,
      admin: {
        uid: data.admin.uid,
        username: data.admin.username,
        role: 'admin',
        isActive: true,
        expiresAt: data.expiresAt,
        firebaseAdminReady: data.firebaseAdminReady,
        firebaseDiagnostic: data.firebaseDiagnostic,
      },
    };
  } catch (err: any) {
    return {
      authenticated: false,
      error: `Server bilan aloqa uzildi: ${err?.message || 'Tarmoq xatosi'}`,
    };
  }
}

/**
 * Logs out the administrator, revokes the session on the server, and signs out of Firebase Auth.
 */
export async function logoutPermanentAdmin(): Promise<void> {
  const stored = readStoredSession();
  clearSessionToken();

  try {
    if (stored?.sessionToken) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stored.sessionToken}`,
        },
      });
    }
  } catch {
    // Ignore network error during logout
  }

  if (auth?.currentUser) {
    await signOut(auth).catch(() => {});
  }
}
