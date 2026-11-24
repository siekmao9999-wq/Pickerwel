'use client';

import React, { useMemo, useState } from 'react';
import {
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  UserCheck,
  Inbox,
  Mail,
  FileDown,
  FileSpreadsheet,
  FileText,
  CloudUpload,
  RefreshCw,
  Clock,
  WifiOff,
  Cloud,
} from 'lucide-react';
import {
  FORM_THEMES,
  exportFormResponsesToCsv,
  exportOfflineFormPackageJson,
  type CustomForm,
  type FormResponseRecord,
} from '@/lib/forms-model';
import {
  exportFormToExcelXlsx,
  exportFormToWordDocx,
} from '@/lib/form-office-io';
import { MathText } from '@/components/MathText';
import type { Language } from '@/lib/i18n';

interface FormResponsesViewProps {
  form: CustomForm;
  responses: FormResponseRecord[];
  language: Language;
  pendingSyncCount?: number;
  unsyncedLocalCount?: number;
  isOnline?: boolean;
  isSyncing?: boolean;
  onSyncNow?: () => void;
  onPushLocalToCloud?: () => void;
  onOpenSyncQueue?: () => void;
  onToggleAccepting: (accepting: boolean) => void;
  onDeleteResponse: (response: FormResponseRecord) => void;
  onClearLocalResponses: () => void;
}

