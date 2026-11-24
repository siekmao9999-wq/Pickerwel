'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Send,
  Trophy,
  Lock,
  Mail,
  WifiOff,
  UserPlus,
  Sigma,
  CloudUpload,
  RefreshCw,
  Clock,
} from 'lucide-react';
import {
  FORM_THEMES,
  isValidEmailAddress,
  scoreFormSubmission,
  type CustomForm,
  type FormQuestion,
} from '@/lib/forms-model';
import { MathText, hasExplicitMathSyntax } from '@/components/MathText';
import { StemFormulaEditorModal } from './StemFormulaEditorModal';
import type { Language } from '@/lib/i18n';

export type FormSubmitSyncMode = 'synced' | 'queued' | 'local_only';

interface FormFillerProps {
  form: CustomForm;
  language: Language;
  isPreview?: boolean;
  isOfflineMode?: boolean;
  offlineSavedCount?: number;
  isOnline?: boolean;
  pendingSyncCount?: number;
  isSyncing?: boolean;
  submitting?: boolean;
  onSyncNow?: () => void;
  onOpenSyncQueue?: () => void;
  onSubmitResponse: (payload: {
    respondentName: string;
    respondentEmail: string;
    answers: Record<string, string | string[]>;
    score: number;
    maxScore: number;
  }) => Promise<{ syncMode?: FormSubmitSyncMode } | void> | { syncMode?: FormSubmitSyncMode } | void;
  onExitPreview?: () => void;
}

