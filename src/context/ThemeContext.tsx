/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Theme & Display Context
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light';
export type ArabicFont = 'amiri' | 'scheherazade';
export type FontSize = 'normal' | 'large' | 'xlarge';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  arabicFont: ArabicFont;
  setArabicFont: (f: ArabicFont) => void;
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  showTranslation: boolean;
  setShowTranslation: (val: boolean) => void;
  showTransliteration: boolean;
  setShowTransliteration: (val: boolean) => void;
  autoScroll: boolean;
  setAutoScroll: (val: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('odiljon_theme') as ThemeMode) || 'dark';
  });

  const [arabicFont, setArabicFontState] = useState<ArabicFont>(() => {
    return (localStorage.getItem('odiljon_arabic_font') as ArabicFont) || 'amiri';
  });

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    return (localStorage.getItem('odiljon_font_size') as FontSize) || 'large';
  });

  const [showTranslation, setShowTranslationState] = useState<boolean>(() => {
    const raw = localStorage.getItem('odiljon_show_translation');
    return raw !== null ? raw === 'true' : true;
  });

  const [showTransliteration, setShowTransliterationState] = useState<boolean>(() => {
    const raw = localStorage.getItem('odiljon_show_transliteration');
    return raw !== null ? raw === 'true' : false;
  });

  const [autoScroll, setAutoScrollState] = useState<boolean>(() => {
    const raw = localStorage.getItem('odiljon_auto_scroll');
    return raw !== null ? raw === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('odiljon_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = '#030d0a';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.backgroundColor = '#faf8f4';
    }
  }, [theme]);

  const setTheme = (t: ThemeMode) => setThemeState(t);
  const toggleTheme = () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const setArabicFont = (f: ArabicFont) => {
    setArabicFontState(f);
    localStorage.setItem('odiljon_arabic_font', f);
  };

  const setFontSize = (s: FontSize) => {
    setFontSizeState(s);
    localStorage.setItem('odiljon_font_size', s);
  };

  const setShowTranslation = (val: boolean) => {
    setShowTranslationState(val);
    localStorage.setItem('odiljon_show_translation', String(val));
  };

  const setShowTransliteration = (val: boolean) => {
    setShowTransliterationState(val);
    localStorage.setItem('odiljon_show_transliteration', String(val));
  };

  const setAutoScroll = (val: boolean) => {
    setAutoScrollState(val);
    localStorage.setItem('odiljon_auto_scroll', String(val));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        arabicFont,
        setArabicFont,
        fontSize,
        setFontSize,
        showTranslation,
        setShowTranslation,
        showTransliteration,
        setShowTransliteration,
        autoScroll,
        setAutoScroll,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
