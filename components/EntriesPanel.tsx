'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { getSegmentColors, type PaletteId } from '@/lib/palettes';
import { COPY, type Language } from '@/lib/i18n';
import { QUICK_START_ENTRIES } from '@/lib/templates';

interface EntriesPanelProps {
  entries: string[];
  paletteId: PaletteId;
  language: Language;
  hoveredSliceIndex: number | null;
  onHoverSlice: (idx: number | null) => void;
  onChangeEntries: (nextEntries: string[]) => void;
  onQuickGroupSplit?: () => void;
}

export function EntriesPanel({
  entries,
  paletteId,
  language,
  hoveredSliceIndex,
  onHoverSlice,
  onChangeEntries,
  onQuickGroupSplit,
}: EntriesPanelProps) {
  const t = COPY[language];
  const [mode, setMode] = useState<'list' | 'bulk'>('list');
  const [newEntry, setNewEntry] = useState('');

  const colors = getSegmentColors(entries.length, paletteId);

  const handleAddEntry = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = newEntry
      .split(/\r?\n|\t/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (cleaned.length === 0) return;
    onChangeEntries([...entries, ...cleaned].slice(0, 200));
    setNewEntry('');
  };

  const handleBulkChange = (text: string) => {
    // Preserve direct Excel/Word copy-paste lines, split by newline or tab
    const parsed = text
      .split(/\r?\n|\t/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 200);
    onChangeEntries(parsed);
  };

  const handleShuffle = () => {
    const copy = [...entries];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    onChangeEntries(copy);
  };

  const handleSort = () => {
    const copy = [...entries].sort((a, b) => a.localeCompare(b, language));
    onChangeEntries(copy);
  };

  const handleClear = () => {
    onChangeEntries([]);
  };

  const handleRestoreSample = () => {
    onChangeEntries([...QUICK_START_ENTRIES]);
  };

  const handleUpdateItem = (index: number, value: string) => {
    const next = [...entries];
    next[index] = value;
    onChangeEntries(next);
  };

  const handleRemoveItem = (index: number) => {
    onChangeEntries(entries.filter((_, idx) => idx !== index));
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Panel Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
            {t.listTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap shrink-0">
            {t.entriesCount(entries.length)}
          </p>
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
            onClick={() => setMode('bulk')}
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

        {/* Action Toolbar: Shuffle, Sort, Clear, Quick Group Split */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleShuffle}
            disabled={entries.length < 2}
            className="flex-1 min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Shuffle className="w-3.5 h-3.5 shrink-0" />
            <span>{t.shuffle}</span>
          </button>
          <button
            type="button"
            onClick={handleSort}
            disabled={entries.length < 2}
            className="flex-1 min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <ArrowDownAZ className="w-3.5 h-3.5 shrink-0" />
            <span>{t.sort}</span>
          </button>
          {onQuickGroupSplit && (
            <button
              type="button"
              onClick={onQuickGroupSplit}
              disabled={entries.length < 2}
              className="flex-1 min-h-[38px] px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/70 text-xs font-semibold text-[#3B82F6] dark:text-blue-400 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>{t.quickGroupsToggle}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleClear}
            disabled={entries.length === 0}
            aria-label={t.clear}
            title={t.clear}
            className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center justify-center gap-1 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
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
                    .map((s) => s.trim())
                    .filter(Boolean);
                  if (parsed.length > 0) {
                    onChangeEntries([...entries, ...parsed].slice(0, 200));
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
                <button
                  type="button"
                  onClick={handleRestoreSample}
                  className="mt-4 min-h-[40px] px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t.restoreSample}</span>
                </button>
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
            value={entries.join('\n')}
            onChange={(e) => handleBulkChange(e.target.value)}
            placeholder={t.bulkPlaceholder}
            className="flex-1 w-full min-h-[220px] p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
