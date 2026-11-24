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
    titleKm: 'លីមីត ដេរីវេ អាំងតេក្រាល ប្រព័ន្ធសមីការ & ម៉ាទ្រីស',
    titleEn: 'Limits, Calculus, Systems & Matrices',
    items: [
      { previewLatex: '\\lim_{\\square \\to \\square}\\square', insertLatex: '\\lim_{#? \\to #?}{#?}', hintKm: 'លីមីត', hintEn: 'Limit', wide: true },
      { previewLatex: '\\int_{\\square}^{\\square}\\square\\,dx', insertLatex: '\\int_{#?}^{#?}{#?}\\,dx', hintKm: 'អាំងតេក្រាលកំណត់', hintEn: 'Definite Integral', wide: true },
      { previewLatex: '\\int \\square\\,dx', insertLatex: '\\int {#?}\\,dx', hintKm: 'អាំងតេក្រាល', hintEn: 'Integral' },
      { previewLatex: '\\frac{d}{dx}\\square', insertLatex: '\\frac{d}{dx}\\left(#?\\right)', hintKm: 'ដេរីវេ d/dx', hintEn: 'Derivative' },
      { previewLatex: '\\frac{\\partial \\square}{\\partial \\square}', insertLatex: '\\frac{\\partial #?}{\\partial #?}', hintKm: 'ដេរីវេដោយផ្នែក', hintEn: 'Partial' },
      { previewLatex: '\\sum_{\\square}^{\\square}\\square', insertLatex: '\\sum_{#?=#?}^{#?}{#?}', hintKm: 'ផលបូក ∑', hintEn: 'Summation' },
      { previewLatex: '\\prod_{\\square}^{\\square}\\square', insertLatex: '\\prod_{#?=#?}^{#?}{#?}', hintKm: 'ផលគុណ ∏', hintEn: 'Product' },
      { previewLatex: '\\binom{\\square}{\\square}', insertLatex: '\\binom{#?}{#?}', hintKm: 'បន្សំ C(n,k)', hintEn: 'Binomial' },
      {
        previewLatex: '\\begin{cases}\\square\\\\ \\square\\end{cases}',
        insertLatex: '\\begin{cases} #? \\\\ #? \\end{cases}',
        hintKm: 'ប្រព័ន្ធសមីការ',
        hintEn: 'System',
        wide: true,
      },
      {
        previewLatex: '\\begin{pmatrix}\\square & \\square\\\\ \\square & \\square\\end{pmatrix}',
        insertLatex: '\\begin{pmatrix} #? & #? \\\\ #? & #? \\end{pmatrix}',
        hintKm: 'ម៉ាទ្រីស 2×2',
        hintEn: '2×2 Matrix',
        wide: true,
      },
      {
        previewLatex: '\\begin{pmatrix}\\square & \\square & \\square\\\\ \\square & \\square & \\square\\end{pmatrix}',
        insertLatex: '\\begin{pmatrix} #? & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #? \\end{pmatrix}',
        hintKm: 'ម៉ាទ្រីស 3×3',
        hintEn: '3×3 Matrix',
        wide: true,
      },
      {
        previewLatex: '\\begin{vmatrix}\\square & \\square\\\\ \\square & \\square\\end{vmatrix}',
        insertLatex: '\\begin{vmatrix} #? & #? \\\\ #? & #? \\end{vmatrix}',
        hintKm: 'ដេទែមីណង់',
        hintEn: 'Determinant',
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
    titleKm: 'មេកានិច ចលនា & ថាមពល (Mechanics)',
    titleEn: 'Mechanics, Kinematics & Energy',
    items: [
      { previewLatex: '\\vec{F} = m\\vec{a}', insertLatex: '\\vec{F} = m\\vec{a}', hintKm: 'ច្បាប់ញូតុនទី២', hintEn: 'Newton II' },
      { previewLatex: 'v = v_0 + at', insertLatex: 'v = v_{0} + at', hintKm: 'ល្បឿន', hintEn: 'Velocity' },
      { previewLatex: 'x = x_0 + v_0 t + \\frac{1}{2}at^2', insertLatex: 'x = x_{0} + v_{0}t + \\frac{1}{2}at^{2}', hintKm: 'សមីការចលនា', hintEn: 'Position', wide: true },
      { previewLatex: 'v^2 - v_0^2 = 2as', insertLatex: 'v^{2} - v_{0}^{2} = 2as', hintKm: 'ទំនាក់ទំនងល្បឿន', hintEn: 'Torricelli', wide: true },
      { previewLatex: 'E_k = \\frac{1}{2}mv^2', insertLatex: 'E_{k} = \\frac{1}{2}mv^{2}', hintKm: 'ថាមពលស៊ីនេទិច', hintEn: 'Kinetic E', wide: true },
      { previewLatex: 'E_p = mgh', insertLatex: 'E_{p} = mgh', hintKm: 'ថាមពលប៉ូតង់ស្យែល', hintEn: 'Potential E' },
      { previewLatex: 'F = G\\frac{m_1 m_2}{r^2}', insertLatex: 'F = G\\frac{m_{1}m_{2}}{r^{2}}', hintKm: 'ទំនាញសកល', hintEn: 'Gravity', wide: true },
      { previewLatex: 'T = 2\\pi\\sqrt{\\frac{l}{g}}', insertLatex: 'T = 2\\pi\\sqrt{\\frac{l}{g}}', hintKm: 'ខួបប៉ោល', hintEn: 'Pendulum', wide: true },
      { previewLatex: 'P = \\frac{W}{t}', insertLatex: 'P = \\frac{W}{t}', hintKm: 'អានុភាព', hintEn: 'Power' },
      { previewLatex: '\\rho = \\frac{m}{V}', insertLatex: '\\rho = \\frac{m}{V}', hintKm: 'ម៉ាសមាឌ', hintEn: 'Density' },
    ],
  },
  {
    titleKm: 'អគ្គិសនី ម៉ាញេទិច រលក អុបទិច & ទែម៉ូឌីណាមិច',
    titleEn: 'Electricity, Magnetism, Waves & Thermo',
    items: [
      { previewLatex: 'U = I R', insertLatex: 'U = IR', hintKm: 'ច្បាប់អូម', hintEn: "Ohm's law" },
      { previewLatex: 'P = U I = I^2 R', insertLatex: 'P = UI = I^{2}R', hintKm: 'អានុភាពអគ្គិសនី', hintEn: 'Elec. Power', wide: true },
      { previewLatex: 'F = k\\frac{|q_1 q_2|}{r^2}', insertLatex: 'F = k\\frac{|q_{1}q_{2}|}{r^{2}}', hintKm: 'ច្បាប់គូឡុំ', hintEn: 'Coulomb', wide: true },
      { previewLatex: '\\frac{1}{R_{eq}} = \\frac{1}{R_1} + \\frac{1}{R_2}', insertLatex: '\\frac{1}{R_{eq}} = \\frac{1}{R_{1}} + \\frac{1}{R_{2}}', hintKm: 'រេស៊ីស្តង់ខ្នែង', hintEn: 'Parallel R', wide: true },
      { previewLatex: 'F = qvB\\sin\\theta', insertLatex: 'F = qvB\\sin\\theta', hintKm: 'កម្លាំងឡូរិន', hintEn: 'Lorentz', wide: true },
      { previewLatex: 'v = \\lambda f', insertLatex: 'v = \\lambda f', hintKm: 'ល្បឿនរលក', hintEn: 'Wave speed' },
      { previewLatex: '\\frac{1}{f} = \\frac{1}{d} + \\frac{1}{d\'}', insertLatex: '\\frac{1}{f} = \\frac{1}{d} + \\frac{1}{d\'}', hintKm: 'ឡង់ទីស្តើង', hintEn: 'Thin lens', wide: true },
      { previewLatex: 'n_1\\sin i = n_2\\sin r', insertLatex: 'n_{1}\\sin i = n_{2}\\sin r', hintKm: 'ចំណាំងបែរ', hintEn: 'Snell law', wide: true },
      { previewLatex: 'PV = nRT', insertLatex: 'PV = nRT', hintKm: 'ឧស្ម័នបរិសុទ្ធ', hintEn: 'Ideal gas' },
      { previewLatex: 'Q = mc\\Delta T', insertLatex: 'Q = mc\\Delta T', hintKm: 'បរិមាណកម្តៅ', hintEn: 'Heat Q', wide: true },
      { previewLatex: 'E = hf = \\frac{hc}{\\lambda}', insertLatex: 'E = hf = \\frac{hc}{\\lambda}', hintKm: 'ថាមពលផូតុង', hintEn: 'Photon E', wide: true },
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
      { previewLatex: '\\pu{^\\circ C}', insertLatex: '\\,\\pu{^\\circ C}', hintKm: 'អង្សាសេ', hintEn: '°C' },
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
    titleKm: 'រូបមន្តគណនាគីមី (pH, ម៉ូល, កំហាប់)',
    titleEn: 'Chemistry Calculation Formulas',
    items: [
      { previewLatex: 'n = \\frac{m}{M}', insertLatex: 'n = \\frac{m}{M}', hintKm: 'ចំនួនម៉ូល', hintEn: 'Moles' },
      { previewLatex: 'C_M = \\frac{n}{V}', insertLatex: 'C_{M} = \\frac{n}{V}', hintKm: 'កំហាប់ម៉ូល', hintEn: 'Molarity' },
      { previewLatex: 'n = \\frac{V}{V_m}', insertLatex: 'n = \\frac{V}{V_{m}}', hintKm: 'ម៉ូលឧស្ម័ន', hintEn: 'Gas moles' },
      { previewLatex: 'C_1 V_1 = C_2 V_2', insertLatex: 'C_{1}V_{1} = C_{2}V_{2}', hintKm: 'ការពង្រាវ', hintEn: 'Dilution', wide: true },
      { previewLatex: '\\text{pH} = -\\log\\left[\\ce{H3O+}\\right]', insertLatex: '\\text{pH} = -\\log\\left[\\ce{H3O+}\\right]', hintKm: 'រូបមន្ត pH', hintEn: 'pH formula', wide: true },
      { previewLatex: '\\text{pH} + \\text{pOH} = 14', insertLatex: '\\text{pH} + \\text{pOH} = 14', hintKm: 'pH + pOH', hintEn: 'pH+pOH', wide: true },
      { previewLatex: 'K_c = \\frac{[\\ce{C}]^c[\\ce{D}]^d}{[\\ce{A}]^a[\\ce{B}]^b}', insertLatex: 'K_{c} = \\frac{[\\ce{C}]^{c}[\\ce{D}]^{d}}{[\\ce{A}]^{a}[\\ce{B}]^{b}}', hintKm: 'ថេរលំនឹង Kc', hintEn: 'Equil. Kc', wide: true },
      { previewLatex: '\\pu{mol/L}', insertLatex: '\\,\\pu{mol/L}', hintKm: 'ខ្នាត mol/L', hintEn: 'mol/L' },
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
