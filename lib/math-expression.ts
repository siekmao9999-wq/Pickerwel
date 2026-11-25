export type MathVars = {
  x?: number;
  y?: number;
  t?: number;
};

type Token =
  | { type: 'num'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' };

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sin: (a) => Math.sin(a),
  cos: (a) => Math.cos(a),
  tan: (a) => Math.tan(a),
  cot: (a) => 1 / Math.tan(a),
  sec: (a) => 1 / Math.cos(a),
  csc: (a) => 1 / Math.sin(a),
  asin: (a) => Math.asin(a),
  acos: (a) => Math.acos(a),
  atan: (a) => Math.atan(a),
  sinh: (a) => Math.sinh(a),
  cosh: (a) => Math.cosh(a),
  tanh: (a) => Math.tanh(a),
  sqrt: (a) => Math.sqrt(a),
  cbrt: (a) => Math.cbrt(a),
  abs: (a) => Math.abs(a),
  ln: (a) => Math.log(a),
  log: (a) => Math.log10(a),
  log10: (a) => Math.log10(a),
  log2: (a) => Math.log2(a),
  exp: (a) => Math.exp(a),
  floor: (a) => Math.floor(a),
  ceil: (a) => Math.ceil(a),
  round: (a) => Math.round(a),
  sign: (a) => Math.sign(a),
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
};

type AstNode =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: 'x' | 'y' | 't' }
  | { kind: 'unary'; op: '+' | '-'; arg: AstNode }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: AstNode; right: AstNode }
  | { kind: 'call'; name: string; args: AstNode[] };

function normalizeInput(raw: string): string {
  return raw
    .trim()
    .replace(/^[yzf]\s*(\(\s*x\s*(,\s*y\s*)?\))?\s*=\s*/i, '')
    .replace(/π/g, 'pi')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−|–|—/g, '-')
    .replace(/\*\*/g, '^')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3');
}

