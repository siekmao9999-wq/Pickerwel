'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Shuffle,
  Crown,
  Copy,
  Check,
  Maximize2,
  X,
  Disc3,
  ClipboardList,
} from 'lucide-react';
import { WHEEL_PALETTES, type PaletteId } from '@/lib/palettes';
import { playTickSound, playWinSound, triggerHaptic } from '@/lib/sound';
import { COPY, type Language } from '@/lib/i18n';

interface QuickGroup {
  id: string;
  name: string;
  color: string;
  task?: string;
  members: { id: string; name: string; isLeader: boolean }[];
}

interface QuickGroupSplitPanelProps {
  entries: string[];
  paletteId: PaletteId;
  language: Language;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  onSpinTeamsOnWheel: (teamNames: string[]) => void;
  onOpenFull: () => void;
  onClose: () => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildGroups(params: {
  entries: string[];
  splitMode: 'count' | 'size';
  groupCount: number;
  groupSize: number;
  autoLeader: boolean;
  tasksText: string;
  colors: string[];
  language: Language;
}): QuickGroup[] {
  const clean = params.entries.map((e) => e.trim()).filter(Boolean);
  if (clean.length === 0) return [];

  const shuffled = shuffleArray(clean);
  const actualCount =
    params.splitMode === 'count'
      ? Math.max(1, Math.min(12, params.groupCount, shuffled.length))
      : Math.max(1, Math.ceil(shuffled.length / Math.max(1, params.groupSize)));

  const buckets: string[][] = Array.from({ length: actualCount }, () => []);
  shuffled.forEach((student, idx) => {
    buckets[idx % actualCount].push(student);
  });

  const tasks = shuffleArray(
    params.tasksText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
  );

  return buckets.map((bucket, gIdx) => {
    const leaderIdx =
      params.autoLeader && bucket.length > 0
        ? Math.floor(Math.random() * bucket.length)
        : -1;
    return {
      id: `qg_${Date.now()}_${gIdx}`,
      name:
        params.language === 'km' ? `ក្រុមទី ${gIdx + 1}` : `Group ${gIdx + 1}`,
      color: params.colors[gIdx % params.colors.length],
      task: tasks.length > 0 ? tasks[gIdx % tasks.length] : undefined,
      members: bucket.map((name, mIdx) => ({
        id: `qgm_${Date.now()}_${gIdx}_${mIdx}`,
        name,
        isLeader: mIdx === leaderIdx,
      })),
    };
  });
}

export function QuickGroupSplitPanel({
  entries,
  paletteId,
  language,
  soundEnabled,
  hapticsEnabled,
  onSpinTeamsOnWheel,
  onOpenFull,
  onClose,
}: QuickGroupSplitPanelProps) {
  const t = COPY[language];
  const paletteColors =
    WHEEL_PALETTES[paletteId]?.colors || WHEEL_PALETTES.vibrant.colors;

  const [splitMode, setSplitMode] = useState<'count' | 'size'>('count');
  const [groupCount, setGroupCount] = useState(3);
  const [groupSize, setGroupSize] = useState(3);
  const [autoLeader, setAutoLeader] = useState(true);
  const [showTasksInput, setShowTasksInput] = useState(false);
  const [tasksText, setTasksText] = useState('');
  const [copied, setCopied] = useState(false);

  const [groups, setGroups] = useState<QuickGroup[]>(() =>
    buildGroups({
      entries,
      splitMode: 'count',
      groupCount: 3,
      groupSize: 3,
      autoLeader: true,
      tasksText: '',
      colors: paletteColors,
      language,
    })
  );

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleSplitNow = (overrides?: {
    mode?: 'count' | 'size';
    count?: number;
    size?: number;
    leader?: boolean;
  }) => {
    const nextMode = overrides?.mode ?? splitMode;
    const nextCount = overrides?.count ?? groupCount;
    const nextSize = overrides?.size ?? groupSize;
    const nextLeader = overrides?.leader ?? autoLeader;

    const nextGroups = buildGroups({
      entries,
      splitMode: nextMode,
      groupCount: nextCount,
      groupSize: nextSize,
      autoLeader: nextLeader,
      tasksText,
      colors: paletteColors,
      language,
    });
    setGroups(nextGroups);
    if (soundEnabled) playWinSound();
    if (hapticsEnabled) triggerHaptic([20, 15, 30]);
  };

  const handleToggleLeader = (groupId: string, memberId: string) => {
    if (soundEnabled) playTickSound(0.2);
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          members: g.members.map((m) => ({
            ...m,
            isLeader: m.id === memberId ? !m.isLeader : false,
          })),
        };
      })
    );
  };

  const handleMoveMember = (
    fromGroupId: string,
    memberId: string,
    toGroupId: string
  ) => {
    if (fromGroupId === toGroupId) return;
    setGroups((prev) => {
      const src = prev.find((g) => g.id === fromGroupId);
      const member = src?.members.find((m) => m.id === memberId);
      if (!member) return prev;
      return prev.map((g) => {
        if (g.id === fromGroupId) {
          return { ...g, members: g.members.filter((m) => m.id !== memberId) };
        }
        if (g.id === toGroupId) {
          return {
            ...g,
            members: [...g.members, { ...member, isLeader: false }],
          };
        }
        return g;
      });
    });
  };

  const handleCopy = async () => {
    if (groups.length === 0) return;
    const text = groups
      .map((g) => {
        const header = g.task ? `${g.name} — ${g.task}` : g.name;
        const members = g.members
          .map((m) => `  - ${m.name}${m.isLeader ? ` (${t.groupsLeaderTag})` : ''}`)
          .join('\n');
        return `${header}\n${members}`;
      })
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="w-full max-w-2xl p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-4 h-4 text-[#3B82F6] shrink-0" />
          <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
            {t.quickGroupsTitle}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
            · {entries.length} {t.quickGroupsStudentsLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenFull}
            className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.quickGroupsFullBtn}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="min-h-[34px] min-w-[34px] rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {entries.length < 2 ? (
        <p className="py-4 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          {t.quickGroupsNeedStudents}
        </p>
      ) : (
        <>
          {/* Quick Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setSplitMode('count');
                    handleSplitNow({ mode: 'count' });
                  }}
                  className={`min-h-[32px] px-2.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    splitMode === 'count'
                      ? 'bg-white dark:bg-slate-700 text-[#3B82F6] dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.groupsSplitByCount}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSplitMode('size');
                    handleSplitNow({ mode: 'size' });
                  }}
                  className={`min-h-[32px] px-2.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    splitMode === 'size'
                      ? 'bg-white dark:bg-slate-700 text-[#3B82F6] dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.groupsSplitBySize}
                </button>
              </div>

              <div className="flex items-center gap-1">
                {[2, 3, 4, 5, 6].map((n) => {
                  const selected =
                    splitMode === 'count' ? groupCount === n : groupSize === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        if (splitMode === 'count') {
                          setGroupCount(n);
                          handleSplitNow({ mode: 'count', count: n });
                        } else {
                          setGroupSize(n);
                          handleSplitNow({ mode: 'size', size: n });
                        }
                      }}
                      className={`min-h-[32px] min-w-[32px] rounded-lg text-xs font-mono font-bold tabular-nums cursor-pointer ${
                        selected
                          ? 'bg-[#3B82F6] text-white'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400'
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !autoLeader;
                  setAutoLeader(next);
                  handleSplitNow({ leader: next });
                }}
                className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  autoLeader
                    ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>{t.groupsLeaderTag}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTasksInput((v) => !v)}
                className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  showTasksInput || tasksText.trim().length > 0
                    ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>{t.groupsAssignedTaskLabel}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSplitNow()}
                className="min-h-[34px] px-3.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>{t.quickGroupsSplitBtn}</span>
              </button>
            </div>
          </div>

          {showTasksInput && (
            <textarea
              rows={2}
              value={tasksText}
              onChange={(e) => setTasksText(e.target.value)}
              placeholder={t.quickGroupsTaskPlaceholder}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          )}

          {/* Resulting Group Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map((grp) => (
              <div
                key={grp.id}
                className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: grp.color }}
                      aria-hidden="true"
                    />
                    <span className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                      {grp.name}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
                    {grp.members.length}
                  </span>
                </div>

                {grp.task && (
                  <p className="text-xs font-medium text-[#3B82F6] dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/30 px-2.5 py-1.5 rounded-lg">
                    {grp.task}
                  </p>
                )}

                <ul className="space-y-1">
                  {grp.members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-1.5 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleLeader(grp.id, m.id)}
                        className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer"
                        title={t.groupsLeaderTag}
                      >
                        <Crown
                          className={`w-3.5 h-3.5 shrink-0 ${
                            m.isLeader
                              ? 'text-amber-500 fill-amber-400/30'
                              : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                          }`}
                        />
                        <span
                          className={`truncate ${
                            m.isLeader
                              ? 'font-bold text-slate-900 dark:text-white'
                              : 'font-medium text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {m.name}
                        </span>
                      </button>

                      {groups.length > 1 && (
                        <select
                          value={grp.id}
                          onChange={(e) =>
                            handleMoveMember(grp.id, m.id, e.target.value)
                          }
                          aria-label={`${t.groupsMoveToLabel} ${m.name}`}
                          className="max-w-[76px] px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] text-slate-500 dark:text-slate-300 cursor-pointer"
                        >
                          {groups.map((targetG) => (
                            <option key={targetG.id} value={targetG.id}>
                              {targetG.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Footer Quick Actions */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t.groupsCopiedMsg}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t.groupsCopyBtn}</span>
                </>
              )}
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {groups.length >= 2 && (
                <button
                  type="button"
                  onClick={() => onSpinTeamsOnWheel(groups.map((g) => g.name))}
                  className="min-h-[36px] px-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Disc3 className="w-3.5 h-3.5" />
                  <span>{t.groupsSpinTeamsBtn}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenFull}
                className="min-h-[36px] px-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 text-xs font-semibold text-[#3B82F6] dark:text-blue-400 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{t.quickGroupsFullBtn}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
