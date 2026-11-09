/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Mobile Bottom Navigation
 */

import React from 'react';
import { Home, BookOpen, Bookmark, History, Settings } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'home', label: 'Bosh sahifa', icon: Home },
    { id: 'quran', label: 'Qur\'on', icon: BookOpen },
    { id: 'favorites', label: 'Sevimlilar', icon: Bookmark },
    { id: 'history', label: 'Tarix', icon: History },
    { id: 'settings', label: 'Sozlamalar', icon: Settings },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#041510]/95 backdrop-blur-lg border-t border-[#d4af37]/20 pb-safe">
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
                isActive ? 'text-[#d4af37]' : 'text-[#8fa89e] hover:text-[#f8f6f0]'
              }`}
            >
              {isActive && (
                <span className="absolute -top-1 w-8 h-1 rounded-full bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />
              )}
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[10px] mt-1 font-medium tracking-tight truncate">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
