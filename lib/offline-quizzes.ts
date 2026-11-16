export interface QuizQuestion {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  timeLimitSec: number;
}

export interface OfflineQuiz {
  id: string;
  title: string;
  subject: string;
  questions: QuizQuestion[];
}

export const STARTER_OFFLINE_QUIZZES: OfflineQuiz[] = [
  {
    id: 'khmer_general_1',
    title: 'ចំណេះដឹងទូទៅ និងវប្បធម៌ខ្មែរ',
    subject: 'វប្បធម៌ទូទៅ',
    questions: [
      {
        id: 'q1',
        prompt: 'តើប្រាសាទអង្គរវត្តត្រូវបានសាងសង់ឡើងនៅសតវត្សទីប៉ុន្មាន?',
        options: ['សតវត្សទី ១០', 'សតវត្សទី ១២', 'សតវត្សទី ១៤', 'សតវត្សទី ១៦'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'q2',
        prompt: 'តើទន្លេណាដែលហូរកាត់រាជធានីភ្នំពេញ និងជាទន្លេប្រសព្វបួនមុខ?',
        options: ['ទន្លេមេគង្គ', 'ទន្លេសេកុង', 'ទន្លេស្រែពក', 'ទន្លេសាន'],
        correctIndex: 0,
        timeLimitSec: 20,
      },
      {
        id: 'q3',
        prompt: 'តើខេត្តណាដែលមានផ្ទៃដីធំជាងគេនៅប្រទេសកម្ពុជា?',
        options: ['កំពង់ធំ', 'បាត់ដំបង', 'មណ្ឌលគិរី', 'សៀមរាប'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
      {
        id: 'q4',
        prompt: 'តើភ្នំខ្ពស់ជាងគេនៅប្រទេសកម្ពុជាឈ្មោះអ្វី?',
        options: ['ភ្នំបូកគោ', 'ភ្នំគូលែន', 'ភ្នំឱរ៉ាល់', 'ភ្នំសំពៅ'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
      {
        id: 'q5',
        prompt: 'តើថ្ងៃបុណ្យឯករាជ្យជាតិកម្ពុជាប្រារព្ធឡើងនៅថ្ងៃទីប៉ុន្មាន?',
        options: ['៩ វិច្ឆិកា', '៧ មករា', '២៤ កញ្ញា', '១៣ មេសា'],
        correctIndex: 0,
        timeLimitSec: 20,
      },
      {
        id: 'q6',
        prompt: 'តើផ្ការំដួលជាផ្កាតំណាងឱ្យអ្វីនៅកម្ពុជា?',
        options: ['ផ្កាប្រចាំរដូវភ្លៀង', 'ផ្កាជាតិតំណាងប្រទេស', 'ផ្កាប្រចាំតំបន់ឆ្នេរ', 'ផ្កាប្រចាំទីក្រុង'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
    ],
  },
  {
    id: 'quick_math_1',
    title: 'គណិតវិទ្យារហ័ស (Quick Math)',
    subject: 'គណិតវិទ្យា',
    questions: [
      {
        id: 'm1',
        prompt: 'តើ 15 × 6 ស្មើនឹងប៉ុន្មាន?',
        options: ['75', '85', '90', '96'],
        correctIndex: 2,
        timeLimitSec: 15,
      },
      {
        id: 'm2',
        prompt: 'បើ 3x + 7 = 22 តើ x ស្មើនឹងប៉ុន្មាន?',
        options: ['4', '5', '6', '7'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'm3',
        prompt: 'តើផលបូកមុំខាងក្នុងនៃត្រីកោណមួយស្មើនឹងប៉ុន្មានដឺក្រេ?',
        options: ['90°', '180°', '270°', '360°'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
      {
        id: 'm4',
        prompt: 'តើ 25% នៃ 200 ស្មើនឹងប៉ុន្មាន?',
        options: ['25', '40', '50', '75'],
        correctIndex: 2,
        timeLimitSec: 15,
      },
      {
        id: 'm5',
        prompt: 'តើ √144 ស្មើនឹងប៉ុន្មាន?',
        options: ['11', '12', '13', '14'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
    ],
  },
  {
    id: 'science_tech_1',
    title: 'វិទ្យាសាស្ត្រ និងបច្ចេកវិទ្យា',
    subject: 'វិទ្យាសាស្ត្រ',
    questions: [
      {
        id: 's1',
        prompt: 'តើភពណាដែលនៅជិតព្រះអាទិត្យជាងគេ?',
        options: ['ភពសុក្រ (Venus)', 'ភពពុធ (Mercury)', 'ភពផែនដី (Earth)', 'ភពអង្គារ (Mars)'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 's2',
        prompt: 'តើនិមិត្តសញ្ញាគីមីនៃទឹក (Water) គឺជាអ្វី?',
        options: ['CO2', 'O2', 'H2O', 'NaCl'],
        correctIndex: 2,
        timeLimitSec: 15,
      },
      {
        id: 's3',
        prompt: 'តើឧស្ម័នអ្វីដែលមានភាគរយច្រើនជាងគេនៅក្នុងបរិយាកាសផែនដី?',
        options: ['អុកស៊ីសែន', 'អាសូត (Nitrogen)', 'កាបូនឌីអុកស៊ីត', 'អ៊ីដ្រូសែន'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 's4',
        prompt: 'តើ CPU នៅក្នុងកុំព្យូទ័រតំណាងឱ្យពាក្យពេញអ្វី?',
        options: [
          'Central Processing Unit',
          'Computer Power Unit',
          'Core Program Utility',
          'Central Peripheral Unit',
        ],
        correctIndex: 0,
        timeLimitSec: 20,
      },
    ],
  },
];

const QUIZ_STORAGE_KEY = 'pickerwel_offline_quizzes_v1';

export function loadOfflineQuizzes(): OfflineQuiz[] {
  if (typeof window === 'undefined') return STARTER_OFFLINE_QUIZZES;
  try {
    const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
    if (!raw) return STARTER_OFFLINE_QUIZZES;
    const parsed = JSON.parse(raw) as OfflineQuiz[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : STARTER_OFFLINE_QUIZZES;
  } catch {
    return STARTER_OFFLINE_QUIZZES;
  }
}

export function saveOfflineQuizzes(quizzes: OfflineQuiz[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(quizzes));
  } catch {
    // Ignore storage quota errors
  }
}
