/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Data Types
 */

export type RevelationType = 'Makkah' | 'Madinah';

export type AudioStatus = 'missing' | 'uploaded_unverified' | 'verified';

export type ContentStatus = 'missing' | 'uploaded_unverified' | 'verified' | 'published';

export type TimestampStatus = 'missing' | 'unverified' | 'verified';

export interface Ayah {
  id: string; // e.g., "1", "2"
  surahNumber: number;
  ayahNumber: number;
  textArabic: string; // Authentic Uthmani script
  textUzbek?: string; // Uzbek translation
  transliteration?: string; // Latin transliteration
  juzNumber: number;
  pageNumber: number;
  startMs: number | null; // Timestamp start in milliseconds
  endMs: number | null; // Timestamp end in milliseconds
  timestampStatus: TimestampStatus;
  isSajdah?: boolean;
}

export interface Surah {
  id: number; // 1 to 114
  number: number;
  nameArabic: string;
  nameTransliteration: string;
  nameUzbek: string;
  nameMeaning: string;
  revelationType: RevelationType;
  revelationOrder: number;
  ayahCount: number;
  juzNumbers: number[];
  startPage: number;
  
  // Audio details
  audioStatus: AudioStatus;
  audioUrl?: string | null;
  audioDurationSeconds?: number | null;
  audioStoragePath?: string | null;
  
  // Publishing & Verification status
  isPublished: boolean;
  contentStatus: ContentStatus;
  timestampsVerified: boolean;
  textVerified: boolean;

  // Metadata
  updatedAt?: string;
  updatedBy?: string;
}

export interface Bookmark {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
  textArabic: string;
  textUzbek?: string;
  timestampMs?: number;
  note?: string;
  createdAt: number;
}

export interface ListeningHistoryItem {
  id: string;
  surahNumber: number;
  surahName: string;
  surahNameArabic: string;
  ayahNumber: number;
  positionSeconds: number;
  durationSeconds: number;
  percent: number;
  timestamp: number;
}

export interface AdminLog {
  id: string;
  timestamp: number;
  action: string;
  surahNumber?: number;
  details: string;
  actor: string;
}

export interface VersionSnapshot {
  id: string;
  surahNumber: number;
  timestamp: number;
  data: Surah;
  ayahsCount: number;
  note: string;
}

export type RepeatMode = 'off' | 'surah' | 'playlist';
