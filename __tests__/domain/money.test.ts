import { formatBRL, maskBRLInput, parseBRL, reaisToCents } from '@/domain/money';

describe('parseBRL (bug 1: formato brasileiro)', () => {
  it.each([
    ['1000', 100000],
    ['1.000', 100000],
    ['1.000,50', 100050],
    ['1000,5', 100050],
    ['R$ 1.000,50', 100050],
    ['r$1.000,50', 100050],
    ['R$ 1.000,50', 100050],
    ['2.500', 250000],
    ['1.000.000', 100000000],
    ['1.234.567,89', 123456789],
    ['0,99', 99],
    [',50', 50],
    ['10.5', 1050],
    ['1000.50', 100050],
    ['  250  ', 25000],
    ['0', 0],
  ])('"%s" → %i centavos', (raw, expected) => {
    expect(parseBRL(raw)).toBe(expected);
  });

  it('não repete o bug antigo: "1.000,50" não vira 1 e "2.500" não vira 2,5', () => {
    const legacy = (raw: string) => parseFloat(raw.replace(',', '.'));
    expect(legacy('1.000,50')).toBe(1);
    expect(parseBRL('1.000,50')).toBe(100050);
    expect(legacy('2.500')).toBe(2.5);
    expect(parseBRL('2.500')).toBe(250000);
  });

  it.each([
    '',
    '   ',
    'abc',
    '-10',
    '1,000,00',
    '1,234',
    '10,',
    '1.00.000',
    '12.34.56',
    '1.0000',
    '1.2345,00',
    '1.000.0',
    '1e5',
    '1..000',
    '99999999999999999999',
  ])('rejeita "%s"', (raw) => {
    expect(parseBRL(raw)).toBeNull();
  });
});

describe('formatBRL', () => {
  it('formata com centavos', () => {
    expect(formatBRL(100050)).toBe('R$ 1.000,50');
    expect(formatBRL(5)).toBe('R$ 0,05');
    expect(formatBRL(123456789)).toBe('R$ 1.234.567,89');
    expect(formatBRL(-2500)).toBe('-R$ 25,00');
  });
  it('formata sem centavos arredondando', () => {
    expect(formatBRL(100050, { cents: false })).toBe('R$ 1.001');
    expect(formatBRL(0, { cents: false })).toBe('R$ 0');
  });
});

describe('maskBRLInput', () => {
  it('digitação entra pela direita como centavos', () => {
    expect(maskBRLInput('1')).toEqual({ cents: 1, text: '0,01' });
    expect(maskBRLInput('123456')).toEqual({ cents: 123456, text: '1.234,56' });
    expect(maskBRLInput('R$ 1.234,56')).toEqual({ cents: 123456, text: '1.234,56' });
  });
  it('vazio e zeros à esquerda', () => {
    expect(maskBRLInput('')).toEqual({ cents: 0, text: '' });
    expect(maskBRLInput('000')).toEqual({ cents: 0, text: '' });
    expect(maskBRLInput('0050')).toEqual({ cents: 50, text: '0,50' });
  });
});

it('reaisToCents arredonda', () => {
  expect(reaisToCents(10.005)).toBe(1001);
  expect(reaisToCents(0.1 + 0.2)).toBe(30);
});
