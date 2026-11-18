'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { COPY } from '@/lib/i18n';
import { isValidPasscodeFormat } from '@/lib/firestore-service';

export function AuthModal() {
  const {
    authModalOpen,
    closeAuthModal,
    registerWithPasscode,
    signInWithGoogle,
    authLoading,
    authError,
    appAdminName,
    settings,
  } = usePickerwel();

  const t = COPY[settings.language];
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleClose = () => {
    setFormError(null);
    closeAuthModal();
  };

  useEffect(() => {
    if (!authModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFormError(null);
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError(t.authNameRequiredError);
      return;
    }

    const trimmedCode = passcode.trim().toUpperCase();
    if (!isValidPasscodeFormat(trimmedCode)) {
      setFormError(t.authPasscodeFormatError);
      return;
    }

    setSubmitting(true);
    try {
      await registerWithPasscode(trimmedName, trimmedCode);
      setName('');
      setPasscode('');
      handleClose();
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'NAME_REQUIRED') {
        setFormError(t.authNameRequiredError);
      } else if (code === 'PASSCODE_DISABLED') {
        setFormError(t.authPasscodeDisabledError);
      } else if (code === 'PASSCODE_INVALID') {
        setFormError(t.authPasscodeInvalidError);
      } else {
        setFormError(t.authPasscodeNetworkError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminGoogle = async () => {
    setFormError(null);
    await signInWithGoogle();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Top Accent Header */}
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#4F46E5] text-white flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="auth-modal-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-white"
              >
                {t.authModalTitle}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t.authModalSubtitle}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#3B82F6] dark:text-blue-400">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{t.adminAppLabel}: {appAdminName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label={t.close}
            className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Name + Passcode Registration Form (No Email Required) */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="passcode-reg-name"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              {t.authNameLabel}
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="passcode-reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoFocus
                placeholder={t.authNamePlaceholder}
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="passcode-reg-code"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              {t.authPasscodeLabel}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="passcode-reg-code"
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                maxLength={32}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder={t.authPasscodePlaceholder}
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-sm tracking-wider uppercase text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-normal placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
              />
            </div>
          </div>

          {(formError || authError) && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                !formError && authError === 'auth_popup_closed'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {formError ||
                  (authError === 'auth_popup_closed'
                    ? t.authPopupClosedHint
                    : authError === 'auth_popup_blocked'
                    ? t.authPopupBlockedHint
                    : t.authErrorHint)}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || authLoading}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.authVerifyingBtn}</span>
              </>
            ) : (
              <>
                <span>{t.authSubmitPasscodeBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Secondary Admin Google Sign-In */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <p className="text-[11px] font-medium text-center text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t.authAdminDivider}
            </p>
            <button
              type="button"
              onClick={handleAdminGoogle}
              disabled={authLoading || submitting}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4 text-[#3B82F6]" />
              <span>{t.authAdminGoogleBtn}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
