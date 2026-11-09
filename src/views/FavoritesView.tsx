/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Favorites & Bookmarks View
 */

import React, { useState, useEffect } from 'react';
import { Bookmark, Play, Trash2, BookOpen, Volume2 } from 'lucide-react';
import { Bookmark as BookmarkType, Surah } from '../types/quran';
import { getBookmarks, toggleBookmark, getAllSurahs } from '../services/storageService';
import { useAudio } from '../context/AudioContext';

interface FavoritesViewProps {
  onOpenSurah: (num: number) => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({ onOpenSurah }) => {
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const { playSurah } = useAudio();

  useEffect(() => {
    setBookmarks(getBookmarks());
    getAllSurahs().then(setSurahs);
  }, []);

  const handleRemove = (b: BookmarkType) => {
    toggleBookmark({
      surahNumber: b.surahNumber,
      ayahNumber: b.ayahNumber,
      surahName: b.surahName,
      textArabic: b.textArabic,
      textUzbek: b.textUzbek,
      timestampMs: b.timestampMs,
    });
    setBookmarks(getBookmarks());
  };

  const handlePlayAyah = (b: BookmarkType) => {
    const s = surahs.find((item) => item.number === b.surahNumber);
    if (s) {
      playSurah(s, b.ayahNumber);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28 text-[#f8f6f0]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-[#d4af37] fill-[#d4af37]" />
            <span>Sevimlilar va Xatcho'plar</span>
          </h1>
          <p className="text-xs text-[#8fa89e] mt-1">
            Saqlab qo'yilgan oyatlar va shaxsiy xatcho'plar
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#061d15] border border-[#d4af37]/30 text-[#d4af37] font-bold">
          {bookmarks.length} ta oyat
        </span>
      </div>

      {bookmarks.length > 0 ? (
        <div className="space-y-4">
          {bookmarks.map((b) => (
            <div
              key={b.id}
              className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-4 sm:p-5 hover:border-[#d4af37]/60 transition-all space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#d4af37]/10">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#041510] text-[#d4af37] text-xs font-mono font-bold border border-[#d4af37]/30">
                    {b.surahNumber}:{b.ayahNumber}
                  </span>
                  <span className="text-xs font-bold text-[#f8f6f0]">
                    {b.surahName} surasi
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePlayAyah(b)}
                    className="p-1.5 rounded-lg bg-[#041510] hover:bg-[#d4af37] text-[#8fa89e] hover:text-[#041510] border border-[#d4af37]/20 transition-colors"
                    title="Oyatni tinglash"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>

                  <button
                    onClick={() => onOpenSurah(b.surahNumber)}
                    className="p-1.5 rounded-lg bg-[#041510] hover:bg-[#092b21] text-[#8fa89e] hover:text-[#d4af37] border border-[#d4af37]/20 transition-colors"
                    title="Suraga o'tish"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleRemove(b)}
                    className="p-1.5 rounded-lg bg-[#041510] hover:bg-rose-950/60 text-[#8fa89e] hover:text-rose-400 border border-rose-500/20 transition-colors"
                    title="O'chirish"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="font-arabic text-xl sm:text-2xl text-[#f8f6f0] text-right dir-rtl leading-loose">
                {b.textArabic}
              </p>

              {b.textUzbek && (
                <p className="text-xs sm:text-sm text-[#8fa89e]">
                  {b.textUzbek}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-[#061d15] rounded-3xl border border-[#d4af37]/20 p-8">
          <Bookmark className="w-12 h-12 text-[#d4af37]/40 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#f8f6f0]">Hozircha xatcho'plar yo'q</h3>
          <p className="text-xs text-[#8fa89e] mt-1 max-w-sm mx-auto">
            Qur'on o'qiyotganda yoki tinglayotganda xatcho'p (bookmark) belgisini bosib, sevimli oyatlaringizni bu yerga saqlashingiz mumkin.
          </p>
        </div>
      )}
    </div>
  );
};
