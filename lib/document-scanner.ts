import {
  KNOWN_HEADER_KEYWORDS,
  MAX_ENTRY_CHARS,
  MAX_WHEEL_ENTRIES,
  cleanCandidate,
  extractEntriesFromCsvRows,
  parseUserEntriesInput,
} from './entries-io';
import { decodeCodeFromCanvas, parseScannedPayload } from './qr-names';

export type SupportedDocumentKind = 'pdf' | 'excel' | 'word' | 'text';

export interface DocumentScanResult {
  entries: string[];
  kind: SupportedDocumentKind;
  detail?: string;
}

function isIgnorableStandaloneToken(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (KNOWN_HEADER_KEYWORDS.has(trimmed.toLowerCase())) return true;
  // Standalone page numbers or row index numbers like "1", "12", "Page 1"
  if (/^(?:\d+|[០-៩]+)$/.test(trimmed)) return true;
  if (/^page\s*\d+(?:\s*of\s*\d+)?$/i.test(trimmed)) return true;
  return false;
}

function extractLinesToEntries(lines: string[]): string[] {
  const cleanedLines = lines.map((l) => l.trim()).filter(Boolean);
  if (cleanedLines.length === 0) return [];

  // Check if lines are predominantly tab-delimited table rows
  const tabRows = cleanedLines.map((l) => l.split(/\t+/).map((c) => c.trim()));
  const multiColCount = tabRows.filter((r) => r.length >= 2).length;
  if (multiColCount >= Math.max(2, Math.floor(cleanedLines.length * 0.45))) {
    const extracted = extractEntriesFromCsvRows(tabRows).filter(
      (item) => !isIgnorableStandaloneToken(item)
    );
    if (extracted.length > 0) return extracted;
  }

  const out: string[] = [];
  for (const line of cleanedLines) {
    // Handle inline "1  Sokha" or "១  សុខា" (index + spaces + name)
    const indexedSpaceMatch = line.match(/^(?:\d+|[០-៩]+)\s{2,}(.+)$/);
    const candidateRaw = indexedSpaceMatch ? indexedSpaceMatch[1] : line;
    const cleaned = cleanCandidate(candidateRaw, true);
    if (!cleaned || isIgnorableStandaloneToken(cleaned)) continue;
    out.push(cleaned);
  }
  return out;
}

export async function scanExcelDocument(
  file: File
): Promise<DocumentScanResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    const stringRows = rawRows
      .map((row) =>
        (Array.isArray(row) ? row : []).map((cell) =>
          String(cell ?? '')
            .replace(/\r?\n/g, ' ')
            .trim()
        )
      )
      .filter((row) => row.some((cell) => cell.length > 0));

    if (stringRows.length === 0) continue;

    const extracted = extractEntriesFromCsvRows(stringRows)
      .filter((item) => !isIgnorableStandaloneToken(item))
      .slice(0, MAX_WHEEL_ENTRIES);

    if (extracted.length > 0) {
      return {
        entries: extracted,
        kind: 'excel',
        detail: sheetName,
      };
    }
  }

  return { entries: [], kind: 'excel' };
}

function getParagraphText(pEl: Element): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const localName = el.localName || el.nodeName.split(':').pop() || '';
    if (localName === 't') {
      parts.push(el.textContent ?? '');
      return;
    }
    if (localName === 'tab') {
      parts.push('\t');
      return;
    }
    if (localName === 'br' || localName === 'cr') {
      parts.push('\n');
      return;
    }
    for (let i = 0; i < el.childNodes.length; i++) {
      walk(el.childNodes[i]);
    }
  };
  walk(pEl);
  return parts.join('').trim();
}

