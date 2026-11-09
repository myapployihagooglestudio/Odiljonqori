/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Unified Storage & Firebase Persistence Service
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  getDocs, 
  collection, 
  Timestamp, 
  writeBatch,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'firebase/storage';
import { type User } from 'firebase/auth';

import { db, auth, storage, checkIsUserAdmin, firebaseConfigError } from './firebase';
import { INITIAL_SURAHS_CATALOG } from '../data/surahsCatalog';
import { getAyahsForSurah } from '../data/ayahsSample';
import { 
  Surah, 
  Ayah, 
  Bookmark, 
  ListeningHistoryItem, 
  AdminLog, 
  VersionSnapshot 
} from '../types/quran';

const STORAGE_KEYS = {
  SURAHS_CACHE: 'odiljon_qori_surahs_cache',
  AYAHS_CACHE_PREFIX: 'odiljon_qori_ayahs_cache_',
  BOOKMARKS: 'odiljon_qori_bookmarks',
  HISTORY: 'odiljon_qori_history',
  ADMIN_LOGS_CACHE: 'odiljon_qori_admin_logs_cache',
  SNAPSHOTS_CACHE: 'odiljon_qori_snapshots_cache',
};

// ==========================================
// 1. SURAHS MANAGEMENT (FIRESTORE PRIMARY)
// ==========================================

/**
 * Fetches all 114 Surahs.
 * Primary source of truth is Firestore.
 * If Firestore contains partial data (e.g. some surahs updated), it merges with INITIAL_SURAHS_CATALOG
 * to strictly guarantee all 114 Surahs remain in complete canonical order.
 */
export async function getAllSurahs(): Promise<Surah[]> {
  // Start with fresh copy of canonical catalog (all 114 Surahs)
  const masterCatalogMap = new Map<number, Surah>();
  INITIAL_SURAHS_CATALOG.forEach((s) => {
    masterCatalogMap.set(s.number, { ...s });
  });

  // 1. Try reading from Firestore if connected
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'surahs'));
      if (!snap.empty) {
        snap.forEach((d) => {
          const remoteSurah = d.data() as Surah;
          if (remoteSurah && remoteSurah.number) {
            // Merge remote updates on top of canonical entry
            const canonical = masterCatalogMap.get(remoteSurah.number);
            masterCatalogMap.set(remoteSurah.number, {
              ...canonical,
              ...remoteSurah,
            });
          }
        });

        const mergedList = Array.from(masterCatalogMap.values()).sort((a, b) => a.number - b.number);
        // Cache for offline reading
        try {
          localStorage.setItem(STORAGE_KEYS.SURAHS_CACHE, JSON.stringify(mergedList));
        } catch {
          // ignore cache quota
        }
        return mergedList;
      }
    } catch (err) {
      console.warn('Firestore fetch notice (reading from local cache):', err);
    }
  }

  // 2. Fallback to local cache if Firestore is offline or unconfigured
  const cached = localStorage.getItem(STORAGE_KEYS.SURAHS_CACHE);
  if (cached) {
    try {
      const parsed: Surah[] = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((s) => {
          if (s && s.number && masterCatalogMap.has(s.number)) {
            masterCatalogMap.set(s.number, { ...masterCatalogMap.get(s.number), ...s });
          }
        });
      }
    } catch (e) {
      console.warn('Error reading local surahs cache:', e);
    }
  }

  return Array.from(masterCatalogMap.values()).sort((a, b) => a.number - b.number);
}

export async function getSurahByNumber(number: number): Promise<Surah | null> {
  // First attempt reading from Firestore directly
  if (db) {
    try {
      const docRef = doc(db, 'surahs', String(number));
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const canonical = INITIAL_SURAHS_CATALOG.find((s) => s.number === number);
        return { ...canonical, ...(snap.data() as Surah) };
      }
    } catch (e) {
      console.warn(`Firestore getSurahByNumber(${number}) notice:`, e);
    }
  }

  const all = await getAllSurahs();
  return all.find((s) => s.number === number) || null;
}

/**
 * Updates Surah metadata in Firestore.
 * Requires an authenticated Administrator.
 * Strictly verifies Firestore write result: if Firestore fails, returns success: false with exact error.
 */
