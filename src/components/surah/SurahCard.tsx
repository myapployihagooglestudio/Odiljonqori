/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Surah Card Component
 */

import React from 'react';
import { Play, BookOpen, Volume2, Clock } from 'lucide-react';
import { Surah } from '../../types/quran';
import { useAudio } from '../../context/AudioContext';

interface SurahCardProps {
  surah: Surah;
  onRead: (surahNumber: number) => void;
  onListen?: (surah: Surah) => void;
}

export const SurahCard: React.FC<SurahCardProps> = ({ surah, onRead, onListen }) => {
  const { playSurah, currentSurah, isPlaying } = useAudio();

  const isCurrentPlaying = currentSurah?.number === surah.number && isPlaying;
  const hasAudio = Boolean(surah.audioUrl);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onListen) {
      onListen(surah);
    } else {
      playSurah(surah);
    }
  };

  return (
    <div 
      onClick={() => onRead(surah.number)}
      className={`group relative rounded-2xl p-4 sm:p-5 transition-all duration-300 cursor-pointer border ${
        isCurrentPlaying
          ? 'bg-gradient-to-br from-[#0c2f24] to-[#041510] border-[#d4af37] shadow-xl shadow-[#d4af37]/15 ring-1 ring-[#d4af37]'
          : 'bg-[#061d15]/80 hover:bg-[#092b21] border-[#d4af37]/20 hover:border-[#d4af37]/60 shadow-lg hover:shadow-xl'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        
        {/* Left: Surah Number in Islamic star medallion */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#041510] border border-[#d4af37]/40 flex items-center justify-center flex-shrink-0 group-hover:border-[#d4af37] transition-colors shadow-inner">
            <span className="text-xs sm:text-sm font-bold text-[#d4af37] font-mono">
              {surah.number}
            </span>
          </div>

          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#f8f6f0] group-hover:text-[#d4af37] transition-colors">
              {surah.nameUzbek}
            </h3>
            <p className="text-[11px] text-[#8fa89e]">
              {surah.nameMeaning}
            </p>
          </div>
        </div>

        {/* Right: Authentic Arabic Calligraphy */}
        <div className="text-right">
          <span className="font-arabic text-xl sm:text-2xl text-[#d4af37] leading-tight block">
            {surah.nameArabic}
          </span>
          <span className="text-[10px] text-[#8fa89e]">
            {surah.nameTransliteration}
          </span>
        </div>
      </div>

      {/* Meta details & badges */}
      <div className="flex items-center justify-between pt-2 border-t border-[#d4af37]/10 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#041510] border border-[#d4af37]/20 text-[#8fa89e]">
            {surah.revelationType === 'Makkah' ? 'Makkiy' : 'Madaniy'}
          </span>
          <span className="text-[10px] text-[#8fa89e]">
            {surah.ayahCount} oyat
          </span>
        </div>

        {/* Audio status indicator badge */}
        <div className="flex items-center gap-1.5">
          {hasAudio ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-medium">
              <Volume2 className="w-3 h-3" /> Audio mavjud
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300/80 border border-amber-500/20 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Kutilmoqda
            </span>
          )}
        </div>
      </div>

      {/* Hover Action Strip */}
      <div className="mt-3 pt-3 border-t border-[#d4af37]/15 flex items-center gap-2">
        <button
          onClick={handlePlayClick}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            isCurrentPlaying
              ? 'bg-[#d4af37] text-[#041510]'
              : 'bg-[#0a2f24] hover:bg-[#d4af37] text-[#f8f6f0] hover:text-[#041510] border border-[#d4af37]/30'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isCurrentPlaying ? "Tinglanmoqda" : "Tinglash"}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRead(surah.number);
          }}
          className="py-1.5 px-3 rounded-xl text-xs font-medium bg-[#041510] hover:bg-[#0a2f24] text-[#8fa89e] hover:text-[#d4af37] border border-[#d4af37]/20 transition-all flex items-center gap-1"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>O'qish</span>
        </button>
      </div>
    </div>
  );
};
