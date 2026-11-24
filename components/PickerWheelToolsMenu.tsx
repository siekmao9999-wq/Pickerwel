'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Hammer,
  ChevronDown,
  Disc3,
  Users,
  MessageSquareQuote,
  Hash,
  CaseSensitive,
  Globe2,
  MapPin,
  Palette,
  Image as ImageIcon,
  CalendarDays,
  MessageCircleHeart,
  CircleDot,
  Trophy,
  Shield,
  Flag,
  HelpCircle,
  Search,
  X,
  Check,
} from 'lucide-react';
import {
  WHEEL_TOOLS_CATALOG,
  type WheelToolId,
  type WheelToolMeta,
} from '@/lib/wheel-tools';
import type { Language } from '@/lib/i18n';
import { COPY } from '@/lib/i18n';

export function ToolIcon({
  toolId,
  className,
}: {
  toolId: WheelToolId;
  className?: string;
}) {
  switch (toolId) {
    case 'picker':
      return <Disc3 className={className} />;
    case 'team':
      return <Users className={className} />;
    case 'yes_no':
      return <MessageSquareQuote className={className} />;
    case 'number':
      return <Hash className={className} />;
    case 'letter':
      return <CaseSensitive className={className} />;
    case 'country':
      return <Globe2 className={className} />;
    case 'state':
      return <MapPin className={className} />;
    case 'color':
      return <Palette className={className} />;
    case 'image':
      return <ImageIcon className={className} />;
    case 'date':
      return <CalendarDays className={className} />;
    case 'instagram':
      return <MessageCircleHeart className={className} />;
    case 'mlb':
      return <CircleDot className={className} />;
    case 'nba':
      return <Trophy className={className} />;
    case 'nfl':
      return <Shield className={className} />;
    case 'flag_quiz':
      return <Flag className={className} />;
    case 'truth_dare':
      return <HelpCircle className={className} />;
  }
}

interface PickerWheelToolsMenuProps {
  activeTool: WheelToolId;
  language: Language;
  onSelectTool: (toolId: WheelToolId) => void;
}

export function PickerWheelToolsMenu({
  activeTool,
  language,
  onSelectTool,
}: PickerWheelToolsMenuProps) {
  const t = COPY[language];
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [allToolsOpen, setAllToolsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | WheelToolMeta['category']
  >('all');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    if (!allToolsOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAllToolsOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [allToolsOpen]);

  const col1 = useMemo(
    () => WHEEL_TOOLS_CATALOG.filter((item) => item.column === 1),
    []
  );
  const col2 = useMemo(
    () => WHEEL_TOOLS_CATALOG.filter((item) => item.column === 2),
    []
  );
  const col3 = useMemo(
    () => WHEEL_TOOLS_CATALOG.filter((item) => item.column === 3),
    []
  );

  const filteredModalTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return WHEEL_TOOLS_CATALOG.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.nameEn.toLowerCase().includes(q) ||
        item.nameKm.toLowerCase().includes(q) ||
        item.descEn.toLowerCase().includes(q) ||
        item.descKm.toLowerCase().includes(q)
      );
    });
  }, [categoryFilter, searchQuery]);

  const activeToolMeta = useMemo(
    () => WHEEL_TOOLS_CATALOG.find((item) => item.id === activeTool),
    [activeTool]
  );

  const handleChoose = (toolId: WheelToolId) => {
    setDropdownOpen(false);
    setAllToolsOpen(false);
    onSelectTool(toolId);
  };

  const renderColumnList = (items: WheelToolMeta[]) => (
    <div className="space-y-1">
      {items.map((tool) => {
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => handleChoose(tool.id)}
            className={`w-full min-h-[44px] px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
              isActive
                ? 'bg-lime-50 dark:bg-lime-950/50 text-slate-900 dark:text-white ring-1 ring-lime-500/40'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/90 dark:hover:bg-slate-800/80'
            }`}
          >
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tool.accentClass}`}
            >
              <ToolIcon toolId={tool.id} className="w-4 h-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
                {language === 'km' ? tool.nameKm : tool.nameEn}
              </span>
            </span>
            {isActive && (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );

  const categories: { id: 'all' | WheelToolMeta['category']; labelKm: string; labelEn: string }[] = [
    { id: 'all', labelKm: 'ទាំងអស់ (១៦)', labelEn: 'All (16)' },
    { id: 'core', labelKm: 'សំខាន់ៗ', labelEn: 'Core' },
    { id: 'generators', labelKm: 'លេខ/អក្សរ/ពណ៌', labelEn: 'Generators' },
    { id: 'geo', labelKm: 'ភូមិសាស្ត្រ', labelEn: 'Geography' },
    { id: 'sports', labelKm: 'កីឡា', labelEn: 'Sports' },
    { id: 'fun', labelKm: 'ល្បែងកម្សាន្ត', labelEn: 'Fun & Social' },
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
        title={t.toolsMenuBtn}
        className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
          dropdownOpen || activeTool !== 'picker'
            ? 'border-lime-500 bg-lime-100/90 dark:bg-lime-950/60 text-lime-900 dark:text-lime-200'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <Hammer className="w-4 h-4 shrink-0 text-lime-700 dark:text-lime-400" />
        <span>
          {activeTool !== 'picker' && activeToolMeta
            ? language === 'km'
              ? activeToolMeta.nameKm.split('(')[0].trim()
              : activeToolMeta.nameEn.replace(' Picker Wheel', '')
            : t.toolsMenuBtn}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${
            dropdownOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 3-Column Tools Dropdown Menu (Matching Screenshot) */}
      {dropdownOpen && (
        <div
          role="menu"
          className="fixed md:absolute left-3 right-3 md:left-auto md:right-0 top-[72px] md:top-[calc(100%+8px)] z-50 md:w-[740px] lg:w-[780px] max-w-[calc(100vw-1.5rem)] max-h-[82dvh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 md:hidden">
            <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {t.toolsMenuBtn} (16)
            </span>
            <button
              type="button"
              onClick={() => setDropdownOpen(false)}
              aria-label={t.close}
              className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
            {renderColumnList(col1)}
            {renderColumnList(col2)}
            {renderColumnList(col3)}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                setAllToolsOpen(true);
              }}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
            >
              {t.allToolsBtn}
            </button>
          </div>
        </div>
      )}

      {/* Full Searchable All Tools Modal */}
      {allToolsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAllToolsOpen(false);
          }}
        >
          <div className="w-full max-w-4xl max-h-[88dvh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {t.allToolsModalTitle}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.allToolsModalDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAllToolsOpen(false)}
                aria-label={t.close}
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.allToolsSearchPlaceholder}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {categories.map((cat) => {
                  const selected = categoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        selected
                          ? 'bg-[#3B82F6] text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {language === 'km' ? cat.labelKm : cat.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredModalTools.map((tool) => {
                  const isActive = activeTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => handleChoose(tool.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                        isActive
                          ? 'border-lime-500 bg-lime-50/70 dark:bg-lime-950/40 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <span
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tool.accentClass}`}
                      >
                        <ToolIcon toolId={tool.id} className="w-5 h-5" />
                      </span>
                      <span className="block min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-1.5">
                          <span className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                            {language === 'km' ? tool.nameKm : tool.nameEn}
                          </span>
                          {isActive && (
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          )}
                        </span>
                        <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {language === 'km' ? tool.descKm : tool.descEn}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
