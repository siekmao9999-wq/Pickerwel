'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  RotateCcw,
  Check,
  Copy,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Shuffle,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  WHEEL_TOOLS_CATALOG,
  WORLD_COUNTRIES,
  CAMBODIA_PROVINCES,
  US_STATES,
  NAMED_COLORS,
  ENGLISH_LETTERS,
  ENGLISH_VOWELS,
  ENGLISH_CONSONANTS,
  KHMER_CONSONANTS,
  NBA_TEAMS,
  NFL_TEAMS,
  MLB_TEAMS,
  TRUTH_PROMPTS,
  DARE_PROMPTS,
  STARTER_IMAGE_ITEMS,
  SAMPLE_INSTAGRAM_COMMENTS,
  buildYesNoEntries,
  buildNumberEntries,
  buildDateEntries,
  parseInstagramComments,
  findCountryByFlagEntry,
  findColorByEntry,
  type WheelToolId,
  type ImageWheelItem,
  type ParsedInstagramComment,
} from '@/lib/wheel-tools';
import type { Language } from '@/lib/i18n';
import { ToolIcon } from './PickerWheelToolsMenu';

export interface ActiveToolExtras {
  winnerImageItem?: ImageWheelItem | null;
  winnerColorHex?: string | null;
  winnerSubNote?: string | null;
}

interface PickerWheelToolDeckProps {
  activeTool: WheelToolId;
  language: Language;
  lastWinner: string | null;
  spinNonce: number;
  imageItems: ImageWheelItem[];
  onChangeImageItems: (items: ImageWheelItem[]) => void;
  instagramParsed: ParsedInstagramComment[];
  onChangeInstagramParsed: (items: ParsedInstagramComment[]) => void;
  onApplyEntries: (title: string, entries: string[]) => void;
  onResetToStandardWheel: () => void;
  onOpenFullTeams: () => void;
}

