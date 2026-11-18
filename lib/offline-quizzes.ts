export interface QuizQuestion {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  timeLimitSec: number;
}

export type SubjectId =
  | 'math'
  | 'khmer'
  | 'english'
  | 'science'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'earth'
  | 'history'
  | 'geography'
  | 'civics'
  | 'ict'
  | 'general';

export type GradeId =
  | 'general'
  | 'grade_1'
  | 'grade_2'
  | 'grade_3'
  | 'grade_4'
  | 'grade_5'
  | 'grade_6'
  | 'grade_7'
  | 'grade_8'
  | 'grade_9'
  | 'grade_10'
  | 'grade_11'
  | 'grade_12';

export type GradeGroupId = 'primary' | 'lower_secondary' | 'upper_secondary' | 'general';

export interface SubjectInfo {
  id: SubjectId;
  labelKm: string;
  labelEn: string;
  recommendedGroups: GradeGroupId[];
}

export interface GradeInfo {
  id: GradeId;
  number: number | null;
  group: GradeGroupId;
  labelKm: string;
  labelEn: string;
  shortKm: string;
  shortEn: string;
}

export const SUBJECT_CATALOG: SubjectInfo[] = [
  { id: 'math', labelKm: 'គណិតវិទ្យា', labelEn: 'Mathematics', recommendedGroups: ['primary', 'lower_secondary', 'upper_secondary'] },
  { id: 'khmer', labelKm: 'ភាសាខ្មែរ', labelEn: 'Khmer Language', recommendedGroups: ['primary', 'lower_secondary', 'upper_secondary'] },
  { id: 'english', labelKm: 'ភាសាអង់គ្លេស', labelEn: 'English', recommendedGroups: ['primary', 'lower_secondary', 'upper_secondary'] },
  { id: 'science', labelKm: 'វិទ្យាសាស្ត្រ', labelEn: 'Science', recommendedGroups: ['primary', 'general'] },
  { id: 'physics', labelKm: 'រូបវិទ្យា', labelEn: 'Physics', recommendedGroups: ['lower_secondary', 'upper_secondary'] },
  { id: 'chemistry', labelKm: 'គីមីវិទ្យា', labelEn: 'Chemistry', recommendedGroups: ['lower_secondary', 'upper_secondary'] },
  { id: 'biology', labelKm: 'ជីវវិទ្យា', labelEn: 'Biology', recommendedGroups: ['lower_secondary', 'upper_secondary'] },
  { id: 'earth', labelKm: 'ផែនដីវិទ្យា', labelEn: 'Earth Science', recommendedGroups: ['lower_secondary', 'upper_secondary'] },
  { id: 'history', labelKm: 'ប្រវត្តិវិទ្យា', labelEn: 'History', recommendedGroups: ['primary', 'lower_secondary', 'upper_secondary'] },
  { id: 'geography', labelKm: 'ភូមិវិទ្យា', labelEn: 'Geography', recommendedGroups: ['primary', 'lower_secondary', 'upper_secondary'] },
  { id: 'civics', labelKm: 'សីលធម៌-ពលរដ្ឋ', labelEn: 'Civics & Ethics', recommendedGroups: ['primary', 'lower_secondary', 'upper_secondary'] },
  { id: 'ict', labelKm: 'ព័ត៌មានវិទ្យា (ICT)', labelEn: 'ICT & Computing', recommendedGroups: ['primary', 'lower_secondary', 'upper_secondary'] },
  { id: 'general', labelKm: 'វប្បធម៌ទូទៅ', labelEn: 'General Knowledge', recommendedGroups: ['general'] },
];

export const GRADE_LEVELS: GradeInfo[] = [
  { id: 'grade_1', number: 1, group: 'primary', labelKm: 'ថ្នាក់ទី ១', labelEn: 'Grade 1', shortKm: 'ទី ១', shortEn: 'G1' },
  { id: 'grade_2', number: 2, group: 'primary', labelKm: 'ថ្នាក់ទី ២', labelEn: 'Grade 2', shortKm: 'ទី ២', shortEn: 'G2' },
  { id: 'grade_3', number: 3, group: 'primary', labelKm: 'ថ្នាក់ទី ៣', labelEn: 'Grade 3', shortKm: 'ទី ៣', shortEn: 'G3' },
  { id: 'grade_4', number: 4, group: 'primary', labelKm: 'ថ្នាក់ទី ៤', labelEn: 'Grade 4', shortKm: 'ទី ៤', shortEn: 'G4' },
  { id: 'grade_5', number: 5, group: 'primary', labelKm: 'ថ្នាក់ទី ៥', labelEn: 'Grade 5', shortKm: 'ទី ៥', shortEn: 'G5' },
  { id: 'grade_6', number: 6, group: 'primary', labelKm: 'ថ្នាក់ទី ៦', labelEn: 'Grade 6', shortKm: 'ទី ៦', shortEn: 'G6' },
  { id: 'grade_7', number: 7, group: 'lower_secondary', labelKm: 'ថ្នាក់ទី ៧', labelEn: 'Grade 7', shortKm: 'ទី ៧', shortEn: 'G7' },
  { id: 'grade_8', number: 8, group: 'lower_secondary', labelKm: 'ថ្នាក់ទី ៨', labelEn: 'Grade 8', shortKm: 'ទី ៨', shortEn: 'G8' },
  { id: 'grade_9', number: 9, group: 'lower_secondary', labelKm: 'ថ្នាក់ទី ៩', labelEn: 'Grade 9', shortKm: 'ទី ៩', shortEn: 'G9' },
  { id: 'grade_10', number: 10, group: 'upper_secondary', labelKm: 'ថ្នាក់ទី ១០', labelEn: 'Grade 10', shortKm: 'ទី ១០', shortEn: 'G10' },
  { id: 'grade_11', number: 11, group: 'upper_secondary', labelKm: 'ថ្នាក់ទី ១១', labelEn: 'Grade 11', shortKm: 'ទី ១១', shortEn: 'G11' },
  { id: 'grade_12', number: 12, group: 'upper_secondary', labelKm: 'ថ្នាក់ទី ១២', labelEn: 'Grade 12', shortKm: 'ទី ១២', shortEn: 'G12' },
  { id: 'general', number: null, group: 'general', labelKm: 'ទូទៅ / គ្រប់កម្រិត', labelEn: 'All / General', shortKm: 'ទូទៅ', shortEn: 'Gen' },
];

