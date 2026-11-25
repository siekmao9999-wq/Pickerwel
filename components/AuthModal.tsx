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
  CheckCircle2,
  Copy,
  Check,
  UserPlus,
} from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { COPY } from '@/lib/i18n';
import { isValidPasscodeFormat } from '@/lib/firestore-service';

type AuthMode = 'instant' | 'passcode';

export function AuthModal() {
  const {
    authModalOpen,
    prefillPasscode,
    closeAuthModal,
    registerInstantAutoCode,
    registerWithPasscode,
    autoDropEnabled,
    signInWithGoogle,
    authLoading,
    authError,
    appAdminName,
    settings,
  } = usePickerwel();

  const t = COPY[settings.language];
  const [modeDraft, setModeDraft] = useState<AuthMode | null>(null);
  const [name, setName] = useState('');
  const [passcodeDraft, setPasscodeDraft] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [issuedMember, setIssuedMember] = useState<{
    displayName: string;
    passcode: string;
  } | null>(null);
  const [copiedIssuedCode, setCopiedIssuedCode] = useState(false);

  const activeMode: AuthMode =
    modeDraft ?? (prefillPasscode || !autoDropEnabled ? 'passcode' : 'instant');
  const passcode = passcodeDraft ?? prefillPasscode;

  const handleClose = () => {
    setFormError(null);
    setPasscodeDraft(null);
    setModeDraft(null);
    setIssuedMember(null);
    setCopiedIssuedCode(false);
    closeAuthModal();
  };

  useEffect(() => {
    if (!authModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFormError(null);
        setPasscodeDraft(null);
        setModeDraft(null);
        setIssuedMember(null);
        setCopiedIssuedCode(false);
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen) return null;

  const handleSubmitInstant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError(t.authNameRequiredError);
      return;
    }

    setSubmitting(true);
    try {
      const member = await registerInstantAutoCode(trimmedName);
      setIssuedMember({
        displayName: member.displayName,
        passcode: member.passcode,
      });
      setName('');
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'NAME_REQUIRED') {
        setFormError(t.authNameRequiredError);
      } else if (code === 'AUTO_DROP_DISABLED') {
        setFormError(t.authAutoDropDisabledError);
      } else {
        setFormError(t.authPasscodeNetworkError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPasscode = async (e: React.FormEvent) => {
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
      setPasscodeDraft('');
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

  const handleCopyIssuedCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIssuedCode(true);
      window.setTimeout(() => setCopiedIssuedCode(false), 1800);
    } catch {
      // Ignore clipboard error
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
              {activeMode === 'instant' ? (
                <UserPlus className="w-5 h-5" />
              ) : (
                <KeyRound className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="auth-modal-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-white"
              >
                {t.authModalTitle}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {activeMode === 'instant' ? t.authRequestSubtitle : t.authModalSubtitle}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#3B82F6] dark:text-blue-400">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {t.adminAppLabel}: {appAdminName}
                </span>
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

        {/* Mode Switcher Tabs (hidden while displaying freshly dropped code) */}
        {!issuedMember && (
          <div className="px-5 sm:px-6 pt-4">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setModeDraft('instant');
                }}
                className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  activeMode === 'instant'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0 text-[#3B82F6] dark:text-blue-400" />
                <span className="truncate">{t.authTabRequestCode}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setModeDraft('passcode');
                }}
                className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  activeMode === 'passcode'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 shrink-0 text-[#3B82F6] dark:text-blue-400" />
                <span className="truncate">{t.authTabHaveCode}</span>
              </button>
            </div>
          </div>
        )}

        <div className="p-5 sm:p-6 space-y-4">
          {/* ========================================================== */}
          {/* INSTANT CODE DROPPED SUCCESS CARD                          */}
          {/* ========================================================== */}
          {issuedMember ? (
            <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-4">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-bold text-emerald-900 dark:text-emerald-100">
                    {t.authInstantSuccessTitle}
                  </h3>
                  <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-200/90 leading-relaxed">
                    {t.authInstantSuccessDesc}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    {t.authRequestYourCodeLabel} · {issuedMember.displayName}
                  </span>
                  <span className="font-mono text-xl font-bold tracking-widest text-slate-900 dark:text-white">
                    {issuedMember.passcode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyIssuedCode(issuedMember.passcode)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedIssuedCode ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedIssuedCode ? t.passcodeCopiedBtn : t.passcodeCopyBtn}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <span>{t.authInstantStartBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : activeMode === 'instant' ? (
            /* ========================================================== */
            /* MODE 1: INSTANT REGISTRATION (AUTO-DROP CODE IMMEDIATELY)  */
            /* ========================================================== */
            <form onSubmit={handleSubmitInstant} className="space-y-4">
              {!autoDropEnabled && (
                <div className="p-3 rounded-xl border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{t.authAutoDropDisabledError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="instant-reg-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  {t.authNameLabel}
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="instant-reg-name"
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

              {formError && (
                <div className="p-3 rounded-xl border bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || authLoading || !autoDropEnabled}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.authRequestSubmittingBtn}</span>
                  </>
                ) : (
                  <>
                    <span>{t.authRequestSubmitBtn}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ========================================================== */
            /* MODE 2: SIGN IN WITH EXISTING ADMIN PASSCODE               */
            /* ========================================================== */
            <form onSubmit={handleSubmitPasscode} className="space-y-4">
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
                    onChange={(e) => setPasscodeDraft(e.target.value.toUpperCase())}
                    maxLength={32}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={t.authPasscodePlaceholder}
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-sm tracking-wider uppercase text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-normal placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-1.5 pt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#3B82F6] shrink-0 mt-0.5" />
                  <span>{t.authAdminOnlyCodeNote(appAdminName)}</span>
                </p>
              </div>

              {formError && (
                <div className="p-3 rounded-xl border bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
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
            </form>
          )}

          {/* Shared Google Auth Error Notice */}
          {authError && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                authError === 'auth_popup_closed'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {authError === 'auth_popup_closed'
                  ? t.authPopupClosedHint
                  : authError === 'auth_popup_blocked'
                  ? t.authPopupBlockedHint
                  : t.authErrorHint}
              </span>
            </div>
          )}

          {/* Secondary Admin Google Sign-In */}
          {!issuedMember && (
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
          )}
        </div>
      </div>
    </div>
  );
}
