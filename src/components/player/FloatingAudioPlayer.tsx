/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Floating Audio Player
 */

import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw, Maximize2, X, AlertCircle } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';

export const FloatingAudioPlayer: React.FC = () => {
  const {
    currentSurah,
    isPlaying,
    currentTime,
    duration,
    activeAyahNumber,
    togglePlay,
    playNext,
    playPrevious,
    skipTime,
    seekTo,
    setPlayerModalOpen,
    audioNotice,
    clearAudioNotice,
  } = useAudio();

  if (!currentSurah) {
    return null;
  }

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* Notice Alert Banner (if audio missing or note) */}
      {audioNotice && (
        <div className="fixed bottom-20 lg:bottom-24 left-4 right-4 max-w-xl mx-auto z-40 animate-slideUp">
          <div className="bg-[#0b1c16] border border-[#d4af37]/40 text-[#f8f6f0] p-3.5 rounded-2xl shadow-2xl flex items-start gap-3 backdrop-blur-md">
            <AlertCircle className="w-5 h-5 text-[#d4af37] flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-xs leading-relaxed">
              <span className="font-bold text-[#d4af37] block mb-0.5">Xabarnoma:</span>
              {audioNotice}
            </div>
            <button
              onClick={clearAudioNotice}
              className="text-[#8fa89e] hover:text-[#f8f6f0] p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Persistent Floating Bar */}
      <div className="fixed bottom-16 lg:bottom-4 left-2 right-2 sm:left-4 sm:right-4 max-w-4xl mx-auto z-30">
        <div className="bg-[#061d15]/95 backdrop-blur-xl border border-[#d4af37]/30 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden text-[#f8f6f0]">
          
          {/* Top subtle progress line */}
          <div 
            className="w-full bg-[#0a2f24] h-1 cursor-pointer relative group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              seekTo(pos * duration);
            }}
          >
            <div 
              className="h-full bg-gradient-to-r from-[#d4af37] to-[#f3e5ab] relative transition-all"
              style={{ width: `${progressPercent}%` }}
            >
              <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#f8f6f0] rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
            
            {/* Surah Info & Calligraphy badge */}
            <div 
              onClick={() => setPlayerModalOpen(true)}
              className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#124e3b] to-[#041510] border border-[#d4af37]/40 flex items-center justify-center flex-shrink-0 shadow-inner group-hover:border-[#d4af37] transition-colors">
                <span className="text-xs font-bold text-[#d4af37] font-serif">
                  {currentSurah.number}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-[#f8f6f0] truncate group-hover:text-[#d4af37] transition-colors">
                    {currentSurah.nameUzbek}
                  </h4>
                  {activeAyahNumber && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 font-medium whitespace-nowrap">
                      {activeAyahNumber}-oyat
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#8fa89e]">
                  <span className="font-arabic text-xs text-[#d4af37]/90">{currentSurah.nameArabic}</span>
                  <span>•</span>
                  <span>Odiljon Qori</span>
                </div>
              </div>
            </div>

            {/* Time Indicator (Desktop) */}
            <div className="hidden md:flex items-center gap-1 text-[11px] font-mono text-[#8fa89e]">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Player Controls */}
            <div className="flex items-center gap-1 sm:gap-2">
              
              {/* -10s */}
              <button
                onClick={() => skipTime(-10)}
                className="p-1.5 text-[#8fa89e] hover:text-[#f8f6f0] hover:bg-[#0b2920] rounded-lg transition-colors hidden sm:block"
                title="10 soniya orqaga"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Previous Surah */}
              <button
                onClick={playPrevious}
                className="p-1.5 text-[#8fa89e] hover:text-[#f8f6f0] hover:bg-[#0b2920] rounded-lg transition-colors"
                title="Oldingi sura"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Play / Pause Primary Button */}
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-gradient-to-r from-[#d4af37] to-[#b8952b] text-[#041510] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-[#d4af37]/20"
                title={isPlaying ? "To'xtatish" : "Tinglash"}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              {/* Next Surah */}
              <button
                onClick={playNext}
                className="p-1.5 text-[#8fa89e] hover:text-[#f8f6f0] hover:bg-[#0b2920] rounded-lg transition-colors"
                title="Keyingi sura"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* +10s */}
              <button
                onClick={() => skipTime(10)}
                className="p-1.5 text-[#8fa89e] hover:text-[#f8f6f0] hover:bg-[#0b2920] rounded-lg transition-colors hidden sm:block"
                title="10 soniya oldinga"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Fullscreen Expand */}
              <button
                onClick={() => setPlayerModalOpen(true)}
                className="p-1.5 text-[#8fa89e] hover:text-[#d4af37] hover:bg-[#0b2920] rounded-lg transition-colors ml-1"
                title="To'liq ekranda ochish"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
