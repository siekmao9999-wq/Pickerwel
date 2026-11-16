'use client';

import React, { useState, useEffect } from 'react';
import { Fish, Layers, Spade, Palette, Zap, Compass, Trophy, BarChart3, Lightbulb } from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import { FishingGame } from './FishingGame';
import { CardFlipGame } from './CardFlipGame';
import { VirtualDeckGame } from './VirtualDeckGame';
import { StroopGame } from './StroopGame';
import { WaygroundGame } from './WaygroundGame';
import { PathPuzzleGame } from './PathPuzzleGame';
import { KahootGame } from './KahootGame';
import { MentiPollGame } from './MentiPollGame';
import { BrainstormGame } from './BrainstormGame';
import { QuizEditorModal } from './QuizEditorModal';
import {
  loadOfflineQuizzes,
  saveOfflineQuizzes,
  STARTER_OFFLINE_QUIZZES,
  type OfflineQuiz,
} from '@/lib/offline-quizzes';
import { COPY } from '@/lib/i18n';

export type OfflineGameTab =
  | 'fishing'
  | 'cards'
  | 'deck'
  | 'stroop'
  | 'wayground'
  | 'path_puzzle'
  | 'kahoot'
  | 'menti'
  | 'brainstorm';

export function OfflineGamesView() {
  const { settings } = usePickerwel();
  const t = COPY[settings.language];

  const [activeTab, setActiveTab] = useState<OfflineGameTab>('fishing');
  const [quizzes, setQuizzes] = useState<OfflineQuiz[]>(STARTER_OFFLINE_QUIZZES);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<OfflineQuiz | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setQuizzes(loadOfflineQuizzes());
    });
  }, []);

  const handleSaveQuiz = (quiz: OfflineQuiz) => {
    setQuizzes((prev) => {
      const exists = prev.some((q) => q.id === quiz.id);
      const next = exists
        ? prev.map((q) => (q.id === quiz.id ? quiz : q))
        : [quiz, ...prev];
      saveOfflineQuizzes(next);
      return next;
    });
    setEditorOpen(false);
    setEditingQuiz(null);
  };

  const handleDeleteQuiz = (quizId: string) => {
    setQuizzes((prev) => {
      const next = prev.filter((q) => q.id !== quizId);
      const finalList = next.length > 0 ? next : STARTER_OFFLINE_QUIZZES;
      saveOfflineQuizzes(finalList);
      return finalList;
    });
  };

  const tabs: {
    id: OfflineGameTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'fishing', label: t.tabFishing, icon: Fish },
    { id: 'cards', label: t.tabCards, icon: Layers },
    { id: 'deck', label: t.tabDeck, icon: Spade },
    { id: 'stroop', label: t.tabStroop, icon: Palette },
    { id: 'wayground', label: t.tabWayground, icon: Zap },
    { id: 'path_puzzle', label: t.tabPathPuzzle, icon: Compass },
    { id: 'kahoot', label: t.tabKahoot, icon: Trophy },
    { id: 'menti', label: t.tabMenti, icon: BarChart3 },
    { id: 'brainstorm', label: t.tabBrainstorm, icon: Lightbulb },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header + 4 Game Mode Selector Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {t.gamesTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t.gamesDesc}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[40px] px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-[#3B82F6] dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Game Viewport */}
        {activeTab === 'fishing' ? (
          <FishingGame />
        ) : activeTab === 'cards' ? (
          <CardFlipGame />
        ) : activeTab === 'deck' ? (
          <VirtualDeckGame />
        ) : activeTab === 'stroop' ? (
          <StroopGame />
        ) : activeTab === 'wayground' ? (
          <WaygroundGame
            quizzes={quizzes}
            onCreateQuiz={() => {
              setEditingQuiz(null);
              setEditorOpen(true);
            }}
            onEditQuiz={(quiz) => {
              setEditingQuiz(quiz);
              setEditorOpen(true);
            }}
            onDeleteQuiz={handleDeleteQuiz}
          />
        ) : activeTab === 'path_puzzle' ? (
          <PathPuzzleGame />
        ) : activeTab === 'menti' ? (
          <MentiPollGame />
        ) : activeTab === 'brainstorm' ? (
          <BrainstormGame />
        ) : (
          <KahootGame
            quizzes={quizzes}
            onCreateQuiz={() => {
              setEditingQuiz(null);
              setEditorOpen(true);
            }}
            onEditQuiz={(quiz) => {
              setEditingQuiz(quiz);
              setEditorOpen(true);
            }}
          />
        )}
      </div>

      {editorOpen && (
        <QuizEditorModal
          initialQuiz={editingQuiz}
          language={settings.language}
          onSave={handleSaveQuiz}
          onClose={() => {
            setEditorOpen(false);
            setEditingQuiz(null);
          }}
        />
      )}
    </div>
  );
}
