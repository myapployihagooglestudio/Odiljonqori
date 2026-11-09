/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Secure Backend Server & Permanent Single Admin Auth
 */

import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PORT = Number(process.env.PORT) || 3000;
export const FIXED_ADMIN_UID = 'odiljon-qori-permanent-admin';

// Session configuration: 12 hours validity
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = 'odiljon_admin_session';

// Derive server signing secret (never exposed to client)
const SERVER_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(
      `odiljon-qori-session-${process.env.ADMIN_INITIAL_USERNAME || ''}-${process.env.ADMIN_INITIAL_PASSWORD || ''}-v2`
    )
    .digest('hex');

const SCRYPT_SALT = crypto
  .createHash('sha256')
  .update(`odiljon-qori-salt-${SERVER_SESSION_SECRET}`)
  .digest()
  .subarray(0, 16);

function hashSecretValue(value: string): Buffer {
  return crypto.scryptSync(value, SCRYPT_SALT, 64);
}

function safeCompareSecret(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const providedHash = hashSecretValue(provided);
  const expectedHash = hashSecretValue(expected);
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

// Active server-side session registry (sid -> session record)
interface AdminSessionRecord {
  sid: string;
  uid: string;
  username: string;
  role: 'admin';
  iat: number;
  exp: number;
}

const activeSessions = new Map<string, AdminSessionRecord>();

// Simple brute-force rate limiter per IP
interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}
const loginAttempts = new Map<string, RateLimitEntry>();
const MAX_LOGIN_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { attempts: 0, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.attempts >= MAX_LOGIN_ATTEMPTS) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true };
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { attempts: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.attempts += 1;
  }
}

function clearFailedAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

// Sign & verify HMAC session token
function createSignedSessionToken(username: string): {
  token: string;
  record: AdminSessionRecord;
} {
  const now = Date.now();
  const sid = crypto.randomBytes(24).toString('hex');
  const record: AdminSessionRecord = {
    sid,
    uid: FIXED_ADMIN_UID,
    username,
    role: 'admin',
    iat: now,
    exp: now + SESSION_DURATION_MS,
  };

  activeSessions.set(sid, record);

  const payloadBase64 = Buffer.from(JSON.stringify(record), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SERVER_SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return {
    token: `${payloadBase64}.${signature}`,
    record,
  };
}

function verifySignedSessionToken(token: string | undefined | null): {
  valid: boolean;
  expired?: boolean;
  record?: AdminSessionRecord;
} {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false };
  }

  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) {
    return { valid: false };
  }

  const expectedSignature = crypto
    .createHmac('sha256', SERVER_SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSignature, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString('utf8')
    ) as AdminSessionRecord;

    if (
      !parsed ||
      parsed.uid !== FIXED_ADMIN_UID ||
      parsed.role !== 'admin' ||
      !parsed.sid
    ) {
      return { valid: false };
    }

    if (Date.now() > parsed.exp) {
      activeSessions.delete(parsed.sid);
      return { valid: false, expired: true };
    }

    // Check if revoked on server (if server restarted, accept valid cryptographic HMAC within expiry window and re-register)
    if (!activeSessions.has(parsed.sid)) {
      activeSessions.set(parsed.sid, parsed);
    }

    return { valid: true, record: parsed };
  } catch {
    return { valid: false };
  }
}

function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const [k, ...v] = part.trim().split('=');
      if (k === SESSION_COOKIE_NAME) {
        return decodeURIComponent(v.join('='));
      }
    }
  }

  return null;
}

// ============================================================================
// FIREBASE ADMIN SDK INITIALIZATION (FOR CUSTOM TOKENS & ADMIN RECORD SYNC)
// ============================================================================

let firebaseAdminInitialized = false;
let firebaseAdminDiagnostic = '';

function tryInitFirebaseAdmin(): boolean {
  if (firebaseAdminInitialized && getApps().length > 0) {
    return true;
  }

  const projectId =
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    '';

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || '';

  try {
    if (serviceAccountRaw.trim()) {
      let jsonStr = serviceAccountRaw.trim();
      if (!jsonStr.startsWith('{')) {
        jsonStr = Buffer.from(jsonStr, 'base64').toString('utf8');
      }
      const serviceAccount = JSON.parse(jsonStr);
      if (!getApps().length) {
        initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || projectId || undefined,
        });
      }
      firebaseAdminInitialized = true;
      firebaseAdminDiagnostic = 'Firebase Admin SDK initialized via FIREBASE_SERVICE_ACCOUNT_KEY.';
      return true;
    }

    if (clientEmail.trim() && privateKeyRaw.trim() && projectId.trim()) {
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
      if (!getApps().length) {
        initializeApp({
          credential: cert({
            projectId: projectId.trim(),
            clientEmail: clientEmail.trim(),
            privateKey,
          }),
          projectId: projectId.trim(),
        });
      }
      firebaseAdminInitialized = true;
      firebaseAdminDiagnostic = 'Firebase Admin SDK initialized via FIREBASE_CLIENT_EMAIL & FIREBASE_PRIVATE_KEY.';
      return true;
    }

    firebaseAdminDiagnostic =
      "FIREBASE_SERVICE_ACCOUNT_KEY (yoki FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY) o'rnatilmagan.";
    return false;
  } catch (err: any) {
    firebaseAdminDiagnostic = `Firebase Admin SDK xatoligi: ${err?.message || String(err)}`;
    return false;
  }
}