export function FormFiller({
  form,
  language,
  isPreview = false,
  isOfflineMode = false,
  offlineSavedCount = 0,
  isOnline = true,
  pendingSyncCount = 0,
  isSyncing = false,
  submitting = false,
  onSyncNow,
  onOpenSyncQueue,
  onSubmitResponse,
  onExitPreview,
}: FormFillerProps) {
  const km = language === 'km';
  const theme = FORM_THEMES[form.themeId] || FORM_THEMES.purple;
  const emailMode = form.settings.emailMode || 'none';

  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [submittedResult, setSubmittedResult] = useState<{
    score: number;
    maxScore: number;
    syncMode: FormSubmitSyncMode;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formulaTargetQId, setFormulaTargetQId] = useState<string | null>(null);

  const orderedQuestions = useMemo(() => {
    if (!form.settings.shuffleQuestions) return form.questions;
    // Keep deterministic per form session without mutating original
    const copy = [...form.questions];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = (i * 7 + form.id.length) % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [form.id.length, form.questions, form.settings.shuffleQuestions]);

  const setSingleAnswer = (qId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
    setMissingIds((prev) => prev.filter((id) => id !== qId));
  };

  const toggleCheckboxOption = (qId: string, option: string) => {
    setAnswers((prev) => {
      const curr = Array.isArray(prev[qId]) ? (prev[qId] as string[]) : [];
      const exists = curr.includes(option);
      const next = exists ? curr.filter((o) => o !== option) : [...curr, option];
      return { ...prev, [qId]: next };
    });
    setMissingIds((prev) => prev.filter((id) => id !== qId));
  };

  const handleClearForm = () => {
    setRespondentName('');
    setRespondentEmail('');
    setEmailError(null);
    setAnswers({});
    setOtherInputs({});
    setMissingIds([]);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setEmailError(null);

    const missing: string[] = [];
    if (form.settings.collectRespondentName && !respondentName.trim()) {
      missing.push('__respondent_name__');
    }

    const trimmedEmail = respondentEmail.trim();
    if (emailMode === 'required') {
      if (!trimmedEmail) {
        missing.push('__respondent_email__');
        setEmailError(km ? 'សូមបញ្ចូលអ៊ីមែលរបស់អ្នក' : 'Please enter your email address');
      } else if (!isValidEmailAddress(trimmedEmail)) {
        missing.push('__respondent_email__');
        setEmailError(
          km
            ? 'ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវទេ (ឧ. name@gmail.com)'
            : 'Please enter a valid email address (e.g. name@example.com)'
        );
      }
    } else if (emailMode === 'optional' && trimmedEmail && !isValidEmailAddress(trimmedEmail)) {
      missing.push('__respondent_email__');
      setEmailError(
        km
          ? 'ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវទេ (ឬទុកទទេប្រសិនបើមិនចង់បំពេញ)'
          : 'Invalid email format (or leave blank if optional)'
      );
    }

    const finalAnswers: Record<string, string | string[]> = {};
    for (const q of form.questions) {
      if (q.type === 'section') continue;
      const raw = answers[q.id];
      if (q.type === 'checkboxes') {
        const list = Array.isArray(raw) ? [...raw] : [];
        const resolved = list
          .map((item) =>
            item === '__OTHER__'
              ? (otherInputs[q.id] || '').trim() || (km ? 'ផ្សេងៗ' : 'Other')
              : item
          )
          .filter(Boolean);
        finalAnswers[q.id] = resolved;
        if (q.required && resolved.length === 0) missing.push(q.id);
      } else {
        let str = typeof raw === 'string' ? raw.trim() : '';
        if (str === '__OTHER__') {
          str = (otherInputs[q.id] || '').trim();
        }
        finalAnswers[q.id] = str;
        if (q.required && !str) missing.push(q.id);
      }
    }

    if (missing.length > 0) {
      setMissingIds(missing);
      return;
    }

    const { score, maxScore } = scoreFormSubmission(form, finalAnswers);

    try {
      const outcome = await onSubmitResponse({
        respondentName:
          respondentName.trim() ||
          (emailMode !== 'none' && trimmedEmail ? trimmedEmail.split('@')[0] : '') ||
          (km ? 'អ្នកឆ្លើយអនាមិក' : 'Anonymous'),
        respondentEmail: emailMode === 'none' ? '' : trimmedEmail,
        answers: finalAnswers,
        score,
        maxScore,
      });
      const resolvedSyncMode: FormSubmitSyncMode =
        outcome && typeof outcome === 'object' && outcome.syncMode
          ? outcome.syncMode
          : form.syncedToCloud
            ? 'synced'
            : 'local_only';
      setSubmittedResult({ score, maxScore, syncMode: resolvedSyncMode });
    } catch {
      setSubmitError(
        km
          ? 'មិនអាចផ្ញើចម្លើយបានទេ។ សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយព្យាយាមម្តងទៀត។'
          : 'Could not submit your response. Please check your connection and try again.'
      );
    }
  };

  if (!form.settings.acceptingResponses && !isPreview) {
    return (
      <div
        className="min-h-full py-8 px-4 transition-colors dark:!bg-slate-950"
        style={{ backgroundColor: theme.softBgLight }}
      >
        <div className="max-w-[660px] mx-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="h-2.5 w-full" style={{ backgroundColor: theme.primary }} />
          <div className="p-6 sm:p-8 space-y-3">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Lock className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                {km ? 'បិទការទទួលចម្លើយ' : 'Closed'}
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              <MathText text={form.title} explicitOnly />
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {km
                ? 'ទម្រង់នេះលែងទទួលចម្លើយទៀតហើយ។ សូមទាក់ទងគ្រូ ឬអ្នកបង្កើតទម្រង់ប្រសិនបើអ្នកគិតថានេះជាកំហុស។'
                : 'This form is no longer accepting responses. Please contact the form owner if you believe this is a mistake.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (submittedResult) {
    return (
      <div
        className="min-h-full py-8 px-4 transition-colors dark:!bg-slate-950"
        style={{ backgroundColor: theme.softBgLight }}
      >
        <div className="max-w-[660px] mx-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="h-2.5 w-full" style={{ backgroundColor: theme.primary }} />
          <div className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 shrink-0" />
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                <MathText text={form.title} explicitOnly />
              </h1>
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {form.settings.confirmationMessage ||
                (km
                  ? 'ចម្លើយរបស់អ្នកត្រូវបានកត់ត្រាដោយជោគជ័យ!'
                  : 'Your response has been recorded!')}
            </p>

            {/* Pending Sync vs Cloud Synced Confirmation Banner */}
            {submittedResult.syncMode === 'queued' && (
              pendingSyncCount > 0 ? (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {isSyncing ? (
                      <RefreshCw className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="text-xs">
                      <p className="font-semibold text-amber-900 dark:text-amber-200">
                        {isSyncing
                          ? km
                            ? 'កំពុងបញ្ជូនចម្លើយទៅ Cloud...'
                            : 'Uploading cached submission to cloud...'
                          : km
                            ? `បានរក្សាទុកក្នុង Pending Sync (${pendingSyncCount})`
                            : `Saved to Pending Sync Queue (${pendingSyncCount})`}
                      </p>
                      <p className="mt-0.5 text-amber-800/85 dark:text-amber-300/80 leading-relaxed">
                        {km
                          ? 'ចម្លើយរបស់អ្នកត្រូវបានរក្សាទុកដោយសុវត្ថិភាពក្នុងឧបករណ៍ ហើយនឹងបញ្ជូនឡើង Cloud ដោយស្វ័យប្រវត្តិពេលភ្ជាប់អ៊ីនធឺណិតវិញ។'
                          : 'Your response is safely cached offline and will push to the cloud automatically once internet reconnects.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOnline && onSyncNow && (
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={onSyncNow}
                        className="min-h-[32px] px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{km ? 'បញ្ជូនឥឡូវ' : 'Sync Now'}</span>
                      </button>
                    )}
                    {onOpenSyncQueue && (
                      <button
                        type="button"
                        onClick={onOpenSyncQueue}
                        className="min-h-[32px] px-2.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-100/70 dark:hover:bg-amber-900/40 cursor-pointer"
                      >
                        {km ? 'មើលបញ្ជី' : 'View Queue'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                  <CloudUpload className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    {km
                      ? 'បានបញ្ជូនចម្លើយពី Pending Sync ទៅ Cloud ដោយស្វ័យប្រវត្តិរួចរាល់!'
                      : 'Your queued offline submission has automatically synced to the cloud!'}
                  </span>
                </div>
              )
            )}

            {form.settings.isQuiz && submittedResult.maxScore > 0 && (
              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-6 h-6 text-amber-500" />
                  <div>
                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      {km ? 'ពិន្ទុតេស្តស្វ័យប្រវត្តិ' : 'Auto-Graded Quiz Score'}
                    </p>
                    <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                      {submittedResult.score} / {submittedResult.maxScore}
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold font-mono tabular-nums text-indigo-700 dark:text-indigo-300">
                  {Math.round((submittedResult.score / submittedResult.maxScore) * 100)}%
                </span>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              {(form.settings.allowMultipleResponses || isOfflineMode) && (
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedResult(null);
                    handleClearForm();
                  }}
                  className={
                    isOfflineMode
                      ? 'min-h-[40px] px-4 rounded-xl text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shadow-sm cursor-pointer'
                      : 'text-sm font-semibold underline cursor-pointer'
                  }
                  style={
                    isOfflineMode
                      ? { backgroundColor: theme.primary }
                      : { color: theme.primary }
                  }
                >
                  {isOfflineMode && <UserPlus className="w-4 h-4" />}
                  <span>
                    {isOfflineMode
                      ? km
                        ? 'បំពេញសម្រាប់អ្នកបន្ទាប់ (Offline)'
                        : 'Next Respondent (Offline)'
                      : km
                        ? 'ផ្ញើចម្លើយថ្មីម្តងទៀត'
                        : 'Submit another response'}
                  </span>
                </button>
              )}
              {(isPreview || isOfflineMode) && onExitPreview && (
                <button
                  type="button"
                  onClick={onExitPreview}
                  className="min-h-[38px] px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {km ? 'ត្រឡប់ទៅការកែសម្រួល & មើលចម្លើយ' : 'Back to Editor & Responses'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderQuestionInput = (q: FormQuestion) => {
    const val = answers[q.id];
    const isMissing = missingIds.includes(q.id);

    if (q.type === 'multiple_choice') {
      const selected = typeof val === 'string' ? val : '';
      return (
        <div className="space-y-2.5 mt-3">
          {q.options.map((opt, idx) => (
            <label
              key={`${q.id}_mc_${idx}`}
              className="flex items-center gap-3 cursor-pointer text-sm text-slate-800 dark:text-slate-200 min-h-[32px]"
            >
              <input
                type="radio"
                name={q.id}
                checked={selected === opt}
                onChange={() => setSingleAnswer(q.id, opt)}
                className="w-4 h-4 accent-[#673AB7] cursor-pointer"
              />
              <span className="leading-relaxed">
                <MathText text={opt} explicitOnly />
              </span>
            </label>
          ))}
          {q.hasOther && (
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name={q.id}
                checked={selected === '__OTHER__'}
                onChange={() => setSingleAnswer(q.id, '__OTHER__')}
                className="w-4 h-4 accent-[#673AB7] cursor-pointer shrink-0"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400 shrink-0">
                {km ? 'ផ្សេងៗ៖' : 'Other:'}
              </span>
              <input
                type="text"
                value={otherInputs[q.id] || ''}
                onFocus={() => setSingleAnswer(q.id, '__OTHER__')}
                onChange={(e) => {
                  setSingleAnswer(q.id, '__OTHER__');
                  setOtherInputs((prev) => ({ ...prev, [q.id]: e.target.value }));
                }}
                placeholder={km ? 'វាយចម្លើយផ្សេង...' : 'Type your answer...'}
                className="flex-1 bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-[#673AB7] focus:outline-none py-1 text-sm text-slate-900 dark:text-white"
              />
            </div>
          )}
        </div>
      );
    }

    if (q.type === 'checkboxes') {
      const selectedList = Array.isArray(val) ? val : [];
      return (
        <div className="space-y-2.5 mt-3">
          {q.options.map((opt, idx) => (
            <label
              key={`${q.id}_cb_${idx}`}
              className="flex items-center gap-3 cursor-pointer text-sm text-slate-800 dark:text-slate-200 min-h-[32px]"
            >
              <input
                type="checkbox"
                checked={selectedList.includes(opt)}
                onChange={() => toggleCheckboxOption(q.id, opt)}
                className="w-4 h-4 rounded accent-[#673AB7] cursor-pointer"
              />
              <span className="leading-relaxed">
                <MathText text={opt} explicitOnly />
              </span>
            </label>
          ))}
          {q.hasOther && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedList.includes('__OTHER__')}
                onChange={() => toggleCheckboxOption(q.id, '__OTHER__')}
                className="w-4 h-4 rounded accent-[#673AB7] cursor-pointer shrink-0"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400 shrink-0">
                {km ? 'ផ្សេងៗ៖' : 'Other:'}
              </span>
              <input
                type="text"
                value={otherInputs[q.id] || ''}
                onChange={(e) => {
                  if (!selectedList.includes('__OTHER__')) {
                    toggleCheckboxOption(q.id, '__OTHER__');
                  }
                  setOtherInputs((prev) => ({ ...prev, [q.id]: e.target.value }));
                }}
                placeholder={km ? 'វាយចម្លើយផ្សេង...' : 'Type your answer...'}
                className="flex-1 bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-[#673AB7] focus:outline-none py-1 text-sm text-slate-900 dark:text-white"
              />
            </div>
          )}
        </div>
      );
    }

    if (q.type === 'dropdown') {
      return (
        <div className="mt-3 max-w-xs">
          <select
            value={typeof val === 'string' ? val : ''}
            onChange={(e) => setSingleAnswer(q.id, e.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">{km ? 'ជ្រើសរើស...' : 'Choose...'}</option>
            {q.options.map((opt, idx) => (
              <option key={`${q.id}_dd_${idx}`} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (q.type === 'short_answer') {
      const strVal = typeof val === 'string' ? val : '';
      return (
        <div className="mt-3 space-y-2">
          <div className="flex items-end gap-2">
            <input
              type="text"
              value={strVal}
              onChange={(e) => setSingleAnswer(q.id, e.target.value)}
              placeholder={km ? 'ចម្លើយរបស់អ្នក (អាចបញ្ចូលរូបមន្ត $...$)' : 'Your answer (supports $...$ formulas)'}
              className={`flex-1 sm:max-w-[75%] bg-transparent border-b py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none ${
                isMissing
                  ? 'border-rose-500'
                  : 'border-slate-300 dark:border-slate-700 focus:border-[#673AB7]'
              }`}
            />
            <button
              type="button"
              onClick={() => setFormulaTargetQId(q.id)}
              title={km ? 'បើកកម្មវិធីសរសេររូបមន្ត គណិត•រូប•គីមី' : 'Open Math, Physics & Chemistry Formula Editor'}
              className="min-h-[34px] px-2.5 rounded-lg border border-purple-200 dark:border-purple-800/80 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-semibold inline-flex items-center gap-1 hover:bg-purple-100/80 dark:hover:bg-purple-900/40 shrink-0 cursor-pointer"
            >
              <Sigma className="w-3.5 h-3.5" />
              <span>MathType</span>
            </button>
          </div>
          {hasExplicitMathSyntax(strVal) && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 overflow-x-auto">
              <MathText text={strVal} explicitOnly />
            </div>
          )}
        </div>
      );
    }

    if (q.type === 'paragraph') {
      const strVal = typeof val === 'string' ? val : '';
      return (
        <div className="mt-3 space-y-2">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setFormulaTargetQId(q.id)}
              title={km ? 'បើកកម្មវិធីសរសេររូបមន្ត គណិត•រូប•គីមី' : 'Open Math, Physics & Chemistry Formula Editor'}
              className="min-h-[32px] px-2.5 rounded-lg border border-purple-200 dark:border-purple-800/80 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-purple-100/80 dark:hover:bg-purple-900/40 cursor-pointer"
            >
              <Sigma className="w-3.5 h-3.5" />
              <span>
                {km ? 'MathType — សរសេររូបមន្ត គណិត•រូប•គីមី' : 'MathType — Math • Physics • Chem'}
              </span>
            </button>
          </div>
          <textarea
            rows={3}
            value={strVal}
            onChange={(e) => setSingleAnswer(q.id, e.target.value)}
            placeholder={
              km
                ? 'ចម្លើយវែងរបស់អ្នក... (អាចចុចប៊ូតុង រូបមន្ត ដើម្បីបញ្ចូលសមីការគណិត រូប គីមី)'
                : 'Your answer... (click fx to insert Math, Physics, or Chemistry formulas)'
            }
            className={`w-full bg-transparent border-b py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none resize-y ${
              isMissing
                ? 'border-rose-500'
                : 'border-slate-300 dark:border-slate-700 focus:border-[#673AB7]'
            }`}
          />
          {hasExplicitMathSyntax(strVal) && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 overflow-x-auto whitespace-pre-wrap">
              <MathText text={strVal} explicitOnly />
            </div>
          )}
        </div>
      );
    }

    if (q.type === 'linear_scale') {
      const min = q.scaleMin ?? 1;
      const max = q.scaleMax ?? 5;
      const points: number[] = [];
      for (let v = min; v <= max; v++) points.push(v);
      const selected = typeof val === 'string' ? val : '';
      return (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          {q.scaleMinLabel && (
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 pb-1">
              <MathText text={q.scaleMinLabel} explicitOnly />
            </span>
          )}
          <div className="flex items-center justify-between sm:justify-center gap-3 sm:gap-5 flex-1">
            {points.map((pt) => (
              <label
                key={pt}
                className="flex flex-col items-center gap-2 cursor-pointer"
              >
                <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                  {pt}
                </span>
                <input
                  type="radio"
                  name={q.id}
                  checked={selected === String(pt)}
                  onChange={() => setSingleAnswer(q.id, String(pt))}
                  className="w-4 h-4 accent-[#673AB7] cursor-pointer"
                />
              </label>
            ))}
          </div>
          {q.scaleMaxLabel && (
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 pb-1 text-right">
              <MathText text={q.scaleMaxLabel} explicitOnly />
            </span>
          )}
        </div>
      );
    }

    if (q.type === 'date') {
      return (
        <input
          type="date"
          value={typeof val === 'string' ? val : ''}
          onChange={(e) => setSingleAnswer(q.id, e.target.value)}
          className="mt-3 h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
        />
      );
    }

    if (q.type === 'time') {
      return (
        <input
          type="time"
          value={typeof val === 'string' ? val : ''}
          onChange={(e) => setSingleAnswer(q.id, e.target.value)}
          className="mt-3 h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
        />
      );
    }

    return null;
  };

  return (
    <div
      className="min-h-full py-6 sm:py-8 px-3.5 sm:px-4 transition-colors dark:!bg-slate-950"
      style={{ backgroundColor: theme.softBgLight }}
    >
      <form
        onSubmit={handleSubmit}
        className="max-w-[660px] mx-auto space-y-3.5"
      >
        {(isPreview || isOfflineMode) && (
          <div
            className={`rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs ${
              isOfflineMode
                ? 'bg-emerald-950 text-emerald-50 border border-emerald-800'
                : 'bg-slate-900 text-white'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {isOfflineMode && <WifiOff className="w-4 h-4 text-emerald-300 shrink-0" />}
              <span className="leading-snug">
                {isOfflineMode
                  ? km
                    ? `របៀបបំពេញ Offline (រក្សាទុកក្នុងឧបករណ៍៖ ${offlineSavedCount} ចម្លើយ${pendingSyncCount > 0 ? ` · Pending Sync៖ ${pendingSyncCount}` : ''})`
                    : `Offline Fill Mode (Saved locally: ${offlineSavedCount}${pendingSyncCount > 0 ? ` · Pending Sync: ${pendingSyncCount}` : ''})`
                  : km
                    ? 'កំពុងមើលជាមុន (Preview) — អ្នកអាចសាកល្បងឆ្លើយ និងផ្ញើចម្លើយបានភ្លាមៗ'
                    : 'Preview Mode — try filling out and submitting a test response'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {pendingSyncCount > 0 && onOpenSyncQueue && (
                <button
                  type="button"
                  onClick={onOpenSyncQueue}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>{km ? `Pending (${pendingSyncCount})` : `Queue (${pendingSyncCount})`}</span>
                </button>
              )}
              {onExitPreview && (
                <button
                  type="button"
                  onClick={onExitPreview}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-semibold cursor-pointer whitespace-nowrap"
                >
                  {km ? 'ត្រឡប់ទៅអ្នកបង្កើត' : 'Exit Mode'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Offline / Pending Sync Strip for Published Forms */}
        {!isPreview && !isOfflineMode && (!isOnline || pendingSyncCount > 0) && (
          <div className="rounded-xl px-4 py-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-100">
            <div className="flex items-center gap-2 min-w-0">
              {!isOnline ? (
                <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <CloudUpload className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span className="leading-snug">
                {!isOnline
                  ? km
                    ? `អ្នកកំពុង Offline — អ្នកនៅតែអាចឆ្លើយ និងផ្ញើបាន ចម្លើយនឹងរក្សាទុកក្នុង Pending Sync ហើយបញ្ជូនទៅ Cloud ដោយស្វ័យប្រវត្តិពេលមានអ៊ីនធឺណិត${pendingSyncCount > 0 ? ` (${pendingSyncCount} រង់ចាំ)` : ''}។`
                    : `You are offline — submissions will cache in Pending Sync and auto-upload once reconnected${pendingSyncCount > 0 ? ` (${pendingSyncCount} queued)` : ''}.`
                  : km
                    ? `មានចម្លើយ Offline ចំនួន ${pendingSyncCount} នៅក្នុង Pending Sync រង់ចាំបញ្ជូនទៅ Cloud។`
                    : `${pendingSyncCount} cached offline submission${pendingSyncCount === 1 ? '' : 's'} waiting in Pending Sync.`}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isOnline && pendingSyncCount > 0 && onSyncNow && (
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={onSyncNow}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{km ? 'បញ្ជូនឥឡូវ' : 'Sync Now'}</span>
                </button>
              )}
              {pendingSyncCount > 0 && onOpenSyncQueue && (
                <button
                  type="button"
                  onClick={onOpenSyncQueue}
                  className="px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 font-semibold hover:bg-amber-100/70 dark:hover:bg-amber-900/40 cursor-pointer"
                >
                  {km ? 'មើលបញ្ជី' : 'View Queue'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Header Title Card */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="h-2.5 w-full" style={{ backgroundColor: theme.primary }} />
          <div className="p-5 sm:p-6">
            <h1 className="font-display text-2xl sm:text-[30px] font-bold text-slate-900 dark:text-white leading-tight break-words">
              <MathText
                text={form.title || (km ? 'ទម្រង់គ្មានចំណងជើង' : 'Untitled form')}
                explicitOnly
              />
            </h1>
            {form.description && (
              <div className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                <MathText text={form.description} explicitOnly />
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                * {km ? 'បង្ហាញសំណួរដែលត្រូវបំពេញជាចាំបាច់' : 'Indicates required question'}
              </span>
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 font-medium">
                  <Mail className="w-3.5 h-3.5" />
                  {emailMode === 'required'
                    ? km
                      ? 'តម្រូវឱ្យបំពេញ Email'
                      : 'Email required'
                    : emailMode === 'optional'
                      ? km
                        ? 'Email (ស្រេចចិត្ត)'
                        : 'Email optional'
                      : km
                        ? 'អត់ប្រើ Email'
                        : 'No email required'}
                </span>
                {form.ownerDisplayName && (
                  <span>
                    {km ? 'ដោយ៖' : 'By:'} {form.ownerDisplayName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Email Card (Shown when Use Email is Required or Optional) */}
        {emailMode !== 'none' && (
          <div
            className={`rounded-xl bg-white dark:bg-slate-900 border p-5 sm:p-6 shadow-sm ${
              missingIds.includes('__respondent_email__')
                ? 'border-rose-400 dark:border-rose-600'
                : 'border-slate-200/90 dark:border-slate-800'
            }`}
          >
            <label className="flex items-center gap-1.5 text-[15px] font-medium text-slate-900 dark:text-white">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                {emailMode === 'required'
                  ? km
                    ? 'អ៊ីមែលរបស់អ្នក (Email)'
                    : 'Your Email'
                  : km
                    ? 'អ៊ីមែលរបស់អ្នក (ស្រេចចិត្ត — Optional)'
                    : 'Your Email (optional)'}
              </span>
              {emailMode === 'required' && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={120}
              value={respondentEmail}
              onChange={(e) => {
                setRespondentEmail(e.target.value);
                setEmailError(null);
                setMissingIds((prev) => prev.filter((id) => id !== '__respondent_email__'));
              }}
              placeholder={km ? 'ឧទាហរណ៍៖ student@gmail.com' : 'e.g. name@example.com'}
              className="mt-3 w-full sm:w-2/3 bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-[#673AB7] focus:outline-none py-1.5 text-sm text-slate-900 dark:text-white"
            />
            {emailError && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{emailError}</span>
              </p>
            )}
          </div>
        )}

        {/* Optional Respondent Name Card */}
        {form.settings.collectRespondentName && (
          <div
            className={`rounded-xl bg-white dark:bg-slate-900 border p-5 sm:p-6 shadow-sm ${
              missingIds.includes('__respondent_name__')
                ? 'border-rose-400 dark:border-rose-600'
                : 'border-slate-200/90 dark:border-slate-800'
            }`}
          >
            <label className="block text-[15px] font-medium text-slate-900 dark:text-white">
              {km ? 'ឈ្មោះរបស់អ្នក' : 'Your Name'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              maxLength={80}
              value={respondentName}
              onChange={(e) => {
                setRespondentName(e.target.value);
                setMissingIds((prev) => prev.filter((id) => id !== '__respondent_name__'));
              }}
              placeholder={km ? 'វាយឈ្មោះរបស់អ្នក...' : 'Enter your name...'}
              className="mt-3 w-full sm:w-2/3 bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-[#673AB7] focus:outline-none py-1.5 text-sm text-slate-900 dark:text-white"
            />
            {missingIds.includes('__respondent_name__') && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{km ? 'សូមបញ្ចូលឈ្មោះរបស់អ្នក' : 'Please enter your name'}</span>
              </p>
            )}
          </div>
        )}

        {/* Question Cards */}
        {orderedQuestions.map((q) => {
          if (q.type === 'section') {
            return (
              <div
                key={q.id}
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden"
              >
                <div
                  className="px-5 py-2 text-xs font-semibold text-white"
                  style={{ backgroundColor: theme.primary }}
                >
                  <MathText text={q.title} explicitOnly />
                </div>
                {q.description && (
                  <div className="p-5 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                    <MathText text={q.description} explicitOnly />
                  </div>
                )}
              </div>
            );
          }

          const isMissing = missingIds.includes(q.id);
          return (
            <div
              key={q.id}
              className={`rounded-xl bg-white dark:bg-slate-900 border p-5 sm:p-6 shadow-sm ${
                isMissing
                  ? 'border-rose-400 dark:border-rose-600'
                  : 'border-slate-200/90 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-medium text-slate-900 dark:text-white leading-relaxed">
                  <MathText
                    text={q.title || (km ? 'សំណួរ' : 'Question')}
                    explicitOnly
                  />
                  {q.required && <span className="text-rose-500 ml-1">*</span>}
                </h2>
                {form.settings.isQuiz && (q.points ?? 0) > 0 && (
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                    {q.points} {km ? 'ពិន្ទុ' : 'pts'}
                  </span>
                )}
              </div>

              {q.description && (
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <MathText text={q.description} explicitOnly />
                </div>
              )}

              {q.imageUrl && (
                <div className="mt-3 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 max-h-72">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={q.imageUrl}
                    alt={q.title}
                    className="w-full max-h-72 object-contain bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              )}

              {renderQuestionInput(q)}

              {isMissing && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>
                    {km ? 'នេះជាសំណួរចាំបាច់ត្រូវឆ្លើយ' : 'This is a required question'}
                  </span>
                </p>
              )}
            </div>
          );
        })}

        {submitError && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-300">
            {submitError}
          </div>
        )}

        {/* Submit Footer */}
        <div className="pt-1 pb-6 flex items-center justify-between gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[42px] px-6 rounded-lg text-white text-sm font-semibold inline-flex items-center gap-2 shadow-sm hover:opacity-95 disabled:opacity-60 transition-opacity cursor-pointer"
            style={{ backgroundColor: theme.primary }}
          >
            <Send className="w-4 h-4" />
            <span>
              {submitting
                ? km
                  ? 'កំពុងផ្ញើ...'
                  : 'Submitting...'
                : km
                  ? 'ផ្ញើចម្លើយ (Submit)'
                  : 'Submit'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleClearForm}
            className="min-h-[40px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            style={{ color: theme.primary }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{km ? 'សម្អាតទម្រង់' : 'Clear form'}</span>
          </button>
        </div>
      </form>

      <StemFormulaEditorModal
        open={formulaTargetQId !== null}
        language={language}
        accentColor={theme.primary}
        targetLabel={km ? 'ចម្លើយរបស់អ្នក (គណិត•រូប•គីមី)' : 'Your STEM Answer'}
        onClose={() => setFormulaTargetQId(null)}
        onInsert={(formattedFormula) => {
          if (!formulaTargetQId) return;
          const prevRaw = answers[formulaTargetQId];
          const prevStr = typeof prevRaw === 'string' ? prevRaw : '';
          const nextStr = prevStr.trim()
            ? `${prevStr} ${formattedFormula}`
            : formattedFormula;
          setSingleAnswer(formulaTargetQId, nextStr);
        }}
      />
    </div>
  );
}