export const GRADE_GROUPS: { id: GradeGroupId; labelKm: string; labelEn: string }[] = [
  { id: 'primary', labelKm: 'បឋមសិក្សា (ទី ១–៦)', labelEn: 'Primary (Grades 1–6)' },
  { id: 'lower_secondary', labelKm: 'អនុវិទ្យាល័យ (ទី ៧–៩)', labelEn: 'Lower Secondary (Grades 7–9)' },
  { id: 'upper_secondary', labelKm: 'វិទ្យាល័យ (ទី ១០–១២)', labelEn: 'High School (Grades 10–12)' },
  { id: 'general', labelKm: 'កម្រិតទូទៅ', labelEn: 'General Level' },
];

export interface OfflineQuiz {
  id: string;
  title: string;
  subject: string;
  subjectId?: SubjectId;
  gradeId?: GradeId;
  questions: QuizQuestion[];
}

export function getSubjectLabel(subjectId: SubjectId, language: 'km' | 'en'): string {
  const found = SUBJECT_CATALOG.find((s) => s.id === subjectId);
  if (!found) return language === 'km' ? 'ទូទៅ' : 'General';
  return language === 'km' ? found.labelKm : found.labelEn;
}

export function getGradeLabel(gradeId: GradeId, language: 'km' | 'en', short = false): string {
  const found = GRADE_LEVELS.find((g) => g.id === gradeId);
  if (!found) return language === 'km' ? 'ទូទៅ' : 'General';
  if (short) return language === 'km' ? found.shortKm : found.shortEn;
  return language === 'km' ? found.labelKm : found.labelEn;
}

export function resolveQuizSubjectId(quiz: OfflineQuiz): SubjectId {
  if (quiz.subjectId && SUBJECT_CATALOG.some((s) => s.id === quiz.subjectId)) {
    return quiz.subjectId;
  }
  const s = `${quiz.subject} ${quiz.title}`.toLowerCase();
  if (s.includes('គណិត') || s.includes('math')) return 'math';
  if (s.includes('ភាសាខ្មែរ') || s.includes('អក្សរសាស្ត្រ') || s.includes('khmer')) return 'khmer';
  if (s.includes('អង់គ្លេស') || s.includes('english')) return 'english';
  if (s.includes('រូបវិទ្យា') || s.includes('physics')) return 'physics';
  if (s.includes('គីមី') || s.includes('chem')) return 'chemistry';
  if (s.includes('ជីវ') || s.includes('bio')) return 'biology';
  if (s.includes('ផែនដី') || s.includes('earth')) return 'earth';
  if (s.includes('ប្រវត្តិ') || s.includes('history')) return 'history';
  if (s.includes('ភូមិ') || s.includes('geo')) return 'geography';
  if (s.includes('សីលធម៌') || s.includes('ពលរដ្ឋ') || s.includes('civic')) return 'civics';
  if (s.includes('ព័ត៌មាន') || s.includes('ict') || s.includes('កុំព្យូទ័រ')) return 'ict';
  if (s.includes('វិទ្យាសាស្ត្រ') || s.includes('science')) return 'science';
  return 'general';
}

export function resolveQuizGradeId(quiz: OfflineQuiz): GradeId {
  if (quiz.gradeId && GRADE_LEVELS.some((g) => g.id === quiz.gradeId)) {
    return quiz.gradeId;
  }
  return 'general';
}