export async function updateSurah(
  updated: Surah, 
  adminUser: User | null
): Promise<{ success: boolean; error?: string }> {
  // Verify Admin Permissions
  if (!adminUser) {
    return { success: false, error: "Avtorizatsiya talab qilinadi: Admin tizimga kirmagan." };
  }

  const isAdmin = await checkIsUserAdmin(adminUser);
  if (!isAdmin) {
    return { success: false, error: "Ruxsat berilmadi: Sizning hisobingizda admin huquqlari yo'q." };
  }

  if (!db) {
    return { 
      success: false, 
      error: "Firebase Firestore ulanmagan. Iltimos, avval Firebase sozlamalarini kiriting." 
    };
  }

  try {
    const adminEmail = adminUser.email || adminUser.uid;

    // 1. Create a version snapshot before updating
    await createSnapshot(updated.number, `Admin update by ${adminEmail}`, adminUser);

    // 2. Perform write to Firestore
    const docRef = doc(db, 'surahs', String(updated.number));
    const payload = {
      ...updated,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
      serverTimestamp: Timestamp.now(),
    };

    await setDoc(docRef, payload, { merge: true });

    // 3. Update local cache only AFTER Firestore write succeeded
    const cached = await getAllSurahs();
    const idx = cached.findIndex((s) => s.number === updated.number);
    if (idx !== -1) {
      cached[idx] = { ...updated, updatedAt: payload.updatedAt, updatedBy: adminEmail };
      localStorage.setItem(STORAGE_KEYS.SURAHS_CACHE, JSON.stringify(cached));
    }

    // 4. Record Audit Log in Firestore
    await addAdminLog({
      action: 'UPDATE_SURAH',
      surahNumber: updated.number,
      details: `${updated.nameUzbek} (${updated.number}-sura) ma'lumotlari yangilandi. Audio status: ${updated.audioStatus}. Nashr: ${updated.isPublished ? 'Ha' : 'Yo\'q'}`,
      actor: adminEmail,
    }, adminUser);

    return { success: true };
  } catch (err) {
    console.error('Firestore write error in updateSurah:', err);
    return { 
      success: false, 
      error: `Firestore yozish xatoligi: ${(err as Error).message}` 
    };
  }
}

// ==========================================
// 2. AYAHS & TIMESTAMPS SUBCOLLECTIONS
// ==========================================

/**
 * Fetches all Ayahs for a Surah.
 * Reads from Firestore subcollection /surahs/{surahNumber}/ayahs.
 */
export async function getAyahsForSurahNumber(surahNumber: number): Promise<Ayah[]> {
  const cacheKey = `${STORAGE_KEYS.AYAHS_CACHE_PREFIX}${surahNumber}`;

  // 1. Try reading from Firestore subcollection
  if (db) {
    try {
      const colRef = collection(db, 'surahs', String(surahNumber), 'ayahs');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const list: Ayah[] = [];
        snap.forEach((d) => list.push(d.data() as Ayah));
        list.sort((a, b) => a.ayahNumber - b.ayahNumber);
        localStorage.setItem(cacheKey, JSON.stringify(list));
        return list;
      }
    } catch (err) {
      console.warn(`Firestore getAyahsForSurahNumber(${surahNumber}) notice:`, err);
    }
  }

  // 2. Check local cache
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.warn('Error reading cached ayahs:', e);
    }
  }

  // 3. Fallback to authentic canonical template
  const surah = await getSurahByNumber(surahNumber);
  const ayahs = getAyahsForSurah(
    surahNumber,
    surah?.ayahCount || 7,
    surah?.startPage || 1,
    surah?.juzNumbers[0] || 1
  );

  return ayahs;
}

/**
 * Saves Ayahs and timestamps into Firestore subcollection /surahs/{surahNumber}/ayahs.
 * Uses atomic batch write where possible to ensure data integrity.
 */
