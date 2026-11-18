'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Shuffle,
  Crown,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  Plus,
  Trash2,
  Sparkles,
  Disc3,
  Check,
  ClipboardList,
  RefreshCw,
  Lock,
  Unlock,
  SlidersHorizontal,
  UserCheck,
  UserX,
  Scale,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { WHEEL_PALETTES } from '@/lib/palettes';
import { playTickSound, playWinSound, triggerHaptic } from '@/lib/sound';
import { COPY } from '@/lib/i18n';

interface ParsedStudent {
  raw: string;
  name: string;
  tag?: string;
}

interface CustomGroupSpec {
  id: string;
  name: string;
  capacity: number;
}

interface StudentPairRule {
  id: string;
  a: string;
  b: string;
}

interface PinRule {
  id: string;
  student: string;
  groupIndex: number;
}

interface GroupMember {
  id: string;
  name: string;
  tag?: string;
  isLeader: boolean;
  locked?: boolean;
  role?: string;
}

interface AssignedGroup {
  id: string;
  name: string;
  color: string;
  targetCapacity?: number;
  members: GroupMember[];
  tasks: string[];
  completed: boolean;
}

interface PersistedGroupState {
  membersText: string;
  tasksText: string;
  splitMode: 'count' | 'size' | 'custom';
  groupCount: number;
  groupSize: number;
  customSpecs: CustomGroupSpec[];
  autoLeader: boolean;
  autoRoles: boolean;
  balanceTags: boolean;
  pinRules: PinRule[];
  togetherPairs: StudentPairRule[];
  apartPairs: StudentPairRule[];
  groups: AssignedGroup[];
}

const STORAGE_KEY = 'pickerwel_group_tasks_v2';

const SAMPLE_MEMBERS_KM = [
  'សុខា',
  'ដារ៉ា',
  'ម៉ាលី',
  'វិបុល',
  'កញ្ញា',
  'ចន្ទ្រា',
  'រតនា',
  'បញ្ញា',
  'សុភ័ក្រ្ត',
  'ស្រីលក្ខណ៍',
  'ពិសិដ្ឋ',
  'នារី',
];

const SAMPLE_MEMBERS_EN = [
  'Sokha',
  'Dara',
  'Mali',
  'Vibol',
  'Kanya',
  'Chantra',
  'Ratana',
  'Panha',
  'Sopheak',
  'Sreyleak',
  'Piseth',
  'Nary',
];

const SAMPLE_TAGGED_KM = [
  'សុខា (ប្រុស)',
  'ដារ៉ា (ប្រុស)',
  'វិបុល (ប្រុស)',
  'រតនា (ប្រុស)',
  'បញ្ញា (ប្រុស)',
  'ពិសិដ្ឋ (ប្រុស)',
  'ម៉ាលី (ស្រី)',
  'កញ្ញា (ស្រី)',
  'ចន្ទ្រា (ស្រី)',
  'សុភ័ក្រ្ត (ស្រី)',
  'ស្រីលក្ខណ៍ (ស្រី)',
  'នារី (ស្រី)',
];

const SAMPLE_TAGGED_EN = [
  'Sokha (Boy)',
  'Dara (Boy)',
  'Vibol (Boy)',
  'Ratana (Boy)',
  'Panha (Boy)',
  'Piseth (Boy)',
  'Mali (Girl)',
  'Kanya (Girl)',
  'Chantra (Girl)',
  'Sopheak (Girl)',
  'Sreyleak (Girl)',
  'Nary (Girl)',
];

const SAMPLE_TASKS_KM = [
  'ស្រាវជ្រាវ និងប្រមូលឯកសារសំខាន់ៗ',
  'រៀបចំ Slide បទបង្ហាញ និងរូបភាព',
  'ធ្វើលំហាត់គំរូ និងដំណោះស្រាយ',
  'សង្ខេបខ្លឹមសារ និងឡើងធ្វើបទបង្ហាញ',
];

const SAMPLE_TASKS_EN = [
  'Research & gather key references',
  'Design presentation slides & visuals',
  'Solve sample exercises & case studies',
  'Summarize key points & present to class',
];

const ROLES_KM = ['ប្រធានក្រុម', 'អ្នកកត់ត្រា', 'អ្នកធ្វើបទបង្ហាញ', 'អ្នករៀបចំសម្ភារៈ', 'អ្នកត្រួតពិនិត្យ'];
const ROLES_EN = ['Leader', 'Note-taker', 'Presenter', 'Coordinator', 'Reviewer'];

function fisherYates<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseStudentLine(line: string): ParsedStudent {
  const trimmed = line.trim();
  const parenMatch = trimmed.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (parenMatch && parenMatch[1].trim()) {
    return {
      raw: trimmed,
      name: parenMatch[1].trim(),
      tag: parenMatch[2].trim(),
    };
  }
  const pipeIdx = trimmed.indexOf('|');
  if (pipeIdx > 0) {
    const name = trimmed.slice(0, pipeIdx).trim();
    const tag = trimmed.slice(pipeIdx + 1).trim();
    if (name && tag) return { raw: trimmed, name, tag };
  }
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx > 0) {
    const name = trimmed.slice(0, commaIdx).trim();
    const tag = trimmed.slice(commaIdx + 1).trim();
    if (name && tag) return { raw: trimmed, name, tag };
  }
  return { raw: trimmed, name: trimmed };
}

function defaultCustomSpecs(lang: 'km' | 'en'): CustomGroupSpec[] {
  return [
    { id: 'cs_1', name: lang === 'km' ? 'ក្រុមទី ១' : 'Group 1', capacity: 4 },
    { id: 'cs_2', name: lang === 'km' ? 'ក្រុមទី ២' : 'Group 2', capacity: 4 },
    { id: 'cs_3', name: lang === 'km' ? 'ក្រុមទី ៣' : 'Group 3', capacity: 4 },
  ];
}

