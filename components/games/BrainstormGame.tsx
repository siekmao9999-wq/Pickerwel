'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lightbulb,
  Play,
  Pause,
  RotateCcw,
  Plus,
  ThumbsUp,
  Trash2,
  Copy,
  Check,
  Download,
  Disc3,
  Users,
  Shuffle,
  Award,
  ArrowRight,
  Zap,
  Clock,
  X,
  Trophy,
} from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import {
  BOARD_STYLE_COLUMNS,
  BRAINSTORM_COLORS,
  BRAINSTORM_SPARKS,
  STARTER_BRAINSTORM_TOPICS,
  createDefaultTeams,
  formatBrainstormCsv,
  formatBrainstormSummary,
  loadBrainstormState,
  saveBrainstormState,
  type BrainstormBoardStyle,
  type BrainstormIdea,
  type BrainstormSpark,
  type BrainstormTeam,
} from '@/lib/offline-brainstorm';
import {
  playCorrectSound,
  playTickSound,
  playWinSound,
  playWrongSound,
  triggerHaptic,
} from '@/lib/sound';
import { COPY } from '@/lib/i18n';

type BrainstormStage = 'LOBBY' | 'PLAYING' | 'SUMMARY';
type BrainstormPlayMode = 'sprint' | 'board';
type IdeaSortOrder = 'newest' | 'votes';

