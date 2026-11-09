/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Home View
 */

import React, { useEffect, useState } from 'react';
import { 
  Play, 
  BookOpen, 
  Sparkles, 
  Compass, 
  Clock, 
  ChevronRight, 
  Volume2, 
  Headphones,
  CheckCircle2
} from 'lucide-react';
import { Surah, ListeningHistoryItem } from '../types/quran';
import { getAllSurahs, getListeningHistory } from '../services/storageService';
import { useAudio } from '../context/AudioContext';
import { SurahCard } from '../components/surah/SurahCard';

interface HomeViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenSurah: (surahNumber: number) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigateTab, onOpenSurah }) => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [history, setHistory] = useState<ListeningHistoryItem[]>([]);
  const { playSurah } = useAudio();

  useEffect(() => {
    getAllSurahs().then(setSurahs);
    setHistory(getListeningHistory());
  }, []);

  const lastListened = history[0];
  const lastSurah = lastListened ? surahs.find((s) => s.number === lastListened.surahNumber) : null;

  // Key featured Surahs: Fotiha (1), Yosin (36), Rohman (55), Mulk (67), Ixlos (112)
  const featuredNumbers = [1, 36, 55, 67, 112, 113, 114];
  const featuredSurahs = surahs.filter((s) => featuredNumbers.includes(s.number));

  return (
    <div className="space-y-8 sm:space-y-12 pb-16">
      
      {/* Hero Dedication Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c2e23] via-[#061d15] to-[#030d0a] border border-[#d4af37]/30 shadow-2xl p-6 sm:p-10 lg:p-12 text-[#f8f6f0]">
        
        {/* Background Decorative Star Elements */}
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-[#d4af37]/10 filter blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-[#124e3b]/20 filter blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/30 text-xs text-[#d4af37] font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Xolis ma'rifat va tilovat platformasi</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#f8f6f0] leading-tight font-sans">
            ODILJON QORI <span className="text-[#d4af37]">QUR'ON</span>
          </h1>

          <p className="mt-2 font-arabic text-xl sm:text-2xl text-[#d4af37]/90 leading-relaxed">
            وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا
          </p>

          <p className="mt-3 text-xs sm:text-sm text-[#8fa89e] leading-relaxed max-w-2xl">
            Odiljon Qorining to'liq va mayin tilovatlari, 114 ta suraning asl Usmoniy arabcha matni, o'zbekcha ma'nolari hamda har bir oyat bilan mukammal sinxronlashtirilgan audio pleyer.
          </p>

          {/* Action CTAs */}
          <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('quran')}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8952b] text-[#041510] font-bold text-xs sm:text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#d4af37]/25"
            >
              <BookOpen className="w-4 h-4" />
              <span>114 ta sura ro'yxati</span>
            </button>

            <button
              onClick={() => {
                const fotiha = surahs.find((s) => s.number === 1);
                if (fotiha) playSurah(fotiha);
              }}
              className="px-5 py-3 rounded-xl bg-[#0b2920] hover:bg-[#124e3b] text-[#f3e5ab] font-semibold text-xs sm:text-sm border border-[#d4af37]/30 flex items-center gap-2 transition-all"
            >
              <Play className="w-4 h-4 fill-current text-[#d4af37]" />
              <span>Fotiha surasini tinglash</span>
            </button>
          </div>
        </div>
      </section>

      {/* Quick Resume Listening Section (if history exists) */}
      {lastListened && lastSurah && (
        <section className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#124e3b] border border-[#d4af37]/40 flex items-center justify-center flex-shrink-0">
              <Headphones className="w-6 h-6 text-[#d4af37]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-[#d4af37] font-semibold">
                  Oxirgi tinglangan sura
                </span>
                <span className="text-xs text-[#8fa89e]">•</span>
                <span className="text-xs text-[#8fa89e]">{lastListened.ayahNumber}-oyat</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#f8f6f0]">
                {lastSurah.number}. {lastSurah.nameUzbek} ({lastSurah.nameArabic})
              </h3>
            </div>
          </div>

          <button
            onClick={() => playSurah(lastSurah, lastListened.ayahNumber)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#d4af37] text-[#041510] font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#f3e5ab] transition-colors"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Davom ettirish ({lastListened.percent}%)</span>
          </button>
        </section>
      )}

      {/* Daily Quran Reflection Card */}
      <section className="rounded-2xl bg-[#041510] border border-[#d4af37]/25 p-5 sm:p-7 shadow-lg relative overflow-hidden">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#d4af37] mb-3">
          <Compass className="w-4 h-4" />
          <span>KUN OYATI • TAFSIF VA IBRAT</span>
        </div>

        <p className="font-arabic text-xl sm:text-2xl text-[#f8f6f0] leading-loose dir-rtl text-right sm:text-center my-3">
          «إِنَّ هَٰذَا ٱلْقُرْءَانَ يَهْدِى لِلَّتِى هِىَ أَقْوَمُ»
        </p>

        <p className="text-xs sm:text-sm text-[#8fa89e] text-center font-sans mt-2 max-w-xl mx-auto">
          «Albatta, bu Qur'on eng to'g'ri yo'lga hidoyat qilur va ezgu amallarni qiladigan mo'minlarga ulug' mukofot borligi haqida xushxabar berur.» (Isro surasi, 9-oyat)
        </p>
      </section>

      {/* Highlights & Featured Surahs */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#f8f6f0]">
              Mashhur va ko'p tilovat qilinadigan suralar
            </h2>
            <p className="text-xs text-[#8fa89e]">
              Odiljon Qori tilovatida qalbni taskinlovchi suralar
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('quran')}
            className="text-xs font-semibold text-[#d4af37] hover:text-[#f3e5ab] flex items-center gap-1"
          >
            <span>Barchasi (114)</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredSurahs.map((surah) => (
            <SurahCard
              key={surah.id}
              surah={surah}
              onRead={(num) => onOpenSurah(num)}
              onListen={(s) => playSurah(s)}
            />
          ))}
        </div>
      </section>

      {/* Platform Pillars / Trust Matrix */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#d4af37]/20">
        <div className="p-4 rounded-xl bg-[#061d15] border border-[#d4af37]/20">
          <div className="w-8 h-8 rounded-lg bg-[#d4af37]/15 flex items-center justify-center text-[#d4af37] mb-2 font-bold text-sm">
            114
          </div>
          <h4 className="text-xs font-bold text-[#f8f6f0]">To'liq Qur'on kutubxonasi</h4>
          <p className="text-[11px] text-[#8fa89e] mt-1">
            Barcha 114 sura o'zbekcha tarjimasi va arabcha Usmoniy xati bilan.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#061d15] border border-[#d4af37]/20">
          <div className="w-8 h-8 rounded-lg bg-[#d4af37]/15 flex items-center justify-center text-[#d4af37] mb-2 font-bold text-sm">
            <Volume2 className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-[#f8f6f0]">Oyatma-oyat sinxronizatsiya</h4>
          <p className="text-[11px] text-[#8fa89e] mt-1">
            Qiroat davomida o'qilayotgan oyat avtomatik ravishda yorishadi va siljiydi.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#061d15] border border-[#d4af37]/20">
          <div className="w-8 h-8 rounded-lg bg-[#d4af37]/15 flex items-center justify-center text-[#d4af37] mb-2 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-[#f8f6f0]">Ishonchli va xavfsiz</h4>
          <p className="text-[11px] text-[#8fa89e] mt-1">
            Har bir ma'lumot va vaqt tekshirilgan, soxta audio yoki matnlarsiz.
          </p>
        </div>
      </section>
    </div>
  );
};
