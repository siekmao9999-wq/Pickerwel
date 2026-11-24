'use client';

import React, { useState } from 'react';
import { Plus, Trash2, X, Check, Sigma } from 'lucide-react';
import {
  getSubjectLabel,
  GRADE_GROUPS,
  GRADE_LEVELS,
  resolveQuizGradeId,
  resolveQuizSubjectId,
  SUBJECT_CATALOG,
  type GradeId,
  type OfflineQuiz,
  type QuizQuestion,
  type SubjectId,
} from '@/lib/offline-quizzes';
import { MathText, hasExplicitMathSyntax } from '../MathText';
import {
  StemFormulaEditorModal,
  type FormulaCategoryId,
} from '../forms/StemFormulaEditorModal';
import { COPY, type Language } from '@/lib/i18n';

interface QuizEditorModalProps {
  initialQuiz: OfflineQuiz | null;
  defaultSubjectId?: SubjectId;
  defaultGradeId?: GradeId;
  language: Language;
  onSave: (quiz: OfflineQuiz) => void;
  onClose: () => void;
}

function makeEmptyQuestion(): QuizQuestion {
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    prompt: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    timeLimitSec: 20,
  };
}

export function QuizEditorModal({
  initialQuiz,
  defaultSubjectId,
  defaultGradeId,
  language,
  onSave,
  onClose,
}: QuizEditorModalProps) {
  const t = COPY[language];
  const [title, setTitle] = useState(initialQuiz?.title || '');
  const [subjectId, setSubjectId] = useState<SubjectId>(() =>
    initialQuiz ? resolveQuizSubjectId(initialQuiz) : defaultSubjectId ?? 'math'
  );
  const [gradeId, setGradeId] = useState<GradeId>(() =>
    initialQuiz ? resolveQuizGradeId(initialQuiz) : defaultGradeId ?? 'grade_7'
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    initialQuiz && initialQuiz.questions.length > 0
      ? initialQuiz.questions.map((q) => ({ ...q, options: [...q.options] as [string, string, string, string] }))
      : [makeEmptyQuestion()]
  );
  const [mathTypeTarget, setMathTypeTarget] = useState<{
    qIdx: number;
    optIdx: 0 | 1 | 2 | 3 | null;
  } | null>(null);

  const km = language === 'km';
  const defaultFormulaCategory: FormulaCategoryId =
    subjectId === 'physics'
      ? 'physics'
      : subjectId === 'chemistry'
        ? 'chemistry'
        : 'mathtype';

  const handleInsertFormulaFromMathType = (formattedFormula: string) => {
    if (!mathTypeTarget) return;
    const { qIdx, optIdx } = mathTypeTarget;
    if (optIdx !== null) {
      setQuestions((prev) =>
        prev.map((q, i) => {
          if (i !== qIdx) return q;
          const nextOpts = [...q.options] as [string, string, string, string];
          const curr = nextOpts[optIdx];
          nextOpts[optIdx] = curr.trim()
            ? `${curr} ${formattedFormula}`
            : formattedFormula;
          return { ...q, options: nextOpts };
        })
      );
      return;
    }

    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const spacer = q.prompt && !q.prompt.endsWith(' ') ? ' ' : '';
        return { ...q, prompt: `${q.prompt}${spacer}${formattedFormula}` };
      })
    );
  };

  const handleUpdateQuestion = (idx: number, patch: Partial<QuizQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q))
    );
  };

  const handleUpdateOption = (qIdx: number, optIdx: 0 | 1 | 2 | 3, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const nextOpts = [...q.options] as [string, string, string, string];
        nextOpts[optIdx] = value;
        return { ...q, options: nextOpts };
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedQuestions = questions
      .filter((q) => q.prompt.trim().length > 0)
      .map((q) => ({
        ...q,
        prompt: q.prompt.trim(),
        options: q.options.map((opt, idx) => opt.trim() || `Option ${idx + 1}`) as [
          string,
          string,
          string,
          string,
        ],
        timeLimitSec: Math.min(60, Math.max(5, Number(q.timeLimitSec) || 20)),
      }));

    if (cleanedQuestions.length === 0) return;

    onSave({
      id: initialQuiz?.id || `quiz_${Date.now()}`,
      title: title.trim() || (language === 'km' ? 'លំហាត់ថ្មី' : 'Custom Quiz'),
      subject: getSubjectLabel(subjectId, language),
      subjectId,
      gradeId,
      questions: cleanedQuestions,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl max-h-[88vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {initialQuiz ? t.editQuizBtn : t.createQuizBtn}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t.quizTitleLabel}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.quizTitleLabel}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t.quizSubjectLabel}
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value as SubjectId)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              >
                {SUBJECT_CATALOG.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {language === 'km' ? subj.labelKm : subj.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t.quizGradeLabel}
              </label>
              <select
                value={gradeId}
                onChange={(e) => setGradeId(e.target.value as GradeId)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              >
                {GRADE_GROUPS.map((grp) => (
                  <optgroup
                    key={grp.id}
                    label={language === 'km' ? grp.labelKm : grp.labelEn}
                  >
                    {GRADE_LEVELS.filter((g) => g.group === grp.id).map((g) => (
                      <option key={g.id} value={g.id}>
                        {language === 'km' ? g.labelKm : g.labelEn}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <div
                key={q.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                    {t.questionPromptLabel} #{qIdx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400">
                      {t.timeLimitLabel}
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={q.timeLimitSec}
                      onChange={(e) =>
                        handleUpdateQuestion(qIdx, { timeLimitSec: Number(e.target.value) })
                      }
                      className="w-16 h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums"
                    />
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setQuestions((prev) => prev.filter((_, i) => i !== qIdx))
                        }
                        aria-label={t.deleteQuizBtn}
                        className="min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={q.prompt}
                    onChange={(e) => handleUpdateQuestion(qIdx, { prompt: e.target.value })}
                    placeholder={t.questionPromptLabel}
                    className="flex-1 h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setMathTypeTarget({ qIdx, optIdx: null })}
                    title={km ? 'បើក MathType សរសេររូបមន្ត គណិត•រូប•គីមី' : 'Open MathType Equation Editor'}
                    className="min-h-[40px] px-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Sigma className="w-4 h-4" />
                    <span>MathType</span>
                  </button>
                </div>

                {q.prompt.trim().length > 0 && (
                  <div className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700/80 text-xs sm:text-sm text-slate-800 dark:text-slate-100 overflow-x-auto">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mr-2">
                      {t.mathPreviewLabel}
                    </span>
                    <MathText text={q.prompt} />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([0, 1, 2, 3] as const).map((optIdx) => {
                    const isCorrect = q.correctIndex === optIdx;
                    const optVal = q.options[optIdx];
                    return (
                      <div key={optIdx} className="space-y-1">
                        <div
                          className={`flex items-center gap-1.5 p-1.5 rounded-xl border ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleUpdateQuestion(qIdx, { correctIndex: optIdx })}
                            aria-label={`${t.correctAnswerLabel} ${optIdx + 1}`}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="text"
                            value={optVal}
                            onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                            placeholder={`Option ${optIdx + 1}`}
                            className="flex-1 min-w-0 bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none py-1"
                          />
                          <button
                            type="button"
                            onClick={() => setMathTypeTarget({ qIdx, optIdx })}
                            title={km ? 'បញ្ចូលរូបមន្ត MathType ក្នុងជម្រើសនេះ' : 'Insert MathType formula'}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 shrink-0 cursor-pointer"
                          >
                            <Sigma className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {hasExplicitMathSyntax(optVal) && (
                          <div className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-800 dark:text-slate-100 overflow-x-auto">
                            <MathText text={optVal} explicitOnly />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setQuestions((prev) => [...prev, makeEmptyQuestion()])}
            className="w-full min-h-[42px] rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addQuestionBtn}</span>
          </button>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {t.cancelBtn}
          </button>
          <button
            type="submit"
            className="min-h-[42px] px-5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] text-white text-xs font-semibold cursor-pointer"
          >
            {t.saveQuizBtn}
          </button>
        </div>
      </form>

      <StemFormulaEditorModal
        open={mathTypeTarget !== null}
        language={language}
        accentColor="#3B82F6"
        defaultCategory={defaultFormulaCategory}
        targetLabel={
          !mathTypeTarget
            ? undefined
            : mathTypeTarget.optIdx !== null
              ? km
                ? `សំណួរ #${mathTypeTarget.qIdx + 1} · ជម្រើសទី ${mathTypeTarget.optIdx + 1}`
                : `Question #${mathTypeTarget.qIdx + 1} · Option ${mathTypeTarget.optIdx + 1}`
              : km
                ? `សំណួរ #${mathTypeTarget.qIdx + 1}`
                : `Question #${mathTypeTarget.qIdx + 1}`
        }
        onClose={() => setMathTypeTarget(null)}
        onInsert={handleInsertFormulaFromMathType}
      />
    </div>
  );
}