async function mintAdminFirebaseCustomToken(username: string): Promise<{
  customToken: string | null;
  ready: boolean;
  diagnostic: string;
}> {
  const ready = tryInitFirebaseAdmin();
  if (!ready) {
    return {
      customToken: null,
      ready: false,
      diagnostic: firebaseAdminDiagnostic,
    };
  }

  try {
    const adminAuth = getAuth();

    // 1. Ensure permanent admin user exists in Firebase Auth
    try {
      await adminAuth.getUser(FIXED_ADMIN_UID);
    } catch {
      await adminAuth
        .createUser({
          uid: FIXED_ADMIN_UID,
          displayName: `Odiljon Qori Admin (${username})`,
        })
        .catch(() => {});
    }

    // 2. Ensure active administrator record exists in Firestore /admins/odiljon-qori-permanent-admin
    try {
      const dbAdmin = getFirestore();
      await dbAdmin
        .collection('admins')
        .doc(FIXED_ADMIN_UID)
        .set(
          {
            uid: FIXED_ADMIN_UID,
            username,
            role: 'admin',
            isActive: true,
            permanent: true,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
    } catch (fsErr) {
      console.warn('Admin Firestore bootstrap notice:', fsErr);
    }

    // 3. Mint custom token with trusted claims
    const customToken = await adminAuth.createCustomToken(FIXED_ADMIN_UID, {
      role: 'admin',
      isPermanentAdmin: true,
      username,
    });

    return {
      customToken,
      ready: true,
      diagnostic: 'Firebase Custom Token muvaffaqiyatli yaratildi.',
    };
  } catch (err: any) {
    return {
      customToken: null,
      ready: false,
      diagnostic: `Custom Token yaratishda xatolik: ${err?.message || String(err)}`,
    };
  }
}

// Helper to check placeholder values for Firebase client config
function isPlaceholderValue(val?: string): boolean {
  if (!val) return true;
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
    lower.includes('abcdef123456')
  ) {
    return true;
  }
  return false;
}

function getRuntimeEnvFirebaseConfig() {
  const pick = (viteKey: string, plainKey: string): string => {
    const v1 = process.env[viteKey];
    if (v1 && !isPlaceholderValue(v1)) return v1.trim();
    const v2 = process.env[plainKey];
    if (v2 && !isPlaceholderValue(v2)) return v2.trim();
    return '';
  };

  const config = {
    apiKey: pick('VITE_FIREBASE_API_KEY', 'FIREBASE_API_KEY'),
    authDomain: pick('VITE_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN'),
    projectId: pick('VITE_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID'),
    storageBucket: pick('VITE_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: pick('VITE_FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDER_ID'),
    appId: pick('VITE_FIREBASE_APP_ID', 'FIREBASE_APP_ID'),
  };

  const missingKeys: string[] = [];
  if (!config.apiKey) missingKeys.push('VITE_FIREBASE_API_KEY');
  if (!config.authDomain) missingKeys.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!config.projectId) missingKeys.push('VITE_FIREBASE_PROJECT_ID');
  if (!config.storageBucket) missingKeys.push('VITE_FIREBASE_STORAGE_BUCKET');
  if (!config.messagingSenderId) missingKeys.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
  if (!config.appId) missingKeys.push('VITE_FIREBASE_APP_ID');

  return {
    config,
    missingKeys,
    isComplete: missingKeys.length === 0,
  };
}

// ============================================================================
// EXPRESS SERVER & ROUTES
// ============================================================================

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. Runtime Firebase Client Config Endpoint
  app.get('/api/firebase-config', (_req: Request, res: Response) => {
    const result = getRuntimeEnvFirebaseConfig();
    res.json(result);
  });

  // 2. Single Permanent Admin Login Endpoint
  app.post('/api/admin/login', async (req: Request, res: Response) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      res.status(429).json({
        authenticated: false,
        error: `Juda ko'p noto'g'ri urinishlar. Iltimos, ${rate.retryAfterSec} soniyadan keyin qayta urinib ko'ring.`,
      });
      return;
    }

    const { username, password } = req.body || {};
    const inputUsername = typeof username === 'string' ? username.trim() : '';
    const inputPassword = typeof password === 'string' ? password : '';

    if (!inputUsername || !inputPassword) {
      res.status(400).json({
        authenticated: false,
        error: 'Foydalanuvchi nomi va parol kiritilishi shart.',
      });
      return;
    }

    const expectedUsername = (process.env.ADMIN_INITIAL_USERNAME || '').trim();
    const expectedPassword = process.env.ADMIN_INITIAL_PASSWORD || '';

    if (!expectedUsername || !expectedPassword) {
      res.status(503).json({
        authenticated: false,
        error:
          "Serverda ADMIN_INITIAL_USERNAME va ADMIN_INITIAL_PASSWORD maxfiy kalitlari sozlanmagan.",
      });
      return;
    }

    const isUsernameValid = safeCompareSecret(inputUsername, expectedUsername);
    const isPasswordValid = safeCompareSecret(inputPassword, expectedPassword);

    if (!isUsernameValid || !isPasswordValid) {
      recordFailedAttempt(ip);
      res.status(401).json({
        authenticated: false,
        error: "Foydalanuvchi nomi yoki maxfiy parol noto'g'ri.",
      });
      return;
    }

    clearFailedAttempts(ip);

    const { token: sessionToken, record } = createSignedSessionToken(expectedUsername);
    const firebaseTokenResult = await mintAdminFirebaseCustomToken(expectedUsername);

    // Set HttpOnly cookie for same-origin and return token for cross-origin iframe Bearer auth
    res.cookie(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_DURATION_MS,
      path: '/',
    });

    res.status(200).json({
      authenticated: true,
      message: 'Tizimga muvaffaqiyatli kirdingiz.',
      sessionToken,
      expiresAt: record.exp,
      admin: {
        uid: FIXED_ADMIN_UID,
        username: record.username,
        role: 'admin',
        isActive: true,
      },
      firebaseCustomToken: firebaseTokenResult.customToken,
      firebaseAdminReady: firebaseTokenResult.ready,
      firebaseDiagnostic: firebaseTokenResult.diagnostic,
    });
  });

  // 3. Verify Active Admin Session Endpoint
  app.get('/api/admin/session', async (req: Request, res: Response) => {
    const token = extractTokenFromRequest(req);
    if (!token) {
      res.status(401).json({
        authenticated: false,
        reason: 'missing_token',
        error: 'Avtorizatsiya talab qilinadi. Iltimos, tizimga kiring.',
      });
      return;
    }

    const verification = verifySignedSessionToken(token);
    if (!verification.valid || !verification.record) {
      res.status(401).json({
        authenticated: false,
        reason: verification.expired ? 'session_expired' : 'invalid_token',
        error: verification.expired
          ? 'Sessiya muddati tugadi. Iltimos, qaytadan tizimga kiring.'
          : 'Yaroqsiz yoki bekor qilingan sessiya. Iltimos, qaytadan kiring.',
      });
      return;
    }

    let firebaseCustomToken: string | null = null;
    let firebaseAdminReady = false;
    let firebaseDiagnostic = '';

    if (req.query.refreshFirebaseToken === '1') {
      const fbRes = await mintAdminFirebaseCustomToken(verification.record.username);
      firebaseCustomToken = fbRes.customToken;
      firebaseAdminReady = fbRes.ready;
      firebaseDiagnostic = fbRes.diagnostic;
    } else {
      firebaseAdminReady = tryInitFirebaseAdmin();
      firebaseDiagnostic = firebaseAdminDiagnostic;
    }

    res.status(200).json({
      authenticated: true,
      expiresAt: verification.record.exp,
      admin: {
        uid: FIXED_ADMIN_UID,
        username: verification.record.username,
        role: 'admin',
        isActive: true,
      },
      firebaseCustomToken,
      firebaseAdminReady,
      firebaseDiagnostic,
    });
  });

  // 4. Logout Endpoint
  app.post('/api/admin/logout', (req: Request, res: Response) => {
    const token = extractTokenFromRequest(req);
    if (token) {
      const verification = verifySignedSessionToken(token);
      if (verification.record?.sid) {
        activeSessions.delete(verification.record.sid);
      }
    }

    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.status(200).json({
      success: true,
      message: 'Tizimdan muvaffaqiyatli chiqildi.',
    });
  });

  // 5. Explicitly Forbid Creating Additional Admin Accounts
  const forbidAdminCreation = (_req: Request, res: Response) => {
    res.status(403).json({
      success: false,
      error:
        "Ruxsat berilmadi: Tizimda faqat bitta doimiy administrator hisobi mavjud. Yangi admin yaratish qat'iyan taqiqlangan.",
    });
  };
  app.all('/api/admin/register', forbidAdminCreation);
  app.all('/api/admin/create', forbidAdminCreation);
  app.all('/api/admin/users', forbidAdminCreation);

  // 6. Vite Middleware (Dev) or Static Assets (Production)
  const distPath = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ODILJON QORI QUR'ON] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
