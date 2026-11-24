import type { Language } from './i18n';

export type FormThemeId =
  | 'purple'
  | 'indigo'
  | 'blue'
  | 'teal'
  | 'emerald'
  | 'rose'
  | 'amber';

export interface FormThemeSpec {
  id: FormThemeId;
  nameEn: string;
  nameKm: string;
  primary: string;
  accentBg: string;
  softBgLight: string;
  softBorderLight: string;
}

export const FORM_THEMES: Record<FormThemeId, FormThemeSpec> = {
  purple: {
    id: 'purple',
    nameEn: 'Classic Purple',
    nameKm: 'ស្វាយបុរាណ (Google Form)',
    primary: '#673AB7',
    accentBg: '#5E35B1',
    softBgLight: '#F0EBF8',
    softBorderLight: '#D8CEF0',
  },
  indigo: {
    id: 'indigo',
    nameEn: 'Royal Indigo',
    nameKm: 'ខៀវស្វាយ',
    primary: '#4F46E5',
    accentBg: '#4338CA',
    softBgLight: '#EEF2FF',
    softBorderLight: '#C7D2FE',
  },
  blue: {
    id: 'blue',
    nameEn: 'Classroom Blue',
    nameKm: 'ខៀវថ្នាក់រៀន',
    primary: '#2563EB',
    accentBg: '#1D4ED8',
    softBgLight: '#EFF6FF',
    softBorderLight: '#BFDBFE',
  },
  teal: {
    id: 'teal',
    nameEn: 'Ocean Teal',
    nameKm: 'បៃតងសមុទ្រ',
    primary: '#0D9488',
    accentBg: '#0F766E',
    softBgLight: '#F0FDFA',
    softBorderLight: '#99F6E4',
  },
  emerald: {
    id: 'emerald',
    nameEn: 'Fresh Emerald',
    nameKm: 'បៃតងស្រស់',
    primary: '#059669',
    accentBg: '#047857',
    softBgLight: '#ECFDF5',
    softBorderLight: '#A7F3D0',
  },
  rose: {
    id: 'rose',
    nameEn: 'Berry Rose',
    nameKm: 'ផ្កាឈូកក្រហម',
    primary: '#E11D48',
    accentBg: '#BE123C',
    softBgLight: '#FFF1F2',
    softBorderLight: '#FECDD3',
  },
  amber: {
    id: 'amber',
    nameEn: 'Warm Amber',
    nameKm: 'លឿងទុំ',
    primary: '#D97706',
    accentBg: '#B45309',
    softBgLight: '#FFFBEB',
    softBorderLight: '#FDE68A',
  },
};

export type FormQuestionType =
  | 'multiple_choice'
  | 'checkboxes'
  | 'dropdown'
  | 'short_answer'
  | 'paragraph'
  | 'linear_scale'
  | 'date'
  | 'time'
  | 'section';

export interface FormQuestion {
  id: string;
  type: FormQuestionType;
  title: string;
  description?: string;
  required: boolean;
  options: string[];
  hasOther?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  imageUrl?: string;
  correctOption?: string;
  points?: number;
}

export type FormEmailMode = 'none' | 'optional' | 'required';

export interface CustomFormSettings {
  acceptingResponses: boolean;
  isQuiz: boolean;
  collectRespondentName: boolean;
  emailMode: FormEmailMode;
  allowMultipleResponses: boolean;
  shuffleQuestions: boolean;
  confirmationMessage: string;
}

export interface CustomForm {
  id: string;
  title: string;
  description: string;
  themeId: FormThemeId;
  starred: boolean;
  published: boolean;
  questions: FormQuestion[];
  settings: CustomFormSettings;
  createdAtMs: number;
  updatedAtMs: number;
  ownerId?: string;
  ownerType?: 'google' | 'passcode';
  ownerDisplayName?: string;
  syncedToCloud?: boolean;
}

export interface FormResponseRecord {
  id: string;
  formId: string;
  respondentName: string;
  respondentEmail?: string;
  answers: Record<string, string | string[]>;
  score: number;
  maxScore: number;
  submittedAtMs: number;
  source?: 'local' | 'cloud';
  syncStatus?: 'local' | 'pending' | 'synced' | 'failed';
}

export const FORMS_STORAGE_KEY = 'pickerwel_custom_forms_v1';
export const FORM_RESPONSES_STORAGE_KEY = 'pickerwel_form_responses_v1';

