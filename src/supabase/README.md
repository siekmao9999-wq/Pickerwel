# Pickerwel — Supabase SQL Schema

ឯកសារ SQL នៅក្នុងថត `src/supabase/` នេះផ្ទុករចនាសម្ព័ន្ធមូលដ្ឋានទិន្នន័យ PostgreSQL ពេញលេញសម្រាប់ **Supabase** ដែលត្រូវគ្នានឹងរចនាសម្ព័ន្ធទិន្នន័យទាំងអស់របស់កម្មវិធី Pickerwel។

## ឯកសារ
- `src/supabase/schema.sql` — Script SQL ពេញលេញ (ENUM types, តារាងទាំង 11, Indexes, Triggers, RPC Functions សុវត្ថិភាព និង Row Level Security / RLS Policies)។

## របៀបប្រើប្រាស់ក្នុង Supabase
1. បើកគម្រោងរបស់អ្នកនៅលើ [Supabase Dashboard](https://supabase.com/dashboard)។
2. ចូលទៅកាន់ **SQL Editor** → ចុច **New query**។
3. ចម្លងខ្លឹមសារទាំងអស់ពី `src/supabase/schema.sql` ដាក់ចូល រួចចុច **Run**។
4. (ជម្រើស) បើចង់ប្រើ Realtime updates សូមដកសញ្ញា comment (`--`) នៅផ្នែក `8. REALTIME PUBLICATION` ខាងក្រោមឯកសារ។

## តារាងទាំង 11 (Tables Overview)
| # | Supabase Table | តួនាទី (Purpose) |
|---|---|---|
| 1 | `public.users` | គណនីអ្នកប្រើប្រាស់ ការអនុម័ត (`pending`/`approved`/`rejected`) Role និងការកំណត់ UI |
| 2 | `public.admins` | បញ្ជី Admin ដែលមានសិទ្ធិគ្រប់គ្រង |
| 3 | `public.app_config` | ការកំណត់សាធារណៈរបស់កម្មវិធី (ឈ្មោះ Admin) |
| 4 | `public.wheels` | កង់វិលដែលបានរក្សាទុករបស់អ្នកប្រើប្រាស់នីមួយៗ (អតិបរមា 200 ធាតុ) |
| 5 | `public.spin_results` | ប្រវត្តិលទ្ធផលនៃការបង្វិលកង់ |
| 6 | `public.passcodes` | លេខកូដចុះឈ្មោះដែលបង្កើតដោយ Primary Admin |
| 7 | `public.passcode_members` | សមាជិកចុះឈ្មោះដោយប្រើឈ្មោះ និង Passcode (គ្មានអ៊ីមែល) |
| 8 | `public.assignments` | កិច្ចការអនុវត្តសិស្ស (ភ្ជាប់ Link & QR Code) |
| 9 | `public.student_submissions` | ចម្លើយកិច្ចការដែលសិស្សបានដាក់ស្នើ |
| 10 | `public.forms` | ទម្រង់សំណួរ និងតេស្តពិន្ទុស្វ័យប្រវត្តិ (Google Forms-style) |
| 11 | `public.form_responses` | ចម្លើយ និងពិន្ទុរបស់អ្នកឆ្លើយទម្រង់ |

## សុវត្ថិភាព (RLS & RPC Functions)
- **Row Level Security (RLS)** ត្រូវបានបើកលើគ្រប់តារាងទាំង 11។
- អ្នកប្រើប្រាស់ធម្មតាមិនអាចកែប្រែ `role` ឬ `status` របស់ខ្លួនឯងបានទេ (ការពារដោយ Trigger `guard_user_profile_update`)។
- តំណភ្ជាប់សាធារណៈសម្រាប់សិស្ស និងអ្នកឆ្លើយ Form ប្រើ RPC (`get_public_assignment`, `submit_student_work`, `get_public_form`, `submit_form_response`, `register_passcode_member`) ដើម្បីកុំឱ្យអ្នកខាងក្រៅអាចទាញបញ្ជីទិន្នន័យទាំងអស់ (`SELECT *`) បាន។
