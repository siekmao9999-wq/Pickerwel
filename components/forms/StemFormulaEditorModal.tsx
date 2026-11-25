'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import 'katex/contrib/mhchem';
import type { MathfieldElement } from 'mathlive';
import {
  X,
  Sigma,
  Atom,
  FlaskConical,
  Sparkles,
  Check,
  RotateCcw,
  Delete,
  Search,
  Undo2,
  Redo2,
  ArrowLeft,
  ArrowRight,
  Keyboard,
  Code2,
  Grid2x2,
  Compass,
} from 'lucide-react';
import type { Language } from '@/lib/i18n';

export type FormulaCategoryId =
  | 'mathtype'
  | 'math'
  | 'physics'
  | 'chemistry'
  | 'symbols';

interface MathTypeTile {
  previewLatex: string;
  insertLatex: string;
  /** When true, inserts directly onto previous symbol if canvas is non-empty, or prepends a box `#?` if empty */
  attachToPrev?: boolean;
  hintKm: string;
  hintEn: string;
  wide?: boolean;
}

interface MathTypeGroup {
  titleKm: string;
  titleEn: string;
  items: MathTypeTile[];
}

const MATHTYPE_CORE_GROUPS: MathTypeGroup[] = [
  {
    titleKm: 'ប្រអប់រូបមន្ត MathType (ចុចរួចវាយលេខផ្ទាល់ក្នុងប្រអប់ □)',
    titleEn: 'MathType Structural Templates (Click & Type Directly in □)',
    items: [
      { previewLatex: '\\frac{\\square}{\\square}', insertLatex: '\\frac{#?}{#?}', hintKm: 'ប្រភាគ', hintEn: 'Fraction' },
      { previewLatex: '\\square^{\\square}', insertLatex: '^{#?}', attachToPrev: true, hintKm: 'ស្វ័យគុណ', hintEn: 'Power' },
      { previewLatex: '\\square_{\\square}', insertLatex: '_{#?}', attachToPrev: true, hintKm: 'សន្ទស្សន៍', hintEn: 'Subscript' },
      { previewLatex: '\\square_{\\square}^{\\square}', insertLatex: '_{#?}^{#?}', attachToPrev: true, hintKm: 'លើ & ក្រោម', hintEn: 'Sub + Sup' },
      { previewLatex: '\\sqrt{\\square}', insertLatex: '\\sqrt{#?}', hintKm: 'ឫសការេ', hintEn: 'Square root' },
      { previewLatex: '\\sqrt[\\square]{\\square}', insertLatex: '\\sqrt[#?]{#?}', hintKm: 'ឫសទី n', hintEn: 'N-th root' },
      { previewLatex: '\\left(\\square\\right)', insertLatex: '\\left(#?\\right)', hintKm: 'វង់ក្រចក', hintEn: 'Parentheses' },
      { previewLatex: '\\left[\\square\\right]', insertLatex: '\\left[#?\\right]', hintKm: 'គ្នៀប', hintEn: 'Brackets' },
      { previewLatex: '\\left|\\square\\right|', insertLatex: '\\left|#?\\right|', hintKm: 'តម្លៃដាច់ខាត', hintEn: 'Absolute' },
      { previewLatex: '\\vec{\\square}', insertLatex: '\\vec{#?}', hintKm: 'វ៉ិចទ័រ', hintEn: 'Vector' },
      { previewLatex: '\\overline{\\square}', insertLatex: '\\overline{#?}', hintKm: 'បារលើ', hintEn: 'Overbar' },
      { previewLatex: '\\square^{\\circ}', insertLatex: '^{\\circ}', attachToPrev: true, hintKm: 'ដឺក្រេ °', hintEn: 'Degree °' },
    ],
  },
  {
    titleKm: 'លីមីត ដេរីវេ អាំងតេក្រាល & ផលបូក',
    titleEn: 'Limits, Calculus & Series',
    items: [
      { previewLatex: '\\lim_{\\square \\to \\square}\\square', insertLatex: '\\lim_{#? \\to #?}{#?}', hintKm: 'លីមីត', hintEn: 'Limit', wide: true },
      { previewLatex: '\\int_{\\square}^{\\square}\\square\\,dx', insertLatex: '\\int_{#?}^{#?}{#?}\\,dx', hintKm: 'អាំងតេក្រាលកំណត់', hintEn: 'Definite Integral', wide: true },
      { previewLatex: '\\int \\square\\,dx', insertLatex: '\\int {#?}\\,dx', hintKm: 'អាំងតេក្រាល', hintEn: 'Integral' },
      { previewLatex: '\\frac{d}{dx}\\square', insertLatex: '\\frac{d}{dx}\\left(#?\\right)', hintKm: 'ដេរីវេ d/dx', hintEn: 'Derivative' },
      { previewLatex: '\\frac{\\partial \\square}{\\partial \\square}', insertLatex: '\\frac{\\partial #?}{\\partial #?}', hintKm: 'ដេរីវេដោយផ្នែក', hintEn: 'Partial' },
      { previewLatex: '\\sum_{\\square}^{\\square}\\square', insertLatex: '\\sum_{#?=#?}^{#?}{#?}', hintKm: 'ផលបូក ∑', hintEn: 'Summation' },
      { previewLatex: '\\prod_{\\square}^{\\square}\\square', insertLatex: '\\prod_{#?=#?}^{#?}{#?}', hintKm: 'ផលគុណ ∏', hintEn: 'Product' },
      { previewLatex: '\\binom{\\square}{\\square}', insertLatex: '\\binom{#?}{#?}', hintKm: 'បន្សំ C(n,k)', hintEn: 'Binomial' },
    ],
  },
  {
    titleKm: 'ប្រព័ន្ធសមីការ (២ ប្រព័ន្ធ · ៣ ប្រព័ន្ធ · ៤ ប្រព័ន្ធ & អនុគមន៍ចែកផ្នែក)',
    titleEn: 'Systems of Equations (2, 3, 4 Equations & Piecewise)',
    items: [
      {
        previewLatex: '\\scriptstyle\\begin{cases}\\square\\\\ \\square\\end{cases}',
        insertLatex: '\\begin{cases} #? \\\\ #? \\end{cases}',
        hintKm: 'ប្រព័ន្ធ ២ សមីការ',
        hintEn: '2-Eq System',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{cases}\\square\\\\ \\square\\\\ \\square\\end{cases}',
        insertLatex: '\\begin{cases} #? \\\\ #? \\\\ #? \\end{cases}',
        hintKm: 'ប្រព័ន្ធ ៣ សមីការ',
        hintEn: '3-Eq System',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{cases}\\square\\\\ \\square\\\\ \\square\\\\ \\square\\end{cases}',
        insertLatex: '\\begin{cases} #? \\\\ #? \\\\ #? \\\\ #? \\end{cases}',
        hintKm: 'ប្រព័ន្ធ ៤ សមីការ',
        hintEn: '4-Eq System',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{cases}\\square, & \\square\\\\ \\square, & \\square\\end{cases}',
        insertLatex: '\\begin{cases} #?, & #? \\\\ #?, & #? \\end{cases}',
        hintKm: 'អនុគមន៍ចែកផ្នែក ២',
        hintEn: '2-Branch Piecewise',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{cases}\\square, & \\square\\\\ \\square, & \\square\\\\ \\square, & \\square\\end{cases}',
        insertLatex: '\\begin{cases} #?, & #? \\\\ #?, & #? \\\\ #?, & #? \\end{cases}',
        hintKm: 'អនុគមន៍ចែកផ្នែក ៣',
        hintEn: '3-Branch Piecewise',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\left[\\begin{array}{l}\\square\\\\ \\square\\end{array}\\right.',
        insertLatex: '\\left[\\begin{array}{l} #? \\\\ #? \\end{array}\\right.',
        hintKm: 'ប្រព័ន្ធគ្នៀប [ ២',
        hintEn: '2-Eq Bracket [',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\left[\\begin{array}{l}\\square\\\\ \\square\\\\ \\square\\end{array}\\right.',
        insertLatex: '\\left[\\begin{array}{l} #? \\\\ #? \\\\ #? \\end{array}\\right.',
        hintKm: 'ប្រព័ន្ធគ្នៀប [ ៣',
        hintEn: '3-Eq Bracket [',
        wide: true,
      },
    ],
  },
  {
    titleKm: 'ម៉ាទ្រីស & ដេទែមីណង់ — ច្រើនលំដាប់ និងច្រើនខ្វែង (Matrices & Determinants)',
    titleEn: 'Matrices & Determinants — Multi-Order & Bracket Styles',
    items: [
      // Parentheses matrices (...)
      {
        previewLatex: '\\scriptstyle\\begin{pmatrix}\\square & \\square\\\\ \\square & \\square\\end{pmatrix}',
        insertLatex: '\\begin{pmatrix} #? & #? \\\\ #? & #? \\end{pmatrix}',
        hintKm: 'ម៉ាទ្រីស ( ) 2×2',
        hintEn: '2×2 ( ) Matrix',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{pmatrix}\\square & \\square & \\square\\\\ \\square & \\square & \\square\\\\ \\square & \\square & \\square\\end{pmatrix}',
        insertLatex: '\\begin{pmatrix} #? & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #? \\end{pmatrix}',
        hintKm: 'ម៉ាទ្រីស ( ) 3×3',
        hintEn: '3×3 ( ) Matrix',
        wide: true,
      },
      {
        previewLatex: '\\scriptscriptstyle\\begin{pmatrix}\\square & \\square & \\square & \\square\\\\ \\square & \\square & \\square & \\square\\\\ \\square & \\square & \\square & \\square\\\\ \\square & \\square & \\square & \\square\\end{pmatrix}',
        insertLatex: '\\begin{pmatrix} #? & #? & #? & #? \\\\ #? & #? & #? & #? \\\\ #? & #? & #? & #? \\\\ #? & #? & #? & #? \\end{pmatrix}',
        hintKm: 'ម៉ាទ្រីស ( ) 4×4',
        hintEn: '4×4 ( ) Matrix',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{pmatrix}\\square & \\square & \\square\\\\ \\square & \\square & \\square\\end{pmatrix}',
        insertLatex: '\\begin{pmatrix} #? & #? & #? \\\\ #? & #? & #? \\end{pmatrix}',
        hintKm: 'ម៉ាទ្រីស ( ) 2×3',
        hintEn: '2×3 ( ) Matrix',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{pmatrix}\\square & \\square\\\\ \\square & \\square\\\\ \\square & \\square\\end{pmatrix}',
        insertLatex: '\\begin{pmatrix} #? & #? \\\\ #? & #? \\\\ #? & #? \\end{pmatrix}',
        hintKm: 'ម៉ាទ្រីស ( ) 3×2',
        hintEn: '3×2 ( ) Matrix',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{pmatrix}\\square\\\\ \\square\\end{pmatrix}',
        insertLatex: '\\begin{pmatrix} #? \\\\ #? \\end{pmatrix}',
        hintKm: 'ជួរឈរ 2×1',
        hintEn: '2×1 Vector',
      },
      {
        previewLatex: '\\scriptstyle\\begin{pmatrix}\\square\\\\ \\square\\\\ \\square\\end{pmatrix}',
        insertLatex: '\\begin{pmatrix} #? \\\\ #? \\\\ #? \\end{pmatrix}',
        hintKm: 'ជួរឈរ 3×1',
        hintEn: '3×1 Vector',
      },
      {
        previewLatex: '\\scriptstyle\\begin{pmatrix}\\square & \\square & \\square\\end{pmatrix}',
        insertLatex: '\\begin{pmatrix} #? & #? & #? \\end{pmatrix}',
        hintKm: 'ជួរដេក 1×3',
        hintEn: '1×3 Row',
        wide: true,
      },
      // Square bracket matrices [...]
      {
        previewLatex: '\\scriptstyle\\begin{bmatrix}\\square & \\square\\\\ \\square & \\square\\end{bmatrix}',
        insertLatex: '\\begin{bmatrix} #? & #? \\\\ #? & #? \\end{bmatrix}',
        hintKm: 'ម៉ាទ្រីស [ ] 2×2',
        hintEn: '2×2 [ ] Matrix',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{bmatrix}\\square & \\square & \\square\\\\ \\square & \\square & \\square\\\\ \\square & \\square & \\square\\end{bmatrix}',
        insertLatex: '\\begin{bmatrix} #? & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #? \\end{bmatrix}',
        hintKm: 'ម៉ាទ្រីស [ ] 3×3',
        hintEn: '3×3 [ ] Matrix',
        wide: true,
      },
      {
        previewLatex: '\\scriptscriptstyle\\begin{bmatrix}\\square & \\square & \\square & \\square\\\\ \\square & \\square & \\square & \\square\\\\ \\square & \\square & \\square & \\square\\\\ \\square & \\square & \\square & \\square\\end{bmatrix}',
        insertLatex: '\\begin{bmatrix} #? & #? & #? & #? \\\\ #? & #? & #? & #? \\\\ #? & #? & #? & #? \\\\ #? & #? & #? & #? \\end{bmatrix}',
        hintKm: 'ម៉ាទ្រីស [ ] 4×4',
        hintEn: '4×4 [ ] Matrix',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{bmatrix}\\square & \\square & \\square\\\\ \\square & \\square & \\square\\end{bmatrix}',
        insertLatex: '\\begin{bmatrix} #? & #? & #? \\\\ #? & #? & #? \\end{bmatrix}',
        hintKm: 'ម៉ាទ្រីស [ ] 2×3',
        hintEn: '2×3 [ ] Matrix',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{bmatrix}\\square & \\square\\\\ \\square & \\square\\\\ \\square & \\square\\end{bmatrix}',
        insertLatex: '\\begin{bmatrix} #? & #? \\\\ #? & #? \\\\ #? & #? \\end{bmatrix}',
        hintKm: 'ម៉ាទ្រីស [ ] 3×2',
        hintEn: '3×2 [ ] Matrix',
        wide: true,
      },
      // Determinants |...|
      {
        previewLatex: '\\scriptstyle\\begin{vmatrix}\\square & \\square\\\\ \\square & \\square\\end{vmatrix}',
        insertLatex: '\\begin{vmatrix} #? & #? \\\\ #? & #? \\end{vmatrix}',
        hintKm: 'ដេទែមីណង់ 2×2',
        hintEn: '2×2 Determinant',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{vmatrix}\\square & \\square & \\square\\\\ \\square & \\square & \\square\\\\ \\square & \\square & \\square\\end{vmatrix}',
        insertLatex: '\\begin{vmatrix} #? & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #? \\end{vmatrix}',
        hintKm: 'ដេទែមីណង់ 3×3',
        hintEn: '3×3 Determinant',
        wide: true,
      },
      {
        previewLatex: '\\scriptscriptstyle\\begin{vmatrix}\\square & \\square & \\square & \\square\\\\ \\square & \\square & \\square & \\square\\\\ \\square & \\square & \\square & \\square\\\\ \\square & \\square & \\square & \\square\\end{vmatrix}',
        insertLatex: '\\begin{vmatrix} #? & #? & #? & #? \\\\ #? & #? & #? & #? \\\\ #? & #? & #? & #? \\\\ #? & #? & #? & #? \\end{vmatrix}',
        hintKm: 'ដេទែមីណង់ 4×4',
        hintEn: '4×4 Determinant',
        wide: true,
      },
      // Double vertical bars ||...|| (Norm / Vmatrix) & Curly braces {...} (Bmatrix)
      {
        previewLatex: '\\scriptstyle\\begin{Vmatrix}\\square & \\square\\\\ \\square & \\square\\end{Vmatrix}',
        insertLatex: '\\begin{Vmatrix} #? & #? \\\\ #? & #? \\end{Vmatrix}',
        hintKm: 'របារគូ ‖ ‖ 2×2',
        hintEn: '2×2 ‖ ‖ Norm',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{Vmatrix}\\square & \\square & \\square\\\\ \\square & \\square & \\square\\\\ \\square & \\square & \\square\\end{Vmatrix}',
        insertLatex: '\\begin{Vmatrix} #? & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #? \\end{Vmatrix}',
        hintKm: 'របារគូ ‖ ‖ 3×3',
        hintEn: '3×3 ‖ ‖ Norm',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{Bmatrix}\\square & \\square\\\\ \\square & \\square\\end{Bmatrix}',
        insertLatex: '\\begin{Bmatrix} #? & #? \\\\ #? & #? \\end{Bmatrix}',
        hintKm: 'ខ្វែង { } 2×2',
        hintEn: '2×2 { } Matrix',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{Bmatrix}\\square & \\square & \\square\\\\ \\square & \\square & \\square\\\\ \\square & \\square & \\square\\end{Bmatrix}',
        insertLatex: '\\begin{Bmatrix} #? & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #? \\end{Bmatrix}',
        hintKm: 'ខ្វែង { } 3×3',
        hintEn: '3×3 { } Matrix',
        wide: true,
      },
      // Augmented matrices (A | b)
      {
        previewLatex: '\\scriptstyle\\left(\\begin{array}{cc|c}\\square & \\square & \\square\\\\ \\square & \\square & \\square\\end{array}\\right)',
        insertLatex: '\\left(\\begin{array}{cc|c} #? & #? & #? \\\\ #? & #? & #? \\end{array}\\right)',
        hintKm: 'ម៉ាទ្រីសបំពេញ (2|1)',
        hintEn: 'Augmented (2|1)',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\left[\\begin{array}{ccc|c}\\square & \\square & \\square & \\square\\\\ \\square & \\square & \\square & \\square\\\\ \\square & \\square & \\square & \\square\\end{array}\\right]',
        insertLatex: '\\left[\\begin{array}{ccc|c} #? & #? & #? & #? \\\\ #? & #? & #? & #? \\\\ #? & #? & #? & #? \\end{array}\\right]',
        hintKm: 'ម៉ាទ្រីសបំពេញ [3|1]',
        hintEn: 'Augmented [3|1]',
        wide: true,
      },
      // Plain borderless matrix
      {
        previewLatex: '\\scriptstyle\\begin{matrix}\\square & \\square\\\\ \\square & \\square\\end{matrix}',
        insertLatex: '\\begin{matrix} #? & #? \\\\ #? & #? \\end{matrix}',
        hintKm: 'គ្មានខ្វែង 2×2',
        hintEn: 'Plain 2×2',
        wide: true,
      },
      {
        previewLatex: '\\scriptstyle\\begin{matrix}\\square & \\square & \\square\\\\ \\square & \\square & \\square\\\\ \\square & \\square & \\square\\end{matrix}',
        insertLatex: '\\begin{matrix} #? & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #? \\end{matrix}',
        hintKm: 'គ្មានខ្វែង 3×3',
        hintEn: 'Plain 3×3',
        wide: true,
      },
    ],
  },
  {
    titleKm: 'សញ្ញាប្រមាណវិធី និងទំនាក់ទំនងរហ័ស',
    titleEn: 'Quick Operators & Relations',
    items: [
      { previewLatex: '+', insertLatex: '+', hintKm: 'បូក', hintEn: 'Plus' },
      { previewLatex: '-', insertLatex: '-', hintKm: 'ដក', hintEn: 'Minus' },
      { previewLatex: '\\times', insertLatex: '\\times ', hintKm: 'គុណ', hintEn: 'Multiply' },
      { previewLatex: '\\div', insertLatex: '\\div ', hintKm: 'ចែក', hintEn: 'Divide' },
      { previewLatex: '\\pm', insertLatex: '\\pm ', hintKm: 'បូកដក', hintEn: 'Plus/minus' },
      { previewLatex: '=', insertLatex: '=', hintKm: 'ស្មើ', hintEn: 'Equals' },
      { previewLatex: '\\neq', insertLatex: '\\neq ', hintKm: 'ខុសពី', hintEn: 'Not equal' },
      { previewLatex: '\\approx', insertLatex: '\\approx ', hintKm: 'ប្រហែល', hintEn: 'Approx' },
      { previewLatex: '\\le', insertLatex: '\\le ', hintKm: 'តូចឬស្មើ', hintEn: 'Less/eq' },
      { previewLatex: '\\ge', insertLatex: '\\ge ', hintKm: 'ធំឬស្មើ', hintEn: 'Greater/eq' },
      { previewLatex: '\\infty', insertLatex: '\\infty', hintKm: 'អនន្ត', hintEn: 'Infinity' },
      { previewLatex: '\\Rightarrow', insertLatex: '\\Rightarrow ', hintKm: 'នាំឱ្យ', hintEn: 'Implies' },
      { previewLatex: '\\Leftrightarrow', insertLatex: '\\Leftrightarrow ', hintKm: 'សមមូល', hintEn: 'Iff' },
      { previewLatex: '\\in', insertLatex: '\\in ', hintKm: 'ជារបស់', hintEn: 'In' },
      { previewLatex: '\\cup', insertLatex: '\\cup ', hintKm: 'ប្រជុំ', hintEn: 'Union' },
      { previewLatex: '\\cap', insertLatex: '\\cap ', hintKm: 'ប្រសព្វ', hintEn: 'Intersect' },
    ],
  },
];

const MATH_FORMULA_GROUPS: MathTypeGroup[] = [
  {
    titleKm: 'សមីការបន្ទាត់ & សមីការប្លង់ (Line & Plane Equations — 2D / 3D)',
    titleEn: 'Line & Plane Equations (2D & 3D Geometry)',
    items: [
      { previewLatex: 'y = ax + b', insertLatex: 'y = ax + b', hintKm: 'បន្ទាត់ក្នុងប្លង់', hintEn: 'Slope-intercept', wide: true },
      { previewLatex: 'ax + by + c = 0', insertLatex: 'ax + by + c = 0', hintKm: 'សមីការទូទៅបន្ទាត់', hintEn: '2D General line', wide: true },
      { previewLatex: 'y - y_0 = m(x - x_0)', insertLatex: 'y - y_{0} = m(x - x_{0})', hintKm: 'បន្ទាត់កាត់ចំណុច', hintEn: 'Point-slope', wide: true },
      { previewLatex: '\\scriptstyle\\begin{cases}x = x_0 + at\\\\ y = y_0 + bt\\end{cases}', insertLatex: '\\begin{cases} x = x_{0} + at \\\\ y = y_{0} + bt \\end{cases}', hintKm: 'ប៉ារ៉ាម៉ែត្របន្ទាត់ 2D', hintEn: '2D Parametric line', wide: true },
      { previewLatex: '\\scriptstyle\\begin{cases}x = x_0 + at\\\\ y = y_0 + bt\\\\ z = z_0 + ct\\end{cases}', insertLatex: '\\begin{cases} x = x_{0} + at \\\\ y = y_{0} + bt \\\\ z = z_{0} + ct \\end{cases}', hintKm: 'ប៉ារ៉ាម៉ែត្របន្ទាត់ 3D', hintEn: '3D Parametric line', wide: true },
      { previewLatex: '\\frac{x-x_0}{a} = \\frac{y-y_0}{b} = \\frac{z-z_0}{c}', insertLatex: '\\frac{x - x_{0}}{a} = \\frac{y - y_{0}}{b} = \\frac{z - z_{0}}{c}', hintKm: 'សមីការឆ្លុះបន្ទាត់ 3D', hintEn: '3D Symmetric line', wide: true },
      { previewLatex: 'd(M,\\Delta) = \\frac{|ax_0+by_0+c|}{\\sqrt{a^2+b^2}}', insertLatex: 'd(M,\\Delta) = \\frac{|ax_{0}+by_{0}+c|}{\\sqrt{a^{2}+b^{2}}}', hintKm: 'ចម្ងាយពីចំណុចទៅបន្ទាត់', hintEn: 'Point-to-line dist', wide: true },
      { previewLatex: 'ax + by + cz + d = 0', insertLatex: 'ax + by + cz + d = 0', hintKm: 'សមីការប្លង់ទូទៅ', hintEn: 'Plane general eq', wide: true },
      { previewLatex: 'a(x-x_0)+b(y-y_0)+c(z-z_0)=0', insertLatex: 'a(x-x_{0})+b(y-y_{0})+c(z-z_{0})=0', hintKm: 'ប្លង់កាត់ចំណុច & ណរម៉ាល់', hintEn: 'Plane point-normal', wide: true },
      { previewLatex: '\\frac{x}{a} + \\frac{y}{b} + \\frac{z}{c} = 1', insertLatex: '\\frac{x}{a} + \\frac{y}{b} + \\frac{z}{c} = 1', hintKm: 'សមីការប្លង់កាត់អ័ក្ស', hintEn: 'Plane intercepts', wide: true },
      { previewLatex: 'd(M,P) = \\frac{|ax_0+by_0+cz_0+d|}{\\sqrt{a^2+b^2+c^2}}', insertLatex: 'd(M,P) = \\frac{|ax_{0}+by_{0}+cz_{0}+d|}{\\sqrt{a^{2}+b^{2}+c^{2}}}', hintKm: 'ចម្ងាយពីចំណុចទៅប្លង់', hintEn: 'Point-to-plane dist', wide: true },
      { previewLatex: '\\vec{u}\\cdot\\vec{v} = x_1x_2+y_1y_2+z_1z_2', insertLatex: '\\vec{u}\\cdot\\vec{v} = x_{1}x_{2}+y_{1}y_{2}+z_{1}z_{2}', hintKm: 'ផលគុណស្កាលែ 3D', hintEn: '3D Dot product', wide: true },
      { previewLatex: '\\scriptstyle\\vec{u}\\times\\vec{v} = \\begin{vmatrix}\\vec{i}&\\vec{j}&\\vec{k}\\\\ x_1&y_1&z_1\\\\ x_2&y_2&z_2\\end{vmatrix}', insertLatex: '\\vec{u}\\times\\vec{v} = \\begin{vmatrix} \\vec{i} & \\vec{j} & \\vec{k} \\\\ x_{1} & y_{1} & z_{1} \\\\ x_{2} & y_{2} & z_{2} \\end{vmatrix}', hintKm: 'ផលគុណវ៉ិចទ័រ 3D', hintEn: '3D Cross product', wide: true },
      { previewLatex: '\\cos\\theta = \\frac{|\\vec{n}_1\\cdot\\vec{n}_2|}{\\|\\vec{n}_1\\|\\|\\vec{n}_2\\|}', insertLatex: '\\cos\\theta = \\frac{|\\vec{n}_{1}\\cdot\\vec{n}_{2}|}{\\|\\vec{n}_{1}\\|\\,\\|\\vec{n}_{2}\\|}', hintKm: 'មុំរវាងប្លង់/វ៉ិចទ័រ', hintEn: 'Angle between planes', wide: true },
      { previewLatex: '(x-a)^2+(y-b)^2+(z-c)^2 = R^2', insertLatex: '(x-a)^{2}+(y-b)^{2}+(z-c)^{2} = R^{2}', hintKm: 'សមីការស្វ៊ែរ', hintEn: 'Sphere equation', wide: true },
    ],
  },
  {
    titleKm: 'កោនិច — រង្វង់ ប៉ារ៉ាបូល អេលីប & អ៊ីពែបូល (Conic Sections)',
    titleEn: 'Conic Sections — Circle, Parabola, Ellipse & Hyperbola',
    items: [
      { previewLatex: 'x^2 + y^2 = R^2', insertLatex: 'x^{2} + y^{2} = R^{2}', hintKm: 'រង្វង់ផ្ចិត O(0,0)', hintEn: 'Circle at origin', wide: true },
      { previewLatex: '(x-h)^2 + (y-k)^2 = R^2', insertLatex: '(x-h)^{2} + (y-k)^{2} = R^{2}', hintKm: 'រង្វង់ផ្ចិត (h,k)', hintEn: 'Circle at (h,k)', wide: true },
      { previewLatex: 'y^2 = 4px', insertLatex: 'y^{2} = 4px', hintKm: 'ប៉ារ៉ាបូលដេក (O)', hintEn: 'Parabola horiz.', wide: true },
      { previewLatex: 'x^2 = 4py', insertLatex: 'x^{2} = 4py', hintKm: 'ប៉ារ៉ាបូលឈរ (O)', hintEn: 'Parabola vert.', wide: true },
      { previewLatex: '(y-k)^2 = 4p(x-h)', insertLatex: '(y-k)^{2} = 4p(x-h)', hintKm: 'ប៉ារ៉ាបូលដេក (h,k)', hintEn: 'Parabola (h,k) H', wide: true },
      { previewLatex: '(x-h)^2 = 4p(y-k)', insertLatex: '(x-h)^{2} = 4p(y-k)', hintKm: 'ប៉ារ៉ាបូលឈរ (h,k)', hintEn: 'Parabola (h,k) V', wide: true },
      { previewLatex: '\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1', insertLatex: '\\frac{x^{2}}{a^{2}} + \\frac{y^{2}}{b^{2}} = 1', hintKm: 'អេលីបផ្ចិត O', hintEn: 'Ellipse at origin', wide: true },
      { previewLatex: '\\frac{(x-h)^2}{a^2} + \\frac{(y-k)^2}{b^2} = 1', insertLatex: '\\frac{(x-h)^{2}}{a^{2}} + \\frac{(y-k)^{2}}{b^{2}} = 1', hintKm: 'អេលីបផ្ចិត (h,k)', hintEn: 'Ellipse at (h,k)', wide: true },
      { previewLatex: 'c^2 = a^2 - b^2', insertLatex: 'c^{2} = a^{2} - b^{2}', hintKm: 'កំណុំអេលីប', hintEn: 'Ellipse foci', wide: true },
      { previewLatex: '\\frac{x^2}{a^2} - \\frac{y^2}{b^2} = 1', insertLatex: '\\frac{x^{2}}{a^{2}} - \\frac{y^{2}}{b^{2}} = 1', hintKm: 'អ៊ីពែបូលដេក (O)', hintEn: 'Hyperbola H', wide: true },
      { previewLatex: '\\frac{y^2}{a^2} - \\frac{x^2}{b^2} = 1', insertLatex: '\\frac{y^{2}}{a^{2}} - \\frac{x^{2}}{b^{2}} = 1', hintKm: 'អ៊ីពែបូលឈរ (O)', hintEn: 'Hyperbola V', wide: true },
      { previewLatex: '\\frac{(x-h)^2}{a^2} - \\frac{(y-k)^2}{b^2} = 1', insertLatex: '\\frac{(x-h)^{2}}{a^{2}} - \\frac{(y-k)^{2}}{b^{2}} = 1', hintKm: 'អ៊ីពែបូលផ្ចិត (h,k)', hintEn: 'Hyperbola (h,k)', wide: true },
      { previewLatex: 'c^2 = a^2 + b^2', insertLatex: 'c^{2} = a^{2} + b^{2}', hintKm: 'កំណុំអ៊ីពែបូល', hintEn: 'Hyperbola foci', wide: true },
      { previewLatex: 'y = \\pm \\frac{b}{a}x', insertLatex: 'y = \\pm \\frac{b}{a}x', hintKm: 'អាស៊ីមតូតអ៊ីពែបូល', hintEn: 'Asymptotes', wide: true },
      { previewLatex: 'e = \\frac{c}{a}', insertLatex: 'e = \\frac{c}{a}', hintKm: 'អិចសង់ទ្រីស៊ីតេ e', hintEn: 'Eccentricity e' },
    ],
  },
  {
    titleKm: 'អនុគមន៍ ត្រីកោណមាត្រ & លោការីត',
    titleEn: 'Functions, Trigonometry & Logarithms',
    items: [
      { previewLatex: '\\sin\\left(\\square\\right)', insertLatex: '\\sin\\left(#?\\right)', hintKm: 'ស៊ីនុស', hintEn: 'sin' },
      { previewLatex: '\\cos\\left(\\square\\right)', insertLatex: '\\cos\\left(#?\\right)', hintKm: 'កូស៊ីនុស', hintEn: 'cos' },
      { previewLatex: '\\tan\\left(\\square\\right)', insertLatex: '\\tan\\left(#?\\right)', hintKm: 'តង់សង់', hintEn: 'tan' },
      { previewLatex: '\\log_{\\square}\\left(\\square\\right)', insertLatex: '\\log_{#?}\\left(#?\\right)', hintKm: 'លោការីតគោល', hintEn: 'log base', wide: true },
      { previewLatex: '\\ln\\left(\\square\\right)', insertLatex: '\\ln\\left(#?\\right)', hintKm: 'លោការីតនេពែ', hintEn: 'ln' },
      { previewLatex: 'e^{\\square}', insertLatex: 'e^{#?}', hintKm: 'អិចស្ប៉ូណង់ស្យែល', hintEn: 'Exp' },
      { previewLatex: '\\sin^2 x + \\cos^2 x = 1', insertLatex: '\\sin^{2} x + \\cos^{2} x = 1', hintKm: 'លក្ខណៈត្រីកោណ', hintEn: 'Pythagorean', wide: true },
      { previewLatex: 'z = a + bi', insertLatex: 'z = #? + #?i', hintKm: 'ចំនួនកុំផ្លិច', hintEn: 'Complex', wide: true },
    ],
  },
  {
    titleKm: 'រូបមន្តគណិតវិទ្យាសំខាន់ៗ (ចុចរួចកែលេខបានភ្លាម)',
    titleEn: 'Ready-to-Edit Math Formulas',
    items: [
      { previewLatex: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', insertLatex: 'x = \\frac{-b \\pm \\sqrt{b^{2}-4ac}}{2a}', hintKm: 'ឫសដឺក្រេទី២', hintEn: 'Quadratic', wide: true },
      { previewLatex: '\\Delta = b^2 - 4ac', insertLatex: '\\Delta = b^{2} - 4ac', hintKm: 'ដែលតា Δ', hintEn: 'Discriminant', wide: true },
      { previewLatex: '(a+b)^2 = a^2+2ab+b^2', insertLatex: '(a+b)^{2} = a^{2}+2ab+b^{2}', hintKm: 'អត្តសញ្ញាណ', hintEn: 'Binomial sq', wide: true },
      { previewLatex: 'd = \\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}', insertLatex: 'd = \\sqrt{(x_{2}-x_{1})^{2}+(y_{2}-y_{1})^{2}}', hintKm: 'ចម្ងាយពីរចំណុច', hintEn: 'Distance', wide: true },
      { previewLatex: 'P(A) = \\frac{n(A)}{n(\\Omega)}', insertLatex: 'P(A) = \\frac{n(A)}{n(\\Omega)}', hintKm: 'ប្រូបាប៊ីលីតេ', hintEn: 'Probability', wide: true },
      { previewLatex: '\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i', insertLatex: '\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_{i}', hintKm: 'មធ្យមនព្វន្ត', hintEn: 'Mean', wide: true },
      { previewLatex: 'C_n^k = \\frac{n!}{k!(n-k)!}', insertLatex: 'C_{n}^{k} = \\frac{n!}{k!(n-k)!}', hintKm: 'បន្សំ', hintEn: 'Combination', wide: true },
      { previewLatex: 'S = \\pi r^2', insertLatex: 'S = \\pi r^{2}', hintKm: 'ផ្ទៃរង្វង់', hintEn: 'Circle area' },
    ],
  },
];

const PHYSICS_GROUPS: MathTypeGroup[] = [
  {
    titleKm: 'មេកានិច ចលនា សម្ពាធ & ថាមពល (Mechanics)',
    titleEn: 'Mechanics, Kinematics, Pressure & Energy',
    items: [
      { previewLatex: '\\vec{F} = m\\vec{a}', insertLatex: '\\vec{F} = m\\vec{a}', hintKm: 'ច្បាប់ញូតុនទី២', hintEn: 'Newton II' },
      { previewLatex: 'v = v_0 + at', insertLatex: 'v = v_{0} + at', hintKm: 'ល្បឿន', hintEn: 'Velocity' },
      { previewLatex: 'x = x_0 + v_0 t + \\frac{1}{2}at^2', insertLatex: 'x = x_{0} + v_{0}t + \\frac{1}{2}at^{2}', hintKm: 'សមីការចលនា', hintEn: 'Position', wide: true },
      { previewLatex: 'v^2 - v_0^2 = 2as', insertLatex: 'v^{2} - v_{0}^{2} = 2as', hintKm: 'ទំនាក់ទំនងល្បឿន', hintEn: 'Torricelli', wide: true },
      { previewLatex: 'W = F\\cdot d\\cos\\alpha', insertLatex: 'W = F\\cdot d\\cos\\alpha', hintKm: 'កម្មន្តកម្លាំង', hintEn: 'Work', wide: true },
      { previewLatex: '\\vec{p} = m\\vec{v}', insertLatex: '\\vec{p} = m\\vec{v}', hintKm: 'បរិមាណចលនា', hintEn: 'Momentum' },
      { previewLatex: 'E_k = \\frac{1}{2}mv^2', insertLatex: 'E_{k} = \\frac{1}{2}mv^{2}', hintKm: 'ថាមពលស៊ីនេទិច', hintEn: 'Kinetic E', wide: true },
      { previewLatex: 'E_p = mgh', insertLatex: 'E_{p} = mgh', hintKm: 'ថាមពលប៉ូតង់ស្យែល', hintEn: 'Potential E' },
      { previewLatex: 'F = G\\frac{m_1 m_2}{r^2}', insertLatex: 'F = G\\frac{m_{1}m_{2}}{r^{2}}', hintKm: 'ទំនាញសកល', hintEn: 'Gravity', wide: true },
      { previewLatex: 'P = \\frac{W}{t}', insertLatex: 'P = \\frac{W}{t}', hintKm: 'អានុភាព', hintEn: 'Power' },
      { previewLatex: '\\rho = \\frac{m}{V}', insertLatex: '\\rho = \\frac{m}{V}', hintKm: 'ម៉ាសមាឌ', hintEn: 'Density' },
      { previewLatex: 'P = \\frac{F}{S}', insertLatex: 'P = \\frac{F}{S}', hintKm: 'សម្ពាធ', hintEn: 'Pressure' },
      { previewLatex: 'P = \\rho gh', insertLatex: 'P = \\rho gh', hintKm: 'សម្ពាធអង្គធាតុរាវ', hintEn: 'Hydrostatic P', wide: true },
      { previewLatex: 'F_A = \\rho V g', insertLatex: 'F_{A} = \\rho V g', hintKm: 'ដំណោលអាកស៊ីម៉ែត', hintEn: 'Buoyancy', wide: true },
    ],
  },
  {
    titleKm: 'លំយោល រលក អុបទិច & ទែម៉ូឌីណាមិច (Oscillations, Waves & Thermo)',
    titleEn: 'Oscillations, Waves, Optics & Thermodynamics',
    items: [
      { previewLatex: 'x = A\\cos(\\omega t + \\varphi)', insertLatex: 'x = A\\cos(\\omega t + \\varphi)', hintKm: 'សមីការលំយោល', hintEn: 'SHM Position', wide: true },
      { previewLatex: 'v = -\\omega A\\sin(\\omega t + \\varphi)', insertLatex: 'v = -\\omega A\\sin(\\omega t + \\varphi)', hintKm: 'ល្បឿនលំយោល', hintEn: 'SHM Velocity', wide: true },
      { previewLatex: 'a = -\\omega^2 x', insertLatex: 'a = -\\omega^{2}x', hintKm: 'សំទុះលំយោល', hintEn: 'SHM Accel.', wide: true },
      { previewLatex: 'T = 2\\pi\\sqrt{\\frac{l}{g}}', insertLatex: 'T = 2\\pi\\sqrt{\\frac{l}{g}}', hintKm: 'ខួបប៉ោលទោល', hintEn: 'Pendulum T', wide: true },
      { previewLatex: 'T = 2\\pi\\sqrt{\\frac{m}{k}}', insertLatex: 'T = 2\\pi\\sqrt{\\frac{m}{k}}', hintKm: 'ខួបប៉ោលរ៉ឺស័រ', hintEn: 'Spring T', wide: true },
      { previewLatex: 'E = \\frac{1}{2}kA^2', insertLatex: 'E = \\frac{1}{2}kA^{2}', hintKm: 'ថាមពលលំយោល', hintEn: 'SHM Energy', wide: true },
      { previewLatex: 'v = \\lambda f', insertLatex: 'v = \\lambda f', hintKm: 'ល្បឿនរលក', hintEn: 'Wave speed' },
      { previewLatex: '\\frac{1}{f} = \\frac{1}{d} + \\frac{1}{d\'}', insertLatex: '\\frac{1}{f} = \\frac{1}{d} + \\frac{1}{d\'}', hintKm: 'ឡង់ទីស្តើង', hintEn: 'Thin lens', wide: true },
      { previewLatex: 'n_1\\sin i = n_2\\sin r', insertLatex: 'n_{1}\\sin i = n_{2}\\sin r', hintKm: 'ច្បាប់ចំណាំងបែរ', hintEn: 'Snell law', wide: true },
      { previewLatex: 'PV = nRT', insertLatex: 'PV = nRT', hintKm: 'ឧស្ម័នបរិសុទ្ធ', hintEn: 'Ideal gas' },
      { previewLatex: 'Q = mc\\Delta T', insertLatex: 'Q = mc\\Delta T', hintKm: 'បរិមាណកម្តៅ', hintEn: 'Heat Q', wide: true },
      { previewLatex: '\\Delta U = Q + W', insertLatex: '\\Delta U = Q + W', hintKm: 'ច្បាប់ទី១ទែម៉ូ', hintEn: '1st Law Thermo', wide: true },
      { previewLatex: '\\eta = 1 - \\frac{T_2}{T_1}', insertLatex: '\\eta = 1 - \\frac{T_{2}}{T_{1}}', hintKm: 'ទិន្នផលកាណូ', hintEn: 'Carnot eff.', wide: true },
    ],
  },
  {
    titleKm: 'អគ្គិសនី សៀគ្វីឆ្លាស់ RLC ម៉ាញេទិច & នុយក្លេអ៊ែរ (Electricity, AC & Nuclear)',
    titleEn: 'Electricity, AC Circuits (RLC), Magnetism & Nuclear',
    items: [
      { previewLatex: 'U = I R', insertLatex: 'U = IR', hintKm: 'ច្បាប់អូម', hintEn: "Ohm's law" },
      { previewLatex: 'P = U I = I^2 R', insertLatex: 'P = UI = I^{2}R', hintKm: 'អានុភាពអគ្គិសនី', hintEn: 'Elec. Power', wide: true },
      { previewLatex: 'F = k\\frac{|q_1 q_2|}{r^2}', insertLatex: 'F = k\\frac{|q_{1}q_{2}|}{r^{2}}', hintKm: 'ច្បាប់គូឡុំ', hintEn: 'Coulomb', wide: true },
      { previewLatex: '\\frac{1}{R_{eq}} = \\frac{1}{R_1} + \\frac{1}{R_2}', insertLatex: '\\frac{1}{R_{eq}} = \\frac{1}{R_{1}} + \\frac{1}{R_{2}}', hintKm: 'រេស៊ីស្តង់ខ្នែង', hintEn: 'Parallel R', wide: true },
      { previewLatex: 'Z = \\sqrt{R^2 + (Z_L - Z_C)^2}', insertLatex: 'Z = \\sqrt{R^{2} + (Z_{L} - Z_{C})^{2}}', hintKm: 'អាំងប៉េដង់ RLC', hintEn: 'RLC Impedance', wide: true },
      { previewLatex: 'Z_L = L\\omega = 2\\pi f L', insertLatex: 'Z_{L} = L\\omega = 2\\pi f L', hintKm: 'រេអាក់តង់ L', hintEn: 'Inductive X_L', wide: true },
      { previewLatex: 'Z_C = \\frac{1}{C\\omega} = \\frac{1}{2\\pi f C}', insertLatex: 'Z_{C} = \\frac{1}{C\\omega} = \\frac{1}{2\\pi f C}', hintKm: 'រេអាក់តង់ C', hintEn: 'Capacitive X_C', wide: true },
      { previewLatex: '\\tan\\varphi = \\frac{Z_L - Z_C}{R}', insertLatex: '\\tan\\varphi = \\frac{Z_{L} - Z_{C}}{R}', hintKm: 'គម្លាតផាស φ', hintEn: 'Phase angle', wide: true },
      { previewLatex: 'P = U_{\\text{eff}}I_{\\text{eff}}\\cos\\varphi', insertLatex: 'P = U_{\\text{eff}}I_{\\text{eff}}\\cos\\varphi', hintKm: 'អានុភាពឆ្លាស់ AC', hintEn: 'AC Power', wide: true },
      { previewLatex: '\\frac{U_1}{U_2} = \\frac{N_1}{N_2} = \\frac{I_2}{I_1}', insertLatex: '\\frac{U_{1}}{U_{2}} = \\frac{N_{1}}{N_{2}} = \\frac{I_{2}}{I_{1}}', hintKm: 'ត្រង់ស្វូម៉ាទ័រ', hintEn: 'Transformer', wide: true },
      { previewLatex: 'F = BIl\\sin\\alpha', insertLatex: 'F = BIl\\sin\\alpha', hintKm: 'កម្លាំងឡាប្លាស', hintEn: 'Laplace force', wide: true },
      { previewLatex: 'F = qvB\\sin\\theta', insertLatex: 'F = qvB\\sin\\theta', hintKm: 'កម្លាំងឡូរិន', hintEn: 'Lorentz', wide: true },
      { previewLatex: 'e = -\\frac{\\Delta\\Phi}{\\Delta t}', insertLatex: 'e = -\\frac{\\Delta\\Phi}{\\Delta t}', hintKm: 'អាំងឌុចស្យុង Faraday', hintEn: 'Faraday EMF', wide: true },
      { previewLatex: 'B = 4\\pi\\times 10^{-7}\\frac{N}{l}I', insertLatex: 'B = 4\\pi\\times 10^{-7}\\frac{N}{l}I', hintKm: 'ដែនសូលេណូអ៊ីត', hintEn: 'Solenoid B', wide: true },
      { previewLatex: 'E = hf = \\frac{hc}{\\lambda}', insertLatex: 'E = hf = \\frac{hc}{\\lambda}', hintKm: 'ថាមពលផូតុង', hintEn: 'Photon E', wide: true },
      { previewLatex: 'hf = W_0 + E_{k\\max}', insertLatex: 'hf = W_{0} + E_{k\\max}', hintKm: 'ផូតូអគ្គិសនី', hintEn: 'Photoelectric', wide: true },
      { previewLatex: 'N = N_0 e^{-\\lambda t}', insertLatex: 'N = N_{0}e^{-\\lambda t}', hintKm: 'បន្សាយវិទ្យុសកម្ម', hintEn: 'Radioactive decay', wide: true },
      { previewLatex: 'T = \\frac{\\ln 2}{\\lambda}', insertLatex: 'T = \\frac{\\ln 2}{\\lambda}', hintKm: 'ពាក់កណ្តាលជីវិត', hintEn: 'Half-life', wide: true },
      { previewLatex: 'E = mc^2', insertLatex: 'E = mc^{2}', hintKm: 'អាញស្ដាញ', hintEn: 'Einstein' },
    ],
  },
  {
    titleKm: 'ខ្នាតរូបវិទ្យាស្ដង់ដារ (SI Units)',
    titleEn: 'SI Physical Units',
    items: [
      { previewLatex: '\\pu{m/s}', insertLatex: '\\,\\pu{m/s}', hintKm: 'ម៉ែត្រ/វិនាទី', hintEn: 'm/s' },
      { previewLatex: '\\pu{m/s^2}', insertLatex: '\\,\\pu{m/s^2}', hintKm: 'សំទុះ', hintEn: 'm/s²' },
      { previewLatex: '\\pu{km/h}', insertLatex: '\\,\\pu{km/h}', hintKm: 'គម/ម៉ោង', hintEn: 'km/h' },
      { previewLatex: '\\pu{N}', insertLatex: '\\,\\pu{N}', hintKm: 'ញូតុន', hintEn: 'Newton' },
      { previewLatex: '\\pu{J}', insertLatex: '\\,\\pu{J}', hintKm: 'ស៊ូល', hintEn: 'Joule' },
      { previewLatex: '\\pu{W}', insertLatex: '\\,\\pu{W}', hintKm: 'វ៉ាត់', hintEn: 'Watt' },
      { previewLatex: '\\pu{\\Omega}', insertLatex: '\\,\\pu{\\Omega}', hintKm: 'អូម', hintEn: 'Ohm' },
      { previewLatex: '\\pu{V}', insertLatex: '\\,\\pu{V}', hintKm: 'វ៉ុល', hintEn: 'Volt' },
      { previewLatex: '\\pu{A}', insertLatex: '\\,\\pu{A}', hintKm: 'អំពែ', hintEn: 'Ampere' },
      { previewLatex: '\\pu{Hz}', insertLatex: '\\,\\pu{Hz}', hintKm: 'អ៊ែត', hintEn: 'Hertz' },
      { previewLatex: '\\pu{Pa}', insertLatex: '\\,\\pu{Pa}', hintKm: 'ប៉ាស្កាល់', hintEn: 'Pascal' },
      { previewLatex: '\\pu{T}', insertLatex: '\\,\\pu{T}', hintKm: 'តេស្លា (T)', hintEn: 'Tesla' },
      { previewLatex: '\\pu{^\\circ C}', insertLatex: '\\,\\pu{^\\circ C}', hintKm: 'អង្សាសេ', hintEn: '°C' },
      { previewLatex: '\\pu{eV}', insertLatex: '\\,\\pu{eV}', hintKm: 'អេឡិចត្រុងវ៉ុល', hintEn: 'eV' },
    ],
  },
];

const CHEMISTRY_GROUPS: MathTypeGroup[] = [
  {
    titleKm: 'ប្រអប់សមីការគីមី MathType (ចុចរួចវាយរូបមន្តគីមីក្នុងប្រអប់ □)',
    titleEn: 'Chemistry Equation & Isotope Templates',
    items: [
      { previewLatex: '\\ce{A + B -> C}', insertLatex: '\\ce{#? + #? -> #?}', hintKm: 'ប្រតិកម្មគីមី', hintEn: 'Reaction', wide: true },
      { previewLatex: '\\ce{A + B <=> C + D}', insertLatex: '\\ce{#? + #? <=> #? + #?}', hintKm: 'ប្រតិកម្មទៅមក ⇌', hintEn: 'Equilibrium', wide: true },
      { previewLatex: '\\ce{A ->[\\Delta] B}', insertLatex: '\\ce{#? ->[\\Delta] #?}', hintKm: 'ប្រតិកម្មមានកម្តៅ', hintEn: 'Heat Δ', wide: true },
      { previewLatex: '\\ce{A ->[\\text{cat}] B}', insertLatex: '\\ce{#? ->[#?] #?}', hintKm: 'មានកាតាលីករ', hintEn: 'Catalyst', wide: true },
      { previewLatex: '\\ce{^{A}_{Z}X}', insertLatex: '\\ce{^{#?}_{#?}#?}', hintKm: 'អ៊ីសូតូប', hintEn: 'Isotope' },
      { previewLatex: '\\ce{X^{n+}}', insertLatex: '\\ce{#?^{#?+}}', hintKm: 'អ៊ីយ៉ុងវិជ្ជមាន', hintEn: 'Cation +' },
      { previewLatex: '\\ce{X^{n-}}', insertLatex: '\\ce{#?^{#?-}}', hintKm: 'អ៊ីយ៉ុងអវិជ្ជមាន', hintEn: 'Anion −' },
      { previewLatex: '\\ce{X v}', insertLatex: '\\ce{#? v}', hintKm: 'កករ ↓', hintEn: 'Precipitate' },
      { previewLatex: '\\ce{X ^}', insertLatex: '\\ce{#? ^}', hintKm: 'ឧស្ម័ន ↑', hintEn: 'Gas ↑' },
      { previewLatex: '\\left[\\ce{X}\\right]', insertLatex: '\\left[\\ce{#?}\\right]', hintKm: 'កំហាប់ [X]', hintEn: 'Concentration' },
      { previewLatex: '\\ce{->}', insertLatex: '\\ce{->}', hintKm: 'ព្រួញប្រតិកម្ម', hintEn: 'Arrow' },
      { previewLatex: '\\ce{<=>}', insertLatex: '\\ce{<=>}', hintKm: 'ព្រួញលំនឹង', hintEn: 'Equilib arrow' },
    ],
  },
  {
    titleKm: 'រូបមន្តគណនាគីមី — ម៉ូល កំហាប់ អាស៊ីត-បាស & អេឡិចត្រូគីមី',
    titleEn: 'Chemistry Calculations — Moles, Acid-Base, Kinetics & Electrochem',
    items: [
      { previewLatex: 'n = \\frac{m}{M}', insertLatex: 'n = \\frac{m}{M}', hintKm: 'ចំនួនម៉ូល', hintEn: 'Moles' },
      { previewLatex: 'C_M = \\frac{n}{V}', insertLatex: 'C_{M} = \\frac{n}{V}', hintKm: 'កំហាប់ម៉ូល', hintEn: 'Molarity' },
      { previewLatex: 'n = \\frac{V}{V_m}', insertLatex: 'n = \\frac{V}{V_{m}}', hintKm: 'ម៉ូលឧស្ម័ន', hintEn: 'Gas moles' },
      { previewLatex: 'N = n\\cdot N_A', insertLatex: 'N = n\\cdot N_{A}', hintKm: 'ចំនួនម៉ូលេគុល', hintEn: 'Avogadro N', wide: true },
      { previewLatex: 'C_1 V_1 = C_2 V_2', insertLatex: 'C_{1}V_{1} = C_{2}V_{2}', hintKm: 'ការពង្រាវ', hintEn: 'Dilution', wide: true },
      { previewLatex: 'C\\% = \\frac{m_{\\text{ct}}}{m_{\\text{dd}}}\\times 100\\%', insertLatex: 'C\\% = \\frac{m_{\\text{ct}}}{m_{\\text{dd}}}\\times 100\\%', hintKm: 'កំហាប់ភាគរយ C%', hintEn: 'Mass percent', wide: true },
      { previewLatex: 'C_M = \\frac{10\\cdot d\\cdot C\\%}{M}', insertLatex: 'C_{M} = \\frac{10\\cdot d\\cdot C\\%}{M}', hintKm: 'ទំនាក់ទំនង C_M & C%', hintEn: 'C_M from C%', wide: true },
      { previewLatex: 'd_{A/B} = \\frac{M_A}{M_B}', insertLatex: 'd_{A/B} = \\frac{M_{A}}{M_{B}}', hintKm: 'ដង់ស៊ីតេឧស្ម័ន', hintEn: 'Gas density', wide: true },
      { previewLatex: 'H = \\frac{m_{\\text{th}}}{m_{\\text{lt}}}\\times 100\\%', insertLatex: 'H = \\frac{m_{\\text{th}}}{m_{\\text{lt}}}\\times 100\\%', hintKm: 'ទិន្នផលប្រតិកម្ម', hintEn: 'Percent yield', wide: true },
      { previewLatex: '\\text{pH} = -\\log\\left[\\ce{H3O+}\\right]', insertLatex: '\\text{pH} = -\\log\\left[\\ce{H3O+}\\right]', hintKm: 'រូបមន្ត pH', hintEn: 'pH formula', wide: true },
      { previewLatex: '\\text{pH} + \\text{pOH} = 14', insertLatex: '\\text{pH} + \\text{pOH} = 14', hintKm: 'pH + pOH', hintEn: 'pH+pOH', wide: true },
      { previewLatex: 'K_w = [\\ce{H3O+}][\\ce{OH-}] = 10^{-14}', insertLatex: 'K_{w} = [\\ce{H3O+}][\\ce{OH-}] = 10^{-14}', hintKm: 'ផលគុណអ៊ីយ៉ុងទឹក', hintEn: 'Water Kw', wide: true },
      { previewLatex: 'K_a = \\frac{[\\ce{H3O+}][\\ce{A-}]}{[\\ce{HA}]}', insertLatex: 'K_{a} = \\frac{[\\ce{H3O+}][\\ce{A-}]}{[\\ce{HA}]}', hintKm: 'ថេរអាស៊ីត Ka', hintEn: 'Acid Ka', wide: true },
      { previewLatex: 'K_b = \\frac{[\\ce{BH+}][\\ce{OH-}]}{[\\ce{B}]}', insertLatex: 'K_{b} = \\frac{[\\ce{BH+}][\\ce{OH-}]}{[\\ce{B}]}', hintKm: 'ថេរបាស Kb', hintEn: 'Base Kb', wide: true },
      { previewLatex: '\\text{pH} = \\text{p}K_a + \\log\\frac{[\\ce{A-}]}{[\\ce{HA}]}', insertLatex: '\\text{pH} = \\text{p}K_{a} + \\log\\frac{[\\ce{A-}]}{[\\ce{HA}]}', hintKm: 'សូលុយស្យុងតំប៉ុង', hintEn: 'Buffer pH', wide: true },
      { previewLatex: 'K_c = \\frac{[\\ce{C}]^c[\\ce{D}]^d}{[\\ce{A}]^a[\\ce{B}]^b}', insertLatex: 'K_{c} = \\frac{[\\ce{C}]^{c}[\\ce{D}]^{d}}{[\\ce{A}]^{a}[\\ce{B}]^{b}}', hintKm: 'ថេរលំនឹង Kc', hintEn: 'Equil. Kc', wide: true },
      { previewLatex: 'v = -\\frac{\\Delta[\\ce{A}]}{\\Delta t}', insertLatex: 'v = -\\frac{\\Delta[\\ce{A}]}{\\Delta t}', hintKm: 'ល្បឿនប្រតិកម្ម', hintEn: 'Reaction rate', wide: true },
      { previewLatex: 'm = \\frac{M\\cdot I\\cdot t}{n\\cdot F}', insertLatex: 'm = \\frac{M\\cdot I\\cdot t}{n\\cdot F}', hintKm: 'អេឡិចត្រូលីស Faraday', hintEn: 'Faraday law', wide: true },
      { previewLatex: 'E^{\\circ}_{\\text{cell}} = E^{\\circ}_{\\text{cath}} - E^{\\circ}_{\\text{an}}', insertLatex: 'E^{\\circ}_{\\text{cell}} = E^{\\circ}_{\\text{cath}} - E^{\\circ}_{\\text{an}}', hintKm: 'កម្លាំងថ្មពិល E°', hintEn: 'Cell potential', wide: true },
      { previewLatex: '\\pu{mol/L}', insertLatex: '\\,\\pu{mol/L}', hintKm: 'ខ្នាត mol/L', hintEn: 'mol/L' },
    ],
  },
  {
    titleKm: 'គីមីសរីរាង្គ — រូបមន្តទូទៅ & ប្រតិកម្មសំខាន់ៗ (Organic Chemistry)',
    titleEn: 'Organic Chemistry — General Formulas & Reactions',
    items: [
      { previewLatex: '\\ce{C_nH_{2n+2}}', insertLatex: '\\ce{C_{n}H_{2n+2}}', hintKm: 'អាល់កាន', hintEn: 'Alkane' },
      { previewLatex: '\\ce{C_nH_{2n}}', insertLatex: '\\ce{C_{n}H_{2n}}', hintKm: 'អាល់សែន', hintEn: 'Alkene' },
      { previewLatex: '\\ce{C_nH_{2n-2}}', insertLatex: '\\ce{C_{n}H_{2n-2}}', hintKm: 'អាល់ស៊ីន', hintEn: 'Alkyne' },
      { previewLatex: '\\ce{C_nH_{2n+1}OH}', insertLatex: '\\ce{C_{n}H_{2n+1}OH}', hintKm: 'អាល់កុលឆ្អែត', hintEn: 'Alcohol', wide: true },
      { previewLatex: '\\ce{R-COOH}', insertLatex: '\\ce{R-COOH}', hintKm: 'អាស៊ីតកាបុកស៊ីលិច', hintEn: 'Carboxylic acid', wide: true },
      { previewLatex: '\\ce{R-COO-R\'}', insertLatex: '\\ce{R-COO-R\'}', hintKm: 'អេស្ទែ', hintEn: 'Ester', wide: true },
      { previewLatex: '\\ce{R-NH2}', insertLatex: '\\ce{R-NH2}', hintKm: 'អាមីន', hintEn: 'Amine' },
      { previewLatex: '\\ce{H2N-R-COOH}', insertLatex: '\\ce{H2N-R-COOH}', hintKm: 'អាស៊ីតអាមីណេ', hintEn: 'Amino acid', wide: true },
      { previewLatex: '\\ce{R-COOH + R\'-OH <=> R-COO-R\' + H2O}', insertLatex: '\\ce{R-COOH + R\'-OH <=> R-COO-R\' + H2O}', hintKm: 'អេស្ទែកម្ម', hintEn: 'Esterification', wide: true },
      { previewLatex: '\\ce{R-COO-R\' + NaOH ->[\\Delta] R-COONa + R\'-OH}', insertLatex: '\\ce{R-COO-R\' + NaOH ->[\\Delta] R-COONa + R\'-OH}', hintKm: 'សាប៊ូកម្ម', hintEn: 'Saponification', wide: true },
      { previewLatex: '\\ce{C_xH_y} + \\left(x+\\frac{y}{4}\\right)\\ce{O2 ->[\\Delta]} x\\ce{CO2} + \\frac{y}{2}\\ce{H2O}', insertLatex: '\\ce{C_{x}H_{y}} + \\left(x+\\frac{y}{4}\\right)\\ce{O2 ->[\\Delta]} x\\ce{CO2} + \\frac{y}{2}\\ce{H2O}', hintKm: 'ចំហេះអ៊ីដ្រូកាបួ', hintEn: 'Combustion', wide: true },
    ],
  },
  {
    titleKm: 'សមាសធាតុ និងប្រតិកម្មគីមីញឹកញាប់ (ចុចដាក់ភ្លាម)',
    titleEn: 'Common Compounds & Balanced Reactions',
    items: [
      { previewLatex: '\\ce{H2O}', insertLatex: '\\ce{H2O}', hintKm: 'ទឹក', hintEn: 'Water' },
      { previewLatex: '\\ce{CO2}', insertLatex: '\\ce{CO2}', hintKm: 'កាបូនឌីអុកស៊ីត', hintEn: 'CO₂' },
      { previewLatex: '\\ce{O2}', insertLatex: '\\ce{O2}', hintKm: 'អុកស៊ីសែន', hintEn: 'O₂' },
      { previewLatex: '\\ce{H2SO4}', insertLatex: '\\ce{H2SO4}', hintKm: 'អាស៊ីតស៊ុលផួរិច', hintEn: 'H₂SO₄' },
      { previewLatex: '\\ce{HCl}', insertLatex: '\\ce{HCl}', hintKm: 'អាស៊ីតក្លរីឌ្រិច', hintEn: 'HCl' },
      { previewLatex: '\\ce{HNO3}', insertLatex: '\\ce{HNO3}', hintKm: 'អាស៊ីតនីទ្រិច', hintEn: 'HNO₃' },
      { previewLatex: '\\ce{NaOH}', insertLatex: '\\ce{NaOH}', hintKm: 'សូដ្យូមអ៊ីដ្រុកស៊ីត', hintEn: 'NaOH' },
      { previewLatex: '\\ce{Ca(OH)2}', insertLatex: '\\ce{Ca(OH)2}', hintKm: 'កាល់ស្យូមអ៊ីដ្រុកស៊ីត', hintEn: 'Ca(OH)₂' },
      { previewLatex: '\\ce{NaCl}', insertLatex: '\\ce{NaCl}', hintKm: 'អំបិលសម្ល', hintEn: 'NaCl' },
      { previewLatex: '\\ce{CaCO3}', insertLatex: '\\ce{CaCO3}', hintKm: 'ថ្មកំបោរ', hintEn: 'CaCO₃' },
      { previewLatex: '\\ce{NH3}', insertLatex: '\\ce{NH3}', hintKm: 'អាម៉ូញាក់', hintEn: 'NH₃' },
      { previewLatex: '\\ce{C6H12O6}', insertLatex: '\\ce{C6H12O6}', hintKm: 'គ្លុយកូស', hintEn: 'Glucose' },
      { previewLatex: '\\ce{2H2 + O2 -> 2H2O}', insertLatex: '\\ce{2H2 + O2 -> 2H2O}', hintKm: 'សំយោគទឹក', hintEn: 'Water rxn', wide: true },
      { previewLatex: '\\ce{HCl + NaOH -> NaCl + H2O}', insertLatex: '\\ce{HCl + NaOH -> NaCl + H2O}', hintKm: 'បន្សាបអាស៊ីត-បាស', hintEn: 'Neutralization', wide: true },
      { previewLatex: '\\ce{N2 + 3H2 <=> 2NH3}', insertLatex: '\\ce{N2 + 3H2 <=> 2NH3}', hintKm: 'សំយោគអាម៉ូញាក់', hintEn: 'Haber rxn', wide: true },
      { previewLatex: '\\ce{Fe + 2HCl -> FeCl2 + H2 ^}', insertLatex: '\\ce{Fe + 2HCl -> FeCl2 + H2 ^}', hintKm: 'លោហៈ + អាស៊ីត', hintEn: 'Metal + Acid', wide: true },
      { previewLatex: '\\ce{3Cu + 8HNO3 -> 3Cu(NO3)2 + 2NO ^ + 4H2O}', insertLatex: '\\ce{3Cu + 8HNO3 -> 3Cu(NO3)2 + 2NO ^ + 4H2O}', hintKm: 'Cu + HNO₃', hintEn: 'Redox Cu/HNO₃', wide: true },
    ],
  },
];

const SYMBOL_GROUPS: MathTypeGroup[] = [
  {
    titleKm: 'អក្សរក្រិកតូច (Lowercase Greek)',
    titleEn: 'Lowercase Greek Letters',
    items: [
      { previewLatex: '\\alpha', insertLatex: '\\alpha', hintKm: 'អាល់ហ្វា', hintEn: 'alpha' },
      { previewLatex: '\\beta', insertLatex: '\\beta', hintKm: 'បេតា', hintEn: 'beta' },
      { previewLatex: '\\gamma', insertLatex: '\\gamma', hintKm: 'ហ្គាម៉ា', hintEn: 'gamma' },
      { previewLatex: '\\delta', insertLatex: '\\delta', hintKm: 'ដែលតាតូច', hintEn: 'delta' },
      { previewLatex: '\\varepsilon', insertLatex: '\\varepsilon', hintKm: 'អិបស៊ីឡូន', hintEn: 'epsilon' },
      { previewLatex: '\\theta', insertLatex: '\\theta', hintKm: 'តេតា', hintEn: 'theta' },
      { previewLatex: '\\lambda', insertLatex: '\\lambda', hintKm: 'ឡាំដា', hintEn: 'lambda' },
      { previewLatex: '\\mu', insertLatex: '\\mu', hintKm: 'មីញ', hintEn: 'mu' },
      { previewLatex: '\\pi', insertLatex: '\\pi', hintKm: 'ផៃ', hintEn: 'pi' },
      { previewLatex: '\\rho', insertLatex: '\\rho', hintKm: 'រ៉ូ', hintEn: 'rho' },
      { previewLatex: '\\sigma', insertLatex: '\\sigma', hintKm: 'ស៊ីកម៉ាតូច', hintEn: 'sigma' },
      { previewLatex: '\\tau', insertLatex: '\\tau', hintKm: 'តូ', hintEn: 'tau' },
      { previewLatex: '\\phi', insertLatex: '\\phi', hintKm: 'ហ្វី', hintEn: 'phi' },
      { previewLatex: '\\omega', insertLatex: '\\omega', hintKm: 'អូមេហ្គាតូច', hintEn: 'omega' },
    ],
  },
  {
    titleKm: 'អក្សរក្រិកធំ & ធរណីមាត្រ (Uppercase Greek & Geometry)',
    titleEn: 'Uppercase Greek & Geometry',
    items: [
      { previewLatex: '\\Delta', insertLatex: '\\Delta', hintKm: 'ដែលតា Δ', hintEn: 'Delta' },
      { previewLatex: '\\Sigma', insertLatex: '\\Sigma', hintKm: 'ស៊ីកម៉ា Σ', hintEn: 'Sigma' },
      { previewLatex: '\\Omega', insertLatex: '\\Omega', hintKm: 'អូមេហ្គា Ω', hintEn: 'Omega' },
      { previewLatex: '\\Phi', insertLatex: '\\Phi', hintKm: 'ហ្វីធំ Φ', hintEn: 'Phi' },
      { previewLatex: '\\Psi', insertLatex: '\\Psi', hintKm: 'ស៊ី Ψ', hintEn: 'Psi' },
      { previewLatex: '\\Pi', insertLatex: '\\Pi', hintKm: 'ផៃធំ Π', hintEn: 'Pi' },
      { previewLatex: '\\angle', insertLatex: '\\angle ', hintKm: 'មុំ ∠', hintEn: 'Angle' },
      { previewLatex: '\\triangle', insertLatex: '\\triangle ', hintKm: 'ត្រីកោណ △', hintEn: 'Triangle' },
      { previewLatex: '\\perp', insertLatex: '\\perp ', hintKm: 'កែង ⊥', hintEn: 'Perpendicular' },
      { previewLatex: '\\parallel', insertLatex: '\\parallel ', hintKm: 'ស្រប ∥', hintEn: 'Parallel' },
      { previewLatex: '\\cong', insertLatex: '\\cong ', hintKm: 'ប៉ុនគ្នា ≅', hintEn: 'Congruent' },
      { previewLatex: '\\sim', insertLatex: '\\sim ', hintKm: 'ដូចគ្នា ∼', hintEn: 'Similar' },
      { previewLatex: '\\forall', insertLatex: '\\forall ', hintKm: 'ចំពោះគ្រប់ ∀', hintEn: 'For all' },
      { previewLatex: '\\exists', insertLatex: '\\exists ', hintKm: 'មាន ∃', hintEn: 'Exists' },
      { previewLatex: '\\therefore', insertLatex: '\\therefore ', hintKm: 'ដូចនេះ ∴', hintEn: 'Therefore' },
      { previewLatex: '\\mathbb{R}', insertLatex: '\\mathbb{R}', hintKm: 'ចំនួនពិត ℝ', hintEn: 'Reals ℝ' },
    ],
  },
];

function renderTileKatex(latex: string): string {
  try {
    return katex.renderToString(latex, {
      displayMode: false,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch {
    return latex;
  }
}

/**
 * Normalizes MathLive LaTeX output so KaTeX + mhchem renders 100% cleanly everywhere.
 */
function normalizeMathLiveLatex(raw: string): string {
  return raw
    .replace(/\\placeholder\{[^}]*\}/g, '\\square')
    .replace(/\\differentialD\b/g, 'd')
    .replace(/\\exponentialE\b/g, 'e')
    .replace(/\\imaginaryI\b/g, 'i')
    .replace(/\\exponential\b/g, 'e')
    .trim();
}

export interface StemFormulaEditorModalProps {
  open: boolean;
  language: Language;
  accentColor: string;
  targetLabel?: string;
  initialLatex?: string;
  defaultCategory?: FormulaCategoryId;
  onClose: () => void;
  onInsert: (formattedFormula: string) => void;
  onOpenGraphStudio?: () => void;
}

export function StemFormulaEditorModal(props: StemFormulaEditorModalProps) {
  if (!props.open) return null;
  return <StemFormulaEditorModalInner {...props} />;
}

function StemFormulaEditorModalInner({
  language,
  accentColor,
  targetLabel,
  initialLatex = '',
  defaultCategory = 'mathtype',
  onClose,
  onInsert,
  onOpenGraphStudio,
}: StemFormulaEditorModalProps) {
  const km = language === 'km';
  const [category, setCategory] = useState<FormulaCategoryId>(defaultCategory);
  const [latex, setLatex] = useState(() =>
    initialLatex.replace(/^\$\$?/, '').replace(/\$\$?$/, '').trim()
  );
  const [displayBlock, setDisplayBlock] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRawLatex, setShowRawLatex] = useState(false);
  const [mathfieldReady, setMathfieldReady] = useState(false);

  // Custom Matrix / Determinant / System builder controls
  const [customStyle, setCustomStyle] = useState<
    | 'pmatrix'
    | 'bmatrix'
    | 'vmatrix'
    | 'Vmatrix'
    | 'Bmatrix'
    | 'matrix'
    | 'aug-p'
    | 'aug-b'
    | 'cases'
    | 'lbracket-sys'
  >('pmatrix');
  const [customRows, setCustomRows] = useState(3);
  const [customCols, setCustomCols] = useState(3);

  const mountHostRef = useRef<HTMLDivElement | null>(null);
  const mfRef = useRef<MathfieldElement | null>(null);
  const confirmRef = useRef<() => void>(() => {});

  const handleConfirmInsert = useCallback(() => {
    const raw = mfRef.current ? mfRef.current.getValue('latex') : latex;
    const cleaned = normalizeMathLiveLatex(
      raw.replace(/^\$\$?/, '').replace(/\$\$?$/, '')
    );
    if (!cleaned) return;
    const wrapped = displayBlock ? `$$${cleaned}$$` : `$${cleaned}$`;
    onInsert(wrapped);
    if (mfRef.current) {
      mfRef.current.setValue('');
    }
    setLatex('');
    onClose();
  }, [displayBlock, latex, onClose, onInsert]);

  useEffect(() => {
    confirmRef.current = handleConfirmInsert;
  }, [handleConfirmInsert]);

  // Mount MathLive <math-field> programmatically (client-only, zero SSR errors, 100% offline fonts)
  useEffect(() => {
    let cancelled = false;
    let mfInstance: MathfieldElement | null = null;
    const hostEl = mountHostRef.current;

    const initMathField = async () => {
      try {
        const mod = await import('mathlive');
        if (cancelled || !hostEl) return;

        const MathfieldCtor = mod.MathfieldElement;
        // Use KaTeX fonts already bundled on the page via katex/dist/katex.min.css
        MathfieldCtor.fontsDirectory = null;
        MathfieldCtor.soundsDirectory = null;

        const mf = new MathfieldCtor();
        mf.className = 'mathtype-canvas';
        mf.mathVirtualKeyboardPolicy = 'manual';
        mf.smartFence = true;
        mf.smartSuperscript = true;
        mf.removeExtraneousParentheses = true;
        mf.setAttribute(
          'aria-label',
          km ? 'ប្រអប់សរសេររូបមន្ត MathType' : 'MathType Equation Canvas'
        );

        const initialClean = initialLatex
          .replace(/^\$\$?/, '')
          .replace(/\$\$?$/, '')
          .trim();
        if (initialClean) {
          mf.setValue(initialClean);
        }

        const handleInput = () => {
          setLatex(mf.getValue('latex'));
        };

        const handleKeyDown = (ev: KeyboardEvent) => {
          if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
            ev.preventDefault();
            confirmRef.current();
          }
        };

        mf.addEventListener('input', handleInput);
        mf.addEventListener('keydown', handleKeyDown);

        hostEl.innerHTML = '';
        hostEl.appendChild(mf);
        mfInstance = mf;
        mfRef.current = mf;
        setMathfieldReady(true);

        requestAnimationFrame(() => {
          if (!cancelled) mf.focus();
        });
      } catch {
        if (!cancelled) setMathfieldReady(false);
      }
    };

    initMathField();

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined' && window.mathVirtualKeyboard) {
        try {
          window.mathVirtualKeyboard.hide();
        } catch {
          // Ignore virtual keyboard cleanup error
        }
      }
      if (mfInstance && hostEl && hostEl.contains(mfInstance)) {
        hostEl.removeChild(mfInstance);
      }
      mfRef.current = null;
    };
  }, [initialLatex, km]);

  const groups = useMemo(() => {
    const raw =
      category === 'mathtype'
        ? MATHTYPE_CORE_GROUPS
        : category === 'math'
          ? MATH_FORMULA_GROUPS
          : category === 'physics'
            ? PHYSICS_GROUPS
            : category === 'chemistry'
              ? CHEMISTRY_GROUPS
              : SYMBOL_GROUPS;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return raw;

    return raw
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            item.insertLatex.toLowerCase().includes(q) ||
            item.hintKm.toLowerCase().includes(q) ||
            item.hintEn.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [category, searchQuery]);

  const renderedGroups = useMemo(
    () =>
      groups.map((g) => ({
        ...g,
        items: g.items.map((item) => ({
          ...item,
          html: renderTileKatex(item.previewLatex),
        })),
      })),
    [groups]
  );

  if (!open) return null;

  const insertTemplate = (tile: MathTypeTile) => {
    const mf = mfRef.current;
    if (!mf) {
      setLatex((prev) => prev + tile.insertLatex.replace(/#\?/g, ''));
      return;
    }

    let snippet = tile.insertLatex;
    if (tile.attachToPrev) {
      const currentVal = mf.getValue('latex').trim();
      const needsBaseBox =
        !currentVal || /[+\-=<>,([{\s]$/.test(currentVal);
      if (needsBaseBox) {
        snippet = `#?${snippet}`;
      }
    }

    mf.focus();
    mf.insert(snippet, {
      focus: true,
      selectionMode: 'placeholder',
    });
    setLatex(mf.getValue('latex'));
  };

  const handleInsertCustomGrid = () => {
    const r = Math.min(6, Math.max(1, customRows));
    const c = Math.min(6, Math.max(1, customCols));

    let insertLatex = '';
    if (customStyle === 'cases') {
      const rows = Array.from({ length: Math.max(2, r) }, () => '#?').join(' \\\\ ');
      insertLatex = `\\begin{cases} ${rows} \\end{cases}`;
    } else if (customStyle === 'lbracket-sys') {
      const rows = Array.from({ length: Math.max(2, r) }, () => '#?').join(' \\\\ ');
      insertLatex = `\\left[\\begin{array}{l} ${rows} \\end{array}\\right.`;
    } else if (customStyle === 'aug-p' || customStyle === 'aug-b') {
      const totalCols = Math.max(2, c);
      const spec = `${'c'.repeat(totalCols - 1)}|c`;
      const rowStr = Array.from({ length: totalCols }, () => '#?').join(' & ');
      const body = Array.from({ length: r }, () => rowStr).join(' \\\\ ');
      const leftDelim = customStyle === 'aug-p' ? '(' : '[';
      const rightDelim = customStyle === 'aug-p' ? ')' : ']';
      insertLatex = `\\left${leftDelim}\\begin{array}{${spec}} ${body} \\end{array}\\right${rightDelim}`;
    } else {
      const rowStr = Array.from({ length: c }, () => '#?').join(' & ');
      const body = Array.from({ length: r }, () => rowStr).join(' \\\\ ');
      insertLatex = `\\begin{${customStyle}} ${body} \\end{${customStyle}}`;
    }

    insertTemplate({
      previewLatex: '',
      insertLatex,
      hintKm: 'បង្កើតផ្ទាល់ខ្លួន',
      hintEn: 'Custom Grid',
    });
  };

  const handleToggleVirtualKeyboard = () => {
    const mf = mfRef.current;
    if (!mf || typeof window === 'undefined' || !window.mathVirtualKeyboard) return;
    mf.focus();
    if (window.mathVirtualKeyboard.visible) {
      window.mathVirtualKeyboard.hide();
    } else {
      window.mathVirtualKeyboard.show();
    }
  };

  const tabs: {
    id: FormulaCategoryId;
    labelKm: string;
    labelEn: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'mathtype', labelKm: 'MathType ប្រអប់', labelEn: 'MathType', icon: Grid2x2 },
    { id: 'math', labelKm: 'គណិតវិទ្យា', labelEn: 'Math', icon: Sigma },
    { id: 'physics', labelKm: 'រូបវិទ្យា', labelEn: 'Physics', icon: Atom },
    { id: 'chemistry', labelKm: 'គីមីវិទ្យា', labelEn: 'Chemistry', icon: FlaskConical },
    { id: 'symbols', labelKm: 'ក្រិក & សញ្ញា', labelEn: 'Symbols', icon: Sparkles },
  ];

  const hasContent = normalizeMathLiveLatex(latex).length > 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={km ? 'MathType កម្មវិធីសរសេររូបមន្ត' : 'MathType Equation Studio'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[92dvh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Accent & Clean Header */}
        <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: accentColor }} />
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs"
              style={{ backgroundColor: accentColor }}
            >
              <Sigma className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {km
                  ? 'MathType — សរសេររូបមន្ត គណិតវិទ្យា · រូបវិទ្យា · គីមីវិទ្យា'
                  : 'MathType — Math · Physics · Chemistry Studio'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {targetLabel
                  ? km
                    ? `បញ្ចូលទៅក្នុង៖ ${targetLabel}`
                    : `Inserting into: ${targetLabel}`
                  : km
                    ? 'ចុចប្រអប់រូបមន្ត រួចវាយលេខផ្ទាល់ក្នុងប្រអប់ □ ដូច MathType'
                    : 'Click any template and type directly inside the visual □ boxes'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={km ? 'បិទ' : 'Close'}
            className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PINNED MATHTYPE VISUAL WYSIWYG PAPER CANVAS */}
        <div className="px-4 sm:px-5 pt-3.5 pb-3 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0">
          <div className="relative rounded-xl bg-white dark:bg-slate-900 border-2 border-blue-500/40 dark:border-blue-400/35 focus-within:border-blue-600 dark:focus-within:border-blue-400 shadow-xs transition-colors overflow-x-auto">
            {!hasContent && mathfieldReady && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xs sm:text-sm text-slate-400 dark:text-slate-500 select-none">
                {km
                  ? 'ចុចទីនេះដើម្បីវាយលេខ ឬជ្រើសរើសប្រអប់រូបមន្ត MathType ខាងក្រោម (ឧ. ប្រភាគ □/□ ឫស √□ ប្រតិកម្មគីមី)...'
                  : 'Click here to type or select any MathType box below (e.g. □/□, √□, ∫, Chemistry reaction)...'}
              </div>
            )}
            <div ref={mountHostRef} className="min-h-[92px] w-full" />
          </div>

          {/* Tactile MathType Canvas Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  mfRef.current?.executeCommand('undo');
                  mfRef.current?.focus();
                  if (mfRef.current) setLatex(mfRef.current.getValue('latex'));
                }}
                title={km ? 'ត្រឡប់ក្រោយ (Undo)' : 'Undo'}
                className="min-h-[34px] min-w-[34px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center justify-center cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  mfRef.current?.executeCommand('redo');
                  mfRef.current?.focus();
                  if (mfRef.current) setLatex(mfRef.current.getValue('latex'));
                }}
                title={km ? 'ទៅមុខវិញ (Redo)' : 'Redo'}
                className="min-h-[34px] min-w-[34px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center justify-center cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

              <button
                type="button"
                onClick={() => {
                  mfRef.current?.executeCommand('moveToPreviousPlaceholder');
                  mfRef.current?.focus();
                }}
                title={km ? 'ផ្លាស់ទីទៅប្រអប់មុន (Shift+Tab)' : 'Previous box (Shift+Tab)'}
                className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{km ? 'ប្រអប់មុន' : 'Prev □'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  mfRef.current?.executeCommand('moveToNextPlaceholder');
                  mfRef.current?.focus();
                }}
                title={km ? 'ផ្លាស់ទីទៅប្រអប់បន្ទាប់ (Tab)' : 'Next box (Tab)'}
                className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <span className="hidden sm:inline">{km ? 'ប្រអប់បន្ទាប់' : 'Next □'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

              <button
                type="button"
                onClick={() => {
                  mfRef.current?.executeCommand('deleteBackward');
                  mfRef.current?.focus();
                  if (mfRef.current) setLatex(mfRef.current.getValue('latex'));
                }}
                title={km ? 'លុបថយក្រោយ (Backspace)' : 'Backspace'}
                className="min-h-[34px] min-w-[34px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center justify-center cursor-pointer"
              >
                <Delete className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mfRef.current) {
                    mfRef.current.setValue('');
                    mfRef.current.focus();
                  }
                  setLatex('');
                }}
                title={km ? 'សម្អាតទាំងអស់' : 'Clear all'}
                className="min-h-[34px] min-w-[34px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center justify-center cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleVirtualKeyboard}
                title={km ? 'បើកក្តារចុចគណិតវិទ្យាលើអេក្រង់' : 'Toggle On-Screen Math Keypad'}
                className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{km ? 'ក្តារចុច' : 'Keypad'}</span>
              </button>

              {/* Inline vs Display Mode Segmented Control */}
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setDisplayBlock(false)}
                  className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    !displayBlock
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {km ? 'ក្នុងជួរ' : 'Inline'}
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayBlock(true)}
                  className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    displayBlock
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {km ? 'ជួរកណ្ដាល' : 'Center'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowRawLatex((prev) => !prev)}
                title={km ? 'បង្ហាញ / លាក់កូដ LaTeX (សម្រាប់អ្នកជំនាញ)' : 'Toggle raw LaTeX code (advanced)'}
                className={`min-h-[34px] px-2 rounded-lg border text-[11px] font-mono font-semibold inline-flex items-center gap-1 cursor-pointer ${
                  showRawLatex
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>LaTeX</span>
              </button>
            </div>
          </div>

          {/* Optional Advanced Raw LaTeX Peek Box (Hidden by Default!) */}
          {showRawLatex && (
            <input
              type="text"
              value={latex}
              onChange={(e) => {
                const nextVal = e.target.value;
                setLatex(nextVal);
                if (mfRef.current) {
                  mfRef.current.setValue(nextVal, { silenceNotifications: true });
                }
              }}
              placeholder="\\frac{a}{b}  |  \\ce{2H2 + O2 -> 2H2O}"
              className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          )}
        </div>

        {/* MATHTYPE RIBBON CATEGORY TABS + SEARCH */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategory(tab.id)}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    active
                      ? 'text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  style={active ? { backgroundColor: accentColor } : undefined}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{km ? tab.labelKm : tab.labelEn}</span>
                </button>
              );
            })}
            {onOpenGraphStudio && (
              <button
                type="button"
                onClick={onOpenGraphStudio}
                className="min-h-[34px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 whitespace-nowrap"
              >
                <Compass className="w-3.5 h-3.5 shrink-0" />
                <span>{km ? 'សង់ក្រាប 2D/3D & ធរណីមាត្រ' : '2D/3D Graphs & Geometry'}</span>
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={km ? 'ស្វែងរករូបមន្ត...' : 'Search templates...'}
              className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        {/* SCROLLABLE MATHTYPE VISUAL PALETTE */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3.5 space-y-4">
          {/* Custom Matrix / Determinant / System Builder Bar (shown on MathType tab) */}
          {category === 'mathtype' && !searchQuery.trim() && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                {km ? 'បង្កើតម៉ាទ្រីស / ប្រព័ន្ធផ្ទាល់ខ្លួន៖' : 'Custom Matrix / System:'}
              </span>

              <select
                value={customStyle}
                onChange={(e) => {
                  const next = e.target.value as
                    | 'pmatrix'
                    | 'bmatrix'
                    | 'vmatrix'
                    | 'Vmatrix'
                    | 'Bmatrix'
                    | 'matrix'
                    | 'aug-p'
                    | 'aug-b'
                    | 'cases'
                    | 'lbracket-sys';
                  setCustomStyle(next);
                  if ((next === 'cases' || next === 'lbracket-sys') && customRows < 2) {
                    setCustomRows(2);
                  }
                  if ((next === 'aug-p' || next === 'aug-b') && customCols < 2) {
                    setCustomCols(3);
                  }
                }}
                aria-label={km ? 'ប្រភេទខ្វែង' : 'Bracket style'}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
              >
                <option value="pmatrix">{km ? 'ម៉ាទ្រីសវង់ក្រចក ( )' : 'Matrix ( )'}</option>
                <option value="bmatrix">{km ? 'ម៉ាទ្រីសគ្នៀប [ ]' : 'Matrix [ ]'}</option>
                <option value="vmatrix">{km ? 'ដេទែមីណង់ | |' : 'Determinant | |'}</option>
                <option value="Vmatrix">{km ? 'របារគូ ‖ ‖' : 'Norm ‖ ‖'}</option>
                <option value="Bmatrix">{km ? 'ខ្វែងកោង { }' : 'Braces { }'}</option>
                <option value="aug-p">{km ? 'ម៉ាទ្រីសបំពេញ ( A | b )' : 'Augmented ( A | b )'}</option>
                <option value="aug-b">{km ? 'ម៉ាទ្រីសបំពេញ [ A | b ]' : 'Augmented [ A | b ]'}</option>
                <option value="matrix">{km ? 'ម៉ាទ្រីសគ្មានខ្វែង' : 'Plain Matrix'}</option>
                <option value="cases">{km ? 'ប្រព័ន្ធសមីការ {' : 'System of Equations {'}</option>
                <option value="lbracket-sys">{km ? 'ប្រព័ន្ធគ្នៀប [' : 'Bracket System ['}</option>
              </select>

              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <span>
                  {customStyle === 'cases' || customStyle === 'lbracket-sys'
                    ? km
                      ? 'ចំនួនសមីការ'
                      : 'Equations'
                    : km
                      ? 'ជួរដេក'
                      : 'Rows'}
                </span>
                <select
                  value={customRows}
                  onChange={(e) => setCustomRows(Number(e.target.value))}
                  className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  {(customStyle === 'cases' || customStyle === 'lbracket-sys'
                    ? [2, 3, 4, 5, 6]
                    : [1, 2, 3, 4, 5, 6]
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              {customStyle !== 'cases' && customStyle !== 'lbracket-sys' && (
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <span>×</span>
                  <span>{km ? 'ជួរឈរ' : 'Cols'}</span>
                  <select
                    value={customCols}
                    onChange={(e) => setCustomCols(Number(e.target.value))}
                    className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    {(customStyle === 'aug-p' || customStyle === 'aug-b'
                      ? [2, 3, 4, 5, 6]
                      : [1, 2, 3, 4, 5, 6]
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                type="button"
                onClick={handleInsertCustomGrid}
                className="h-8 px-3 rounded-lg text-white text-xs font-semibold inline-flex items-center gap-1 shadow-xs hover:opacity-95 cursor-pointer whitespace-nowrap"
                style={{ backgroundColor: accentColor }}
              >
                <Grid2x2 className="w-3.5 h-3.5" />
                <span>{km ? 'ដាក់ចូលប្រអប់' : 'Insert Grid'}</span>
              </button>
            </div>
          )}

          {renderedGroups.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              {km ? 'រកមិនឃើញរូបមន្តដែលត្រូវគ្នាទេ' : 'No matching templates found'}
            </p>
          ) : (
            renderedGroups.map((group) => (
              <div key={group.titleEn} className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {km ? group.titleKm : group.titleEn}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((item, idx) => (
                    <button
                      key={`${group.titleEn}_${idx}`}
                      type="button"
                      onClick={() => insertTemplate(item)}
                      title={km ? item.hintKm : item.hintEn}
                      className={`group min-h-[54px] ${
                        item.wide ? 'min-w-[116px] px-3' : 'min-w-[68px] px-2.5'
                      } py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/70 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer`}
                    >
                      <span
                        className="text-sm sm:text-[15px] text-slate-900 dark:text-slate-100 leading-none"
                        dangerouslySetInnerHTML={{ __html: item.html }}
                      />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-300 truncate max-w-[155px]">
                        {km ? item.hintKm : item.hintEn}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Action Bar */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {km
              ? 'ចុច Tab ឬព្រួញ ← → ដើម្បីផ្លាស់ទីប្រអប់ □ · Ctrl+Enter ដើម្បីបញ្ចូលភ្លាម'
              : 'Press Tab / Arrow keys to jump between □ boxes · Ctrl+Enter to insert'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              {km ? 'បោះបង់' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={!hasContent}
              onClick={handleConfirmInsert}
              className="min-h-[40px] px-5 rounded-xl text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm hover:opacity-95 disabled:opacity-40 cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              <Check className="w-4 h-4" />
              <span>{km ? 'បញ្ចូលរូបមន្ត' : 'Insert Formula'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
