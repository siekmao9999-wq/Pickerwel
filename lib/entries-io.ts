export const MAX_WHEEL_ENTRIES = 200;
export const MAX_ENTRY_CHARS = 120;

export type EntryImportDelimiter =
  | 'auto'
  | 'newline'
  | 'comma'
  | 'semicolon'
  | 'csv';

export interface ParsedEntriesResult {
  entries: string[];
  totalFound: number;
  truncatedCount: number;
  detectedFormat: 'csv' | 'newline' | 'comma' | 'semicolon' | 'tab';
}

export const KNOWN_HEADER_KEYWORDS = new Set([
  '#',
  'no',
  'no.',
  'index',
  'idx',
  'id',
  'entry',
  'entries',
  'item',
  'items',
  'name',
  'names',
  'student',
  'students',
  'label',
  'title',
  'option',
  'options',
  'ល.រ',
  'លេខរៀង',
  'ឈ្មោះ',
  'ជម្រើស',
  'សិស្ស',
]);

const PREFERRED_VALUE_HEADERS = new Set([
  'entry',
  'entries',
  'item',
  'items',
  'name',
  'names',
  'student',
  'students',
  'label',
  'title',
  'option',
  'options',
  'ឈ្មោះ',
  'ជម្រើស',
  'សិស្ស',
]);

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function cleanCandidate(raw: string, stripListMarker = true): string {
  let value = raw.replace(/\r?\n/g, ' ').trim();
  if (!value) return '';
  if (stripListMarker) {
    // Strip common copied list prefixes like "1. Name", "1) Name", "១. Name", "- Name", "• Name"
    value = value
      .replace(/^(?:\d+|[០-៩]+)[.)]\s+/, '')
      .replace(/^[•\-*▪◦‣]\s+/, '')
      .trim();
  }
  if (!value) return '';
  return value.slice(0, MAX_ENTRY_CHARS);
}

/**
 * RFC-4180 compliant CSV parser supporting UTF-8/Khmer, quoted fields,
 * escaped double quotes (""), and multiline quoted cells.
 */
