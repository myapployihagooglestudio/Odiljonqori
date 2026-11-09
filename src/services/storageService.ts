/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Unified Storage & Repository Service
 * Provides full persistence: connects to live Firestore when credentials exist,
 * and maintains persistent offline storage so admin edits, bookmarks, and history are NEVER lost.
 */

import { doc, getDoc, setDoc, getDocs, collection, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { INITIAL_SURAHS_CATALOG } from '../data/surahsCatalog';
import { getAyahsForSurah, VERIFIED_SURAHS_AYAHS } from '../data/ayahsSample';
import { Surah, Ayah, Bookmark, ListeningHistoryItem, AdminLog, VersionSnapshot } from '../types/quran';

const STORAGE_KEYS = {
  SURAHS: 'odiljon_qori_surahs',
  AYAHS_PREFIX: 'odiljon_qori_ayahs_',
  BOOKMARKS: 'odiljon_qori_bookmarks',
  HISTORY: 'odiljon_qori_history',
  ADMIN_LOGS: 'odiljon_qori_admin_logs',
  SNAPSHOTS: 'odiljon_qori_snapshots',
  ADMIN_SESSION: 'odiljon_qori_admin_session',
};

// --- SURAHS ---

export async function getAllSurahs(): Promise<Surah[]> {
  // If Firestore is connected, try to fetch
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'surahs'));
      if (!snap.empty) {
        const list: Surah[] = [];
        snap.forEach((d) => list.push(d.data() as Surah));
        list.sort((a, b) => a.number - b.number);
        // Sync local cache
        localStorage.setItem(STORAGE_KEYS.SURAHS, JSON.stringify(list));
        return list;
      }
    } catch (err) {
      console.warn('Firestore fetch error, falling back to local store:', err);
    }
  }

  // Fallback to local storage
  const stored = localStorage.getItem(STORAGE_KEYS.SURAHS);
  if (stored) {
    try {
      const parsed: Surah[] = JSON.parse(stored);
      if (parsed.length === 114) {
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing stored surahs', e);
    }
  }

  // Initialize with canonical catalog
  localStorage.setItem(STORAGE_KEYS.SURAHS, JSON.stringify(INITIAL_SURAHS_CATALOG));
  return INITIAL_SURAHS_CATALOG;
}

export async function getSurahByNumber(number: number): Promise<Surah | null> {
  const all = await getAllSurahs();
  return all.find((s) => s.number === number) || null;
}

export async function updateSurah(updated: Surah, adminName: string = 'Admin'): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Create a version snapshot before updating
    await createSnapshot(updated.number, `Admin update by ${adminName}`);

    // 2. Update local storage
    const all = await getAllSurahs();
    const idx = all.findIndex((s) => s.number === updated.number);
    if (idx !== -1) {
      all[idx] = { ...updated, updatedAt: new Date().toISOString(), updatedBy: adminName };
    } else {
      all.push({ ...updated, updatedAt: new Date().toISOString(), updatedBy: adminName });
    }
    localStorage.setItem(STORAGE_KEYS.SURAHS, JSON.stringify(all));

    // 3. Update Firestore if connected
    if (db) {
      try {
        const docRef = doc(db, 'surahs', String(updated.number));
        await setDoc(docRef, { ...updated, updatedAt: Timestamp.now(), updatedBy: adminName }, { merge: true });
      } catch (err) {
        console.warn('Firestore update warning (saved locally):', err);
      }
    }

    // 4. Log the action
    await addAdminLog({
      action: 'UPDATE_SURAH',
      surahNumber: updated.number,
      details: `${updated.nameUzbek} (${updated.number}-sura) ma'lumotlari yangilandi. Audio status: ${updated.audioStatus}. Nashr: ${updated.isPublished ? 'Ha' : 'Yo\'q'}`,
      actor: adminName,
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// --- AYAHS ---

export async function getAyahsForSurahNumber(surahNumber: number): Promise<Ayah[]> {
  const cacheKey = `${STORAGE_KEYS.AYAHS_PREFIX}${surahNumber}`;

  // If Firestore is connected, check Firestore
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'surahs', String(surahNumber), 'ayahs'));
      if (!snap.empty) {
        const list: Ayah[] = [];
        snap.forEach((d) => list.push(d.data() as Ayah));
        list.sort((a, b) => a.ayahNumber - b.ayahNumber);
        localStorage.setItem(cacheKey, JSON.stringify(list));
        return list;
      }
    } catch (err) {
      console.warn('Firestore getAyahs error, fallback to local', err);
    }
  }

  // Check local cache
  const local = localStorage.getItem(cacheKey);
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {
      console.error('Error reading cached ayahs', e);
    }
  }

  // Get Surah canonical details
  const surah = await getSurahByNumber(surahNumber);
  const ayahs = getAyahsForSurah(
    surahNumber,
    surah?.ayahCount || 7,
    surah?.startPage || 1,
    surah?.juzNumbers[0] || 1
  );

  localStorage.setItem(cacheKey, JSON.stringify(ayahs));
  return ayahs;
}

