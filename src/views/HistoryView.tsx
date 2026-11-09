/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Listening History View
 */

import React, { useState, useEffect } from 'react';
import { History, Play, Trash2, Clock, BookOpen } from 'lucide-react';
import { ListeningHistoryItem, Surah } from '../types/quran';
import { getListeningHistory, clearListeningHistory, getAllSurahs } from '../services/storageService';
import { useAudio } from '../context/AudioContext';

interface HistoryViewProps {
  onOpenSurah: (num: number) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onOpenSurah }) => {
  const [history, setHistory] = useState<ListeningHistoryItem[]>([]);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const { playSurah, seekTo } = useAudio();

  useEffect(() => {
    setHistory(getListeningHistory());
    getAllSurahs().then(setSurahs);
  }, []);

  const handleClear = () => {
    if (confirm("Tinglash tarixini tozalashni tasdiqlaysizmi?")) {
      clearListeningHistory();
      setHistory([]);
    }
  };

  const handleResume = (item: ListeningHistoryItem) => {
    const s = surahs.find((itemSurah) => itemSurah.number === item.surahNumber);
    if (s) {
      playSurah(s, item.ayahNumber).then(() => {
        if (item.positionSeconds > 0) {
          seekTo(item.positionSeconds);
        }
      });
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28 text-[#f8f6f0]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2">
            <History className="w-6 h-6 text-[#d4af37]" />
            <span>Tinglash tarixi</span>
          </h1>
          <p className="text-xs text-[#8fa89e] mt-1">
            Oxirgi tinglangan suralar va to'xtalgan joylar
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-500/20 text-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Tarixni tozalash</span>
          </button>
        )}
      </div>

      {history.length > 0 ? (
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-4 hover:border-[#d4af37]/60 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#041510] border border-[#d4af37]/30 flex items-center justify-center font-mono text-xs font-bold text-[#d4af37] flex-shrink-0">
                  {item.surahNumber}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#f8f6f0]">
                    {item.surahName} surasi ({item.surahNameArabic})
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-[#8fa89e] mt-0.5">
                    <span>{item.ayahNumber}-oyat</span>
                    <span>•</span>
                    <span>{formatTime(item.positionSeconds)} tinglandi</span>
                    <span>•</span>
                    <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Progress & Resume Action */}
              <div className="w-full sm:w-auto flex items-center gap-3">
                <div className="w-24 bg-[#041510] rounded-full h-1.5 overflow-hidden border border-[#d4af37]/20 hidden sm:block">
                  <div
                    className="bg-gradient-to-r from-[#d4af37] to-[#f3e5ab] h-full"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>

                <button
                  onClick={() => handleResume(item)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-[#d4af37] text-[#041510] hover:bg-[#f3e5ab] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-[#d4af37]/20"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Davom ettirish ({item.percent}%)</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-[#061d15] rounded-3xl border border-[#d4af37]/20 p-8">
          <Clock className="w-12 h-12 text-[#d4af37]/40 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#f8f6f0]">Tarix bo'sh</h3>
          <p className="text-xs text-[#8fa89e] mt-1 max-w-sm mx-auto">
            Suralarni tinglashni boshlaganingizda, to'xtagan joyingiz avtomatik ravishda bu yerda saqlanadi.
          </p>
        </div>
      )}
    </div>
  );
};
