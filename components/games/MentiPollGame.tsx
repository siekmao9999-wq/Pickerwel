'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  Cloud,
  SlidersHorizontal,
  MessageSquareText,
  Plus,
  Pencil,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  RotateCcw,
  Download,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  Send,
  Users,
  Sparkles,
  Check,
  Undo2,
  Star,
  X,
} from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import {
  STARTER_OFFLINE_POLLS,
  MENTI_CHART_COLORS,
  loadOfflinePolls,
  saveOfflinePolls,
  getSlideVoteCount,
  clearSlideVotes,
  populateSampleVotesForDeck,
  exportPollDeckToCsv,
  type MentiPollDeck,
  type MentiSlide,
  type MentiSlideType,
} from '@/lib/offline-polls';
import { MentiPollEditorModal } from './MentiPollEditorModal';
import { playTickSound, playCorrectSound, triggerHaptic } from '@/lib/sound';
import { COPY } from '@/lib/i18n';

const MENTI_BROADCAST_CHANNEL = 'pickerwel_menti_offline_sync_v1';

const QUICK_CHIPS_KM = ['ល្អណាស់', 'សប្បាយ', 'យល់ច្បាស់', 'ច្នៃប្រឌិត', 'សហការ', 'តាំងចិត្ត'];
const QUICK_CHIPS_EN = ['Great', 'Clear', 'Fun', 'Teamwork', 'Curious', 'Focused'];

function getSlideIcon(type: MentiSlideType) {
  switch (type) {
    case 'multiple_choice':
      return BarChart3;
    case 'word_cloud':
      return Cloud;
    case 'scales':
      return SlidersHorizontal;
    case 'open_ended':
      return MessageSquareText;
  }
}

