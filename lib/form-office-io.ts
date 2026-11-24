import {
  generateQuestionId,
  generateResponseId,
  type CustomForm,
  type FormEmailMode,
  type FormQuestion,
  type FormQuestionType,
  type FormResponseRecord,
} from './forms-model';
import type { Language } from './i18n';

function sanitizeFileName(raw: string): string {
  const cleaned = (raw || 'form')
    .trim()
    .replace(/[^\w\u1780-\u17FF\s-]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return cleaned || 'form';
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function formatDateTime(ms: number): string {
  try {
    return new Date(ms).toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

function formatAnswerValue(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'string') return val;
  return '';
}

function computeQuestionCounts(
  q: FormQuestion,
  responses: FormResponseRecord[]
): { answeredCount: number; rows: Array<[string, number, number]> } {
  const counts = new Map<string, number>();
  if (q.type === 'linear_scale') {
    const min = q.scaleMin ?? 1;
    const max = q.scaleMax ?? 5;
    for (let v = min; v <= max; v++) counts.set(String(v), 0);
  } else {
    for (const opt of q.options) counts.set(opt, 0);
  }

  let answeredCount = 0;
  for (const resp of responses) {
    const val = resp.answers[q.id];
    if (Array.isArray(val) && val.length > 0) {
      answeredCount++;
      for (const item of val) {
        counts.set(item, (counts.get(item) || 0) + 1);
      }
    } else if (typeof val === 'string' && val.trim()) {
      answeredCount++;
      counts.set(val, (counts.get(val) || 0) + 1);
    }
  }

  const rows: Array<[string, number, number]> = Array.from(counts.entries()).map(
    ([label, count]) => [
      label,
      count,
      answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0,
    ]
  );

  return { answeredCount, rows };
}

/**
 * Export complete Form structure, Summary statistics, and all Responses into a real multi-sheet Excel (.xlsx) file.
 */
export async function exportFormToExcelXlsx(
  form: CustomForm,
  responses: FormResponseRecord[],
  language: Language
): Promise<void> {
  const XLSX = await import('xlsx');
  const km = language === 'km';
  const answerable = form.questions.filter((q) => q.type !== 'section');
  const includeEmail =
    (form.settings.emailMode || 'none') !== 'none' ||
    responses.some((r) => Boolean(r.respondentEmail && r.respondentEmail.trim()));

  const wb = XLSX.utils.book_new();

  // SHEET 1: Responses (All submitted data)
  const respHeaders = [
    '#',
    km ? 'កាលបរិច្ឆេទ (Submitted At)' : 'Submitted At',
    km ? 'ឈ្មោះអ្នកឆ្លើយ (Respondent)' : 'Respondent',
    ...(includeEmail ? [km ? 'អ៊ីមែល (Email)' : 'Email'] : []),
    ...(form.settings.isQuiz ? [km ? 'ពិន្ទុ (Score)' : 'Score'] : []),
    ...answerable.map((q, idx) => q.title || `Q${idx + 1}`),
  ];

  const respRows = responses.map((r, idx) => [
    idx + 1,
    formatDateTime(r.submittedAtMs),
    r.respondentName || (km ? 'អ្នកឆ្លើយអនាមិក' : 'Anonymous'),
    ...(includeEmail ? [r.respondentEmail || ''] : []),
    ...(form.settings.isQuiz ? [`${r.score}/${r.maxScore}`] : []),
    ...answerable.map((q) => formatAnswerValue(r.answers[q.id])),
  ]);

  const wsResponses = XLSX.utils.aoa_to_sheet([respHeaders, ...respRows]);
  wsResponses['!cols'] = respHeaders.map((h, i) => ({
    wch: i === 0 ? 6 : Math.min(42, Math.max(16, String(h).length + 4)),
  }));
  XLSX.utils.book_append_sheet(wb, wsResponses, 'Responses');

  // SHEET 2: Summary (Overview + Option Breakdown)
  const summaryRows: Array<Array<string | number>> = [
    [km ? 'ចំណងជើងទម្រង់ (Form Title)' : 'Form Title', form.title || 'Untitled Form'],
    [km ? 'ការពិពណ៌នា (Description)' : 'Description', form.description || ''],
    [km ? 'ចំនួនចម្លើយសរុប (Total Responses)' : 'Total Responses', responses.length],
    [
      km ? 'របៀប Email (Email Mode)' : 'Email Mode',
      form.settings.emailMode || 'none',
    ],
    [
      km ? 'របៀបតេស្ត (Quiz Mode)' : 'Quiz Mode',
      form.settings.isQuiz ? 'Yes' : 'No',
    ],
    [km ? 'កាលបរិច្ឆេទទាញចេញ (Exported At)' : 'Exported At', formatDateTime(Date.now())],
    [],
    [
      km ? 'សំណួរ (Question)' : 'Question',
      km ? 'ជម្រើស (Option)' : 'Option',
      km ? 'ចំនួន (Count)' : 'Count',
      km ? 'ភាគរយ (%)' : 'Percentage (%)',
    ],
  ];

  for (const q of answerable) {
    const isChoice =
      q.type === 'multiple_choice' ||
      q.type === 'checkboxes' ||
      q.type === 'dropdown' ||
      q.type === 'linear_scale';
    if (isChoice) {
      const { rows } = computeQuestionCounts(q, responses);
      rows.forEach(([label, count, pct], rIdx) => {
        summaryRows.push([rIdx === 0 ? q.title : '', label, count, `${pct}%`]);
      });
    } else {
      const answeredCount = responses.filter((r) =>
        Boolean(formatAnswerValue(r.answers[q.id]).trim())
      ).length;
      summaryRows.push([
        q.title,
        km ? '(ចម្លើយជាអត្ថបទ — មើលក្នុងផ្ទាំង Responses)' : '(Text responses — see Responses sheet)',
        answeredCount,
        responses.length > 0 ? `${Math.round((answeredCount / responses.length) * 100)}%` : '0%',
      ]);
    }
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 36 }, { wch: 34 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // SHEET 3: Questions (Round-trip friendly structure)
  const questionHeaders = [
    '#',
    'Question',
    'Type',
    'Required',
    'Options',
    'HasOther',
    'CorrectAnswer',
    'Points',
    'Description',
  ];
  const questionRows = form.questions.map((q, idx) => [
    idx + 1,
    q.title,
    q.type,
    q.required ? 'Yes' : 'No',
    q.options.join(' | '),
    q.hasOther ? 'Yes' : 'No',
    q.correctOption || '',
    q.points ?? 0,
    q.description || '',
  ]);
  const wsQuestions = XLSX.utils.aoa_to_sheet([questionHeaders, ...questionRows]);
  wsQuestions['!cols'] = [
    { wch: 6 },
    { wch: 36 },
    { wch: 16 },
    { wch: 10 },
    { wch: 42 },
    { wch: 10 },
    { wch: 20 },
    { wch: 8 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsQuestions, 'Questions');

  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, `${sanitizeFileName(form.title)}_form_data.xlsx`);
}

/**
 * Export complete Form questions, summary statistics, and all respondent data into a real Microsoft Word (.docx) document.
 */
export async function exportFormToWordDocx(
  form: CustomForm,
  responses: FormResponseRecord[],
  language: Language
): Promise<void> {
  const docx = await import('docx');
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = docx;

  const km = language === 'km';
  const answerable = form.questions.filter((q) => q.type !== 'section');
  const includeEmail =
    (form.settings.emailMode || 'none') !== 'none' ||
    responses.some((r) => Boolean(r.respondentEmail && r.respondentEmail.trim()));

  const FONT_NAME = 'Khmer OS Battambang';
  const accentHex = '673AB7';

  const makeRun = (
    text: string,
    opts?: { bold?: boolean; italics?: boolean; size?: number; color?: string }
  ) =>
    new TextRun({
      text,
      font: FONT_NAME,
      bold: opts?.bold,
      italics: opts?.italics,
      size: opts?.size ?? 22,
      color: opts?.color,
    });

  const makeCell = (
    text: string,
    opts?: { bold?: boolean; shaded?: boolean; header?: boolean; widthPct?: number }
  ) =>
    new TableCell({
      width: opts?.widthPct
        ? { size: opts.widthPct, type: WidthType.PERCENTAGE }
        : undefined,
      shading: opts?.header
        ? { fill: accentHex, type: ShadingType.CLEAR, color: 'auto' }
        : opts?.shaded
          ? { fill: 'F5F3FF', type: ShadingType.CLEAR, color: 'auto' }
          : undefined,
      margins: { top: 80, bottom: 80, left: 110, right: 110 },
      children: [
        new Paragraph({
          children: [
            makeRun(text, {
              bold: opts?.bold || opts?.header,
              size: opts?.header ? 20 : 19,
              color: opts?.header ? 'FFFFFF' : '1E293B',
            }),
          ],
        }),
      ],
    });

  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
  };

  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [];

  // Title & Metadata
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 100 },
      children: [
        makeRun(form.title || (km ? 'ទម្រង់គ្មានចំណងជើង' : 'Untitled Form'), {
          bold: true,
          size: 36,
          color: accentHex,
        }),
      ],
    })
  );

  if (form.description) {
    children.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [makeRun(form.description, { size: 22, color: '475569' })],
      })
    );
  }

  const emailModeLabel =
    (form.settings.emailMode || 'none') === 'required'
      ? km
        ? 'ប្រើ Email (ចាំបាច់)'
        : 'Email Required'
      : form.settings.emailMode === 'optional'
        ? km
          ? 'Email (ស្រេចចិត្ត)'
          : 'Email Optional'
        : km
          ? 'អត់ប្រើ Email'
          : 'No Email';

  children.push(
    new Paragraph({
      spacing: { after: 220 },
      children: [
        makeRun(
          `${km ? 'ចំនួនចម្លើយសរុប' : 'Total Responses'}: ${responses.length}   |   ${km ? 'សំណួរ' : 'Questions'}: ${answerable.length}   |   Email: ${emailModeLabel}   |   ${formatDateTime(Date.now())}`,
          { size: 19, color: '64748B', italics: true }
        ),
      ],
    })
  );

  // SECTION 1: Printable Form Questions
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 120, after: 120 },
      children: [
        makeRun(km ? '១. តារាងសំណួរក្នុងទម្រង់ (Form Questions)' : '1. Form Questions', {
          bold: true,
          size: 26,
          color: accentHex,
        }),
      ],
    })
  );

  let qNum = 0;
  for (const q of form.questions) {
    if (q.type === 'section') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 80 },
          children: [makeRun(q.title, { bold: true, size: 24, color: '0F172A' })],
        })
      );
      if (q.description) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [makeRun(q.description, { size: 20, color: '64748B' })],
          })
        );
      }
      continue;
    }

    qNum++;
    const reqMark = q.required ? ' *' : '';
    const ptsMark =
      form.settings.isQuiz && (q.points ?? 0) > 0
        ? ` (${q.points} ${km ? 'ពិន្ទុ' : 'pts'})`
        : '';

    children.push(
      new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [makeRun(`${qNum}. ${q.title}${reqMark}${ptsMark}`, { bold: true, size: 22 })],
      })
    );

    if (q.description) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          indent: { left: 280 },
          children: [makeRun(q.description, { size: 19, italics: true, color: '64748B' })],
        })
      );
    }

    if (q.type === 'multiple_choice' || q.type === 'checkboxes' || q.type === 'dropdown') {
      const bullet = q.type === 'checkboxes' ? '☐' : '○';
      for (const opt of q.options) {
        children.push(
          new Paragraph({
            spacing: { after: 30 },
            indent: { left: 360 },
            children: [makeRun(`${bullet}  ${opt}`, { size: 20, color: '334155' })],
          })
        );
      }
      if (q.hasOther) {
        children.push(
          new Paragraph({
            spacing: { after: 30 },
            indent: { left: 360 },
            children: [
              makeRun(
                `${bullet}  ${km ? 'ផ្សេងៗ៖ ___________________________' : 'Other: ___________________________'}`,
                { size: 20, color: '64748B' }
              ),
            ],
          })
        );
      }
    } else if (q.type === 'linear_scale') {
      const min = q.scaleMin ?? 1;
      const max = q.scaleMax ?? 5;
      const nums: string[] = [];
      for (let v = min; v <= max; v++) nums.push(`[ ${v} ]`);
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 360 },
          children: [
            makeRun(
              `${q.scaleMinLabel || min}   ${nums.join('   ')}   ${q.scaleMaxLabel || max}`,
              { size: 20, color: '475569' }
            ),
          ],
        })
      );
    } else {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          indent: { left: 360 },
          children: [
            makeRun(
              q.type === 'paragraph'
                ? '___________________________________________________________________\n___________________________________________________________________'
                : '______________________________________________________',
              { size: 20, color: '94A3B8' }
            ),
          ],
        })
      );
    }
  }

  // SECTION 2: Summary Statistics
  if (responses.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280, after: 120 },
        children: [
          makeRun(
            km ? '២. សង្ខេបលទ្ធផលស្ថិតិ (Summary Analytics)' : '2. Summary Analytics',
            { bold: true, size: 26, color: accentHex }
          ),
        ],
      })
    );

    const summaryTableRows: InstanceType<typeof TableRow>[] = [
      new TableRow({
        tableHeader: true,
        children: [
          makeCell(km ? 'សំណួរ' : 'Question', { header: true, widthPct: 42 }),
          makeCell(km ? 'ជម្រើស / ព័ត៌មាន' : 'Option', { header: true, widthPct: 34 }),
          makeCell(km ? 'ចំនួន' : 'Count', { header: true, widthPct: 12 }),
          makeCell('%', { header: true, widthPct: 12 }),
        ],
      }),
    ];

    let rowShade = false;
    for (const q of answerable) {
      const isChoice =
        q.type === 'multiple_choice' ||
        q.type === 'checkboxes' ||
        q.type === 'dropdown' ||
        q.type === 'linear_scale';
      if (!isChoice) continue;
      const { rows } = computeQuestionCounts(q, responses);
      rows.forEach(([label, count, pct], idx) => {
        summaryTableRows.push(
          new TableRow({
            children: [
              makeCell(idx === 0 ? q.title : '', { bold: idx === 0, shaded: rowShade }),
              makeCell(label, { shaded: rowShade }),
              makeCell(String(count), { shaded: rowShade }),
              makeCell(`${pct}%`, { shaded: rowShade }),
            ],
          })
        );
      });
      rowShade = !rowShade;
    }

    if (summaryTableRows.length > 1) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: summaryTableRows,
        })
      );
    }
  }

  // SECTION 3: All Individual Responses
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 280, after: 120 },
      children: [
        makeRun(
          km
            ? `៣. ទិន្នន័យចម្លើយទាំងអស់ (${responses.length} ចម្លើយ)`
            : `3. All Submitted Responses (${responses.length})`,
          { bold: true, size: 26, color: accentHex }
        ),
      ],
    })
  );

  if (responses.length === 0) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          makeRun(
            km ? 'មិនទាន់មានចម្លើយពីអ្នកចូលរួមនៅឡើយទេ។' : 'No responses submitted yet.',
            { italics: true, color: '64748B' }
          ),
        ],
      })
    );
  } else if (answerable.length <= 4) {
    // Compact single table when columns fit cleanly on portrait A4
    const colHeaders = [
      '#',
      km ? 'អ្នកឆ្លើយ' : 'Respondent',
      ...(includeEmail ? ['Email'] : []),
      ...(form.settings.isQuiz ? [km ? 'ពិន្ទុ' : 'Score'] : []),
      ...answerable.map((q) => q.title),
    ];

    const dataRows = responses.map(
      (r, idx) =>
        new TableRow({
          children: [
            makeCell(String(idx + 1), { shaded: idx % 2 === 1 }),
            makeCell(
              `${r.respondentName || (km ? 'អនាមិក' : 'Anonymous')}\n${formatDateTime(r.submittedAtMs)}`,
              { bold: true, shaded: idx % 2 === 1 }
            ),
            ...(includeEmail ? [makeCell(r.respondentEmail || '—', { shaded: idx % 2 === 1 })] : []),
            ...(form.settings.isQuiz
              ? [makeCell(`${r.score}/${r.maxScore}`, { bold: true, shaded: idx % 2 === 1 })]
              : []),
            ...answerable.map((q) =>
              makeCell(formatAnswerValue(r.answers[q.id]) || '—', { shaded: idx % 2 === 1 })
            ),
          ],
        })
    );

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: [
          new TableRow({
            tableHeader: true,
            children: colHeaders.map((h) => makeCell(h, { header: true })),
          }),
          ...dataRows,
        ],
      })
    );
  } else {
    // Clean individual response tables when there are many questions (prevents squished Word columns)
    responses.forEach((r, idx) => {
      const headerLine = [
        `#${idx + 1} — ${r.respondentName || (km ? 'អ្នកឆ្លើយអនាមិក' : 'Anonymous')}`,
        includeEmail && r.respondentEmail ? `(${r.respondentEmail})` : '',
        form.settings.isQuiz && r.maxScore > 0 ? `[${r.score}/${r.maxScore}]` : '',
        `· ${formatDateTime(r.submittedAtMs)}`,
      ]
        .filter(Boolean)
        .join(' ');

      children.push(
        new Paragraph({
          spacing: { before: 160, after: 60 },
          children: [makeRun(headerLine, { bold: true, size: 21, color: '0F172A' })],
        })
      );

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                makeCell(km ? 'សំណួរ' : 'Question', { header: true, widthPct: 45 }),
                makeCell(km ? 'ចម្លើយ' : 'Answer', { header: true, widthPct: 55 }),
              ],
            }),
            ...answerable.map(
              (q, qIdx) =>
                new TableRow({
                  children: [
                    makeCell(q.title, { bold: true, shaded: qIdx % 2 === 1 }),
                    makeCell(formatAnswerValue(r.answers[q.id]) || '—', {
                      shaded: qIdx % 2 === 1,
                    }),
                  ],
                })
            ),
          ],
        })
      );
    });
  }

  // Footer note
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 260 },
      children: [
        makeRun(`Generated by Pickerwel Forms · ${formatDateTime(Date.now())}`, {
          size: 16,
          italics: true,
          color: '94A3B8',
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerBlobDownload(blob, `${sanitizeFileName(form.title)}_form_data.docx`);
}

function normalizeQuestionType(raw: string, hasOptions: boolean): FormQuestionType {
  const s = raw.trim().toLowerCase();
  if (s.includes('check') || s.includes('ប្រអប់')) return 'checkboxes';
  if (s.includes('drop') || s.includes('ទម្លាក់')) return 'dropdown';
  if (s.includes('para') || s.includes('long') || s.includes('វែង')) return 'paragraph';
  if (s.includes('short') || s.includes('ខ្លី')) return 'short_answer';
  if (s.includes('scale') || s.includes('មាត្រដ្ឋាន')) return 'linear_scale';
  if (s.includes('date') || s.includes('កាលបរិច្ឆេទ')) return 'date';
  if (s.includes('time') || s.includes('ម៉ោង')) return 'time';
  if (s.includes('section') || s.includes('ផ្នែក')) return 'section';
  if (s.includes('multiple') || s.includes('radio') || s.includes('ពហុ')) {
    return 'multiple_choice';
  }
  return hasOptions ? 'multiple_choice' : 'short_answer';
}

export interface ImportedOfficeFormResult {
  title: string;
  questions: FormQuestion[];
  responses: FormResponseRecord[];
  emailMode?: FormEmailMode;
}

/**
 * Import Form Questions (and Responses if present) from an Excel (.xlsx / .xls / .csv) file.
 */
export async function importFormFromExcelFile(
  file: File,
  formId: string
): Promise<ImportedOfficeFormResult | null> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  if (!wb.SheetNames.length) return null;

  const baseTitle = file.name.replace(/\.(xlsx|xls|csv)$/i, '').replace(/[_-]+/g, ' ').trim();
  const questions: FormQuestion[] = [];
  const responses: FormResponseRecord[] = [];
  let detectedEmailMode: FormEmailMode | undefined;

  // Check if there's an explicit "Questions" sheet (e.g. round-trip export)
  const questionsSheetName = wb.SheetNames.find(
    (n) => n.toLowerCase() === 'questions' || n.includes('សំណួរ')
  );
  const responsesSheetName = wb.SheetNames.find(
    (n) => n.toLowerCase() === 'responses' || n.includes('ចម្លើយ')
  );

  const parseQuestionsSheet = (sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean>>(ws, {
      header: 1,
      defval: '',
    });
    if (rows.length === 0) return;

    const firstRow = rows[0].map((c) => String(c || '').trim().toLowerCase());
    const qColIdx = firstRow.findIndex(
      (h) => h === 'question' || h === 'title' || h.includes('សំណួរ')
    );

    if (qColIdx >= 0) {
      const typeCol = firstRow.findIndex((h) => h === 'type' || h.includes('ប្រភេទ'));
      const reqCol = firstRow.findIndex((h) => h === 'required' || h.includes('ចាំបាច់'));
      const optCol = firstRow.findIndex((h) => h === 'options' || h.includes('ជម្រើស'));
      const otherCol = firstRow.findIndex((h) => h === 'hasother' || h.includes('ផ្សេង'));
      const ansCol = firstRow.findIndex((h) => h.includes('correct') || h.includes('ចម្លើយត្រឹមត្រូវ'));
      const ptsCol = firstRow.findIndex((h) => h === 'points' || h.includes('ពិន្ទុ'));
      const descCol = firstRow.findIndex((h) => h === 'description' || h.includes('ពិពណ៌នា'));

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const title = String(row[qColIdx] || '').trim().slice(0, 240);
        if (!title) continue;
        const rawOpts = optCol >= 0 ? String(row[optCol] || '').trim() : '';
        const options = rawOpts
          ? rawOpts
              .split(/\s*[|;\n]\s*/)
              .map((o) => o.trim().slice(0, 140))
              .filter(Boolean)
          : [];
        const rawType = typeCol >= 0 ? String(row[typeCol] || '') : '';
        const type = normalizeQuestionType(rawType, options.length > 0);
        const reqVal = reqCol >= 0 ? String(row[reqCol] || '').toLowerCase() : '';
        const required = reqVal === 'yes' || reqVal === 'true' || reqVal === '1' || reqVal === 'បាទ';
        const otherVal = otherCol >= 0 ? String(row[otherCol] || '').toLowerCase() : '';
        const hasOther = otherVal === 'yes' || otherVal === 'true' || otherVal === '1';
        const correctOption = ansCol >= 0 ? String(row[ansCol] || '').trim() : '';
        const points = ptsCol >= 0 ? Math.max(0, Number(row[ptsCol] || 0)) : 0;
        const description = descCol >= 0 ? String(row[descCol] || '').trim() : '';

        questions.push({
          id: generateQuestionId(),
          type,
          title,
          description,
          required,
          options:
            (type === 'multiple_choice' || type === 'checkboxes' || type === 'dropdown') &&
            options.length === 0
              ? ['Option 1', 'Option 2']
              : options,
          hasOther,
          correctOption: correctOption || undefined,
          points,
        });
      }
      return;
    }

    // Fallback: simple table (Col A = Question, Col B..Z = Options)
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r].map((c) => String(c || '').trim()).filter(Boolean);
      if (row.length === 0) continue;
      // Skip obvious metadata header row
      if (r === 0 && /^(#|no\.?|number)$/i.test(row[0]) && row.length <= 2) continue;
      const title = row[0].slice(0, 240);
      let options: string[] = [];
      if (row.length === 2 && /[|;]/.test(row[1])) {
        options = row[1]
          .split(/\s*[|;]\s*/)
          .map((o) => o.trim())
          .filter(Boolean);
      } else if (row.length >= 2) {
        options = row.slice(1).slice(0, 30);
      }
      questions.push({
        id: generateQuestionId(),
        type: options.length >= 2 ? 'multiple_choice' : 'short_answer',
        title,
        required: false,
        options: options.length >= 2 ? options : [],
        points: 0,
      });
    }
  };

  if (questionsSheetName) {
    parseQuestionsSheet(questionsSheetName);
  } else {
    // Check if the first sheet is a Responses sheet (like Google Forms CSV/Excel export)
    const firstSheetName = wb.SheetNames[0];
    const firstRows = XLSX.utils.sheet_to_json<Array<string | number>>(wb.Sheets[firstSheetName], {
      header: 1,
      defval: '',
    });
    const headers = (firstRows[0] || []).map((c) => String(c || '').trim());
    const lowerHeaders = headers.map((h) => h.toLowerCase());
    const looksLikeResponsesTable =
      firstRows.length >= 1 &&
      lowerHeaders.some(
        (h) =>
          h.includes('timestamp') ||
          h.includes('submitted at') ||
          h.includes('respondent') ||
          h.includes('ឈ្មោះអ្នកឆ្លើយ')
      );

    if (looksLikeResponsesTable) {
      // Build questions from non-metadata columns AND import response rows
      const metaIndices = new Set<number>();
      let nameCol = -1;
      let emailCol = -1;
      let dateCol = -1;

      lowerHeaders.forEach((h, i) => {
        if (h === '#' || h === 'no' || h.includes('score') || h.includes('ពិន្ទុ')) {
          metaIndices.add(i);
        } else if (h.includes('timestamp') || h.includes('submitted') || h.includes('កាលបរិច្ឆេទ')) {
          dateCol = i;
          metaIndices.add(i);
        } else if (h.includes('email') || h.includes('អ៊ីមែល')) {
          emailCol = i;
          detectedEmailMode = 'optional';
          metaIndices.add(i);
        } else if (h.includes('respondent') || h.includes('ឈ្មោះអ្នកឆ្លើយ')) {
          nameCol = i;
          metaIndices.add(i);
        }
      });

      const colToQId = new Map<number, string>();
      headers.forEach((h, i) => {
        if (metaIndices.has(i) || !h) return;
        const distinctVals = new Set<string>();
        for (let r = 1; r < firstRows.length; r++) {
          const v = String(firstRows[r]?.[i] || '').trim();
          if (v) distinctVals.add(v);
        }
        const qId = generateQuestionId();
        colToQId.set(i, qId);
        const canBeChoice = distinctVals.size >= 2 && distinctVals.size <= 8 && firstRows.length >= 3;
        questions.push({
          id: qId,
          type: canBeChoice ? 'multiple_choice' : 'short_answer',
          title: h.slice(0, 240),
          required: false,
          options: canBeChoice ? Array.from(distinctVals) : [],
          points: 0,
        });
      });

      for (let r = 1; r < firstRows.length; r++) {
        const row = firstRows[r];
        if (!row || row.every((c) => !String(c || '').trim())) continue;
        const answers: Record<string, string | string[]> = {};
        colToQId.forEach((qId, colIdx) => {
          answers[qId] = String(row[colIdx] || '').trim();
        });
        const rawDate = dateCol >= 0 ? Date.parse(String(row[dateCol] || '')) : NaN;
        responses.push({
          id: generateResponseId(),
          formId,
          respondentName:
            nameCol >= 0 ? String(row[nameCol] || '').trim() || 'Anonymous' : 'Anonymous',
          respondentEmail: emailCol >= 0 ? String(row[emailCol] || '').trim() : '',
          answers,
          score: 0,
          maxScore: 0,
          submittedAtMs: Number.isFinite(rawDate) ? rawDate : Date.now(),
          source: 'local',
        });
      }
    } else {
      parseQuestionsSheet(firstSheetName);
    }
  }

  // If both Questions and Responses sheets exist (Pickerwel round-trip), also load Responses!
  if (questionsSheetName && responsesSheetName && questions.length > 0) {
    const respRows = XLSX.utils.sheet_to_json<Array<string | number>>(
      wb.Sheets[responsesSheetName],
      { header: 1, defval: '' }
    );
    if (respRows.length >= 2) {
      const headers = respRows[0].map((c) => String(c || '').trim());
      const lowerHeaders = headers.map((h) => h.toLowerCase());
      const nameCol = lowerHeaders.findIndex(
        (h) => h.includes('respondent') || h.includes('ឈ្មោះអ្នកឆ្លើយ')
      );
      const emailCol = lowerHeaders.findIndex(
        (h) => h.includes('email') || h.includes('អ៊ីមែល')
      );
      if (emailCol >= 0) detectedEmailMode = 'optional';

      const qByTitle = new Map<string, FormQuestion>();
      for (const q of questions) {
        if (q.type !== 'section') qByTitle.set(q.title.trim().toLowerCase(), q);
      }

      for (let r = 1; r < respRows.length; r++) {
        const row = respRows[r];
        if (!row || row.every((c) => !String(c || '').trim())) continue;
        const answers: Record<string, string | string[]> = {};
        headers.forEach((h, colIdx) => {
          const match = qByTitle.get(h.trim().toLowerCase());
          if (!match) return;
          const cell = String(row[colIdx] || '').trim();
          if (match.type === 'checkboxes') {
            answers[match.id] = cell
              ? cell.split(/\s*,\s*/).filter(Boolean)
              : [];
          } else {
            answers[match.id] = cell;
          }
        });
        responses.push({
          id: generateResponseId(),
          formId,
          respondentName:
            nameCol >= 0 ? String(row[nameCol] || '').trim() || 'Anonymous' : 'Anonymous',
          respondentEmail: emailCol >= 0 ? String(row[emailCol] || '').trim() : '',
          answers,
          score: 0,
          maxScore: 0,
          submittedAtMs: Date.now() - r * 1000,
          source: 'local',
        });
      }
    }
  }

  if (questions.length === 0) return null;

  return {
    title: baseTitle || 'Imported Excel Form',
    questions: questions.slice(0, 50),
    responses: responses.slice(0, 300),
    emailMode: detectedEmailMode,
  };
}