export async function saveAyahsForSurah(
  surahNumber: number,
  ayahs: Ayah[],
  adminUser: User | null
): Promise<{ success: boolean; error?: string }> {
  if (!adminUser) {
    return { success: false, error: "Avtorizatsiya talab qilinadi: Admin tizimga kirmagan." };
  }

  const isAdmin = await checkIsUserAdmin(adminUser);
  if (!isAdmin) {
    return { success: false, error: "Ruxsat berilmadi: Sizda admin huquqlari yo'q." };
  }

  if (!db) {
    return { success: false, error: "Firebase Firestore ulanmagan." };
  }

  try {
    const adminEmail = adminUser.email || adminUser.uid;

    // Use Firestore WriteBatch (batches in chunks of 450 to stay under 500 limit)
    const chunkSize = 400;
    for (let i = 0; i < ayahs.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = ayahs.slice(i, i + chunkSize);

      for (const ayah of chunk) {
        const docRef = doc(db, 'surahs', String(surahNumber), 'ayahs', String(ayah.ayahNumber));
        batch.set(docRef, {
          ...ayah,
          updatedAt: Timestamp.now(),
          updatedBy: adminEmail,
        }, { merge: true });
      }

      await batch.commit();
    }

    // Update local cache
    const cacheKey = `${STORAGE_KEYS.AYAHS_CACHE_PREFIX}${surahNumber}`;
    localStorage.setItem(cacheKey, JSON.stringify(ayahs));

    // Update parent Surah timestampsVerified status in Firestore
    const allVerified = ayahs.every(
      (a) => a.timestampStatus === 'verified' && a.startMs !== null && a.endMs !== null
    );
    const surahDocRef = doc(db, 'surahs', String(surahNumber));
    await setDoc(surahDocRef, { 
      timestampsVerified: allVerified,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail 
    }, { merge: true });

    // Record audit log
    await addAdminLog({
      action: 'UPDATE_AYAHS',
      surahNumber,
      details: `${surahNumber}-sura uchun ${ayahs.length} ta oyat vaqtlari Firestore'ga saqlandi. Holat: ${allVerified ? 'To\'liq tekshirilgan' : 'Qisman tekshirilgan'}`,
      actor: adminEmail,
    }, adminUser);

    return { success: true };
  } catch (err) {
    console.error('Firestore saveAyahs error:', err);
    return { 
      success: false, 
      error: `Firestore'ga oyatlarni saqlashda xatolik: ${(err as Error).message}` 
    };
  }
}

// ==========================================
// 3. FIREBASE STORAGE AUDIO UPLOADER
// ==========================================