export function GroupTasksView({
  syncFromWheelKey = 0,
}: {
  syncFromWheelKey?: number;
}) {
  const { activeWheel, settings, createNewWheel, setActiveNav } = usePickerwel();
  const t = COPY[settings.language];
  const paletteColors =
    WHEEL_PALETTES[activeWheel.paletteId]?.colors ||
    WHEEL_PALETTES.vibrant.colors;

  const [membersText, setMembersText] = useState('');
  const [tasksText, setTasksText] = useState(
    settings.language === 'km'
      ? SAMPLE_TASKS_KM.join('\n')
      : SAMPLE_TASKS_EN.join('\n')
  );
  const [splitMode, setSplitMode] = useState<'count' | 'size' | 'custom'>('count');
  const [groupCount, setGroupCount] = useState(3);
  const [groupSize, setGroupSize] = useState(3);
  const [customSpecs, setCustomSpecs] = useState<CustomGroupSpec[]>(() =>
    defaultCustomSpecs(settings.language)
  );
  const [autoLeader, setAutoLeader] = useState(true);
  const [autoRoles, setAutoRoles] = useState(true);
  const [balanceTags, setBalanceTags] = useState(true);

  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [pinRules, setPinRules] = useState<PinRule[]>([]);
  const [togetherPairs, setTogetherPairs] = useState<StudentPairRule[]>([]);
  const [apartPairs, setApartPairs] = useState<StudentPairRule[]>([]);

  // Draft rule selectors
  const [draftPinStudent, setDraftPinStudent] = useState('');
  const [draftPinGroupIdx, setDraftPinGroupIdx] = useState(0);
  const [draftTogetherA, setDraftTogetherA] = useState('');
  const [draftTogetherB, setDraftTogetherB] = useState('');
  const [draftApartA, setDraftApartA] = useState('');
  const [draftApartB, setDraftApartB] = useState('');

  const [groups, setGroups] = useState<AssignedGroup[]>([]);
  const [constraintWarning, setConstraintWarning] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate persisted state or initialize from active wheel
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PersistedGroupState>;
          if (typeof parsed.membersText === 'string') setMembersText(parsed.membersText);
          if (typeof parsed.tasksText === 'string') setTasksText(parsed.tasksText);
          if (
            parsed.splitMode === 'count' ||
            parsed.splitMode === 'size' ||
            parsed.splitMode === 'custom'
          ) {
            setSplitMode(parsed.splitMode);
          }
          if (typeof parsed.groupCount === 'number') setGroupCount(parsed.groupCount);
          if (typeof parsed.groupSize === 'number') setGroupSize(parsed.groupSize);
          if (Array.isArray(parsed.customSpecs) && parsed.customSpecs.length > 0) {
            setCustomSpecs(parsed.customSpecs);
          }
          if (typeof parsed.autoLeader === 'boolean') setAutoLeader(parsed.autoLeader);
          if (typeof parsed.autoRoles === 'boolean') setAutoRoles(parsed.autoRoles);
          if (typeof parsed.balanceTags === 'boolean') setBalanceTags(parsed.balanceTags);
          if (Array.isArray(parsed.pinRules)) setPinRules(parsed.pinRules);
          if (Array.isArray(parsed.togetherPairs)) setTogetherPairs(parsed.togetherPairs);
          if (Array.isArray(parsed.apartPairs)) setApartPairs(parsed.apartPairs);
          if (Array.isArray(parsed.groups)) setGroups(parsed.groups);
        } else if (activeWheel.entries.length > 0) {
          setMembersText(activeWheel.entries.join('\n'));
        }
        if (syncFromWheelKey > 0 && activeWheel.entries.length > 0) {
          setMembersText(activeWheel.entries.join('\n'));
        }
      } catch {
        if (activeWheel.entries.length > 0) {
          setMembersText(activeWheel.entries.join('\n'));
        }
      }
      setHydrated(true);
    });
  }, [activeWheel.entries, syncFromWheelKey]);

  // Persist changes locally
  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistedGroupState = {
        membersText,
        tasksText,
        splitMode,
        groupCount,
        groupSize,
        customSpecs,
        autoLeader,
        autoRoles,
        balanceTags,
        pinRules,
        togetherPairs,
        apartPairs,
        groups,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    hydrated,
    membersText,
    tasksText,
    splitMode,
    groupCount,
    groupSize,
    customSpecs,
    autoLeader,
    autoRoles,
    balanceTags,
    pinRules,
    togetherPairs,
    apartPairs,
    groups,
  ]);

  useEffect(() => {
    if (!copiedNotice) return;
    const timer = window.setTimeout(() => setCopiedNotice(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedNotice]);

  const parsedStudents = parseLines(membersText).map(parseStudentLine);
  const parsedTasks = parseLines(tasksText);
  const uniqueTags = Array.from(
    new Set(parsedStudents.map((s) => s.tag).filter((tag): tag is string => Boolean(tag)))
  );

  // Determine active group specifications & capacities
  const effectiveSpecs: CustomGroupSpec[] =
    splitMode === 'custom'
      ? customSpecs
      : (() => {
          const total = Math.max(1, parsedStudents.length);
          const count =
            splitMode === 'count'
              ? Math.max(1, Math.min(12, groupCount, total))
              : Math.max(1, Math.ceil(total / Math.max(1, groupSize)));
          return Array.from({ length: count }, (_, idx) => ({
            id: `auto_${idx}`,
            name:
              settings.language === 'km'
                ? `ក្រុមទី ${idx + 1}`
                : `Group ${idx + 1}`,
            capacity:
              splitMode === 'size'
                ? Math.max(1, groupSize)
                : Math.floor(total / count) + (idx < total % count ? 1 : 0),
          }));
        })();

  const totalCustomSlots = customSpecs.reduce((sum, s) => sum + s.capacity, 0);

  const handleLoadFromWheel = () => {
    if (activeWheel.entries.length === 0) return;
    setMembersText(activeWheel.entries.join('\n'));
    if (settings.soundEnabled) playTickSound(0.25);
  };

  const handleLoadSampleMembers = () => {
    const sample = settings.language === 'km' ? SAMPLE_MEMBERS_KM : SAMPLE_MEMBERS_EN;
    setMembersText(sample.join('\n'));
  };

  const handleLoadTaggedSample = () => {
    const sample = settings.language === 'km' ? SAMPLE_TAGGED_KM : SAMPLE_TAGGED_EN;
    setMembersText(sample.join('\n'));
    setBalanceTags(true);
  };

  const handleLoadSampleTasks = () => {
    const sample = settings.language === 'km' ? SAMPLE_TASKS_KM : SAMPLE_TASKS_EN;
    setTasksText(sample.join('\n'));
  };

  const handleAddCustomSpec = () => {
    if (customSpecs.length >= 12) return;
    const nextNum = customSpecs.length + 1;
    setCustomSpecs((prev) => [
      ...prev,
      {
        id: `cs_${Date.now()}`,
        name: settings.language === 'km' ? `ក្រុមទី ${nextNum}` : `Group ${nextNum}`,
        capacity: 3,
      },
    ]);
  };

  const handleUpdateCustomSpec = (
    id: string,
    patch: Partial<CustomGroupSpec>
  ) => {
    setCustomSpecs((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const handleRemoveCustomSpec = (id: string) => {
    if (customSpecs.length <= 2) return;
    setCustomSpecs((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddPinRule = () => {
    if (!draftPinStudent) return;
    const clampedIdx = Math.min(draftPinGroupIdx, effectiveSpecs.length - 1);
    setPinRules((prev) => [
      ...prev.filter((r) => r.student !== draftPinStudent),
      {
        id: `pin_${Date.now()}`,
        student: draftPinStudent,
        groupIndex: clampedIdx,
      },
    ]);
    setDraftPinStudent('');
  };

  const handleAddTogetherPair = () => {
    if (!draftTogetherA || !draftTogetherB || draftTogetherA === draftTogetherB) return;
    setTogetherPairs((prev) => [
      ...prev,
      { id: `tog_${Date.now()}`, a: draftTogetherA, b: draftTogetherB },
    ]);
    setDraftTogetherA('');
    setDraftTogetherB('');
  };

  const handleAddApartPair = () => {
    if (!draftApartA || !draftApartB || draftApartA === draftApartB) return;
    setApartPairs((prev) => [
      ...prev,
      { id: `apt_${Date.now()}`, a: draftApartA, b: draftApartB },
    ]);
    setDraftApartA('');
    setDraftApartB('');
  };

  const handleGenerateGroups = () => {
    if (parsedStudents.length === 0 || effectiveSpecs.length === 0) return;

    const specs = effectiveSpecs;
    const gCount = specs.length;

    // 1. Determine locked/pinned assignments by student name
    const lockedAssignment = new Map<string, number>();

    // First respect any manually locked members inside existing groups
    groups.forEach((grp, gIdx) => {
      if (gIdx >= gCount) return;
      grp.members.forEach((m) => {
        if (m.locked) {
          lockedAssignment.set(m.name, gIdx);
        }
      });
    });

    // Also apply explicit pinRules
    pinRules.forEach((rule) => {
      if (rule.groupIndex >= 0 && rule.groupIndex < gCount) {
        lockedAssignment.set(rule.student, rule.groupIndex);
      }
    });

    // Capacities for each bucket
    const baseCaps = specs.map((s) => Math.max(1, s.capacity));
    const totalCap = baseCaps.reduce((sum, c) => sum + c, 0);
    // If more students than defined custom seats, expand evenly so no student is dropped
    const capacities = [...baseCaps];
    if (totalCap < parsedStudents.length) {
      let extra = parsedStudents.length - totalCap;
      let cursor = 0;
      while (extra > 0) {
        capacities[cursor % gCount] += 1;
        cursor += 1;
        extra -= 1;
      }
    }

    // Helper: evaluate candidate buckets against constraints & tag balance
    const scorePlacement = (buckets: ParsedStudent[][]): { penalty: number; hardBroken: boolean } => {
      const studentToGroup = new Map<string, number>();
      buckets.forEach((b, gIdx) => {
        b.forEach((st) => studentToGroup.set(st.name, gIdx));
      });

      let penalty = 0;
      let hardBroken = false;

      for (const pair of togetherPairs) {
        const ga = studentToGroup.get(pair.a);
        const gb = studentToGroup.get(pair.b);
        if (ga !== undefined && gb !== undefined && ga !== gb) {
          penalty += 1000;
          hardBroken = true;
        }
      }

      for (const pair of apartPairs) {
        const ga = studentToGroup.get(pair.a);
        const gb = studentToGroup.get(pair.b);
        if (ga !== undefined && gb !== undefined && ga === gb) {
          penalty += 1000;
          hardBroken = true;
        }
      }

      if (balanceTags && uniqueTags.length > 0) {
        for (const tag of uniqueTags) {
          const counts = buckets.map(
            (b) => b.filter((st) => st.tag === tag).length
          );
          const minC = Math.min(...counts);
          const maxC = Math.max(...counts);
          if (maxC - minC > 1) {
            penalty += (maxC - minC - 1) * 20;
          } else {
            penalty += maxC - minC;
          }
        }
      }

      return { penalty, hardBroken };
    };

    const runOneAttempt = (): ParsedStudent[][] => {
      const buckets: ParsedStudent[][] = Array.from({ length: gCount }, () => []);
      const remaining: ParsedStudent[] = [];

      // Place pinned/locked students first
      for (const student of parsedStudents) {
        const pinnedIdx = lockedAssignment.get(student.name);
        if (
          pinnedIdx !== undefined &&
          pinnedIdx >= 0 &&
          pinnedIdx < gCount &&
          buckets[pinnedIdx].length < capacities[pinnedIdx]
        ) {
          buckets[pinnedIdx].push(student);
        } else {
          remaining.push(student);
        }
      }

      // Order remaining students: if balanceTags is enabled, interleave by shuffled tag groups
      let orderedRemaining: ParsedStudent[];
      if (balanceTags && uniqueTags.length > 0) {
        const byTag = new Map<string, ParsedStudent[]>();
        const untagged: ParsedStudent[] = [];
        for (const st of fisherYates(remaining)) {
          if (st.tag) {
            const list = byTag.get(st.tag) || [];
            list.push(st);
            byTag.set(st.tag, list);
          } else {
            untagged.push(st);
          }
        }
        orderedRemaining = [];
        for (const tag of fisherYates(Array.from(byTag.keys()))) {
          orderedRemaining.push(...(byTag.get(tag) || []));
        }
        orderedRemaining.push(...untagged);
      } else {
        orderedRemaining = fisherYates(remaining);
      }

      // Build together clusters so linked pairs tend to land together
      const togetherMap = new Map<string, Set<string>>();
      for (const pair of togetherPairs) {
        const setA = togetherMap.get(pair.a) || new Set([pair.a]);
        const setB = togetherMap.get(pair.b) || new Set([pair.b]);
        const merged = new Set([...setA, ...setB]);
        merged.forEach((name) => togetherMap.set(name, merged));
      }

      const placedNames = new Set<string>();
      buckets.forEach((b) => b.forEach((st) => placedNames.add(st.name)));

      for (const student of orderedRemaining) {
        if (placedNames.has(student.name)) continue;

        const clusterNames = togetherMap.get(student.name);
        const clusterStudents = clusterNames
          ? orderedRemaining.filter(
              (s) => clusterNames.has(s.name) && !placedNames.has(s.name)
            )
          : [student];

        // Find candidate groups with enough remaining capacity
        const findBestGroup = (forStudent: ParsedStudent): number => {
          let bestIdx = 0;
          let bestScore = Infinity;

          for (let gIdx = 0; gIdx < gCount; gIdx++) {
            const avail = capacities[gIdx] - buckets[gIdx].length;
            if (avail <= 0) continue;

            // Fill score favors balanced fill ratio
            let score = (buckets[gIdx].length / capacities[gIdx]) * 10;

            // Reward same-group together partner already present
            const togetherPartners = togetherPairs
              .filter((p) => p.a === forStudent.name || p.b === forStudent.name)
              .map((p) => (p.a === forStudent.name ? p.b : p.a));
            for (const partner of togetherPartners) {
              if (buckets[gIdx].some((m) => m.name === partner)) {
                score -= 50;
              }
            }

            // Penalize apart partner already present
            const apartPartners = apartPairs
              .filter((p) => p.a === forStudent.name || p.b === forStudent.name)
              .map((p) => (p.a === forStudent.name ? p.b : p.a));
            for (const enemy of apartPartners) {
              if (buckets[gIdx].some((m) => m.name === enemy)) {
                score += 500;
              }
            }

            // Penalize tag imbalance
            if (balanceTags && forStudent.tag) {
              const sameTagCount = buckets[gIdx].filter(
                (m) => m.tag === forStudent.tag
              ).length;
              score += sameTagCount * 15;
            }

            // Slight random tie-breaker
            score += Math.random() * 1.5;

            if (score < bestScore) {
              bestScore = score;
              bestIdx = gIdx;
            }
          }
          return bestIdx;
        };

        // If cluster size > 1 and fits in a single group without apart conflict, place together
        if (clusterStudents.length > 1) {
          const validClusterGroup = Array.from({ length: gCount }, (_, idx) => idx).find(
            (gIdx) => {
              const alreadyPinnedHere = clusterStudents.some(
                (cs) => lockedAssignment.get(cs.name) === gIdx
              );
              const fits =
                capacities[gIdx] - buckets[gIdx].length >= clusterStudents.length;
              return fits && (alreadyPinnedHere || !clusterStudents.some((cs) => lockedAssignment.has(cs.name)));
            }
          );

          if (validClusterGroup !== undefined) {
            for (const cs of clusterStudents) {
              buckets[validClusterGroup].push(cs);
              placedNames.add(cs.name);
            }
            continue;
          }
        }

        const chosenIdx = findBestGroup(student);
        buckets[chosenIdx].push(student);
        placedNames.add(student.name);
      }

      return buckets;
    };

    // Run 120 randomized trials and select best constraint satisfaction
    let bestBuckets = runOneAttempt();
    let bestEval = scorePlacement(bestBuckets);
    for (let attempt = 0; attempt < 120; attempt++) {
      if (bestEval.penalty === 0) break;
      const candidate = runOneAttempt();
      const candidateEval = scorePlacement(candidate);
      if (candidateEval.penalty < bestEval.penalty) {
        bestBuckets = candidate;
        bestEval = candidateEval;
      }
    }

    setConstraintWarning(bestEval.hardBroken);

    // Assign tasks across the resulting groups
    const shuffledTasks = fisherYates(parsedTasks);
    const taskBuckets: string[][] = Array.from({ length: gCount }, () => []);
    if (shuffledTasks.length > 0) {
      if (shuffledTasks.length >= gCount) {
        shuffledTasks.forEach((task, idx) => {
          taskBuckets[idx % gCount].push(task);
        });
      } else {
        for (let g = 0; g < gCount; g++) {
          taskBuckets[g].push(shuffledTasks[g % shuffledTasks.length]);
        }
      }
    }

    const rolesPool = settings.language === 'km' ? ROLES_KM : ROLES_EN;
    const generated: AssignedGroup[] = bestBuckets.map((bucket, gIdx) => {
      const leaderIdx =
        autoLeader && bucket.length > 0
          ? Math.floor(Math.random() * bucket.length)
          : -1;
      const orderedMembers = bucket.map((student, mIdx): GroupMember => {
        const isLeader = mIdx === leaderIdx;
        const isLocked = lockedAssignment.has(student.name);
        let role: string | undefined;
        if (autoRoles) {
          if (isLeader) {
            role = rolesPool[0];
          } else {
            const nonLeaderOffset =
              leaderIdx >= 0 && mIdx > leaderIdx ? mIdx : mIdx + 1;
            role = rolesPool[nonLeaderOffset % rolesPool.length];
          }
        }
        return {
          id: `gm_${Date.now()}_${gIdx}_${mIdx}`,
          name: student.name,
          tag: student.tag,
          isLeader,
          locked: isLocked,
          role,
        };
      });

      return {
        id: `grp_${Date.now()}_${gIdx}`,
        name: specs[gIdx].name,
        color: paletteColors[gIdx % paletteColors.length],
        targetCapacity: splitMode === 'custom' ? specs[gIdx].capacity : undefined,
        members: orderedMembers,
        tasks: taskBuckets[gIdx],
        completed: false,
      };
    });

    setGroups(generated);
    if (settings.soundEnabled) playWinSound();
    if (settings.hapticsEnabled) triggerHaptic([25, 20, 40]);
  };

  const handleShuffleTasksOnly = () => {
    if (groups.length === 0 || parsedTasks.length === 0) return;
    const shuffledTasks = fisherYates(parsedTasks);
    const taskBuckets: string[][] = Array.from({ length: groups.length }, () => []);
    if (shuffledTasks.length >= groups.length) {
      shuffledTasks.forEach((task, idx) => {
        taskBuckets[idx % groups.length].push(task);
      });
    } else {
      for (let g = 0; g < groups.length; g++) {
        taskBuckets[g].push(shuffledTasks[g % shuffledTasks.length]);
      }
    }

    setGroups((prev) =>
      prev.map((grp, idx) => ({
        ...grp,
        tasks: taskBuckets[idx],
        completed: false,
      }))
    );
    if (settings.soundEnabled) playTickSound(0.3);
  };

  const handleRenameGroup = (groupId: string, nextName: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, name: nextName } : g))
    );
  };

  const handleToggleComplete = (groupId: string) => {
    if (settings.soundEnabled) playTickSound(0.22);
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, completed: !g.completed } : g
      )
    );
  };

  const handleToggleLeader = (groupId: string, memberId: string) => {
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

  const handleToggleMemberLock = (groupId: string, memberId: string) => {
    if (settings.soundEnabled) playTickSound(0.18);
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          members: g.members.map((m) =>
            m.id === memberId ? { ...m, locked: !m.locked } : m
          ),
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
      const sourceGroup = prev.find((g) => g.id === fromGroupId);
      const movingMember = sourceGroup?.members.find((m) => m.id === memberId);
      if (!movingMember) return prev;

      return prev.map((g) => {
        if (g.id === fromGroupId) {
          return {
            ...g,
            members: g.members.filter((m) => m.id !== memberId),
          };
        }
        if (g.id === toGroupId) {
          return {
            ...g,
            members: [...g.members, { ...movingMember, isLeader: false }],
          };
        }
        return g;
      });
    });
  };

  const handleAddCustomTaskToGroup = (groupId: string) => {
    const val = (newTaskInputs[groupId] || '').trim();
    if (!val) return;
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, tasks: [...g.tasks, val] } : g
      )
    );
    setNewTaskInputs((prev) => ({ ...prev, [groupId]: '' }));
  };

  const handleRemoveTaskFromGroup = (groupId: string, taskIdx: number) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, tasks: g.tasks.filter((_, i) => i !== taskIdx) }
          : g
      )
    );
  };

  const handleSpinTeamsOnWheel = async () => {
    if (groups.length < 2) return;
    const entries = groups.map((g) => g.name.trim()).filter(Boolean);
    if (entries.length < 2) return;
    const title =
      settings.language === 'km'
        ? `បង្វិលក្រុម (${groups.length} ក្រុម)`
        : `Team Picker (${groups.length} Groups)`;
    await createNewWheel(title, entries, activeWheel.paletteId);
    setActiveNav('home');
  };

  const handleCopySummary = async () => {
    if (groups.length === 0) return;
    const lines = groups.map((g) => {
      const taskLine =
        g.tasks.length > 0
          ? `${t.groupsAssignedTaskLabel}: ${g.tasks.join(' | ')}`
          : '';
      const memberLines = g.members
        .map((m) => {
          const tags = [
            m.tag || '',
            m.isLeader ? t.groupsLeaderTag : '',
            m.role && (!m.isLeader || m.role !== ROLES_KM[0]) ? m.role : '',
          ]
            .filter(Boolean)
            .join(' · ');
          return `  - ${m.name}${tags ? ` (${tags})` : ''}`;
        })
        .join('\n');
      return [`${g.name}`, taskLine, memberLines].filter(Boolean).join('\n');
    });
    const text = lines.join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotice(true);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleExportCsv = () => {
    if (groups.length === 0) return;
    const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
    const rows: string[] = [
      ['Group', 'Status', 'Assigned Tasks', 'Member', 'Tag', 'Leader', 'Role']
        .map(escapeCsv)
        .join(','),
    ];
    groups.forEach((g) => {
      const status = g.completed ? t.groupsDoneLabel : t.groupsInProgressLabel;
      const tasksStr = g.tasks.join(' | ');
      if (g.members.length === 0) {
        rows.push(
          [g.name, status, tasksStr, '', '', '', ''].map(escapeCsv).join(',')
        );
      } else {
        g.members.forEach((m) => {
          rows.push(
            [
              g.name,
              status,
              tasksStr,
              m.name,
              m.tag || '',
              m.isLeader ? 'Yes' : 'No',
              m.role || '',
            ]
              .map(escapeCsv)
              .join(',')
          );
        });
      }
    });

    const blob = new Blob(['\uFEFF' + rows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pickerwel_group_tasks.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalMembersAssigned = groups.reduce(
    (sum, g) => sum + g.members.length,
    0
  );
  const completedGroupCount = groups.filter((g) => g.completed).length;
  const activeRuleCount =
    pinRules.length + togetherPairs.length + apartPairs.length;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="pb-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {t.groupsTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t.groupsDesc}
            </p>
          </div>
          {groups.length > 0 && (
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
              {t.groupsCountStat(groups.length, totalMembersAssigned)} ·{' '}
              {t.groupsCompletedStat(completedGroupCount, groups.length)}
            </p>
          )}
        </div>

        {/* Two-Zone Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT ZONE: Members, Custom Quotas, Placement Rules & Tasks */}
          <aside className="lg:col-span-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            {/* Members Input */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                  {t.groupsMembersLabel} ({parsedStudents.length})
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadFromWheel}
                    disabled={activeWheel.entries.length === 0}
                    className="text-xs font-semibold text-[#3B82F6] dark:text-blue-400 hover:underline disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    {t.groupsLoadWheelBtn} ({activeWheel.entries.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadSampleMembers}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    {t.groupsSampleMembersBtn}
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadTaggedSample}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    {t.groupsSampleTaggedBtn}
                  </button>
                </div>
              </div>
              <textarea
                rows={5}
                value={membersText}
                onChange={(e) => setMembersText(e.target.value)}
                placeholder={
                  settings.language === 'km'
                    ? 'សុខា (ប្រុស)\nម៉ាលី (ស្រី)\nដារ៉ា (ប្រុស)...'
                    : 'Sokha (Boy)\nMali (Girl)\nDara (Boy)...'
                }
                className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                {t.groupsBalanceTagsHint}
              </p>
            </div>

            {/* Split Mode: Count / Size / Custom Quotas */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setSplitMode('count')}
                  className={`min-h-[36px] px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    splitMode === 'count'
                      ? 'bg-white dark:bg-slate-700 text-[#3B82F6] dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.groupsSplitByCount}
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('size')}
                  className={`min-h-[36px] px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    splitMode === 'size'
                      ? 'bg-white dark:bg-slate-700 text-[#3B82F6] dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.groupsSplitBySize}
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('custom')}
                  className={`min-h-[36px] px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    splitMode === 'custom'
                      ? 'bg-white dark:bg-slate-700 text-[#3B82F6] dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.groupsSplitCustom}
                </button>
              </div>

              {splitMode === 'count' ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.groupsCountLabel}
                  </span>
                  <div className="flex items-center gap-1">
                    {[2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setGroupCount(n)}
                        className={`min-h-[34px] min-w-[32px] rounded-lg text-xs font-mono font-bold tabular-nums transition-colors cursor-pointer ${
                          groupCount === n
                            ? 'bg-[#3B82F6] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={groupCount}
                      onChange={(e) =>
                        setGroupCount(
                          Math.max(1, Math.min(12, Number(e.target.value) || 2))
                        )
                      }
                      aria-label={t.groupsCountLabel}
                      className="w-11 min-h-[34px] px-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums"
                    />
                  </div>
                </div>
              ) : splitMode === 'size' ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.groupsSizeLabel}
                  </span>
                  <div className="flex items-center gap-1">
                    {[2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setGroupSize(n)}
                        className={`min-h-[34px] min-w-[34px] rounded-lg text-xs font-mono font-bold tabular-nums transition-colors cursor-pointer ${
                          groupSize === n
                            ? 'bg-[#3B82F6] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Custom Group Quotas Builder */
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {t.groupsCustomQuotaTitle}
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      {t.groupsQuotaSummary(totalCustomSlots, parsedStudents.length)}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {customSpecs.map((spec) => (
                      <div key={spec.id} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={spec.name}
                          onChange={(e) =>
                            handleUpdateCustomSpec(spec.id, {
                              name: e.target.value,
                            })
                          }
                          className="flex-1 min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                        />
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={spec.capacity}
                          onChange={(e) =>
                            handleUpdateCustomSpec(spec.id, {
                              capacity: Math.max(
                                1,
                                Math.min(30, Number(e.target.value) || 1)
                              ),
                            })
                          }
                          aria-label={`${spec.name} quota`}
                          className="w-14 min-h-[34px] px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums"
                        />
                        {customSpecs.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomSpec(spec.id)}
                            aria-label="Remove group quota"
                            className="min-h-[34px] min-w-[30px] rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {customSpecs.length < 12 && (
                    <button
                      type="button"
                      onClick={handleAddCustomSpec}
                      className="w-full min-h-[34px] rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold text-[#3B82F6] dark:text-blue-400 inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.groupsAddCustomGroupBtn}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Role, Leader & Tag Balance Toggles */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center justify-between gap-3 min-h-[38px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-2">
                    <Scale className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{t.groupsBalanceTagsLabel}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={balanceTags}
                    onChange={(e) => setBalanceTags(e.target.checked)}
                    className="w-4 h-4 accent-[#3B82F6] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 min-h-[38px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-2">
                    <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{t.groupsAutoLeader}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={autoLeader}
                    onChange={(e) => setAutoLeader(e.target.checked)}
                    className="w-4 h-4 accent-[#3B82F6] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 min-h-[38px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>{t.groupsAutoRoles}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={autoRoles}
                    onChange={(e) => setAutoRoles(e.target.checked)}
                    className="w-4 h-4 accent-[#3B82F6] cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Expandable Custom Placement Rules (Pin / Keep Together / Keep Apart) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <button
                type="button"
                onClick={() => setRulesExpanded((v) => !v)}
                className="w-full min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>
                    {t.groupsSmartRulesTitle}
                    {activeRuleCount > 0 ? ` (${activeRuleCount})` : ''}
                  </span>
                </span>
                {rulesExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {rulesExpanded && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-4">
                  {/* 1. Pin student to specific group */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-[#3B82F6]" />
                      <span>{t.groupsPinStudentLabel}</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={draftPinStudent}
                        onChange={(e) => setDraftPinStudent(e.target.value)}
                        className="flex-1 min-w-0 min-h-[34px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">{t.groupsSelectStudentPlaceholder}</option>
                        {parsedStudents.map((s) => (
                          <option key={`pin_${s.raw}`} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={draftPinGroupIdx}
                        onChange={(e) => setDraftPinGroupIdx(Number(e.target.value))}
                        className="w-24 min-h-[34px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      >
                        {effectiveSpecs.map((spec, idx) => (
                          <option key={spec.id} value={idx}>
                            {spec.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddPinRule}
                        disabled={!draftPinStudent}
                        aria-label={t.groupsAddRuleBtn}
                        className="min-h-[34px] min-w-[34px] rounded-lg bg-[#3B82F6] text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {pinRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <span className="truncate text-slate-700 dark:text-slate-200">
                          {rule.student} →{' '}
                          {effectiveSpecs[rule.groupIndex]?.name ||
                            `#${rule.groupIndex + 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPinRules((prev) =>
                              prev.filter((r) => r.id !== rule.id)
                            )
                          }
                          aria-label="Remove rule"
                          className="text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* 2. Keep Together */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <UserCheck className="w-3 h-3" />
                      <span>{t.groupsKeepTogetherLabel}</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={draftTogetherA}
                        onChange={(e) => setDraftTogetherA(e.target.value)}
                        className="flex-1 min-w-0 min-h-[34px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">{t.groupsSelectStudentPlaceholder}</option>
                        {parsedStudents.map((s) => (
                          <option key={`tga_${s.raw}`} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={draftTogetherB}
                        onChange={(e) => setDraftTogetherB(e.target.value)}
                        className="flex-1 min-w-0 min-h-[34px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">{t.groupsSelectSecondStudentPlaceholder}</option>
                        {parsedStudents.map((s) => (
                          <option key={`tgb_${s.raw}`} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddTogetherPair}
                        disabled={
                          !draftTogetherA ||
                          !draftTogetherB ||
                          draftTogetherA === draftTogetherB
                        }
                        aria-label={t.groupsAddRuleBtn}
                        className="min-h-[34px] min-w-[34px] rounded-lg bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {togetherPairs.map((pair) => (
                      <div
                        key={pair.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 text-xs"
                      >
                        <span className="truncate text-slate-700 dark:text-slate-200">
                          {pair.a} + {pair.b}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setTogetherPairs((prev) =>
                              prev.filter((p) => p.id !== pair.id)
                            )
                          }
                          aria-label="Remove rule"
                          className="text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* 3. Keep Apart */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <UserX className="w-3 h-3" />
                      <span>{t.groupsKeepApartLabel}</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={draftApartA}
                        onChange={(e) => setDraftApartA(e.target.value)}
                        className="flex-1 min-w-0 min-h-[34px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">{t.groupsSelectStudentPlaceholder}</option>
                        {parsedStudents.map((s) => (
                          <option key={`apa_${s.raw}`} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={draftApartB}
                        onChange={(e) => setDraftApartB(e.target.value)}
                        className="flex-1 min-w-0 min-h-[34px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">{t.groupsSelectSecondStudentPlaceholder}</option>
                        {parsedStudents.map((s) => (
                          <option key={`apb_${s.raw}`} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddApartPair}
                        disabled={
                          !draftApartA ||
                          !draftApartB ||
                          draftApartA === draftApartB
                        }
                        aria-label={t.groupsAddRuleBtn}
                        className="min-h-[34px] min-w-[34px] rounded-lg bg-rose-600 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {apartPairs.map((pair) => (
                      <div
                        key={pair.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 text-xs"
                      >
                        <span className="truncate text-slate-700 dark:text-slate-200">
                          {pair.a} ≠ {pair.b}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setApartPairs((prev) =>
                              prev.filter((p) => p.id !== pair.id)
                            )
                          }
                          aria-label="Remove rule"
                          className="text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tasks / Topics Input */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                  {t.groupsTasksLabel} ({parsedTasks.length})
                </label>
                <button
                  type="button"
                  onClick={handleLoadSampleTasks}
                  className="text-xs font-medium text-[#3B82F6] dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap"
                >
                  {t.groupsSampleTasksBtn}
                </button>
              </div>
              <textarea
                rows={4}
                value={tasksText}
                onChange={(e) => setTasksText(e.target.value)}
                placeholder={
                  settings.language === 'km'
                    ? 'រៀបចំ Slide បទបង្ហាញ\nស្រាវជ្រាវឯកសារ...'
                    : 'Prepare presentation slides\nResearch topic...'
                }
                className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleGenerateGroups}
                disabled={parsedStudents.length === 0}
                className="w-full min-h-[46px] px-4 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 cursor-pointer"
              >
                <Shuffle className="w-4 h-4" />
                <span>{t.groupsGenerateBtn}</span>
              </button>

              {groups.length > 0 && parsedTasks.length > 0 && (
                <button
                  type="button"
                  onClick={handleShuffleTasksOnly}
                  className="w-full min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t.groupsShuffleTasksBtn}</span>
                </button>
              )}
            </div>
          </aside>

          {/* RIGHT ZONE: Generated Groups & Task Cards */}
          <section className="lg:col-span-8 space-y-4">
            {constraintWarning && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center gap-2.5 text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{t.groupsConstraintWarning}</span>
              </div>
            )}

            {groups.length === 0 ? (
              <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3">
                <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {t.groupsEmptyTitle}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {t.groupsEmptyDesc}
                </p>
              </div>
            ) : (
              <>
                {/* Export & Wheel Action Strip */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopySummary}
                      className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {copiedNotice ? (
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

                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t.groupsExportCsvBtn}</span>
                    </button>
                  </div>

                  {groups.length >= 2 && (
                    <button
                      type="button"
                      onClick={handleSpinTeamsOnWheel}
                      className="min-h-[38px] px-3.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Disc3 className="w-3.5 h-3.5" />
                      <span>{t.groupsSpinTeamsBtn}</span>
                    </button>
                  )}
                </div>

                {/* Team Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {groups.map((group) => (
                      <motion.div
                        key={group.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.2 }}
                        className={`p-5 rounded-3xl border transition-colors flex flex-col justify-between gap-4 ${
                          group.completed
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: group.color }}
                                aria-hidden="true"
                              />
                              <input
                                type="text"
                                value={group.name}
                                onChange={(e) =>
                                  handleRenameGroup(group.id, e.target.value)
                                }
                                aria-label="Group name"
                                className="w-full bg-transparent font-display text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded-lg px-1 -ml-1"
                              />
                              <span className="text-xs font-mono text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                                {group.members.length}
                                {group.targetCapacity ? `/${group.targetCapacity}` : ''}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleComplete(group.id)}
                              className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                group.completed
                                  ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {group.completed ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{t.groupsDoneLabel}</span>
                                </>
                              ) : (
                                <>
                                  <Circle className="w-3.5 h-3.5" />
                                  <span>{t.groupsInProgressLabel}</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Assigned Tasks Block */}
                          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              <ClipboardList className="w-3.5 h-3.5 text-[#3B82F6]" />
                              <span>{t.groupsAssignedTaskLabel}</span>
                            </div>

                            {group.tasks.length === 0 ? (
                              <p className="text-xs text-slate-400 dark:text-slate-500">
                                {t.groupsNoTaskAssigned}
                              </p>
                            ) : (
                              <ul className="space-y-1.5">
                                {group.tasks.map((task, tIdx) => (
                                  <li
                                    key={`${group.id}_t_${tIdx}`}
                                    className="flex items-start justify-between gap-2 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100"
                                  >
                                    <span className="leading-snug">{task}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveTaskFromGroup(group.id, tIdx)
                                      }
                                      aria-label="Remove task"
                                      className="text-slate-400 hover:text-rose-500 shrink-0 mt-0.5 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}

                            <div className="flex items-center gap-1.5 pt-1">
                              <input
                                type="text"
                                value={newTaskInputs[group.id] || ''}
                                onChange={(e) =>
                                  setNewTaskInputs((prev) => ({
                                    ...prev,
                                    [group.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCustomTaskToGroup(group.id);
                                  }
                                }}
                                placeholder={t.groupsTaskPlaceholder}
                                className="flex-1 min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleAddCustomTaskToGroup(group.id)
                                }
                                aria-label="Add task"
                                className="min-h-[34px] min-w-[34px] rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white flex items-center justify-center cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Members List */}
                          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {group.members.map((member) => (
                              <li
                                key={member.id}
                                className="py-2 flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleLeader(group.id, member.id)
                                    }
                                    title={t.groupsLeaderTag}
                                    aria-label={`Toggle leader for ${member.name}`}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                      member.isLeader
                                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-amber-500'
                                    }`}
                                  >
                                    <Crown className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleMemberLock(group.id, member.id)
                                    }
                                    title={
                                      member.locked
                                        ? t.groupsUnlockMemberLabel
                                        : t.groupsLockMemberLabel
                                    }
                                    aria-label={`${
                                      member.locked
                                        ? t.groupsUnlockMemberLabel
                                        : t.groupsLockMemberLabel
                                    } ${member.name}`}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                      member.locked
                                        ? 'bg-blue-100 dark:bg-blue-950/60 text-[#3B82F6] dark:text-blue-400'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-500'
                                    }`}
                                  >
                                    {member.locked ? (
                                      <Lock className="w-3.5 h-3.5" />
                                    ) : (
                                      <Unlock className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  <div className="min-w-0 pl-0.5">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                      {member.name}
                                    </p>
                                    {(member.tag || member.isLeader || member.role) && (
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                        {[
                                          member.tag || '',
                                          member.isLeader
                                            ? t.groupsLeaderTag
                                            : member.role || '',
                                        ]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {groups.length > 1 && (
                                  <select
                                    value={group.id}
                                    onChange={(e) =>
                                      handleMoveMember(
                                        group.id,
                                        member.id,
                                        e.target.value
                                      )
                                    }
                                    aria-label={`${t.groupsMoveToLabel} ${member.name}`}
                                    className="min-h-[30px] max-w-[105px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer"
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
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
