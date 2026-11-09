/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Fullscreen Audio Player Modal
 */

import React, { useState } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw, 
  RotateCw, 
  Repeat, 
  Repeat1, 
  Volume2, 
  ListMusic, 
  Sparkles,
  Bookmark
} from 'lucide-react';
import { useAudio } from '../../context/AudioContext';
import { toggleBookmark, isAyahBookmarked } from '../../services/storageService';

export const FullAudioPlayerModal: React.FC = () => {
  const {
    currentSurah,
    currentAyahs,
    isPlaying,
    currentTime,
    duration,
    activeAyahNumber,
    playbackSpeed,
    repeatMode,
    isPlayerModalOpen,
    togglePlay,
    seekTo,
    seekToAyah,
    skipTime,
    setPlaybackSpeed,
    setRepeatMode,
    playNext,
    playPrevious,
    setPlayerModalOpen,
  } = useAudio();

  const [showAyahList, setShowAyahList] = useState(false);
  const [speedDropdownOpen, setSpeedDropdownOpen] = useState(false);

  if (!isPlayerModalOpen || !currentSurah) {
    return null;
  }

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const speeds = [0.75, 1, 1.25, 1.5, 2];

  const cycleRepeat = () => {
    if (repeatMode === 'off') setRepeatMode('playlist');
    else if (repeatMode === 'playlist') setRepeatMode('surah');
    else setRepeatMode('off');
  };

  const activeAyah = currentAyahs.find((a) => a.ayahNumber === activeAyahNumber) || currentAyahs[0];

  return (
    <div className="fixed inset-0 z-50 bg-[#030d0a]/95 backdrop-blur-2xl text-[#f8f6f0] flex flex-col justify-between overflow-y-auto p-4 sm:p-6 lg:p-8 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
        <button
          onClick={() => setPlayerModalOpen(false)}
          className="p-2.5 rounded-full bg-[#061d15] border border-[#d4af37]/30 text-[#8fa89e] hover:text-[#f8f6f0] hover:border-[#d4af37] transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#d4af37]">
            Tinglanmoqda • Odiljon Qori
          </span>
          <h2 className="text-base sm:text-lg font-bold text-[#f8f6f0]">
            {currentSurah.number}. {currentSurah.nameUzbek}
          </h2>
        </div>

        <button
          onClick={() => setShowAyahList(!showAyahList)}
          className={`p-2.5 rounded-full border transition-all ${
            showAyahList
              ? 'bg-[#d4af37] text-[#041510] border-[#d4af37]'
              : 'bg-[#061d15] border-[#d4af37]/30 text-[#8fa89e] hover:text-[#f8f6f0]'
          }`}
          title="Oyatlar ro'yxati"
        >
          <ListMusic className="w-5 h-5" />
        </button>
      </div>

      {/* Main Center Content */}
      <div className="max-w-2xl mx-auto w-full py-6 flex-1 flex flex-col justify-center items-center">
        
        {!showAyahList ? (
          <>
            {/* Visualizer Calligraphy Emblem */}
            <div className="relative my-4 flex items-center justify-center">
              {/* Outer Golden Glow */}
              <div className={`w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-gradient-to-tr from-[#d4af37]/20 via-[#124e3b]/30 to-[#d4af37]/10 absolute filter blur-xl ${isPlaying ? 'animate-subtle-pulse' : ''}`} />
              
              {/* Sacred Medallion Circle */}
              <div className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-full bg-gradient-to-b from-[#0a2f24] to-[#041510] border-2 border-[#d4af37]/50 shadow-2xl flex flex-col items-center justify-center p-6 text-center">
                <div className="w-40 h-40 rounded-full border border-[#d4af37]/20 flex flex-col items-center justify-center bg-[#061d15]/80 p-4">
                  <span className="text-3xl sm:text-4xl font-arabic text-[#d4af37] leading-relaxed drop-shadow">
                    {currentSurah.nameArabic}
                  </span>
                  <span className="text-xs text-[#8fa89e] mt-1">
                    {currentSurah.nameMeaning}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Synchronized Active Ayah Card */}
            {activeAyah && (
              <div className="w-full mt-4 p-4 rounded-2xl bg-[#061d15]/90 border border-[#d4af37]/30 shadow-lg text-center transition-all">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 font-semibold">
                    {activeAyah.ayahNumber}-oyat
                  </span>
                  {activeAyah.timestampStatus === 'verified' && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Sinxronlashtirilgan
                    </span>
                  )}
                </div>

                <p className="font-arabic text-xl sm:text-2xl text-[#f8f6f0] leading-loose mb-2 dir-rtl">
                  {activeAyah.textArabic}
                </p>

                {activeAyah.textUzbek && (
                  <p className="text-xs sm:text-sm text-[#8fa89e] font-sans">
                    {activeAyah.textUzbek}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          /* Interactive Ayahs Quick-Seek Drawer */
          <div className="w-full h-80 sm:h-96 overflow-y-auto space-y-2 p-3 bg-[#061d15]/80 border border-[#d4af37]/30 rounded-2xl">
            <div className="sticky top-0 bg-[#061d15] pb-2 border-b border-[#d4af37]/20 mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-[#d4af37]">
                Oyatlar ({currentAyahs.length} ta)
              </span>
              <span className="text-[11px] text-[#8fa89e]">
                Oyat ustiga bosing — audio o'sha joydan boshlanadi
              </span>
            </div>

            {currentAyahs.map((ayah) => {
              const isActive = activeAyahNumber === ayah.ayahNumber;
              const bookmarked = isAyahBookmarked(currentSurah.number, ayah.ayahNumber);
              return (
                <div
                  key={ayah.id}
                  onClick={() => seekToAyah(ayah.ayahNumber)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border flex items-start justify-between gap-3 ${
                    isActive
                      ? 'bg-[#124e3b]/50 border-[#d4af37] shadow-md'
                      : 'bg-[#041510]/50 border-transparent hover:border-[#d4af37]/30 hover:bg-[#07241c]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#d4af37]/20 text-[#d4af37] text-xs flex items-center justify-center font-bold flex-shrink-0">
                      {ayah.ayahNumber}
                    </span>
                    <p className="font-arabic text-sm text-[#f8f6f0] truncate max-w-xs sm:max-w-md">
                      {ayah.textArabic}
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBookmark({
                        surahNumber: currentSurah.number,
                        ayahNumber: ayah.ayahNumber,
                        surahName: currentSurah.nameUzbek,
                        textArabic: ayah.textArabic,
                        textUzbek: ayah.textUzbek,
                        timestampMs: ayah.startMs || 0,
                      });
                    }}
                    className="p-1 text-[#8fa89e] hover:text-[#d4af37]"
                  >
                    <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-[#d4af37] text-[#d4af37]' : ''}`} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Controls Deck */}
      <div className="max-w-2xl mx-auto w-full pt-4 border-t border-[#d4af37]/20 space-y-4">
        
        {/* Scrubber & Time */}
        <div className="space-y-1">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#0a2f24] rounded-lg appearance-none cursor-pointer gold-slider"
          />
          <div className="flex items-center justify-between text-xs font-mono text-[#8fa89e]">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Master Action Buttons */}
        <div className="flex items-center justify-between">
          
          {/* Speed Selector */}
          <div className="relative">
            <button
              onClick={() => setSpeedDropdownOpen(!speedDropdownOpen)}
              className="px-2.5 py-1.5 rounded-lg bg-[#061d15] border border-[#d4af37]/30 text-xs text-[#d4af37] font-semibold hover:border-[#d4af37] transition-colors"
            >
              {playbackSpeed}x
            </button>
            {speedDropdownOpen && (
              <div className="absolute bottom-full mb-2 left-0 bg-[#061d15] border border-[#d4af37]/40 rounded-xl p-1 shadow-xl flex flex-col gap-1 z-10">
                {speeds.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setPlaybackSpeed(s);
                      setSpeedDropdownOpen(false);
                    }}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      playbackSpeed === s
                        ? 'bg-[#d4af37] text-[#041510] font-bold'
                        : 'text-[#8fa89e] hover:text-[#f8f6f0] hover:bg-[#0a2f24]'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Core Transport Buttons */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* -10s */}
            <button
              onClick={() => skipTime(-10)}
              className="p-2.5 text-[#8fa89e] hover:text-[#f8f6f0] hover:bg-[#061d15] rounded-full transition-colors"
              title="10 soniya orqaga"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Previous Surah */}
            <button
              onClick={playPrevious}
              className="p-2.5 text-[#8fa89e] hover:text-[#f8f6f0] hover:bg-[#061d15] rounded-full transition-colors"
              title="Oldingi sura"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            {/* Play / Pause Giant Button */}
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#d4af37] via-[#f3e5ab] to-[#b8952b] text-[#041510] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl shadow-[#d4af37]/30"
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 fill-current" />
              ) : (
                <Play className="w-7 h-7 fill-current ml-1" />
              )}
            </button>

            {/* Next Surah */}
            <button
              onClick={playNext}
              className="p-2.5 text-[#8fa89e] hover:text-[#f8f6f0] hover:bg-[#061d15] rounded-full transition-colors"
              title="Keyingi sura"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            {/* +10s */}
            <button
              onClick={() => skipTime(10)}
              className="p-2.5 text-[#8fa89e] hover:text-[#f8f6f0] hover:bg-[#061d15] rounded-full transition-colors"
              title="10 soniya oldinga"
            >
              <RotateCw className="w-5 h-5" />
            </button>
          </div>

          {/* Repeat Mode */}
          <button
            onClick={cycleRepeat}
            className={`p-2.5 rounded-lg border transition-colors ${
              repeatMode !== 'off'
                ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]'
                : 'bg-[#061d15] border-[#d4af37]/30 text-[#8fa89e] hover:text-[#f8f6f0]'
            }`}
            title={`Takrorlash: ${
              repeatMode === 'off' ? 'O\'chirilgan' : repeatMode === 'surah' ? 'Surani takrorlash' : 'Pleylistni takrorlash'
            }`}
          >
            {repeatMode === 'surah' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
