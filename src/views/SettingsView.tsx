/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ODILJON QORI QUR'ON - Settings View
 */

import React from 'react';
import { 
  Settings, 
  Moon, 
  Sun, 
  Type, 
  Check, 
  Trash2, 
  Info, 
  Download, 
  Sparkles,
  Smartphone
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const SettingsView: React.FC = () => {
  const {
    theme,
    setTheme,
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
  } = useTheme();

  const handleClearCache = () => {
    if (confirm("Ilova ma'lumotlari keshini tozalashni tasdiqlaysizmi?")) {
      localStorage.removeItem('odiljon_qori_history');
      alert("Kesh muvaffaqiyatli tozalandi.");
      window.location.reload();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-28 text-[#f8f6f0]">
      
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#d4af37]" />
          <span>Ilova Sozlamalari</span>
        </h1>
        <p className="text-xs text-[#8fa89e] mt-1">
          Dizayn, Qur'on matni va ijro sozlamalarini o'zingizga moslashtiring
        </p>
      </div>

      {/* 1. Theme Setting */}
      <section className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-[#d4af37] uppercase tracking-wider">
          Mavzu va Ko'rinish
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              theme === 'dark'
                ? 'bg-[#041510] border-[#d4af37] ring-1 ring-[#d4af37] text-[#f8f6f0]'
                : 'bg-[#041510]/50 border-[#d4af37]/20 text-[#8fa89e] hover:border-[#d4af37]/50'
            }`}
          >
            <Moon className="w-6 h-6 text-[#d4af37]" />
            <span className="text-xs font-bold">Dark Luxury (Qora Zumrad)</span>
            <span className="text-[10px] text-[#8fa89e]">Tungi mutolaa uchun qulay</span>
          </button>

          <button
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              theme === 'light'
                ? 'bg-[#041510] border-[#d4af37] ring-1 ring-[#d4af37] text-[#f8f6f0]'
                : 'bg-[#041510]/50 border-[#d4af37]/20 text-[#8fa89e] hover:border-[#d4af37]/50'
            }`}
          >
            <Sun className="w-6 h-6 text-amber-300" />
            <span className="text-xs font-bold">Light Premium (Yorug')</span>
            <span className="text-[10px] text-[#8fa89e]">Kunduzgi ochiq rejim</span>
          </button>
        </div>
      </section>

      {/* 2. Arabic Typography */}
      <section className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-[#d4af37] uppercase tracking-wider">
          Qur'on Shrifti va Hajmi
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#8fa89e] block mb-2">Arabcha shrift uslubi:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setArabicFont('amiri')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  arabicFont === 'amiri'
                    ? 'bg-[#124e3b] border-[#d4af37] text-[#f3e5ab]'
                    : 'bg-[#041510] border-[#d4af37]/20 text-[#8fa89e]'
                }`}
              >
                <span className="font-arabic text-xl block mb-1">الْقُرْآنُ الْكَرِيمُ</span>
                <span className="text-xs font-bold">Amiri Quran (Madina xati)</span>
              </button>

              <button
                onClick={() => setArabicFont('scheherazade')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  arabicFont === 'scheherazade'
                    ? 'bg-[#124e3b] border-[#d4af37] text-[#f3e5ab]'
                    : 'bg-[#041510] border-[#d4af37]/20 text-[#8fa89e]'
                }`}
              >
                <span className="font-scheherazade text-xl block mb-1">الْقُرْآنُ الْكَرِيمُ</span>
                <span className="text-xs font-bold">Shahrizoda xati</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-[#8fa89e] block mb-2">Matn o'lchami:</label>
            <div className="grid grid-cols-3 gap-2">
              {(['normal', 'large', 'xlarge'] as const).map((sz) => (
                <button
                  key={sz}
                  onClick={() => setFontSize(sz)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                    fontSize === sz
                      ? 'bg-[#d4af37] text-[#041510] border-[#d4af37]'
                      : 'bg-[#041510] border-[#d4af37]/20 text-[#8fa89e] hover:text-[#f8f6f0]'
                  }`}
                >
                  {sz === 'normal' ? 'Kichik (Normal)' : sz === 'large' ? 'O\'rta (Large)' : 'Katta (Extra Large)'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Reading & Playback Options */}
      <section className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-[#d4af37] uppercase tracking-wider">
          Mutolaa va Ijro Imkoniyatlari
        </h3>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-xl bg-[#041510] border border-[#d4af37]/20 cursor-pointer">
            <div>
              <span className="text-xs font-bold text-[#f8f6f0] block">O'zbekcha tarjimani ko'rsatish</span>
              <span className="text-[11px] text-[#8fa89e]">Har bir oyat ostida o'zbekcha ma'nolar tarjimasi chiqadi</span>
            </div>
            <input
              type="checkbox"
              checked={showTranslation}
              onChange={(e) => setShowTranslation(e.target.checked)}
              className="w-5 h-5 rounded accent-[#d4af37]"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-[#041510] border border-[#d4af37]/20 cursor-pointer">
            <div>
              <span className="text-xs font-bold text-[#f8f6f0] block">Lotincha transkripsiyani ko'rsatish</span>
              <span className="text-[11px] text-[#8fa89e]">O'qishni endi o'rganayotganlar uchun lotin harflarida talaffuz</span>
            </div>
            <input
              type="checkbox"
              checked={showTransliteration}
              onChange={(e) => setShowTransliteration(e.target.checked)}
              className="w-5 h-5 rounded accent-[#d4af37]"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-[#041510] border border-[#d4af37]/20 cursor-pointer">
            <div>
              <span className="text-xs font-bold text-[#f8f6f0] block">Audio bilan avtomatik siljish (Auto-scroll)</span>
              <span className="text-[11px] text-[#8fa89e]">Audio yangi oyatga o'tganda ekran avtomatik ravishda unga siljiydi</span>
            </div>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-5 h-5 rounded accent-[#d4af37]"
            />
          </label>
        </div>
      </section>

      {/* 4. About & Attribution */}
      <section className="bg-[#061d15] border border-[#d4af37]/30 rounded-2xl p-5 shadow-xl space-y-3">
        <h3 className="text-sm font-bold text-[#d4af37] uppercase tracking-wider flex items-center gap-1.5">
          <Info className="w-4 h-4" />
          <span>Loyiha Haqida</span>
        </h3>

        <div className="text-xs text-[#8fa89e] leading-relaxed space-y-2">
          <p>
            <strong className="text-[#f8f6f0]">ODILJON QORI QUR'ON</strong> — qori Odiljon qorining muazzam va huzurbaxsh qiroatlariga bag'ishlangan, mustaqil va xolis raqamli Qur'on platformasi.
          </p>
          <p>
            Platforma barcha 114 surani, Usmoniy xatidagi asl arabcha matnni, o'zbekcha ma'nolar tarjimasini hamda audio bilan millisekund darajasida sinxronlashtirilgan o'qish imkoniyatini taqdim etadi.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-between text-xs text-[#8fa89e] border-t border-[#d4af37]/15">
          <span>Versiya: 1.0.0 (Mustaqil nashr)</span>
          <button
            onClick={handleClearCache}
            className="text-rose-400 hover:text-rose-300 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Keshni tozalash</span>
          </button>
        </div>
      </section>
    </div>
  );
};
