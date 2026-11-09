/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Master Audio & Ayah Synchronization Engine
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Surah, Ayah, RepeatMode } from '../types/quran';
import { getAllSurahs, getAyahsForSurahNumber, saveListeningPosition } from '../services/storageService';

interface AudioContextType {
  currentSurah: Surah | null;
  currentAyahs: Ayah[];
  isPlaying: boolean;
  currentTime: number; // in seconds
  duration: number; // in seconds
  activeAyahNumber: number | null;
  playbackSpeed: number;
  repeatMode: RepeatMode;
  isPlayerModalOpen: boolean;
  audioNotice: string | null;
  hasAudio: boolean;
  playSurah: (surah: Surah, startAyahNumber?: number) => Promise<void>;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seekTo: (seconds: number) => void;
  seekToAyah: (ayahNumber: number) => void;
  skipTime: (deltaSeconds: number) => void; // +10s or -10s
  setPlaybackSpeed: (speed: number) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  playNext: () => void;
  playPrevious: () => void;
  setPlayerModalOpen: (open: boolean) => void;
  clearAudioNotice: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSurah, setCurrentSurah] = useState<Surah | null>(null);
  const [currentAyahs, setCurrentAyahs] = useState<Ayah[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [activeAyahNumber, setActiveAyahNumber] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(1);
  const [repeatMode, setRepeatModeState] = useState<RepeatMode>('off');
  const [isPlayerModalOpen, setPlayerModalOpen] = useState<boolean>(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const allSurahsRef = useRef<Surah[]>([]);

  // Initialize master audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    // Load initial Surahs list
    getAllSurahs().then((res) => {
      allSurahsRef.current = res;
    });

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  // Update Media Session API for lock screen / background playback controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSurah) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${currentSurah.number}. ${currentSurah.nameUzbek} (${currentSurah.nameArabic})`,
      artist: "Odiljon Qori",
      album: "ODILJON QORI QUR'ON",
      artwork: [
        { src: 'https://images.unsplash.com/photo-1542816417-0983c9c9ad53?auto=format&fit=crop&w=512&q=80', sizes: '512x512', type: 'image/jpeg' },
      ],
    });

    navigator.mediaSession.setActionHandler('play', () => resume());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => skipTime(-10));
    navigator.mediaSession.setActionHandler('seekforward', () => skipTime(10));
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
  }, [currentSurah]);

  // High-precision requestAnimationFrame loop for Ayah synchronization (<16ms)
  const syncLoop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused && currentAyahs.length > 0) {
      const currentMs = audio.currentTime * 1000;

      // Find the Ayah that matches currentMs
      let matchedAyahNumber: number | null = null;
      for (const ayah of currentAyahs) {
        if (
          ayah.startMs !== null &&
          ayah.endMs !== null &&
          currentMs >= ayah.startMs &&
          currentMs < ayah.endMs
        ) {
          matchedAyahNumber = ayah.ayahNumber;
          break;
        }
      }

      // If no strict range matched but audio is playing, pick closest by start time
      if (matchedAyahNumber === null && currentAyahs[0]?.startMs !== null) {
        for (let i = currentAyahs.length - 1; i >= 0; i--) {
          const a = currentAyahs[i];
          if (a.startMs !== null && currentMs >= a.startMs) {
            matchedAyahNumber = a.ayahNumber;
            break;
          }
        }
      }

      setActiveAyahNumber(matchedAyahNumber);

      // Periodically record listening position
      if (currentSurah && Math.floor(audio.currentTime) % 3 === 0) {
        saveListeningPosition(
          currentSurah.number,
          currentSurah.nameUzbek,
          currentSurah.nameArabic,
          matchedAyahNumber || 1,
          audio.currentTime,
          audio.duration || currentSurah.audioDurationSeconds || 0
        );
      }
    }

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(syncLoop);
    }
  }, [currentAyahs, currentSurah, isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(syncLoop);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, syncLoop]);

  // Play Surah
  const playSurah = async (surah: Surah, startAyahNumber?: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentSurah(surah);
    setAudioNotice(null);

    // Fetch Ayahs for this surah
    const ayahs = await getAyahsForSurahNumber(surah.number);
    setCurrentAyahs(ayahs);

    if (!surah.audioUrl) {
      // Audio is not yet uploaded for this Surah
      setIsPlaying(false);
      audio.pause();
      setAudioNotice(
        `«${surah.nameUzbek}» surasi uchun Odiljon Qorining audio fayli hali admin tomonidan yuklanmagan. Admin panel orqali audio faylni yuklashingiz mumkin.`
      );
      return;
    }

    // Set source if different
    if (audio.src !== surah.audioUrl) {
      audio.src = surah.audioUrl;
      audio.playbackRate = playbackSpeed;
    }

    // If starting from a specific Ayah
    if (startAyahNumber && ayahs.length > 0) {
      const targetAyah = ayahs.find((a) => a.ayahNumber === startAyahNumber);
      if (targetAyah && targetAyah.startMs !== null) {
        audio.currentTime = targetAyah.startMs / 1000;
      }
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.warn('Audio playback error (user interaction needed)', err);
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (currentSurah && currentSurah.audioUrl) {
        audio.play().catch(() => {});
        setIsPlaying(true);
      } else if (currentSurah) {
        setAudioNotice(
          `«${currentSurah.nameUzbek}» surasining audio fayli kutilmoqda. Admin paneldan audio yuklash mumkin.`
        );
      }
    }
  };

  const pause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const resume = () => {
    if (currentSurah?.audioUrl) {
      audioRef.current?.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || duration));
    setCurrentTime(audio.currentTime);
  };

  const seekToAyah = (ayahNumber: number) => {
    const target = currentAyahs.find((a) => a.ayahNumber === ayahNumber);
    if (!target) return;

    if (target.startMs !== null) {
      seekTo(target.startMs / 1000);
      setActiveAyahNumber(ayahNumber);
      if (!isPlaying) {
        resume();
      }
    } else {
      setAudioNotice(
        `${ayahNumber}-oyat uchun vaqt belgisi (timestamp) hali kiritilmagan. Admin panelda belgilash mumkin.`
      );
    }
  };

  const skipTime = (deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    seekTo(audio.currentTime + deltaSeconds);
  };

  const setPlaybackSpeed = (speed: number) => {
    setPlaybackSpeedState(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const setRepeatMode = (mode: RepeatMode) => {
    setRepeatModeState(mode);
  };

  const playNext = async () => {
    if (!currentSurah) return;
    const all = allSurahsRef.current.length > 0 ? allSurahsRef.current : await getAllSurahs();
    allSurahsRef.current = all;

    const currentIdx = all.findIndex((s) => s.number === currentSurah.number);
    if (currentIdx !== -1 && currentIdx < all.length - 1) {
      await playSurah(all[currentIdx + 1]);
    } else if (repeatMode === 'playlist' && all.length > 0) {
      await playSurah(all[0]);
    }
  };

  const playPrevious = async () => {
    if (!currentSurah) return;
    const all = allSurahsRef.current.length > 0 ? allSurahsRef.current : await getAllSurahs();
    allSurahsRef.current = all;

    const currentIdx = all.findIndex((s) => s.number === currentSurah.number);
    if (currentIdx > 0) {
      await playSurah(all[currentIdx - 1]);
    }
  };

  // Handle audio end according to repeat mode
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (repeatMode === 'surah') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        playNext();
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [repeatMode, currentSurah]);

  return (
    <AudioContext.Provider
      value={{
        currentSurah,
        currentAyahs,
        isPlaying,
        currentTime,
        duration: duration || currentSurah?.audioDurationSeconds || 0,
        activeAyahNumber,
        playbackSpeed,
        repeatMode,
        isPlayerModalOpen,
        audioNotice,
        hasAudio: Boolean(currentSurah?.audioUrl),
        playSurah,
        togglePlay,
        pause,
        resume,
        seekTo,
        seekToAyah,
        skipTime,
        setPlaybackSpeed,
        setRepeatMode,
        playNext,
        playPrevious,
        setPlayerModalOpen,
        clearAudioNotice: () => setAudioNotice(null),
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
};
