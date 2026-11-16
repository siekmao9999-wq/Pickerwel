import type { PaletteId } from './palettes';

export interface WheelTemplate {
  id: string;
  titleKm: string;
  titleEn: string;
  categoryKm: string;
  categoryEn: string;
  descriptionKm: string;
  descriptionEn: string;
  paletteId: PaletteId;
  entries: string[];
}

export const QUICK_START_ENTRIES = [
  'សុខា',
  'ដារ៉ា',
  'ម៉ាលី',
  'វិបុល',
  'រតនា',
  'កញ្ញា',
  'ភារម្យ',
  'ពិសី',
];

export const WHEEL_TEMPLATES: WheelTemplate[] = [
  {
    id: 'grade-7a',
    titleKm: 'ឈ្មោះសិស្សថ្នាក់ទី៧A',
    titleEn: 'Grade 7A Student Roster',
    categoryKm: 'ថ្នាក់រៀន',
    categoryEn: 'Classroom',
    descriptionKm: 'សម្រាប់ហៅឈ្មោះសិស្សឡើងឆ្លើយសំណួរ ឬធ្វើលំហាត់លើក្តារខៀន។',
    descriptionEn: 'Call on students randomly for classroom Q&A or board exercises.',
    paletteId: 'vibrant',
    entries: [
      'សុខ ដារ៉ា',
      'ចាន់ ម៉ាលី',
      'លី វិបុល',
      'កែវ រតនា',
      'ហេង កញ្ញា',
      'ពេជ្រ ភារម្យ',
      'ស៊ុន ពិសី',
      'ណារិន សុវណ្ណ',
      'មាស ធីតា',
      'អ៊ុំ បញ្ញា',
    ],
  },
  {
    id: 'grade-12a',
    titleKm: 'ថ្នាក់ទី១២ក',
    titleEn: 'Grade 12A Exam Review',
    categoryKm: 'ថ្នាក់រៀន',
    categoryEn: 'Classroom',
    descriptionKm: 'បង្វិលជ្រើសរើសប្រធានបទ ឬសិស្សដើម្បីបង្ហាញមេរៀនត្រៀមប្រឡង។',
    descriptionEn: 'Pick students or review topics for national exam preparation.',
    paletteId: 'classroom',
    entries: [
      'គណិតវិទ្យា',
      'រូបវិទ្យា',
      'គីមីវិទ្យា',
      'ជីវវិទ្យា',
      'អក្សរសាស្ត្រខ្មែរ',
      'ប្រវត្តិវិទ្យា',
      'ភាសាអង់គ្លេស',
      'ភូមិវិទ្យា',
    ],
  },
  {
    id: 'team-tasks',
    titleKm: 'ការងារក្រុម',
    titleEn: 'Team Task Assignment',
    categoryKm: 'ការងារ',
    categoryEn: 'Workplace',
    descriptionKm: 'បែងចែកភារកិច្ចក្រុម ឬអ្នកដឹកនាំការប្រជុំប្រចាំសប្តាហ៍ដោយយុត្តិធម៌។',
    descriptionEn: 'Assign weekly team leads, note-takers, or presentation order fairly.',
    paletteId: 'ocean',
    entries: [
      'ធ្វើបទបង្ហាញ',
      'កត់ត្រាកិច្ចប្រជុំ',
      'ត្រួតពិនិត្យកូដ',
      'រៀបចំរបាយការណ៍',
      'សម្របសម្រួលក្រុម',
      'សាកល្បងប្រព័ន្ធ',
    ],
  },
  {
    id: 'lunch-spots',
    titleKm: 'អាហារថ្ងៃត្រង់',
    titleEn: 'Team Lunch Picker',
    categoryKm: 'ប្រចាំថ្ងៃ',
    categoryEn: 'Everyday',
    descriptionKm: 'ពិបាករើសមុខម្ហូបថ្ងៃត្រង់មែនទេ? បង្វិលកងដើម្បីសម្រេចចិត្តភ្លាមៗ។',
    descriptionEn: 'Can not decide what to eat for lunch? Spin to pick a dish.',
    paletteId: 'sunset',
    entries: [
      'បាយសាច់ជ្រូក',
      'គុយទាវភ្នំពេញ',
      'សម្លម្ជូរគ្រឿង',
      'បាយឡុកឡាក់',
      'មីឆាសាច់គោ',
      'នំបញ្ចុកសម្លខ្មែរ',
    ],
  },
  {
    id: 'meeting-icebreaker',
    titleKm: 'សំណួរប្រជុំប្រចាំសប្តាហ៍',
    titleEn: 'Weekly Meeting Icebreakers',
    categoryKm: 'ការងារ',
    categoryEn: 'Workplace',
    descriptionKm: 'បង្កើតបរិយាកាសរីករាយមុនពេលចាប់ផ្តើមប្រជុំការងារ។',
    descriptionEn: 'Warm up your team meeting with lighthearted prompt spins.',
    paletteId: 'vibrant',
    entries: [
      'ជោគជ័យតូចមួយសប្តាហ៍នេះ',
      'អ្វីដែលអ្នករៀនបានថ្មី',
      'អរគុណមិត្តរួមក្រុមម្នាក់',
      'គម្រោងចុងសប្តាហ៍',
      'បទចម្រៀងដែលកំពុងស្តាប់',
      'ភេសជ្ជៈសំណព្វ',
    ],
  },
  {
    id: 'classroom-rewards',
    titleKm: 'រង្វាន់លើកទឹកចិត្ត',
    titleEn: 'Classroom Rewards',
    categoryKm: 'ថ្នាក់រៀន',
    categoryEn: 'Classroom',
    descriptionKm: 'ផ្តល់រង្វាន់លើកទឹកចិត្តដល់សិស្សដែលឆ្លើយសំណួរបានត្រឹមត្រូវ។',
    descriptionEn: 'Reward students who participate actively in class.',
    paletteId: 'classroom',
    entries: [
      'ពិន្ទុបន្ថែម +២',
      'រើសកន្លែងអង្គុយ',
      'ប៊ិចថ្មី ១ ដើម',
      'សៀវភៅកត់ត្រា ១ ក្បាល',
      'ជ្រើសរើសមិត្តភក្តិជួយឆ្លើយ',
      'មេដាយតារាប្រចាំថ្ងៃ',
    ],
  },
];
