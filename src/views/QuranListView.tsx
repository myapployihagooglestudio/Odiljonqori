/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - 114 Surahs Library View
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  LayoutGrid, 
  List, 
  Volume2, 
  Clock, 
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { Surah } from '../types/quran';
import { getAllSurahs } from '../services/storageService';
import { SurahCard } from '../components/surah/SurahCard';
import { useAudio } from '../context/AudioContext';

interface QuranListViewProps {
  onOpenSurah: (surahNumber: number) => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
}

export const QuranListView: React.FC<QuranListViewProps> = ({
  onOpenSurah,
  searchQuery = '',
  setSearchQuery,
}) => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'makkah' | 'madinah' | 'has_audio' | 'juz_30'>('all');
  const [selectedJuz, setSelectedJuz] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'mushaf' | 'revelation' | 'ayah_count'>('mushaf');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { playSurah } = useAudio();

  useEffect(() => {
    getAllSurahs().then(setSurahs);
  }, []);

  const filteredSurahs = useMemo(() => {
    return surahs
      .filter((s) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchNum = s.number.toString() === q;
          const matchUz = s.nameUzbek.toLowerCase().includes(q);
          const matchAr = s.nameArabic.includes(q);
          const matchTr = s.nameTransliteration.toLowerCase().includes(q);
          const matchMeaning = s.nameMeaning.toLowerCase().includes(q);
          if (!matchNum && !matchUz && !matchAr && !matchTr && !matchMeaning) {
            return false;
          }
        }

        // Active tab filter
        if (activeFilter === 'makkah' && s.revelationType !== 'Makkah') return false;
        if (activeFilter === 'madinah' && s.revelationType !== 'Madinah') return false;
        if (activeFilter === 'has_audio' && !s.audioUrl) return false;
        if (activeFilter === 'juz_30' && s.number < 78) return false;

        // Juz filter
        if (selectedJuz !== 'all' && !s.juzNumbers.includes(selectedJuz)) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'mushaf') return a.number - b.number;
        if (sortBy === 'revelation') return a.revelationOrder - b.revelationOrder;
        if (sortBy === 'ayah_count') return b.ayahCount - a.ayahCount;
        return 0;
      });
  }, [surahs, searchQuery, activeFilter, selectedJuz, sortBy]);

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#f8f6f0] flex items-center gap-2">
            <span>Qur'oni Karim</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 font-semibold">
              114 ta Sura
            </span>
          </h1>
          <p className="text-xs text-[#8fa89e] mt-1">
            Odiljon Qori tilovati va Usmoniy xatdagi asl arabcha matnlar
          </p>
        </div>

        {/* View toggles & Sort */}
        <div className="flex items-center gap-2">
          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-[#061d15] border border-[#d4af37]/30 rounded-xl px-2.5 py-1.5 text-xs text-[#8fa89e]">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#d4af37]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-[#f8f6f0] focus:outline-none cursor-pointer"
            >
              <option value="mushaf" className="bg-[#061d15]">Mushaf tartibi (1–114)</option>
              <option value="revelation" className="bg-[#061d15]">Nozil bo'lish tartibi</option>
              <option value="ayah_count" className="bg-[#061d15]">Oyatlar soni bo'yicha</option>
            </select>
          </div>

          {/* Grid / List View Toggle */}
          <div className="flex items-center bg-[#061d15] border border-[#d4af37]/30 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-[#d4af37] text-[#041510]' : 'text-[#8fa89e] hover:text-[#f8f6f0]'
              }`}
              title="Kataklar ko'rinishi"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-[#d4af37] text-[#041510]' : 'text-[#8fa89e] hover:text-[#f8f6f0]'
              }`}
              title="Ro'yxat ko'rinishi"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'all', label: `Barchasi (${surahs.length})` },
          { id: 'makkah', label: 'Makkiy suralar (86)' },
          { id: 'madinah', label: 'Madaniy suralar (28)' },
          { id: 'has_audio', label: 'Audio mavjud' },
          { id: 'juz_30', label: '30-pora (Amma)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === tab.id
                ? 'bg-[#d4af37] text-[#041510] shadow-md shadow-[#d4af37]/20'
                : 'bg-[#061d15] text-[#8fa89e] hover:text-[#f8f6f0] border border-[#d4af37]/20 hover:border-[#d4af37]/40'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {/* Juz Dropdown */}
        <select
          value={selectedJuz}
          onChange={(e) => setSelectedJuz(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="px-3 py-1.5 rounded-xl text-xs bg-[#061d15] text-[#8fa89e] border border-[#d4af37]/20 focus:outline-none cursor-pointer"
        >
          <option value="all">Barcha poralar (1–30)</option>
          {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
            <option key={juz} value={juz} className="bg-[#061d15]">
              {juz}-pora
            </option>
          ))}
        </select>
      </div>

      {/* Surahs Catalog Results */}
      {filteredSurahs.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSurahs.map((surah) => (
              <SurahCard
                key={surah.id}
                surah={surah}
                onRead={(num) => onOpenSurah(num)}
                onListen={(s) => playSurah(s)}
              />
            ))}
          </div>
        ) : (
          /* Compact Table / List Mode */
          <div className="bg-[#061d15]/90 border border-[#d4af37]/20 rounded-2xl overflow-hidden divide-y divide-[#d4af37]/10">
            {filteredSurahs.map((surah) => (
              <div
                key={surah.id}
                onClick={() => onOpenSurah(surah.number)}
                className="p-3.5 sm:p-4 hover:bg-[#0a2f24] transition-colors cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[#041510] border border-[#d4af37]/30 text-xs font-bold text-[#d4af37] flex items-center justify-center font-mono">
                    {surah.number}
                  </span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#f8f6f0]">
                      {surah.nameUzbek}
                    </h4>
                    <p className="text-[11px] text-[#8fa89e]">
                      {surah.revelationType === 'Makkah' ? 'Makkiy' : 'Madaniy'} • {surah.ayahCount} oyat
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-arabic text-lg sm:text-xl text-[#d4af37]">
                    {surah.nameArabic}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playSurah(surah);
                    }}
                    className="p-2 rounded-lg bg-[#041510] hover:bg-[#d4af37] text-[#8fa89e] hover:text-[#041510] border border-[#d4af37]/30 transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-16 bg-[#061d15] rounded-3xl border border-[#d4af37]/20 p-8">
          <BookOpen className="w-12 h-12 text-[#d4af37]/40 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#f8f6f0]">Sura topilmadi</h3>
          <p className="text-xs text-[#8fa89e] mt-1 max-w-sm mx-auto">
            Qidiruv so'zini tekshirib ko'ring yoki filtrlarni tozalang.
          </p>
          {setSearchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('all');
                setSelectedJuz('all');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-[#d4af37] text-[#041510] text-xs font-bold"
            >
              Filtrlarni tozalash
            </button>
          )}
        </div>
      )}
    </div>
  );
};
