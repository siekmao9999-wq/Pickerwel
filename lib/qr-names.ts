import jsQR from 'jsqr';
import QRCode from 'qrcode';
import {
  MAX_ENTRY_CHARS,
  MAX_WHEEL_ENTRIES,
  parseUserEntriesInput,
} from './entries-io';

export const MAX_QR_UTF8_BYTES = 1200;

interface NativeDetectedBarcode {
  rawValue?: string;
}

interface NativeBarcodeDetector {
  detect(source: ImageBitmapSource): Promise<NativeDetectedBarcode[]>;
}

interface WindowWithBarcodeDetector extends Window {
  BarcodeDetector?: {
    new (options?: { formats?: string[] }): NativeBarcodeDetector;
  };
}

let cachedDetector: NativeBarcodeDetector | null | undefined;

function getNativeBarcodeDetector(): NativeBarcodeDetector | null {
  if (typeof window === 'undefined') return null;
  if (cachedDetector !== undefined) return cachedDetector;

  const DetectorCtor = (window as unknown as WindowWithBarcodeDetector)
    .BarcodeDetector;
  if (!DetectorCtor) {
    cachedDetector = null;
    return null;
  }

  try {
    cachedDetector = new DetectorCtor({
      formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix'],
    });
  } catch {
    try {
      cachedDetector = new DetectorCtor();
    } catch {
      cachedDetector = null;
    }
  }
  return cachedDetector;
}

function decodeJsQrUtf8(
  imageData: ImageData,
  inversionAttempts: 'dontInvert' | 'attemptBoth' = 'dontInvert'
): string | null {
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts,
  });
  if (!code) return null;

  if (code.binaryData && code.binaryData.length > 0) {
    try {
      const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(
        new Uint8Array(code.binaryData)
      );
      if (utf8Text.trim()) return utf8Text;
    } catch {
      // Fallback to code.data below
    }
  }
  return code.data || null;
}

/**
 * Decodes a QR code or barcode from a canvas element 100% offline.
 * Uses native BarcodeDetector when available and falls back to pure-JS jsQR.
 */
export async function decodeCodeFromCanvas(
  canvas: HTMLCanvasElement,
  allowInverted = false
): Promise<string | null> {
  const detector = getNativeBarcodeDetector();
  if (detector) {
    try {
      const results = await detector.detect(canvas);
      const firstRaw = results.find((item) => item.rawValue?.trim())?.rawValue;
      if (firstRaw) return firstRaw;
    } catch {
      // Continue to jsQR fallback
    }
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width === 0 || canvas.height === 0) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return decodeJsQrUtf8(
    imageData,
    allowInverted ? 'attemptBoth' : 'dontInvert'
  );
}

/**
 * Parses scanned QR / barcode text into clean wheel entry names:
 * - Supports Pickerwel JSON payloads ({ entries: [...] } or { name: "..." })
 * - Supports student badge URLs (?name=... or ?student=...)
 * - Supports single names, newline/comma/semicolon lists, and CSV exports
 */
export function parseScannedPayload(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // 1. JSON payload support (array or { name / student / entries })
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => String(v).trim().slice(0, MAX_ENTRY_CHARS))
          .filter(Boolean)
          .slice(0, MAX_WHEEL_ENTRIES);
      }
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.entries)) {
          return obj.entries
            .map((v) => String(v).trim().slice(0, MAX_ENTRY_CHARS))
            .filter(Boolean)
            .slice(0, MAX_WHEEL_ENTRIES);
        }
        const singleCandidate =
          obj.name ?? obj.student ?? obj.entry ?? obj.label ?? obj.fullName;
        if (typeof singleCandidate === 'string' && singleCandidate.trim()) {
          return [singleCandidate.trim().slice(0, MAX_ENTRY_CHARS)];
        }
      }
    } catch {
      // Not valid JSON; continue with URL/text parsing
    }
  }

  // 2. Badge URL with ?name= or ?student= query parameter
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const paramName =
        url.searchParams.get('name') ||
        url.searchParams.get('student') ||
        url.searchParams.get('entry') ||
        url.searchParams.get('entries');
      if (paramName && paramName.trim()) {
        return parseUserEntriesInput(paramName, 'auto').entries;
      }
    } catch {
      // Continue with plain text parsing
    }
  }

  // 3. Plain single name, multi-line list, comma/semicolon list, or CSV
  return parseUserEntriesInput(trimmed, 'auto').entries;
}

export function getUtf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export async function renderQrToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  size = 240
): Promise<void> {
  const bytes = new TextEncoder().encode(text);
  await QRCode.toCanvas(
    canvas,
    [{ data: bytes, mode: 'byte' }],
    {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    }
  );
}

export async function downloadQrPng(
  text: string,
  filenameBase = 'pickerwel-names-qr'
): Promise<void> {
  if (typeof document === 'undefined' || !text.trim()) return;
  const bytes = new TextEncoder().encode(text);
  const dataUrl = await QRCode.toDataURL([{ data: bytes, mode: 'byte' }], {
    width: 640,
    margin: 3,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
  });

  const safeName =
    filenameBase
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'pickerwel-names-qr';

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${safeName}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
