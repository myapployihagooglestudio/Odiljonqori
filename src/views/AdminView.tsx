/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Hardened Admin Control Center
 * Uses genuine Firebase Authentication, strict role checks, and real Firestore & Storage persistence.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Music, 
  Clock, 
  Save, 
  Download, 
  Search, 
  Layers, 
  Sliders, 
  Activity, 
  Play, 
  Database,
  UserCheck,
  UserX,
  RefreshCw,
  FileAudio,
  Trash2
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  type User 
} from 'firebase/auth';

import { Surah, Ayah, AdminLog } from '../types/quran';
import { 
  getAllSurahs, 
  updateSurah, 
  getAyahsForSurahNumber, 
  saveAyahsForSurah, 
  getAdminLogs, 
  exportFullDatabaseBackup, 
  importFullDatabaseBackup, 
  testFirestoreConnection,
  uploadSurahAudio,
  removeSurahAudio
} from '../services/storageService';
import { 
  auth, 
  db, 
  storage, 
  checkIsUserAdmin, 
  getStoredFirebaseConfig, 
  saveStoredFirebaseConfig, 
  clearStoredFirebaseConfig,
  firebaseConfigSource,
  firebaseConfigError,
  type FirebaseRuntimeConfig,
  AUTHORIZED_SUPER_ADMIN_EMAILS
} from '../services/firebase';

