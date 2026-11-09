/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Header Component
 */

import React, { useState } from 'react';
import { 
  BookOpen, 
  Moon, 
  Sun, 
  Search, 
  ShieldCheck, 
  Bookmark, 
  History, 
  Settings, 
  Home, 
  Menu, 
  X,
  Volume2
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAudio } from '../../context/AudioContext';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSearchClick?: () => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  searchQuery = '',
  setSearchQuery,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { isPlaying, currentSurah, setPlayerModalOpen } = useAudio();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Bosh sahifa', icon: Home },
    { id: 'quran', label: 'Qur\'on (114)', icon: BookOpen },
    { id: 'favorites', label: 'Sevimlilar', icon: Bookmark },
    { id: 'history', label: 'Tarix', icon: History },
    { id: 'settings', label: 'Sozlamalar', icon: Settings },
    { id: 'admin', label: 'Admin', icon: ShieldCheck, highlight: true },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-200 bg-[#041510]/90 border-[#d4af37]/20 text-[#f8f6f0] dark:bg-[#041510]/95 dark:border-[#d4af37]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Brand Title */}
          <div 
            onClick={() => { setActiveTab('home'); setMobileMenuOpen(false); }}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#d4af37] via-[#b8952b] to-[#8c6b12] p-[1.5px] shadow-lg shadow-[#d4af37]/10 flex items-center justify-center">
              <div className="w-full h-full bg-[#041510] rounded-[10px] flex items-center justify-center group-hover:bg-[#07241c] transition-colors">
                <span className="text-[#d4af37] font-serif font-bold text-lg sm:text-xl">ق</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-wider text-sm sm:text-base text-[#f8f6f0] uppercase font-sans">
                  Odiljon Qori
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30">
                  Qur'on
                </span>
              </div>
              <p className="text-[11px] text-[#8fa89e] tracking-wide font-arabic">
                المصحف الشريف بصوت الشيخ عادل جان
              </p>
            </div>
          </div>

          {/* Desktop Search Bar */}
          {setSearchQuery && (
            <div className="hidden md:flex items-center flex-1 max-w-xs mx-6">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8fa89e]" />
                <input
                  type="text"
                  placeholder="Sura nomi yoki raqami..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (activeTab !== 'quran' && activeTab !== 'home') {
                      setActiveTab('quran');
                    }
                  }}
                  className="w-full pl-9 pr-4 py-1.5 text-xs rounded-full bg-[#09261d]/80 border border-[#d4af37]/30 text-[#f8f6f0] placeholder-[#8fa89e]/70 focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8fa89e] hover:text-[#f8f6f0]"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 shadow-sm'
                      : item.highlight
                      ? 'text-[#f3e5ab] hover:bg-[#d4af37]/10 border border-[#d4af37]/20'
                      : 'text-[#8fa89e] hover:text-[#f8f6f0] hover:bg-[#0a2f24]/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">
            
            {/* Live Playing Indicator */}
            {isPlaying && currentSurah && (
              <button
                onClick={() => setPlayerModalOpen(true)}
                className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#124e3b] text-[#f3e5ab] border border-[#d4af37]/40 text-xs animate-pulse"
                title="Audio pleyerni ochish"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#d4af37]" />
                <span className="font-medium text-[11px] truncate max-w-[100px]">
                  {currentSurah.nameUzbek}
                </span>
              </button>
            )}

            {/* Dark/Light Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-[#8fa89e] hover:text-[#d4af37] hover:bg-[#0a2f24] transition-colors"
              title={theme === 'dark' ? 'Yorug\' rejimga o\'tish' : 'Qorong\'u rejimga o\'tish'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-[#d4af37]" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-[#8fa89e] hover:text-[#f8f6f0] hover:bg-[#0a2f24]"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {setSearchQuery && (
          <div className="md:hidden pb-3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8fa89e]" />
              <input
                type="text"
                placeholder="Sura nomi yoki raqamini qidiring..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeTab !== 'quran' && activeTab !== 'home') {
                    setActiveTab('quran');
                  }
                }}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-[#09261d]/90 border border-[#d4af37]/30 text-[#f8f6f0] placeholder-[#8fa89e]/70 focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#d4af37]/20 bg-[#041510] px-4 pt-2 pb-6 space-y-1 animate-fadeIn">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30'
                    : 'text-[#8fa89e] hover:text-[#f8f6f0] hover:bg-[#0a2f24]'
                }`}
              >
                <Icon className="w-5 h-5 text-[#d4af37]" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
