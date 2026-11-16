import type { Language } from './i18n';

export type BrainstormBoardStyle = 'classic' | 'swot' | 'scamper' | 'free';

export interface BrainstormColumn {
  id: string;
  labelKm: string;
  labelEn: string;
  accentHex: string;
}

export interface BrainstormTopic {
  id: string;
  categoryKm: string;
  categoryEn: string;
  promptKm: string;
  promptEn: string;
}

export interface BrainstormSpark {
  id: string;
  labelKm: string;
  labelEn: string;
  hintKm: string;
  hintEn: string;
}

export interface BrainstormIdea {
  id: string;
  text: string;
  columnId: string;
  author: string;
  accentHex: string;
  votes: number;
  sparkUsed?: string;
  createdAt: number;
}

export interface BrainstormTeam {
  id: string;
  name: string;
  color: string;
  score: number;
}

export interface StoredBrainstormState {
  topic: string;
  boardStyle: BrainstormBoardStyle;
  ideas: BrainstormIdea[];
  teams: BrainstormTeam[];
}

export const BRAINSTORM_COLORS = [
  '#3B82F6', // Azure Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber Gold
  '#F43F5E', // Coral Rose
  '#8B5CF6', // Violet
  '#06B6D4', // Cyan
];

export const BOARD_STYLE_COLUMNS: Record<BrainstormBoardStyle, BrainstormColumn[]> = {
  classic: [
    { id: 'ideas', labelKm: 'គំនិតថ្មីៗ', labelEn: 'Fresh Ideas', accentHex: '#3B82F6' },
    { id: 'pros', labelKm: 'អត្ថប្រយោជន៍', labelEn: 'Benefits', accentHex: '#10B981' },
    { id: 'challenges', labelKm: 'ឧបសគ្គ / ហានិភ័យ', labelEn: 'Challenges', accentHex: '#F59E0B' },
    { id: 'actions', labelKm: 'សកម្មភាពបន្ទាប់', labelEn: 'Next Steps', accentHex: '#8B5CF6' },
  ],
  swot: [
    { id: 'strengths', labelKm: 'ចំណុចខ្លាំង (S)', labelEn: 'Strengths (S)', accentHex: '#10B981' },
    { id: 'weaknesses', labelKm: 'ចំណុចខ្សោយ (W)', labelEn: 'Weaknesses (W)', accentHex: '#F43F5E' },
    { id: 'opportunities', labelKm: 'ឱកាស (O)', labelEn: 'Opportunities (O)', accentHex: '#3B82F6' },
    { id: 'threats', labelKm: 'ការគំរាមកំហែង (T)', labelEn: 'Threats (T)', accentHex: '#F59E0B' },
  ],
  scamper: [
    { id: 'combine', labelKm: 'ប្តូរ ឬ បូកបញ្ចូល', labelEn: 'Substitute / Combine', accentHex: '#3B82F6' },
    { id: 'modify', labelKm: 'កែលម្អ ឬ បង្កើន', labelEn: 'Adapt / Modify', accentHex: '#10B981' },
    { id: 'repurpose', labelKm: 'ប្រើរបៀបថ្មី', labelEn: 'Put to Other Use', accentHex: '#F59E0B' },
    { id: 'reverse', labelKm: 'កាត់បន្ថយ ឬ បញ្ច្រាស', labelEn: 'Eliminate / Reverse', accentHex: '#8B5CF6' },
  ],
  free: [
    { id: 'all', labelKm: 'ក្តារគំនិតរួម', labelEn: 'Open Idea Wall', accentHex: '#3B82F6' },
  ],
};

