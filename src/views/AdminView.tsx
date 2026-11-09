/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Comprehensive & Secure Admin Panel
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Key, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Music, 
  Clock, 
  Save, 
  RotateCcw, 
  Download, 
  FileJson, 
  Search, 
  Layers, 
  Sliders, 
  Activity, 
  Play, 
  Pause,
  Database,
  ExternalLink
} from 'lucide-react';
import { Surah, Ayah, AdminLog, VersionSnapshot } from '../types/quran';
import { 
  getAllSurahs, 
  updateSurah, 
  getAyahsForSurahNumber, 
  saveAyahsForSurah, 
  getAdminLogs, 
  exportFullDatabaseBackup, 
  importFullDatabaseBackup, 
  testFirestoreConnection,
  getSnapshotsForSurah,
  restoreSnapshot
} from '../services/storageService';
import { getStoredFirebaseConfig, saveStoredFirebaseConfig, type FirebaseRuntimeConfig } from '../services/firebase';

export const AdminView: React.FC = () => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('odiljon_admin_logged_in') === 'true';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Admin Workspace State
  const [activeTab, setActiveTab] = useState<'surahs' | 'sync_studio' | 'firebase_backup' | 'logs'>('surahs');
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);

  // Sync Studio State
  const [syncSurahNumber, setSyncSurahNumber] = useState<number>(1);
  const [syncAyahs, setSyncAyahs] = useState<Ayah[]>([]);
  const [studioAudioCurrentTime, setStudioAudioCurrentTime] = useState<number>(0);
  const [studioIsPlaying, setStudioIsPlaying] = useState<boolean>(false);
  const studioAudioRef = useRef<HTMLAudioElement | null>(null);

  // Firebase & Backup State
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseRuntimeConfig>(() => {
    return getStoredFirebaseConfig() || { projectId: '', apiKey: '', authDomain: '', storageBucket: '' };
  });
  const [firestoreStatus, setFirestoreStatus] = useState<{ connected: boolean; message: string } | null>(null);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = () => {
    getAllSurahs().then(setSurahs);
    getAdminLogs().then(setLogs);
  };

  useEffect(() => {
    if (syncSurahNumber) {
      getAyahsForSurahNumber(syncSurahNumber).then(setSyncAyahs);
    }
  }, [syncSurahNumber]);

  // Audio Playhead handler in studio
  useEffect(() => {
    const audio = studioAudioRef.current;
    if (!audio) return;

    const handleTime = () => setStudioAudioCurrentTime(audio.currentTime);
    const handlePlay = () => setStudioIsPlaying(true);
    const handlePause = () => setStudioIsPlaying(false);

    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [studioAudioRef.current]);

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === 'admin' && password.trim() === 'odiljon_qori_admin_2026') {
      setIsAuthenticated(true);
      localStorage.setItem('odiljon_admin_logged_in', 'true');
      setAuthError('');
    } else {
      setAuthError('Foydalanuvchi nomi yoki parol noto\'g\'ri.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('odiljon_admin_logged_in');
  };

  // Surah Edit Save
  const handleSaveSurah = async () => {
    if (!selectedSurah) return;
    setSaveMessage('Saqlanmoqda...');
    const res = await updateSurah(selectedSurah, 'Admin');
    if (res.success) {
      setSaveMessage('Surah ma\'lumotlari muvaffaqiyatli saqlandi!');
      loadData();
      setTimeout(() => setSaveMessage(null), 3000);
    } else {
      setSaveMessage(`Xatolik: ${res.error}`);
    }
  };

  // Sync Studio: Mark current audio time for Ayah
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

  // Save Synchronized Ayahs
  const handleSaveAyahTimestamps = async () => {
    // Validate bounds and overlaps
    let hasOverlap = false;
    for (let i = 0; i < syncAyahs.length - 1; i++) {
      const cur = syncAyahs[i];
      const next = syncAyahs[i + 1];
      if (cur.endMs !== null && next.startMs !== null && cur.endMs > next.startMs) {
        hasOverlap = true;
        break;
      }
    }

    if (hasOverlap) {
      if (!confirm("Diqqat: Ayrim oyatlarning vaqt chegaralarida kesishish (overlap) mavjud. Baribir saqlashni xohlaysizmi?")) {
        return;
      }
    }

    setSaveMessage('Oyatlarning vaqt belgilari saqlanmoqda...');
    const res = await saveAyahsForSurah(syncSurahNumber, syncAyahs, 'Admin');
    if (res.success) {
      setSaveMessage('Vaqt belgilari muvaffaqiyatli tekshirildi va saqlandi!');
      loadData();
      setTimeout(() => setSaveMessage(null), 3000);
    } else {
      setSaveMessage(`Xatolik: ${res.error}`);
    }
  };

  // Firebase Config Save
  const handleSaveFirebaseConfig = async () => {
    saveStoredFirebaseConfig(firebaseConfig);
    setSaveMessage("Firebase sozlamalari saqlandi. Ulanish tekshirilmoqda...");
    setIsTestingDb(true);
    const status = await testFirestoreConnection();
    setFirestoreStatus(status);
    setIsTestingDb(false);
  };

  // Database Backup Export
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

  // Database Backup Import
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const res = await importFullDatabaseBackup(content);
      setImportNotice(res.message);
      if (res.success) {
        loadData();
      }
    };
    reader.readAsText(file);
  };

  // --- LOGIN VIEW (IF NOT AUTHENTICATED) ---
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-3xl bg-[#061d15] border border-[#d4af37]/40 shadow-2xl text-[#f8f6f0]">
        <div className="text-center space-y-2 mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#124e3b] p-[1.5px] flex items-center justify-center">
            <div className="w-full h-full bg-[#041510] rounded-[14px] flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-[#d4af37]" />
            </div>
          </div>
          <h2 className="text-xl font-bold">Admin boshqaruv paneli</h2>
          <p className="text-xs text-[#8fa89e]">
            ODILJON QORI QUR'ON tizimi ma'lumotlarini tahrirlash uchun tizimga kiring
          </p>
        </div>

        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-[#8fa89e] block mb-1">Foydalanuvchi nomi</label>
            <div className="relative">
              <Key className="w-4 h-4 text-[#8fa89e] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
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
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952b] text-[#041510] font-bold text-xs uppercase tracking-wider hover:opacity-95 transition-opacity"
          >
            Tizimga kirish
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#d4af37]/15 text-[11px] text-[#8fa89e] text-center">
          <p>Birlamchi xavfsiz login: <code className="text-[#d4af37]">admin</code></p>
          <p>Birlamchi parol: <code className="text-[#d4af37]">odiljon_qori_admin_2026</code></p>
        </div>
      </div>
    );
  }

  // --- AUTHENTICATED ADMIN DASHBOARD ---

  const totalWithAudio = surahs.filter((s) => Boolean(s.audioUrl)).length;
  const totalVerifiedSync = surahs.filter((s) => s.timestampsVerified).length;
  const filteredSurahs = surahs.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.nameUzbek.toLowerCase().includes(q) ||
      s.nameArabic.includes(q) ||
      s.number.toString() === q
    );
  });

  const syncTargetSurah = surahs.find((s) => s.number === syncSurahNumber) || surahs[0];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-28 text-[#f8f6f0]">
      
      {/* Top Admin Navigation Bar */}
      <div className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#124e3b] border border-[#d4af37]/40 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#d4af37]" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[#f8f6f0]">
              ODILJON QORI QUR'ON — Boshqaruv Markazi
            </h1>
            <p className="text-[11px] text-[#8fa89e]">
              114 ta sura, audio fayllar va oyat sinxronizatsiyasini to'liq nazorat qilish
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-500/20 text-xs flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Chiqish</span>
          </button>
        </div>
      </div>

      {/* Global Status Banner / Message */}
      {saveMessage && (
        <div className="p-3.5 rounded-xl bg-[#124e3b] border border-[#d4af37] text-xs text-[#f3e5ab] flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#d4af37]" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Metric Cards (114 Surahs Health Monitor) */}
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

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 border-b border-[#d4af37]/20 pb-2 overflow-x-auto">
        {[
          { id: 'surahs', label: '114 ta Sura Ro\'yxati', icon: Layers },
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

      {/* --- TAB 1: 114 SURAHS MANAGER --- */}
      {activeTab === 'surahs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 text-[#8fa89e] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Surani qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#061d15] border border-[#d4af37]/30 text-xs text-[#f8f6f0] focus:outline-none"
              />
            </div>
            <span className="text-xs text-[#8fa89e]">
              {filteredSurahs.length} ta sura ko'rsatilmoqda
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Surah Table List */}
            <div className="lg:col-span-2 bg-[#061d15] border border-[#d4af37]/20 rounded-2xl overflow-hidden divide-y divide-[#d4af37]/10 max-h-[600px] overflow-y-auto">
              {filteredSurahs.map((surah) => {
                const isSelected = selectedSurah?.number === surah.number;
                return (
                  <div
                    key={surah.id}
                    onClick={() => setSelectedSurah(surah)}
                    className={`p-3.5 hover:bg-[#092b21] cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-[#124e3b]/50 border-l-4 border-l-[#d4af37]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-[#041510] text-[#d4af37] text-xs font-mono font-bold flex items-center justify-center border border-[#d4af37]/20">
                        {surah.number}
                      </span>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-[#f8f6f0]">
                          {surah.nameUzbek}
                        </h4>
                        <span className="text-[10px] text-[#8fa89e]">
                          {surah.revelationType === 'Makkah' ? 'Makkiy' : 'Madaniy'} • {surah.ayahCount} oyat
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <span className="font-arabic text-base text-[#d4af37]">
                        {surah.nameArabic}
                      </span>
                      {surah.audioUrl ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                          Audio bor
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/30">
                          Kutilmoqda
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Selected Surah Editor Panel */}
            <div className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-5 space-y-4">
              {selectedSurah ? (
                <>
                  <div className="border-b border-[#d4af37]/20 pb-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#d4af37] font-bold">
                        Surani tahrirlash
                      </span>
                      <h3 className="text-base font-bold text-[#f8f6f0]">
                        {selectedSurah.number}. {selectedSurah.nameUzbek}
                      </h3>
                    </div>
                    <span className="font-arabic text-2xl text-[#d4af37]">
                      {selectedSurah.nameArabic}
                    </span>
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
                        className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl text-xs text-[#f8f6f0] focus:outline-none"
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
                        className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl text-xs text-[#f8f6f0] font-arabic focus:outline-none dir-rtl"
                      />
                    </div>

                    <div>
                      <label className="text-[#8fa89e] block mb-1">Ma'nosi (tarjimasi):</label>
                      <input
                        type="text"
                        value={selectedSurah.nameMeaning}
                        onChange={(e) =>
                          setSelectedSurah({ ...selectedSurah, nameMeaning: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl text-xs text-[#f8f6f0] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[#8fa89e] block mb-1">
                        Audio URL manzili (Firebase Storage yoki CDN link):
                      </label>
                      <input
                        type="text"
                        placeholder="https://.../recitations/001.mp3"
                        value={selectedSurah.audioUrl || ''}
                        onChange={(e) =>
                          setSelectedSurah({
                            ...selectedSurah,
                            audioUrl: e.target.value.trim() || null,
                            audioStatus: e.target.value.trim() ? 'uploaded_unverified' : 'missing',
                          })
                        }
                        className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl text-xs text-[#f8f6f0] font-mono focus:outline-none"
                      />
                    </div>

                    {/* Audio Status */}
                    <div>
                      <label className="text-[#8fa89e] block mb-1">Audio holati:</label>
                      <select
                        value={selectedSurah.audioStatus}
                        onChange={(e) =>
                          setSelectedSurah({
                            ...selectedSurah,
                            audioStatus: e.target.value as any,
                          })
                        }
                        className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl text-xs text-[#f8f6f0] focus:outline-none cursor-pointer"
                      >
                        <option value="missing">Audio kutilmoqda (missing)</option>
                        <option value="uploaded_unverified">Yuklangan, tekshirilmoqda (uploaded_unverified)</option>
                        <option value="verified">To'liq tasdiqlangan (verified)</option>
                      </select>
                    </div>

                    {/* Publishing Toggle */}
                    <div className="pt-2">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-[#041510] border border-[#d4af37]/20 cursor-pointer">
                        <div>
                          <span className="font-bold text-[#f8f6f0] block">Omma uchun nashr etish</span>
                          <span className="text-[10px] text-[#8fa89e]">
                            Yoqilsa foydalanuvchilar ilovada ushbu surani ko'ra oladi
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
                      className="flex-1 py-2.5 rounded-xl bg-[#d4af37] text-[#041510] font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#f3e5ab] transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      <span>O'zgarishlarni saqlash</span>
                    </button>

                    <button
                      onClick={() => {
                        setSyncSurahNumber(selectedSurah.number);
                        setActiveTab('sync_studio');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-[#124e3b] text-[#f3e5ab] font-bold text-xs flex items-center gap-1.5 hover:bg-[#d4af37] hover:text-[#041510] transition-colors"
                      title="Oyatlar vaqtini tahrirlash"
                    >
                      <Sliders className="w-4 h-4" />
                      <span>Sinxronlash</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-[#8fa89e] text-xs">
                  Tahrirlash uchun chap tarafdagi ro'yxatdan birorta surani tanlang.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: AYAH AUDIO TIMESTAMP SYNCHRONIZER STUDIO --- */}
      {activeTab === 'sync_studio' && (
        <div className="space-y-4">
          <div className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            
            {/* Surah Picker for Studio */}
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

              {/* Studio Audio Player */}
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
                  Ushbu sura uchun audio link kiritilmagan. Avval 1-tabda audio manzilini kiriting.
                </div>
              )}
            </div>

            {/* Ayahs Timestamp Grid */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              <div className="text-[11px] text-[#8fa89e] flex items-center justify-between pb-1">
                <span>Oyatlarni tinglang va ayni vaqtni belgilash uchun "Belgilash" tugmasini bosing:</span>
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

                  {/* Millisecond Controls */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Start Ms */}
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
                        title="Ayni audio vaqtini boshlanishiga yozish"
                      >
                        Hozirgi
                      </button>
                    </div>

                    {/* End Ms */}
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
                        title="Ayni audio vaqtini tugashiga yozish"
                      >
                        Hozirgi
                      </button>
                    </div>

                    {/* Test Audio for this ayah */}
                    {ayah.startMs !== null && studioAudioRef.current && (
                      <button
                        onClick={() => {
                          if (studioAudioRef.current && ayah.startMs !== null) {
                            studioAudioRef.current.currentTime = ayah.startMs / 1000;
                            studioAudioRef.current.play();
                          }
                        }}
                        className="p-1.5 rounded-lg bg-[#061d15] hover:bg-[#d4af37] text-[#8fa89e] hover:text-[#041510] border border-[#d4af37]/20"
                        title="Oyat audiosini tinglab tekshirish"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Save Action */}
            <div className="pt-3 border-t border-[#d4af37]/20 flex items-center justify-between">
              <span className="text-xs text-[#8fa89e]">
                Barcha vaqtlar tekshirilib, xatoliklarsiz saqlanadi.
              </span>

              <button
                onClick={handleSaveAyahTimestamps}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952b] text-[#041510] font-bold text-xs flex items-center gap-2 hover:opacity-95"
              >
                <Save className="w-4 h-4" />
                <span>Oyatlarning barcha vaqtlarini saqlash</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: FIREBASE & BACKUP ENGINE --- */}
      {activeTab === 'firebase_backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Firebase Settings Box */}
          <div className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-[#d4af37]/20 pb-3">
              <Database className="w-5 h-5 text-[#d4af37]" />
              <div>
                <h3 className="text-sm font-bold text-[#f8f6f0]">
                  Firebase Firestore Ulanishi
                </h3>
                <p className="text-[11px] text-[#8fa89e]">
                  Haqiqiy bulutli ma'lumotlar bazasi konfiguratsiyasi
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#8fa89e] block mb-1">Firebase Project ID:</label>
                <input
                  type="text"
                  placeholder="masalan: odiljon-qori-quran"
                  value={firebaseConfig.projectId || ''}
                  onChange={(e) =>
                    setFirebaseConfig({ ...firebaseConfig, projectId: e.target.value.trim() })
                  }
                  className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl font-mono text-xs text-[#f8f6f0] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[#8fa89e] block mb-1">Firebase API Key:</label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={firebaseConfig.apiKey || ''}
                  onChange={(e) =>
                    setFirebaseConfig({ ...firebaseConfig, apiKey: e.target.value.trim() })
                  }
                  className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl font-mono text-xs text-[#f8f6f0] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[#8fa89e] block mb-1">Storage Bucket:</label>
                <input
                  type="text"
                  placeholder="odiljon-qori-quran.appspot.com"
                  value={firebaseConfig.storageBucket || ''}
                  onChange={(e) =>
                    setFirebaseConfig({ ...firebaseConfig, storageBucket: e.target.value.trim() })
                  }
                  className="w-full px-3 py-2 bg-[#041510] border border-[#d4af37]/30 rounded-xl font-mono text-xs text-[#f8f6f0] focus:outline-none"
                />
              </div>

              <button
                onClick={handleSaveFirebaseConfig}
                disabled={isTestingDb}
                className="w-full py-2.5 rounded-xl bg-[#d4af37] text-[#041510] font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#f3e5ab] transition-colors"
              >
                {isTestingDb ? 'Tekshirilmoqda...' : 'Saqlash va Ulanishni Tekshirish'}
              </button>

              {/* Firestore Connection status banner */}
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
                      {firestoreStatus.connected ? "Firestore faol!" : "Eslatma:"}
                    </span>
                    <span>{firestoreStatus.message}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Backup & Disaster Recovery Box */}
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
                Tizimdagi barcha 114 sura, oyat matnlari, sinxron vaqtlar va sozlamalarni yagona JSON formatidagi fayl sifatida zaxira nusxa qilib yuklab olishingiz mumkin.
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

              {importNotice && (
                <div className="p-3 rounded-xl bg-[#041510] border border-[#d4af37]/30 text-xs text-[#d4af37]">
                  {importNotice}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 4: AUDIT LOGS --- */}
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
