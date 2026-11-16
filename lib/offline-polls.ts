export type MentiSlideType = 'multiple_choice' | 'word_cloud' | 'scales' | 'open_ended';

export interface MentiPollOption {
  id: string;
  label: string;
  votes: number;
}

export interface MentiWordEntry {
  text: string;
  count: number;
}

export interface MentiOpenEntry {
  id: string;
  text: string;
  author?: string;
  upvotes: number;
  createdAt: number;
}

export interface MentiSlide {
  id: string;
  type: MentiSlideType;
  question: string;
  subtitle?: string;
  hideResults?: boolean;
  // Multiple choice
  options?: MentiPollOption[];
  allowMultiple?: boolean;
  // Word cloud
  words?: MentiWordEntry[];
  // Scales (1 to 5)
  scaleCounts?: [number, number, number, number, number];
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  // Open ended / Q&A
  openEntries?: MentiOpenEntry[];
}

export interface MentiPollDeck {
  id: string;
  title: string;
  category: string;
  sessionCode: string;
  slides: MentiSlide[];
  updatedAt: number;
}

export const MENTI_CHART_COLORS = [
  '#3B82F6', // Azure Blue
  '#F43F5E', // Coral Rose
  '#10B981', // Emerald
  '#F59E0B', // Amber Gold
  '#8B5CF6', // Violet
  '#06B6D4', // Cyan
];

export const STARTER_OFFLINE_POLLS: MentiPollDeck[] = [
  {
    id: 'menti_classroom_checkin',
    title: 'ស្ទុងមតិប្រចាំថ្នាក់រៀន (Classroom Check-In)',
    category: 'ថ្នាក់រៀន',
    sessionCode: '4829',
    updatedAt: 1700000000000,
    slides: [
      {
        id: 'mc_mood',
        type: 'multiple_choice',
        question: 'តើមុខវិជ្ជា ឬប្រធានបទណាដែលអ្នកចង់ពិភាក្សាមុនគេនៅថ្ងៃនេះ?',
        subtitle: 'ជ្រើសរើស ១ ចំណុចដែលអ្នកចាប់អារម្មណ៍បំផុត',
        hideResults: false,
        options: [
          { id: 'opt_1', label: 'សង្ខេបមេរៀនសំខាន់ៗ', votes: 0 },
          { id: 'opt_2', label: 'ធ្វើលំហាត់អនុវត្តផ្ទាល់', votes: 0 },
          { id: 'opt_3', label: 'ពិភាក្សាក្រុម & សួរឆ្លើយ', votes: 0 },
          { id: 'opt_4', label: 'លេងហ្គេមប្រកួត Quiz', votes: 0 },
        ],
      },
      {
        id: 'wc_feeling',
        type: 'word_cloud',
        question: 'ពណ៌នាអារម្មណ៍ ឬគោលដៅរបស់អ្នកថ្ងៃនេះក្នុង ១ ទៅ ២ ពាក្យ?',
        subtitle: 'វាយបញ្ចូលពាក្យខ្លីៗ — ពាក្យដែលមានអ្នកឆ្លើយច្រើននឹងរីកធំឡើង',
        hideResults: false,
        words: [],
      },
      {
        id: 'sc_understanding',
        type: 'scales',
        question: 'តើអ្នកយល់មេរៀនមុនកម្រិតណាដែរ? (១ ដល់ ៥)',
        subtitle: 'វាយតម្លៃដោយស្មោះត្រង់ដើម្បីជួយគ្រូកែសម្រួលល្បឿនបង្រៀន',
        hideResults: false,
        scaleMinLabel: 'មិនទាន់ច្បាស់',
        scaleMaxLabel: 'យល់ច្បាស់ ១០០%',
        scaleCounts: [0, 0, 0, 0, 0],
      },
      {
        id: 'oe_questions',
        type: 'open_ended',
        question: 'តើអ្នកមានសំណួរ ឬសំណូមពរអ្វីបន្ថែមសម្រាប់ថ្នាក់រៀន?',
        subtitle: 'សរសេរគំនិតរបស់អ្នក ហើយអ្នកដទៃអាចចុច +1 គាំទ្របាន',
        hideResults: false,
        openEntries: [],
      },
    ],
  },
  {
    id: 'menti_team_decision',
    title: 'ការបោះឆ្នោត និងប្រមូលគំនិតក្រុម (Team Poll)',
    category: 'ការងារក្រុម',
    sessionCode: '7315',
    updatedAt: 1700000000000,
    slides: [
      {
        id: 'td_priority',
        type: 'multiple_choice',
        question: 'តើយើងគួរជ្រើសរើសជម្រើសណាសម្រាប់គម្រោងសប្តាហ៍នេះ?',
        subtitle: 'បោះឆ្នោតដោយតម្លាភាព ឬបើករបៀបលាក់លទ្ធផល',
        hideResults: false,
        options: [
          { id: 'td_1', label: 'ផ្តោតលើគុណភាព និងភាពងាយស្រួលប្រើ', votes: 0 },
          { id: 'td_2', label: 'បន្ថែមមុខងារថ្មីឱ្យបានលឿន', votes: 0 },
          { id: 'td_3', label: 'រៀបចំបទបង្ហាញ និងសាកល្បងជាមួយអ្នកប្រើ', votes: 0 },
          { id: 'td_4', label: 'បែងចែកក្រុមតូចធ្វើស្របគ្នា', votes: 0 },
        ],
      },
      {
        id: 'td_words',
        type: 'word_cloud',
        question: 'តើគុណតម្លៃសំខាន់បំផុតសម្រាប់ក្រុមយើងគឺអ្វី?',
        subtitle: 'បញ្ចូលពាក្យគន្លឹះ ១ ពាក្យក្នុងម្នាក់',
        hideResults: false,
        words: [],
      },
      {
        id: 'td_confidence',
        type: 'scales',
        question: 'តើក្រុមយើងមានទំនុកចិត្តកម្រិតណាលើផែនការនេះ?',
        scaleMinLabel: 'ត្រូវការកែលម្អ',
        scaleMaxLabel: 'ជឿជាក់ខ្ពស់',
        scaleCounts: [0, 0, 0, 0, 0],
      },
    ],
  },
  {
    id: 'menti_icebreaker_en',
    title: 'Quick Icebreaker & Group Survey',
    category: 'Icebreaker',
    sessionCode: '9104',
    updatedAt: 1700000000000,
    slides: [
      {
        id: 'ib_1',
        type: 'multiple_choice',
        question: 'Which format works best for our next session?',
        subtitle: 'Cast one vote — results update live on screen',
        hideResults: false,
        options: [
          { id: 'ib_o1', label: 'Interactive Workshop', votes: 0 },
          { id: 'ib_o2', label: 'Team Challenge & Debate', votes: 0 },
          { id: 'ib_o3', label: 'Short Talk + Live Q&A', votes: 0 },
          { id: 'ib_o4', label: 'Peer Showcase', votes: 0 },
        ],
      },
      {
        id: 'ib_2',
        type: 'word_cloud',
        question: 'One word describing your energy level right now?',
        subtitle: 'Repeated words automatically grow larger',
        hideResults: false,
        words: [],
      },
      {
        id: 'ib_3',
        type: 'scales',
        question: 'How useful was today’s discussion?',
        scaleMinLabel: 'Not useful',
        scaleMaxLabel: 'Very useful',
        scaleCounts: [0, 0, 0, 0, 0],
      },
    ],
  },
];