export async function saveAyahsForSurah(
  surahNumber: number,
  ayahs: Ayah[],
  adminName: string = 'Admin'
): Promise<{ success: boolean; error?: string }> {
  try {
    const cacheKey = `${STORAGE_KEYS.AYAHS_PREFIX}${surahNumber}`;
    localStorage.setItem(cacheKey, JSON.stringify(ayahs));

    // Save to Firestore if connected
    if (db) {
      try {
        for (const ayah of ayahs) {
          const ref = doc(db, 'surahs', String(surahNumber), 'ayahs', String(ayah.ayahNumber));
          await setDoc(ref, ayah, { merge: true });
        }
      } catch (err) {
        console.warn('Firestore ayahs save warning (saved locally):', err);
      }
    }

    // Check if all timestamps are verified
    const allVerified = ayahs.every((a) => a.timestampStatus === 'verified' && a.startMs !== null && a.endMs !== null);
    const surah = await getSurahByNumber(surahNumber);
    if (surah && surah.timestampsVerified !== allVerified) {
      surah.timestampsVerified = allVerified;
      await updateSurah(surah, adminName);
    }

    await addAdminLog({
      action: 'UPDATE_AYAHS',
      surahNumber,
      details: `${surahNumber}-sura uchun ${ayahs.length} ta oyat vaqtlari/matnlari saqlandi. Sinxron holati: ${allVerified ? 'To\'liq tekshirilgan' : 'Qisman tekshirilgan'}`,
      actor: adminName,
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// --- BOOKMARKS ---

export function getBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isAyahBookmarked(surahNumber: number, ayahNumber: number): boolean {
  const bookmarks = getBookmarks();
  return bookmarks.some((b) => b.surahNumber === surahNumber && b.ayahNumber === ayahNumber);
}

export function toggleBookmark(bookmark: Omit<Bookmark, 'id' | 'createdAt'>): boolean {
  const bookmarks = getBookmarks();
  const existingIdx = bookmarks.findIndex(
    (b) => b.surahNumber === bookmark.surahNumber && b.ayahNumber === bookmark.ayahNumber
  );

  if (existingIdx !== -1) {
    // Remove
    bookmarks.splice(existingIdx, 1);
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    return false;
  } else {
    // Add
    const newBookmark: Bookmark = {
      ...bookmark,
      id: `${bookmark.surahNumber}-${bookmark.ayahNumber}-${Date.now()}`,
      createdAt: Date.now(),
    };
    bookmarks.unshift(newBookmark);
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    return true;
  }
}

// --- LISTENING HISTORY & LAST PLAYBACK POSITION ---

export function getListeningHistory(): ListeningHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveListeningPosition(
  surahNumber: number,
  surahName: string,
  surahNameArabic: string,
  ayahNumber: number,
  positionSeconds: number,
  durationSeconds: number
): void {
  const history = getListeningHistory();
  const existingIdx = history.findIndex((h) => h.surahNumber === surahNumber);

  const percent = durationSeconds > 0 ? Math.min(100, Math.round((positionSeconds / durationSeconds) * 100)) : 0;

  const item: ListeningHistoryItem = {
    id: `history-${surahNumber}`,
    surahNumber,
    surahName,
    surahNameArabic,
    ayahNumber,
    positionSeconds,
    durationSeconds,
    percent,
    timestamp: Date.now(),
  };

  if (existingIdx !== -1) {
    history[existingIdx] = item;
  } else {
    history.unshift(item);
  }

  // Keep top 30
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history.slice(0, 30)));
}

export function clearListeningHistory(): void {
  localStorage.removeItem(STORAGE_KEYS.HISTORY);
}

// --- ADMIN AUDIT LOGS ---

export async function getAdminLogs(): Promise<AdminLog[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addAdminLog(log: Omit<AdminLog, 'id' | 'timestamp'>): Promise<void> {
  const logs = await getAdminLogs();
  const newLog: AdminLog = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: Date.now(),
  };
  logs.unshift(newLog);
  // Keep last 100
  localStorage.setItem(STORAGE_KEYS.ADMIN_LOGS, JSON.stringify(logs.slice(0, 100)));
}

// --- VERSION SNAPSHOTS (FOR 1-CLICK RESTORE) ---

export async function createSnapshot(surahNumber: number, note: string): Promise<void> {
  try {
    const surah = await getSurahByNumber(surahNumber);
    if (!surah) return;

    const raw = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
    const snapshots: VersionSnapshot[] = raw ? JSON.parse(raw) : [];

    snapshots.unshift({
      id: `snap-${surahNumber}-${Date.now()}`,
      surahNumber,
      timestamp: Date.now(),
      data: { ...surah },
      ayahsCount: surah.ayahCount,
      note,
    });

    localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(snapshots.slice(0, 50)));
  } catch (e) {
    console.error('Failed to create version snapshot', e);
  }
}

export async function getSnapshotsForSurah(surahNumber: number): Promise<VersionSnapshot[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
    const snapshots: VersionSnapshot[] = raw ? JSON.parse(raw) : [];
    return snapshots.filter((s) => s.surahNumber === surahNumber);
  } catch {
    return [];
  }
}

