'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shuffle,
  ArrowDownAZ,
  Trash2,
  Plus,
  X,
  RotateCcw,
  ClipboardPaste,
  List,
  Users,
  ImageDown,
  Check,
  FileSpreadsheet,
  Upload,
  FileUp,
  AlertCircle,
  ScanLine,
} from 'lucide-react';
import { getSegmentColors, type PaletteId } from '@/lib/palettes';
import { exportWheelSnapshotPng } from '@/lib/wheel-snapshot';
import {
  exportEntriesToCsv,
  parseUserEntriesInput,
  MAX_WHEEL_ENTRIES,
  type EntryImportDelimiter,
} from '@/lib/entries-io';
import { COPY, type Language } from '@/lib/i18n';
import { QUICK_START_ENTRIES } from '@/lib/templates';

interface EntriesPanelProps {
  entries: string[];
  paletteId: PaletteId;
  language: Language;
  wheelTitle?: string;
  theme?: 'light' | 'dark';
  soundEnabled?: boolean;
  hapticsEnabled?: boolean;
  hoveredSliceIndex: number | null;
  onHoverSlice: (idx: number | null) => void;
  onChangeEntries: (nextEntries: string[]) => void;
  onQuickGroupSplit?: () => void;
}

export function EntriesPanel({
  entries,
  paletteId,
  language,
  wheelTitle,
  theme = 'light',
  hoveredSliceIndex,
  onHoverSlice,
  onChangeEntries,
  onQuickGroupSplit,
}: EntriesPanelProps) {
  const t = COPY[language];
  const router = useRouter();
  const [mode, setMode] = useState<'list' | 'bulk'>('list');
  const [bulkDraft, setBulkDraft] = useState(() => entries.join('\n'));
  const [newEntry, setNewEntry] = useState('');
  const [exportingPng, setExportingPng] = useState(false);
  const [pngSaved, setPngSaved] = useState(false);
  const [csvSaved, setCsvSaved] = useState(false);
  const [importedCountNotice, setImportedCountNotice] = useState<number | null>(
    null
  );

  // Import CSV / List Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importDraft, setImportDraft] = useState('');
  const [importDelimiter, setImportDelimiter] =
    useState<EntryImportDelimiter>('auto');
  const [importApplyMode, setImportApplyMode] = useState<'replace' | 'append'>(
    'replace'
  );
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pngSaved) return;
    const timer = window.setTimeout(() => setPngSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [pngSaved]);

  useEffect(() => {
    if (!csvSaved) return;
    const timer = window.setTimeout(() => setCsvSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [csvSaved]);

  useEffect(() => {
    if (importedCountNotice === null) return;
    const timer = window.setTimeout(() => setImportedCountNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [importedCountNotice]);

  useEffect(() => {
    if (!importModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setImportModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [importModalOpen]);

  const parsedImport = useMemo(
    () => parseUserEntriesInput(importDraft, importDelimiter),
    [importDraft, importDelimiter]
  );

  const resultingImportEntries = useMemo(() => {
    if (importApplyMode === 'append') {
      return [...entries, ...parsedImport.entries].slice(0, MAX_WHEEL_ENTRIES);
    }
    return parsedImport.entries.slice(0, MAX_WHEEL_ENTRIES);
  }, [entries, parsedImport.entries, importApplyMode]);

  const appendTruncated =
    importApplyMode === 'append' &&
    entries.length + parsedImport.entries.length > MAX_WHEEL_ENTRIES;

  const colors = getSegmentColors(entries.length, paletteId);

  const handleAddEntry = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = newEntry
      .split(/\r?\n|\t/)
      .map((s) => s.trim().slice(0, 120))
      .filter(Boolean);
    if (cleaned.length === 0) return;
    const next = [...entries, ...cleaned].slice(0, MAX_WHEEL_ENTRIES);
    onChangeEntries(next);
    setBulkDraft(next.join('\n'));
    setNewEntry('');
  };

  const handleBulkChange = (text: string) => {
    setBulkDraft(text);
    // Preserve direct Excel/Word copy-paste lines, split by newline or tab
    const parsed = text
      .split(/\r?\n|\t/)
      .map((line) => line.trim().slice(0, 120))
      .filter((line) => line.length > 0)
      .slice(0, MAX_WHEEL_ENTRIES);
    onChangeEntries(parsed);
  };

  const handleShuffle = () => {
    const copy = [...entries];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    onChangeEntries(copy);
    if (mode === 'bulk') setBulkDraft(copy.join('\n'));
  };

  const handleSort = () => {
    const copy = [...entries].sort((a, b) => a.localeCompare(b, language));
    onChangeEntries(copy);
    if (mode === 'bulk') setBulkDraft(copy.join('\n'));
  };

  const handleClear = () => {
    onChangeEntries([]);
    setBulkDraft('');
  };

  const handleRestoreSample = () => {
    const next = [...QUICK_START_ENTRIES];
    onChangeEntries(next);
    setBulkDraft(next.join('\n'));
  };

  const handleUpdateItem = (index: number, value: string) => {
    const next = [...entries];
    next[index] = value;
    onChangeEntries(next);
  };

  const handleRemoveItem = (index: number) => {
    const next = entries.filter((_, idx) => idx !== index);
    onChangeEntries(next);
  };

  const handleDownloadPng = async () => {
    if (entries.length === 0 || exportingPng) return;
    setExportingPng(true);
    try {
      await exportWheelSnapshotPng({
        title: wheelTitle || t.listTitle,
        entries,
        paletteId,
        language,
        theme,
      });
      setPngSaved(true);
    } finally {
      setExportingPng(false);
    }
  };

  const handleExportCsv = () => {
    if (entries.length === 0) return;
    exportEntriesToCsv(entries, wheelTitle || t.listTitle);
    setCsvSaved(true);
  };

  const openImportModal = () => {
    setImportError(null);
    setImportFileName(null);
    setImportDraft('');
    setImportDelimiter('auto');
    setImportApplyMode(entries.length > 0 ? 'replace' : 'append');
    setImportModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const lower = file.name.toLowerCase();
    try {
      if (
        lower.endsWith('.pdf') ||
        lower.endsWith('.xlsx') ||
        lower.endsWith('.xls') ||
        lower.endsWith('.ods') ||
        lower.endsWith('.docx')
      ) {
        setImportModalOpen(false);
        router.push('/scan?tab=document');
        return;
      }

      const text = await file.text();
      setImportFileName(file.name);
      setImportDraft(text);
      setImportError(null);
      if (lower.endsWith('.csv')) {
        setImportDelimiter('csv');
      } else {
        setImportDelimiter('auto');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'LEGACY_DOC_UNSUPPORTED') {
        setImportError(t.scanDocLegacyDocError);
      } else {
        setImportError(t.importFileError);
      }
    }
  };

  const handleConfirmImport = () => {
    if (parsedImport.entries.length === 0) {
      setImportError(t.importEmptyError);
      return;
    }
    onChangeEntries(resultingImportEntries);
    setBulkDraft(resultingImportEntries.join('\n'));
    setImportedCountNotice(parsedImport.entries.length);
    setImportModalOpen(false);
  };

  const delimiterOptions: { id: EntryImportDelimiter; label: string }[] = [
    { id: 'auto', label: t.importFormatAuto },
    { id: 'newline', label: t.importFormatNewline },
    { id: 'comma', label: t.importFormatComma },
    { id: 'semicolon', label: t.importFormatSemicolon },
    { id: 'csv', label: t.importFormatCsv },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Panel Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
            {t.listTitle}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {importedCountNotice !== null && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 whitespace-nowrap">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{t.importDoneMsg(importedCountNotice)}</span>
              </span>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
              {t.entriesCount(entries.length)}
            </p>
          </div>
        </div>

        {/* Segmented Mode Switch: List vs Bulk Paste */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setMode('list')}
            className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'list'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5 shrink-0" />
            <span>{t.listTab}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setBulkDraft(entries.join('\n'));
              setMode('bulk');
            }}
            className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'bulk'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
            <span>{t.bulkTab}</span>
          </button>
        </div>

        {/* Action Toolbar: Shuffle, Sort, Groups, Export PNG, Export CSV, Import, Clear */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleShuffle}
            disabled={entries.length < 2}
            className="flex-1 min-h-[36px] px-2 xl:px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Shuffle className="w-3.5 h-3.5 shrink-0" />
            <span>{t.shuffle}</span>
          </button>
          <button
            type="button"
            onClick={handleSort}
            disabled={entries.length < 2}
            className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <ArrowDownAZ className="w-3.5 h-3.5 shrink-0" />
            <span>{t.sort}</span>
          </button>
          {onQuickGroupSplit && (
            <button
              type="button"
              onClick={onQuickGroupSplit}
              disabled={entries.length < 2}
              className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/70 text-xs font-semibold text-[#3B82F6] dark:text-blue-400 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>{t.quickGroupsToggle}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={entries.length === 0 || exportingPng}
            aria-label={t.downloadPngTitle}
            title={t.downloadPngTitle}
            className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            {pngSaved ? (
              <>
                <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">
                  {t.downloadPngDone}
                </span>
              </>
            ) : (
              <>
                <ImageDown className="w-3.5 h-3.5 shrink-0" />
                <span>{t.downloadPngBtn}</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={entries.length === 0}
            aria-label={t.exportCsvTitle}
            title={t.exportCsvTitle}
            className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            {csvSaved ? (
              <>
                <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">
                  {t.exportCsvDone}
                </span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span>{t.exportCsvBtn}</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={openImportModal}
            aria-label={t.importListTitle}
            title={t.importListTitle}
            className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 shrink-0" />
            <span>{t.importListBtn}</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/scan')}
            aria-label={t.scanNamesTitle}
            title={t.scanNamesTitle}
            className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ScanLine className="w-3.5 h-3.5 shrink-0" />
            <span>{t.scanNamesBtn}</span>
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={entries.length === 0}
            aria-label={t.clear}
            title={t.clear}
            className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center justify-center gap-1 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xl:inline">{t.clear}</span>
          </button>
        </div>
      </div>

      {/* Body: List or Bulk Paste */}
      {mode === 'list' ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Quick Add Bar */}
          <form
            onSubmit={handleAddEntry}
            className="p-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-2"
          >
            <input
              type="text"
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                if (pasted.includes('\n') || pasted.includes('\t')) {
                  e.preventDefault();
                  const parsed = pasted
                    .split(/\r?\n|\t/)
                    .map((s) => s.trim().slice(0, 120))
                    .filter(Boolean);
                  if (parsed.length > 0) {
                    const next = [...entries, ...parsed].slice(
                      0,
                      MAX_WHEEL_ENTRIES
                    );
                    onChangeEntries(next);
                    setBulkDraft(next.join('\n'));
                  }
                }
              }}
              placeholder={t.addEntryPlaceholder}
              maxLength={120}
              className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!newEntry.trim()}
              aria-label={t.addBtn}
              className="min-h-[40px] px-3.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addBtn}</span>
            </button>
          </form>

          {/* Items Scrollable List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {entries.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {t.emptyWheelTitle}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t.emptyWheelDesc}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleRestoreSample}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.restoreSample}</span>
                  </button>
                  <button
                    type="button"
                    onClick={openImportModal}
                    className="min-h-[40px] px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/70 text-xs font-medium text-[#3B82F6] dark:text-blue-400 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{t.importListBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/scan')}
                    className="min-h-[40px] px-4 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 text-xs font-medium text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    <span>{t.scanNamesBtn}</span>
                  </button>
                </div>
              </div>
            ) : (
              entries.map((item, idx) => {
                const isHighlighted = hoveredSliceIndex === idx;
                return (
                  <div
                    key={idx}
                    onMouseEnter={() => onHoverSlice(idx)}
                    onMouseLeave={() => onHoverSlice(null)}
                    className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
                      isHighlighted
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: colors[idx] || '#3B82F6' }}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500 w-5 text-right shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={item}
                      maxLength={120}
                      onChange={(e) => handleUpdateItem(idx, e.target.value)}
                      onBlur={(e) => {
                        if (!e.target.value.trim()) handleRemoveItem(idx);
                      }}
                      aria-label={`Entry ${idx + 1}`}
                      className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 dark:text-slate-100 focus:outline-none py-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      aria-label={`Remove ${item}`}
                      className="min-h-[36px] min-w-[36px] rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-70 group-hover:opacity-100 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-3 gap-2 min-h-0">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t.bulkHelp}
          </p>
          <textarea
            value={bulkDraft}
            onChange={(e) => handleBulkChange(e.target.value)}
            placeholder={t.bulkPlaceholder}
            className="flex-1 w-full min-h-[220px] p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Import CSV / List Modal */}
      {importModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-entries-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/55 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportModalOpen(false);
          }}
        >
          <div className="w-full max-w-xl max-h-[90dvh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3
                  id="import-entries-modal-title"
                  className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"
                >
                  <Upload className="w-4 h-4 text-[#3B82F6] shrink-0" />
                  <span className="truncate">{t.importModalTitle}</span>
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t.importModalDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                aria-label={t.close}
                className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* File Picker Row */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.pdf,.xlsx,.xls,.ods,.docx,text/csv,text/plain,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/70 text-xs font-semibold text-[#3B82F6] dark:text-blue-400 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FileUp className="w-4 h-4 shrink-0" />
                  <span>{t.importUploadFileBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportModalOpen(false);
                    router.push('/scan?tab=document');
                  }}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 text-xs font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ScanLine className="w-4 h-4 shrink-0" />
                  <span>{t.scanNamesBtn}</span>
                </button>
                {importFileName && (
                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[260px]">
                    <span className="font-medium text-slate-400 dark:text-slate-500 mr-1">
                      {t.importLoadedFileLabel}
                    </span>
                    <span className="font-mono">{importFileName}</span>
                  </span>
                )}
              </div>

              {/* Paste / Edit Textarea */}
              <div className="space-y-1.5">
                <label
                  htmlFor="import-list-textarea"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {t.importPasteLabel}
                </label>
                <textarea
                  id="import-list-textarea"
                  value={importDraft}
                  onChange={(e) => {
                    setImportDraft(e.target.value);
                    if (importError) setImportError(null);
                  }}
                  placeholder={t.importPastePlaceholder}
                  rows={6}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Delimiter Format + Import Mode Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.importFormatLabel}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {delimiterOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setImportDelimiter(opt.id)}
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                          importDelimiter === opt.id
                            ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.importModeLabel}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setImportApplyMode('replace')}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                        importApplyMode === 'replace'
                          ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {t.importModeReplace}
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportApplyMode('append')}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                        importApplyMode === 'append'
                          ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {t.importModeAppend}
                    </button>
                  </div>
                </div>
              </div>

              {/* Error Banner */}
              {importError && (
                <div className="px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Live Parsed Preview */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                    {t.importPreviewCount(parsedImport.entries.length)}
                  </span>
                  {parsedImport.entries.length > 0 && (
                    <span className="text-[11px] font-mono uppercase text-slate-400 dark:text-slate-500">
                      {parsedImport.detectedFormat}
                    </span>
                  )}
                </div>

                {(parsedImport.truncatedCount > 0 || appendTruncated) && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    {t.importTruncatedWarn(MAX_WHEEL_ENTRIES)}
                  </p>
                )}

                {parsedImport.entries.length > 0 && (
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-700/60">
                    {parsedImport.entries.slice(0, 40).map((item, idx) => (
                      <div
                        key={`${idx}-${item}`}
                        className="py-1 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200"
                      >
                        <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500 w-6 text-right shrink-0">
                          {idx + 1}.
                        </span>
                        <span className="truncate">{item}</span>
                      </div>
                    ))}
                    {parsedImport.entries.length > 40 && (
                      <div className="pt-1.5 text-center text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                        +{parsedImport.entries.length - 40}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={parsedImport.entries.length === 0}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>{t.importApplyBtn(parsedImport.entries.length)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