export const STARTER_OFFLINE_QUIZZES: OfflineQuiz[] = [
  // =========================================================
  // MATHEMATICS — GRADES 1 TO 12 (MathType / LaTeX Formatted)
  // =========================================================
  {
    id: 'math_g1',
    title: 'លំហាត់បូក និងដកលេខ ១ ខ្ទង់',
    subject: 'គណិតវិទ្យា',
    subjectId: 'math',
    gradeId: 'grade_1',
    questions: [
      {
        id: 'mg1_1',
        prompt: 'គណនាផលបូក៖ $4 + 3 = ?$',
        options: ['$6$', '$7$', '$8$', '$9$'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
      {
        id: 'mg1_2',
        prompt: 'គណនាផលដក៖ $9 - 5 = ?$',
        options: ['$3$', '$4$', '$5$', '$6$'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
      {
        id: 'mg1_3',
        prompt: 'សុខមានប៊ិច $6$ ដើម ទិញថែម $4$ ដើមទៀត។ តើសុខមានប៊ិចសរុបប៉ុន្មានដើម?',
        options: ['$8$', '$9$', '$10$', '$11$'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
    ],
  },
  {
    id: 'math_g2',
    title: 'ចំនួន ២ ខ្ទង់ និងមេគុណដំបូង',
    subject: 'គណិតវិទ្យា',
    subjectId: 'math',
    gradeId: 'grade_2',
    questions: [
      {
        id: 'mg2_1',
        prompt: 'គណនា៖ $25 + 14 = ?$',
        options: ['$37$', '$38$', '$39$', '$41$'],
        correctIndex: 2,
        timeLimitSec: 15,
      },
      {
        id: 'mg2_2',
        prompt: 'គណនា៖ $48 - 16 = ?$',
        options: ['$32$', '$34$', '$22$', '$36$'],
        correctIndex: 0,
        timeLimitSec: 15,
      },
      {
        id: 'mg2_3',
        prompt: 'គណនាផលគុណ៖ $3 \\times 5 = ?$',
        options: ['$12$', '$15$', '$18$', '$20$'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
    ],
  },
  {
    id: 'math_g3',
    title: 'ផលគុណ ផលចែក និងបរិមាត្រ',
    subject: 'គណិតវិទ្យា',
    subjectId: 'math',
    gradeId: 'grade_3',
    questions: [
      {
        id: 'mg3_1',
        prompt: 'គណនា៖ $8 \\times 7 = ?$',
        options: ['$54$', '$56$', '$64$', '$48$'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
      {
        id: 'mg3_2',
        prompt: 'គណនាផលចែក៖ $63 \\div 9 = ?$',
        options: ['$6$', '$7$', '$8$', '$9$'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
      {
        id: 'mg3_3',
        prompt: 'ការ៉េមួយមានជ្រុងប្រវែង $6\\text{ cm}$។ តើបរិមាត្ររបស់វាស្មើប៉ុន្មាន?',
        options: ['$12\\text{ cm}$', '$18\\text{ cm}$', '$24\\text{ cm}$', '$36\\text{ cm}$'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
    ],
  },
  {
    id: 'math_g4',
    title: 'ប្រភាគ និងខ្នាតរង្វាស់',
    subject: 'គណិតវិទ្យា',
    subjectId: 'math',
    gradeId: 'grade_4',
    questions: [
      {
        id: 'mg4_1',
        prompt: 'គណនាផលបូកប្រភាគ៖ $\\frac{2}{5} + \\frac{1}{5} = ?$',
        options: ['$\\frac{3}{10}$', '$\\frac{3}{5}$', '$\\frac{2}{5}$', '$\\frac{4}{5}$'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'mg4_2',
        prompt: 'តើ $3\\text{ kg}$ ស្មើនឹងប៉ុន្មានក្រាម ($\\text{g}$)?',
        options: ['$300\\text{ g}$', '$3000\\text{ g}$', '$30\\text{ g}$', '$30000\\text{ g}$'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
      {
        id: 'mg4_3',
        prompt: 'តើមុំកែងមានរង្វាស់ស្មើនឹងប៉ុន្មានដឺក្រេ?',
        options: ['$45^\\circ$', '$90^\\circ$', '$180^\\circ$', '$360^\\circ$'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
    ],
  },
  {
    id: 'math_g5',
    title: 'ចំនួនទសភាគ ភាគរយ និងផ្ទៃក្រឡា',
    subject: 'គណិតវិទ្យា',
    subjectId: 'math',
    gradeId: 'grade_5',
    questions: [
      {
        id: 'mg5_1',
        prompt: 'តើ $25\\%$ នៃ $200$ ស្មើនឹងប៉ុន្មាន?',
        options: ['$25$', '$40$', '$50$', '$75$'],
        correctIndex: 2,
        timeLimitSec: 15,
      },
      {
        id: 'mg5_2',
        prompt: 'គណនា៖ $3.5 + 2.75 = ?$',
        options: ['$5.25$', '$6.15$', '$6.25$', '$6.35$'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
      {
        id: 'mg5_3',
        prompt: 'ត្រីកោណមួយមានបាត $10\\text{ cm}$ និងកម្ពស់ $6\\text{ cm}$។ តើផ្ទៃក្រឡាស្មើប៉ុន្មាន?',
        options: ['$16\\text{ cm}^2$', '$30\\text{ cm}^2$', '$60\\text{ cm}^2$', '$20\\text{ cm}^2$'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
    ],
  },
  {
    id: 'math_g6',
    title: 'ផលធៀប ប្រភាគ និងមាឌ',
    subject: 'គណិតវិទ្យា',
    subjectId: 'math',
    gradeId: 'grade_6',
    questions: [
      {
        id: 'mg6_1',
        prompt: 'គណនា៖ $\\frac{3}{4} \\times \\frac{8}{9} = ?$',
        options: ['$\\frac{1}{3}$', '$\\frac{2}{3}$', '$\\frac{3}{8}$', '$\\frac{4}{9}$'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'mg6_2',
        prompt: 'គូបមួយមានជ្រុងប្រវែង $4\\text{ cm}$។ តើមាឌរបស់គូបស្មើនឹងប៉ុន្មាន?',
        options: ['$16\\text{ cm}^3$', '$48\\text{ cm}^3$', '$64\\text{ cm}^3$', '$24\\text{ cm}^3$'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
      {
        id: 'mg6_3',
        prompt: 'រក $x$ បើ $\\frac{x}{12} = \\frac{3}{4}$ ៖',
        options: ['$x = 6$', '$x = 8$', '$x = 9$', '$x = 10$'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
    ],
  },
  {
    id: 'math_g7',
    title: 'សមីការដឺក្រេទី១ និងស្វ័យគុណ',
    subject: 'គណិតវិទ្យា',
    subjectId: 'math',
    gradeId: 'grade_7',
    questions: [
      {
        id: 'mg7_1',
        prompt: 'បើ $3x + 7 = 22$ តើ $x$ ស្មើនឹងប៉ុន្មាន?',
        options: ['$4$', '$5$', '$6$', '$7$'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'mg7_2',
        prompt: 'គណនាតម្លៃស្វ័យគុណ៖ $2^3 \\times 2^2 = ?$',
        options: ['$16$', '$24$', '$32$', '$64$'],
        correctIndex: 2,
        timeLimitSec: 15,
      },
      {
        id: 'mg7_3',
        prompt: 'ដោះស្រាយសមីការ $\\frac{2x + 4}{3} = 6$ រកតម្លៃ $x$ ៖',
        options: ['$x = 5$', '$x = 7$', '$x = 8$', '$x = 9$'],
        correctIndex: 1,
        timeLimitSec: 25,
      },
      {
        id: 'mg7_4',
        prompt: 'តើផលបូកមុំខាងក្នុងនៃត្រីកោណមួយស្មើនឹងប៉ុន្មានដឺក្រេ?',
        options: ['$90^\\circ$', '$180^\\circ$', '$270^\\circ$', '$360^\\circ$'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
    ],
  },
  {
    id: 'math_g8',
    title: 'ពហុធា វិសមីការ និងទ្រឹស្តីបទពីតាគ័រ',
    subject: 'គណិតវិទ្យា',
    subjectId: 'math',
    gradeId: 'grade_8',
    questions: [
      {
        id: 'mg8_1',
        prompt: 'ពន្លាតកន្សោម $(x + 3)^2$ ស្មើនឹង៖',
        options: ['$x^2 + 9$', '$x^2 + 3x + 9$', '$x^2 + 6x + 9$', '$x^2 + 6x + 6$'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
      {
        id: 'mg8_2',
        prompt: 'ត្រីកោណកែងមានជ្រុងជាប់មុំកែង $3\\text{ cm}$ និង $4\\text{ cm}$។ តើអ៊ីប៉ូតេនុសស្មើប៉ុន្មាន?',
        options: ['$5\\text{ cm}$', '$6\\text{ cm}$', '$7\\text{ cm}$', '$25\\text{ cm}$'],
        correctIndex: 0,
        timeLimitSec: 20,
      },
      {
        id: 'mg8_3',
        prompt: 'តើ $\\sqrt{144}$ ស្មើនឹងប៉ុន្មាន?',
        options: ['$11$', '$12$', '$13$', '$14$'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
    ],
  },
  {
    id: 'math_g9',
    title: 'សមីការដឺក្រេទី២ និងប្រព័ន្ធសមីការ',
    subject: 'គណិតវិទ្យា',
    subjectId: 'math',
    gradeId: 'grade_9',
    questions: [
      {
        id: 'mg9_1',
        prompt: 'ដោះស្រាយសមីការ $x^2 - 5x + 6 = 0$ ៖',
        options: ['$x=1, x=6$', '$x=2, x=3$', '$x=-2, x=-3$', '$x=-1, x=6$'],
        correctIndex: 1,
        timeLimitSec: 25,
      },
      {
        id: 'mg9_2',
        prompt: 'បើ $x + y = 10$ និង $x - y = 4$ តើ $(x, y)$ ស្មើនឹងប៉ុន្មាន?',
        options: ['$(6, 4)$', '$(7, 3)$', '$(8, 2)$', '$(5, 5)$'],
        correctIndex: 1,
        timeLimitSec: 25,
      },
      {
        id: 'mg9_3',
        prompt: 'សម្រួលកន្សោមរ៉ាឌីកាល់ $\\sqrt{50} + \\sqrt{18}$ ៖',
        options: ['$8\\sqrt{2}$', '$6\\sqrt{2}$', '$\\sqrt{68}$', '$7\\sqrt{2}$'],
        correctIndex: 0,
        timeLimitSec: 25,
      },
    ],
  },
  {
    id: 'math_g10',
    title: 'ត្រីកោណមាត្រ និងវ៉ិចទ័រ',
    subject: 'គណិតវិទ្យា',
    subjectId: 'math',
    gradeId: 'grade_10',
    questions: [
      {
        id: 'mg10_1',
        prompt: 'គណនាតម្លៃ $\\sin^2(x) + \\cos^2(x) = ?$',
        options: ['$0$', '$1$', '$2$', '$\\tan(x)$'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
      {
        id: 'mg10_2',
        prompt: 'ប្រសិនបើ $\\vec{u} = (3, 4)$ តើប្រវែងវ៉ិចទ័រ $\\|\\vec{u}\\|$ ស្មើប៉ុន្មាន?',
        options: ['$5$', '$7$', '$12$', '$25$'],
        correctIndex: 0,
        timeLimitSec: 20,
      },
      {
        id: 'mg10_3',
        prompt: 'តើ $\\cos(60^\\circ)$ ស្មើនឹងប៉ុន្មាន?',
        options: ['$\\frac{\\sqrt{3}}{2}$', '$\\frac{1}{2}$', '$\\frac{\\sqrt{2}}{2}$', '$1$'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
    ],
  },
  {
    id: 'math_g11',
    title: 'ស្វ៊ីតចំនួន និងលីមីតអនុគមន៍',
    subject: 'គណិតវិទ្យា',
    subjectId: 'math',
    gradeId: 'grade_11',
    questions: [
      {
        id: 'mg11_1',
        prompt: 'ស្វ៊ីតនព្វន្ត $u_n = 2n + 1$ ។ តើតួទី $5$ ($u_5$) ស្មើនឹងប៉ុន្មាន?',
        options: ['$9$', '$10$', '$11$', '$13$'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
      {
        id: 'mg11_2',
        prompt: 'គណនាលីមីត $\\lim_{x \\to 2} \\frac{x^2 - 4}{x - 2}$ ៖',
        options: ['$0$', '$2$', '$4$', '$\\infty$'],
        correctIndex: 2,
        timeLimitSec: 25,
      },
      {
        id: 'mg11_3',
        prompt: 'គណនាតម្លៃលោការីត $\\log_2(16)$ ៖',
        options: ['$2$', '$4$', '$8$', '$16$'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
    ],
  },
  {
    id: 'math_g12',
    title: 'ដេរីវេ អាំងតេក្រាល និងចំនួនកុំផ្លិច',
    subject: 'គណិតវិទ្យា',
    subjectId: 'math',
    gradeId: 'grade_12',
    questions: [
      {
        id: 'mg12_1',
        prompt: 'រកដេរីវេនៃអនុគមន៍ $f(x) = 3x^2 - 5x + 4$ ៖',
        options: ['$f\'(x) = 6x - 5$', '$f\'(x) = 3x - 5$', '$f\'(x) = 6x + 4$', '$f\'(x) = 6x^2 - 5$'],
        correctIndex: 0,
        timeLimitSec: 20,
      },
      {
        id: 'mg12_2',
        prompt: 'គណនាអាំងតេក្រាលកំណត់ $\\int_0^2 3x^2\\,dx$ ៖',
        options: ['$4$', '$6$', '$8$', '$12$'],
        correctIndex: 2,
        timeLimitSec: 25,
      },
      {
        id: 'mg12_3',
        prompt: 'ចំនួនកុំផ្លិច $z = 3 + 4i$ ។ តើម៉ូឌុល $|z|$ ស្មើនឹងប៉ុន្មាន?',
        options: ['$5$', '$7$', '$12$', '$25$'],
        correctIndex: 0,
        timeLimitSec: 20,
      },
    ],
  },

  // =========================================================
  // KHMER LANGUAGE & LITERATURE
  // =========================================================
  {
    id: 'khmer_primary',
    title: 'វេយ្យាករណ៍ និងសំណេរអក្សរខ្មែរ',
    subject: 'ភាសាខ្មែរ',
    subjectId: 'khmer',
    gradeId: 'grade_4',
    questions: [
      {
        id: 'kh_p1',
        prompt: 'តើព្យញ្ជនៈខ្មែរសរុបមានប៉ុន្មានតួ?',
        options: ['៣១ តួ', '៣៣ តួ', '៣៥ តួ', '២៦ តួ'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
      {
        id: 'kh_p2',
        prompt: 'តើពាក្យណាជាពាក្យ "នាម" (Noun)?',
        options: ['រត់', 'សាលារៀន', 'ស្អាត', 'យ៉ាងលឿន'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
      {
        id: 'kh_p3',
        prompt: 'តើស្រៈនិស្ស័យខ្មែរមានប៉ុន្មានតួ?',
        options: ['២១ តួ', '២៣ តួ', '២៤ តួ', '១៥ តួ'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
    ],
  },
  {
    id: 'khmer_g9',
    title: 'អក្សរសិល្ប៍ខ្មែរ និងវិចារណកថា',
    subject: 'ភាសាខ្មែរ',
    subjectId: 'khmer',
    gradeId: 'grade_9',
    questions: [
      {
        id: 'kh_s1',
        prompt: 'តើរឿង "ទុំទាវ" ជាស្នាដៃនិពន្ធរបស់អ្នកនិពន្ធរូបណា?',
        options: ['ភិក្ខុ សោម', 'ឧកញ៉ា សុត្ដន្តប្រីជាឥន្ទ', 'ក្រមង៉ុយ', 'ព្រះបាទអង្គឌួង'],
        correctIndex: 0,
        timeLimitSec: 20,
      },
      {
        id: 'kh_s2',
        prompt: 'តើសំណេរ "តែងសេចក្តី" ចែកចេញជាប៉ុន្មានផ្នែកធំៗ?',
        options: ['២ ផ្នែក', '៣ ផ្នែក', '៤ ផ្នែក', '៥ ផ្នែក'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
      {
        id: 'kh_s3',
        prompt: 'តើន័យ "បដិសព្ទ" មានន័យដូចម្តេច?',
        options: ['ពាក្យមានន័យដូចគ្នា', 'ពាក្យមានន័យផ្ទុយគ្នា', 'ពាក្យខ្ចីពីបរទេស', 'ពាក្យផ្សំ'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
    ],
  },

  // =========================================================
  // ENGLISH
  // =========================================================
  {
    id: 'english_g5',
    title: 'Basic Vocabulary & Grammar',
    subject: 'ភាសាអង់គ្លេស',
    subjectId: 'english',
    gradeId: 'grade_5',
    questions: [
      {
        id: 'en_p1',
        prompt: 'Choose the correct verb: "She ___ to school every day."',
        options: ['go', 'goes', 'going', 'gone'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
      {
        id: 'en_p2',
        prompt: 'What is the plural form of "Child"?',
        options: ['Childs', 'Childes', 'Children', 'Childrens'],
        correctIndex: 2,
        timeLimitSec: 15,
      },
      {
        id: 'en_p3',
        prompt: 'Which word is the opposite of "Fast"?',
        options: ['Quick', 'Slow', 'Tall', 'Happy'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
    ],
  },
  {
    id: 'english_g9',
    title: 'Tenses & Sentence Structure',
    subject: 'ភាសាអង់គ្លេស',
    subjectId: 'english',
    gradeId: 'grade_9',
    questions: [
      {
        id: 'en_s1',
        prompt: 'Complete the sentence: "If it rains tomorrow, we ___ stay home."',
        options: ['will', 'would have', 'were', 'did'],
        correctIndex: 0,
        timeLimitSec: 20,
      },
      {
        id: 'en_s2',
        prompt: 'Select the Past Participle of "Write":',
        options: ['Wrote', 'Writing', 'Written', 'Writes'],
        correctIndex: 2,
        timeLimitSec: 15,
      },
      {
        id: 'en_s3',
        prompt: '"They have lived in Phnom Penh ___ 2018."',
        options: ['for', 'since', 'during', 'until'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
    ],
  },

  // =========================================================
  // SCIENCE (PRIMARY)
  // =========================================================
  {
    id: 'science_g5',
    title: 'រុក្ខជាតិ ប្រព័ន្ធព្រះអាទិត្យ និងថាមពល',
    subject: 'វិទ្យាសាស្ត្រ',
    subjectId: 'science',
    gradeId: 'grade_5',
    questions: [
      {
        id: 'sci_1',
        prompt: 'តើភពណាដែលនៅជិតព្រះអាទិត្យជាងគេ?',
        options: ['ភពសុក្រ (Venus)', 'ភពពុធ (Mercury)', 'ភពផែនដី (Earth)', 'ភពអង្គារ (Mars)'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'sci_2',
        prompt: 'តើរុក្ខជាតិផលិតអាហារតាមលំនាំអ្វី?',
        options: ['ដំណកដង្ហើម', 'រស្មីសំយោគ', 'ចំហាយទឹក', 'ការរំលាយ'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'sci_3',
        prompt: 'តើទឹកកករលាយក្លាយជាទឹករាវនៅសីតុណ្ហភាពប៉ុន្មាន?',
        options: ['$0^\\circ\\text{C}$', '$50^\\circ\\text{C}$', '$100^\\circ\\text{C}$', '$-10^\\circ\\text{C}$'],
        correctIndex: 0,
        timeLimitSec: 15,
      },
    ],
  },

  // =========================================================
  // PHYSICS (LOWER & UPPER SECONDARY)
  // =========================================================
  {
    id: 'physics_g8',
    title: 'ល្បឿន កម្លាំង និងសម្ពាធ',
    subject: 'រូបវិទ្យា',
    subjectId: 'physics',
    gradeId: 'grade_8',
    questions: [
      {
        id: 'phy_8_1',
        prompt: 'រូបមន្តគណនាល្បឿនមធ្យម ($v$) គឺ៖',
        options: ['$v = d \\times t$', '$v = \\frac{d}{t}$', '$v = \\frac{t}{d}$', '$v = d + t$'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'phy_8_2',
        prompt: 'រថយន្តមួយបើកបរបានចម្ងាយ $120\\text{ km}$ ក្នុងរយៈពេល $2\\text{ h}$។ តើល្បឿនមធ្យមស្មើប៉ុន្មាន?',
        options: ['$40\\text{ km/h}$', '$60\\text{ km/h}$', '$80\\text{ km/h}$', '$240\\text{ km/h}$'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'phy_8_3',
        prompt: 'តើខ្នាតស្តង់ដារ (SI) នៃកម្លាំងគឺជាអ្វី?',
        options: ['ប៉ាស្កាល់ ($\\text{Pa}$)', 'ញូតុន ($\\text{N}$)', 'ស៊ូល ($\\text{J}$)', 'វ៉ាត់ ($\\text{W}$)'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
    ],
  },
  {
    id: 'physics_g11',
    title: 'ច្បាប់អូម និងអគ្គិសនី',
    subject: 'រូបវិទ្យា',
    subjectId: 'physics',
    gradeId: 'grade_11',
    questions: [
      {
        id: 'phy_11_1',
        prompt: 'តាមច្បាប់អូម រូបមន្តតង់ស្យុងអគ្គិសនី ($U$) គឺ៖',
        options: ['$U = \\frac{R}{I}$', '$U = R \\times I$', '$U = R + I$', '$U = I^2 R$'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
      {
        id: 'phy_11_2',
        prompt: 'រេស៊ីស្តង់ $R = 10\\,\\Omega$ ឆ្លងកាត់ដោយចរន្ត $I = 2\\text{ A}$។ គណនាតង់ស្យុង $U$ ៖',
        options: ['$5\\text{ V}$', '$12\\text{ V}$', '$20\\text{ V}$', '$40\\text{ V}$'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
      {
        id: 'phy_11_3',
        prompt: 'តើខ្នាតនៃថាមពលគីនេទិច ($E_k = \\frac{1}{2}mv^2$) គឺជាអ្វី?',
        options: ['វ៉ាត់ ($\\text{W}$)', 'ស៊ូល ($\\text{J}$)', 'អំពែ ($\\text{A}$)', 'វ៉ុល ($\\text{V}$)'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
    ],
  },

  // =========================================================
  // CHEMISTRY
  // =========================================================
  {
    id: 'chemistry_g8',
    title: 'និមិត្តសញ្ញាគីមី និងសមាសធាតុ',
    subject: 'គីមីវិទ្យា',
    subjectId: 'chemistry',
    gradeId: 'grade_8',
    questions: [
      {
        id: 'ch_8_1',
        prompt: 'តើនិមិត្តសញ្ញាគីមីនៃទឹក (Water) គឺជាអ្វី?',
        options: ['$\\mathrm{CO_2}$', '$\\mathrm{O_2}$', '$\\mathrm{H_2O}$', '$\\mathrm{NaCl}$'],
        correctIndex: 2,
        timeLimitSec: 15,
      },
      {
        id: 'ch_8_2',
        prompt: 'តើឧស្ម័នអ្វីដែលមានភាគរយច្រើនជាងគេក្នុងបរិយាកាសផែនដី?',
        options: ['អុកស៊ីសែន ($\\mathrm{O_2}$)', 'អាសូត ($\\mathrm{N_2}$)', 'កាបូនឌីអុកស៊ីត ($\\mathrm{CO_2}$)', 'អ៊ីដ្រូសែន ($\\mathrm{H_2}$)'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'ch_8_3',
        prompt: 'តើ $\\mathrm{NaCl}$ ជារូបមន្តគីមីនៃសារធាតុអ្វី?',
        options: ['ស្ករស', 'អំបិលសម្ល', 'ទឹកខ្មេះ', 'កំបោរ'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
    ],
  },
  {
    id: 'chemistry_g12',
    title: 'ម៉ូល កំហាប់ និងតម្លៃ pH',
    subject: 'គីមីវិទ្យា',
    subjectId: 'chemistry',
    gradeId: 'grade_12',
    questions: [
      {
        id: 'ch_12_1',
        prompt: 'សូលុយស្យុងណាដឺត (Neutral) នៅសីតុណ្ហភាព $25^\\circ\\text{C}$ មានតម្លៃ $\\mathrm{pH}$ ស្មើនឹង៖',
        options: ['$\\mathrm{pH} = 1$', '$\\mathrm{pH} = 5$', '$\\mathrm{pH} = 7$', '$\\mathrm{pH} = 14$'],
        correctIndex: 2,
        timeLimitSec: 15,
      },
      {
        id: 'ch_12_2',
        prompt: 'គណនាចំនួនម៉ូល $n = \\frac{m}{M}$ នៃ $\\mathrm{H_2O}$ ចំនួន $36\\text{ g}$ (ដោយ $M_{\\mathrm{H_2O}} = 18\\text{ g/mol}$)៖',
        options: ['$1\\text{ mol}$', '$2\\text{ mol}$', '$3\\text{ mol}$', '$4\\text{ mol}$'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'ch_12_3',
        prompt: 'រូបមន្តទូទៅនៃអាល់កាន (Alkane) គឺ៖',
        options: ['$\\mathrm{C}_n\\mathrm{H}_{2n}$', '$\\mathrm{C}_n\\mathrm{H}_{2n+2}$', '$\\mathrm{C}_n\\mathrm{H}_{2n-2}$', '$\\mathrm{C}_n\\mathrm{H}_n$'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
    ],
  },

  // =========================================================
  // BIOLOGY
  // =========================================================
  {
    id: 'biology_g9',
    title: 'កោសិកា និងតំណពូជ (DNA)',
    subject: 'ជីវវិទ្យា',
    subjectId: 'biology',
    gradeId: 'grade_9',
    questions: [
      {
        id: 'bio_1',
        prompt: 'តើផ្នែកណានៃកោសិកាដែលផលិតថាមពល (ATP)?',
        options: ['មីតូកុងឌ្រី (Mitochondria)', 'រីបូសូម (Ribosome)', 'វ៉ាគុយអូល (Vacuole)', 'ភ្នាសកោសិកា'],
        correctIndex: 0,
        timeLimitSec: 20,
      },
      {
        id: 'bio_2',
        prompt: 'តើម៉ូលេគុល $\\mathrm{DNA}$ ផ្ទុកព័ត៌មានអ្វីនៅក្នុងសារពាង្គកាយ?',
        options: ['អាស៊ីតក្រពះ', 'ព័ត៌មានសេនេទិចតំណពូជ', 'ឈាមក្រហម', 'អរម៉ូនលូតលាស់'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'bio_3',
        prompt: 'តើសរីរាង្គណាបូមឈាមទៅចិញ្ចឹមរាងកាយ?',
        options: ['សួត', 'ថ្លើម', 'បេះដូង', 'តម្រងនោម'],
        correctIndex: 2,
        timeLimitSec: 15,
      },
    ],
  },

  // =========================================================
  // EARTH SCIENCE
  // =========================================================
  {
    id: 'earth_g8',
    title: 'ស្រទាប់ផែនដី និងអាកាសធាតុ',
    subject: 'ផែនដីវិទ្យា',
    subjectId: 'earth',
    gradeId: 'grade_8',
    questions: [
      {
        id: 'ear_1',
        prompt: 'តើស្រទាប់ខាងក្រៅបំផុតរបស់ផែនដីឈ្មោះអ្វី?',
        options: ['ស្នូលផែនដី (Core)', 'ម៉ង់តូ (Mantle)', 'សំបកផែនដី (Crust)', 'ម៉ាក់ម៉ា'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
      {
        id: 'ear_2',
        prompt: 'តើថ្មណាដែលកើតឡើងពីកម្អែភ្នំភ្លើង?',
        options: ['ថ្មម៉ាក់ម៉ា (Igneous)', 'ថ្មកំទេចកំណ (Sedimentary)', 'ថ្មកែប្រែ (Metamorphic)', 'ដីឥដ្ឋ'],
        correctIndex: 0,
        timeLimitSec: 20,
      },
    ],
  },

  // =========================================================
  // HISTORY & GEOGRAPHY
  // =========================================================
  {
    id: 'history_g9',
    title: 'ប្រវត្តិសាស្ត្រខ្មែរ និងសម័យអង្គរ',
    subject: 'ប្រវត្តិវិទ្យា',
    subjectId: 'history',
    gradeId: 'grade_9',
    questions: [
      {
        id: 'his_1',
        prompt: 'តើប្រាសាទអង្គរវត្តត្រូវបានសាងសង់ឡើងនៅសតវត្សទីប៉ុន្មាន?',
        options: ['សតវត្សទី ១០', 'សតវត្សទី ១២', 'សតវត្សទី ១៤', 'សតវត្សទី ១៦'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'his_2',
        prompt: 'តើព្រះមហាក្សត្រអង្គណាជាស្ថាបនិកប្រាសាទអង្គរវត្ត?',
        options: ['ព្រះបាទជ័យវរ្ម័នទី ៧', 'ព្រះបាទសូរ្យវរ្ម័នទី ២', 'ព្រះបាទឥន្ទ្រវរ្ម័នទី ១', 'ព្រះបាទយសោវរ្ម័នទី ១'],
        correctIndex: 1,
        timeLimitSec: 20,
      },
      {
        id: 'his_3',
        prompt: 'តើថ្ងៃបុណ្យឯករាជ្យជាតិកម្ពុជាប្រារព្ធឡើងនៅថ្ងៃទីប៉ុន្មាន?',
        options: ['៩ វិច្ឆិកា', '៧ មករា', '២៤ កញ្ញា', '១៣ មេសា'],
        correctIndex: 0,
        timeLimitSec: 15,
      },
    ],
  },
  {
    id: 'geography_g9',
    title: 'ភូមិសាស្ត្រកម្ពុជា និងអាស៊ាន',
    subject: 'ភូមិវិទ្យា',
    subjectId: 'geography',
    gradeId: 'grade_9',
    questions: [
      {
        id: 'geo_1',
        prompt: 'តើទន្លេណាដែលហូរកាត់រាជធានីភ្នំពេញ និងជាទន្លេប្រសព្វបួនមុខ?',
        options: ['ទន្លេមេគង្គ', 'ទន្លេសេកុង', 'ទន្លេស្រែពក', 'ទន្លេសាន'],
        correctIndex: 0,
        timeLimitSec: 20,
      },
      {
        id: 'geo_2',
        prompt: 'តើខេត្តណាដែលមានផ្ទៃដីធំជាងគេនៅប្រទេសកម្ពុជា?',
        options: ['កំពង់ធំ', 'បាត់ដំបង', 'មណ្ឌលគិរី', 'សៀមរាប'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
      {
        id: 'geo_3',
        prompt: 'តើភ្នំខ្ពស់ជាងគេនៅប្រទេសកម្ពុជាឈ្មោះអ្វី?',
        options: ['ភ្នំបូកគោ', 'ភ្នំគូលែន', 'ភ្នំឱរ៉ាល់', 'ភ្នំសំពៅ'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
    ],
  },

  // =========================================================
  // CIVICS & ICT & GENERAL KNOWLEDGE
  // =========================================================
  {
    id: 'civics_gen',
    title: 'សីលធម៌ ច្បាប់ និងពលរដ្ឋល្អ',
    subject: 'សីលធម៌-ពលរដ្ឋ',
    subjectId: 'civics',
    gradeId: 'general',
    questions: [
      {
        id: 'civ_1',
        prompt: 'តើសិទ្ធិកុមារជាមូលដ្ឋានមានអ្វីខ្លះ?',
        options: [
          'សិទ្ធិរស់រាន សិទ្ធិអភិវឌ្ឍន៍ សិទ្ធិការពារ និងសិទ្ធិចូលរួម',
          'សិទ្ធិធ្វើការងារធ្ងន់',
          'សិទ្ធិឈប់រៀន',
          'សិទ្ធិបំពានច្បាប់',
        ],
        correctIndex: 0,
        timeLimitSec: 20,
      },
      {
        id: 'civ_2',
        prompt: 'តើផ្ការំដួលជាផ្កាតំណាងឱ្យអ្វីនៅកម្ពុជា?',
        options: ['ផ្កាប្រចាំរដូវភ្លៀង', 'ផ្កាជាតិតំណាងប្រទេស', 'ផ្កាប្រចាំតំបន់ឆ្នេរ', 'ផ្កាប្រចាំទីក្រុង'],
        correctIndex: 1,
        timeLimitSec: 15,
      },
    ],
  },
  {
    id: 'ict_g7',
    title: 'កុំព្យូទ័រ និងបច្ចេកវិទ្យាឌីជីថល',
    subject: 'ព័ត៌មានវិទ្យា (ICT)',
    subjectId: 'ict',
    gradeId: 'grade_7',
    questions: [
      {
        id: 'ict_1',
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
      {
        id: 'ict_2',
        prompt: 'តើ $1\\text{ KB}$ ស្មើនឹងប៉ុន្មាន Byte ($\\text{B}$) ក្នុងប្រព័ន្ធកុំព្យូទ័រ?',
        options: ['$100\\text{ B}$', '$512\\text{ B}$', '$1024\\text{ B}$', '$2048\\text{ B}$'],
        correctIndex: 2,
        timeLimitSec: 15,
      },
      {
        id: 'ict_3',
        prompt: 'តើប្រព័ន្ធគោលពីរ (Binary) ប្រើប្រាស់លេខអ្វីខ្លះ?',
        options: ['$0$ និង $1$', '$1$ និង $2$', '$0$ ដល់ $9$', '$1$ ដល់ $10$'],
        correctIndex: 0,
        timeLimitSec: 15,
      },
    ],
  },
  {
    id: 'khmer_general_1',
    title: 'ចំណេះដឹងទូទៅ និងវប្បធម៌ខ្មែរ',
    subject: 'វប្បធម៌ទូទៅ',
    subjectId: 'general',
    gradeId: 'general',
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
    ],
  },
];

const QUIZ_STORAGE_KEY_V2 = 'pickerwel_offline_quizzes_v2';
const QUIZ_STORAGE_KEY_V1 = 'pickerwel_offline_quizzes_v1';
const LEGACY_STARTER_IDS = new Set(['khmer_general_1', 'quick_math_1', 'science_tech_1']);

export function loadOfflineQuizzes(): OfflineQuiz[] {
  if (typeof window === 'undefined') return STARTER_OFFLINE_QUIZZES;
  try {
    const rawV2 = localStorage.getItem(QUIZ_STORAGE_KEY_V2);
    if (rawV2) {
      const parsedV2 = JSON.parse(rawV2) as OfflineQuiz[];
      if (Array.isArray(parsedV2) && parsedV2.length > 0) {
        return parsedV2;
      }
    }

    // Migrate any user-created quizzes from V1 while seeding full subject & grade library
    const rawV1 = localStorage.getItem(QUIZ_STORAGE_KEY_V1);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1) as OfflineQuiz[];
      if (Array.isArray(parsedV1)) {
        const customFromV1 = parsedV1
          .filter((q) => !LEGACY_STARTER_IDS.has(q.id))
          .map((q) => ({
            ...q,
            subjectId: resolveQuizSubjectId(q),
            gradeId: resolveQuizGradeId(q),
          }));
        const merged = [...customFromV1, ...STARTER_OFFLINE_QUIZZES];
        localStorage.setItem(QUIZ_STORAGE_KEY_V2, JSON.stringify(merged));
        return merged;
      }
    }

    return STARTER_OFFLINE_QUIZZES;
  } catch {
    return STARTER_OFFLINE_QUIZZES;
  }
}

export function saveOfflineQuizzes(quizzes: OfflineQuiz[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUIZ_STORAGE_KEY_V2, JSON.stringify(quizzes));
  } catch {
    // Ignore storage quota errors
  }
}