export async function uploadSurahAudio(
  surahNumber: number,
  file: File,
  adminUser: User | null,
  onProgress?: (progressPercent: number) => void
): Promise<{ success: boolean; downloadUrl?: string; storagePath?: string; durationSeconds?: number; error?: string }> {
  if (!adminUser) {
    return { success: false, error: "Audio yuklash uchun admin tizimga kirgan bo'lishi shart." };
  }

  const isAdmin = await checkIsUserAdmin(adminUser);
  if (!isAdmin) {
    return { success: false, error: "Faqat tasdiqlangan admin audio fayllarni yuklay oladi." };
  }

  const activeStorage = storage;
  if (!activeStorage) {
    return { 
      success: false, 
      error: "Firebase Storage SDK sozlanmagan. Iltimos, Firebase konfiguratsiyasida Storage bucket'ni ko'rsating." 
    };
  }

  // File validations
  if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|m4a|aac|wav|ogg)$/i)) {
    return { success: false, error: "Faqat audio formatdagi fayllarni (.mp3, .m4a, .wav) yuklash mumkin." };
  }

  if (file.size > 250 * 1024 * 1024) {
    return { success: false, error: "Audio fayl hajmi 250MB dan oshmasligi kerak." };
  }

  return new Promise((resolve) => {
    try {
      const fileExt = file.name.split('.').pop() || 'mp3';
      const cleanSurahNum = surahNumber.toString().padStart(3, '0');
      const storagePath = `recitations/odiljon-qori/${cleanSurahNum}_${Date.now()}.${fileExt}`;
      const storageReference = ref(activeStorage, storagePath);

      const uploadTask = uploadBytesResumable(storageReference, file, {
        contentType: file.type || 'audio/mpeg',
        customMetadata: {
          surahNumber: String(surahNumber),
          uploadedBy: adminUser.email || adminUser.uid,
          uploadedAt: new Date().toISOString(),
        },
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress) onProgress(progress);
        },
        (uploadError) => {
          console.error('Firebase Storage upload error:', uploadError);
          resolve({ 
            success: false, 
            error: `Firebase Storage yuklash xatoligi: ${uploadError.message}` 
          });
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

            // Probe audio duration using client AudioContext or HTML5 Audio
            let durationSeconds: number | null = null;
            try {
              const audioObj = new Audio(URL.createObjectURL(file));
              await new Promise((res) => {
                audioObj.onloadedmetadata = () => {
                  durationSeconds = Math.round(audioObj.duration);
                  res(true);
                };
                audioObj.onerror = () => res(true);
              });
            } catch {
              // Ignore probe failure
            }

            // Immediately update Surah in Firestore
            if (db) {
              const surahDocRef = doc(db, 'surahs', String(surahNumber));
              await setDoc(surahDocRef, {
                audioUrl: downloadUrl,
                audioStoragePath: storagePath,
                audioDurationSeconds: durationSeconds,
                audioFileSizeBytes: file.size,
                audioStatus: 'uploaded_unverified',
                updatedAt: new Date().toISOString(),
                updatedBy: adminUser.email || adminUser.uid,
              }, { merge: true });
            }

            // Update local cache
            const cached = await getAllSurahs();
            const idx = cached.findIndex((s) => s.number === surahNumber);
            if (idx !== -1) {
              cached[idx] = {
                ...cached[idx],
                audioUrl: downloadUrl,
                audioStoragePath: storagePath,
                audioDurationSeconds: durationSeconds,
                audioFileSizeBytes: file.size,
                audioStatus: 'uploaded_unverified',
              };
              localStorage.setItem(STORAGE_KEYS.SURAHS_CACHE, JSON.stringify(cached));
            }

            // Log upload event
            await addAdminLog({
              action: 'AUDIO_UPLOAD',
              surahNumber,
              details: `${surahNumber}-sura uchun yangi audio fayl Firebase Storage'ga yuklandi (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
              actor: adminUser.email || adminUser.uid,
            }, adminUser);

            resolve({
              success: true,
              downloadUrl,
              storagePath,
              durationSeconds: durationSeconds || undefined,
            });
          } catch (urlErr) {
            resolve({ 
              success: false, 
              error: `Yuklangan audio URL manzilini olishda xatolik: ${(urlErr as Error).message}` 
            });
          }
        }
      );
    } catch (err) {
      resolve({ 
        success: false, 
        error: `Yuklashni boshlashda xatolik: ${(err as Error).message}` 
      });
    }
  });
}

/**
 * Removes or unpublishes audio for a specific Surah.
 */
export async function removeSurahAudio(
  surahNumber: number,
  adminUser: User | null
): Promise<{ success: boolean; error?: string }> {
  if (!adminUser) return { success: false, error: "Admin tizimga kirmagan." };
  const isAdmin = await checkIsUserAdmin(adminUser);
  if (!isAdmin) return { success: false, error: "Admin ruxsati yo'q." };

  try {
    if (db) {
      const docRef = doc(db, 'surahs', String(surahNumber));
      await setDoc(docRef, {
        audioUrl: null,
        audioStoragePath: null,
        audioDurationSeconds: null,
        audioFileSizeBytes: null,
        audioStatus: 'missing',
        timestampsVerified: false,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUser.email || adminUser.uid,
      }, { merge: true });
    }

    const cached = await getAllSurahs();
    const idx = cached.findIndex((s) => s.number === surahNumber);
    if (idx !== -1) {
      cached[idx] = {
        ...cached[idx],
        audioUrl: null,
        audioStoragePath: null,
        audioDurationSeconds: null,
        audioFileSizeBytes: null,
        audioStatus: 'missing',
        timestampsVerified: false,
      };
      localStorage.setItem(STORAGE_KEYS.SURAHS_CACHE, JSON.stringify(cached));
    }

    await addAdminLog({
      action: 'AUDIO_REMOVE',
      surahNumber,
      details: `${surahNumber}-suraning audio fayli olib tashlandi.`,
      actor: adminUser.email || adminUser.uid,
    }, adminUser);

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ==========================================
// 4. ADMIN AUDIT LOGS (FIRESTORE PRIMARY)
// ==========================================

export async function getAdminLogs(): Promise<AdminLog[]> {
  if (db) {
    try {
      const q = query(collection(db, 'admin_logs'), orderBy('timestamp', 'desc'), limit(50));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list: AdminLog[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as AdminLog));
        return list;
      }
    } catch (e) {
      console.warn('Firestore getAdminLogs notice:', e);
    }
  }

  // Fallback to local cache
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_LOGS_CACHE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addAdminLog(
  log: Omit<AdminLog, 'id' | 'timestamp'>,
  adminUser?: User | null
): Promise<void> {
  const newLog: AdminLog = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: Date.now(),
  };

  // Write to Firestore if connected
  if (db && adminUser) {
    try {
      const docRef = doc(db, 'admin_logs', newLog.id);
      await setDoc(docRef, { ...newLog, serverTimestamp: Timestamp.now() });
    } catch (e) {
      console.warn('Could not write admin log to Firestore:', e);
    }
  }

  // Update local cache
  try {
    const logs = await getAdminLogs();
    logs.unshift(newLog);
    localStorage.setItem(STORAGE_KEYS.ADMIN_LOGS_CACHE, JSON.stringify(logs.slice(0, 50)));
  } catch {
    // ignore
  }
}

// ==========================================
// 5. VERSION SNAPSHOTS (ROLLBACK SUPPORT)
// ==========================================

export async function createSnapshot(
  surahNumber: number, 
  note: string,
  adminUser?: User | null
): Promise<void> {
  try {
    const surah = await getSurahByNumber(surahNumber);
    if (!surah) return;

    const snapId = `snap-${surahNumber}-${Date.now()}`;
    const snapData: VersionSnapshot = {
      id: snapId,
      surahNumber,
      timestamp: Date.now(),
      data: { ...surah },
      ayahsCount: surah.ayahCount,
      note,
    };

    if (db && adminUser) {
      try {
        const docRef = doc(db, 'version_snapshots', snapId);
        await setDoc(docRef, { ...snapData, serverTimestamp: Timestamp.now() });
      } catch (err) {
        console.warn('Could not save version snapshot to Firestore:', err);
      }
    }

    // Local cache
    const raw = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS_CACHE);
    const snapshots: VersionSnapshot[] = raw ? JSON.parse(raw) : [];
    snapshots.unshift(snapData);
    localStorage.setItem(STORAGE_KEYS.SNAPSHOTS_CACHE, JSON.stringify(snapshots.slice(0, 30)));
  } catch (e) {
    console.warn('Snapshot creation error:', e);
  }
}

export async function getSnapshotsForSurah(surahNumber: number): Promise<VersionSnapshot[]> {
  if (db) {
    try {
      const q = query(
        collection(db, 'version_snapshots'), 
        orderBy('timestamp', 'desc'), 
        limit(20)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list: VersionSnapshot[] = [];
        snap.forEach((d) => {
          const item = d.data() as VersionSnapshot;
          if (item.surahNumber === surahNumber) list.push(item);
        });
        if (list.length > 0) return list;
      }
    } catch (e) {
      console.warn('Firestore getSnapshots notice:', e);
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS_CACHE);
    const snapshots: VersionSnapshot[] = raw ? JSON.parse(raw) : [];
    return snapshots.filter((s) => s.surahNumber === surahNumber);
  } catch {
    return [];
  }
}

export async function restoreSnapshot(
  snapshotId: string, 
  adminUser: User | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const snapshots = await getSnapshotsForSurah(1); // or search across all
    const target = snapshots.find((s) => s.id === snapshotId);
    if (!target) return { success: false, error: 'Snapshot topilmadi.' };

    const updateRes = await updateSurah(target.data, adminUser);
    if (!updateRes.success) {
      return updateRes;
    }

    await addAdminLog({
      action: 'RESTORE_SNAPSHOT',
      surahNumber: target.surahNumber,
      details: `${target.surahNumber}-sura avvalgi versiyasiga (${new Date(target.timestamp).toLocaleString()}) qaytarildi.`,
      actor: adminUser?.email || 'Admin',
    }, adminUser);

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ==========================================
// 6. BOOKMARKS & PLAYBACK RESUME (USER SCOPED)
// ==========================================

export function getBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Loads cloud-synced bookmarks from Firestore for authenticated user.
 */
export async function fetchCloudUserBookmarks(userId: string): Promise<Bookmark[]> {
  if (!db || !userId) return getBookmarks();
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'bookmarks'));
    if (!snap.empty) {
      const list: Bookmark[] = [];
      snap.forEach((d) => list.push(d.data() as Bookmark));
      list.sort((a, b) => b.createdAt - a.createdAt);
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(list));
      return list;
    }
  } catch (e) {
    console.warn('Could not fetch cloud bookmarks:', e);
  }
  return getBookmarks();
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

  const currentUser = auth?.currentUser;

  if (existingIdx !== -1) {
    const target = bookmarks[existingIdx];
    bookmarks.splice(existingIdx, 1);
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));

    // Delete from Firestore if signed in
    if (db && currentUser) {
      deleteDoc(doc(db, 'users', currentUser.uid, 'bookmarks', target.id)).catch(() => {});
    }
    return false;
  } else {
    const newBookmark: Bookmark = {
      ...bookmark,
      id: `${bookmark.surahNumber}-${bookmark.ayahNumber}-${Date.now()}`,
      createdAt: Date.now(),
    };
    bookmarks.unshift(newBookmark);
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));

    // Write to Firestore if signed in
    if (db && currentUser) {
      setDoc(doc(db, 'users', currentUser.uid, 'bookmarks', newBookmark.id), newBookmark).catch(() => {});
    }
    return true;
  }
}

export function getListeningHistory(): ListeningHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function fetchCloudUserHistory(userId: string): Promise<ListeningHistoryItem[]> {
  if (!db || !userId) return getListeningHistory();
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'history'));
    if (!snap.empty) {
      const list: ListeningHistoryItem[] = [];
      snap.forEach((d) => list.push(d.data() as ListeningHistoryItem));
      list.sort((a, b) => b.timestamp - a.timestamp);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(list.slice(0, 30)));
      return list;
    }
  } catch (e) {
    console.warn('Could not fetch cloud listening history:', e);
  }
  return getListeningHistory();
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

  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history.slice(0, 30)));

  // Sync to Firestore if signed in
  const currentUser = auth?.currentUser;
  if (db && currentUser) {
    setDoc(doc(db, 'users', currentUser.uid, 'history', item.id), item, { merge: true }).catch(() => {});
  }
}

export function clearListeningHistory(): void {
  localStorage.removeItem(STORAGE_KEYS.HISTORY);
}

// ==========================================
// 7. BACKUP & RESTORE UTILITIES
// ==========================================

export async function exportFullDatabaseBackup(): Promise<string> {
  const surahs = await getAllSurahs();
  const bookmarks = getBookmarks();
  const history = getListeningHistory();
  const logs = await getAdminLogs();

  const payload = {
    application: "ODILJON QORI QUR'ON",
    version: "1.1.0",
    exportDate: new Date().toISOString(),
    surahsCount: surahs.length,
    surahs,
    bookmarks,
    history,
    logs,
  };

  return JSON.stringify(payload, null, 2);
}

export async function importFullDatabaseBackup(
  jsonString: string,
  adminUser: User | null
): Promise<{ success: boolean; message: string }> {
  if (!adminUser) {
    return { success: false, message: "Zaxira nusxasini tiklash uchun admin tizimga kirgan bo'lishi shart." };
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.surahs || !Array.isArray(parsed.surahs)) {
      return { success: false, message: 'Fayl formati noto\'g\'ri: surahs ro\'yxati topilmadi.' };
    }

    if (db) {
      const batch = writeBatch(db);
      for (const s of parsed.surahs) {
        const docRef = doc(db, 'surahs', String(s.number));
        batch.set(docRef, { ...s, updatedAt: new Date().toISOString() }, { merge: true });
      }
      await batch.commit();
    }

    localStorage.setItem(STORAGE_KEYS.SURAHS_CACHE, JSON.stringify(parsed.surahs));

    await addAdminLog({
      action: 'IMPORT_BACKUP',
      details: `To'liq zaxira fayli Firestore'ga tiklandi (${parsed.surahs.length} ta sura).`,
      actor: adminUser.email || 'Admin',
    }, adminUser);

    return { 
      success: true, 
      message: `Muvaffaqiyatli tiklandi: ${parsed.surahs.length} ta sura Firestore bazasiga yozildi.` 
    };
  } catch (e) {
    return { success: false, message: `Tiklashda xatolik: ${(e as Error).message}` };
  }
}

// ==========================================
// 8. REAL FIRESTORE & STORAGE CONNECTIVITY PROBES
// ==========================================

export async function testFirestoreConnection(): Promise<{
  connected: boolean;
  message: string;
  projectId?: string;
}> {
  if (!db) {
    return {
      connected: false,
      message: firebaseConfigError || 'Firebase sozlamalari to\'liq emas yoki mavjud emas. Ma\'lumotlar faqat keshda saqlanmoqda.',
    };
  }

  try {
    const ref = doc(db, 'system', 'healthcheck');
    // Read check
    const snap = await getDoc(ref);
    return {
      connected: true,
      message: `Firebase Firestore bilan aloqa muvaffaqiyatli o'rnatildi! (Loyiha: ${db.app.options.projectId})`,
      projectId: db.app.options.projectId,
    };
  } catch (err) {
    return {
      connected: false,
      message: `Firestore xatoligi: ${(err as Error).message}`,
    };
  }
}
