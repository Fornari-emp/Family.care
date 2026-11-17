/**
 * Paleta quente do protótipo, com os tons de texto ajustados para WCAG AA (≥ 4,5:1)
 * sobre todos os fundos (item 22). Ver `__tests__/theme/contrast.test.ts`.
 */
export const colors = {
  // fundos
  bg: '#100D0A',
  surface: '#1A1510',
  surfaceRaised: '#241B13',
  surfaceSunken: '#221A12',
  border: '#2C2318',
  borderStrong: '#3A2C1D',
  // texto
  text: '#F6EEE0',
  textMuted: '#A89679', // antes #A08E76/#8B7B65
  textSubtle: '#9C8B74', // antes #655843 / #5E5142 / #7C6C58 (contraste 2,1–3,8)
  textOnAccent: '#2A1A05',
  // acentos
  gold: '#FFC53D',
  goldLight: '#FFD766',
  orange: '#FF9F1C',
  flame: '#FF7A45',
  flameLight: '#FF9166',
  xp: '#B78BFF',
  xpDeep: '#8B5CF6',
  money: '#38E08C',
  moneySurface: '#14231C',
  moneyBorder: '#1F3A2E',
  moneyMuted: '#7E9689',
  danger: '#FF6B6B',
  white: '#FFFFFF',
  overlay: 'rgba(8,7,5,0.82)',
} as const;

/** Fundos sobre os quais aparece texto (usados no teste de contraste). */
export const TEXT_BACKGROUNDS = [
  colors.bg,
  colors.surface,
  colors.surfaceRaised,
  colors.surfaceSunken,
] as const;
export const TEXT_COLORS = {
  text: colors.text,
  textMuted: colors.textMuted,
  textSubtle: colors.textSubtle,
  gold: colors.gold,
  flame: colors.flame,
  xp: colors.xp,
  money: colors.money,
  danger: colors.danger,
} as const;

/** Adiciona transparência a uma cor `#RRGGBB` (0–1). */
export function alpha(hex: string, a: number): string {
  const n = Math.round(Math.min(1, Math.max(0, a)) * 255);
  return `${hex}${n.toString(16).padStart(2, '0')}`;
}

/** Razão de contraste WCAG 2.x entre duas cores `#RRGGBB`. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
