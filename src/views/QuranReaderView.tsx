/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Quran Reading Sanctuary
 */

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Settings2, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Type, 
  Bookmark, 
  Eye, 
  Volume2 
} from 'lucide-react';
import { Surah, Ayah } from '../types/quran';
import { getAllSurahs, getAyahsForSurahNumber, toggleBookmark, isAyahBookmarked } from '../services/storageService';
import { useTheme } from '../context/ThemeContext';
import { useAudio } from '../context/AudioContext';

interface QuranReaderViewProps {
  initialSurahNumber?: number;
  onNavigateSurah: (num: number) => void;
}

export const QuranReaderView: React.FC<QuranReaderViewProps> = ({
  initialSurahNumber = 1,
  onNavigateSurah,
}) => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurahNumber, setSelectedSurahNumber] = useState<number>(initialSurahNumber);
  const [currentSurah, setCurrentSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [mode, setMode] = useState<'mushaf' | 'verse_by_verse'>('mushaf');

  const {
    fontSize,
    setFontSize,
    arabicFont,
    setArabicFont,
    showTranslation,
    setShowTranslation,
    showTransliteration,
    setShowTransliteration,
  } = useTheme();

  const { playSurah } = useAudio();

  useEffect(() => {
    getAllSurahs().then(setSurahs);
  }, []);

  useEffect(() => {
    setSelectedSurahNumber(initialSurahNumber);
  }, [initialSurahNumber]);

  useEffect(() => {
    const s = surahs.find((item) => item.number === selectedSurahNumber);
    if (s) {
      setCurrentSurah(s);
      getAyahsForSurahNumber(s.number).then(setAyahs);
    }
  }, [selectedSurahNumber, surahs]);

  const fontClass = arabicFont === 'scheherazade' ? 'font-scheherazade' : 'font-arabic';
  const fontSizeStyle =
    fontSize === 'normal'
      ? 'text-2xl sm:text-3xl leading-[2.6]'
      : fontSize === 'large'
      ? 'text-3xl sm:text-4xl leading-[2.8]'
      : 'text-4xl sm:text-5xl leading-[3.0]';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28 text-[#f8f6f0]">
      
      {/* Top Toolbar: Surah Selector & Reader Preferences */}
      <div className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Surah Dropdown Selector */}
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#d4af37]" />
            <select
              value={selectedSurahNumber}
              onChange={(e) => {
                const num = Number(e.target.value);
                setSelectedSurahNumber(num);
                onNavigateSurah(num);
              }}
              className="bg-[#041510] border border-[#d4af37]/30 rounded-xl px-3 py-1.5 text-xs text-[#f8f6f0] font-bold focus:outline-none focus:border-[#d4af37] cursor-pointer"
            >
              {surahs.map((s) => (
                <option key={s.number} value={s.number} className="bg-[#061d15]">
                  {s.number}. {s.nameUzbek} ({s.nameArabic}) — {s.ayahCount} oyat
                </option>
              ))}
            </select>
          </div>

          {/* Mode Switcher: Mushaf continuous vs Verse by verse */}
          <div className="flex items-center bg-[#041510] border border-[#d4af37]/30 rounded-xl p-0.5 text-xs">
            <button
              onClick={() => setMode('mushaf')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                mode === 'mushaf' ? 'bg-[#d4af37] text-[#041510]' : 'text-[#8fa89e] hover:text-[#f8f6f0]'
              }`}
            >
              Mushaf sahifasi
            </button>
            <button
              onClick={() => setMode('verse_by_verse')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                mode === 'verse_by_verse' ? 'bg-[#d4af37] text-[#041510]' : 'text-[#8fa89e] hover:text-[#f8f6f0]'
              }`}
            >
              Oyatma-oyat
            </button>
          </div>

          {/* Audio Play button for this Surah */}
          {currentSurah && (
            <button
              onClick={() => playSurah(currentSurah)}
              className="px-3.5 py-1.5 rounded-xl bg-[#124e3b] hover:bg-[#d4af37] text-[#f3e5ab] hover:text-[#041510] border border-[#d4af37]/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Tinglash</span>
            </button>
          )}
        </div>

        {/* Font Settings Sub-bar */}
        <div className="pt-3 border-t border-[#d4af37]/15 flex flex-wrap items-center justify-between gap-3 text-xs text-[#8fa89e]">
          
          {/* Font Size controls */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] mr-1">Hajm:</span>
            {(['normal', 'large', 'xlarge'] as const).map((sz) => (
              <button
                key={sz}
                onClick={() => setFontSize(sz)}
                className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-colors ${
                  fontSize === sz
                    ? 'bg-[#d4af37] text-[#041510] border-[#d4af37]'
                    : 'bg-[#041510] border-[#d4af37]/20 text-[#8fa89e] hover:text-[#f8f6f0]'
                }`}
              >
                {sz === 'normal' ? 'Kichik' : sz === 'large' ? 'O\'rta' : 'Katta'}
              </button>
            ))}
          </div>

          {/* Arabic Font Selector */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] mr-1">Shrift:</span>
            <button
              onClick={() => setArabicFont('amiri')}
              className={`px-2 py-0.5 rounded-md border text-[11px] transition-colors ${
                arabicFont === 'amiri'
                  ? 'bg-[#d4af37] text-[#041510] font-bold border-[#d4af37]'
                  : 'bg-[#041510] border-[#d4af37]/20 text-[#8fa89e]'
              }`}
            >
              Amiri Quran
            </button>
            <button
              onClick={() => setArabicFont('scheherazade')}
              className={`px-2 py-0.5 rounded-md border text-[11px] transition-colors ${
                arabicFont === 'scheherazade'
                  ? 'bg-[#d4af37] text-[#041510] font-bold border-[#d4af37]'
                  : 'bg-[#041510] border-[#d4af37]/20 text-[#8fa89e]'
              }`}
            >
              Shahrizoda
            </button>
          </div>

          {/* Translation Toggles */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showTranslation}
                onChange={(e) => setShowTranslation(e.target.checked)}
                className="rounded accent-[#d4af37]"
              />
              <span className="text-[11px]">Tarjima</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showTransliteration}
                onChange={(e) => setShowTransliteration(e.target.checked)}
                className="rounded accent-[#d4af37]"
              />
              <span className="text-[11px]">Transkripsiya</span>
            </label>
          </div>
        </div>
      </div>

      {/* Surah Reading Paper Canvas */}
      {currentSurah && (
        <div className="bg-[#051812] border-2 border-[#d4af37]/40 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          
          {/* Top Mushaf Header Plate */}
          <div className="border-2 border-[#d4af37]/40 rounded-2xl p-4 bg-gradient-to-r from-[#07241b] via-[#0b3327] to-[#07241b] text-center mb-8 relative">
            <div className="flex items-center justify-between text-xs text-[#d4af37] font-semibold mb-1">
              <span>{currentSurah.revelationType === 'Makkah' ? 'Makkiy' : 'Madaniy'}</span>
              <span>{currentSurah.number}-sura</span>
              <span>{currentSurah.ayahCount} oyat</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-arabic text-[#f3e5ab] tracking-wide my-1">
              {currentSurah.nameArabic}
            </h2>
            <p className="text-xs text-[#8fa89e]">
              {currentSurah.nameUzbek} — «{currentSurah.nameMeaning}»
            </p>
          </div>

          {/* Bismillah plate (except Surah 9) */}
          {currentSurah.number !== 9 && (
            <div className="text-center py-4 mb-6">
              <p className="font-arabic text-3xl sm:text-4xl text-[#d4af37] drop-shadow leading-relaxed">
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </p>
            </div>
          )}

          {/* Mode 1: Continuous Mushaf Flow */}
          {mode === 'mushaf' ? (
            <div className="text-right dir-rtl leading-relaxed">
              <p className={`${fontClass} ${fontSizeStyle} text-[#f8f6f0] text-justify select-text`}>
                {ayahs.map((ayah) => {
                  return (
                    <span key={ayah.id} className="inline transition-colors hover:text-[#d4af37]">
                      {ayah.textArabic}
                      <span className="inline-flex items-center justify-center mx-1.5 w-7 h-7 rounded-full border border-[#d4af37]/50 text-[#d4af37] font-sans text-xs align-middle font-bold bg-[#041510]/60 select-none">
                        {ayah.ayahNumber}
                      </span>
                    </span>
                  );
                })}
              </p>

              {/* Translation accordion under continuous mushaf */}
              {showTranslation && (
                <div className="mt-8 pt-6 border-t border-[#d4af37]/20 dir-ltr text-left space-y-3">
                  <h4 className="text-xs font-bold text-[#d4af37] uppercase tracking-wider">
                    O'zbekcha ma'nolar tarjimasi:
                  </h4>
                  {ayahs.map((a) => (
                    <div key={a.id} className="text-xs sm:text-sm text-[#8fa89e] leading-relaxed">
                      <span className="font-bold text-[#d4af37] mr-1.5">{a.ayahNumber}.</span>
                      {a.textUzbek}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Mode 2: Verse-by-verse list */
            <div className="space-y-6">
              {ayahs.map((ayah) => {
                const bookmarked = isAyahBookmarked(currentSurah.number, ayah.ayahNumber);
                return (
                  <div
                    key={ayah.id}
                    className="p-4 sm:p-5 rounded-2xl bg-[#061d15] border border-[#d4af37]/20 hover:border-[#d4af37]/50 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#d4af37]/10">
                      <span className="text-xs font-mono text-[#d4af37] font-bold">
                        {currentSurah.number}:{ayah.ayahNumber}
                      </span>
                      <button
                        onClick={() => {
                          toggleBookmark({
                            surahNumber: currentSurah.number,
                            ayahNumber: ayah.ayahNumber,
                            surahName: currentSurah.nameUzbek,
                            textArabic: ayah.textArabic,
                            textUzbek: ayah.textUzbek,
                            timestampMs: ayah.startMs || 0,
                          });
                          setAyahs([...ayahs]);
                        }}
                        className="text-[#8fa89e] hover:text-[#d4af37]"
                      >
                        <Bookmark
                          className={`w-4 h-4 ${bookmarked ? 'fill-[#d4af37] text-[#d4af37]' : ''}`}
                        />
                      </button>
                    </div>

                    <p className={`${fontClass} text-2xl sm:text-3xl text-right dir-rtl text-[#f8f6f0] leading-loose select-text`}>
                      {ayah.textArabic}
                    </p>

                    {showTransliteration && ayah.transliteration && (
                      <p className="text-xs text-[#d4af37]/80 italic font-sans select-text">
                        {ayah.transliteration}
                      </p>
                    )}

                    {showTranslation && ayah.textUzbek && (
                      <p className="text-xs sm:text-sm text-[#8fa89e] font-sans leading-relaxed select-text">
                        {ayah.textUzbek}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bottom Prev / Next Surah Navigator */}
      <div className="flex items-center justify-between pt-4">
        {selectedSurahNumber > 1 ? (
          <button
            onClick={() => {
              const prev = selectedSurahNumber - 1;
              setSelectedSurahNumber(prev);
              onNavigateSurah(prev);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#061d15] text-[#8fa89e] hover:text-[#d4af37] border border-[#d4af37]/20 text-xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Oldingi sura</span>
          </button>
        ) : (
          <div />
        )}

        {selectedSurahNumber < 114 ? (
          <button
            onClick={() => {
              const next = selectedSurahNumber + 1;
              setSelectedSurahNumber(next);
              onNavigateSurah(next);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#061d15] text-[#8fa89e] hover:text-[#d4af37] border border-[#d4af37]/20 text-xs"
          >
            <span>Keyingi sura</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
};
