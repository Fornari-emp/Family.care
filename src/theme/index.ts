export { alpha, colors, contrastRatio, TEXT_BACKGROUNDS, TEXT_COLORS } from './colors';

export const fonts = {
  display: 'Outfit_800ExtraBold',
  displayBold: 'Outfit_700Bold',
  body: 'PlusJakartaSans_500Medium',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyHeavy: 'PlusJakartaSans_800ExtraBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 11, md: 16, lg: 22, xl: 26, pill: 999 } as const;

/** Área mínima de toque (item 21). */
export const MIN_TOUCH = 44;

export const type = {
  label: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  body: { fontFamily: fonts.body, fontSize: 14 },
  small: { fontFamily: fonts.body, fontSize: 12.5 },
  title: { fontFamily: fonts.display, fontSize: 16 },
  big: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.5 },
} as const;
