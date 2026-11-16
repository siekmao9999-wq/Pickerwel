'use client';

import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { MiniWheelPreview } from './MiniWheelPreview';
import { WHEEL_TEMPLATES } from '@/lib/templates';
import { COPY } from '@/lib/i18n';

export function TemplatesView() {
  const { settings, applyTemplate } = usePickerwel();
  const t = COPY[settings.language];
  const isKm = settings.language === 'km';
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: t.allCategories },
    { id: 'Classroom', label: isKm ? 'ថ្នាក់រៀន' : 'Classroom' },
    { id: 'Workplace', label: isKm ? 'ការងារ' : 'Workplace' },
    { id: 'Everyday', label: isKm ? 'ប្រចាំថ្ងៃ' : 'Everyday' },
  ];

  const visibleTemplates =
    selectedCategory === 'all'
      ? WHEEL_TEMPLATES
      : WHEEL_TEMPLATES.filter((tmpl) => tmpl.categoryEn === selectedCategory);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {t.templatesTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t.templatesDesc}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleTemplates.map((tmpl) => {
            const title = isKm ? tmpl.titleKm : tmpl.titleEn;
            const category = isKm ? tmpl.categoryKm : tmpl.categoryEn;
            const desc = isKm ? tmpl.descriptionKm : tmpl.descriptionEn;

            return (
              <div
                key={tmpl.id}
                className="flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-start gap-4">
                    <MiniWheelPreview
                      entriesCount={tmpl.entries.length}
                      paletteId={tmpl.paletteId}
                      size={56}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {category}
                        <span aria-hidden="true"> · </span>
                        {t.entriesCount(tmpl.entries.length)}
                      </p>
                      <h2 className="mt-1 font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                        {title}
                      </h2>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {desc}
                  </p>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 truncate">
                    {tmpl.entries.slice(0, 4).join(' · ')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => applyTemplate(tmpl)}
                  className="mt-5 w-full min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-[#3B82F6] hover:bg-slate-800 dark:hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>{t.useTemplate}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
