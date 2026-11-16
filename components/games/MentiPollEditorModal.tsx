'use client';

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  X,
  Check,
  BarChart3,
  Cloud,
  SlidersHorizontal,
  MessageSquareText,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type {
  MentiPollDeck,
  MentiSlide,
  MentiSlideType,
} from '@/lib/offline-polls';
import { COPY, type Language } from '@/lib/i18n';

interface MentiPollEditorModalProps {
  initialDeck: MentiPollDeck | null;
  language: Language;
  onSave: (deck: MentiPollDeck) => void;
  onClose: () => void;
}

function createSlide(type: MentiSlideType = 'multiple_choice'): MentiSlide {
  const uid = `slide_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id: uid,
    type,
    question: '',
    subtitle: '',
    hideResults: false,
    options: [
      { id: `${uid}_o1`, label: '', votes: 0 },
      { id: `${uid}_o2`, label: '', votes: 0 },
      { id: `${uid}_o3`, label: '', votes: 0 },
    ],
    words: [],
    scaleCounts: [0, 0, 0, 0, 0],
    scaleMinLabel: '',
    scaleMaxLabel: '',
    openEntries: [],
  };
}

export function MentiPollEditorModal({
  initialDeck,
  language,
  onSave,
  onClose,
}: MentiPollEditorModalProps) {
  const t = COPY[language];

  const [title, setTitle] = useState(initialDeck?.title || '');
  const [category, setCategory] = useState(
    initialDeck?.category || (language === 'km' ? 'ថ្នាក់រៀន' : 'Classroom')
  );
  const [slides, setSlides] = useState<MentiSlide[]>(
    initialDeck && initialDeck.slides.length > 0
      ? initialDeck.slides.map((s) => ({
          ...s,
          options: s.options
            ? s.options.map((o) => ({ ...o }))
            : [
                { id: `${s.id}_o1`, label: '', votes: 0 },
                { id: `${s.id}_o2`, label: '', votes: 0 },
              ],
          words: s.words ? s.words.map((w) => ({ ...w })) : [],
          scaleCounts: s.scaleCounts
            ? ([...s.scaleCounts] as [number, number, number, number, number])
            : [0, 0, 0, 0, 0],
          openEntries: s.openEntries ? s.openEntries.map((e) => ({ ...e })) : [],
        }))
      : [createSlide('multiple_choice')]
  );

  const slideTypes: {
    id: MentiSlideType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'multiple_choice', label: t.mentiTypeMultipleChoice, icon: BarChart3 },
    { id: 'word_cloud', label: t.mentiTypeWordCloud, icon: Cloud },
    { id: 'scales', label: t.mentiTypeScales, icon: SlidersHorizontal },
    { id: 'open_ended', label: t.mentiTypeOpenEnded, icon: MessageSquareText },
  ];

  const updateSlide = (idx: number, patch: Partial<MentiSlide>) => {
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const updateOptionLabel = (slideIdx: number, optIdx: number, value: string) => {
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== slideIdx) return s;
        const opts = [...(s.options || [])];
        opts[optIdx] = { ...opts[optIdx], label: value };
        return { ...s, options: opts };
      })
    );
  };

  const addOption = (slideIdx: number) => {
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== slideIdx) return s;
        const opts = [...(s.options || [])];
        if (opts.length >= 6) return s;
        opts.push({
          id: `${s.id}_o_${Date.now()}_${opts.length}`,
          label: '',
          votes: 0,
        });
        return { ...s, options: opts };
      })
    );
  };

  const removeOption = (slideIdx: number, optIdx: number) => {
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== slideIdx) return s;
        const opts = [...(s.options || [])];
        if (opts.length <= 2) return s;
        opts.splice(optIdx, 1);
        return { ...s, options: opts };
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedSlides: MentiSlide[] = slides
      .filter((s) => s.question.trim().length > 0)
      .map((s) => {
        const cleanedOptions =
          s.type === 'multiple_choice'
            ? (s.options || [])
                .map((opt, idx) => ({
                  ...opt,
                  label:
                    opt.label.trim() ||
                    (language === 'km' ? `ជម្រើសទី ${idx + 1}` : `Choice ${idx + 1}`),
                }))
                .slice(0, 6)
            : s.options;

        return {
          ...s,
          question: s.question.trim(),
          subtitle: s.subtitle?.trim() || undefined,
          options:
            s.type === 'multiple_choice'
              ? cleanedOptions && cleanedOptions.length >= 2
                ? cleanedOptions
                : [
                    {
                      id: `${s.id}_o1`,
                      label: language === 'km' ? 'បាទ / ចាស' : 'Yes',
                      votes: 0,
                    },
                    {
                      id: `${s.id}_o2`,
                      label: language === 'km' ? 'ទេ' : 'No',
                      votes: 0,
                    },
                  ]
              : undefined,
          words: s.type === 'word_cloud' ? s.words || [] : undefined,
          scaleCounts:
            s.type === 'scales' ? s.scaleCounts || [0, 0, 0, 0, 0] : undefined,
          scaleMinLabel:
            s.type === 'scales'
              ? s.scaleMinLabel?.trim() || (language === 'km' ? 'ទាប' : 'Low')
              : undefined,
          scaleMaxLabel:
            s.type === 'scales'
              ? s.scaleMaxLabel?.trim() || (language === 'km' ? 'ខ្ពស់' : 'High')
              : undefined,
          openEntries: s.type === 'open_ended' ? s.openEntries || [] : undefined,
        };
      });

    if (cleanedSlides.length === 0) return;

    const code =
      initialDeck?.sessionCode ||
      String(Math.floor(1000 + Math.random() * 9000));

    onSave({
      id: initialDeck?.id || `menti_${Date.now()}`,
      title:
        title.trim() ||
        (language === 'km' ? 'ការស្ទុងមតិថ្មី' : 'Custom Poll'),
      category:
        category.trim() || (language === 'km' ? 'ទូទៅ' : 'General'),
      sessionCode: code,
      slides: cleanedSlides,
      updatedAt: Date.now(),
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
        className="w-full max-w-3xl max-h-[90vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {initialDeck ? t.mentiEditPollBtn : t.mentiNewPollBtn}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t.mentiDeckTitleLabel}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  language === 'km'
                    ? 'ឧ. ស្ទុងមតិមេរៀនថ្ងៃនេះ...'
                    : 'e.g. Lesson Check-In Poll'
                }
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t.mentiDeckCategoryLabel}
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={language === 'km' ? 'ថ្នាក់រៀន / ក្រុម' : 'Classroom / Team'}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          <div className="space-y-4">
            {slides.map((slide, sIdx) => (
              <div
                key={slide.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#3B82F6] dark:text-blue-400 tabular-nums">
                    {t.mentiSlideLabel} {sIdx + 1}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={sIdx === 0}
                      onClick={() => moveSlide(sIdx, -1)}
                      aria-label="Move slide up"
                      className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={sIdx === slides.length - 1}
                      onClick={() => moveSlide(sIdx, 1)}
                      aria-label="Move slide down"
                      className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    {slides.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSlides((prev) => prev.filter((_, i) => i !== sIdx))
                        }
                        aria-label="Delete slide"
                        className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Slide Type Picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    {t.mentiQuestionTypeLabel}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {slideTypes.map((st) => {
                      const Icon = st.icon;
                      const active = slide.type === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => updateSlide(sIdx, { type: st.id })}
                          className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'border-[#3B82F6] bg-blue-50 dark:bg-blue-950/50 text-[#3B82F6] dark:text-blue-400'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question Prompt & Subtitle */}
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    required
                    value={slide.question}
                    onChange={(e) =>
                      updateSlide(sIdx, { question: e.target.value })
                    }
                    placeholder={
                      language === 'km'
                        ? 'សរសេរសំណួរស្ទុងមតិ...'
                        : 'Enter your poll question...'
                    }
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <input
                    type="text"
                    value={slide.subtitle || ''}
                    onChange={(e) =>
                      updateSlide(sIdx, { subtitle: e.target.value })
                    }
                    placeholder={t.mentiSubtitleLabel}
                    className="w-full min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                {/* Multiple Choice Options */}
                {slide.type === 'multiple_choice' && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t.mentiOptionsLabel}
                      </span>
                      {(slide.options || []).length < 6 && (
                        <button
                          type="button"
                          onClick={() => addOption(sIdx)}
                          className="text-xs font-semibold text-[#3B82F6] dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.mentiAddOptionBtn}</span>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(slide.options || []).map((opt, oIdx) => (
                        <div key={opt.id} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) =>
                              updateOptionLabel(sIdx, oIdx, e.target.value)
                            }
                            placeholder={
                              language === 'km'
                                ? `ជម្រើសទី ${oIdx + 1}`
                                : `Option ${oIdx + 1}`
                            }
                            className="flex-1 min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                          />
                          {(slide.options || []).length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(sIdx, oIdx)}
                              aria-label="Remove choice"
                              className="min-h-[38px] min-w-[34px] rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scales Labels */}
                {slide.type === 'scales' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {t.mentiMinLabel}
                      </label>
                      <input
                        type="text"
                        value={slide.scaleMinLabel || ''}
                        onChange={(e) =>
                          updateSlide(sIdx, { scaleMinLabel: e.target.value })
                        }
                        placeholder={language === 'km' ? 'មិនសូវយល់' : 'Strongly Disagree'}
                        className="w-full min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {t.mentiMaxLabel}
                      </label>
                      <input
                        type="text"
                        value={slide.scaleMaxLabel || ''}
                        onChange={(e) =>
                          updateSlide(sIdx, { scaleMaxLabel: e.target.value })
                        }
                        placeholder={language === 'km' ? 'យល់ច្បាស់ ១០០%' : 'Strongly Agree'}
                        className="w-full min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setSlides((prev) => [...prev, createSlide('multiple_choice')])
            }
            className="w-full min-h-[44px] rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#3B82F6] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.mentiAddSlideBtn}</span>
          </button>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            {t.cancelBtn}
          </button>
          <button
            type="submit"
            className="min-h-[42px] px-5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{t.mentiSavePollBtn}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
