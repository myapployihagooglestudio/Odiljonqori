/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Main Application Controller
 */

import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AudioProvider } from './context/AudioContext';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { FloatingAudioPlayer } from './components/player/FloatingAudioPlayer';
import { FullAudioPlayerModal } from './components/player/FullAudioPlayerModal';

import { HomeView } from './views/HomeView';
import { QuranListView } from './views/QuranListView';
import { SurahDetailView } from './views/SurahDetailView';
import { QuranReaderView } from './views/QuranReaderView';
import { FavoritesView } from './views/FavoritesView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import { AdminView } from './views/AdminView';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedSurahNumber, setSelectedSurahNumber] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Handle opening a Surah into the listening & reading detail view
  const handleOpenSurah = (surahNumber: number) => {
    setSelectedSurahNumber(surahNumber);
    setActiveTab('surah_detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ThemeProvider>
      <AudioProvider>
        <div className="min-h-screen bg-[#030d0a] text-[#f8f6f0] flex flex-col font-sans transition-colors duration-200">
          
          {/* Top Navigation Bar */}
          <Header
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />

          {/* Main App Canvas */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
            {activeTab === 'home' && (
              <HomeView
                onNavigateTab={(tab) => setActiveTab(tab)}
                onOpenSurah={handleOpenSurah}
              />
            )}

            {activeTab === 'quran' && (
              <QuranListView
                onOpenSurah={handleOpenSurah}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}

            {activeTab === 'surah_detail' && (
              <SurahDetailView
                surahNumber={selectedSurahNumber}
                onBack={() => setActiveTab('quran')}
                onOpenSurah={(num) => handleOpenSurah(num)}
              />
            )}

            {activeTab === 'reader' && (
              <QuranReaderView
                initialSurahNumber={selectedSurahNumber}
                onNavigateSurah={(num) => setSelectedSurahNumber(num)}
              />
            )}

            {activeTab === 'favorites' && (
              <FavoritesView onOpenSurah={handleOpenSurah} />
            )}

            {activeTab === 'history' && (
              <HistoryView onOpenSurah={handleOpenSurah} />
            )}

            {activeTab === 'settings' && (
              <SettingsView />
            )}

            {activeTab === 'admin' && (
              <AdminView />
            )}
          </main>

          {/* Persistent Floating Audio Bar */}
          <FloatingAudioPlayer />

          {/* Fullscreen Expandable Audio Player Modal */}
          <FullAudioPlayerModal />

          {/* Mobile Bottom Navigation */}
          <BottomNav
            activeTab={activeTab === 'surah_detail' ? 'quran' : activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      </AudioProvider>
    </ThemeProvider>
  );
}
