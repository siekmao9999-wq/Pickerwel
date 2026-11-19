'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Smile,
  Cat,
  Dog,
  Bird,
  Fish,
  Rocket,
  Crown,
  Star,
  Flame,
  Heart,
  Gamepad2,
  Sparkles,
  Check,
  ImageUp,
  ArrowLeft,
  ArrowRight,
  X,
  User as UserIcon,
  Link2,
  AlertCircle,
} from 'lucide-react';
import { COPY, type Language } from '@/lib/i18n';
import {
  PRESET_AVATARS,
  findPresetAvatar,
  loadGuestPlayerProfile,
  resizeAvatarImageFile,
  saveGuestPlayerProfile,
  type GuestPlayerProfile,
  type PresetAvatarIconKey,
} from '@/lib/player-profile';

function renderPresetIcon(iconKey: PresetAvatarIconKey, className: string) {
  switch (iconKey) {
    case 'smile':
      return <Smile className={className} />;
    case 'cat':
      return <Cat className={className} />;
    case 'dog':
      return <Dog className={className} />;
    case 'bird':
      return <Bird className={className} />;
    case 'fish':
      return <Fish className={className} />;
    case 'rocket':
      return <Rocket className={className} />;
    case 'crown':
      return <Crown className={className} />;
    case 'star':
      return <Star className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'gamepad':
      return <Gamepad2 className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
  }
}

interface PlayerAvatarBadgeProps {
  avatarId?: string;
  customPhotoDataUrl?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function PlayerAvatarBadge({
  avatarId,
  customPhotoDataUrl,
  name,
  size = 'md',
}: PlayerAvatarBadgeProps) {
  const sizeClass =
    size === 'xs'
      ? 'w-7 h-7'
      : size === 'sm'
      ? 'w-9 h-9'
      : size === 'lg'
      ? 'w-14 h-14'
      : 'w-11 h-11';
  const iconClass =
    size === 'xs'
      ? 'w-4 h-4'
      : size === 'sm'
      ? 'w-5 h-5'
      : size === 'lg'
      ? 'w-7 h-7'
      : 'w-5 h-5';

  if (customPhotoDataUrl && customPhotoDataUrl.startsWith('data:image/')) {
    return (
      <span
        className={`${sizeClass} rounded-full overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm shrink-0 inline-flex items-center justify-center bg-slate-100 dark:bg-slate-800`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={customPhotoDataUrl}
          alt={name || 'Player avatar'}
          className="w-full h-full object-cover"
        />
      </span>
    );
  }

  if (!avatarId) {
    return (
      <span
        className={`${sizeClass} rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 inline-flex items-center justify-center shrink-0`}
      >
        <UserIcon className={iconClass} />
      </span>
    );
  }

  const preset = findPresetAvatar(avatarId);
  return (
    <span
      className={`${sizeClass} rounded-full bg-gradient-to-br ${preset.gradientClass} text-white border-2 border-white dark:border-slate-800 shadow-sm inline-flex items-center justify-center shrink-0`}
    >
      {renderPresetIcon(preset.iconKey, iconClass)}
    </span>
  );
}

interface PlayerProfileFormCardProps {
  language: Language;
  targetLabel?: string;
  submitLabel?: string;
  backLabel?: string;
  initialProfile?: GuestPlayerProfile | null;
  onConfirm: (profile: GuestPlayerProfile) => void;
  onBack?: () => void;
}

export function PlayerProfileFormCard({
  language,
  targetLabel,
  submitLabel,
  backLabel,
  initialProfile,
  onConfirm,
  onBack,
}: PlayerProfileFormCardProps) {
  const t = COPY[language];
  const saved = initialProfile ?? loadGuestPlayerProfile();

  const [name, setName] = useState(saved?.name || '');
  const [selectedAvatarId, setSelectedAvatarId] = useState(saved?.avatarId || '');
  const [customPhotoDataUrl, setCustomPhotoDataUrl] = useState<string | undefined>(
    saved?.customPhotoDataUrl
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const hasName = name.trim().length > 0;
  const hasAvatar =
    Boolean(customPhotoDataUrl) ||
    PRESET_AVATARS.some((a) => a.id === selectedAvatarId);
  const canSubmit = hasName && hasAvatar && !uploadingPhoto;

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);
    setUploadingPhoto(true);
    try {
      const dataUrl = await resizeAvatarImageFile(file);
      setCustomPhotoDataUrl(dataUrl);
      setSelectedAvatarId('custom');
    } catch {
      setErrorMsg(t.playerJoinAvatarRequiredError);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg(t.playerJoinNameRequiredError);
      return;
    }
    if (!hasAvatar) {
      setErrorMsg(t.playerJoinAvatarRequiredError);
      return;
    }
    setErrorMsg(null);
    const savedProfile = saveGuestPlayerProfile({
      name: name.trim(),
      avatarId: customPhotoDataUrl ? 'custom' : selectedAvatarId,
      customPhotoDataUrl,
    });
    onConfirm(savedProfile);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* No-Email Confirmation + Target Preview */}
      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>{t.playerJoinNoEmailBadge}</span>
        </div>
        {targetLabel && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-800/90 dark:text-emerald-200/90 truncate">
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{targetLabel}</span>
          </div>
        )}
      </div>