export async function scanWordDocxDocument(
  file: File
): Promise<DocumentScanResult> {
  const JSZip = (await import('jszip')).default;
  const buffer = await file.arrayBuffer();

  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('INVALID_DOCX');
  }

  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('INVALID_DOCX');
  }

  const xmlText = await docXmlFile.async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const body =
    xmlDoc.getElementsByTagNameNS('*', 'body')[0] ||
    xmlDoc.getElementsByTagName('w:body')[0];

  if (!body) {
    return { entries: [], kind: 'word' };
  }

  const collected: string[] = [];

  for (let i = 0; i < body.childNodes.length; i++) {
    const child = body.childNodes[i];
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    const localName = el.localName || el.nodeName.split(':').pop() || '';

    if (localName === 'tbl') {
      const trNodes = Array.from(el.getElementsByTagNameNS('*', 'tr'));
      const rows: string[][] = [];
      for (const tr of trNodes) {
        // Direct cell children of this row
        const cells: string[] = [];
        for (let c = 0; c < tr.childNodes.length; c++) {
          const cellNode = tr.childNodes[c];
          if (cellNode.nodeType !== 1) continue;
          const cellEl = cellNode as Element;
          const cellName =
            cellEl.localName || cellEl.nodeName.split(':').pop() || '';
          if (cellName !== 'tc') continue;

          const pNodes = Array.from(cellEl.getElementsByTagNameNS('*', 'p'));
          const cellText = pNodes
            .map((p) => getParagraphText(p))
            .filter(Boolean)
            .join(' ')
            .trim();
          cells.push(cellText);
        }
        if (cells.some((c) => c.length > 0)) {
          rows.push(cells);
        }
      }
      const fromTable = extractEntriesFromCsvRows(rows).filter(
        (item) => !isIgnorableStandaloneToken(item)
      );
      collected.push(...fromTable);
    } else if (localName === 'p') {
      const text = getParagraphText(el);
      if (text) {
        const lines = text.split(/\r?\n/);
        collected.push(...extractLinesToEntries(lines));
      }
    }
  }

  return {
    entries: collected
      .map((s) => s.slice(0, MAX_ENTRY_CHARS))
      .filter(Boolean)
      .slice(0, MAX_WHEEL_ENTRIES),
    kind: 'word',
  };
}

interface PdfTextItem {
  str: string;
  transform: number[];
  width?: number;
}

export async function scanPdfDocument(
  file: File
): Promise<DocumentScanResult> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
  });
  const pdf = await loadingTask.promise;

  const maxPages = Math.min(pdf.numPages, 25);
  const collected: string[] = [];

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group text items into visual lines by vertical Y coordinate
    const lineBuckets = new Map<number, { x: number; w: number; str: string }[]>();

    for (const rawItem of textContent.items) {
      const item = rawItem as Partial<PdfTextItem>;
      if (!item.str || !Array.isArray(item.transform)) continue;
      const text = item.str;
      if (!text.trim()) continue;

      const x = Number(item.transform[4] ?? 0);
      const y = Number(item.transform[5] ?? 0);
      const bucketY = Math.round(y / 4) * 4;
      const list = lineBuckets.get(bucketY) ?? [];
      list.push({ x, w: Number(item.width ?? 0), str: text });
      lineBuckets.set(bucketY, list);
    }

    const sortedYs = Array.from(lineBuckets.keys()).sort((a, b) => b - a);
    const pageLines: string[] = [];

    for (const yKey of sortedYs) {
      const items = (lineBuckets.get(yKey) ?? []).sort((a, b) => a.x - b.x);
      let lineStr = '';
      let prevEndX = -Infinity;

      for (const seg of items) {
        if (!lineStr) {
          lineStr = seg.str;
        } else {
          const gap = seg.x - prevEndX;
          if (gap > 16) {
            lineStr += `\t${seg.str}`;
          } else if (gap > 2 && !lineStr.endsWith(' ') && !seg.str.startsWith(' ')) {
            lineStr += ` ${seg.str}`;
          } else {
            lineStr += seg.str;
          }
        }
        prevEndX = seg.x + Math.max(seg.w, 0);
      }
      if (lineStr.trim()) pageLines.push(lineStr.trim());
    }

    const pageEntries = extractLinesToEntries(pageLines);

    // If page had minimal text (likely a scanned QR sheet PDF), render & scan QR
    if (pageEntries.length < 2 && typeof document !== 'undefined') {
      try {
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          const qrText = await decodeCodeFromCanvas(canvas, true);
          if (qrText) {
            const qrEntries = parseScannedPayload(qrText);
            if (qrEntries.length > 0) {
              collected.push(...qrEntries);
              continue;
            }
          }
        }
      } catch {
        // Ignore render scan fallback error for individual pages
      }
    }

    collected.push(...pageEntries);
    if (collected.length >= MAX_WHEEL_ENTRIES) break;
  }

  return {
    entries: collected
      .map((s) => s.slice(0, MAX_ENTRY_CHARS))
      .filter(Boolean)
      .slice(0, MAX_WHEEL_ENTRIES),
    kind: 'pdf',
    detail: `${pdf.numPages}`,
  };
}

export async function scanDocumentFile(
  file: File
): Promise<DocumentScanResult> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    return scanPdfDocument(file);
  }

  if (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.ods')
  ) {
    return scanExcelDocument(file);
  }

  if (
    lower.endsWith('.docx') ||
    file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return scanWordDocxDocument(file);
  }

  if (lower.endsWith('.doc')) {
    throw new Error('LEGACY_DOC_UNSUPPORTED');
  }

  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    const text = await file.text();
    const parsed = parseUserEntriesInput(
      text,
      lower.endsWith('.csv') ? 'csv' : 'auto'
    );
    return { entries: parsed.entries, kind: 'text' };
  }

  throw new Error('UNSUPPORTED_DOCUMENT_TYPE');
}