export function MentiPollGame() {
  const { activeWheel, settings } = usePickerwel();
  const t = COPY[settings.language];

  const [decks, setDecks] = useState<MentiPollDeck[]>(STARTER_OFFLINE_POLLS);
  const [selectedDeckId, setSelectedDeckId] = useState<string>(
    STARTER_OFFLINE_POLLS[0].id
  );
  const [slideIndex, setSlideIndex] = useState(0);
  const [presentMode, setPresentMode] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<MentiPollDeck | null>(null);

  // Voting booth inputs
  const [wordInput, setWordInput] = useState('');
  const [openInput, setOpenInput] = useState('');
  const [voteFeedback, setVoteFeedback] = useState<string | null>(null);
  const [lastUndoAction, setLastUndoAction] = useState<(() => void) | null>(null);

  // Optional wheel voter queue
  const [voterQueue, setVoterQueue] = useState<string[]>([]);
  const [voterIdx, setVoterIdx] = useState(0);

  // Load persisted polls + listen for multi-tab offline BroadcastChannel updates
  useEffect(() => {
    queueMicrotask(() => {
      const loaded = loadOfflinePolls();
      setDecks(loaded);
      if (loaded[0]) setSelectedDeckId(loaded[0].id);
    });

    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel(MENTI_BROADCAST_CHANNEL);
      channel.onmessage = (event) => {
        if (Array.isArray(event.data)) {
          setDecks(event.data as MentiPollDeck[]);
        }
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pickerwel_offline_menti_polls_v1' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as MentiPollDeck[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDecks(parsed);
          }
        } catch {
          // Ignore malformed storage payload
        }
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      channel?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!voteFeedback) return;
    const timer = window.setTimeout(() => setVoteFeedback(null), 1600);
    return () => window.clearTimeout(timer);
  }, [voteFeedback]);

  const activeDeck =
    decks.find((d) => d.id === selectedDeckId) || decks[0] || STARTER_OFFLINE_POLLS[0];
  const safeSlideIdx = Math.min(slideIndex, Math.max(0, activeDeck.slides.length - 1));
  const currentSlide = activeDeck.slides[safeSlideIdx] || activeDeck.slides[0];

  const persistDecks = (nextDecks: MentiPollDeck[]) => {
    setDecks(nextDecks);
    saveOfflinePolls(nextDecks);
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const ch = new BroadcastChannel(MENTI_BROADCAST_CHANNEL);
        ch.postMessage(nextDecks);
        ch.close();
      } catch {
        // Ignore broadcast error
      }
    }
  };

  const updateCurrentSlide = (updater: (slide: MentiSlide) => MentiSlide) => {
    const nextDecks = decks.map((deck) => {
      if (deck.id !== activeDeck.id) return deck;
      return {
        ...deck,
        updatedAt: Date.now(),
        slides: deck.slides.map((s, idx) =>
          idx === safeSlideIdx ? updater(s) : s
        ),
      };
    });
    persistDecks(nextDecks);
  };

  const notifyVoteRecorded = () => {
    if (settings.soundEnabled) playTickSound(0.32);
    if (settings.hapticsEnabled) triggerHaptic(18);
    setVoteFeedback(t.mentiVotedToast);
    if (voterQueue.length > 0) {
      setVoterIdx((i) => (i + 1) % voterQueue.length);
    }
  };

  const handleCastChoiceVote = (optionId: string) => {
    const snapshotSlide = currentSlide;
    updateCurrentSlide((slide) => ({
      ...slide,
      options: (slide.options || []).map((opt) =>
        opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
      ),
    }));
    setLastUndoAction(() => () => {
      updateCurrentSlide(() => snapshotSlide);
    });
    notifyVoteRecorded();
  };

  const handleCastWordVote = (rawWord: string) => {
    const cleaned = rawWord.trim().replace(/\s+/g, ' ').slice(0, 32);
    if (!cleaned) return;
    const snapshotSlide = currentSlide;

    updateCurrentSlide((slide) => {
      const existing = slide.words || [];
      const matchIdx = existing.findIndex(
        (w) => w.text.toLowerCase() === cleaned.toLowerCase()
      );
      if (matchIdx >= 0) {
        return {
          ...slide,
          words: existing.map((w, idx) =>
            idx === matchIdx ? { ...w, count: w.count + 1 } : w
          ),
        };
      }
      return {
        ...slide,
        words: [...existing, { text: cleaned, count: 1 }],
      };
    });

    setWordInput('');
    setLastUndoAction(() => () => {
      updateCurrentSlide(() => snapshotSlide);
    });
    notifyVoteRecorded();
  };

  const handleRemoveWord = (wordText: string) => {
    updateCurrentSlide((slide) => ({
      ...slide,
      words: (slide.words || []).filter((w) => w.text !== wordText),
    }));
  };

  const handleCastScaleVote = (rating: 1 | 2 | 3 | 4 | 5) => {
    const snapshotSlide = currentSlide;
    updateCurrentSlide((slide) => {
      const counts = [...(slide.scaleCounts || [0, 0, 0, 0, 0])] as [
        number,
        number,
        number,
        number,
        number,
      ];
      counts[rating - 1] = (counts[rating - 1] || 0) + 1;
      return { ...slide, scaleCounts: counts };
    });
    setLastUndoAction(() => () => {
      updateCurrentSlide(() => snapshotSlide);
    });
    notifyVoteRecorded();
  };

  const handlePostOpenEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = openInput.trim().slice(0, 220);
    if (!cleaned) return;
    const snapshotSlide = currentSlide;
    const author =
      voterQueue.length > 0 ? voterQueue[voterIdx % voterQueue.length] : undefined;

    updateCurrentSlide((slide) => ({
      ...slide,
      openEntries: [
        {
          id: `oe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: cleaned,
          author,
          upvotes: 1,
          createdAt: Date.now(),
        },
        ...(slide.openEntries || []),
      ],
    }));
    setOpenInput('');
    setLastUndoAction(() => () => {
      updateCurrentSlide(() => snapshotSlide);
    });
    notifyVoteRecorded();
  };

  const handleUpvoteOpenEntry = (entryId: string) => {
    if (settings.soundEnabled) playTickSound(0.2);
    updateCurrentSlide((slide) => ({
      ...slide,
      openEntries: (slide.openEntries || []).map((entry) =>
        entry.id === entryId ? { ...entry, upvotes: entry.upvotes + 1 } : entry
      ),
    }));
  };

  const handleDeleteOpenEntry = (entryId: string) => {
    updateCurrentSlide((slide) => ({
      ...slide,
      openEntries: (slide.openEntries || []).filter((e) => e.id !== entryId),
    }));
  };

  const handleToggleHideResults = () => {
    if (settings.soundEnabled && currentSlide.hideResults) {
      playCorrectSound();
    }
    updateCurrentSlide((slide) => ({
      ...slide,
      hideResults: !slide.hideResults,
    }));
  };

  const handleResetSlideVotes = () => {
    setLastUndoAction(null);
    updateCurrentSlide(clearSlideVotes);
  };

  const handleResetDeckVotes = () => {
    setLastUndoAction(null);
    const nextDecks = decks.map((deck) =>
      deck.id === activeDeck.id
        ? {
            ...deck,
            updatedAt: Date.now(),
            slides: deck.slides.map(clearSlideVotes),
          }
        : deck
    );
    persistDecks(nextDecks);
  };

  const handleFillDemoData = () => {
    if (settings.soundEnabled) playCorrectSound();
    const nextDecks = decks.map((deck) =>
      deck.id === activeDeck.id
        ? populateSampleVotesForDeck(deck, settings.language)
        : deck
    );
    persistDecks(nextDecks);
  };

  const handleExportCsv = () => {
    const csv = exportPollDeckToCsv(activeDeck);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDeck.title.replace(/[^\w\u1780-\u17FF-]+/g, '_')}_results.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveDeck = (saved: MentiPollDeck) => {
    const exists = decks.some((d) => d.id === saved.id);
    const nextDecks = exists
      ? decks.map((d) => (d.id === saved.id ? saved : d))
      : [saved, ...decks];
    persistDecks(nextDecks);
    setSelectedDeckId(saved.id);
    setSlideIndex(0);
    setEditorOpen(false);
    setEditingDeck(null);
  };

  const handleDuplicateDeck = () => {
    const copyDeck: MentiPollDeck = {
      ...activeDeck,
      id: `menti_${Date.now()}`,
      title: `${activeDeck.title} (${settings.language === 'km' ? 'ចម្លង' : 'Copy'})`,
      sessionCode: String(Math.floor(1000 + Math.random() * 9000)),
      updatedAt: Date.now(),
      slides: activeDeck.slides.map((s) => ({
        ...clearSlideVotes(s),
        id: `${s.id}_${Math.random().toString(36).slice(2, 5)}`,
      })),
    };
    const nextDecks = [copyDeck, ...decks];
    persistDecks(nextDecks);
    setSelectedDeckId(copyDeck.id);
    setSlideIndex(0);
  };

  const handleDeleteDeck = () => {
    if (decks.length <= 1) return;
    const nextDecks = decks.filter((d) => d.id !== activeDeck.id);
    persistDecks(nextDecks);
    setSelectedDeckId(nextDecks[0].id);
    setSlideIndex(0);
  };

  const handleLoadWheelVoters = () => {
    if (voterQueue.length > 0) {
      setVoterQueue([]);
      setVoterIdx(0);
      return;
    }
    const entries = activeWheel.entries.filter((e) => e.trim().length > 0);
    if (entries.length === 0) return;
    setVoterQueue(entries);
    setVoterIdx(0);
  };

  const totalSlideResponses = getSlideVoteCount(currentSlide);
  const currentVoterName =
    voterQueue.length > 0 ? voterQueue[voterIdx % voterQueue.length] : null;
  const quickChips = settings.language === 'km' ? QUICK_CHIPS_KM : QUICK_CHIPS_EN;

  const slideTypeLabel =
    currentSlide.type === 'multiple_choice'
      ? t.mentiTypeMultipleChoice
      : currentSlide.type === 'word_cloud'
      ? t.mentiTypeWordCloud
      : currentSlide.type === 'scales'
      ? t.mentiTypeScales
      : t.mentiTypeOpenEnded;

  // Derived visualization stats
  const mcOptions = currentSlide.options || [];
  const mcMaxVotes = Math.max(1, ...mcOptions.map((o) => o.votes));
  const mcTotalVotes = mcOptions.reduce((sum, o) => sum + o.votes, 0);

  const wcWords = [...(currentSlide.words || [])].sort((a, b) => b.count - a.count);
  const wcMaxCount = Math.max(1, ...wcWords.map((w) => w.count));

  const scaleCounts = currentSlide.scaleCounts || [0, 0, 0, 0, 0];
  const scaleTotal = scaleCounts.reduce((s, c) => s + c, 0);
  const scaleMaxBucket = Math.max(1, ...scaleCounts);
  const scaleAverage =
    scaleTotal > 0
      ? scaleCounts.reduce((sum, cnt, idx) => sum + cnt * (idx + 1), 0) / scaleTotal
      : 0;

  const sortedOpenEntries = [...(currentSlide.openEntries || [])].sort(
    (a, b) => b.upvotes - a.upvotes || b.createdAt - a.createdAt
  );

  return (
    <div className="space-y-5">
      {/* Header + Deck Creation */}
      {!presentMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {t.mentiTitle}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t.mentiDesc}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingDeck(null);
              setEditorOpen(true);
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t.mentiNewPollBtn}</span>
          </button>
        </div>
      )}

      {/* Poll Deck Selector Strip */}
      {!presentMode && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {decks.map((deck) => {
            const selected = deck.id === activeDeck.id;
            const totalVotesInDeck = deck.slides.reduce(
              (sum, s) => sum + getSlideVoteCount(s),
              0
            );
            return (
              <div
                key={deck.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedDeckId(deck.id);
                  setSlideIndex(0);
                  setLastUndoAction(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDeckId(deck.id);
                    setSlideIndex(0);
                    setLastUndoAction(null);
                  }
                }}
                className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                  selected
                    ? 'border-[#3B82F6] bg-blue-50/70 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {deck.category} · {t.mentiSlidesCount(deck.slides.length)} ·{' '}
                    {totalVotesInDeck} {t.mentiVotesLabel}
                  </p>
                  <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                    {deck.title}
                  </h3>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deck Toolbar & Slide Navigator */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Slide Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {activeDeck.slides.map((slide, idx) => {
            const Icon = getSlideIcon(slide.type);
            const active = idx === safeSlideIdx;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => {
                  setSlideIndex(idx);
                  setLastUndoAction(null);
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                  active
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {t.mentiSlideLabel} {idx + 1}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleHideResults}
            className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              currentSlide.hideResults
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {currentSlide.hideResults ? (
              <>
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span>{t.mentiShowResults}</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 shrink-0" />
                <span>{t.mentiHideResults}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleFillDemoData}
            className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>{t.mentiFillDemoBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleResetSlideVotes}
            className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>{t.mentiResetSlideVotes}</span>
          </button>

          {!presentMode && (
            <>
              <button
                type="button"
                onClick={handleExportCsv}
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>{t.mentiExportCsvBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingDeck(activeDeck);
                  setEditorOpen(true);
                }}
                aria-label={t.mentiEditPollBtn}
                title={t.mentiEditPollBtn}
                className="min-h-[38px] min-w-[38px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleDuplicateDeck}
                aria-label={t.mentiDuplicatePollBtn}
                title={t.mentiDuplicatePollBtn}
                className="min-h-[38px] min-w-[38px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              {decks.length > 1 && (
                <button
                  type="button"
                  onClick={handleDeleteDeck}
                  aria-label={t.mentiDeletePollBtn}
                  title={t.mentiDeletePollBtn}
                  className="min-h-[38px] min-w-[38px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setPresentMode((v) => !v)}
            className="min-h-[38px] px-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            {presentMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                <span>{t.mentiExitFullscreen}</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span>{t.mentiPresentFullscreen}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Two-Zone Classroom Stage */}
      <div
        className={`grid gap-5 items-stretch ${
          presentMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
        }`}
      >
        {/* LEFT / MAIN ZONE: Live Presenter Visualization */}
        <section
          className={`${
            presentMode ? 'col-span-1 min-h-[520px]' : 'lg:col-span-8 min-h-[440px]'
          } p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-6`}
        >
          {/* Question & Clean Metadata Header */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span>
                {activeDeck.title} · {t.mentiSlideLabel} {safeSlideIdx + 1}/
                {activeDeck.slides.length} · {slideTypeLabel}
              </span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {totalSlideResponses}{' '}
                {currentSlide.type === 'open_ended'
                  ? t.mentiResponsesLabel
                  : t.mentiVotesLabel}
              </span>
            </div>

            <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-snug text-balance">
              {currentSlide.question}
            </h3>

            {currentSlide.subtitle && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {currentSlide.subtitle}
              </p>
            )}
          </div>

          {/* Visualization Area */}
          <div className="flex-1 flex flex-col justify-center">
            {currentSlide.hideResults ? (
              <div className="py-12 px-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3">
                <EyeOff className="w-8 h-8 mx-auto text-amber-500" />
                <div className="space-y-1">
                  <p className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {t.mentiResultsHiddenTitle}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {t.mentiResultsHiddenDesc}
                  </p>
                </div>
                <p className="text-2xl font-mono font-bold text-[#3B82F6] dark:text-blue-400 tabular-nums">
                  {totalSlideResponses} {t.mentiVotesLabel}
                </p>
                <button
                  type="button"
                  onClick={handleToggleHideResults}
                  className="min-h-[42px] px-5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>{t.mentiShowResults}</span>
                </button>
              </div>
            ) : currentSlide.type === 'multiple_choice' ? (
              <div className="space-y-3.5">
                {mcOptions.map((opt, idx) => {
                  const pct =
                    mcTotalVotes > 0
                      ? Math.round((opt.votes / mcTotalVotes) * 100)
                      : 0;
                  const barScale = mcTotalVotes > 0 ? opt.votes / mcMaxVotes : 0;
                  const isLeading = mcTotalVotes > 0 && opt.votes === mcMaxVotes;
                  const barColor =
                    MENTI_CHART_COLORS[idx % MENTI_CHART_COLORS.length];

                  return (
                    <div key={opt.id} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: barColor }}
                            aria-hidden="true"
                          />
                          <span className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {opt.label}
                          </span>
                          {isLeading && (
                            <Check
                              className="w-4 h-4 text-emerald-500 shrink-0"
                              aria-label="Leading"
                            />
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap shrink-0">
                          {opt.votes} ({pct}%)
                        </span>
                      </div>

                      <div className="h-9 w-full rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden p-1">
                        <motion.div
                          initial={false}
                          animate={{ width: `${Math.max(barScale * 100, opt.votes > 0 ? 4 : 0)}%` }}
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-lg"
                          style={{ backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}

                {mcTotalVotes === 0 && (
                  <p className="pt-2 text-xs text-slate-400 dark:text-slate-500 text-center">
                    {t.mentiNoVotesYet}
                  </p>
                )}
              </div>
            ) : currentSlide.type === 'word_cloud' ? (
              wcWords.length === 0 ? (
                <div className="py-12 px-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center">
                  <Cloud className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t.mentiNoVotesYet}
                  </p>
                </div>
              ) : (
                <div className="min-h-[240px] p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 content-center">
                  <AnimatePresence>
                    {wcWords.map((entry, idx) => {
                      const ratio = entry.count / wcMaxCount;
                      const fontSizePx = Math.round(16 + ratio * 28);
                      const color =
                        MENTI_CHART_COLORS[idx % MENTI_CHART_COLORS.length];
                      return (
                        <motion.div
                          key={entry.text}
                          layout
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          transition={{ duration: 0.25 }}
                          className="group relative inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded-lg hover:bg-white/80 dark:hover:bg-slate-800"
                        >
                          <span
                            className="font-display font-bold leading-tight select-none"
                            style={{
                              fontSize: `${fontSizePx}px`,
                              color,
                            }}
                          >
                            {entry.text}
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                            ×{entry.count}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveWord(entry.text)}
                            aria-label={`Remove ${entry.text}`}
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 ml-0.5 text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )
            ) : currentSlide.type === 'scales' ? (
              <div className="space-y-6">
                {/* Average Summary */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t.mentiAverageLabel}
                    </p>
                    <p className="font-mono text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {scaleAverage.toFixed(1)}{' '}
                      <span className="text-base font-normal text-slate-400">
                        / 5.0
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1" aria-label={`Average ${scaleAverage.toFixed(1)} out of 5`}>
                    {[1, 2, 3, 4, 5].map((starVal) => (
                      <Star
                        key={starVal}
                        className={`w-6 h-6 ${
                          starVal <= Math.round(scaleAverage)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300 dark:text-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* 5-Column Histogram */}
                <div className="grid grid-cols-5 gap-3 items-end h-44 pt-4">
                  {scaleCounts.map((cnt, idx) => {
                    const heightPct =
                      scaleTotal > 0 ? Math.round((cnt / scaleMaxBucket) * 100) : 0;
                    const sharePct =
                      scaleTotal > 0 ? Math.round((cnt / scaleTotal) * 100) : 0;
                    const colColor =
                      MENTI_CHART_COLORS[idx % MENTI_CHART_COLORS.length];

                    return (
                      <div
                        key={idx}
                        className="h-full flex flex-col items-center justify-end gap-1.5"
                      >
                        <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                          {cnt} ({sharePct}%)
                        </span>
                        <div className="w-full flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex items-end">
                          <motion.div
                            initial={false}
                            animate={{
                              height: `${Math.max(heightPct, cnt > 0 ? 8 : 0)}%`,
                            }}
                            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                            className="w-full rounded-lg"
                            style={{ backgroundColor: colColor }}
                          />
                        </div>
                        <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                          {idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>1 · {currentSlide.scaleMinLabel || 'Low'}</span>
                  <span>5 · {currentSlide.scaleMaxLabel || 'High'}</span>
                </div>
              </div>
            ) : (
              /* Open Ended / Q&A Wall */
              sortedOpenEntries.length === 0 ? (
                <div className="py-12 px-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center">
                  <MessageSquareText className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t.mentiNoVotesYet}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                  <AnimatePresence>
                    {sortedOpenEntries.map((entry) => (
                      <motion.div
                        key={entry.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1">
                          {entry.author && (
                            <p className="text-[11px] font-semibold text-[#3B82F6] dark:text-blue-400">
                              {entry.author}
                            </p>
                          )}
                          <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                            {entry.text}
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                          <button
                            type="button"
                            onClick={() => handleUpvoteOpenEntry(entry.id)}
                            className="min-h-[32px] px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer tabular-nums"
                          >
                            <ThumbsUp className="w-3.5 h-3.5 text-[#3B82F6]" />
                            <span>{entry.upvotes}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOpenEntry(entry.id)}
                            aria-label="Delete response"
                            className="min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )
            )}
          </div>

          {/* Slide Prev / Next Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={safeSlideIdx === 0}
              onClick={() => {
                setSlideIndex((i) => Math.max(0, i - 1));
                setLastUndoAction(null);
              }}
              className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{t.mentiPrevSlide}</span>
            </button>

            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono tabular-nums">
              {safeSlideIdx + 1} / {activeDeck.slides.length}
            </span>

            <button
              type="button"
              disabled={safeSlideIdx >= activeDeck.slides.length - 1}
              onClick={() => {
                setSlideIndex((i) =>
                  Math.min(activeDeck.slides.length - 1, i + 1)
                );
                setLastUndoAction(null);
              }}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>{t.mentiNextSlide}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* RIGHT ZONE: Offline Voting Booth / Participant Input */}
        {!presentMode && (
          <aside className="lg:col-span-4 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {t.mentiVoteBoothTitle}
                </h3>
                {lastUndoAction && (
                  <button
                    type="button"
                    onClick={() => {
                      lastUndoAction();
                      setLastUndoAction(null);
                    }}
                    className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>{t.wgUndoBtn}</span>
                  </button>
                )}
              </div>

              {/* Optional Wheel Voter Turn Queue */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleLoadWheelVoters}
                    disabled={activeWheel.entries.length === 0}
                    className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 ${
                      voterQueue.length > 0
                        ? 'bg-blue-100 dark:bg-blue-950/60 text-[#3B82F6] dark:text-blue-400'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.mentiWheelVoterBtn}</span>
                  </button>

                  {voterQueue.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setVoterIdx((i) => (i + 1) % voterQueue.length)
                      }
                      className="min-h-[34px] px-2.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                    >
                      {t.mentiNextVoterBtn}
                    </button>
                  )}
                </div>

                {currentVoterName && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {t.mentiCurrentVoterLabel}:{' '}
                    <span className="font-bold text-slate-900 dark:text-white">
                      {currentVoterName}
                    </span>{' '}
                    <span className="text-slate-400 font-mono tabular-nums">
                      ({(voterIdx % voterQueue.length) + 1}/{voterQueue.length})
                    </span>
                  </p>
                )}
              </div>

              {/* Booth Controls per Slide Type */}
              {currentSlide.type === 'multiple_choice' && (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.mentiTapToVoteHint}
                  </p>
                  <div className="space-y-2">
                    {mcOptions.map((opt, idx) => {
                      const color =
                        MENTI_CHART_COLORS[idx % MENTI_CHART_COLORS.length];
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleCastChoiceVote(opt.id)}
                          className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 active:scale-[0.99] transition-all flex items-center justify-between gap-2 text-left cursor-pointer"
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-6 h-6 rounded-lg text-white text-xs font-mono font-bold flex items-center justify-center shrink-0"
                              style={{ backgroundColor: color }}
                            >
                              {idx + 1}
                            </span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {opt.label}
                            </span>
                          </span>
                          <span className="text-xs font-mono font-bold text-[#3B82F6] dark:text-blue-400 shrink-0">
                            +1
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {currentSlide.type === 'word_cloud' && (
                <div className="space-y-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleCastWordVote(wordInput);
                    }}
                    className="space-y-2"
                  >
                    <input
                      type="text"
                      value={wordInput}
                      onChange={(e) => setWordInput(e.target.value)}
                      maxLength={32}
                      placeholder={t.mentiWordPlaceholder}
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <button
                      type="submit"
                      disabled={!wordInput.trim()}
                      className="w-full min-h-[44px] px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{t.mentiWordSubmitBtn}</span>
                    </button>
                  </form>

                  <div className="pt-2 space-y-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t.mentiWordQuickChips}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {quickChips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => handleCastWordVote(chip)}
                          className="min-h-[34px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-blue-500 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {currentSlide.type === 'scales' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.mentiScalePromptHint}
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {([1, 2, 3, 4, 5] as const).map((num, idx) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleCastScaleVote(num)}
                        className="min-h-[54px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-mono text-lg font-bold text-slate-900 dark:text-white active:scale-95 transition-all cursor-pointer tabular-nums flex flex-col items-center justify-center"
                      >
                        <span>{num}</span>
                        <span
                          className="w-4 h-1 rounded-full mt-1"
                          style={{
                            backgroundColor:
                              MENTI_CHART_COLORS[idx % MENTI_CHART_COLORS.length],
                          }}
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{currentSlide.scaleMinLabel || '1'}</span>
                    <span>{currentSlide.scaleMaxLabel || '5'}</span>
                  </div>
                </div>
              )}

              {currentSlide.type === 'open_ended' && (
                <form onSubmit={handlePostOpenEntry} className="space-y-2.5">
                  <textarea
                    rows={4}
                    value={openInput}
                    onChange={(e) => setOpenInput(e.target.value)}
                    maxLength={220}
                    placeholder={t.mentiOpenPlaceholder}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <button
                    type="submit"
                    disabled={!openInput.trim()}
                    className="w-full min-h-[44px] px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>{t.mentiOpenSubmitBtn}</span>
                  </button>
                </form>
              )}
            </div>

            {/* Vote Confirmation + Deck Reset */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 min-h-[36px]">
              {voteFeedback ? (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>{voteFeedback}</span>
                </span>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                  {t.mentiSlidesCount(activeDeck.slides.length)}
                </span>
              )}

              <button
                type="button"
                onClick={handleResetDeckVotes}
                className="text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 cursor-pointer whitespace-nowrap"
              >
                {t.mentiResetAllVotes}
              </button>
            </div>
          </aside>
        )}
      </div>

      {editorOpen && (
        <MentiPollEditorModal
          initialDeck={editingDeck}
          language={settings.language}
          onSave={handleSaveDeck}
          onClose={() => {
            setEditorOpen(false);
            setEditingDeck(null);
          }}
        />
      )}
    </div>
  );
}
