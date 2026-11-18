'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  MessageSquare,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import {
  getGradeLabel,
  getSubjectLabel,
  GRADE_GROUPS,
  GRADE_LEVELS,
  resolveQuizGradeId,
  resolveQuizSubjectId,
  SUBJECT_CATALOG,
  type GradeId,
  type OfflineQuiz,
  type SubjectId,
} from '@/lib/offline-quizzes';
import { COPY, type Language } from '@/lib/i18n';

export interface QuizCreatePreset {
  subjectId?: SubjectId;
  gradeId?: GradeId;
}

interface SubjectGradeQuizPickerProps {
  quizzes: OfflineQuiz[];
  selectedQuizId: string;
  language: Language;
  includeOralOption?: boolean;
  onSelectQuiz: (quizId: string) => void;
  onCreateQuiz?: (preset?: QuizCreatePreset) => void;
  onEditQuiz?: (quiz: OfflineQuiz) => void;
}

export function SubjectGradeQuizPicker({
  quizzes,
  selectedQuizId,
  language,
  includeOralOption = false,
  onSelectQuiz,
  onCreateQuiz,
  onEditQuiz,
}: SubjectGradeQuizPickerProps) {
  const t = COPY[language];
  const [open, setOpen] = useState(false);

  const selectedQuiz = useMemo(() => {
    if (includeOralOption && selectedQuizId === 'oral') return null;
    return quizzes.find((q) => q.id === selectedQuizId) ?? quizzes[0] ?? null;
  }, [includeOralOption, quizzes, selectedQuizId]);

  const [browseSubject, setBrowseSubject] = useState<'all' | SubjectId>(() =>
    selectedQuiz ? resolveQuizSubjectId(selectedQuiz) : 'math'
  );
  const [browseGrade, setBrowseGrade] = useState<'all' | GradeId>(() =>
    selectedQuiz ? resolveQuizGradeId(selectedQuiz) : 'all'
  );

  // Sync browser state when opening
  const handleOpen = () => {
    if (selectedQuiz) {
      setBrowseSubject(resolveQuizSubjectId(selectedQuiz));
      setBrowseGrade(resolveQuizGradeId(selectedQuiz));
    } else {
      setBrowseSubject('math');
      setBrowseGrade('all');
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const subjectCounts = useMemo(() => {
    const map: Partial<Record<SubjectId, number>> = {};
    for (const q of quizzes) {
      const sid = resolveQuizSubjectId(q);
      map[sid] = (map[sid] ?? 0) + 1;
    }
    return map;
  }, [quizzes]);

  const gradeCountsForSubject = useMemo(() => {
    const map: Partial<Record<GradeId, number>> = {};
    for (const q of quizzes) {
      const sid = resolveQuizSubjectId(q);
      if (browseSubject !== 'all' && sid !== browseSubject) continue;
      const gid = resolveQuizGradeId(q);
      map[gid] = (map[gid] ?? 0) + 1;
    }
    return map;
  }, [browseSubject, quizzes]);

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      const sid = resolveQuizSubjectId(q);
      const gid = resolveQuizGradeId(q);
      if (browseSubject !== 'all' && sid !== browseSubject) return false;
      if (browseGrade !== 'all' && gid !== browseGrade) return false;
      return true;
    });
  }, [browseGrade, browseSubject, quizzes]);

  const triggerText = useMemo(() => {
    if (includeOralOption && selectedQuizId === 'oral') {
      return t.swimOralOption;
    }
    if (!selectedQuiz) return t.chooseSubjectGradeHint;
    const sid = resolveQuizSubjectId(selectedQuiz);
    const gid = resolveQuizGradeId(selectedQuiz);
    const subLabel = getSubjectLabel(sid, language);
    const gradeShort = getGradeLabel(gid, language, true);
    return `${subLabel} · ${gradeShort} · ${selectedQuiz.title}`;
  }, [includeOralOption, language, selectedQuiz, selectedQuizId, t.chooseSubjectGradeHint, t.swimOralOption]);

  const activeSubjectLabel =
    browseSubject === 'all' ? t.allSubjectsLabel : getSubjectLabel(browseSubject, language);
  const activeGradeLabel =
    browseGrade === 'all' ? t.allGradesLabel : getGradeLabel(browseGrade, language);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={triggerText}
        className="min-h-[40px] max-w-full sm:max-w-[330px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-sky-400 dark:hover:border-sky-500 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-2 cursor-pointer transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
        <span className="truncate">{triggerText}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-4xl max-h-[88dvh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Dialog Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  {t.chooseSubjectGradeHint}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {activeSubjectLabel}
                  <span aria-hidden="true"> · </span>
                  {activeGradeLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.close}
                className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3-Column Hierarchical Browser */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-[220px_250px_1fr] divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
              {/* Step 1: All Subjects */}
              <div className="p-3.5 space-y-2 md:overflow-y-auto md:max-h-[65dvh]">
                <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t.subjectStepLabel}
                </p>

                {includeOralOption && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectQuiz('oral');
                      setOpen(false);
                    }}
                    className={`w-full min-h-[38px] px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      selectedQuizId === 'oral'
                        ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{t.swimOralOption}</span>
                    </span>
                    {selectedQuizId === 'oral' && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setBrowseSubject('all');
                    setBrowseGrade('all');
                  }}
                  className={`w-full min-h-[38px] px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    browseSubject === 'all'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{t.allSubjectsLabel}</span>
                  <span className="font-mono text-[11px] opacity-70 tabular-nums">
                    {quizzes.length}
                  </span>
                </button>

                <div className="space-y-0.5 pt-1">
                  {SUBJECT_CATALOG.map((subj) => {
                    const active = browseSubject === subj.id;
                    const count = subjectCounts[subj.id] ?? 0;
                    return (
                      <button
                        key={subj.id}
                        type="button"
                        onClick={() => {
                          setBrowseSubject(subj.id);
                          setBrowseGrade('all');
                        }}
                        className={`w-full min-h-[38px] px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          active
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">
                          {language === 'km' ? subj.labelKm : subj.labelEn}
                        </span>
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <span
                            className={`font-mono text-[11px] tabular-nums ${
                              active ? 'text-sky-100' : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {count}
                          </span>
                          <ChevronRight
                            className={`w-3.5 h-3.5 ${
                              active ? 'text-white' : 'text-slate-400'
                            }`}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Grade Levels inside selected Subject */}
              <div className="p-3.5 space-y-3 md:overflow-y-auto md:max-h-[65dvh] bg-slate-50/60 dark:bg-slate-950/30">
                <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>{t.gradeStepLabel}</span>
                </p>

                <button
                  type="button"
                  onClick={() => setBrowseGrade('all')}
                  className={`w-full min-h-[36px] px-3 py-1.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    browseGrade === 'all'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span>{t.allGradesLabel}</span>
                  <span className="font-mono text-[11px] tabular-nums opacity-75">
                    {Object.values(gradeCountsForSubject).reduce((sum, n) => sum + (n ?? 0), 0)}
                  </span>
                </button>

                {GRADE_GROUPS.map((grp) => {
                  const items = GRADE_LEVELS.filter((g) => g.group === grp.id);
                  return (
                    <div key={grp.id} className="space-y-1.5">
                      <p className="px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {language === 'km' ? grp.labelKm : grp.labelEn}
                      </p>
                      <div
                        className={`grid gap-1.5 ${
                          grp.id === 'general' ? 'grid-cols-1' : 'grid-cols-3'
                        }`}
                      >
                        {items.map((g) => {
                          const active = browseGrade === g.id;
                          const count = gradeCountsForSubject[g.id] ?? 0;
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setBrowseGrade(g.id)}
                              className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors tabular-nums ${
                                active
                                  ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                                  : count > 0
                                  ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-sky-400'
                                  : 'border-slate-200/70 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 hover:border-slate-300'
                              }`}
                            >
                              <span>{language === 'km' ? g.shortKm : g.shortEn}</span>
                              {count > 0 && (
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    active ? 'bg-amber-300' : 'bg-sky-500'
                                  }`}
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Step 3: Exercises List + Create for this Subject & Grade */}
              <div className="p-3.5 flex flex-col justify-between gap-3 md:overflow-y-auto md:max-h-[65dvh]">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {t.exerciseStepLabel}
                    </p>
                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {filteredQuizzes.length}
                    </span>
                  </div>

                  {filteredQuizzes.length === 0 ? (
                    <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                      <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
                        {t.noExercisesForFilter}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {activeSubjectLabel} · {activeGradeLabel}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredQuizzes.map((quiz) => {
                        const isSelected = quiz.id === selectedQuizId;
                        const sid = resolveQuizSubjectId(quiz);
                        const gid = resolveQuizGradeId(quiz);
                        return (
                          <div
                            key={quiz.id}
                            className={`rounded-2xl border p-3 flex items-center justify-between gap-2 transition-colors ${
                              isSelected
                                ? 'border-sky-500 bg-sky-50/80 dark:bg-sky-950/40'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onSelectQuiz(quiz.id);
                                setOpen(false);
                              }}
                              className="flex-1 min-w-0 text-left cursor-pointer"
                            >
                              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                {quiz.title}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                                {getSubjectLabel(sid, language)}
                                <span aria-hidden="true"> · </span>
                                {getGradeLabel(gid, language)}
                                <span aria-hidden="true"> · </span>
                                {t.questionsCount(quiz.questions.length)}
                              </p>
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              {onEditQuiz && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpen(false);
                                    onEditQuiz(quiz);
                                  }}
                                  aria-label={t.editQuizBtn}
                                  className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {isSelected && (
                                <span className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                                  <Check className="w-4 h-4" />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {onCreateQuiz && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onCreateQuiz({
                        subjectId: browseSubject === 'all' ? 'math' : browseSubject,
                        gradeId: browseGrade === 'all' ? 'grade_7' : browseGrade,
                      });
                    }}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] hover:from-sky-600 hover:to-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {t.createExerciseForBtn} ({activeSubjectLabel}
                      {browseGrade !== 'all' ? ` · ${getGradeLabel(browseGrade, language, true)}` : ''})
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