/**
 * Import Form Questions from a Word (.docx) or plain text file.
 * Extracts real paragraphs from word/document.xml using JSZip + DOMParser (100% offline, Khmer Unicode safe).
 */
export async function importFormFromWordFile(
  file: File
): Promise<ImportedOfficeFormResult | null> {
  const baseTitle = file.name.replace(/\.(docx|doc|txt)$/i, '').replace(/[_-]+/g, ' ').trim();
  let lines: string[] = [];

  if (/\.docx$/i.test(file.name)) {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) return null;
    const xmlStr = await docXmlFile.async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
    const paragraphs = Array.from(xmlDoc.getElementsByTagName('w:p'));
    lines = paragraphs
      .map((p) => {
        const runs = Array.from(p.getElementsByTagName('w:t'));
        return runs.map((t) => t.textContent || '').join('').trim();
      })
      .filter(Boolean);
  } else {
    const text = await file.text();
    lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }

  if (lines.length === 0) return null;

  let detectedTitle = baseTitle || 'Imported Word Form';
  const questions: FormQuestion[] = [];
  let current: FormQuestion | null = null;

  const isOptionLine = (line: string) =>
    /^(?:[A-Ha-h][.)]|[\u1780-\u1795][.)]|[○◯☐☑•\-*])\s+/.test(line);

  const isNumberedQuestion = (line: string) =>
    /^(?:Q\d+|Question\s*\d+|សំណួរ(?:ទី)?\s*[\d\u17E0-\u17E9]+|[\d\u17E0-\u17E9]+[.)])\s*/i.test(
      line
    );

  const stripOptionPrefix = (line: string) =>
    line.replace(/^(?:[A-Ha-h][.)]|[\u1780-\u1795][.)]|[○◯☐☑•\-*])\s+/, '').trim();

  const stripQuestionPrefix = (line: string) =>
    line
      .replace(
        /^(?:Q\d+[:.)]?|Question\s*\d+[:.)]?|សំណួរ(?:ទី)?\s*[\d\u17E0-\u17E9]+[:.)]?|[\d\u17E0-\u17E9]+[.)])\s*/i,
        ''
      )
      .trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip answer underline placeholders or footer notes from exported Word docs
    if (/^[_\s-]{6,}$/.test(line) || line.startsWith('Generated by Pickerwel')) continue;
    // Stop before Summary / Responses sections if re-importing an exported Pickerwel Word doc
    if (/^(?:២\.|2\.|៣\.|3\.)\s*(?:សង្ខេប|Summary|ទិន្នន័យចម្លើយ|All Submitted)/i.test(line)) {
      break;
    }
    if (/^(?:១\.|1\.)\s*(?:តារាងសំណួរ|Form Questions)/i.test(line)) continue;
    if (/^Total Responses:|^ចំនួនចម្លើយសរុប:/i.test(line)) continue;

    if (isOptionLine(line) && current) {
      const isCheckbox = /^[☐☑]/.test(line);
      const optText = stripOptionPrefix(line);
      if (/^(?:Other|ផ្សេងៗ)[:៖]?/i.test(optText)) {
        current.hasOther = true;
      } else if (optText) {
        current.options.push(optText.slice(0, 140));
        current.type = isCheckbox ? 'checkboxes' : 'multiple_choice';
      }
      continue;
    }

    if (
      i === 0 &&
      !isNumberedQuestion(line) &&
      !line.endsWith('?') &&
      !line.endsWith('？') &&
      lines.length > 1
    ) {
      detectedTitle = line.slice(0, 140);
      continue;
    }

    const cleanTitle = stripQuestionPrefix(line);
    if (!cleanTitle) continue;

    const isRequired = /\*\s*$/.test(cleanTitle);
    const finalTitle = cleanTitle.replace(/\s*\*\s*$/, '').slice(0, 240);

    current = {
      id: generateQuestionId(),
      type: 'short_answer',
      title: finalTitle,
      required: isRequired,
      options: [],
      points: 0,
    };
    questions.push(current);
  }

  if (questions.length === 0) return null;

  return {
    title: detectedTitle,
    questions: questions.slice(0, 50),
    responses: [],
  };
}