export function FormResponsesView({
  form,
  responses,
  language,
  pendingSyncCount = 0,
  unsyncedLocalCount = 0,
  isOnline = true,
  isSyncing = false,
  onSyncNow,
  onPushLocalToCloud,
  onOpenSyncQueue,
  onToggleAccepting,
  onDeleteResponse,
  onClearLocalResponses,
}: FormResponsesViewProps) {
  const km = language === 'km';
  const theme = FORM_THEMES[form.themeId] || FORM_THEMES.purple;
  const [subTab, setSubTab] = useState<'summary' | 'individual'>('summary');
  const [individualIdx, setIndividualIdx] = useState(0);
  const [exportingKind, setExportingKind] = useState<'excel' | 'word' | null>(null);

  const safeIdx = Math.min(individualIdx, Math.max(0, responses.length - 1));
  const currentResponse = responses[safeIdx];

  const answerableQuestions = useMemo(
    () => form.questions.filter((q) => q.type !== 'section'),
    [form.questions]
  );

  const quizStats = useMemo(() => {
    if (!form.settings.isQuiz || responses.length === 0) return null;
    const scored = responses.filter((r) => r.maxScore > 0);
    if (scored.length === 0) return null;
    const avg =
      scored.reduce((acc, r) => acc + r.score, 0) / scored.length;
    const maxPossible = scored[0].maxScore;
    const highest = Math.max(...scored.map((r) => r.score));
    return {
      avg: Math.round(avg * 10) / 10,
      highest,
      maxPossible,
    };
  }, [form.settings.isQuiz, responses]);

  const handleDownloadCsv = () => {
    const csv = exportFormResponsesToCsv(form, responses);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(form.title || 'form').replace(/[^\w\u1780-\u17FF-]+/g, '_')}_responses.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadOfflineJson = () => {
    const json = exportOfflineFormPackageJson(form, responses);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(form.title || 'form').replace(/[^\w\u1780-\u17FF-]+/g, '_')}_offline_backup.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcel = async () => {
    setExportingKind('excel');
    try {
      await exportFormToExcelXlsx(form, responses, language);
    } finally {
      setExportingKind(null);
    }
  };

  const handleDownloadWord = async () => {
    setExportingKind('word');
    try {
      await exportFormToWordDocx(form, responses, language);
    } finally {
      setExportingKind(null);
    }
  };

  const collectedEmails = useMemo(
    () =>
      responses
        .filter((r) => Boolean(r.respondentEmail && r.respondentEmail.trim()))
        .map((r) => ({
          id: r.id,
          name: r.respondentName,
          email: r.respondentEmail!.trim(),
        })),
    [responses]
  );

  return (
    <div className="max-w-[760px] mx-auto space-y-4">
      {/* Top Responses Summary Card */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {responses.length}{' '}
              {km ? 'ចម្លើយ' : responses.length === 1 ? 'response' : 'responses'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {form.settings.acceptingResponses
                ? km
                  ? 'កំពុងបើកទទួលចម្លើយពីអ្នកចូលរួម'
                  : 'Currently accepting new responses'
                : km
                  ? 'បានផ្អាកការទទួលចម្លើយជាបណ្តោះអាសន្ន'
                  : 'Not accepting responses'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
              <span>{km ? 'ទទួលចម្លើយ' : 'Accepting responses'}</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.settings.acceptingResponses}
                onClick={() => onToggleAccepting(!form.settings.acceptingResponses)}
                className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer ${
                  form.settings.acceptingResponses
                    ? ''
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
                style={
                  form.settings.acceptingResponses
                    ? { backgroundColor: theme.primary }
                    : undefined
                }
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    form.settings.acceptingResponses ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={exportingKind !== null}
              title={km ? 'ទាញទិន្នន័យ Form ទាំងអស់ជាឯកសារ Excel (.xlsx)' : 'Export all form data to Excel (.xlsx)'}
              className="min-h-[36px] px-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 disabled:opacity-60 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>
                {exportingKind === 'excel'
                  ? km
                    ? 'កំពុងបង្កើត...'
                    : 'Exporting...'
                  : km
                    ? 'ទាញជា Excel (.xlsx)'
                    : 'Export Excel (.xlsx)'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadWord}
              disabled={exportingKind !== null}
              title={km ? 'ទាញទិន្នន័យ Form ទាំងអស់ជាឯកសារ Word (.docx)' : 'Export all form data to Word (.docx)'}
              className="min-h-[36px] px-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 disabled:opacity-60 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>
                {exportingKind === 'word'
                  ? km
                    ? 'កំពុងបង្កើត...'
                    : 'Exporting...'
                  : km
                    ? 'ទាញជា Word (.docx)'
                    : 'Export Word (.docx)'}
              </span>
            </button>

            {responses.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadOfflineJson}
                  title={km ? 'រក្សាទុកឯកសារ Offline Backup (.json)' : 'Download Offline Backup (.json)'}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>{km ? 'Offline (.json)' : 'Backup JSON'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Summary vs Individual Sub-Tabs */}
        <div className="px-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setSubTab('summary')}
              className={`py-3 text-sm font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                subTab === 'summary'
                  ? 'text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              style={
                subTab === 'summary' ? { borderColor: theme.primary, color: theme.primary } : undefined
              }
            >
              <BarChart3 className="w-4 h-4" />
              <span>{km ? 'សង្ខេប (Summary)' : 'Summary'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('individual')}
              className={`py-3 text-sm font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                subTab === 'individual'
                  ? 'text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              style={
                subTab === 'individual'
                  ? { borderColor: theme.primary, color: theme.primary }
                  : undefined
              }
            >
              <UserCheck className="w-4 h-4" />
              <span>{km ? 'ម្នាក់ៗ (Individual)' : 'Individual'}</span>
            </button>
          </div>

          {responses.some((r) => r.source !== 'cloud') && (
            <button
              type="button"
              onClick={onClearLocalResponses}
              className="text-xs font-medium text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
            >
              {km ? 'លុបចម្លើយក្នុងម៉ាស៊ីន' : 'Clear local'}
            </button>
          )}
        </div>
      </div>

      {/* Pending Sync Queue Banner (shown when cached submissions await cloud upload) */}
      {(pendingSyncCount > 0 || (form.syncedToCloud && unsyncedLocalCount > 0)) && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5 min-w-0">
            {isSyncing ? (
              <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0 mt-0.5" />
            ) : !isOnline ? (
              <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CloudUpload className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                {pendingSyncCount > 0
                  ? km
                    ? `Pending Sync៖ មាន ${pendingSyncCount} ចម្លើយ Offline កំពុងរង់ចាំបញ្ជូនទៅ Cloud`
                    : `Pending Sync: ${pendingSyncCount} cached offline submission${pendingSyncCount === 1 ? '' : 's'} waiting to upload`
                  : km
                    ? `មានចម្លើយ Offline ក្នុងឧបករណ៍ចំនួន ${unsyncedLocalCount} មិនទាន់បញ្ជូនទៅ Cloud`
                    : `${unsyncedLocalCount} local offline response${unsyncedLocalCount === 1 ? '' : 's'} ready to sync to cloud`}
              </p>
              <p className="mt-0.5 text-xs text-amber-800/85 dark:text-amber-300/80 leading-relaxed">
                {!isOnline
                  ? km
                    ? 'ឧបករណ៍កំពុងអត់អ៊ីនធឺណិត — ប្រព័ន្ធនឹងបញ្ជូនចម្លើយទាំងនេះទៅ Cloud ដោយស្វ័យប្រវត្តិភ្លាមៗពេលភ្ជាប់អ៊ីនធឺណិតវិញ។'
                    : 'You are currently offline — these submissions will automatically push to the cloud as soon as you reconnect.'
                  : km
                    ? 'អ៊ីនធឺណិតបានភ្ជាប់ហើយ — អ្នកអាចបញ្ជូនចម្លើយទាំងនេះទៅ Cloud ឥឡូវ ឬពិនិត្យមើលបញ្ជី Pending Sync។'
                    : 'Internet is connected — sync now or inspect individual items in the Pending Sync queue.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {pendingSyncCount > 0 && onSyncNow && (
              <button
                type="button"
                disabled={!isOnline || isSyncing}
                onClick={onSyncNow}
                className="min-h-[34px] px-3 rounded-lg text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: theme.primary }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncing
                    ? km
                      ? 'កំពុងបញ្ជូន...'
                      : 'Syncing...'
                    : km
                      ? 'បញ្ជូនឥឡូវ (Sync Now)'
                      : 'Sync Now'}
                </span>
              </button>
            )}
            {pendingSyncCount === 0 && unsyncedLocalCount > 0 && onPushLocalToCloud && (
              <button
                type="button"
                disabled={isSyncing}
                onClick={onPushLocalToCloud}
                className="min-h-[34px] px-3 rounded-lg text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: theme.primary }}
              >
                <CloudUpload className="w-3.5 h-3.5" />
                <span>{km ? 'បញ្ជូនទៅ Cloud' : 'Queue & Sync to Cloud'}</span>
              </button>
            )}
            {onOpenSyncQueue && pendingSyncCount > 0 && (
              <button
                type="button"
                onClick={onOpenSyncQueue}
                className="min-h-[34px] px-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-slate-900/60 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-100/70 dark:hover:bg-amber-900/40 cursor-pointer"
              >
                {km ? 'មើលបញ្ជី' : 'View Queue'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {responses.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
          <Inbox className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {km ? 'មិនទាន់មានចម្លើយនៅឡើយទេ' : 'Waiting for responses'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {km
              ? 'ចុចប៊ូតុង Preview (រូបភ្នែក) ដើម្បីសាកល្បងឆ្លើយ Offline ឬចុច Publish ដើម្បីចែករំលែក Link និង QR-Code ដល់អ្នកចូលរួម។'
              : 'Click Preview (Eye icon) to test locally offline, or click Publish to share a live Link & QR-Code with respondents.'}
          </p>
        </div>
      ) : subTab === 'summary' ? (
        <div className="space-y-3.5">
          {collectedEmails.length > 0 && (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white inline-flex items-center gap-2">
                  <Mail className="w-4 h-4" style={{ color: theme.primary }} />
                  <span>{km ? 'អ៊ីមែលអ្នកឆ្លើយ (Who responded)' : 'Collected Emails'}</span>
                </h3>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {collectedEmails.length}
                </span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {collectedEmails.map((entry) => (
                  <div
                    key={entry.id}
                    className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-xs flex items-center justify-between gap-2"
                  >
                    <span className="font-mono text-slate-800 dark:text-slate-100 truncate">
                      {entry.email}
                    </span>
                    {entry.name && (
                      <span className="text-slate-500 dark:text-slate-400 shrink-0">
                        {entry.name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {quizStats && (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {km ? 'ពិន្ទុមធ្យម' : 'Average Score'}
                </p>
                <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {quizStats.avg} / {quizStats.maxPossible}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {km ? 'ពិន្ទុខ្ពស់បំផុត' : 'Highest Score'}
                </p>
                <p className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {quizStats.highest} / {quizStats.maxPossible}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {km ? 'ចំនួនអ្នកប្រឡង' : 'Submissions'}
                </p>
                <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {responses.length}
                </p>
              </div>
            </div>
          )}

          {answerableQuestions.map((q) => {
            const isChoice =
              q.type === 'multiple_choice' ||
              q.type === 'checkboxes' ||
              q.type === 'dropdown' ||
              q.type === 'linear_scale';

            if (isChoice) {
              const counts = new Map<string, number>();
              if (q.type === 'linear_scale') {
                const min = q.scaleMin ?? 1;
                const max = q.scaleMax ?? 5;
                for (let v = min; v <= max; v++) counts.set(String(v), 0);
              } else {
                for (const opt of q.options) counts.set(opt, 0);
              }

              let answeredCount = 0;
              for (const resp of responses) {
                const val = resp.answers[q.id];
                if (Array.isArray(val) && val.length > 0) {
                  answeredCount++;
                  for (const item of val) {
                    counts.set(item, (counts.get(item) || 0) + 1);
                  }
                } else if (typeof val === 'string' && val.trim()) {
                  answeredCount++;
                  counts.set(val, (counts.get(val) || 0) + 1);
                }
              }

              const rows = Array.from(counts.entries());
              return (
                <div
                  key={q.id}
                  className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3"
                >
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white leading-relaxed">
                      <MathText text={q.title} explicitOnly />
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                      {answeredCount} {km ? 'ចម្លើយ' : 'responses'}
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {rows.map(([label, count]) => {
                      const pct =
                        answeredCount > 0
                          ? Math.round((count / answeredCount) * 100)
                          : 0;
                      return (
                        <div key={label} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-slate-800 dark:text-slate-200 break-words">
                              <MathText text={label} explicitOnly />
                            </span>
                            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400 shrink-0">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: theme.primary,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // Open text / date / time
            const textItems = responses
              .map((r) => ({
                id: r.id,
                who: r.respondentName,
                val:
                  typeof r.answers[q.id] === 'string'
                    ? (r.answers[q.id] as string)
                    : '',
              }))
              .filter((x) => x.val.trim().length > 0);

            return (
              <div
                key={q.id}
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3"
              >
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white leading-relaxed">
                    <MathText text={q.title} explicitOnly />
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                    {textItems.length} {km ? 'ចម្លើយ' : 'responses'}
                  </p>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {textItems.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      {km ? 'មិនមានចម្លើយ' : 'No answers yet'}
                    </p>
                  ) : (
                    textItems.map((item) => (
                      <div
                        key={item.id}
                        className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-800 dark:text-slate-200 flex items-start justify-between gap-3"
                      >
                        <span className="whitespace-pre-wrap overflow-x-auto">
                          <MathText text={item.val} explicitOnly />
                        </span>
                        {item.who && (
                          <span className="text-[11px] text-slate-400 shrink-0">
                            {item.who}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Individual Response Stepper */
        <div className="space-y-3.5">
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safeIdx <= 0}
                onClick={() => setIndividualIdx((i) => Math.max(0, i - 1))}
                className="min-h-[34px] min-w-[34px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-35 cursor-pointer"
                aria-label="Previous response"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {safeIdx + 1} / {responses.length}
              </span>
              <button
                type="button"
                disabled={safeIdx >= responses.length - 1}
                onClick={() =>
                  setIndividualIdx((i) => Math.min(responses.length - 1, i + 1))
                }
                className="min-h-[34px] min-w-[34px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-35 cursor-pointer"
                aria-label="Next response"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {currentResponse && (
              <div className="flex flex-wrap items-center justify-end gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {currentResponse.respondentName || 'Anonymous'}
                    </p>
                    {currentResponse.syncStatus === 'pending' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-semibold">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{km ? 'Pending Sync' : 'Pending Sync'}</span>
                      </span>
                    ) : currentResponse.source === 'cloud' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                        <Cloud className="w-2.5 h-2.5" />
                        <span>Cloud</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                        <WifiOff className="w-2.5 h-2.5" />
                        <span>Offline</span>
                      </span>
                    )}
                  </div>
                  {currentResponse.respondentEmail && (
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {currentResponse.respondentEmail}
                    </p>
                  )}
                </div>
                {form.settings.isQuiz && currentResponse.maxScore > 0 && (
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {currentResponse.score}/{currentResponse.maxScore}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteResponse(currentResponse)}
                  title={km ? 'លុបចម្លើយនេះ' : 'Delete response'}
                  className="min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {currentResponse &&
            answerableQuestions.map((q) => {
              const raw = currentResponse.answers[q.id];
              const display = Array.isArray(raw)
                ? raw.join(', ')
                : typeof raw === 'string'
                  ? raw
                  : '';
              return (
                <div
                  key={q.id}
                  className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                    <MathText text={q.title} explicitOnly />
                  </p>
                  <div className="mt-2 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap overflow-x-auto">
                    {display ? (
                      <MathText text={display} explicitOnly />
                    ) : (
                      <span className="text-slate-400 italic">
                        {km ? '(មិនបានឆ្លើយ)' : '(No answer)'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