function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function getPlusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function PickerWheelToolDeck({
  activeTool,
  language,
  lastWinner,
  spinNonce,
  imageItems,
  onChangeImageItems,
  instagramParsed,
  onChangeInstagramParsed,
  onApplyEntries,
  onResetToStandardWheel,
  onOpenFullTeams,
}: PickerWheelToolDeckProps) {
  const km = language === 'km';
  const toolMeta = useMemo(
    () => WHEEL_TOOLS_CATALOG.find((t) => t.id === activeTool),
    [activeTool]
  );

  // Yes/No state
  const [yesNoMode, setYesNoMode] = useState<'yes_no' | 'yes_no_maybe'>('yes_no');
  const [yesNoRepeats, setYesNoRepeats] = useState(3);
  const [yesNoTally, setYesNoTally] = useState({ yes: 0, no: 0, maybe: 0 });
  const lastCountedNonceRef = useRef(0);

  // Number state
  const [numMin, setNumMin] = useState(1);
  const [numMax, setNumMax] = useState(30);
  const [numStep, setNumStep] = useState(1);
  const [numExclude, setNumExclude] = useState('');

  // Letter state
  const [letterSet, setLetterSet] = useState<'en_all' | 'en_vowels' | 'en_consonants' | 'km_consonants'>('en_all');

  // Country & Flag Quiz state
  const [continent, setContinent] = useState<'All' | 'Asia' | 'Europe' | 'Americas' | 'Africa' | 'Oceania'>('All');
  const [revealedNonce, setRevealedNonce] = useState(0);
  const [flagScore, setFlagScore] = useState({ correct: 0, total: 0 });
  const [scoredNonce, setScoredNonce] = useState(0);

  // State/Province state
  const [stateRegion, setStateRegion] = useState<'kh' | 'us'>('kh');

  // Color state
  const [colorGroup, setColorGroup] = useState<'all' | 'vibrant' | 'pastel' | 'earth'>('all');
  const [copiedHex, setCopiedHex] = useState(false);

  // Image picker state
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Date state (hydrated client-side to avoid UTC vs local-timezone SSR mismatch)
  const [dateMode, setDateMode] = useState<'range' | 'weekdays' | 'months'>('range');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Instagram comment state
  const [igRawText, setIgRawText] = useState(SAMPLE_INSTAGRAM_COMMENTS);
  const [igDedupe, setIgDedupe] = useState(true);
  const [igKeyword, setIgKeyword] = useState('');

  // Sports league filter
  const [sportsFilter, setSportsFilter] = useState<'All' | 'A' | 'B'>('All');

  // Truth or Dare mode
  const [tdMode, setTdMode] = useState<'mixed' | 'truth' | 'dare'>('mixed');

  // Track Yes/No tally cleanly during render? No — compute derived or handle via button/effect-free helper:
  // Actually let's compute tally cleanly when spinNonce increments via a small callback or microtask inside effect ONLY when spinNonce changes.
  React.useEffect(() => {
    if (activeTool !== 'yes_no' || !lastWinner || spinNonce === 0) return;
    if (lastCountedNonceRef.current === spinNonce) return;
    lastCountedNonceRef.current = spinNonce;
    const upper = lastWinner.toUpperCase();
    queueMicrotask(() => {
      setYesNoTally((prev) => {
        if (upper.includes('YES') || lastWinner.includes('បាទ')) {
          return { ...prev, yes: prev.yes + 1 };
        }
        if (upper.includes('MAYBE') || lastWinner.includes('ប្រហែល')) {
          return { ...prev, maybe: prev.maybe + 1 };
        }
        return { ...prev, no: prev.no + 1 };
      });
    });
  }, [activeTool, lastWinner, spinNonce]);

  React.useEffect(() => {
    queueMicrotask(() => {
      setStartDate((prev) => prev || getTodayIso());
      setEndDate((prev) => prev || getPlusDaysIso(14));
    });
  }, []);

  if (activeTool === 'picker' || !toolMeta) return null;

  const applyYesNo = (mode: 'yes_no' | 'yes_no_maybe', reps: number) => {
    setYesNoMode(mode);
    setYesNoRepeats(reps);
    onApplyEntries(
      km ? 'កងវិល បាទ/ចាស ឬ ទេ' : 'Yes No Picker Wheel',
      buildYesNoEntries(mode, reps, language)
    );
  };

  const applyNumbers = (min: number, max: number, step: number, exclude: string) => {
    setNumMin(min);
    setNumMax(max);
    setNumStep(step);
    setNumExclude(exclude);
    const entries = buildNumberEntries(min, max, step, exclude);
    onApplyEntries(
      km ? `ចាប់លេខ (${min}–${max})` : `Number Picker (${min}–${max})`,
      entries
    );
  };

  const applyLetters = (mode: 'en_all' | 'en_vowels' | 'en_consonants' | 'km_consonants') => {
    setLetterSet(mode);
    const map = {
      en_all: { title: km ? 'អក្សរអង់គ្លេស A–Z' : 'English Letters A–Z', list: ENGLISH_LETTERS },
      en_vowels: { title: km ? 'ស្រៈអង់គ្លេស (A-U)' : 'English Vowels', list: ENGLISH_VOWELS },
      en_consonants: { title: km ? 'ព្យញ្ជនៈអង់គ្លេស' : 'English Consonants', list: ENGLISH_CONSONANTS },
      km_consonants: { title: km ? 'ព្យញ្ជនៈខ្មែរ (ក–អ)' : 'Khmer Consonants (ក–អ)', list: KHMER_CONSONANTS },
    };
    const chosen = map[mode];
    onApplyEntries(chosen.title, chosen.list);
  };

  const applyCountries = (
    nextContinent: 'All' | 'Asia' | 'Europe' | 'Americas' | 'Africa' | 'Oceania',
    flagsOnly: boolean
  ) => {
    setContinent(nextContinent);
    const pool =
      nextContinent === 'All'
        ? WORLD_COUNTRIES
        : WORLD_COUNTRIES.filter((c) => c.continent === nextContinent);
    const entries = flagsOnly
      ? pool.map((c) => c.flag)
      : pool.map((c) => `${c.flag} ${km ? c.nameKm : c.nameEn}`);
    const title = flagsOnly
      ? km
        ? 'ល្បែងទាយទង់ជាតិ (Flag Quiz)'
        : 'Flag Quiz Picker Wheel'
      : km
        ? 'ចាប់ឈ្មោះប្រទេស (Country Picker)'
        : 'Country Picker Wheel';
    onApplyEntries(title, entries);
  };

  const applyStates = (region: 'kh' | 'us') => {
    setStateRegion(region);
    if (region === 'kh') {
      onApplyEntries(
        km ? 'រាជធានី-ខេត្តកម្ពុជា ទាំង ២៥' : 'Cambodia 25 Provinces & Capital',
        CAMBODIA_PROVINCES.map((p) => (km ? p.km : p.en))
      );
    } else {
      onApplyEntries(
        km ? 'រដ្ឋអាមេរិក ទាំង ៥០ (US States)' : 'US 50 States Picker',
        US_STATES
      );
    }
  };

  const applyColors = (group: 'all' | 'vibrant' | 'pastel' | 'earth') => {
    setColorGroup(group);
    const pool =
      group === 'all' ? NAMED_COLORS : NAMED_COLORS.filter((c) => c.group === group);
    onApplyEntries(
      km ? 'ចាប់ពណ៌ (Color Picker)' : 'Color Picker Wheel',
      pool.map((c) => `${km ? c.nameKm : c.nameEn} ${c.hex}`)
    );
  };

  const handleUploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: ImageWheelItem[] = [];
    const slice = Array.from(files).slice(0, 12);
    for (const file of slice) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Read failed'));
        reader.readAsDataURL(file);
      }).catch(() => '');
      if (!dataUrl) continue;
      const cleanName = file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'Photo';
      added.push({
        id: `up_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: cleanName,
        imageUrl: dataUrl,
        bgColor: '#F1F5F9',
      });
    }
    if (added.length > 0) {
      // Replace starter emoji cards if user uploads real photos for the first time
      const base = imageItems.every((it) => !it.imageUrl) ? [] : imageItems;
      const next = [...base, ...added].slice(0, 24);
      onChangeImageItems(next);
      onApplyEntries(
        km ? 'ចាប់រូបភាព (Image Picker)' : 'Image Picker Wheel',
        next.map((it) => it.label)
      );
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImageItem = (id: string) => {
    const next = imageItems.filter((it) => it.id !== id);
    const safeNext = next.length >= 2 ? next : STARTER_IMAGE_ITEMS;
    onChangeImageItems(safeNext);
    onApplyEntries(
      km ? 'ចាប់រូបភាព (Image Picker)' : 'Image Picker Wheel',
      safeNext.map((it) => it.label)
    );
  };

  const applyDates = (mode: 'range' | 'weekdays' | 'months', s: string, e: string) => {
    const safeStart = s || getTodayIso();
    const safeEnd = e || getPlusDaysIso(14);
    setDateMode(mode);
    setStartDate(safeStart);
    setEndDate(safeEnd);
    onApplyEntries(
      km ? 'ចាប់កាលបរិច្ឆេទ (Date Picker)' : 'Date Picker Wheel',
      buildDateEntries(mode, safeStart, safeEnd, language)
    );
  };

  const applyInstagram = (raw: string, dedupe: boolean, kw: string) => {
    setIgRawText(raw);
    setIgDedupe(dedupe);
    setIgKeyword(kw);
    const parsed = parseInstagramComments(raw, dedupe, kw);
    onChangeInstagramParsed(parsed);
    if (parsed.length >= 2) {
      onApplyEntries(
        km ? 'ចាប់អ្នក Comment (Instagram)' : 'Instagram Comment Picker',
        parsed.map((p) => p.entryLabel)
      );
    }
  };

  const applySports = (league: 'mlb' | 'nba' | 'nfl', filter: 'All' | 'A' | 'B') => {
    setSportsFilter(filter);
    const config =
      league === 'mlb'
        ? { list: MLB_TEAMS, a: 'AL', b: 'NL', titleEn: 'MLB Picker Wheel', titleKm: 'ក្រុម MLB' }
        : league === 'nba'
          ? { list: NBA_TEAMS, a: 'East', b: 'West', titleEn: 'NBA Picker Wheel', titleKm: 'ក្រុម NBA' }
          : { list: NFL_TEAMS, a: 'AFC', b: 'NFC', titleEn: 'NFL Picker Wheel', titleKm: 'ក្រុម NFL' };
    const filtered =
      filter === 'All'
        ? config.list
        : config.list.filter((t) => t.conference === (filter === 'A' ? config.a : config.b));
    onApplyEntries(
      km ? config.titleKm : config.titleEn,
      filtered.map((t) => t.name)
    );
  };

  const applyTruthOrDare = (mode: 'mixed' | 'truth' | 'dare', shuffle = false) => {
    setTdMode(mode);
    const truths = TRUTH_PROMPTS.map((p) => (km ? p.km : p.en));
    const dares = DARE_PROMPTS.map((p) => (km ? p.km : p.en));
    let pool =
      mode === 'truth'
        ? truths
        : mode === 'dare'
          ? dares
          : truths.flatMap((tr, idx) => (dares[idx] ? [tr, dares[idx]] : [tr]));
    if (shuffle) {
      pool = [...pool].sort(() => Math.random() - 0.5);
    }
    onApplyEntries(
      km ? 'ការពិត ឬ ហ៊ានធ្វើ (Truth or Dare)' : 'Truth or Dare Picker Wheel',
      pool
    );
  };

  const winningColor = activeTool === 'color' && lastWinner ? findColorByEntry(lastWinner) : undefined;
  const winningFlagCountry =
    activeTool === 'flag_quiz' && lastWinner ? findCountryByFlagEntry(lastWinner) : undefined;
  const winningImage =
    activeTool === 'image' && lastWinner
      ? imageItems.find((it) => it.label === lastWinner)
      : undefined;
  const winningIgComment =
    activeTool === 'instagram' && lastWinner
      ? instagramParsed.find((it) => it.entryLabel === lastWinner)
      : undefined;

  const isFlagRevealed = revealedNonce === spinNonce && spinNonce > 0;

  return (
    <div className="w-full max-w-2xl rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 px-3.5 sm:px-4 py-3 shadow-sm space-y-3">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${toolMeta.accentClass}`}
          >
            <ToolIcon toolId={activeTool} className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {km ? toolMeta.nameKm : toolMeta.nameEn}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {km ? toolMeta.descKm : toolMeta.descEn}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onResetToStandardWheel}
          className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{km ? 'កងវិលធម្មតា' : 'Standard Wheel'}</span>
        </button>
      </div>

      {/* 1. TEAM PICKER */}
      {activeTool === 'team' && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span>
            {km
              ? 'ផ្ទាំងបែងចែកក្រុមត្រូវបានបើកខាងក្រោមកងវិល — អ្នកក៏អាចបើកទំព័រចាត់ចែងក្រុមពេញលេញផងដែរ។'
              : 'Team splitter is open below the wheel — or open the full Team & Task manager.'}
          </span>
          <button
            type="button"
            onClick={onOpenFullTeams}
            className="min-h-[34px] px-3 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{km ? 'បើកទំព័រចែកក្រុមពេញ' : 'Open Full Team Manager'}</span>
          </button>
        </div>
      )}

      {/* 2. YES / NO PICKER */}
      {activeTool === 'yes_no' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyYesNo('yes_no', yesNoRepeats)}
                className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                  yesNoMode === 'yes_no'
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {km ? 'បាទ/ចាស ឬ ទេ' : 'YES / NO'}
              </button>
              <button
                type="button"
                onClick={() => applyYesNo('yes_no_maybe', yesNoRepeats)}
                className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                  yesNoMode === 'yes_no_maybe'
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {km ? 'បាទ/ចាស · ទេ · ប្រហែល' : 'YES / NO / MAYBE'}
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                {km ? 'ចំនួនជុំ:' : 'Sets:'}
              </span>
              {[1, 2, 3, 4].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => applyYesNo(yesNoMode, r)}
                  className={`min-h-[30px] min-w-[32px] rounded-lg font-mono font-bold tabular-nums cursor-pointer ${
                    yesNoRepeats === r
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {r}×
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-4 font-mono tabular-nums font-semibold">
              <span className="text-emerald-600 dark:text-emerald-400">
                YES: {yesNoTally.yes}
              </span>
              <span className="text-rose-600 dark:text-rose-400">
                NO: {yesNoTally.no}
              </span>
              {yesNoMode === 'yes_no_maybe' && (
                <span className="text-amber-600 dark:text-amber-400">
                  MAYBE: {yesNoTally.maybe}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setYesNoTally({ yes: 0, no: 0, maybe: 0 })}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              {km ? 'កំណត់ការរាប់ឡើងវិញ' : 'Reset Tally'}
            </button>
          </div>
        </div>
      )}

      {/* 3. NUMBER PICKER */}
      {activeTool === 'number' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {km ? 'ចាប់ពី (Min)' : 'Min'}
              <input
                type="number"
                value={numMin}
                onChange={(e) =>
                  applyNumbers(Number(e.target.value) || 0, numMax, numStep, numExclude)
                }
                className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white tabular-nums"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {km ? 'ដល់ (Max)' : 'Max'}
              <input
                type="number"
                value={numMax}
                onChange={(e) =>
                  applyNumbers(numMin, Number(e.target.value) || 10, numStep, numExclude)
                }
                className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white tabular-nums"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {km ? 'គម្លាត (Step)' : 'Interval'}
              <input
                type="number"
                min={1}
                value={numStep}
                onChange={(e) =>
                  applyNumbers(numMin, numMax, Math.max(1, Number(e.target.value) || 1), numExclude)
                }
                className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white tabular-nums"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {km ? 'ដកលេខ (ឧ. 4, 13)' : 'Exclude (e.g. 4, 13)'}
              <input
                type="text"
                value={numExclude}
                onChange={(e) => applyNumbers(numMin, numMax, numStep, e.target.value)}
                placeholder="4, 13"
                className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-white"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              [1, 10],
              [1, 20],
              [1, 30],
              [1, 50],
              [1, 100],
            ].map(([lo, hi]) => (
              <button
                key={`${lo}-${hi}`}
                type="button"
                onClick={() => applyNumbers(lo, hi, 1, '')}
                className={`min-h-[30px] px-2.5 rounded-lg font-mono text-xs font-semibold tabular-nums cursor-pointer ${
                  numMin === lo && numMax === hi && numStep === 1 && !numExclude
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {lo}–{hi}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. LETTER PICKER */}
      {activeTool === 'letter' && (
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'en_all' as const, km: 'អង់គ្លេស A–Z (26)', en: 'English A–Z (26)' },
            { id: 'en_vowels' as const, km: 'ស្រៈ A E I O U', en: 'Vowels (A–U)' },
            { id: 'en_consonants' as const, km: 'ព្យញ្ជនៈអង់គ្លេស (21)', en: 'Consonants (21)' },
            { id: 'km_consonants' as const, km: 'ព្យញ្ជនៈខ្មែរ ក–អ (33)', en: 'Khmer ក–អ (33)' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => applyLetters(opt.id)}
              className={`min-h-[34px] px-3 rounded-xl text-xs font-semibold cursor-pointer ${
                letterSet === opt.id
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {km ? opt.km : opt.en}
            </button>
          ))}
        </div>
      )}

      {/* 5. COUNTRY PICKER & 15. FLAG QUIZ */}
      {(activeTool === 'country' || activeTool === 'flag_quiz') && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['All', 'Asia', 'Europe', 'Americas', 'Africa', 'Oceania'] as const).map(
              (reg) => (
                <button
                  key={reg}
                  type="button"
                  onClick={() => applyCountries(reg, activeTool === 'flag_quiz')}
                  className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    continent === reg
                      ? 'bg-[#3B82F6] text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {reg === 'All'
                    ? km
                      ? 'គ្រប់ទ្វីប'
                      : 'All Continents'
                    : reg}
                </button>
              )
            )}
          </div>

          {activeTool === 'flag_quiz' && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
              {winningFlagCountry ? (
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                  <span className="text-3xl leading-none">{winningFlagCountry.flag}</span>
                  {isFlagRevealed ? (
                    <div className="text-xs">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {km
                          ? `${winningFlagCountry.nameKm} (${winningFlagCountry.nameEn})`
                          : winningFlagCountry.nameEn}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        {km ? 'រាជធានី៖' : 'Capital:'}{' '}
                        {km ? winningFlagCountry.capitalKm : winningFlagCountry.capitalEn}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {km
                        ? 'តើទង់ជាតិនេះជារបស់ប្រទេសណា?'
                        : 'Which country does this flag belong to?'}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setRevealedNonce(isFlagRevealed ? 0 : spinNonce)
                    }
                    className="min-h-[32px] px-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#3B82F6] dark:text-blue-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    {isFlagRevealed ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>{km ? 'លាក់ចម្លើយ' : 'Hide'}</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>{km ? 'បង្ហាញចម្លើយ' : 'Reveal Answer'}</span>
                      </>
                    )}
                  </button>

                  {isFlagRevealed && scoredNonce !== spinNonce && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setScoredNonce(spinNonce);
                          setFlagScore((s) => ({
                            correct: s.correct + 1,
                            total: s.total + 1,
                          }));
                        }}
                        className="min-h-[30px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        {km ? 'ឆ្លើយត្រូវ +1' : 'Got it +1'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScoredNonce(spinNonce);
                          setFlagScore((s) => ({
                            ...s,
                            total: s.total + 1,
                          }));
                        }}
                        className="min-h-[30px] px-2.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        {km ? 'ខុស' : 'Missed'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {km
                    ? 'បង្វិលកងដើម្បីចាប់ទង់ជាតិ ១ រួចទាយឈ្មោះប្រទេស!'
                    : 'Spin the wheel to land on a flag and guess the country!'}
                </span>
              )}

              <div className="flex items-center gap-2 font-mono text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200 shrink-0">
                <span>
                  {km ? 'ពិន្ទុ:' : 'Score:'} {flagScore.correct}/{flagScore.total}
                </span>
                {flagScore.total > 0 && (
                  <button
                    type="button"
                    onClick={() => setFlagScore({ correct: 0, total: 0 })}
                    className="text-[11px] font-sans font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {km ? 'សារថ្មី' : 'Reset'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. STATE / PROVINCE PICKER */}
      {activeTool === 'state' && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyStates('kh')}
            className={`min-h-[34px] px-3 rounded-xl text-xs font-semibold cursor-pointer ${
              stateRegion === 'kh'
                ? 'bg-[#3B82F6] text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            🇰🇭 {km ? 'រាជធានី-ខេត្តកម្ពុជា (២៥)' : 'Cambodia Provinces (25)'}
          </button>
          <button
            type="button"
            onClick={() => applyStates('us')}
            className={`min-h-[34px] px-3 rounded-xl text-xs font-semibold cursor-pointer ${
              stateRegion === 'us'
                ? 'bg-[#3B82F6] text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            🇺🇸 {km ? 'រដ្ឋអាមេរិក (៥០ States)' : 'US States (50)'}
          </button>
        </div>
      )}

      {/* 7. COLOR PICKER */}
      {activeTool === 'color' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all' as const, km: 'គ្រប់ពណ៌ (24)', en: 'All Colors (24)' },
              { id: 'vibrant' as const, km: 'ពណ៌ភ្លឺច្បាស់', en: 'Vibrant' },
              { id: 'pastel' as const, km: 'ពណ៌ស្រាល (Pastel)', en: 'Pastel' },
              { id: 'earth' as const, km: 'ពណ៌ធម្មជាតិ', en: 'Earth Tones' },
            ].map((grp) => (
              <button
                key={grp.id}
                type="button"
                onClick={() => applyColors(grp.id)}
                className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                  colorGroup === grp.id
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {km ? grp.km : grp.en}
              </button>
            ))}
          </div>

          {winningColor && (
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-9 h-9 rounded-xl border border-black/10 shrink-0 shadow-sm"
                  style={{ backgroundColor: winningColor.hex }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {km ? winningColor.nameKm : winningColor.nameEn}
                  </p>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {winningColor.hex}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(winningColor.hex);
                  } catch {
                    // ignore clipboard fallback
                  }
                  setCopiedHex(true);
                  window.setTimeout(() => setCopiedHex(false), 1500);
                }}
                className="min-h-[32px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedHex ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{km ? 'បាន Copy!' : 'Copied!'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy HEX</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 8. IMAGE PICKER */}
      {activeTool === 'image' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleUploadImages(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[34px] px-3 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{km ? 'បញ្ចូលរូបភាពពីឧបករណ៍' : 'Upload Photos'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeImageItems(STARTER_IMAGE_ITEMS);
                  onApplyEntries(
                    km ? 'ចាប់រូបភាព (Image Picker)' : 'Image Picker Wheel',
                    STARTER_IMAGE_ITEMS.map((it) => it.label)
                  );
                }}
                className="min-h-[34px] px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {km ? 'រូបគំរូ' : 'Starter Cards'}
              </button>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {imageItems.length} {km ? 'រូបភាព' : 'images'}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {imageItems.map((item) => (
              <div
                key={item.id}
                className="relative shrink-0 w-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1 text-center"
              >
                <div
                  className="w-full h-11 rounded-lg overflow-hidden flex items-center justify-center text-xl"
                  style={{ backgroundColor: item.bgColor }}
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.label}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{item.emoji || '🖼️'}</span>
                  )}
                </div>
                <p className="mt-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">
                  {item.label}
                </p>
                {imageItems.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveImageItem(item.id)}
                    aria-label="Remove image"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {winningImage && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
              <div
                className="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center text-3xl shrink-0 border border-black/10"
                style={{ backgroundColor: winningImage.bgColor }}
              >
                {winningImage.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={winningImage.imageUrl}
                    alt={winningImage.label}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{winningImage.emoji || '🖼️'}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">
                  {km ? 'រូបភាពដែលឈ្នះចុងក្រោយ' : 'Latest Winning Image'}
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {winningImage.label}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 9. DATE PICKER */}
      {activeTool === 'date' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'range' as const, km: 'ចន្លោះកាលបរិច្ឆេទ', en: 'Date Range' },
              { id: 'weekdays' as const, km: 'ថ្ងៃទាំង ៧', en: 'Days of Week' },
              { id: 'months' as const, km: 'ខែទាំង ១២', en: 'Months of Year' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => applyDates(m.id, startDate, endDate)}
                className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                  dateMode === m.id
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {km ? m.km : m.en}
              </button>
            ))}
          </div>
          {dateMode === 'range' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {km ? 'ថ្ងៃចាប់ផ្តើម' : 'Start Date'}
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => applyDates('range', e.target.value, endDate)}
                  className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </label>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {km ? 'ថ្ងៃបញ្ចប់ (អតិបរមា ៦០ ថ្ងៃ)' : 'End Date (max 60 days)'}
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => applyDates('range', startDate, e.target.value)}
                  className="mt-1 w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* 10. INSTAGRAM COMMENT PICKER */}
      {activeTool === 'instagram' && (
        <div className="space-y-2.5">
          <textarea
            rows={3}
            value={igRawText}
            onChange={(e) => applyInstagram(e.target.value, igDedupe, igKeyword)}
            placeholder="@username: comment text..."
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={igDedupe}
                  onChange={(e) => applyInstagram(igRawText, e.target.checked, igKeyword)}
                  className="rounded border-slate-300"
                />
                <span>{km ? 'កាត់ឈ្មោះស្ទួន' : 'Remove duplicate users'}</span>
              </label>
              <input
                type="text"
                value={igKeyword}
                onChange={(e) => applyInstagram(igRawText, igDedupe, e.target.value)}
                placeholder={km ? 'ច្រោះពាក្យ (#hashtag)...' : 'Filter keyword / #tag...'}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyInstagram(SAMPLE_INSTAGRAM_COMMENTS, igDedupe, '')}
                className="min-h-[30px] px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {km ? 'ទិន្នន័យគំរូ' : 'Sample'}
              </button>
              <button
                type="button"
                onClick={() => applyInstagram('', igDedupe, '')}
                aria-label="Clear comments"
                className="min-h-[30px] px-2 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono tabular-nums font-semibold text-pink-600 dark:text-pink-400">
                {instagramParsed.length} {km ? 'នាក់' : 'matched'}
              </span>
            </div>
          </div>

          {winningIgComment && (
            <div className="p-2.5 rounded-xl bg-pink-50/70 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800/70 text-xs">
              <p className="font-bold text-pink-700 dark:text-pink-300">
                {winningIgComment.username}
              </p>
              {winningIgComment.comment && (
                <p className="mt-0.5 text-slate-700 dark:text-slate-200">
                  “{winningIgComment.comment}”
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 11/12/13. MLB / NBA / NFL PICKERS */}
      {(activeTool === 'mlb' || activeTool === 'nba' || activeTool === 'nfl') && (
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            {
              id: 'All' as const,
              label:
                activeTool === 'nfl'
                  ? km
                    ? 'គ្រប់ក្រុម (32)'
                    : 'All Teams (32)'
                  : km
                    ? 'គ្រប់ក្រុម (30)'
                    : 'All Teams (30)',
            },
            {
              id: 'A' as const,
              label:
                activeTool === 'mlb'
                  ? 'American League (AL)'
                  : activeTool === 'nba'
                    ? 'Eastern Conference'
                    : 'AFC Conference',
            },
            {
              id: 'B' as const,
              label:
                activeTool === 'mlb'
                  ? 'National League (NL)'
                  : activeTool === 'nba'
                    ? 'Western Conference'
                    : 'NFC Conference',
            },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => applySports(activeTool, opt.id)}
              className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                sportsFilter === opt.id
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* 14. TRUTH OR DARE */}
      {activeTool === 'truth_dare' && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'mixed' as const, km: 'ចម្រុះ (ការពិត + ហ៊ានធ្វើ)', en: 'Mixed (Truth & Dare)' },
              { id: 'truth' as const, km: 'ការពិតសុទ្ធ (Truth)', en: 'Truth Only' },
              { id: 'dare' as const, km: 'ហ៊ានធ្វើសុទ្ធ (Dare)', en: 'Dare Only' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => applyTruthOrDare(opt.id)}
                className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                  tdMode === opt.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {km ? opt.km : opt.en}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => applyTruthOrDare(tdMode, true)}
            className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>{km ? 'ច្របល់សំណួរ' : 'Shuffle'}</span>
          </button>
        </div>
      )}

      {lastWinner && activeTool !== 'flag_quiz' && activeTool !== 'color' && activeTool !== 'image' && activeTool !== 'instagram' && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate">
            {km ? 'លទ្ធផលចុងក្រោយ៖ ' : 'Last result: '}
            <strong className="text-slate-900 dark:text-white">{lastWinner}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
