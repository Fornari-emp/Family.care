/**
 * Dinheiro em centavos inteiros (number). Nunca usamos float para valores.
 *
 * Corrige o bug 1 do protótipo: `parseFloat("1.000,50".replace(",", "."))` dava 1.
 */

export type Cents = number;

const THOUSANDS_GROUPED = /^\d{1,3}(\.\d{3})+$/;
const DIGITS = /^\d+$/;

/**
 * Converte um texto em formato brasileiro para centavos.
 *
 * Aceita: `1000`, `1.000`, `1.000,50`, `1000,5`, `R$ 1.000,50`, `0,99`, `,50`
 * e, por tolerância, decimal com ponto quando não há ambiguidade (`10.5`, `1000.50`).
 * Regra de ambiguidade: `2.500` é sempre dois mil e quinhentos (padrão BR).
 *
 * @returns centavos (inteiro ≥ 0) ou `null` se o texto não for um valor válido.
 */
export function parseBRL(raw: string): Cents | null {
  const text = raw.replace(/R\$/gi, '').replace(/[\s ]/g, '').trim();
  if (text === '' || !/^[\d.,]+$/.test(text)) return null;

  let intPart: string;
  let fracPart = '';

  const commaCount = (text.match(/,/g) ?? []).length;
  if (commaCount > 1) return null;

  if (commaCount === 1) {
    const [before = '', after = ''] = text.split(',');
    if (after.length === 0 || after.length > 2 || !DIGITS.test(after)) return null;
    if (before === '') {
      intPart = '0';
    } else if (before.includes('.')) {
      if (!THOUSANDS_GROUPED.test(before)) return null;
      intPart = before.replace(/\./g, '');
    } else {
      if (!DIGITS.test(before)) return null;
      intPart = before;
    }
    fracPart = after;
  } else if (text.includes('.')) {
    if (THOUSANDS_GROUPED.test(text)) {
      intPart = text.replace(/\./g, '');
    } else {
      // Um único ponto seguido de 1–2 dígitos: decimal digitado com ponto.
      const m = /^(\d+)\.(\d{1,2})$/.exec(text);
      if (!m) return null;
      intPart = m[1] ?? '0';
      fracPart = m[2] ?? '';
    }
  } else {
    intPart = text;
  }

  if (!DIGITS.test(intPart)) return null;
  const cents = Number(intPart) * 100 + Number(fracPart.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Formata centavos como `R$ 1.234,56`. Use `{ cents: false }` para `R$ 1.235`. */
export function formatBRL(cents: Cents, opts: { cents?: boolean } = {}): string {
  const showCents = opts.cents ?? true;
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  let body: string;
  if (showCents) {
    const reais = Math.floor(abs / 100);
    const frac = String(abs % 100).padStart(2, '0');
    body = `${groupThousands(reais)},${frac}`;
  } else {
    body = groupThousands(Math.round(abs / 100));
  }
  return `${negative ? '-' : ''}R$ ${body}`;
}

/**
 * Máscara de digitação estilo "caixa eletrônico": os dígitos entram pela direita
 * como centavos. `"123456"` → `{ cents: 123456, text: "1.234,56" }`.
 */
export function maskBRLInput(typed: string): { cents: Cents; text: string } {
  const digits = typed.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13);
  const cents = digits === '' ? 0 : Number(digits);
  const text = digits === '' ? '' : formatBRL(cents).replace('R$ ', '');
  return { cents, text };
}

/** Converte reais (número) em centavos, arredondando. Útil para migrações. */
export function reaisToCents(reais: number): Cents {
  return Math.round(reais * 100);
}
