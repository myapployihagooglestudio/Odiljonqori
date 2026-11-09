import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

function isPlaceholder(val?: string): boolean {
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Resolve strictly the 6 Firebase client variables from process.env (AI Studio Secrets) or .env
  // Never expose server-only secrets (ADMIN_INITIAL_*, FIREBASE_SERVICE_ACCOUNT_KEY, etc.)
  const getFirebaseEnv = (viteKey: string, plainKey: string): string => {
    const candidates = [
      process.env[viteKey],
      process.env[plainKey],
      env[viteKey],
      env[plainKey],
    ];
    for (const c of candidates) {
      if (c && !isPlaceholder(c)) {
        return c.trim();
      }
    }
    return '';
  };

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || process.cwd(), '.'),
      },
    },
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(
        getFirebaseEnv('VITE_FIREBASE_API_KEY', 'FIREBASE_API_KEY')
      ),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(
        getFirebaseEnv('VITE_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN')
      ),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(
        getFirebaseEnv('VITE_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID')
      ),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(
        getFirebaseEnv('VITE_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET')
      ),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        getFirebaseEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDER_ID')
      ),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(
        getFirebaseEnv('VITE_FIREBASE_APP_ID', 'FIREBASE_APP_ID')
      ),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