function formatSeconds(total: number): string {
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function BrainstormGame() {
  const { settings, activeWheel, createNewWheel, setActiveNav } = usePickerwel();
  const t = COPY[settings.language];
  const isKm = settings.language === 'km';

  const [stage, setStage] = useState<BrainstormStage>('LOBBY');
  const [playMode, setPlayMode] = useState<BrainstormPlayMode>('sprint');
  const [topic, setTopic] = useState<string>(() =>
    isKm ? STARTER_BRAINSTORM_TOPICS[0].promptKm : STARTER_BRAINSTORM_TOPICS[0].promptEn
  );
  const [boardStyle, setBoardStyle] = useState<BrainstormBoardStyle>('classic');
  const [durationSec, setDurationSec] = useState<number>(60);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  const [teams, setTeams] = useState<BrainstormTeam[]>(() =>
    createDefaultTeams(settings.language)
  );
  const [activeTeamId, setActiveTeamId] = useState<string>('team_1');
  const [newTeamName, setNewTeamName] = useState('');

  const [ideas, setIdeas] = useState<BrainstormIdea[]>([]);
  const [draftIdea, setDraftIdea] = useState('');
  const [targetColId, setTargetColId] = useState<string>('ideas');
  const [sortOrder, setSortOrder] = useState<IdeaSortOrder>('newest');
  const [activeSpark, setActiveSpark] = useState<BrainstormSpark | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const lastIdeaAtRef = useRef<number>(0);

  // Hydrate persisted board safely after mount
  useEffect(() => {
    queueMicrotask(() => {
      const stored = loadBrainstormState(settings.language);
      setTopic(stored.topic);
      setBoardStyle(stored.boardStyle);
      setIdeas(stored.ideas);
      setTeams(stored.teams);
      setActiveTeamId(stored.teams[0]?.id || 'team_1');
      const cols = BOARD_STYLE_COLUMNS[stored.boardStyle];
      if (cols.length > 0) setTargetColId(cols[0].id);
      setHydrated(true);
    });
  }, [settings.language]);

  // Persist changes to localStorage
  useEffect(() => {
    if (!hydrated) return;
    saveBrainstormState({ topic, boardStyle, ideas, teams });
  }, [topic, boardStyle, ideas, teams, hydrated]);

  // Keep valid target column when boardStyle changes
  const columns = BOARD_STYLE_COLUMNS[boardStyle];
  const resolvedTargetColId = columns.some((c) => c.id === targetColId)
    ? targetColId
    : columns[0].id;

  const activeTeam =
    teams.find((tm) => tm.id === activeTeamId) || teams[0] || {
      id: 'team_1',
      name: isKm ? 'ក្រុមទី ១' : 'Team 1',
      color: BRAINSTORM_COLORS[0],
      score: 0,
    };

  // Sprint countdown timer
  useEffect(() => {
    if (stage !== 'PLAYING' || !timerRunning || durationSec === 0) return;
    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setTimerRunning(false);
          if (settings.soundEnabled) playWinSound();
          if (settings.hapticsEnabled) triggerHaptic([40, 30, 60]);
          setStage('SUMMARY');
          return 0;
        }
        if (prev <= 6 && settings.soundEnabled) {
          playTickSound(0.2);
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [stage, timerRunning, durationSec, settings.soundEnabled, settings.hapticsEnabled]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!feedbackBanner) return;
    const timer = window.setTimeout(() => setFeedbackBanner(null), 2200);
    return () => window.clearTimeout(timer);
  }, [feedbackBanner]);

  const handleBoardStyleChange = (nextStyle: BrainstormBoardStyle) => {
    setBoardStyle(nextStyle);
    const nextCols = BOARD_STYLE_COLUMNS[nextStyle];
    if (nextCols.length > 0) {
      setTargetColId(nextCols[0].id);
    }
  };

  const handleImportFromWheel = () => {
    const clean = activeWheel.entries.map((e) => e.trim()).filter(Boolean).slice(0, 12);
    if (clean.length === 0) return;
    const imported: BrainstormTeam[] = clean.map((name, idx) => ({
      id: `wheel_tm_${Date.now()}_${idx}`,
      name,
      color: BRAINSTORM_COLORS[idx % BRAINSTORM_COLORS.length],
      score: 0,
    }));
    setTeams(imported);
    setActiveTeamId(imported[0].id);
    if (settings.soundEnabled) playTickSound(0.2);
  };

  const handleAddTeam = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = newTeamName.trim().slice(0, 40);
    if (!cleaned) return;
    const next: BrainstormTeam = {
      id: `tm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleaned,
      color: BRAINSTORM_COLORS[teams.length % BRAINSTORM_COLORS.length],
      score: 0,
    };
    setTeams((prev) => [...prev, next]);
    setActiveTeamId(next.id);
    setNewTeamName('');
  };

  const handleRemoveTeam = (id: string) => {
    if (teams.length <= 1) return;
    setTeams((prev) => {
      const next = prev.filter((tm) => tm.id !== id);
      if (activeTeamId === id && next[0]) {
        setActiveTeamId(next[0].id);
      }
      return next;
    });
  };

  const handleStartRound = () => {
    const effectiveDuration = playMode === 'sprint' ? durationSec : 0;
    setTimeLeft(effectiveDuration);
    setTimerRunning(effectiveDuration > 0);
    setStage('PLAYING');
    lastIdeaAtRef.current = 0;
    if (settings.soundEnabled) playTickSound(0.25);
  };

  const handleFinishRound = () => {
    setTimerRunning(false);
    setStage('SUMMARY');
    if (settings.soundEnabled) playWinSound();
    if (
      settings.confettiEnabled &&
      ideas.length > 0 &&
      typeof window !== 'undefined' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.6 },
        colors: BRAINSTORM_COLORS,
      });
    }
  };

  const handlePickRandomSpeaker = () => {
    if (teams.length < 2) return;
    const others = teams.filter((tm) => tm.id !== activeTeam.id);
    const pool = others.length > 0 ? others : teams;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setActiveTeamId(picked.id);
    if (settings.soundEnabled) playTickSound(0.24);
    if (settings.hapticsEnabled) triggerHaptic(15);
  };

  const handleDrawSpark = () => {
    const others = activeSpark
      ? BRAINSTORM_SPARKS.filter((s) => s.id !== activeSpark.id)
      : BRAINSTORM_SPARKS;
    const picked = others[Math.floor(Math.random() * others.length)];
    setActiveSpark(picked);
    if (settings.soundEnabled) playTickSound(0.22);
  };

  const handleSubmitIdea = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = draftIdea.trim().slice(0, 160);
    if (!cleaned) return;

    const isDuplicate = ideas.some(
      (item) => item.text.toLowerCase() === cleaned.toLowerCase()
    );
    if (isDuplicate) {
      setFeedbackBanner(t.brainstormDuplicateMsg);
      if (settings.soundEnabled) playWrongSound();
      if (settings.hapticsEnabled) triggerHaptic([20, 20]);
      return;
    }

    const now = Date.now();
    const isFastCombo = lastIdeaAtRef.current > 0 && now - lastIdeaAtRef.current <= 4500;
    lastIdeaAtRef.current = now;

    const pointsEarned = 10 + (isFastCombo ? 5 : 0) + (activeSpark ? 5 : 0);

    const newIdea: BrainstormIdea = {
      id: `idea_${now}_${Math.random().toString(36).slice(2, 6)}`,
      text: cleaned,
      columnId: resolvedTargetColId,
      author: activeTeam.name,
      accentHex: activeTeam.color,
      votes: 0,
      sparkUsed: activeSpark ? (isKm ? activeSpark.labelKm : activeSpark.labelEn) : undefined,
      createdAt: now,
    };

    setIdeas((prev) => [newIdea, ...prev]);
    setTeams((prev) =>
      prev.map((tm) =>
        tm.id === activeTeam.id ? { ...tm, score: tm.score + pointsEarned } : tm
      )
    );
    setDraftIdea('');

    if (isFastCombo) {
      setFeedbackBanner(`${t.brainstormComboBonus} +${pointsEarned}`);
    }

    if (settings.soundEnabled) playCorrectSound();
    if (settings.hapticsEnabled) triggerHaptic(12);
  };

  const handleVoteIdea = (ideaId: string) => {
    setIdeas((prev) =>
      prev.map((item) => (item.id === ideaId ? { ...item, votes: item.votes + 1 } : item))
    );
    if (settings.soundEnabled) playTickSound(0.2);
  };

  const handleMoveIdea = (ideaId: string, nextColumnId: string) => {
    setIdeas((prev) =>
      prev.map((item) =>
        item.id === ideaId ? { ...item, columnId: nextColumnId } : item
      )
    );
  };

  const handleDeleteIdea = (ideaId: string) => {
    setIdeas((prev) => prev.filter((item) => item.id !== ideaId));
  };

  const handleClearIdeas = () => {
    setIdeas([]);
    setTeams((prev) => prev.map((tm) => ({ ...tm, score: 0 })));
    lastIdeaAtRef.current = 0;
  };

  const sortedIdeas = useMemo(() => {
    const copy = [...ideas];
    if (sortOrder === 'votes') {
      return copy.sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt);
    }
    return copy.sort((a, b) => b.createdAt - a.createdAt);
  }, [ideas, sortOrder]);

  const topSpotlightIdeas = useMemo(() => {
    return [...ideas]
      .sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt)
      .slice(0, 6);
  }, [ideas]);

  const rankedTeams = useMemo(() => {
    return [...teams].sort((a, b) => b.score - a.score);
  }, [teams]);

  const handleCopySummary = async () => {
    if (ideas.length === 0) return;
    try {
      await navigator.clipboard.writeText(
        formatBrainstormSummary(topic, boardStyle, ideas, settings.language)
      );
      setCopied(true);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleExportCsv = () => {
    if (ideas.length === 0) return;
    const csv = formatBrainstormCsv(topic, boardStyle, ideas, settings.language);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pickerwel-brainstorm-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSpinIdeasOnWheel = async () => {
    const entries = [...ideas]
      .sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt)
      .map((i) => i.text)
      .slice(0, 24);
    if (entries.length < 2) return;
    const title = isKm ? `គំនិតព្យុះគំនិត` : `Brainstorm Top Ideas`;
    await createNewWheel(title, entries, activeWheel.paletteId);
    setActiveNav('home');
  };

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* STAGE 1: LOBBY / SETUP                                       */}
      {/* ============================================================ */}
      {stage === 'LOBBY' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7/12): Topic & Starter Prompts */}
          <div className="lg:col-span-7 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-[#3B82F6] shrink-0" />
                <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {t.brainstormTitle}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {t.brainstormDesc}
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="brainstorm-topic-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {t.brainstormTopicLabel}
              </label>
              <textarea
                id="brainstorm-topic-input"
                rows={2}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t.brainstormTopicPlaceholder}
                className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm sm:text-base font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div className="space-y-2.5">
              <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {t.brainstormPresetTopics}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {STARTER_BRAINSTORM_TOPICS.map((preset) => {
                  const text = isKm ? preset.promptKm : preset.promptEn;
                  const selected = topic.trim() === text.trim();
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setTopic(text)}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="block text-[11px] font-semibold text-[#3B82F6] dark:text-blue-400">
                        {isKm ? preset.categoryKm : preset.categoryEn}
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-slate-800 dark:text-slate-100 line-clamp-2">
                        {text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (5/12): Game Mode, Layout, Timer, Teams */}
          <div className="lg:col-span-5 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            {/* Play Mode */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPlayMode('sprint')}
                  className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    playMode === 'sprint'
                      ? 'bg-white dark:bg-slate-700 text-[#3B82F6] dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.brainstormModeSprint}
                </button>
                <button
                  type="button"
                  onClick={() => setPlayMode('board')}
                  className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    playMode === 'board'
                      ? 'bg-white dark:bg-slate-700 text-[#3B82F6] dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.brainstormModeBoard}
                </button>
              </div>
            </div>

            {/* Board Layout Style */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                {t.brainstormBoardStyleLabel}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'classic', label: t.brainstormStyleClassic },
                    { id: 'swot', label: t.brainstormStyleSwot },
                    { id: 'scamper', label: t.brainstormStyleScamper },
                    { id: 'free', label: t.brainstormStyleFree },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleBoardStyleChange(item.id)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      boardStyle === item.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sprint Duration */}
            {playMode === 'sprint' && (
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t.brainstormDurationLabel}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[30, 60, 90, 120, 0].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setDurationSec(sec)}
                      className={`min-h-[36px] px-3 rounded-xl border text-xs font-mono font-semibold tabular-nums cursor-pointer whitespace-nowrap ${
                        durationSec === sec
                          ? 'border-blue-500 bg-[#3B82F6] text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {sec === 0 ? t.brainstormUnlimited : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Teams / Contributors */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t.brainstormTeamsLabel} · {teams.length}
                </span>
                <button
                  type="button"
                  onClick={handleImportFromWheel}
                  disabled={activeWheel.entries.length === 0}
                  className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#3B82F6] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{t.importWheelPlayers}</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {teams.map((tm) => (
                  <div
                    key={tm.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: tm.color }}
                      aria-hidden="true"
                    />
                    <span className="max-w-[120px] truncate">{tm.name}</span>
                    {teams.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTeam(tm.id)}
                        aria-label={`Remove ${tm.name}`}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddTeam} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder={t.brainstormAddTeamPlaceholder}
                  maxLength={40}
                  className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <button
                  type="submit"
                  disabled={!newTeamName.trim()}
                  className="min-h-[40px] px-3 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.addBtn}</span>
                </button>
              </form>
            </div>

            <button
              type="button"
              onClick={handleStartRound}
              disabled={!topic.trim()}
              className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:opacity-95 text-white font-display text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4" />
              <span>{t.brainstormStartRound}</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STAGE 2: ACTIVE BRAINSTORM PLAY BOARD                        */}
      {/* ============================================================ */}
      {stage === 'PLAYING' && (
        <div className="space-y-4">
          {/* Top Session HUD */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    onClick={() => {
                      setTimerRunning(false);
                      setStage('LOBBY');
                    }}
                    className="font-semibold text-[#3B82F6] dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    ← {t.editQuizBtn}
                  </button>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums font-medium">
                    {t.brainstormIdeasCount(ideas.length)}
                  </span>
                  {durationSec > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-mono font-bold tabular-nums inline-flex items-center gap-1 ${
                          timeLeft <= 10 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {formatSeconds(timeLeft)}
                      </span>
                    </>
                  )}
                </div>
                <h2 className="font-display text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
                  {topic}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {durationSec > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setTimerRunning((r) => !r)}
                      className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{timerRunning ? t.pause : t.resume}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeLeft((p) => p + 30)}
                      className="min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                    >
                      +30s
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleDrawSpark}
                  className="min-h-[38px] px-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-xs font-semibold text-amber-800 dark:text-amber-300 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{t.brainstormSparkBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={handleFinishRound}
                  className="min-h-[38px] px-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>{t.brainstormFinishRound}</span>
                </button>
              </div>
            </div>

            {/* Team Turn Selector Strip */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {teams.map((tm) => {
                  const selected = tm.id === activeTeam.id;
                  return (
                    <button
                      key={tm.id}
                      type="button"
                      onClick={() => setActiveTeamId(tm.id)}
                      className={`min-h-[36px] px-3 py-1 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                        selected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-slate-900 dark:text-white shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tm.color }}
                        aria-hidden="true"
                      />
                      <span className="max-w-[120px] truncate">{tm.name}</span>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {tm.score}
                      </span>
                    </button>
                  );
                })}
              </div>

              {teams.length > 1 && (
                <button
                  type="button"
                  onClick={handlePickRandomSpeaker}
                  className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Shuffle className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>{t.brainstormRandomTurnBtn}</span>
                </button>
              )}
            </div>

            {/* Active Spark Challenge Card */}
            <AnimatePresence>
              {activeSpark && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                      {isKm ? activeSpark.labelKm : activeSpark.labelEn} (+5)
                    </span>
                    <p className="text-xs sm:text-sm text-amber-900/90 dark:text-amber-100 mt-0.5">
                      {isKm ? activeSpark.hintKm : activeSpark.hintEn}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSpark(null)}
                    aria-label={t.brainstormSparkClear}
                    className="min-h-[34px] px-2.5 rounded-lg text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    {t.brainstormSparkClear}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Idea Input Bar */}
            <form onSubmit={handleSubmitIdea} className="space-y-2.5">
              {columns.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {columns.map((col) => {
                    const selected = col.id === resolvedTargetColId;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => setTargetColId(col.id)}
                        className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          selected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: col.accentHex }}
                          aria-hidden="true"
                        />
                        <span>{isKm ? col.labelKm : col.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftIdea}
                  onChange={(e) => setDraftIdea(e.target.value)}
                  placeholder={t.brainstormIdeaPlaceholder}
                  maxLength={160}
                  className="flex-1 min-w-0 h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <button
                  type="submit"
                  disabled={!draftIdea.trim()}
                  className="min-h-[48px] px-4 sm:px-5 rounded-2xl bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-40 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.brainstormSubmitIdea}</span>
                </button>
              </div>

              {feedbackBanner && (
                <p className="text-xs font-semibold text-[#3B82F6] dark:text-blue-400">
                  {feedbackBanner}
                </p>
              )}
            </form>
          </div>

          {/* Board Controls Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setSortOrder('newest')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  sortOrder === 'newest'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.brainstormSortNewest}
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('votes')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  sortOrder === 'votes'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.brainstormSortVotes}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopySummary}
                disabled={ideas.length === 0}
                className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t.groupsCopiedMsg : t.groupsCopyBtn}</span>
              </button>
              <button
                type="button"
                onClick={handleClearIdeas}
                disabled={ideas.length === 0}
                className="min-h-[36px] px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-xs font-semibold text-rose-700 dark:text-rose-300 inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.brainstormResetBoard}</span>
              </button>
            </div>
          </div>

          {/* Interactive Idea Columns */}
          {ideas.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
              <Lightbulb className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t.brainstormEmptyIdeas}
              </p>
            </div>
          ) : (
            <div
              className={`grid gap-4 ${
                columns.length === 1
                  ? 'grid-cols-1'
                  : 'grid-cols-1 md:grid-cols-2'
              }`}
            >
              {columns.map((col) => {
                const colIdeas = sortedIdeas.filter((i) => i.columnId === col.id);
                return (
                  <div
                    key={col.id}
                    className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
                  >
                    <div
                      className="h-1 w-full"
                      style={{ backgroundColor: col.accentHex }}
                      aria-hidden="true"
                    />
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                        {isKm ? col.labelKm : col.labelEn}
                      </h3>
                      <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
                        {colIdeas.length}
                      </span>
                    </div>

                    <div className="p-3.5 space-y-2.5 flex-1">
                      {colIdeas.length === 0 ? (
                        <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                          —
                        </p>
                      ) : (
                        colIdeas.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2"
                          >
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug break-words">
                              {item.text}
                            </p>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: item.accentHex }}
                                  aria-hidden="true"
                                />
                                <span className="truncate max-w-[110px] font-medium">
                                  {item.author}
                                </span>
                                {item.sparkUsed && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-amber-600 dark:text-amber-400 truncate max-w-[100px]">
                                      {item.sparkUsed}
                                    </span>
                                  </>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleVoteIdea(item.id)}
                                  className="min-h-[30px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer tabular-nums"
                                >
                                  <ThumbsUp className="w-3 h-3 text-[#3B82F6]" />
                                  <span>{item.votes}</span>
                                </button>

                                {columns.length > 1 && (
                                  <select
                                    value={item.columnId}
                                    onChange={(e) => handleMoveIdea(item.id, e.target.value)}
                                    aria-label={t.groupsMoveToLabel}
                                    className="h-[30px] max-w-[88px] px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer"
                                  >
                                    {columns.map((target) => (
                                      <option key={target.id} value={target.id}>
                                        {isKm ? target.labelKm : target.labelEn}
                                      </option>
                                    ))}
                                  </select>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeleteIdea(item.id)}
                                  aria-label={t.deleteQuizBtn}
                                  className="min-h-[30px] min-w-[30px] rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* STAGE 3: ROUND SUMMARY & TOP SPOTLIGHT IDEAS                 */}
      {/* ============================================================ */}
      {stage === 'SUMMARY' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-[#3B82F6] flex items-center justify-center mx-auto">
              <Trophy className="w-6 h-6" />
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {t.brainstormTopIdeasTitle}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {topic} · {t.brainstormIdeasCount(ideas.length)}
            </p>
          </div>

          {/* Team Leaderboard */}
          {teams.length > 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {rankedTeams.map((tm, idx) => (
                <div
                  key={tm.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-400 tabular-nums">
                      #{idx + 1}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tm.color }}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {tm.name}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-bold text-[#3B82F6] dark:text-blue-400 tabular-nums shrink-0">
                    {tm.score}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Top Spotlight Ideas */}
          <div className="space-y-2.5">
            {topSpotlightIdeas.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.brainstormEmptyIdeas}
              </p>
            ) : (
              topSpotlightIdeas.map((idea, idx) => (
                <div
                  key={idea.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white break-words">
                        {idea.text}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {idea.author}
                        {idea.sparkUsed ? ` · ${idea.sparkUsed}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleVoteIdea(idea.id)}
                    className="min-h-[34px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer shrink-0 tabular-nums"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-[#3B82F6]" />
                    <span>{idea.votes}</span>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Summary Footer Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopySummary}
                disabled={ideas.length === 0}
                className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? t.groupsCopiedMsg : t.groupsCopyBtn}</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={ideas.length === 0}
                className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>{t.groupsExportCsvBtn}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ideas.length >= 2 && (
                <button
                  type="button"
                  onClick={handleSpinIdeasOnWheel}
                  className="min-h-[42px] px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Disc3 className="w-4 h-4" />
                  <span>{t.brainstormSpinIdeasBtn}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setStage('PLAYING')}
                className="min-h-[42px] px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <ArrowRight className="w-4 h-4" />
                <span>{t.brainstormBackToBoard}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