export async function restoreSnapshot(snapshotId: string, adminName: string = 'Admin'): Promise<{ success: boolean; error?: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
    const snapshots: VersionSnapshot[] = raw ? JSON.parse(raw) : [];
    const target = snapshots.find((s) => s.id === snapshotId);
    if (!target) return { success: false, error: 'Snapshot topilmadi' };

    await updateSurah(target.data, adminName);
    await addAdminLog({
      action: 'RESTORE_SNAPSHOT',
      surahNumber: target.surahNumber,
      details: `${target.surahNumber}-sura avvalgi versiyasiga (${new Date(target.timestamp).toLocaleString()}) qaytarildi.`,
      actor: adminName,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// --- BACKUP & RESTORE EXPORT/IMPORT ---

export async function exportFullDatabaseBackup(): Promise<string> {
  const surahs = await getAllSurahs();
  const bookmarks = getBookmarks();
  const history = getListeningHistory();
  const logs = await getAdminLogs();

  const ayahsRecord: Record<number, Ayah[]> = {};
  for (const s of surahs) {
    const key = `${STORAGE_KEYS.AYAHS_PREFIX}${s.number}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      ayahsRecord[s.number] = JSON.parse(raw);
    }
  }

  const payload = {
    application: "ODILJON QORI QUR'ON",
    version: "1.0.0",
    exportDate: new Date().toISOString(),
    surahsCount: surahs.length,
    surahs,
    ayahs: ayahsRecord,
    bookmarks,
    history,
    logs,
  };

  return JSON.stringify(payload, null, 2);
}

export async function importFullDatabaseBackup(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.surahs || !Array.isArray(parsed.surahs)) {
      return { success: false, message: 'Fayl formati noto\'g\'ri: surahs ro\'yxati topilmadi' };
    }

    localStorage.setItem(STORAGE_KEYS.SURAHS, JSON.stringify(parsed.surahs));

    if (parsed.ayahs) {
      for (const [surahNum, ayahs] of Object.entries(parsed.ayahs)) {
        localStorage.setItem(`${STORAGE_KEYS.AYAHS_PREFIX}${surahNum}`, JSON.stringify(ayahs));
      }
    }

    if (parsed.bookmarks) {
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(parsed.bookmarks));
    }

    await addAdminLog({
      action: 'IMPORT_BACKUP',
      details: `To'liq zaxira nusxasi muvaffaqiyatli tiklandi (${parsed.surahs.length} ta sura).`,
      actor: 'Admin',
    });

    return { success: true, message: `Muvaffaqiyatli tiklandi: ${parsed.surahs.length} ta sura yuklandi.` };
  } catch (e) {
    return { success: false, message: `Xatolik: ${(e as Error).message}` };
  }
}

// --- FIRESTORE HEALTH CHECK ---

export async function testFirestoreConnection(): Promise<{
  connected: boolean;
  message: string;
  projectId?: string;
}> {
  if (!db) {
    return {
      connected: false,
      message: 'Firebase sozlamalari kiritilmagan. Ma\'lumotlar mahalliy xotirada barqaror saqlanmoqda.',
    };
  }

  try {
    const ref = doc(db, 'system', 'healthcheck');
    await setDoc(ref, { status: 'healthy', testedAt: Timestamp.now() }, { merge: true });
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return {
        connected: true,
        message: 'Firebase Firestore ulandi va muvaffaqiyatli ishlayapti!',
        projectId: db.app.options.projectId,
      };
    }
    return {
      connected: false,
      message: 'Firestorega ulanishda javob olinmadi.',
    };
  } catch (err) {
    return {
      connected: false,
      message: `Firestore xatoligi: ${(err as Error).message}`,
    };
  }
}
