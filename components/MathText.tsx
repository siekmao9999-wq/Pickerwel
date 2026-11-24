'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import 'katex/contrib/mhchem';

interface MathTextProps {
  text: string;
  className?: string;
  explicitOnly?: boolean;
}

type Segment =
  | { type: 'text'; value: string }
  | { type: 'math'; latex: string; display: boolean };

const CHEM_MAP: Record<string, string> = {
  H2O: '\\ce{H2O}',
  CO2: '\\ce{CO2}',
  O2: '\\ce{O2}',
  N2: '\\ce{N2}',
  H2: '\\ce{H2}',
  CH4: '\\ce{CH4}',
  NaCl: '\\ce{NaCl}',
};

const EXPLICIT_MATH_RE =
  /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(\\ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})|(\\pu\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g;

const INLINE_AUTO_MATH_RE =
  /(\b(?:H2O|CO2|O2|N2|H2|CH4|NaCl)\b|√\([^)]+\)|√[0-9a-zA-Z]+|(?<![A-Za-z])(?:\d+(?:\.\d+)?|\d*[a-zA-Z](?:\^[0-9a-zA-Z]+)?)(?:\s*[+\-×÷=<>≤≥≠]\s*(?:\d+(?:\.\d+)?|\d*[a-zA-Z](?:\^[0-9a-zA-Z]+)?))+(?![A-Za-z])|\b\d+(?:\.\d+)?[°%]|\b[a-zA-Z]\^(?:\{[^}]+\}|[0-9a-zA-Z+-]+)|(?<=^|[\s\u1780-\u17FF(])[xyzabcnmtk](?=[\s\u1780-\u17FF)?.,!]|$))/g;

function normalizeToLatex(raw: string): string {
  if (CHEM_MAP[raw]) return CHEM_MAP[raw];

  let out = raw;
  out = out.replace(/√\(([^)]+)\)/g, '\\sqrt{$1}');
  out = out.replace(/√([0-9a-zA-Z]+)/g, '\\sqrt{$1}');
  out = out.replace(/°/g, '^\\circ');
  out = out.replace(/%/g, '\\%');
  out = out.replace(/×/g, ' \\times ');
  out = out.replace(/÷/g, ' \\div ');
  out = out.replace(/≤/g, ' \\le ');
  out = out.replace(/≥/g, ' \\ge ');
  out = out.replace(/≠/g, ' \\neq ');
  return out;
}

function splitPlainSegment(plain: string, explicitOnly: boolean): Segment[] {
  if (explicitOnly) {
    return plain ? [{ type: 'text', value: plain }] : [];
  }
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

function parseMathSegments(input: string, explicitOnly: boolean): Segment[] {
  if (!input) return [];
  const segments: Segment[] = [];
  let lastIndex = 0;
  EXPLICIT_MATH_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = EXPLICIT_MATH_RE.exec(input)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      segments.push(...splitPlainSegment(input.slice(lastIndex, start), explicitOnly));
    }

    const displayLatex = match[1] ?? match[3];
    const inlineLatex = match[2] ?? match[4] ?? match[5] ?? match[6];
    segments.push({
      type: 'math',
      latex: (displayLatex ?? inlineLatex ?? '').trim(),
      display: Boolean(displayLatex),
    });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < input.length) {
    segments.push(...splitPlainSegment(input.slice(lastIndex), explicitOnly));
  }

  return segments;
}

export function hasExplicitMathSyntax(text: string): boolean {
  if (!text) return false;
  EXPLICIT_MATH_RE.lastIndex = 0;
  return EXPLICIT_MATH_RE.test(text);
}

export function MathText({ text, className = '', explicitOnly = false }: MathTextProps) {
  const renderedParts = useMemo(() => {
    const segments = parseMathSegments(text, explicitOnly);
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
  }, [explicitOnly, text]);

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
