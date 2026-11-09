/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Surah Audio & Ayah Synchronization View
 */

import React, { useEffect, useState, useRef } from 'react';
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  Bookmark, 
  Share2, 
  Copy, 
  Check, 
  Volume2, 
  Sparkles, 
  Settings2,
  Clock,
  Repeat,
  Repeat1
} from 'lucide-react';
import { Surah, Ayah } from '../types/quran';
import { getSurahByNumber, getAyahsForSurahNumber, toggleBookmark, isAyahBookmarked } from '../services/storageService';
import { useAudio } from '../context/AudioContext';
import { useTheme } from '../context/ThemeContext';

interface SurahDetailViewProps {
  surahNumber: number;
  onBack: () => void;
  onOpenSurah: (num: number) => void;
}

export const SurahDetailView: React.FC<SurahDetailViewProps> = ({
  surahNumber,
  onBack,
  onOpenSurah,
}) => {
  const [surah, setSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [copiedAyah, setCopiedAyah] = useState<number | null>(null);

  const {
    currentSurah,
    isPlaying,
    activeAyahNumber,
    playSurah,
    togglePlay,
    seekToAyah,
    repeatMode,
    setRepeatMode,
  } = useAudio();

  const { 
    fontSize, 
    arabicFont, 
    showTranslation, 
    showTransliteration, 
    autoScroll, 
    setAutoScroll 
  } = useTheme();

  const ayahRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    getSurahByNumber(surahNumber).then(setSurah);
    getAyahsForSurahNumber(surahNumber).then(setAyahs);
  }, [surahNumber]);

  // Auto-scroll to active Ayah if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && activeAyahNumber && ayahRefs.current[activeAyahNumber]) {
      ayahRefs.current[activeAyahNumber]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeAyahNumber, autoScroll]);

  if (!surah) {
    return (
      <div className="py-20 text-center text-[#8fa89e]">
        Sura ma'lumotlari yuklanmoqda...
      </div>
    );
  }

  const isCurrentPlaying = currentSurah?.number === surah.number && isPlaying;

  const fontClass = arabicFont === 'scheherazade' ? 'font-scheherazade' : 'font-arabic';
  const fontSizeClass =
    fontSize === 'normal'
      ? 'text-xl sm:text-2xl'
      : fontSize === 'large'
      ? 'text-2xl sm:text-3xl'
      : 'text-3xl sm:text-4xl';

  const handleCopy = (ayah: Ayah) => {
    const text = `${ayah.textArabic}\n${ayah.textUzbek || ''}\n(${surah.nameUzbek} surasi, ${ayah.ayahNumber}-oyat)`;
    navigator.clipboard.writeText(text);
    setCopiedAyah(ayah.ayahNumber);
    setTimeout(() => setCopiedAyah(null), 2000);
  };

  const handleAyahClick = (ayah: Ayah) => {
    if (currentSurah?.number !== surah.number) {
      playSurah(surah, ayah.ayahNumber);
    } else {
      seekToAyah(ayah.ayahNumber);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28">
      
      {/* Top Navigation & Surah Switcher */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#061d15] text-[#8fa89e] hover:text-[#d4af37] border border-[#d4af37]/20 text-xs transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Suriyalar ro'yxatiga</span>
        </button>

        <div className="flex items-center gap-2">
          {surahNumber > 1 && (
            <button
              onClick={() => onOpenSurah(surahNumber - 1)}
              className="p-2 rounded-xl bg-[#061d15] text-[#8fa89e] hover:text-[#f8f6f0] border border-[#d4af37]/20 text-xs"
              title="Oldingi sura"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs font-mono text-[#d4af37]">
            {surah.number} / 114
          </span>
          {surahNumber < 114 && (
            <button
              onClick={() => onOpenSurah(surahNumber + 1)}
              className="p-2 rounded-xl bg-[#061d15] text-[#8fa89e] hover:text-[#f8f6f0] border border-[#d4af37]/20 text-xs"
              title="Keyingi sura"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Hero Surah Card */}
      <div className="relative rounded-3xl bg-gradient-to-b from-[#0a2f24] to-[#041510] border border-[#d4af37]/40 p-6 sm:p-8 text-center text-[#f8f6f0] shadow-2xl overflow-hidden">
        
        {/* Subtle decorative background ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border border-[#d4af37]/10 pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#041510] border border-[#d4af37]/30 text-xs text-[#d4af37]">
            <span>{surah.revelationType === 'Makkah' ? 'Makkiy' : 'Madaniy'}</span>
            <span>•</span>
            <span>{surah.ayahCount} oyat</span>
            <span>•</span>
            <span>{surah.juzNumbers.join(', ')}-pora</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#f8f6f0]">
            {surah.number}. {surah.nameUzbek}
          </h1>

          <p className="text-3xl sm:text-5xl font-arabic text-[#d4af37] leading-relaxed drop-shadow my-2">
            {surah.nameArabic}
          </p>

          <p className="text-xs sm:text-sm text-[#8fa89e]">
            {surah.nameTransliteration} — «{surah.nameMeaning}»
          </p>

          {/* Master Play Button */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                if (currentSurah?.number === surah.number) {
                  togglePlay();
                } else {
                  playSurah(surah);
                }
              }}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#d4af37] to-[#b8952b] text-[#041510] font-bold text-xs sm:text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#d4af37]/20"
            >
              {isCurrentPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>To'xtatish</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Tilovatni tinglash</span>
                </>
              )}
            </button>

            {/* Auto-Scroll Toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                autoScroll
                  ? 'bg-[#124e3b] text-[#f3e5ab] border-[#d4af37]'
                  : 'bg-[#061d15] text-[#8fa89e] border-[#d4af37]/20 hover:text-[#f8f6f0]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Avto-siljish: {autoScroll ? 'Yoqilgan' : 'O\'chirilgan'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bismillah Header (except Surah 9 At-Tawbah) */}
      {surah.number !== 9 && (
        <div className="text-center py-6 border-b border-[#d4af37]/20">
          <p className="font-arabic text-2xl sm:text-3xl text-[#d4af37] leading-loose drop-shadow">
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </p>
          <p className="text-xs text-[#8fa89e] mt-1">
            Mehribon va rahmli Alloh nomi bilan (boshlayman)
          </p>
        </div>
      )}

      {/* Ayah Stream */}
      <div className="space-y-4">
        {ayahs.map((ayah) => {
          const isActive = activeAyahNumber === ayah.ayahNumber;
          const bookmarked = isAyahBookmarked(surah.number, ayah.ayahNumber);
          const hasTimestamp = ayah.startMs !== null;

          return (
            <div
              key={ayah.id}
              ref={(el) => {
                ayahRefs.current[ayah.ayahNumber] = el;
              }}
              onClick={() => handleAyahClick(ayah)}
              className={`group relative rounded-2xl p-4 sm:p-6 transition-all duration-300 border cursor-pointer ${
                isActive
                  ? 'bg-[#0d3b2c] border-[#d4af37] shadow-xl shadow-[#d4af37]/20 ring-1 ring-[#d4af37]'
                  : 'bg-[#061d15]/80 hover:bg-[#08261c] border-[#d4af37]/20 hover:border-[#d4af37]/50'
              }`}
            >
              {/* Ayah Top Control Strip */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#d4af37]/10">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-[#041510] border border-[#d4af37]/30 text-xs font-bold text-[#d4af37] flex items-center justify-center font-mono">
                    {ayah.ayahNumber}
                  </span>
                  
                  {isActive && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#d4af37] text-[#041510] font-bold flex items-center gap-1 animate-pulse">
                      <Volume2 className="w-3 h-3" /> Tilovat qilinmoqda
                    </span>
                  )}

                  {ayah.timestampStatus === 'verified' && (
                    <span className="hidden sm:inline-flex text-[10px] text-emerald-400 items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Sinxronlangan
                    </span>
                  )}
                </div>

                {/* Actions: Bookmark, Copy, Play */}
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleCopy(ayah)}
                    className="p-1.5 rounded-lg text-[#8fa89e] hover:text-[#d4af37] hover:bg-[#041510] transition-colors"
                    title="Nusxa olish"
                  >
                    {copiedAyah === ayah.ayahNumber ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      toggleBookmark({
                        surahNumber: surah.number,
                        ayahNumber: ayah.ayahNumber,
                        surahName: surah.nameUzbek,
                        textArabic: ayah.textArabic,
                        textUzbek: ayah.textUzbek,
                        timestampMs: ayah.startMs || 0,
                      });
                      // force re-render
                      setAyahs([...ayahs]);
                    }}
                    className="p-1.5 rounded-lg text-[#8fa89e] hover:text-[#d4af37] hover:bg-[#041510] transition-colors"
                    title="Sevimlilarga qo'shish"
                  >
                    <Bookmark
                      className={`w-4 h-4 ${bookmarked ? 'fill-[#d4af37] text-[#d4af37]' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Arabic Quranic Text */}
              <p
                className={`${fontClass} ${fontSizeClass} text-[#f8f6f0] leading-loose text-right dir-rtl my-2 font-normal select-text`}
              >
                {ayah.textArabic}
                <span className="inline-block mx-2 text-[#d4af37] font-sans text-sm align-middle font-bold">
                  ﴿{ayah.ayahNumber}﴾
                </span>
              </p>

              {/* Transliteration (if enabled) */}
              {showTransliteration && ayah.transliteration && (
                <p className="text-xs text-[#d4af37]/80 italic mt-2 font-sans select-text">
                  {ayah.transliteration}
                </p>
              )}

              {/* Uzbek Translation (if enabled) */}
              {showTranslation && ayah.textUzbek && (
                <p className="text-xs sm:text-sm text-[#8fa89e] mt-2 font-sans leading-relaxed select-text">
                  {ayah.textUzbek}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