export const AdminView: React.FC = () => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  
  // Login form state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Workspace state
  const [activeTab, setActiveTab] = useState<'surahs' | 'sync_studio' | 'firebase_backup' | 'logs'>('surahs');
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'has_audio' | 'missing_audio' | 'published' | 'unpublished'>('all');
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);

  // Audio Upload state
  const [audioFileToUpload, setAudioFileToUpload] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Sync Studio state
  const [syncSurahNumber, setSyncSurahNumber] = useState<number>(1);
  const [syncAyahs, setSyncAyahs] = useState<Ayah[]>([]);
  const [studioAudioCurrentTime, setStudioAudioCurrentTime] = useState<number>(0);
  const studioAudioRef = useRef<HTMLAudioElement | null>(null);

  // Firebase & Backup state
  const [firebaseConfig, setFirebaseConfig] = useState<Partial<FirebaseRuntimeConfig>>(() => {
    return getStoredFirebaseConfig() || {};
  });
  const [firestoreStatus, setFirestoreStatus] = useState<{ connected: boolean; message: string; projectId?: string } | null>(null);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Monitor Firebase Auth state
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      setCurrentUser(user);
      if (user) {
        const hasAdminRole = await checkIsUserAdmin(user);
        setIsAdminUser(hasAdminRole);
        if (hasAdminRole) {
          loadData();
        }
      } else {
        setIsAdminUser(false);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadData = () => {
    getAllSurahs().then(setSurahs);
    getAdminLogs().then(setLogs);
  };

  useEffect(() => {
    if (syncSurahNumber && isAdminUser) {
      getAyahsForSurahNumber(syncSurahNumber).then(setSyncAyahs);
    }
  }, [syncSurahNumber, isAdminUser]);

  // Audio time update in studio
  useEffect(() => {
    const audio = studioAudioRef.current;
    if (!audio) return;
    const handleTime = () => setStudioAudioCurrentTime(audio.currentTime);
    audio.addEventListener('timeupdate', handleTime);
    return () => audio.removeEventListener('timeupdate', handleTime);
  }, [studioAudioRef.current]);

  // Handle Email & Password Sign In
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setAuthError("Firebase sozlamalari mavjud emas. Iltimos, avval Firebase sozlamalarini kiriting.");
      return;
    }

    setAuthError(null);
    setAuthSubmitting(true);

    try {
      if (authMode === 'login') {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const hasAdmin = await checkIsUserAdmin(cred.user);
        if (!hasAdmin) {
          setAuthError(`Kirish muvaffaqiyatli, ammo «${cred.user.email}» hisobi admin huquqiga ega emas.`);
        }
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const hasAdmin = await checkIsUserAdmin(cred.user);
        if (!hasAdmin) {
          setAuthError(`Hisob yaratildi, ammo ushbu yangi hisob adminlar ro'yxatida tasdiqlanmagan.`);
        }
      }
    } catch (err: any) {
      console.error('Firebase Auth error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setAuthError("Email yoki maxfiy parol noto'g'ri.");
      } else if (err.code === 'auth/user-not-found') {
        setAuthError("Bunday foydalanuvchi topilmadi.");
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError("Ushbu email allaqachon ro'yxatdan o'tgan.");
      } else if (err.code === 'auth/weak-password') {
        setAuthError("Parol juda oddiy. Kamida 6 ta belgi kiriting.");
      } else {
        setAuthError(`Kirish xatoligi: ${err.message}`);
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleAuth = async () => {
    if (!auth) {
      setAuthError("Firebase sozlamalari mavjud emas.");
      return;
    }

    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const hasAdmin = await checkIsUserAdmin(result.user);
      if (!hasAdmin) {
        setAuthError(`Google orqali kirdingiz («${result.user.email}»), ammo hisobingizda admin huquqlari yo'q.`);
      }
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      setAuthError(`Google kirish xatoligi: ${err.message}`);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
    }
    setCurrentUser(null);
    setIsAdminUser(false);
  };

  // Surah Edit Save
  const handleSaveSurah = async () => {
    if (!selectedSurah) return;
    setFeedbackMessage({ text: "Firestore'ga saqlanmoqda..." });

    const res = await updateSurah(selectedSurah, currentUser);
    if (res.success) {
      setFeedbackMessage({ text: "Sura ma'lumotlari haqiqiy Firestore bazasiga muvaffaqiyatli saqlandi!" });
      loadData();
      setTimeout(() => setFeedbackMessage(null), 4000);
    } else {
      setFeedbackMessage({ text: res.error || "Saqlashda xatolik yuz berdi.", isError: true });
    }
  };

  // Upload Audio via Firebase Storage
  const handleAudioUpload = async () => {
    if (!selectedSurah || !audioFileToUpload) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    const res = await uploadSurahAudio(
      selectedSurah.number,
      audioFileToUpload,
      currentUser,
      (pct) => setUploadProgress(pct)
    );

    setIsUploading(false);

    if (res.success && res.downloadUrl) {
      setSelectedSurah({
        ...selectedSurah,
        audioUrl: res.downloadUrl,
        audioStoragePath: res.storagePath || null,
        audioDurationSeconds: res.durationSeconds || selectedSurah.audioDurationSeconds,
        audioStatus: 'uploaded_unverified',
      });
      setAudioFileToUpload(null);
      setFeedbackMessage({ text: "Audio fayl Firebase Storage'ga muvaffaqiyatli yuklandi va havola suraga bog'landi!" });
      loadData();
    } else {
      setUploadError(res.error || "Audio faylni yuklashda xatolik yuz berdi.");
    }
  };

  // Remove Audio via Firebase
  const handleRemoveAudio = async () => {
    if (!selectedSurah) return;
    if (!confirm(`«${selectedSurah.nameUzbek}» surasining audio faylini o'chirishni tasdiqlaysizmi?`)) {
      return;
    }

    setFeedbackMessage({ text: "Audio fayl olib tashlanmoqda..." });
    const res = await removeSurahAudio(selectedSurah.number, currentUser);
    if (res.success) {
      setSelectedSurah({
        ...selectedSurah,
        audioUrl: null,
        audioStoragePath: null,
        audioDurationSeconds: null,
        audioFileSizeBytes: null,
        audioStatus: 'missing',
        timestampsVerified: false,
      });
      setFeedbackMessage({ text: "Audio muvaffaqiyatli olib tashlandi va Firestore'ga yozildi." });
      loadData();
    } else {
      setFeedbackMessage({ text: res.error || "Audioni o'chirishda xatolik.", isError: true });
    }
  };

  const formatDuration = (secs?: number | null) => {
    if (!secs || isNaN(secs)) return '—';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatBytes = (bytes?: number | null) => {
    if (!bytes || isNaN(bytes)) return '—';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Mark timestamps in studio
  const markAyahTime = (ayahIndex: number, type: 'start' | 'end') => {
    const timeMs = Math.round(studioAudioCurrentTime * 1000);
    const updated = [...syncAyahs];
    if (type === 'start') {
      updated[ayahIndex].startMs = timeMs;
    } else {
      updated[ayahIndex].endMs = timeMs;
    }

    if (updated[ayahIndex].startMs !== null && updated[ayahIndex].endMs !== null) {
      updated[ayahIndex].timestampStatus = 'verified';
    }
    setSyncAyahs(updated);
  };

  // Save Synchronized Ayahs to Firestore
  const handleSaveAyahTimestamps = async () => {
    setFeedbackMessage({ text: "Oyatlar vaqti Firestore'ga yozilmoqda..." });
    const res = await saveAyahsForSurah(syncSurahNumber, syncAyahs, currentUser);
    if (res.success) {
      setFeedbackMessage({ text: "Oyat vaqtlari Firestore subcollection'ga muvaffaqiyatli saqlandi!" });
      loadData();
      setTimeout(() => setFeedbackMessage(null), 4000);
    } else {
      setFeedbackMessage({ text: res.error || "Oyat vaqtlarini saqlashda xatolik.", isError: true });
    }
  };

  // Firebase config update & probe
  const handleSaveFirebaseConfig = async () => {
    saveStoredFirebaseConfig(firebaseConfig);
    setFeedbackMessage({ text: "Firebase sozlamalari saqlandi. Aloqa tekshirilmoqda..." });
    setIsTestingDb(true);
    const status = await testFirestoreConnection();
    setFirestoreStatus(status);
    setIsTestingDb(false);
  };

  const handleResetFirebaseConfig = () => {
    clearStoredFirebaseConfig();
    const envCfg = getStoredFirebaseConfig() || {};
    setFirebaseConfig(envCfg);
    setFeedbackMessage({ text: "Brauzer xotirasidagi sozlamalar tozalandi. Environment parametrlariga qaytarildi." });
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // Download Backup JSON
  const handleDownloadBackup = async () => {
    const jsonStr = await exportFullDatabaseBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `odiljon_qori_quran_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import Backup JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const res = await importFullDatabaseBackup(content, currentUser);
      setFeedbackMessage({ text: res.message, isError: !res.success });
      if (res.success) {
        loadData();
      }
    };
    reader.readAsText(file);
  };

  // ==========================================
  // VIEW: AUTHENTICATION GATE
  // ==========================================

  if (authLoading) {
    return (
      <div className="py-24 text-center text-[#8fa89e] flex flex-col items-center gap-3">
        <RefreshCw className="w-8 h-8 text-[#d4af37] animate-spin" />
        <span className="text-xs">Xavfsiz admin sessiyasi tekshirilmoqda...</span>
      </div>
    );
  }

  // If user is not authenticated or lacks admin role
  if (!currentUser || !isAdminUser) {
    return (
      <div className="max-w-md mx-auto my-10 p-6 sm:p-8 rounded-3xl bg-[#061d15] border border-[#d4af37]/40 shadow-2xl text-[#f8f6f0]">
        <div className="text-center space-y-2 mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#124e3b] p-[1.5px] flex items-center justify-center">
            <div className="w-full h-full bg-[#041510] rounded-[14px] flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-[#d4af37]" />
            </div>
          </div>
          <h2 className="text-xl font-bold">Admin Kirish Portali</h2>
          <p className="text-xs text-[#8fa89e]">
            Firebase Authentication orqali server tomonidan tekshiriladigan xavfsiz kirish
          </p>
        </div>

        {/* If user is signed in with non-admin account */}
        {currentUser && !isAdminUser && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-950/70 border border-amber-500/40 text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <UserX className="w-4 h-4" />
              <span>Admin huquqi yo'q</span>
            </div>
            <p className="text-[#8fa89e]">
              Siz «<strong>{currentUser.email}</strong>» hisobi bilan kirdingiz, ammo ushbu foydalanuvchi Firestore'da admin huquqiga ega emas.
            </p>
            <p className="text-[11px] text-amber-200/80">
              Ruxsat berilgan super admin: <code>{AUTHORIZED_SUPER_ADMIN_EMAILS[0]}</code>
            </p>
            <button
              onClick={handleSignOut}
              className="mt-2 w-full py-2 rounded-xl bg-amber-900/60 hover:bg-amber-900 text-amber-200 font-semibold text-xs"
            >
              Hisobdan chiqish
            </button>
          </div>
        )}

        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {(!currentUser || !isAdminUser) && (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="text-xs text-[#8fa89e] block mb-1">Admin Email manzili</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8fa89e] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@odiljonqori.uz"
                  className="w-full pl-9 pr-4 py-2.5 bg-[#041510] border border-[#d4af37]/30 rounded-xl text-xs text-[#f8f6f0] focus:outline-none focus:border-[#d4af37]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#8fa89e] block mb-1">Maxfiy parol</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8fa89e] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-[#041510] border border-[#d4af37]/30 rounded-xl text-xs text-[#f8f6f0] focus:outline-none focus:border-[#d4af37]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952b] text-[#041510] font-bold text-xs uppercase tracking-wider hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              {authSubmitting
                ? "Tekshirilmoqda..."
                : authMode === 'login'
                ? "Tizimga kirish"
                : "Admin hisobini ro'yxatdan o'tkazish"}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#d4af37]/20" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-[#061d15] px-2 text-[#8fa89e]">yoki</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={authSubmitting}
              className="w-full py-2.5 rounded-xl bg-[#041510] hover:bg-[#0a2f24] text-[#f8f6f0] border border-[#d4af37]/30 font-medium text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <span className="font-bold text-[#d4af37]">G</span>
              <span>Google orqali kirish</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-xs text-[#8fa89e] hover:text-[#d4af37]"
              >
                {authMode === 'login'
                  ? "Yangi admin hisobini ochish"
                  : "Mavjud hisob bilan kirish"}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: VERIFIED ADMIN DASHBOARD
  // ==========================================

  const totalWithAudio = surahs.filter((s) => Boolean(s.audioUrl)).length;
  const totalVerifiedSync = surahs.filter((s) => s.timestampsVerified).length;
  const filteredSurahs = surahs.filter((s) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match = (
        s.nameUzbek.toLowerCase().includes(q) ||
        s.nameArabic.includes(q) ||
        s.number.toString() === q
      );
      if (!match) return false;
    }

    if (statusFilter === 'has_audio' && !s.audioUrl) return false;
    if (statusFilter === 'missing_audio' && s.audioUrl) return false;
    if (statusFilter === 'published' && !s.isPublished) return false;
    if (statusFilter === 'unpublished' && s.isPublished) return false;

    return true;
  });

  const syncTargetSurah = surahs.find((s) => s.number === syncSurahNumber) || surahs[0];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-28 text-[#f8f6f0]">
      
      {/* Top Header Bar */}
      <div className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#124e3b] border border-[#d4af37]/40 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#d4af37]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[#f8f6f0]">
                ODILJON QORI QUR'ON — Boshqaruv Markazi
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                <UserCheck className="w-3 h-3" /> Admin: {currentUser.email}
              </span>
            </div>
            <p className="text-[11px] text-[#8fa89e]">
              Firestore va Firebase Storage bilan haqiqiy sinxronlashgan boshqaruv
            </p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="px-3 py-1.5 rounded-xl bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-500/20 text-xs flex items-center gap-1.5 transition-colors self-start md:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Chiqish</span>
        </button>
      </div>

      {/* Global Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 animate-fadeIn ${
            feedbackMessage.isError
              ? 'bg-rose-950/70 border-rose-500 text-rose-200'
              : 'bg-[#124e3b] border-[#d4af37] text-[#f3e5ab]'
          }`}
        >
          {feedbackMessage.isError ? (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#d4af37] flex-shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#061d15] border border-[#d4af37]/20">
          <span className="text-[11px] text-[#8fa89e] block">Jami Suralar</span>
          <span className="text-xl font-bold text-[#f8f6f0]">{surahs.length} / 114</span>
        </div>
        <div className="p-3.5 rounded-xl bg-[#061d15] border border-[#d4af37]/20">
          <span className="text-[11px] text-[#8fa89e] block">Audio yuklangan</span>
          <span className="text-xl font-bold text-emerald-400">{totalWithAudio} ta</span>
        </div>
        <div className="p-3.5 rounded-xl bg-[#061d15] border border-[#d4af37]/20">
          <span className="text-[11px] text-[#8fa89e] block">Audio kutilmoqda</span>
          <span className="text-xl font-bold text-amber-400">{114 - totalWithAudio} ta</span>
        </div>
        <div className="p-3.5 rounded-xl bg-[#061d15] border border-[#d4af37]/20">
          <span className="text-[11px] text-[#8fa89e] block">Sinxron tekshirilgan</span>
          <span className="text-xl font-bold text-[#d4af37]">{totalVerifiedSync} ta sura</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#d4af37]/20 pb-2 overflow-x-auto">
        {[
          { id: 'surahs', label: '114 ta Sura va Audio Yuklash', icon: Layers },
          { id: 'sync_studio', label: 'Oyat Sinxronlash Studiyasi', icon: Sliders },
          { id: 'firebase_backup', label: 'Firebase & Zaxira Nusxalar', icon: Database },
          { id: 'logs', label: 'Tizim Jurnali (Audit)', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#d4af37] text-[#041510] shadow-md shadow-[#d4af37]/20'
                  : 'bg-[#061d15] text-[#8fa89e] hover:text-[#f8f6f0] border border-[#d4af37]/20'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SURAHS & AUDIO UPLOAD */}
      {activeTab === 'surahs' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#061d15] p-3.5 rounded-2xl border border-[#d4af37]/20">
            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'Barchasi', count: surahs.length },
                { id: 'has_audio', label: 'Audio bor', count: totalWithAudio, color: 'text-emerald-400' },
                { id: 'missing_audio', label: 'Kutilmoqda', count: 114 - totalWithAudio, color: 'text-amber-400' },
                { id: 'published', label: 'Nashr qilingan', count: surahs.filter((s) => s.isPublished).length, color: 'text-[#d4af37]' },
                { id: 'unpublished', label: 'Qoralama', count: surahs.filter((s) => !s.isPublished).length, color: 'text-zinc-400' },
              ].map((f) => {
                const isSelected = statusFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-[#d4af37] text-[#041510] font-bold shadow-md'
                        : 'bg-[#041510] text-[#8fa89e] hover:text-[#f8f6f0] border border-[#d4af37]/20'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-[#041510] text-[#d4af37]'
                          : 'bg-[#061d15] text-[#8fa89e]'
                      }`}
                    >
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:max-w-xs">
              <Search className="w-4 h-4 text-[#8fa89e] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Surani nomi yoki raqami..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#041510] border border-[#d4af37]/30 text-xs text-[#f8f6f0] focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: 114 Surahs List */}
            <div className="lg:col-span-2 bg-[#061d15] border border-[#d4af37]/20 rounded-2xl overflow-hidden divide-y divide-[#d4af37]/10 max-h-[620px] overflow-y-auto">
              <div className="p-3 bg-[#041510]/80 sticky top-0 z-10 border-b border-[#d4af37]/20 flex items-center justify-between text-[11px] text-[#8fa89e]">
                <span>Surah ro'yxati ({filteredSurahs.length} ta ko'rsatilmoqda)</span>
                <span>Audio va Nashr holati</span>
              </div>

              {filteredSurahs.map((surah) => {
                const isSelected = selectedSurah?.number === surah.number;
                return (
                  <div
                    key={surah.id}
                    onClick={() => {
                      setSelectedSurah(surah);
                      setAudioFileToUpload(null);
                      setUploadError(null);
                    }}
                    className={`p-3.5 hover:bg-[#092b21] cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-[#124e3b]/50 border-l-4 border-l-[#d4af37]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-[#041510] text-[#d4af37] text-xs font-mono font-bold flex items-center justify-center border border-[#d4af37]/20 flex-shrink-0">
                        {surah.number}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-[#f8f6f0]">
                            {surah.nameUzbek}
                          </h4>
                          <span className="font-arabic text-xs text-[#d4af37]">
                            {surah.nameArabic}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[#8fa89e] mt-0.5">
                          <span>{surah.revelationType === 'Makkah' ? 'Makkiy' : 'Madaniy'}</span>
                          <span>•</span>
                          <span>{surah.ayahCount} oyat</span>
                          {surah.audioDurationSeconds ? (
                            <>
                              <span>•</span>
                              <span className="text-emerald-400 font-mono">
                                {formatDuration(surah.audioDurationSeconds)}
                              </span>
                            </>
                          ) : null}
                          {surah.audioFileSizeBytes ? (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[#8fa89e]">
                                {formatBytes(surah.audioFileSizeBytes)}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Audio Badge */}
                      {surah.audioUrl ? (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${
                            surah.audioStatus === 'verified'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                              : 'bg-teal-950 text-teal-300 border-teal-500/30'
                          }`}
                        >
                          <Music className="w-3 h-3" />
                          <span>{surah.audioStatus === 'verified' ? 'Tasdiqlangan' : 'Audio bor'}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/30">
                          Kutilmoqda
                        </span>
                      )}

                      {/* Publish Badge */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          surah.isPublished
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-700/40'
                        }`}
                      >
                        {surah.isPublished ? 'Nashr' : 'Qoralama'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Surah & Audio Editor */}
            <div className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-5 space-y-4">
              {selectedSurah ? (
                <>
                  <div className="border-b border-[#d4af37]/20 pb-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#d4af37] font-bold">
                        Surani boshqarish
                      </span>
                      <h3 className="text-base font-bold text-[#f8f6f0]">
                        {selectedSurah.number}. {selectedSurah.nameUzbek}
                      </h3>
                    </div>
                    <span className="font-arabic text-2xl text-[#d4af37]">
                      {selectedSurah.nameArabic}
                    </span>
                  </div>

                  {/* IN-LINE AUDIO PREVIEW IF ATTACHED */}
                  {selectedSurah.audioUrl && (
                    <div className="p-3.5 rounded-xl bg-[#041510] border border-emerald-500/30 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <Music className="w-4 h-4" />
                          <span>Odiljon Qori Qiroati (Tinglab tekshirish)</span>
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-mono">
                          {formatDuration(selectedSurah.audioDurationSeconds)} • {formatBytes(selectedSurah.audioFileSizeBytes)}
                        </span>
                      </div>

                      <audio
                        controls
                        src={selectedSurah.audioUrl}
                        className="w-full h-8 accent-[#d4af37]"
                      />

                      <div className="flex items-center justify-between pt-1 border-t border-[#d4af37]/10">
                        <span
                          className="text-[10px] text-[#8fa89e] truncate max-w-[180px]"
                          title={selectedSurah.audioStoragePath || selectedSurah.audioUrl}
                        >
                          {selectedSurah.audioStoragePath || 'Firebase Storage'}
                        </span>

                        <button
                          type="button"
                          onClick={handleRemoveAudio}
                          className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:underline transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Audioni olib tashlash</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Audio Upload Box (Firebase Storage) */}
                  <div className="p-3.5 rounded-xl bg-[#041510] border border-[#d4af37]/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#d4af37] flex items-center gap-1.5">
                        <FileAudio className="w-4 h-4" />
                        <span>{selectedSurah.audioUrl ? "Audioni almashtirish / Qayta yuklash" : "Firebase Storage'ga Audio Yuklash"}</span>
                      </span>
                      {selectedSurah.audioUrl ? (
                        <span className="text-[10px] text-emerald-400 font-semibold">Bog'langan</span>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-semibold">Yuklanmagan</span>
                      )}
                    </div>

                    <p className="text-[11px] text-[#8fa89e]">
                      Qurilmadan (telefon yoki kompyuter) Odiljon Qorining MP3 audio faylini tanlang:
                    </p>

                    <input
                      type="file"
                      accept="audio/*,.mp3,.m4a,.wav"
                      onChange={(e) => setAudioFileToUpload(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[#8fa89e] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#124e3b] file:text-[#f3e5ab] hover:file:bg-[#d4af37] hover:file:text-[#041510] cursor-pointer"
                    />

                    {audioFileToUpload && (
                      <button
                        onClick={handleAudioUpload}
                        disabled={isUploading}
                        className="w-full py-2.5 rounded-xl bg-[#124e3b] hover:bg-[#d4af37] text-[#f3e5ab] hover:text-[#041510] border border-[#d4af37]/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-md"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {isUploading
                            ? `Yuklanmoqda (${uploadProgress}%)...`
                            : `Firebase Storage'ga yuklash (${(audioFileToUpload.size / (1024 * 1024)).toFixed(1)} MB)`}
                        </span>
                      </button>
                    )}

                    {uploadProgress !== null && isUploading && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-[#d4af37]">
                          <span>Progress</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-[#061d15] h-2 rounded-full overflow-hidden border border-[#d4af37]/20">
                          <div
                            className="bg-gradient-to-r from-[#d4af37] to-[#f3e5ab] h-full transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {uploadError && (
                      <p className="text-[11px] text-rose-300 bg-rose-950/60 p-2 rounded-lg border border-rose-500/30">
                        {uploadError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-[#8fa89e] block mb-1">O'zbekcha nomi:</label>
                      <input
                        type="text"
                        value={selectedSurah.nameUzbek}
                        onChange={(e) =>
                          setSelectedSurah({ ...selectedSurah, nameUzbek: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl text-xs text-[#f8f6f0] focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    <div>
                      <label className="text-[#8fa89e] block mb-1">Arabcha nomi:</label>
                      <input
                        type="text"
                        value={selectedSurah.nameArabic}
                        onChange={(e) =>
                          setSelectedSurah({ ...selectedSurah, nameArabic: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl text-xs text-[#f8f6f0] font-arabic focus:outline-none focus:border-[#d4af37] dir-rtl"
                      />
                    </div>

                    <div>
                      <label className="text-[#8fa89e] block mb-1">Audio URL (Firebase Storage download URL):</label>
                      <input
                        type="text"
                        value={selectedSurah.audioUrl || ''}
                        onChange={(e) =>
                          setSelectedSurah({
                            ...selectedSurah,
                            audioUrl: e.target.value.trim() || null,
                            audioStatus: e.target.value.trim() ? 'uploaded_unverified' : 'missing',
                          })
                        }
                        placeholder="https://firebasestorage.googleapis.com/..."
                        className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl font-mono text-xs text-[#f8f6f0] focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    <div>
                      <label className="text-[#8fa89e] block mb-1">Audio holati:</label>
                      <select
                        value={selectedSurah.audioStatus}
                        onChange={(e) =>
                          setSelectedSurah({ ...selectedSurah, audioStatus: e.target.value as any })
                        }
                        className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl text-xs text-[#f8f6f0] focus:outline-none focus:border-[#d4af37] cursor-pointer"
                      >
                        <option value="missing">Audio kutilmoqda (missing)</option>
                        <option value="uploaded_unverified">Yuklangan, tekshirilmoqda (uploaded_unverified)</option>
                        <option value="verified">Tasdiqlangan (verified)</option>
                      </select>
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-[#041510] border border-[#d4af37]/20 cursor-pointer hover:border-[#d4af37]/40 transition-colors">
                        <div>
                          <span className="font-bold text-[#f8f6f0] block">Omma uchun nashr etish</span>
                          <span className="text-[10px] text-[#8fa89e]">
                            Foydalanuvchilar ilovada ushbu surani ko'ra oladi
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedSurah.isPublished}
                          onChange={(e) =>
                            setSelectedSurah({ ...selectedSurah, isPublished: e.target.checked })
                          }
                          className="w-5 h-5 rounded accent-[#d4af37]"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#d4af37]/20 flex items-center gap-2">
                    <button
                      onClick={handleSaveSurah}
                      className="flex-1 py-2.5 rounded-xl bg-[#d4af37] text-[#041510] font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#f3e5ab] transition-colors shadow-md"
                    >
                      <Save className="w-4 h-4" />
                      <span>Firestore'ga saqlash</span>
                    </button>

                    <button
                      onClick={() => {
                        setSyncSurahNumber(selectedSurah.number);
                        setActiveTab('sync_studio');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-[#124e3b] text-[#f3e5ab] font-bold text-xs flex items-center gap-1.5 hover:bg-[#d4af37] hover:text-[#041510] transition-colors"
                    >
                      <Sliders className="w-4 h-4" />
                      <span>Sinxronlash</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-[#8fa89e] text-xs">
                  Tahrirlash va audio yuklash uchun chap tarafdagi ro'yxatdan surani tanlang.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AYAH AUDIO TIMESTAMP SYNCHRONIZER STUDIO */}
      {activeTab === 'sync_studio' && (
        <div className="space-y-4">
          <div className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#d4af37]/20">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8fa89e]">Sura:</span>
                <select
                  value={syncSurahNumber}
                  onChange={(e) => setSyncSurahNumber(Number(e.target.value))}
                  className="bg-[#041510] border border-[#d4af37]/30 rounded-xl px-3 py-1.5 text-xs text-[#f8f6f0] font-bold focus:outline-none cursor-pointer"
                >
                  {surahs.map((s) => (
                    <option key={s.number} value={s.number} className="bg-[#061d15]">
                      {s.number}. {s.nameUzbek} ({s.nameArabic}) — {s.ayahCount} oyat
                    </option>
                  ))}
                </select>
              </div>

              {syncTargetSurah?.audioUrl ? (
                <div className="flex items-center gap-3">
                  <audio
                    ref={studioAudioRef}
                    src={syncTargetSurah.audioUrl}
                    controls
                    className="h-8 max-w-xs"
                  />
                  <span className="text-xs font-mono text-[#d4af37]">
                    {studioAudioCurrentTime.toFixed(2)}s ({Math.round(studioAudioCurrentTime * 1000)}ms)
                  </span>
                </div>
              ) : (
                <div className="text-xs text-amber-300 bg-amber-950/60 px-3 py-1.5 rounded-xl border border-amber-500/20">
                  Ushbu sura uchun audio link mavjud emas. Avval 1-tabda audio faylni yuklang.
                </div>
              )}
            </div>

            {/* Ayahs List */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              <div className="text-[11px] text-[#8fa89e] flex items-center justify-between pb-1">
                <span>Audioni tinglang va tegishli tugmani bosing:</span>
                <span>Jami: {syncAyahs.length} ta oyat</span>
              </div>

              {syncAyahs.map((ayah, idx) => (
                <div
                  key={ayah.id}
                  className="p-3 rounded-xl bg-[#041510] border border-[#d4af37]/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#124e3b] text-[#d4af37] flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                      {ayah.ayahNumber}
                    </span>
                    <p className="font-arabic text-sm text-[#f8f6f0] max-w-md truncate">
                      {ayah.textArabic}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div className="flex items-center gap-1 bg-[#061d15] px-2 py-1 rounded-lg border border-[#d4af37]/20">
                      <span className="text-[10px] text-[#8fa89e]">Boshlanishi:</span>
                      <input
                        type="number"
                        value={ayah.startMs ?? ''}
                        onChange={(e) => {
                          const updated = [...syncAyahs];
                          updated[idx].startMs = e.target.value ? Number(e.target.value) : null;
                          setSyncAyahs(updated);
                        }}
                        className="w-16 bg-[#041510] text-center font-mono text-xs text-[#d4af37] border-b border-[#d4af37]/40 focus:outline-none"
                        placeholder="0"
                      />
                      <span className="text-[10px] text-[#8fa89e]">ms</span>
                      <button
                        onClick={() => markAyahTime(idx, 'start')}
                        className="px-1.5 py-0.5 rounded bg-[#124e3b] text-[#f3e5ab] text-[10px] hover:bg-[#d4af37] hover:text-[#041510]"
                      >
                        Hozirgi
                      </button>
                    </div>

                    <div className="flex items-center gap-1 bg-[#061d15] px-2 py-1 rounded-lg border border-[#d4af37]/20">
                      <span className="text-[10px] text-[#8fa89e]">Tugashi:</span>
                      <input
                        type="number"
                        value={ayah.endMs ?? ''}
                        onChange={(e) => {
                          const updated = [...syncAyahs];
                          updated[idx].endMs = e.target.value ? Number(e.target.value) : null;
                          setSyncAyahs(updated);
                        }}
                        className="w-16 bg-[#041510] text-center font-mono text-xs text-[#d4af37] border-b border-[#d4af37]/40 focus:outline-none"
                        placeholder="0"
                      />
                      <span className="text-[10px] text-[#8fa89e]">ms</span>
                      <button
                        onClick={() => markAyahTime(idx, 'end')}
                        className="px-1.5 py-0.5 rounded bg-[#124e3b] text-[#f3e5ab] text-[10px] hover:bg-[#d4af37] hover:text-[#041510]"
                      >
                        Hozirgi
                      </button>
                    </div>

                    {ayah.startMs !== null && studioAudioRef.current && (
                      <button
                        onClick={() => {
                          if (studioAudioRef.current && ayah.startMs !== null) {
                            studioAudioRef.current.currentTime = ayah.startMs / 1000;
                            studioAudioRef.current.play();
                          }
                        }}
                        className="p-1.5 rounded-lg bg-[#061d15] hover:bg-[#d4af37] text-[#8fa89e] hover:text-[#041510] border border-[#d4af37]/20"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#d4af37]/20 flex items-center justify-between">
              <span className="text-xs text-[#8fa89e]">
                Oyatlar Firestore subcollection'ga yoziladi.
              </span>

              <button
                onClick={handleSaveAyahTimestamps}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952b] text-[#041510] font-bold text-xs flex items-center gap-2 hover:opacity-95"
              >
                <Save className="w-4 h-4" />
                <span>Firestore'ga saqlash</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FIREBASE & BACKUP */}
      {activeTab === 'firebase_backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#d4af37]" />
                <div>
                  <h3 className="text-sm font-bold text-[#f8f6f0]">
                    Firebase Firestore & Storage Sozlamalari
                  </h3>
                  <p className="text-[11px] text-[#8fa89e]">
                    Bulutli xizmatlar kalitlari va manba ustuvorligi
                  </p>
                </div>
              </div>

              {/* Source Badge */}
              <span
                className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border ${
                  firebaseConfigSource === 'environment'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                    : firebaseConfigSource === 'localStorage'
                    ? 'bg-teal-950 text-teal-300 border-teal-500/40'
                    : 'bg-amber-950 text-amber-300 border-amber-500/40'
                }`}
              >
                {firebaseConfigSource === 'environment'
                  ? 'Manba: Environment (.env / Secrets)'
                  : firebaseConfigSource === 'localStorage'
                  ? 'Manba: localStorage'
                  : 'Manba: Kiritilmagan'}
              </span>
            </div>

            {firebaseConfigError && (
              <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold block">Konfiguratsiya to'liq emas:</span>
                  <span className="text-[11px] leading-relaxed">{firebaseConfigError}</span>
                </div>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#8fa89e] block mb-1">1. Firebase Project ID (VITE_FIREBASE_PROJECT_ID):</label>
                <input
                  type="text"
                  placeholder="odiljon-qori-quran"
                  value={firebaseConfig.projectId || ''}
                  onChange={(e) =>
                    setFirebaseConfig({ ...firebaseConfig, projectId: e.target.value.trim() })
                  }
                  className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl font-mono text-xs text-[#f8f6f0] focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="text-[#8fa89e] block mb-1">2. Firebase API Key (VITE_FIREBASE_API_KEY):</label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={firebaseConfig.apiKey || ''}
                  onChange={(e) =>
                    setFirebaseConfig({ ...firebaseConfig, apiKey: e.target.value.trim() })
                  }
                  className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl font-mono text-xs text-[#f8f6f0] focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="text-[#8fa89e] block mb-1">3. Auth Domain (VITE_FIREBASE_AUTH_DOMAIN):</label>
                <input
                  type="text"
                  placeholder="odiljon-qori-quran.firebaseapp.com"
                  value={firebaseConfig.authDomain || ''}
                  onChange={(e) =>
                    setFirebaseConfig({ ...firebaseConfig, authDomain: e.target.value.trim() })
                  }
                  className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl font-mono text-xs text-[#f8f6f0] focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="text-[#8fa89e] block mb-1">4. Storage Bucket (VITE_FIREBASE_STORAGE_BUCKET):</label>
                <input
                  type="text"
                  placeholder="odiljon-qori-quran.firebasestorage.app"
                  value={firebaseConfig.storageBucket || ''}
                  onChange={(e) =>
                    setFirebaseConfig({ ...firebaseConfig, storageBucket: e.target.value.trim() })
                  }
                  className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl font-mono text-xs text-[#f8f6f0] focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="text-[#8fa89e] block mb-1">5. Messaging Sender ID (VITE_FIREBASE_MESSAGING_SENDER_ID):</label>
                <input
                  type="text"
                  placeholder="123456789012"
                  value={firebaseConfig.messagingSenderId || ''}
                  onChange={(e) =>
                    setFirebaseConfig({ ...firebaseConfig, messagingSenderId: e.target.value.trim() })
                  }
                  className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl font-mono text-xs text-[#f8f6f0] focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="text-[#8fa89e] block mb-1">6. App ID (VITE_FIREBASE_APP_ID):</label>
                <input
                  type="text"
                  placeholder="1:123456789012:web:abcdef123456"
                  value={firebaseConfig.appId || ''}
                  onChange={(e) =>
                    setFirebaseConfig({ ...firebaseConfig, appId: e.target.value.trim() })
                  }
                  className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl font-mono text-xs text-[#f8f6f0] focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveFirebaseConfig}
                  disabled={isTestingDb}
                  className="flex-1 py-2.5 rounded-xl bg-[#d4af37] text-[#041510] font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#f3e5ab] transition-colors"
                >
                  {isTestingDb ? 'Tekshirilmoqda...' : 'Saqlash va Ulanishni Tekshirish'}
                </button>

                <button
                  type="button"
                  onClick={handleResetFirebaseConfig}
                  title="Brauzer keshidagi sozlamalarni tozalab, environment (Secrets) qiymatlariga qaytish"
                  className="py-2.5 px-3 rounded-xl bg-[#041510] hover:bg-rose-950/60 text-[#8fa89e] hover:text-rose-300 border border-[#d4af37]/20 text-xs font-semibold transition-colors"
                >
                  Keshni tozalash
                </button>
              </div>

              {firestoreStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    firestoreStatus.connected
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                      : 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                  }`}
                >
                  {firestoreStatus.connected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <span className="font-bold block">
                      {firestoreStatus.connected ? "Firestore muvaffaqiyatli ulandi!" : "Ulanish xatosi:"}
                    </span>
                    <span>{firestoreStatus.message}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-[#d4af37]/20 pb-3">
              <Download className="w-5 h-5 text-[#d4af37]" />
              <div>
                <h3 className="text-sm font-bold text-[#f8f6f0]">
                  Zaxiralash va Tiklash (Disaster Recovery)
                </h3>
                <p className="text-[11px] text-[#8fa89e]">
                  Ma'lumotlar yo'qolishidan 100% himoya
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-[#8fa89e] leading-relaxed">
                Tizimdagi barcha 114 sura, oyat matnlari, sinxron vaqtlar va sozlamalarni JSON formatida zaxira nusxa qilib yuklab olishingiz mumkin.
              </p>

              <button
                onClick={handleDownloadBackup}
                className="w-full py-2.5 rounded-xl bg-[#124e3b] hover:bg-[#d4af37] text-[#f3e5ab] hover:text-[#041510] border border-[#d4af37]/30 font-bold flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>To'liq Zaxira Faylini Yuklab Olish (JSON)</span>
              </button>

              <div className="pt-3 border-t border-[#d4af37]/20 space-y-2">
                <label className="text-xs font-bold text-[#f8f6f0] block">
                  Avvalgi zaxira nusxasini tiklash (Import):
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="w-full text-xs text-[#8fa89e] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#041510] file:text-[#d4af37] hover:file:bg-[#124e3b]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#f8f6f0]">
                Tizim o'zgarishlari jurnali (Audit Logs)
              </h3>
              <p className="text-[11px] text-[#8fa89e]">
                Barcha admin amallari, tahrirlar va zaxiralashlar xronologiyasi
              </p>
            </div>
            <span className="text-xs text-[#d4af37] font-mono">
              {logs.length} ta yozuv
            </span>
          </div>

          {logs.length > 0 ? (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-[#041510] border border-[#d4af37]/15 flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-[#124e3b] text-[#d4af37] font-mono text-[10px] font-bold">
                        {log.action}
                      </span>
                      <span className="text-[11px] text-[#8fa89e]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[#f8f6f0]">{log.details}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#061d15] text-[#8fa89e] border border-[#d4af37]/20">
                    {log.actor}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-[#8fa89e] text-xs">
              Hozircha tizim jurnali bo'sh.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