      {/* Live Player Identity Preview */}
      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center gap-3.5">
        <PlayerAvatarBadge
          avatarId={selectedAvatarId === 'custom' ? '' : selectedAvatarId}
          customPhotoDataUrl={customPhotoDataUrl}
          name={name}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {t.playerJoinPreviewLabel}
          </p>
          <p className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
            {name.trim() || t.playerJoinNamePlaceholder}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {hasAvatar
              ? customPhotoDataUrl
                ? t.playerJoinPhotoSelected
                : language === 'km'
                ? findPresetAvatar(selectedAvatarId).labelKm
                : findPresetAvatar(selectedAvatarId).labelEn
              : t.playerJoinAvatarHint}
          </p>
        </div>
      </div>

      {/* Step 1: Player Name Input */}
      <div className="space-y-1.5">
        <label
          htmlFor="guest-player-name-input"
          className="block text-xs font-bold text-slate-700 dark:text-slate-200"
        >
          1. {t.playerJoinNameLabel} *
        </label>
        <input
          id="guest-player-name-input"
          type="text"
          maxLength={60}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errorMsg) setErrorMsg(null);
          }}
          placeholder={t.playerJoinNamePlaceholder}
          className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Step 2: Avatar Selector Grid + Personal Photo Upload */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            2. {t.playerJoinAvatarLabel} *
          </span>
          <button
            type="button"
            disabled={uploadingPhoto}
            onClick={() => photoInputRef.current?.click()}
            className="min-h-[32px] px-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/70 text-[11px] font-semibold text-[#3B82F6] dark:text-blue-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <ImageUp className="w-3.5 h-3.5 shrink-0" />
            <span>{t.playerJoinUploadPhotoBtn}</span>
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoFile}
            className="hidden"
          />
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {PRESET_AVATARS.map((preset) => {
            const isSelected = !customPhotoDataUrl && selectedAvatarId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setCustomPhotoDataUrl(undefined);
                  setSelectedAvatarId(preset.id);
                  if (errorMsg) setErrorMsg(null);
                }}
                aria-pressed={isSelected}
                aria-label={language === 'km' ? preset.labelKm : preset.labelEn}
                className={`relative p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#3B82F6] bg-blue-50/80 dark:bg-blue-950/50 ring-2 ring-blue-500/40 scale-[1.02]'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${preset.gradientClass} text-white flex items-center justify-center shadow-sm`}
                >
                  {renderPresetIcon(preset.iconKey, 'w-5 h-5')}
                </span>
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate max-w-full">
                  {language === 'km' ? preset.labelKm : preset.labelEn}
                </span>
                {isSelected && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#3B82F6] text-white flex items-center justify-center shadow">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 flex items-center gap-2 text-xs font-medium text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>{backLabel || t.backBtn}</span>
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 disabled:opacity-45 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer whitespace-nowrap"
        >
          <span>{submitLabel || t.playerJoinEnterBtn}</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </form>
  );
}

interface PlayerJoinProfileModalProps {
  isOpen: boolean;
  language: Language;
  targetLabel?: string;
  submitLabel?: string;
  onConfirm: (profile: GuestPlayerProfile) => void;
  onClose: () => void;
}

export function PlayerJoinProfileModal({
  isOpen,
  language,
  targetLabel,
  submitLabel,
  onConfirm,
  onClose,
}: PlayerJoinProfileModalProps) {
  const t = COPY[language];

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-join-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="player-join-modal-title"
              className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white"
            >
              {t.playerJoinTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t.playerJoinDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <PlayerProfileFormCard
            language={language}
            targetLabel={targetLabel}
            submitLabel={submitLabel}
            onConfirm={onConfirm}
            onBack={onClose}
          />
        </div>
      </div>
    </div>
  );
}