function randomStr(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateFormId(): string {
  return `frm_${Date.now().toString(36)}_${randomStr(12)}`;
}

export function generateQuestionId(): string {
  return `q_${Date.now().toString(36)}_${randomStr(6)}`;
}

export function generateResponseId(): string {
  return `resp_${Date.now().toString(36)}_${randomStr(10)}`;
}

export function createDefaultQuestion(
  type: FormQuestionType = 'multiple_choice',
  lang: Language = 'km'
): FormQuestion {
  const km = lang === 'km';
  if (type === 'section') {
    return {
      id: generateQuestionId(),
      type: 'section',
      title: km ? 'ផ្នែកថ្មី' : 'Untitled Section',
      description: km ? 'ការពិពណ៌នាសម្រាប់ផ្នែកនេះ (ស្រេចចិត្ត)' : 'Description (optional)',
      required: false,
      options: [],
    };
  }
  return {
    id: generateQuestionId(),
    type,
    title: km ? 'សំណួរថ្មី' : 'Untitled Question',
    description: '',
    required: false,
    options:
      type === 'multiple_choice' || type === 'checkboxes' || type === 'dropdown'
        ? [km ? 'ជម្រើសទី ១' : 'Option 1', km ? 'ជម្រើសទី ២' : 'Option 2']
        : [],
    hasOther: false,
    scaleMin: 1,
    scaleMax: 5,
    scaleMinLabel: km ? 'តិចបំផុត' : 'Strongly disagree',
    scaleMaxLabel: km ? 'ច្រើនបំផុត' : 'Strongly agree',
    points: 1,
  };
}

export function duplicateCustomForm(form: CustomForm, copySuffix: string): CustomForm {
  const now = Date.now();
  return {
    ...form,
    id: generateFormId(),
    title: `${form.title} (${copySuffix})`,
    published: false,
    syncedToCloud: false,
    ownerId: undefined,
    questions: form.questions.map((q) => ({
      ...q,
      id: generateQuestionId(),
      options: [...q.options],
    })),
    createdAtMs: now,
    updatedAtMs: now,
  };
}

const STARTER_FORM_ID = 'frm_starter_default';
const STARTER_FORM_EPOCH_MS = 1700000000000;

export function createStarterForm(
  lang: Language = 'km',
  options?: { deterministic?: boolean }
): CustomForm {
  const deterministic = Boolean(options?.deterministic);
  const now = deterministic ? STARTER_FORM_EPOCH_MS : Date.now();
  const km = lang === 'km';
  return {
    id: deterministic ? STARTER_FORM_ID : generateFormId(),
    title: km
      ? 'ជ្រើសរើសកាលបរិច្ឆេទកម្មវិធីក្រុម (Team-Building Event)'
      : 'Team-Building Event Date Selection',
    description: km
      ? 'សូមបោះឆ្នោតជ្រើសរើសខែ និងកាលបរិច្ឆេទដែលអ្នកទំនេរសម្រាប់កម្មវិធីក្រុមនាពេលខាងមុខ។'
      : 'Please vote for your preferred dates for our upcoming team-building event.',
    themeId: 'purple',
    starred: false,
    published: false,
    questions: [
      {
        id: 'q_starter_month',
        type: 'multiple_choice',
        title: km ? 'តើខែណាដែលសមស្របបំផុតសម្រាប់អ្នក?' : 'Which month works best for you?',
        required: true,
        options: ['January 2027', 'February 2027'],
        hasOther: false,
        points: 1,
      },
      {
        id: 'q_starter_dates',
        type: 'checkboxes',
        title: km
          ? 'ជ្រើសរើសថ្ងៃទាំងអស់ក្នុងខែធ្នូដែលអ្នកទំនេរ។'
          : 'Select all dates in December that you are available.',
        required: false,
        options: [
          km ? 'ថ្ងៃសៅរ៍ ទី ៥ ធ្នូ' : 'Saturday, Dec 5',
          km ? 'ថ្ងៃអាទិត្យ ទី ៦ ធ្នូ' : 'Sunday, Dec 6',
          km ? 'ថ្ងៃសៅរ៍ ទី ១២ ធ្នូ' : 'Saturday, Dec 12',
          km ? 'ថ្ងៃសៅរ៍ ទី ១៩ ធ្នូ' : 'Saturday, Dec 19',
        ],
        hasOther: true,
        points: 1,
      },
      {
        id: 'q_starter_note',
        type: 'short_answer',
        title: km
          ? 'សកម្មភាព ឬមតិយោបល់បន្ថែម (ស្រេចចិត្ត)'
          : 'Suggested activities or notes (optional)',
        required: false,
        options: [],
        points: 0,
      },
    ],
    settings: {
      acceptingResponses: true,
      isQuiz: false,
      collectRespondentName: true,
      emailMode: 'none',
      allowMultipleResponses: true,
      shuffleQuestions: false,
      confirmationMessage: km
        ? 'សូមអរគុណ! ចម្លើយរបស់អ្នកត្រូវបានរក្សាទុកដោយជោគជ័យ។'
        : 'Thank you! Your response has been recorded.',
    },
    createdAtMs: now,
    updatedAtMs: now,
  };
}

export interface FormTemplatePreset {
  id: string;
  nameKm: string;
  nameEn: string;
  descKm: string;
  descEn: string;
  themeId: FormThemeId;
  build: (lang: Language) => CustomForm;
}

export const FORM_TEMPLATES: FormTemplatePreset[] = [
  {
    id: 'blank',
    nameKm: 'ទម្រង់ទទេថ្មី (Blank Form)',
    nameEn: 'Blank Form',
    descKm: 'ចាប់ផ្តើមបង្កើតសំណួរថ្មីពីទំព័រទទេតាមចិត្ត។',
    descEn: 'Start fresh with a clean blank form.',
    themeId: 'purple',
    build: (lang) => {
      const now = Date.now();
      const km = lang === 'km';
      return {
        id: generateFormId(),
        title: km ? 'ទម្រង់គ្មានចំណងជើង' : 'Untitled form',
        description: '',
        themeId: 'purple',
        starred: false,
        published: false,
        questions: [createDefaultQuestion('multiple_choice', lang)],
        settings: {
          acceptingResponses: true,
          isQuiz: false,
          collectRespondentName: true,
          emailMode: 'none',
          allowMultipleResponses: true,
          shuffleQuestions: false,
          confirmationMessage: km
            ? 'ចម្លើយរបស់អ្នកត្រូវបានកត់ត្រាដោយជោគជ័យ!'
            : 'Your response has been recorded!',
        },
        createdAtMs: now,
        updatedAtMs: now,
      };
    },
  },
  {
    id: 'attendance',
    nameKm: 'វត្តមានសិស្សប្រចាំថ្ងៃ (Attendance)',
    nameEn: 'Classroom Attendance Check-in',
    descKm: 'ស្រង់វត្តមាន ថ្នាក់រៀន និងកំណត់សម្គាល់របស់សិស្សយ៉ាងរហ័ស។',
    descEn: 'Quick daily attendance check-in with class selector and status.',
    themeId: 'teal',
    build: (lang) => {
      const now = Date.now();
      const km = lang === 'km';
      return {
        id: generateFormId(),
        title: km ? 'ទម្រង់ស្រង់វត្តមានសិស្ស' : 'Daily Classroom Attendance',
        description: km
          ? 'សូមបំពេញឈ្មោះ និងស្ថានភាពវត្តមានរបស់អ្នកមុនចាប់ផ្តើមមេរៀន។'
          : 'Please check in your attendance status before class begins.',
        themeId: 'teal',
        starred: false,
        published: false,
        questions: [
          {
            id: generateQuestionId(),
            type: 'dropdown',
            title: km ? 'ថ្នាក់រៀន / ក្រុម' : 'Class / Section',
            required: true,
            options: ['7A', '7B', '8A', '8B', '9A'],
          },
          {
            id: generateQuestionId(),
            type: 'multiple_choice',
            title: km ? 'ស្ថានភាពវត្តមាន' : 'Attendance Status',
            required: true,
            options: km
              ? ['មានវត្តមាន (Present)', 'មកយឺត (Late)', 'សុំច្បាប់ (Excused)']
              : ['Present', 'Late', 'Excused'],
          },
          {
            id: generateQuestionId(),
            type: 'date',
            title: km ? 'កាលបរិច្ឆេទ' : 'Date',
            required: true,
            options: [],
          },
        ],
        settings: {
          acceptingResponses: true,
          isQuiz: false,
          collectRespondentName: true,
          emailMode: 'none',
          allowMultipleResponses: true,
          shuffleQuestions: false,
          confirmationMessage: km
            ? 'បានកត់ត្រាវត្តមានរួចរាល់!'
            : 'Attendance recorded!',
        },
        createdAtMs: now,
        updatedAtMs: now,
      };
    },
  },
  {
    id: 'quiz',
    nameKm: 'តេស្តពិន្ទុស្វ័យប្រវត្តិ (Auto Quiz)',
    nameEn: 'Auto-Graded Exit Quiz',
    descKm: 'បង្កើតសំណួរពហុជម្រើសមានចម្លើយត្រឹមត្រូវ និងគណនាពិន្ទុភ្លាមៗ។',
    descEn: 'Multiple-choice classroom quiz with automatic scoring on submit.',
    themeId: 'indigo',
    build: (lang) => {
      const now = Date.now();
      const km = lang === 'km';
      return {
        id: generateFormId(),
        title: km ? 'តេស្តវាស់ស្ទង់ចុងមេរៀន' : 'Quick Lesson Exit Quiz',
        description: km
          ? 'ឆ្លើយសំណួរខាងក្រោមដើម្បីទទួលបានពិន្ទុដោយស្វ័យប្រវត្តិភ្លាមៗ។'
          : 'Answer the questions below to see your instant auto-graded score.',
        themeId: 'indigo',
        starred: false,
        published: false,
        questions: [
          {
            id: generateQuestionId(),
            type: 'multiple_choice',
            title: km ? 'តើ 12 × 8 ស្មើប៉ុន្មាន?' : 'What is 12 × 8?',
            required: true,
            options: ['84', '96', '104', '88'],
            correctOption: '96',
            points: 5,
          },
          {
            id: generateQuestionId(),
            type: 'multiple_choice',
            title: km ? 'តើទឹកពុះនៅសីតុណ្ហភាពប៉ុន្មានអង្សាសេ?' : 'At what temperature does water boil (°C)?',
            required: true,
            options: ['90°C', '100°C', '120°C', '80°C'],
            correctOption: '100°C',
            points: 5,
          },
          {
            id: generateQuestionId(),
            type: 'linear_scale',
            title: km ? 'តើអ្នកយល់មេរៀនថ្ងៃនេះកម្រិតណា?' : 'How confident do you feel about today’s lesson?',
            required: true,
            options: [],
            scaleMin: 1,
            scaleMax: 5,
            scaleMinLabel: km ? 'ត្រូវការពន្យល់បន្ថែម' : 'Need review',
            scaleMaxLabel: km ? 'យល់ច្បាស់ ១០០%' : 'Mastered it',
            points: 0,
          },
        ],
        settings: {
          acceptingResponses: true,
          isQuiz: true,
          collectRespondentName: true,
          emailMode: 'none',
          allowMultipleResponses: true,
          shuffleQuestions: false,
          confirmationMessage: km
            ? 'បានបញ្ជូនតេស្តរួចរាល់! សូមពិនិត្យពិន្ទុរបស់អ្នកខាងលើ។'
            : 'Quiz submitted! Check your score above.',
        },
        createdAtMs: now,
        updatedAtMs: now,
      };
    },
  },
  {
    id: 'feedback',
    nameKm: 'ស្ទង់មតិ & វាយតម្លៃ (Survey)',
    nameEn: 'Course & Event Feedback',
    descKm: 'ប្រមូលមតិយោបល់ដោយប្រើ Linear Scale, Checkboxes និង Paragraph។',
    descEn: 'Gather structured feedback with rating scales and open comments.',
    themeId: 'blue',
    build: (lang) => {
      const now = Date.now();
      const km = lang === 'km';
      return {
        id: generateFormId(),
        title: km ? 'ទម្រង់ស្ទង់មតិវាយតម្លៃវគ្គសិក្សា' : 'Workshop & Class Feedback',
        description: km
          ? 'មតិយោបល់របស់អ្នកជួយឱ្យការបង្រៀន និងកម្មវិធីលើកក្រោយកាន់តែល្អប្រសើរ។'
          : 'Your feedback helps us improve future sessions.',
        themeId: 'blue',
        starred: false,
        published: false,
        questions: [
          {
            id: generateQuestionId(),
            type: 'linear_scale',
            title: km ? 'កម្រិតពេញចិត្តជារួម' : 'Overall satisfaction rating',
            required: true,
            options: [],
            scaleMin: 1,
            scaleMax: 5,
            scaleMinLabel: km ? 'ទាប' : 'Poor',
            scaleMaxLabel: km ? 'ល្អប្រសើរ' : 'Excellent',
          },
          {
            id: generateQuestionId(),
            type: 'checkboxes',
            title: km ? 'តើផ្នែកណាខ្លះដែលអ្នកចូលចិត្តជាងគេ?' : 'Which parts did you enjoy most?',
            required: false,
            options: km
              ? ['ការពន្យល់ច្បាស់លាស់', 'ល្បែងកម្សាន្តអនុវត្ត', 'ការងារជាក្រុម', 'ឯកសារជំនួយ']
              : ['Clear explanation', 'Interactive games', 'Group work', 'Study materials'],
            hasOther: true,
          },
          {
            id: generateQuestionId(),
            type: 'paragraph',
            title: km ? 'សំណូមពរសម្រាប់លើកក្រោយ' : 'Suggestions for next time',
            required: false,
            options: [],
          },
        ],
        settings: {
          acceptingResponses: true,
          isQuiz: false,
          collectRespondentName: false,
          emailMode: 'none',
          allowMultipleResponses: true,
          shuffleQuestions: false,
          confirmationMessage: km
            ? 'សូមអរគុណសម្រាប់មតិយោបល់ដ៏មានតម្លៃរបស់អ្នក!'
            : 'Thank you for your valuable feedback!',
        },
        createdAtMs: now,
        updatedAtMs: now,
      };
    },
  },
  {
    id: 'stem_quiz',
    nameKm: 'វិញ្ញាសា គណិត•រូប•គីមី (STEM Quiz)',
    nameEn: 'Math, Physics & Chemistry Exam',
    descKm: 'គំរូសំណួរមានរូបមន្តគណិតវិទ្យា រូបវិទ្យា និងសមីការគីមីពេញលេញ។',
    descEn: 'Ready-to-use STEM quiz with Math, Physics, and Chemistry formulas.',
    themeId: 'purple',
    build: (lang) => {
      const now = Date.now();
      const km = lang === 'km';
      return {
        id: generateFormId(),
        title: km
          ? 'វិញ្ញាសាអនុវត្ត គណិតវិទ្យា • រូបវិទ្យា • គីមីវិទ្យា'
          : 'STEM Practice Exam (Math • Physics • Chemistry)',
        description: km
          ? 'សូមដោះស្រាយសំណួរខាងក្រោម។ សិស្សអាចប្រើប៊ូតុង fx ដើម្បីវាយរូបមន្តក្នុងចម្លើយបាន។'
          : 'Solve the STEM problems below. Respondents can use the fx formula keyboard for answers.',
        themeId: 'purple',
        starred: false,
        published: false,
        questions: [
          {
            id: generateQuestionId(),
            type: 'multiple_choice',
            title: km
              ? 'គណនាអាំងតេក្រាលកំណត់ $I = \\int_{0}^{1} 2x\\,dx$ ៖'
              : 'Evaluate the definite integral $I = \\int_{0}^{1} 2x\\,dx$:',
            required: true,
            options: ['$I = 1$', '$I = 2$', '$I = \\frac{1}{2}$', '$I = 0$'],
            correctOption: '$I = 1$',
            points: 5,
          },
          {
            id: generateQuestionId(),
            type: 'multiple_choice',
            title: km
              ? 'អង្គធាតុម៉ាស $m = 2\\text{ kg}$ ផ្លាស់ទីដោយល្បឿន $v = 5\\text{ m/s}$។ គណនាថាមពលស៊ីនេទិច $E_k = \\frac{1}{2}mv^2$ ៖'
              : 'An object of mass $m = 2\\text{ kg}$ moves at $v = 5\\text{ m/s}$. Find kinetic energy $E_k = \\frac{1}{2}mv^2$:',
            required: true,
            options: ['$25\\text{ J}$', '$10\\text{ J}$', '$50\\text{ J}$', '$5\\text{ J}$'],
            correctOption: '$25\\text{ J}$',
            points: 5,
          },
          {
            id: generateQuestionId(),
            type: 'multiple_choice',
            title: km
              ? 'តើសមីការគីមីណាដែលមានលំនឹងត្រឹមត្រូវសម្រាប់ប្រតិកម្ម $\\ce{H2}$ និង $\\ce{O2}$?'
              : 'Which balanced chemical equation represents the reaction of $\\ce{H2}$ and $\\ce{O2}$?',
            required: true,
            options: [
              '$\\ce{2H2 + O2 ->[t^\\circ] 2H2O}$',
              '$\\ce{H2 + O2 -> H2O}$',
              '$\\ce{H2 + 2O2 -> 2H2O}$',
              '$\\ce{2H2 + 2O2 -> 2H2O}$',
            ],
            correctOption: '$\\ce{2H2 + O2 ->[t^\\circ] 2H2O}$',
            points: 5,
          },
          {
            id: generateQuestionId(),
            type: 'short_answer',
            title: km
              ? 'សរសេររូបមន្តឫសសមីការដឺក្រេទី២ $ax^2 + bx + c = 0$ ឬសមីការគីមីបំបែក $\\ce{CaCO3}$ ៖'
              : 'Write the quadratic formula for $ax^2 + bx + c = 0$ or the decomposition of $\\ce{CaCO3}$:',
            required: false,
            options: [],
            points: 0,
          },
        ],
        settings: {
          acceptingResponses: true,
          isQuiz: true,
          collectRespondentName: true,
          emailMode: 'none',
          allowMultipleResponses: true,
          shuffleQuestions: false,
          confirmationMessage: km
            ? 'បានបញ្ជូនវិញ្ញាសារួចរាល់! សូមពិនិត្យពិន្ទុរបស់អ្នក។'
            : 'STEM exam submitted! Check your score above.',
        },
        createdAtMs: now,
        updatedAtMs: now,
      };
    },
  },
];

export function isValidEmailAddress(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 120) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

function normalizeFormRecord(raw: CustomForm): CustomForm {
  const rawMode = raw?.settings?.emailMode;
  const emailMode: FormEmailMode =
    rawMode === 'required' || rawMode === 'optional' ? rawMode : 'none';
  return {
    ...raw,
    settings: {
      acceptingResponses: raw?.settings?.acceptingResponses !== false,
      isQuiz: Boolean(raw?.settings?.isQuiz),
      collectRespondentName: raw?.settings?.collectRespondentName !== false,
      emailMode,
      allowMultipleResponses: raw?.settings?.allowMultipleResponses !== false,
      shuffleQuestions: Boolean(raw?.settings?.shuffleQuestions),
      confirmationMessage: String(raw?.settings?.confirmationMessage || ''),
    },
  };
}

export function loadLocalForms(): CustomForm[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FORMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomForm[];
    return Array.isArray(parsed) ? parsed.map(normalizeFormRecord) : [];
  } catch {
    return [];
  }
}