const POLLS_STORAGE_KEY = 'pickerwel_offline_menti_polls_v1';

export function loadOfflinePolls(): MentiPollDeck[] {
  if (typeof window === 'undefined') return STARTER_OFFLINE_POLLS;
  try {
    const raw = window.localStorage.getItem(POLLS_STORAGE_KEY);
    if (!raw) return STARTER_OFFLINE_POLLS;
    const parsed = JSON.parse(raw) as MentiPollDeck[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return STARTER_OFFLINE_POLLS;
  } catch {
    return STARTER_OFFLINE_POLLS;
  }
}

export function saveOfflinePolls(decks: MentiPollDeck[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(POLLS_STORAGE_KEY, JSON.stringify(decks));
  } catch {
    // Ignore storage quota errors
  }
}

export function getSlideVoteCount(slide: MentiSlide): number {
  if (slide.type === 'multiple_choice') {
    return (slide.options || []).reduce((sum, opt) => sum + opt.votes, 0);
  }
  if (slide.type === 'word_cloud') {
    return (slide.words || []).reduce((sum, w) => sum + w.count, 0);
  }
  if (slide.type === 'scales') {
    return (slide.scaleCounts || [0, 0, 0, 0, 0]).reduce((sum, c) => sum + c, 0);
  }
  return (slide.openEntries || []).length;
}

export function clearSlideVotes(slide: MentiSlide): MentiSlide {
  return {
    ...slide,
    options: slide.options?.map((o) => ({ ...o, votes: 0 })),
    words: slide.type === 'word_cloud' ? [] : slide.words,
    scaleCounts: slide.type === 'scales' ? [0, 0, 0, 0, 0] : slide.scaleCounts,
    openEntries: slide.type === 'open_ended' ? [] : slide.openEntries,
  };
}

export function populateSampleVotesForDeck(deck: MentiPollDeck, lang: 'km' | 'en'): MentiPollDeck {
  const sampleWordsKm = ['រីករាយ', 'តាំងចិត្ត', 'រួបរួម', 'រៀនសូត្រ', 'ជោគជ័យ', 'សហការ', 'ច្នៃប្រឌិត', 'ស្វាហាប់'];
  const sampleWordsEn = ['Focused', 'Curious', 'Energized', 'Teamwork', 'Creative', 'Ready', 'Inspired', 'Happy'];
  const wordBank = lang === 'km' ? sampleWordsKm : sampleWordsEn;

  const sampleIdeasKm = [
    'ចង់ឱ្យមានលំហាត់អនុវត្តជាក្រុមច្រើនជាងមុន',
    'ពន្យល់ច្បាស់ ហើយមានឧទាហរណ៍ជាក់ស្តែងល្អណាស់',
    'សូមបន្ថែមម៉ោងសំណួរ-ចម្លើយ ១០ នាទីទៀត',
  ];
  const sampleIdeasEn = [
    'More hands-on group exercises would be great!',
    'Clear explanation with helpful visual examples.',
    'Can we spend 10 extra minutes on Q&A?',
  ];
  const ideaBank = lang === 'km' ? sampleIdeasKm : sampleIdeasEn;

  return {
    ...deck,
    updatedAt: Date.now(),
    slides: deck.slides.map((slide, sIdx) => {
      if (slide.type === 'multiple_choice' && slide.options) {
        return {
          ...slide,
          options: slide.options.map((opt, oIdx) => ({
            ...opt,
            votes: Math.max(1, ((sIdx + 2) * 3 + (oIdx === 0 ? 7 : oIdx === 1 ? 4 : oIdx === 2 ? 5 : 2))),
          })),
        };
      }
      if (slide.type === 'word_cloud') {
        return {
          ...slide,
          words: wordBank.map((w, idx) => ({
            text: w,
            count: Math.max(1, 6 - Math.floor(idx * 0.7)),
          })),
        };
      }
      if (slide.type === 'scales') {
        return {
          ...slide,
          scaleCounts: [1, 2, 4, 9, 7],
        };
      }
      if (slide.type === 'open_ended') {
        return {
          ...slide,
          openEntries: ideaBank.map((text, idx) => ({
            id: `sample_${Date.now()}_${idx}`,
            text,
            upvotes: 5 - idx * 2,
            createdAt: Date.now() - idx * 60000,
          })),
        };
      }
      return slide;
    }),
  };
}

export function exportPollDeckToCsv(deck: MentiPollDeck): string {
  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [
    ['Poll Title', 'Slide #', 'Type', 'Question', 'Response / Option', 'Count / Score'].map(escapeCsv).join(','),
  ];

  deck.slides.forEach((slide, idx) => {
    const slideNum = idx + 1;
    if (slide.type === 'multiple_choice') {
      (slide.options || []).forEach((opt) => {
        rows.push([deck.title, slideNum, slide.type, slide.question, opt.label, opt.votes].map(escapeCsv).join(','));
      });
    } else if (slide.type === 'word_cloud') {
      (slide.words || []).forEach((w) => {
        rows.push([deck.title, slideNum, slide.type, slide.question, w.text, w.count].map(escapeCsv).join(','));
      });
    } else if (slide.type === 'scales') {
      (slide.scaleCounts || [0, 0, 0, 0, 0]).forEach((cnt, rIdx) => {
        rows.push(
          [deck.title, slideNum, slide.type, slide.question, `Rating ${rIdx + 1}/5`, cnt]
            .map(escapeCsv)
            .join(',')
        );
      });
    } else if (slide.type === 'open_ended') {
      (slide.openEntries || []).forEach((entry) => {
        rows.push(
          [deck.title, slideNum, slide.type, slide.question, entry.text, `Upvotes: ${entry.upvotes}`]
            .map(escapeCsv)
            .join(',')
        );
      });
    }
  });

  return rows.join('\n');
}
