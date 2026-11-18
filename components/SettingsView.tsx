'use client';

import React, { useState } from 'react';
import { Sun, Moon, Volume2, PartyPopper, Smartphone, Languages, Timer, Wifi, Music, Wind, Sparkles, Disc3, Waves } from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { PWAInstallButton } from './PWAInstallButton';
import { WHEEL_PALETTES, type PaletteId } from '@/lib/palettes';
import { SPIN_SOUND_OPTIONS, previewSpinSound, type SpinSoundId } from '@/lib/sound';
import { COPY } from '@/lib/i18n';

export function SettingsView() {
  const { settings, updateSettings, activeWheel, updateActiveWheel } = usePickerwel();
  const [previewingId, setPreviewingId] = useState<SpinSoundId | null>(null);
  const t = COPY[settings.language];
  const isKm = settings.language === 'km';

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="pb-5 border-b border-slate-200 dark:border-slate-800">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {t.settingsTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t.settingsDesc}
          </p>
        </div>

        {/* Appearance & Language */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {settings.theme === 'dark' ? (
                <Moon className="w-5 h-5 text-indigo-500 shrink-0" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500 shrink-0" />
              )}
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {t.appearanceLabel}
              </span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => updateSettings({ theme: 'light' })}
                className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  settings.theme === 'light'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.lightMode}
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ theme: 'dark' })}
                className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  settings.theme === 'dark'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.darkMode}
              </button>
            </div>
          </div>

          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Languages className="w-5 h-5 text-blue-500 shrink-0" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {t.languageLabel}
              </span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => updateSettings({ language: 'km' })}
                className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  settings.language === 'km'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                ភាសាខ្មែរ
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ language: 'en' })}
                className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  settings.language === 'en'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Active Wheel Palette */}
          <div className="p-5 space-y-3">
            <span className="block text-sm font-semibold text-slate-900 dark:text-white">
              {t.paletteLabel}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(Object.keys(WHEEL_PALETTES) as PaletteId[]).map((pid) => {
                const pal = WHEEL_PALETTES[pid];
                const active = activeWheel.paletteId === pid;
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => updateActiveWheel({ paletteId: pid })}
                    className={`min-h-[44px] p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-1.5">
                      {pal.colors.slice(0, 4).map((c) => (
                        <span
                          key={c}
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 block truncate">
                      {isKm ? pal.nameKm : pal.nameEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sensory & Physics Controls */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {/* Sound Toggle */}
          <label className="p-5 flex items-center justify-between gap-4 cursor-pointer">
            <div className="flex items-start gap-3">
              <Volume2 className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                  {t.soundLabel}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.soundDesc}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
              className="w-5 h-5 accent-blue-600 rounded cursor-pointer shrink-0"
            />
          </label>

          {/* Spin Sound Style Selector */}
          <div className="p-5 space-y-3">
            <div>
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                {t.spinSoundLabel}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.spinSoundDesc}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SPIN_SOUND_OPTIONS.map((opt) => {
                const active = settings.spinSound === opt.id;
                const isPreviewing = previewingId === opt.id;
                const Icon =
                  opt.id === 'chime-bell'
                    ? Music
                    : opt.id === 'breeze-whoosh'
                    ? Wind
                    : opt.id === 'cosmic-glide'
                    ? Waves
                    : opt.id === 'casino-click'
                    ? Sparkles
                    : Disc3;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      updateSettings({ spinSound: opt.id, soundEnabled: true });
                      previewSpinSound(opt.id);
                      setPreviewingId(opt.id);
                      setTimeout(() => {
                        setPreviewingId((curr) => (curr === opt.id ? null : curr));
                      }, 460);
                    }}
                    aria-pressed={active}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      active
                        ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isPreviewing ? 'animate-pulse' : ''}`} />
                      <span className="truncate">{isKm ? opt.nameKm : opt.nameEn}</span>
                    </span>
                    {isPreviewing && (
                      <Volume2 className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confetti Toggle */}
          <label className="p-5 flex items-center justify-between gap-4 cursor-pointer">
            <div className="flex items-start gap-3">
              <PartyPopper className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                  {t.confettiLabel}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.confettiDesc}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.confettiEnabled}
              onChange={(e) => updateSettings({ confettiEnabled: e.target.checked })}
              className="w-5 h-5 accent-blue-600 rounded cursor-pointer shrink-0"
            />
          </label>

          {/* Haptics Toggle */}
          <label className="p-5 flex items-center justify-between gap-4 cursor-pointer">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                  {t.hapticsLabel}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.hapticsDesc}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.hapticsEnabled}
              onChange={(e) => updateSettings({ hapticsEnabled: e.target.checked })}
              className="w-5 h-5 accent-blue-600 rounded cursor-pointer shrink-0"
            />
          </label>

          {/* Spin Duration Slider */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Timer className="w-5 h-5 text-indigo-500 shrink-0" />
                <label
                  htmlFor="spin-duration-range"
                  className="text-sm font-semibold text-slate-900 dark:text-white"
                >
                  {t.durationLabel}
                </label>
              </div>
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                {settings.spinDuration} {t.seconds}
              </span>
            </div>
            <input
              id="spin-duration-range"
              type="range"
              min={3}
              max={10}
              step={1}
              value={settings.spinDuration}
              onChange={(e) => updateSettings({ spinDuration: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Offline Mode & PWA Install */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Wifi className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                {t.offlineReadyTitle}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.offlineReadyDesc}
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <PWAInstallButton language={settings.language} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