export function saveLocalForms(forms: CustomForm[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FORMS_STORAGE_KEY, JSON.stringify(forms));
  } catch {
    // Ignore storage quota issues
  }
}

export function loadLocalFormResponses(formId?: string): FormResponseRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FORM_RESPONSES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FormResponseRecord[];
    if (!Array.isArray(parsed)) return [];
    return formId ? parsed.filter((r) => r.formId === formId) : parsed;
  } catch {
    return [];
  }
}

export function saveLocalFormResponse(record: FormResponseRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const all = loadLocalFormResponses();
    const deduped = all.filter((r) => r.id !== record.id);
    const next = [record, ...deduped].slice(0, 500);
    localStorage.setItem(FORM_RESPONSES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota issues
  }
}

export function updateLocalFormResponse(
  responseId: string,
  patch: Partial<FormResponseRecord>
): void {
  if (typeof window === 'undefined') return;
  try {
    const all = loadLocalFormResponses();
    const next = all.map((r) => (r.id === responseId ? { ...r, ...patch } : r));
    localStorage.setItem(FORM_RESPONSES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota issues
  }
}

export function deleteLocalFormResponse(responseId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const all = loadLocalFormResponses();
    localStorage.setItem(
      FORM_RESPONSES_STORAGE_KEY,
      JSON.stringify(all.filter((r) => r.id !== responseId))
    );
  } catch {
    // Ignore storage quota issues
  }
}