export function parseCsvRows(rawInput: string): string[][] {
  const input = stripBom(rawInput);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"' && currentField.length === 0) {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

export function extractEntriesFromCsvRows(rows: string[][]): string[] {
  const nonEmptyRows = rows.filter((row) =>
    row.some((cell) => cell.trim().length > 0)
  );
  if (nonEmptyRows.length === 0) return [];

  // Single-row CSV (e.g. "Alice, Bob, Charlie")
  if (nonEmptyRows.length === 1 && nonEmptyRows[0].length > 1) {
    const firstRow = nonEmptyRows[0];
    const looksLikeHeaderOnly = firstRow.every((c) =>
      KNOWN_HEADER_KEYWORDS.has(c.trim().toLowerCase())
    );
    if (looksLikeHeaderOnly) return [];
    return firstRow
      .map((cell) => cleanCandidate(cell, false))
      .filter(Boolean);
  }

  // Detect optional header row and preferred column
  let startRow = 0;
  let valueColIndex = -1;

  const firstRowNormalized = nonEmptyRows[0].map((c) =>
    c.trim().toLowerCase()
  );
  const headerMatches = firstRowNormalized.filter((c) =>
    KNOWN_HEADER_KEYWORDS.has(c)
  ).length;

  if (headerMatches > 0) {
    startRow = 1;
    const preferredIdx = firstRowNormalized.findIndex((c) =>
      PREFERRED_VALUE_HEADERS.has(c)
    );
    if (preferredIdx >= 0) {
      valueColIndex = preferredIdx;
    }
  }

  const results: string[] = [];

  for (let r = startRow; r < nonEmptyRows.length; r++) {
    const row = nonEmptyRows[r];
    if (valueColIndex >= 0 && valueColIndex < row.length) {
      const cleaned = cleanCandidate(row[valueColIndex], false);
      if (cleaned) results.push(cleaned);
      continue;
    }

    const trimmedCells = row.map((c) => c.trim());
    if (trimmedCells.length === 1) {
      const cleaned = cleanCandidate(trimmedCells[0], true);
      if (cleaned) results.push(cleaned);
      continue;
    }

    // Multi-column CSV without explicit preferred header:
    // If col 0 is an index number (1, 2, 3...) and col 1 exists, use col 1.
    const col0 = trimmedCells[0] ?? '';
    const col1 = trimmedCells[1] ?? '';
    const isNumericIndex = /^(?:\d+|[០-៩]+)$/.test(col0);
    if (isNumericIndex && col1.length > 0) {
      const cleaned = cleanCandidate(col1, false);
      if (cleaned) results.push(cleaned);
    } else {
      const firstNonEmpty = trimmedCells.find((c) => c.length > 0) ?? '';
      const cleaned = cleanCandidate(firstNonEmpty, true);
      if (cleaned) results.push(cleaned);
    }
  }

  return results;
}

function finalizeResult(
  candidates: string[],
  detectedFormat: ParsedEntriesResult['detectedFormat']
): ParsedEntriesResult {
  const valid = candidates.filter((item) => item.length > 0);
  const capped = valid.slice(0, MAX_WHEEL_ENTRIES);
  return {
    entries: capped,
    totalFound: valid.length,
    truncatedCount: Math.max(0, valid.length - capped.length),
    detectedFormat,
  };
}

/**
 * Parses user-provided entries from CSV or plain list formats
 * (newline, tab, comma, semicolon, numbered/bulleted lines).
 */
export function parseUserEntriesInput(
  rawInput: string,
  mode: EntryImportDelimiter = 'auto'
): ParsedEntriesResult {
  const input = stripBom(rawInput).trim();
  if (!input) {
    return {
      entries: [],
      totalFound: 0,
      truncatedCount: 0,
      detectedFormat: 'newline',
    };
  }

  if (mode === 'csv') {
    const rows = parseCsvRows(input);
    return finalizeResult(extractEntriesFromCsvRows(rows), 'csv');
  }

  if (mode === 'newline') {
    const items = input
      .split(/\r?\n|\t/)
      .map((line) => cleanCandidate(line, true))
      .filter(Boolean);
    return finalizeResult(items, 'newline');
  }

  if (mode === 'semicolon') {
    const items = input
      .split(/;|\r?\n/)
      .map((part) => cleanCandidate(part, true))
      .filter(Boolean);
    return finalizeResult(items, 'semicolon');
  }

  if (mode === 'comma') {
    const rows = parseCsvRows(input);
    const flattened: string[] = [];
    for (const row of rows) {
      for (const cell of row) {
        const cleaned = cleanCandidate(cell, true);
        if (cleaned) flattened.push(cleaned);
      }
    }
    return finalizeResult(flattened, 'comma');
  }

  // Auto-detection mode
  const hasNewline = /\r?\n/.test(input);
  const hasTab = /\t/.test(input);

  if (hasNewline) {
    const csvRows = parseCsvRows(input).filter((r) =>
      r.some((c) => c.trim().length > 0)
    );
    const firstRowHeaders =
      csvRows[0]?.some((c) =>
        KNOWN_HEADER_KEYWORDS.has(c.trim().toLowerCase())
      ) ?? false;
    const looksLikeMultiColCsv =
      csvRows.length >= 2 &&
      csvRows.every((r) => r.length >= 2) &&
      (firstRowHeaders ||
        csvRows.every((r) => /^(?:\d+|[០-៩]+)$/.test(r[0].trim())) ||
        /"/.test(input));

    if (looksLikeMultiColCsv) {
      return finalizeResult(extractEntriesFromCsvRows(csvRows), 'csv');
    }

    const lines = input
      .split(/\r?\n|\t/)
      .map((line) => cleanCandidate(line, true))
      .filter(Boolean);
    return finalizeResult(lines, hasTab ? 'tab' : 'newline');
  }

  // Single-line input
  if (hasTab) {
    const items = input
      .split(/\t/)
      .map((part) => cleanCandidate(part, true))
      .filter(Boolean);
    return finalizeResult(items, 'tab');
  }

  if (input.includes(';')) {
    const items = input
      .split(/;/)
      .map((part) => cleanCandidate(part, true))
      .filter(Boolean);
    return finalizeResult(items, 'semicolon');
  }

  if (input.includes(',')) {
    const rows = parseCsvRows(input);
    const items = (rows[0] ?? [])
      .map((part) => cleanCandidate(part, true))
      .filter(Boolean);
    return finalizeResult(items, 'comma');
  }

  const single = cleanCandidate(input, true);
  return finalizeResult(single ? [single] : [], 'newline');
}

export function escapeCsvField(value: string): string {
  const needsQuotes = /[",\r\n]/.test(value) || value !== value.trim();
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function buildEntriesCsvContent(entries: string[]): string {
  const lines = ['Index,Entry'];
  entries.forEach((entry, idx) => {
    lines.push(`${idx + 1},${escapeCsvField(entry)}`);
  });
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

function sanitizeCsvFilename(raw?: string): string {
  const cleaned = (raw ?? '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return cleaned || 'pickerwel-entries';
}

export function exportEntriesToCsv(
  entries: string[],
  wheelTitle?: string
): void {
  if (typeof document === 'undefined' || entries.length === 0) return;

  const csvContent = buildEntriesCsvContent(entries);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeCsvFilename(wheelTitle)}-entries.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
