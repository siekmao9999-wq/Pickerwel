import type { Language } from './i18n';

export type WheelToolId =
  | 'picker'
  | 'team'
  | 'yes_no'
  | 'number'
  | 'letter'
  | 'country'
  | 'state'
  | 'color'
  | 'image'
  | 'date'
  | 'instagram'
  | 'mlb'
  | 'nba'
  | 'nfl'
  | 'flag_quiz'
  | 'truth_dare';

export interface WheelToolMeta {
  id: WheelToolId;
  column: 1 | 2 | 3;
  nameEn: string;
  nameKm: string;
  descEn: string;
  descKm: string;
  category: 'core' | 'generators' | 'geo' | 'sports' | 'fun';
  accentClass: string;
}

/**
 * Exact 16 tools arranged in the 3-column order from the Picker Wheel Tools menu.
 */
export const WHEEL_TOOLS_CATALOG: WheelToolMeta[] = [
  // Column 1
  {
    id: 'picker',
    column: 1,
    nameEn: 'Picker Wheel',
    nameKm: 'កងវិលធម្មតា (Picker Wheel)',
    descEn: 'Custom spin wheel for names, topics, and classroom decisions.',
    descKm: 'កងវិលផ្ទាល់ខ្លួនសម្រាប់ឈ្មោះសិស្ស ប្រធានបទ ឬការសម្រេចចិត្តផ្សេងៗ។',
    category: 'core',
    accentClass: 'bg-lime-100 text-lime-700 dark:bg-lime-950/60 dark:text-lime-300',
  },
  {
    id: 'team',
    column: 1,
    nameEn: 'Team Picker Wheel',
    nameKm: 'បែងចែកក្រុម (Team Picker)',
    descEn: 'Randomly divide students or participants into balanced teams.',
    descKm: 'បែងចែកសិស្ស ឬអ្នកចូលរួមជាក្រុមដោយស្មើភាព និងចៃដន្យភ្លាមៗ។',
    category: 'core',
    accentClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  {
    id: 'yes_no',
    column: 1,
    nameEn: 'Yes No Picker Wheel',
    nameKm: 'បាទ/ចាស ឬ ទេ (Yes / No)',
    descEn: 'Quick decision wheel with Yes, No, and optional Maybe tally.',
    descKm: 'កងវិលសម្រេចចិត្តរហ័ស បាទ/ចាស ទេ ឬ ប្រហែល ជាមួយការរាប់លទ្ធផល។',
    category: 'core',
    accentClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  },
  {
    id: 'number',
    column: 1,
    nameEn: 'Number Picker Wheel',
    nameKm: 'ចាប់លេខចៃដន្យ (Number Picker)',
    descEn: 'Generate custom number ranges with step intervals and exclusions.',
    descKm: 'បង្កើតជួរលេខតាមចិត្ត (អប្បបរមា–អតិបរមា) គម្លាត និងដកលេខចេញ។',
    category: 'generators',
    accentClass: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  },
  {
    id: 'letter',
    column: 1,
    nameEn: 'Letter Picker Wheel',
    nameKm: 'ចាប់អក្សរ (Letter Picker)',
    descEn: 'Spin English A–Z, vowels, consonants, or Khmer ក–អ consonants.',
    descKm: 'បង្វិលចាប់អក្សរអង់គ្លេស A–Z ស្រៈ ព្យញ្ជនៈ ឬព្យញ្ជនៈខ្មែរ ក–អ។',
    category: 'generators',
    accentClass: 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300',
  },
  {
    id: 'country',
    column: 1,
    nameEn: 'Country Picker Wheel',
    nameKm: 'ចាប់ឈ្មោះប្រទេស (Country Picker)',
    descEn: 'Pick random countries with flags, filtered by world continent.',
    descKm: 'ចាប់ឈ្មោះប្រទេសជុំវិញពិភពលោកជាមួយទង់ជាតិ តាមទ្វីបនីមួយៗ។',
    category: 'geo',
    accentClass: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
  },

  // Column 2
  {
    id: 'state',
    column: 2,
    nameEn: 'State Picker Wheel',
    nameKm: 'រាជធានី-ខេត្ត / រដ្ឋ (State Picker)',
    descEn: 'Spin all 25 Cambodian Provinces & Capital or all 50 US States.',
    descKm: 'បង្វិលចាប់រាជធានី-ខេត្តកម្ពុជាទាំង ២៥ ឬរដ្ឋទាំង ៥០ របស់អាមេរិក។',
    category: 'geo',
    accentClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  {
    id: 'color',
    column: 2,
    nameEn: 'Color Picker Wheel',
    nameKm: 'ចាប់ពណ៌ (Color Picker)',
    descEn: 'Spin curated color palettes and copy winning HEX codes in 1 click.',
    descKm: 'បង្វិលជ្រើសរើសពណ៌ស្អាតៗ និងចម្លងកូដពណ៌ HEX ភ្លាមៗ។',
    category: 'generators',
    accentClass: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  },
  {
    id: 'image',
    column: 2,
    nameEn: 'Image Picker Wheel',
    nameKm: 'ចាប់រូបភាព (Image Picker)',
    descEn: 'Upload local photos or pick visual cards and reveal the winning image.',
    descKm: 'បញ្ចូលរូបភាពពីឧបករណ៍ ឬប្រើកាតរូបភាពដើម្បីបង្វិលរករូបឈ្នះ។',
    category: 'core',
    accentClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  },
  {
    id: 'date',
    column: 2,
    nameEn: 'Date Picker Wheel',
    nameKm: 'ចាប់កាលបរិច្ឆេទ (Date Picker)',
    descEn: 'Pick random dates in a range, days of the week, or months.',
    descKm: 'បង្វិលជ្រើសថ្ងៃខែក្នុងចន្លោះកំណត់ ថ្ងៃទាំង ៧ ឬខែទាំង ១២។',
    category: 'generators',
    accentClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
  },
  {
    id: 'instagram',
    column: 2,
    nameEn: 'Instagram Comment Picker Wheel',
    nameKm: 'ចាប់អ្នក Comment (Instagram)',
    descEn: 'Paste comments, filter duplicates or keywords, and pick a winner.',
    descKm: 'បិទភ្ជាប់ Comment កាត់ឈ្មោះស្ទួន ឬច្រោះពាក្យគន្លឹះ ដើម្បីចាប់អ្នកឈ្នះ។',
    category: 'fun',
    accentClass: 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300',
  },
  {
    id: 'mlb',
    column: 2,
    nameEn: 'MLB Picker Wheel',
    nameKm: 'ក្រុមបេស្បល MLB (MLB Picker)',
    descEn: 'Pick from all 30 Major League Baseball teams (AL & NL).',
    descKm: 'បង្វិលជ្រើសរើសក្រុមបេស្បល MLB ទាំង ៣០ ក្រុម (AL និង NL)។',
    category: 'sports',
    accentClass: 'bg-lime-100 text-lime-700 dark:bg-lime-950/60 dark:text-lime-300',
  },

  // Column 3
  {
    id: 'nba',
    column: 3,
    nameEn: 'NBA Picker Wheel',
    nameKm: 'ក្រុមបាល់បោះ NBA (NBA Picker)',
    descEn: 'Spin all 30 NBA basketball teams by Eastern or Western Conference.',
    descKm: 'បង្វិលជ្រើសក្រុមបាល់បោះ NBA ទាំង ៣០ តាមសន្និសីទខាងកើត ឬខាងលិច។',
    category: 'sports',
    accentClass: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
  },
  {
    id: 'nfl',
    column: 3,
    nameEn: 'NFL Picker Wheel',
    nameKm: 'ក្រុមបាល់ឱប NFL (NFL Picker)',
    descEn: 'Spin all 32 NFL football teams filtered by AFC or NFC.',
    descKm: 'បង្វិលជ្រើសក្រុម NFL ទាំង ៣២ តាមតំបន់ AFC ឬ NFC។',
    category: 'sports',
    accentClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  {
    id: 'flag_quiz',
    column: 3,
    nameEn: 'Flag Quiz Picker Wheel',
    nameKm: 'ល្បែងទាយទង់ជាតិ (Flag Quiz)',
    descEn: 'Spin mystery country flags, guess the nation, and track your score.',
    descKm: 'បង្វិលចាប់ទង់ជាតិ ទាយឈ្មោះប្រទេស និងរាជធានី រួចបើកមើលចម្លើយ។',
    category: 'fun',
    accentClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  },
  {
    id: 'truth_dare',
    column: 3,
    nameEn: 'Truth or Dare Picker Wheel',
    nameKm: 'ការពិត ឬ ហ៊ានធ្វើ (Truth or Dare)',
    descEn: 'Fun classroom-safe Truth and Dare prompts in Khmer and English.',
    descKm: 'សំណួរការពិត ឬបញ្ហាប្រឈមសប្បាយៗ សមរម្យសម្រាប់ថ្នាក់រៀន និងក្រុម។',
    category: 'fun',
    accentClass: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  },
];

export interface CountryRecord {
  flag: string;
  nameEn: string;
  nameKm: string;
  capitalEn: string;
  capitalKm: string;
  continent: 'Asia' | 'Europe' | 'Americas' | 'Africa' | 'Oceania';
}

export const WORLD_COUNTRIES: CountryRecord[] = [
  // Asia
  { flag: '🇰🇭', nameEn: 'Cambodia', nameKm: 'កម្ពុជា', capitalEn: 'Phnom Penh', capitalKm: 'ភ្នំពេញ', continent: 'Asia' },
  { flag: '🇹🇭', nameEn: 'Thailand', nameKm: 'ថៃ', capitalEn: 'Bangkok', capitalKm: 'បាងកក', continent: 'Asia' },
  { flag: '🇻🇳', nameEn: 'Vietnam', nameKm: 'វៀតណាម', capitalEn: 'Hanoi', capitalKm: 'ហាណូយ', continent: 'Asia' },
  { flag: '🇱🇦', nameEn: 'Laos', nameKm: 'ឡាវ', capitalEn: 'Vientiane', capitalKm: 'វៀងចន្ទន៍', continent: 'Asia' },
  { flag: '🇸🇬', nameEn: 'Singapore', nameKm: 'សិង្ហបុរី', capitalEn: 'Singapore', capitalKm: 'សិង្ហបុរី', continent: 'Asia' },
  { flag: '🇲🇾', nameEn: 'Malaysia', nameKm: 'ម៉ាឡេស៊ី', capitalEn: 'Kuala Lumpur', capitalKm: 'គូឡាឡាំពួរ', continent: 'Asia' },
  { flag: '🇮🇩', nameEn: 'Indonesia', nameKm: 'ឥណ្ឌូនេស៊ី', capitalEn: 'Jakarta', capitalKm: 'ហ្សាការតា', continent: 'Asia' },
  { flag: '🇵🇭', nameEn: 'Philippines', nameKm: 'ហ្វីលីពីន', capitalEn: 'Manila', capitalKm: 'ម៉ានីល', continent: 'Asia' },
  { flag: '🇯🇵', nameEn: 'Japan', nameKm: 'ជប៉ុន', capitalEn: 'Tokyo', capitalKm: 'តូក្យូ', continent: 'Asia' },
  { flag: '🇰🇷', nameEn: 'South Korea', nameKm: 'កូរ៉េខាងត្បូង', capitalEn: 'Seoul', capitalKm: 'សេអ៊ូល', continent: 'Asia' },
  { flag: '🇨🇳', nameEn: 'China', nameKm: 'ចិន', capitalEn: 'Beijing', capitalKm: 'ប៉េកាំង', continent: 'Asia' },
  { flag: '🇮🇳', nameEn: 'India', nameKm: 'ឥណ្ឌា', capitalEn: 'New Delhi', capitalKm: 'ញូវដេលី', continent: 'Asia' },
  { flag: '🇲🇲', nameEn: 'Myanmar', nameKm: 'មីយ៉ាន់ម៉ា', capitalEn: 'Naypyidaw', capitalKm: 'ណៃពិដោ', continent: 'Asia' },
  { flag: '🇧🇳', nameEn: 'Brunei', nameKm: 'ប្រ៊ុយណេ', capitalEn: 'Bandar Seri Begawan', capitalKm: 'បង់ដាសេរីបេហ្គាវ៉ាន់', continent: 'Asia' },
  { flag: '🇦🇪', nameEn: 'UAE', nameKm: 'អេមីរ៉ាតអារ៉ាប់រួម', capitalEn: 'Abu Dhabi', capitalKm: 'អាប៊ូដាប៊ី', continent: 'Asia' },
  { flag: '🇸🇦', nameEn: 'Saudi Arabia', nameKm: 'អារ៉ាប៊ីសាអូឌីត', capitalEn: 'Riyadh', capitalKm: 'រីយ៉ាដ', continent: 'Asia' },

  // Europe
  { flag: '🇫🇷', nameEn: 'France', nameKm: 'បារាំង', capitalEn: 'Paris', capitalKm: 'ប៉ារីស', continent: 'Europe' },
  { flag: '🇬🇧', nameEn: 'United Kingdom', nameKm: 'ចក្រភពអង់គ្លេស', capitalEn: 'London', capitalKm: 'ឡុងដ៍', continent: 'Europe' },
  { flag: '🇩🇪', nameEn: 'Germany', nameKm: 'អាល្លឺម៉ង់', capitalEn: 'Berlin', capitalKm: 'ប៊ែកឡាំង', continent: 'Europe' },
  { flag: '🇮🇹', nameEn: 'Italy', nameKm: 'អ៊ីតាលី', capitalEn: 'Rome', capitalKm: 'រ៉ូម', continent: 'Europe' },
  { flag: '🇪🇸', nameEn: 'Spain', nameKm: 'អេស្ប៉ាញ', capitalEn: 'Madrid', capitalKm: 'ម៉ាឌ្រីដ', continent: 'Europe' },
  { flag: '🇵🇹', nameEn: 'Portugal', nameKm: 'ព័រទុយហ្គាល់', capitalEn: 'Lisbon', capitalKm: 'លីស្បោន', continent: 'Europe' },
  { flag: '🇳🇱', nameEn: 'Netherlands', nameKm: 'ហូឡង់', capitalEn: 'Amsterdam', capitalKm: 'អាំស្ទែដាំ', continent: 'Europe' },
  { flag: '🇨🇭', nameEn: 'Switzerland', nameKm: 'ស្វីស', capitalEn: 'Bern', capitalKm: 'ប៊ែន', continent: 'Europe' },
  { flag: '🇸🇪', nameEn: 'Sweden', nameKm: 'ស៊ុយអែត', capitalEn: 'Stockholm', capitalKm: 'ស្តុកខុល', continent: 'Europe' },
  { flag: '🇳🇴', nameEn: 'Norway', nameKm: 'ន័រវែស', capitalEn: 'Oslo', capitalKm: 'អូស្លូ', continent: 'Europe' },
  { flag: '🇬🇷', nameEn: 'Greece', nameKm: 'ក្រិក', capitalEn: 'Athens', capitalKm: 'អាថែន', continent: 'Europe' },
  { flag: '🇵🇱', nameEn: 'Poland', nameKm: 'ប៉ូឡូញ', capitalEn: 'Warsaw', capitalKm: 'វ៉ាសូវី', continent: 'Europe' },

  // Americas
  { flag: '🇺🇸', nameEn: 'United States', nameKm: 'សហរដ្ឋអាមេរិក', capitalEn: 'Washington, D.C.', capitalKm: 'វ៉ាស៊ីនតោន', continent: 'Americas' },
  { flag: '🇨🇦', nameEn: 'Canada', nameKm: 'កាណាដា', capitalEn: 'Ottawa', capitalKm: 'អូតាវ៉ា', continent: 'Americas' },
  { flag: '🇲🇽', nameEn: 'Mexico', nameKm: 'ម៉ិកស៊ិក', capitalEn: 'Mexico City', capitalKm: 'ម៉ិកស៊ិកូស៊ីធី', continent: 'Americas' },
  { flag: '🇧🇷', nameEn: 'Brazil', nameKm: 'ប្រេស៊ីល', capitalEn: 'Brasília', capitalKm: 'ប្រាស៊ីលីយ៉ា', continent: 'Americas' },
  { flag: '🇦🇷', nameEn: 'Argentina', nameKm: 'អាហ្សង់ទីន', capitalEn: 'Buenos Aires', capitalKm: 'ប៊ុយណូស៊ែរ', continent: 'Americas' },
  { flag: '🇨🇴', nameEn: 'Colombia', nameKm: 'កូឡុំប៊ី', capitalEn: 'Bogotá', capitalKm: 'បូហ្គោតា', continent: 'Americas' },
  { flag: '🇨🇱', nameEn: 'Chile', nameKm: 'ឈីលី', capitalEn: 'Santiago', capitalKm: 'សាន់ត្យាហ្គោ', continent: 'Americas' },
  { flag: '🇵🇪', nameEn: 'Peru', nameKm: 'ប៉េរូ', capitalEn: 'Lima', capitalKm: 'លីម៉ា', continent: 'Americas' },

  // Africa
  { flag: '🇪🇬', nameEn: 'Egypt', nameKm: 'អេហ្ស៊ីប', capitalEn: 'Cairo', capitalKm: 'គែរ', continent: 'Africa' },
  { flag: '🇿🇦', nameEn: 'South Africa', nameKm: 'អាហ្វ្រិកខាងត្បូង', capitalEn: 'Pretoria', capitalKm: 'ព្រីតូរីយ៉ា', continent: 'Africa' },
  { flag: '🇲🇦', nameEn: 'Morocco', nameKm: 'ម៉ារ៉ុក', capitalEn: 'Rabat', capitalKm: 'រ៉ាបាត', continent: 'Africa' },
  { flag: '🇰🇪', nameEn: 'Kenya', nameKm: 'កេនយ៉ា', capitalEn: 'Nairobi', capitalKm: 'ណៃរ៉ូប៊ី', continent: 'Africa' },
  { flag: '🇳🇬', nameEn: 'Nigeria', nameKm: 'នីហ្សេរីយ៉ា', capitalEn: 'Abuja', capitalKm: 'អាប៊ូចា', continent: 'Africa' },
  { flag: '🇪🇹', nameEn: 'Ethiopia', nameKm: 'អេត្យូពី', capitalEn: 'Addis Ababa', capitalKm: 'អាឌីសអាបាបា', continent: 'Africa' },
  { flag: '🇬🇭', nameEn: 'Ghana', nameKm: 'ហ្គាណា', capitalEn: 'Accra', capitalKm: 'អាក្រា', continent: 'Africa' },

  // Oceania
  { flag: '🇦🇺', nameEn: 'Australia', nameKm: 'អូស្ត្រាលី', capitalEn: 'Canberra', capitalKm: 'កង់បេរ៉ា', continent: 'Oceania' },
  { flag: '🇳🇿', nameEn: 'New Zealand', nameKm: 'នូវែលសេឡង់', capitalEn: 'Wellington', capitalKm: 'វ៉េលីងតោន', continent: 'Oceania' },
  { flag: '🇫🇯', nameEn: 'Fiji', nameKm: 'ហ្វីជី', capitalEn: 'Suva', capitalKm: 'ស៊ូវ៉ា', continent: 'Oceania' },
  { flag: '🇵🇬', nameEn: 'Papua New Guinea', nameKm: 'ប៉ាពួញូហ្គីណេ', capitalEn: 'Port Moresby', capitalKm: 'ផតម៉រស្ប៊ី', continent: 'Oceania' },
  { flag: '🇼🇸', nameEn: 'Samoa', nameKm: 'សាម័រ', capitalEn: 'Apia', capitalKm: 'អាពៀ', continent: 'Oceania' },
];

export const CAMBODIA_PROVINCES: { km: string; en: string }[] = [
  { km: 'ភ្នំពេញ', en: 'Phnom Penh' },
  { km: 'បន្ទាយមានជ័យ', en: 'Banteay Meanchey' },
  { km: 'បាត់ដំបង', en: 'Battambang' },
  { km: 'កំពង់ចាម', en: 'Kampong Cham' },
  { km: 'កំពង់ឆ្នាំង', en: 'Kampong Chhnang' },
  { km: 'កំពង់ស្ពឺ', en: 'Kampong Speu' },
  { km: 'កំពង់ធំ', en: 'Kampong Thom' },
  { km: 'កំពត', en: 'Kampot' },
  { km: 'កណ្តាល', en: 'Kandal' },
  { km: 'កែប', en: 'Kep' },
  { km: 'កោះកុង', en: 'Koh Kong' },
  { km: 'ក្រចេះ', en: 'Kratie' },
  { km: 'មណ្ឌលគិរី', en: 'Mondulkiri' },
  { km: 'ឧត្តរមានជ័យ', en: 'Oddar Meanchey' },
  { km: 'ប៉ៃលិន', en: 'Pailin' },
  { km: 'ព្រះសីហនុ', en: 'Preah Sihanouk' },
  { km: 'ព្រះវិហារ', en: 'Preah Vihear' },
  { km: 'ព្រៃវែង', en: 'Prey Veng' },
  { km: 'ពោធិ៍សាត់', en: 'Pursat' },
  { km: 'រតនគិរី', en: 'Ratanakiri' },
  { km: 'សៀមរាប', en: 'Siem Reap' },
  { km: 'ស្ទឹងត្រែង', en: 'Stung Treng' },
  { km: 'ស្វាយរៀង', en: 'Svay Rieng' },
  { km: 'តាកែវ', en: 'Takeo' },
  { km: 'ត្បូងឃ្មុំ', en: 'Tboung Khmum' },
];

export const US_STATES: string[] = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
  'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

export interface NamedColorRecord {
  nameEn: string;
  nameKm: string;
  hex: string;
  group: 'vibrant' | 'pastel' | 'earth';
}

export const NAMED_COLORS: NamedColorRecord[] = [
  // Vibrant
  { nameEn: 'Crimson Red', nameKm: 'ក្រហមឆើត', hex: '#DC2626', group: 'vibrant' },
  { nameEn: 'Tangerine', nameKm: 'ទឹកក្រូចភ្លឺ', hex: '#F97316', group: 'vibrant' },
  { nameEn: 'Sunburst Gold', nameKm: 'លឿងមាស', hex: '#F59E0B', group: 'vibrant' },
  { nameEn: 'Emerald', nameKm: 'បៃតងមរកត', hex: '#10B981', group: 'vibrant' },
  { nameEn: 'Cyan Spark', nameKm: 'ខៀវផ្ទៃមេឃភ្លឺ', hex: '#06B6D4', group: 'vibrant' },
  { nameEn: 'Royal Blue', nameKm: 'ខៀវរាជ', hex: '#2563EB', group: 'vibrant' },
  { nameEn: 'Electric Indigo', nameKm: 'ស្វាយខៀវ', hex: '#4F46E5', group: 'vibrant' },
  { nameEn: 'Fuchsia Pop', nameKm: 'ផ្កាឈូកចាស់', hex: '#D946EF', group: 'vibrant' },
  // Pastel
  { nameEn: 'Rose Blush', nameKm: 'ផ្កាឈូកស្រាល', hex: '#FDA4AF', group: 'pastel' },
  { nameEn: 'Peach Cream', nameKm: 'ទឹកក្រូចស្រាល', hex: '#FDBA74', group: 'pastel' },
  { nameEn: 'Buttercup', nameKm: 'លឿងស្រាល', hex: '#FDE047', group: 'pastel' },
  { nameEn: 'Mint Leaf', nameKm: 'បៃតងស្រាល', hex: '#6EE7B7', group: 'pastel' },
  { nameEn: 'Sky Mist', nameKm: 'ខៀវស្រាល', hex: '#7DD3FC', group: 'pastel' },
  { nameEn: 'Periwinkle', nameKm: 'ខៀវស្វាយស្រាល', hex: '#A5B4FC', group: 'pastel' },
  { nameEn: 'Lavender', nameKm: 'ស្វាយផ្កាឡាវេនឌឺ', hex: '#D8B4FE', group: 'pastel' },
  { nameEn: 'Cotton Pink', nameKm: 'ផ្កាឈូកសំឡី', hex: '#F9A8D4', group: 'pastel' },
  // Earth
  { nameEn: 'Terracotta', nameKm: 'ដីឥដ្ឋក្រហម', hex: '#C2410C', group: 'earth' },
  { nameEn: 'Ochre Sand', nameKm: 'លឿងដីខ្សាច់', hex: '#B45309', group: 'earth' },
  { nameEn: 'Olive Grove', nameKm: 'បៃតងអូលីវ', hex: '#4D7C0F', group: 'earth' },
  { nameEn: 'Forest Pine', nameKm: 'បៃតងព្រៃស្រល់', hex: '#15803D', group: 'earth' },
  { nameEn: 'Deep Teal', nameKm: 'បៃតងសមុទ្រជ្រៅ', hex: '#0F766E', group: 'earth' },
  { nameEn: 'Slate Navy', nameKm: 'ខៀវងងឹត', hex: '#1E3A8A', group: 'earth' },
  { nameEn: 'Warm Espresso', nameKm: 'ត្នោតកាហ្វេ', hex: '#78350F', group: 'earth' },
  { nameEn: 'Charcoal Stone', nameKm: 'ប្រផេះថ្ម', hex: '#334155', group: 'earth' },
];

export const ENGLISH_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const ENGLISH_VOWELS = ['A', 'E', 'I', 'O', 'U'];
export const ENGLISH_CONSONANTS = ENGLISH_LETTERS.filter((l) => !ENGLISH_VOWELS.includes(l));
export const KHMER_CONSONANTS = [
  'ក', 'ខ', 'គ', 'ឃ', 'ង',
  'ច', 'ឆ', 'ជ', 'ឈ', 'ញ',
  'ដ', 'ឋ', 'ឌ', 'ឍ', 'ណ',
  'ត', 'ថ', 'ទ', 'ធ', 'ន',
  'ប', 'ផ', 'ព', 'ភ', 'ម',
  'យ', 'រ', 'ល', 'វ', 'ស',
  'ហ', 'ឡ', 'អ',
];

export interface SportsTeam {
  name: string;
  conference: string;
}

export const NBA_TEAMS: SportsTeam[] = [
  { name: 'Atlanta Hawks', conference: 'East' },
  { name: 'Boston Celtics', conference: 'East' },
  { name: 'Brooklyn Nets', conference: 'East' },
  { name: 'Charlotte Hornets', conference: 'East' },
  { name: 'Chicago Bulls', conference: 'East' },
  { name: 'Cleveland Cavaliers', conference: 'East' },
  { name: 'Detroit Pistons', conference: 'East' },
  { name: 'Indiana Pacers', conference: 'East' },
  { name: 'Miami Heat', conference: 'East' },
  { name: 'Milwaukee Bucks', conference: 'East' },
  { name: 'New York Knicks', conference: 'East' },
  { name: 'Orlando Magic', conference: 'East' },
  { name: 'Philadelphia 76ers', conference: 'East' },
  { name: 'Toronto Raptors', conference: 'East' },
  { name: 'Washington Wizards', conference: 'East' },
  { name: 'Dallas Mavericks', conference: 'West' },
  { name: 'Denver Nuggets', conference: 'West' },
  { name: 'Golden State Warriors', conference: 'West' },
  { name: 'Houston Rockets', conference: 'West' },
  { name: 'LA Clippers', conference: 'West' },
  { name: 'Los Angeles Lakers', conference: 'West' },
  { name: 'Memphis Grizzlies', conference: 'West' },
  { name: 'Minnesota Timberwolves', conference: 'West' },
  { name: 'New Orleans Pelicans', conference: 'West' },
  { name: 'Oklahoma City Thunder', conference: 'West' },
  { name: 'Phoenix Suns', conference: 'West' },
  { name: 'Portland Trail Blazers', conference: 'West' },
  { name: 'Sacramento Kings', conference: 'West' },
  { name: 'San Antonio Spurs', conference: 'West' },
  { name: 'Utah Jazz', conference: 'West' },
];

export const NFL_TEAMS: SportsTeam[] = [
  { name: 'Baltimore Ravens', conference: 'AFC' },
  { name: 'Buffalo Bills', conference: 'AFC' },
  { name: 'Cincinnati Bengals', conference: 'AFC' },
  { name: 'Cleveland Browns', conference: 'AFC' },
  { name: 'Denver Broncos', conference: 'AFC' },
  { name: 'Houston Texans', conference: 'AFC' },
  { name: 'Indianapolis Colts', conference: 'AFC' },
  { name: 'Jacksonville Jaguars', conference: 'AFC' },
  { name: 'Kansas City Chiefs', conference: 'AFC' },
  { name: 'Las Vegas Raiders', conference: 'AFC' },
  { name: 'Los Angeles Chargers', conference: 'AFC' },
  { name: 'Miami Dolphins', conference: 'AFC' },
  { name: 'New England Patriots', conference: 'AFC' },
  { name: 'New York Jets', conference: 'AFC' },
  { name: 'Pittsburgh Steelers', conference: 'AFC' },
  { name: 'Tennessee Titans', conference: 'AFC' },
  { name: 'Arizona Cardinals', conference: 'NFC' },
  { name: 'Atlanta Falcons', conference: 'NFC' },
  { name: 'Carolina Panthers', conference: 'NFC' },
  { name: 'Chicago Bears', conference: 'NFC' },
  { name: 'Dallas Cowboys', conference: 'NFC' },
  { name: 'Detroit Lions', conference: 'NFC' },
  { name: 'Green Bay Packers', conference: 'NFC' },
  { name: 'Los Angeles Rams', conference: 'NFC' },
  { name: 'Minnesota Vikings', conference: 'NFC' },
  { name: 'New Orleans Saints', conference: 'NFC' },
  { name: 'New York Giants', conference: 'NFC' },
  { name: 'Philadelphia Eagles', conference: 'NFC' },
  { name: 'San Francisco 49ers', conference: 'NFC' },
  { name: 'Seattle Seahawks', conference: 'NFC' },
  { name: 'Tampa Bay Buccaneers', conference: 'NFC' },
  { name: 'Washington Commanders', conference: 'NFC' },
];

export const MLB_TEAMS: SportsTeam[] = [
  { name: 'Baltimore Orioles', conference: 'AL' },
  { name: 'Boston Red Sox', conference: 'AL' },
  { name: 'Chicago White Sox', conference: 'AL' },
  { name: 'Cleveland Guardians', conference: 'AL' },
  { name: 'Detroit Tigers', conference: 'AL' },
  { name: 'Houston Astros', conference: 'AL' },
  { name: 'Kansas City Royals', conference: 'AL' },
  { name: 'Los Angeles Angels', conference: 'AL' },
  { name: 'Minnesota Twins', conference: 'AL' },
  { name: 'New York Yankees', conference: 'AL' },
  { name: 'Athletics', conference: 'AL' },
  { name: 'Seattle Mariners', conference: 'AL' },
  { name: 'Tampa Bay Rays', conference: 'AL' },
  { name: 'Texas Rangers', conference: 'AL' },
  { name: 'Toronto Blue Jays', conference: 'AL' },
  { name: 'Arizona Diamondbacks', conference: 'NL' },
  { name: 'Atlanta Braves', conference: 'NL' },
  { name: 'Chicago Cubs', conference: 'NL' },
  { name: 'Cincinnati Reds', conference: 'NL' },
  { name: 'Colorado Rockies', conference: 'NL' },
  { name: 'Los Angeles Dodgers', conference: 'NL' },
  { name: 'Miami Marlins', conference: 'NL' },
  { name: 'Milwaukee Brewers', conference: 'NL' },
  { name: 'New York Mets', conference: 'NL' },
  { name: 'Philadelphia Phillies', conference: 'NL' },
  { name: 'Pittsburgh Pirates', conference: 'NL' },
  { name: 'San Diego Padres', conference: 'NL' },
  { name: 'San Francisco Giants', conference: 'NL' },
  { name: 'St. Louis Cardinals', conference: 'NL' },
  { name: 'Washington Nationals', conference: 'NL' },
];

export const TRUTH_PROMPTS: { km: string; en: string }[] = [
  { km: 'ការពិត៖ តើមុខវិជ្ជាណាដែលអ្នកចូលចិត្តជាងគេ?', en: 'Truth: What is your favorite subject and why?' },
  { km: 'ការពិត៖ តើអ្វីជាសុបិនអាជីពរបស់អ្នកនាពេលអនាគត?', en: 'Truth: What is your dream career in the future?' },
  { km: 'ការពិត៖ តើម្ហូបអ្វីដែលអ្នកអាចញ៉ាំបានរាល់ថ្ងៃ?', en: 'Truth: What food could you eat every single day?' },
  { km: 'ការពិត៖ តើអ្នកធ្លាប់ភ្លេចធ្វើកិច្ចការផ្ទះដែរឬទេ?', en: 'Truth: Have you ever forgotten to do your homework?' },
  { km: 'ការពិត៖ តើកន្លែងណានៅកម្ពុជាដែលអ្នកចង់ទៅលេងបំផុត?', en: 'Truth: Which place in the world do you want to visit most?' },
  { km: 'ការពិត៖ តើអ្នកមានជំនាញសម្ងាត់អ្វីដែលមិត្តភក្តិមិនសូវដឹង?', en: 'Truth: What hidden talent do few people know about?' },
  { km: 'ការពិត៖ តើសៀវភៅ ឬភាពយន្តណាដែលអ្នកចូលចិត្តបំផុត?', en: 'Truth: What is your all-time favorite book or movie?' },
  { km: 'ការពិត៖ តើពេលណាដែលអ្នកមានមោទនភាពបំផុតលើខ្លួនឯង?', en: 'Truth: What is a moment you felt super proud of yourself?' },
  { km: 'ការពិត៖ បើអ្នកមានអំណាចពិសេស ១ តើអ្នករើសអ្វី?', en: 'Truth: If you could have one superpower, what would it be?' },
  { km: 'ការពិត៖ តើអ្នកចូលចិត្តក្រោកពីព្រលឹម ឬដេកយប់ជ្រៅ?', en: 'Truth: Are you an early bird or a night owl?' },
];

export const DARE_PROMPTS: { km: string; en: string }[] = [
  { km: 'ហ៊ានធ្វើ៖ និយាយសរសើរមិត្តភក្តិ ២ នាក់នៅក្នុងថ្នាក់!', en: 'Dare: Give a genuine compliment to 2 classmates!' },
  { km: 'ហ៊ានធ្វើ៖ ច្រៀងបទចម្រៀងខ្លី ១ ឃ្លាដោយសំឡេងរីករាយ!', en: 'Dare: Sing one cheerful line of your favorite song!' },
  { km: 'ហ៊ានធ្វើ៖ ឈរលើជើងម្ខាងរាប់ពី ១ ដល់ ១០ ដោយមិនដួល!', en: 'Dare: Balance on one foot while counting to 10!' },
  { km: 'ហ៊ានធ្វើ៖ និយាយប្រយោគភាសាអង់គ្លេស ១ ដោយសំឡេងរ៉ូបូត!', en: 'Dare: Introduce yourself using a funny robot voice!' },
  { km: 'ហ៊ានធ្វើ៖ ធ្វើកាយវិការដូចសត្វ ១ ប្រភេទឱ្យមិត្តភក្តិទាយ!', en: 'Dare: Act like an animal silently until the class guesses!' },
  { km: 'ហ៊ានធ្វើ៖ ទះដៃតាមចង្វាក់រហ័ស ៥ វិនាទីជាមួយក្រុម!', en: 'Dare: Lead the whole room in a 5-second rhythm clap!' },
  { km: 'ហ៊ានធ្វើ៖ និយាយរាប់ថយក្រោយពី ២០ មក ១ ឱ្យលឿនបំផុត!', en: 'Dare: Count backwards from 20 to 1 as fast as you can!' },
  { km: 'ហ៊ានធ្វើ៖ គូររូបសត្វឆ្មាលើអាកាសដោយប្រើកែងដៃ!', en: 'Dare: Draw a star in the air using only your elbow!' },
  { km: 'ហ៊ានធ្វើ៖ ញញឹមដាក់មិត្តភក្តិ ១០ វិនាទីដោយមិនសើច!', en: 'Dare: Hold your biggest smile for 10 seconds without laughing!' },
  { km: 'ហ៊ានធ្វើ៖ រៀបរាប់ពាក្យ ៣ ម៉ាត់ដែលពិពណ៌នាអំពីថ្ងៃនេះ!', en: 'Dare: Describe today in 3 dramatic words like a movie trailer!' },
];

export interface ImageWheelItem {
  id: string;
  label: string;
  imageUrl?: string;
  emoji?: string;
  bgColor: string;
}

export const STARTER_IMAGE_ITEMS: ImageWheelItem[] = [
  { id: 'img-1', label: '🏆 Trophy', emoji: '🏆', bgColor: '#FEF3C7' },
  { id: 'img-2', label: '🎨 Art Kit', emoji: '🎨', bgColor: '#FCE7F3' },
  { id: 'img-3', label: '🚀 Rocket', emoji: '🚀', bgColor: '#DBEAFE' },
  { id: 'img-4', label: '📚 Book Prize', emoji: '📚', bgColor: '#D1FAE5' },
  { id: 'img-5', label: '🎵 Music Star', emoji: '🎵', bgColor: '#EDE9FE' },
  { id: 'img-6', label: '🌟 Gold Star', emoji: '🌟', bgColor: '#FFEDD5' },
];

export interface ParsedInstagramComment {
  username: string;
  comment: string;
  entryLabel: string;
}

export function buildYesNoEntries(
  mode: 'yes_no' | 'yes_no_maybe',
  repeats: number,
  lang: Language
): string[] {
  const yes = lang === 'km' ? 'បាទ / ចាស (YES)' : 'YES';
  const no = lang === 'km' ? 'ទេ (NO)' : 'NO';
  const maybe = lang === 'km' ? 'ប្រហែល (MAYBE)' : 'MAYBE';
  const base = mode === 'yes_no' ? [yes, no] : [yes, no, maybe];
  const clampedRepeats = Math.min(6, Math.max(1, repeats));
  const out: string[] = [];
  for (let i = 0; i < clampedRepeats; i++) {
    out.push(...base);
  }
  return out;
}

export function buildNumberEntries(
  min: number,
  max: number,
  step: number,
  excludeRaw: string
): string[] {
  const safeStep = Math.max(1, Math.round(step));
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const excluded = new Set(
    excludeRaw
      .split(/[,\s;]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n))
  );
  const out: string[] = [];
  for (let v = low; v <= high && out.length < 100; v += safeStep) {
    if (!excluded.has(v)) out.push(String(v));
  }
  return out.length >= 2 ? out : ['1', '2'];
}

export function buildDateEntries(
  mode: 'range' | 'weekdays' | 'months',
  startDate: string,
  endDate: string,
  lang: Language
): string[] {
  if (mode === 'weekdays') {
    return lang === 'km'
      ? ['ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍', 'អាទិត្យ']
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  }
  if (mode === 'months') {
    return lang === 'km'
      ? [
          'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
          'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ',
        ]
      : [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December',
        ];
  }
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ['2026-01-01', '2026-01-02'];
  }
  const a = start <= end ? start : end;
  const b = start <= end ? end : start;
  const out: string[] = [];
  const cursor = new Date(a.getTime());
  while (cursor <= b && out.length < 60) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    out.push(`${d}/${m}/${y}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out.length >= 2 ? out : [`${startDate}`, `${endDate}`];
}

export function parseInstagramComments(
  rawText: string,
  deduplicateUsers: boolean,
  keywordFilter: string
): ParsedInstagramComment[] {
  const kw = keywordFilter.trim().toLowerCase();
  const seenUsers = new Set<string>();
  const results: ParsedInstagramComment[] = [];

  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let username = '';
    let comment = '';

    const colonMatch = line.match(/^(@?[\w.]{1,35})\s*[:\-–]\s*(.*)$/);
    if (colonMatch) {
      username = colonMatch[1].startsWith('@') ? colonMatch[1] : `@${colonMatch[1]}`;
      comment = colonMatch[2].trim();
    } else if (line.startsWith('@')) {
      const parts = line.split(/\s+/);
      username = parts[0];
      comment = parts.slice(1).join(' ').trim();
    } else {
      username = `@${line.replace(/\s+/g, '_').slice(0, 28)}`;
      comment = line;
    }

    if (kw && !`${username} ${comment}`.toLowerCase().includes(kw)) {
      continue;
    }

    const userKey = username.toLowerCase();
    if (deduplicateUsers && seenUsers.has(userKey)) {
      continue;
    }
    seenUsers.add(userKey);

    results.push({
      username,
      comment,
      entryLabel: username,
    });
    if (results.length >= 100) break;
  }

  return results;
}

export const SAMPLE_INSTAGRAM_COMMENTS = `@sok_dara: Love this classroom activity! #pickerwel
@chan_mali: Count me in! So fun #pickerwel
@vanna_kh: Hope I win today!
@ly_vibol: Best wheel tool ever #pickerwel
@sopheak_dev: Let's gooo!
@chhor_nita: Fingers crossed! #pickerwel
@dara_99: Picking me next!
@mey_ling: Awesome giveaway! #pickerwel`;

export function findCountryByFlagEntry(entry: string): CountryRecord | undefined {
  const trimmed = entry.trim();
  return WORLD_COUNTRIES.find(
    (c) => trimmed === c.flag || trimmed.startsWith(c.flag)
  );
}

export function findColorByEntry(entry: string): NamedColorRecord | undefined {
  const hexMatch = entry.match(/#[0-9A-Fa-f]{6}/);
  if (hexMatch) {
    const hex = hexMatch[0].toUpperCase();
    return NAMED_COLORS.find((c) => c.hex.toUpperCase() === hex);
  }
  return undefined;
}