function tokenize(input: string): Token[] {
  const rawTokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let dotSeen = false;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        if (input[i] === '.') {
          if (dotSeen) break;
          dotSeen = true;
        }
        numStr += input[i++];
      }
      const value = Number(numStr);
      if (!Number.isFinite(value)) throw new Error('Invalid number');
      rawTokens.push({ type: 'num', value });
      continue;
    }

    if (/[a-zA-Z]/.test(ch)) {
      let word = '';
      while (i < input.length && /[a-zA-Z0-9]/.test(input[i])) {
        word += input[i++];
      }
      const lower = word.toLowerCase();
      if (lower in FUNCTIONS || lower in CONSTANTS || lower === 'x' || lower === 'y' || lower === 't') {
        rawTokens.push({ type: 'ident', value: lower });
      } else {
        // Support implicit multi-letter products like "xy", "xsin", "2xy"
        let j = 0;
        while (j < lower.length) {
          const rest = lower.slice(j);
          const matchedFn = Object.keys(FUNCTIONS)
            .sort((a, b) => b.length - a.length)
            .find((fn) => rest.startsWith(fn));
          if (matchedFn) {
            rawTokens.push({ type: 'ident', value: matchedFn });
            j += matchedFn.length;
            continue;
          }
          if (rest.startsWith('pi')) {
            rawTokens.push({ type: 'ident', value: 'pi' });
            j += 2;
            continue;
          }
          const c = rest[0];
          if (c === 'x' || c === 'y' || c === 't' || c === 'e') {
            rawTokens.push({ type: 'ident', value: c });
            j += 1;
            continue;
          }
          throw new Error(`Unknown token: ${word}`);
        }
      }
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      rawTokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '(' || ch === '[') {
      rawTokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')' || ch === ']') {
      rawTokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (ch === ',') {
      rawTokens.push({ type: 'comma' });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: ${ch}`);
  }

  // Insert implicit multiplication tokens where appropriate (e.g. 2x, 2sin(x), (x+1)(x-1), x(y+1))
  const tokens: Token[] = [];
  for (let k = 0; k < rawTokens.length; k++) {
    const cur = rawTokens[k];
    const prev = tokens[tokens.length - 1];
    if (prev) {
      const prevIsValue =
        prev.type === 'num' ||
        prev.type === 'rparen' ||
        (prev.type === 'ident' && !(prev.value in FUNCTIONS));
      const curStartsValue =
        cur.type === 'num' || cur.type === 'ident' || cur.type === 'lparen';
      if (prevIsValue && curStartsValue) {
        tokens.push({ type: 'op', value: '*' });
      }
    }
    tokens.push(cur);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  parse(): AstNode {
    const node = this.parseAddSub();
    if (this.pos < this.tokens.length) {
      throw new Error('Unexpected trailing input');
    }
    return node;
  }

  private parseAddSub(): AstNode {
    let left = this.parseMulDiv();
    while (true) {
      const tok = this.peek();
      if (tok && tok.type === 'op' && (tok.value === '+' || tok.value === '-')) {
        this.consume();
        const right = this.parseMulDiv();
        left = { kind: 'binary', op: tok.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseMulDiv(): AstNode {
    let left = this.parseUnary();
    while (true) {
      const tok = this.peek();
      if (tok && tok.type === 'op' && (tok.value === '*' || tok.value === '/')) {
        this.consume();
        const right = this.parseUnary();
        left = { kind: 'binary', op: tok.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): AstNode {
    const tok = this.peek();
    if (tok && tok.type === 'op' && (tok.value === '+' || tok.value === '-')) {
      this.consume();
      // Unary minus has lower precedence than power so -x^2 = -(x^2)
      const arg = this.parseUnary();
      return { kind: 'unary', op: tok.value, arg };
    }
    return this.parsePower();
  }

  private parsePower(): AstNode {
    const base = this.parsePrimary();
    const tok = this.peek();
    if (tok && tok.type === 'op' && tok.value === '^') {
      this.consume();
      const exponent = this.parseUnary();
      return { kind: 'binary', op: '^', left: base, right: exponent };
    }
    return base;
  }

  private parsePrimary(): AstNode {
    const tok = this.peek();
    if (!tok) throw new Error('Unexpected end of expression');

    if (tok.type === 'num') {
      this.consume();
      return { kind: 'num', value: tok.value };
    }

    if (tok.type === 'ident') {
      this.consume();
      if (tok.value in CONSTANTS) {
        return { kind: 'num', value: CONSTANTS[tok.value] };
      }
      if (tok.value === 'x' || tok.value === 'y' || tok.value === 't') {
        return { kind: 'var', name: tok.value };
      }
      if (tok.value in FUNCTIONS) {
        const next = this.peek();
        if (next && next.type === 'lparen') {
          this.consume();
          const args: AstNode[] = [];
          if (this.peek()?.type !== 'rparen') {
            args.push(this.parseAddSub());
            while (this.peek()?.type === 'comma') {
              this.consume();
              args.push(this.parseAddSub());
            }
          }
          if (this.peek()?.type !== 'rparen') {
            throw new Error('Missing closing parenthesis');
          }
          this.consume();
          return { kind: 'call', name: tok.value, args };
        }
        // Allow shorthand like sin x
        const arg = this.parsePower();
        return { kind: 'call', name: tok.value, args: [arg] };
      }
      throw new Error(`Unknown identifier: ${tok.value}`);
    }

    if (tok.type === 'lparen') {
      this.consume();
      const expr = this.parseAddSub();
      if (this.peek()?.type !== 'rparen') {
        throw new Error('Missing closing parenthesis');
      }
      this.consume();
      return expr;
    }

    throw new Error('Invalid expression syntax');
  }
}

function evalAst(node: AstNode, vars: MathVars): number {
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'var':
      return vars[node.name] ?? 0;
    case 'unary': {
      const v = evalAst(node.arg, vars);
      return node.op === '-' ? -v : v;
    }
    case 'binary': {
      const l = evalAst(node.left, vars);
      const r = evalAst(node.right, vars);
      switch (node.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return r === 0 ? NaN : l / r;
        case '^':
          return Math.pow(l, r);
      }
    }
    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) return NaN;
      const args = node.args.map((a) => evalAst(a, vars));
      return fn(...args);
    }
  }
}

export type CompiledMathResult =
  | { ok: true; evaluate: (vars: MathVars) => number }
  | { ok: false; error: string };

export function compileMathExpression(raw: string): CompiledMathResult {
  const normalized = normalizeInput(raw);
  if (!normalized) {
    return { ok: false, error: 'Empty expression' };
  }
  try {
    const tokens = tokenize(normalized);
    if (tokens.length === 0) return { ok: false, error: 'Empty expression' };
    const ast = new Parser(tokens).parse();
    return {
      ok: true,
      evaluate: (vars: MathVars) => {
        try {
          return evalAst(ast, vars);
        } catch {
          return NaN;
        }
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid expression',
    };
  }
}