export const STARTER_BRAINSTORM_TOPICS: BrainstormTopic[] = [
  {
    id: 'topic_fun_class',
    categoryKm: 'ថ្នាក់រៀន',
    categoryEn: 'Classroom',
    promptKm: 'តើធ្វើដូចម្តេចដើម្បីធ្វើឱ្យថ្នាក់រៀនកាន់តែសប្បាយ និងសិស្សចូលរួមច្រើនជាងមុន?',
    promptEn: 'How can we make our classroom lessons more engaging and interactive?',
  },
  {
    id: 'topic_green_school',
    categoryKm: 'បរិស្ថាន',
    categoryEn: 'Environment',
    promptKm: 'គំនិតកាត់បន្ថយសំរាមប្លាស្ទិក និងបង្កើតសាលារៀនបៃតងស្អាត',
    promptEn: 'Ideas to reduce single-use plastic and build a cleaner green school',
  },
  {
    id: 'topic_smart_study',
    categoryKm: 'ការសិក្សា',
    categoryEn: 'Study Skills',
    promptKm: 'វិធីសាស្ត្ររៀនឆ្លាតវៃ និងចងចាំមេរៀនបានលឿនមុនពេលប្រឡង',
    promptEn: 'Smart study habits and memory techniques before exams',
  },
  {
    id: 'topic_science_fair',
    categoryKm: 'គម្រោង',
    categoryEn: 'Projects',
    promptKm: 'ប្រធានបទ ឬស្នាដៃច្នៃប្រឌិតសម្រាប់ពិព័រណ៍វិទ្យាសាស្ត្រ និងសិល្បៈ',
    promptEn: 'Creative project ideas for our upcoming science & art fair',
  },
  {
    id: 'topic_kindness',
    categoryKm: 'សហគមន៍',
    categoryEn: 'Community',
    promptKm: 'សកម្មភាពតូចៗប្រចាំថ្ងៃដែលជួយសិស្សថ្មី និងមិត្តភក្តិក្នុងសាលា',
    promptEn: 'Small daily acts of kindness to welcome new students and peers',
  },
  {
    id: 'topic_time_save',
    categoryKm: 'ការគ្រប់គ្រងពេល',
    categoryEn: 'Productivity',
    promptKm: 'វិធីរៀបចំកាលវិភាគប្រចាំថ្ងៃកុំឱ្យរវល់ជ្រុល និងនៅមានពេលសម្រាក',
    promptEn: 'Ways to organize daily study and rest without feeling overwhelmed',
  },
];

export const BRAINSTORM_SPARKS: BrainstormSpark[] = [
  {
    id: 'spark_zero_budget',
    labelKm: 'ថវិកា ០ រៀល',
    labelEn: 'Zero Budget',
    hintKm: 'សាកល្បងគិតគំនិតដែលអាចធ្វើបានភ្លាមៗដោយមិនចាំបាច់ចំណាយប្រាក់!',
    hintEn: 'Invent an idea that costs nothing and uses items already in the room.',
  },
  {
    id: 'spark_5min',
    labelKm: 'ធ្វើក្នុង ៥ នាទី',
    labelEn: '5-Minute Action',
    hintKm: 'តើគំនិតអ្វីដែលអាចចាប់ផ្តើមអនុវត្តបានក្នុងរយៈពេលត្រឹម ៥ នាទី?',
    hintEn: 'Propose an action anyone can start in 5 minutes or less.',
  },
  {
    id: 'spark_reverse',
    labelKm: 'គិតបញ្ច្រាស ១៨០°',
    labelEn: 'Flip It Upside Down',
    hintKm: 'សួរថា «តើធ្វើម៉េចឱ្យបញ្ហាកាន់តែអាក្រក់?» រួចត្រឡប់ចម្លើយនោះមកជាដំណោះស្រាយ!',
    hintEn: 'Ask how to make the problem worse, then flip the answer into a solution.',
  },
  {
    id: 'spark_gamify',
    labelKm: 'បម្លែងជាហ្គេម',
    labelEn: 'Make It a Game',
    hintKm: 'បន្ថែមពិន្ទុ បញ្ហាប្រឈម ឬការប្រកួតសប្បាយៗទៅក្នុងគំនិតបន្ទាប់។',
    hintEn: 'Turn the next idea into a friendly classroom challenge or mini-game.',
  },
  {
    id: 'spark_teamwork',
    labelKm: 'សហការជាគូ',
    labelEn: 'Pair Power',
    hintKm: 'គំនិតដែលត្រូវធ្វើរួមគ្នា ២ នាក់ ឬ ២ ក្រុមដើម្បីជួយគ្នាទៅវិញទៅមក។',
    hintEn: 'Design an idea that works only when two classmates team up.',
  },
  {
    id: 'spark_future',
    labelKm: '១០ ឆ្នាំទៅមុខ',
    labelEn: '10 Years Ahead',
    hintKm: 'ស្រមៃថាពេលនេះជាឆ្នាំ ២០៣៦ — តើអ្នកនឹងដោះស្រាយរឿងនេះបែបណា?',
    hintEn: 'Imagine it is 10 years in the future — what bold solution exists?',
  },
];

