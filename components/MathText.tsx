'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  text: string;
  className?: string;
}

type Segment =
  | { type: 'text'; value: string }
  | { type: 'math'; latex: string; display: boolean };

const CHEM_MAP: Record<string, string> = {
  H2O: '\\mathrm{H_2O}',
  CO2: '\\mathrm{CO_2}',
  O2: '\\mathrm{O_2}',
  N2: '\\mathrm{N_2}',
  H2: '\\mathrm{H_2}',
  CH4: '\\mathrm{CH_4}',
  NaCl: '\\mathrm{NaCl}',
};

const EXPLICIT_MATH_RE =
  /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g;

const INLINE_AUTO_MATH_RE =
  /(\b(?:H2O|CO2|O2|N2|H2|CH4|NaCl)\b|√\([^)]+\)|√[0-9a-zA-Z]+|(?<![A-Za-z])(?:\d+(?:\.\d+)?|\d*[a-zA-Z](?:\^[0-9a-zA-Z]+)?)(?:\s*[+\-×÷=<>≤≥≠]\s*(?:\d+(?:\.\d+)?|\d*[a-zA-Z](?:\^[0-9a-zA-Z]+)?))+(?![A-Za-z])|\b\d+(?:\.\d+)?[°%]|\b[a-zA-Z]\^(?:\{[^}]+\}|[0-9a-zA-Z+-]+)|(?<=^|[\s\u1780-\u17FF(])[xyzabcnmtk](?=[\s\u1780-\u17FF)?.,!]|$))/g;

function normalizeToLatex(raw: string): string {
  if (CHEM_MAP[raw]) return CHEM_MAP[raw];

  let out = raw;
  // √(expr) or √144 -> \sqrt{expr}
  out = out.replace(/√\(([^)]+)\)/g, '\\sqrt{$1}');
  out = out.replace(/√([0-9a-zA-Z]+)/g, '\\sqrt{$1}');
  // Degree and percent symbols
  out = out.replace(/°/g, '^\\circ');
  out = out.replace(/%/g, '\\%');
  // Unicode arithmetic operators
  out = out.replace(/×/g, ' \\times ');
  out = out.replace(/÷/g, ' \\div ');
  out = out.replace(/≤/g, ' \\le ');
  out = out.replace(/≥/g, ' \\ge ');
  out = out.replace(/≠/g, ' \\neq ');
  return out;
}

function splitPlainSegment(plain: string): Segment[] {
  const parts: Segment[] = [];
  let lastIndex = 0;
  INLINE_AUTO_MATH_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = INLINE_AUTO_MATH_RE.exec(plain)) !== null) {
    const start = match.index;
    const token = match[0];

    if (start > lastIndex) {
      parts.push({ type: 'text', value: plain.slice(lastIndex, start) });
    }
    parts.push({
      type: 'math',
      latex: normalizeToLatex(token),
      display: false,
    });
    lastIndex = start + token.length;
  }

  if (lastIndex < plain.length) {
    parts.push({ type: 'text', value: plain.slice(lastIndex) });
  }
  return parts;
}

function parseMathSegments(input: string): Segment[] {
  if (!input) return [];
  const segments: Segment[] = [];
  let lastIndex = 0;
  EXPLICIT_MATH_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = EXPLICIT_MATH_RE.exec(input)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      segments.push(...splitPlainSegment(input.slice(lastIndex, start)));
    }

    const displayLatex = match[1] ?? match[3];
    const inlineLatex = match[2] ?? match[4];
    segments.push({
      type: 'math',
      latex: (displayLatex ?? inlineLatex ?? '').trim(),
      display: Boolean(displayLatex),
    });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < input.length) {
    segments.push(...splitPlainSegment(input.slice(lastIndex)));
  }

  return segments;
}

export function MathText({ text, className = '' }: MathTextProps) {
  const renderedParts = useMemo(() => {
    const segments = parseMathSegments(text);
    return segments.map((seg, idx) => {
      if (seg.type === 'text') {
        return { key: idx, isMath: false as const, text: seg.value, display: false };
      }
      let html = seg.latex;
      try {
        html = katex.renderToString(seg.latex, {
          displayMode: seg.display,
          throwOnError: false,
          strict: false,
          output: 'htmlAndMathml',
        });
      } catch {
        html = seg.latex;
      }
      return { key: idx, isMath: true as const, html, display: seg.display };
    });
  }, [text]);

  return (
    <span className={`math-text leading-relaxed ${className}`}>
      {renderedParts.map((part) =>
        part.isMath ? (
          <span
            key={part.key}
            className={
              part.display
                ? 'block my-1.5 text-center overflow-x-auto'
                : 'inline-block align-baseline mx-[0.12em]'
            }
            dangerouslySetInnerHTML={{ __html: part.html }}
          />
        ) : (
          <React.Fragment key={part.key}>{part.text}</React.Fragment>
        )
      )}
    </span>
  );
}