export function clearLocalFormResponses(formId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const all = loadLocalFormResponses();
    localStorage.setItem(
      FORM_RESPONSES_STORAGE_KEY,
      JSON.stringify(all.filter((r) => r.formId !== formId))
    );
  } catch {
    // Ignore storage quota issues
  }
}

export function scoreFormSubmission(
  form: CustomForm,
  answers: Record<string, string | string[]>
): { score: number; maxScore: number } {
  if (!form.settings.isQuiz) return { score: 0, maxScore: 0 };
  let score = 0;
  let maxScore = 0;
  for (const q of form.questions) {
    if (q.type === 'section') continue;
    const pts = Math.max(0, Number(q.points || 0));
    if (!q.correctOption || pts <= 0) continue;
    maxScore += pts;
    const ans = answers[q.id];
    if (typeof ans === 'string' && ans.trim() === q.correctOption.trim()) {
      score += pts;
    }
  }
  return { score, maxScore };
}

export function exportFormResponsesToCsv(
  form: CustomForm,
  responses: FormResponseRecord[]
): string {
  const answerable = form.questions.filter((q) => q.type !== 'section');
  const includeEmail =
    form.settings.emailMode !== 'none' ||
    responses.some((r) => Boolean(r.respondentEmail && r.respondentEmail.trim()));
  const escapeCsv = (val: string) => {
    const safe = val.replace(/"/g, '""');
    return /[",\n\r]/.test(safe) ? `"${safe}"` : safe;
  };
  const headers = [
    'Submitted At',
    'Respondent',
    ...(includeEmail ? ['Email'] : []),
    ...(form.settings.isQuiz ? ['Score'] : []),
    ...answerable.map((q) => q.title || q.id),
  ];
  const rows = responses.map((r) => {
    const dt = new Date(r.submittedAtMs).toISOString();
    const cells = [
      dt,
      r.respondentName || 'Anonymous',
      ...(includeEmail ? [r.respondentEmail || ''] : []),
      ...(form.settings.isQuiz ? [`${r.score}/${r.maxScore}`] : []),
      ...answerable.map((q) => {
        const val = r.answers[q.id];
        if (Array.isArray(val)) return val.join('; ');
        return typeof val === 'string' ? val : '';
      }),
    ];
    return cells.map(escapeCsv).join(',');
  });
  return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
}

export function exportOfflineFormPackageJson(
  form: CustomForm,
  responses: FormResponseRecord[]
): string {
  return JSON.stringify(
    {
      format: 'pickerwel-offline-form-v1',
      exportedAtMs: Date.now(),
      form,
      responses,
    },
    null,
    2
  );
}

export function parseOfflineFormPackageJson(
  rawJson: string
): { form: CustomForm; responses: FormResponseRecord[] } | null {
  try {
    const parsed = JSON.parse(rawJson) as {
      format?: string;
      form?: CustomForm;
      responses?: FormResponseRecord[];
    };
    const candidate = parsed?.form || (parsed as unknown as CustomForm);
    if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.questions)) {
      return null;
    }
    const normalized = normalizeFormRecord({
      ...candidate,
      id: candidate.id || generateFormId(),
      published: false,
      syncedToCloud: false,
    });
    const responses = Array.isArray(parsed?.responses)
      ? parsed.responses
          .filter((r) => r && typeof r === 'object')
          .map((r) => ({
            ...r,
            formId: normalized.id,
            source: 'local' as const,
          }))
      : [];
    return { form: normalized, responses };
  } catch {
    return null;
  }
}

export function encodeOfflineFormPayload(form: CustomForm): string | null {
  try {
    const compact: CustomForm = {
      ...form,
      published: Boolean(form.syncedToCloud && form.ownerId && form.published),
      syncedToCloud: Boolean(form.syncedToCloud && form.ownerId),
      ownerId: form.syncedToCloud && form.ownerId ? form.ownerId : undefined,
      questions: form.questions.map((q) => ({
        ...q,
        imageUrl: undefined,
      })),
    };
    const json = JSON.stringify(compact);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (b64.length > 2600) return null;
    return b64;
  } catch {
    return null;
  }
}

export function decodeOfflineFormPayload(encoded: string): CustomForm | null {
  try {
    const normalizedB64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalizedB64.length % 4;
    const padded = pad ? normalizedB64 + '='.repeat(4 - pad) : normalizedB64;
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as CustomForm;
    if (!parsed || !Array.isArray(parsed.questions)) return null;
    return normalizeFormRecord(parsed);
  } catch {
    return null;
  }
}