const STORAGE_KEY = 'pickerwel_brainstorm_v1';

export function createDefaultTeams(language: Language): BrainstormTeam[] {
  return [
    {
      id: 'team_1',
      name: language === 'km' ? 'ក្រុមទី ១' : 'Team 1',
      color: BRAINSTORM_COLORS[0],
      score: 0,
    },
    {
      id: 'team_2',
      name: language === 'km' ? 'ក្រុមទី ២' : 'Team 2',
      color: BRAINSTORM_COLORS[1],
      score: 0,
    },
  ];
}

export function loadBrainstormState(language: Language): StoredBrainstormState {
  const defaultTopic =
    language === 'km'
      ? STARTER_BRAINSTORM_TOPICS[0].promptKm
      : STARTER_BRAINSTORM_TOPICS[0].promptEn;

  const fallback: StoredBrainstormState = {
    topic: defaultTopic,
    boardStyle: 'classic',
    ideas: [],
    teams: createDefaultTeams(language),
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredBrainstormState>;
    const validStyles: BrainstormBoardStyle[] = ['classic', 'swot', 'scamper', 'free'];
    return {
      topic: typeof parsed.topic === 'string' && parsed.topic.trim() ? parsed.topic : fallback.topic,
      boardStyle:
        parsed.boardStyle && validStyles.includes(parsed.boardStyle)
          ? parsed.boardStyle
          : 'classic',
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
      teams:
        Array.isArray(parsed.teams) && parsed.teams.length > 0
          ? parsed.teams
          : fallback.teams,
    };
  } catch {
    return fallback;
  }
}

export function saveBrainstormState(state: StoredBrainstormState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function formatBrainstormSummary(
  topic: string,
  boardStyle: BrainstormBoardStyle,
  ideas: BrainstormIdea[],
  language: Language
): string {
  const cols = BOARD_STYLE_COLUMNS[boardStyle];
  const sorted = [...ideas].sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt);
  const lines: string[] = [
    `${language === 'km' ? 'ប្រធានបទព្យុះគំនិត' : 'Brainstorm Topic'}: ${topic}`,
    `${language === 'km' ? 'ចំនួនគំនិតសរុប' : 'Total Ideas'}: ${ideas.length}`,
    '',
  ];

  cols.forEach((col) => {
    const colIdeas = sorted.filter((i) => i.columnId === col.id);
    if (colIdeas.length === 0) return;
    lines.push(`[${language === 'km' ? col.labelKm : col.labelEn}]`);
    colIdeas.forEach((item, idx) => {
      lines.push(
        `  ${idx + 1}. ${item.text} (${item.author}${item.votes > 0 ? ` · +${item.votes}` : ''})`
      );
    });
    lines.push('');
  });

  return lines.join('\n').trim();
}

export function formatBrainstormCsv(
  topic: string,
  boardStyle: BrainstormBoardStyle,
  ideas: BrainstormIdea[],
  language: Language
): string {
  const cols = BOARD_STYLE_COLUMNS[boardStyle];
  const colMap = new Map(cols.map((c) => [c.id, language === 'km' ? c.labelKm : c.labelEn]));
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const header = ['Topic', 'Category', 'Idea', 'Contributor', 'Votes', 'Spark'].map(escape).join(',');
  const rows = [...ideas]
    .sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt)
    .map((i) =>
      [
        topic,
        colMap.get(i.columnId) || i.columnId,
        i.text,
        i.author,
        String(i.votes),
        i.sparkUsed || '',
      ]
        .map(escape)
        .join(',')
    );

  return '\uFEFF' + [header, ...rows].join('\n');
}
