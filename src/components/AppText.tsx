import { Text, type TextProps } from 'react-native';

import { colors, fonts } from '@/theme';

type Variant = 'body' | 'small' | 'label' | 'title' | 'big' | 'display' | 'caption';

const VARIANTS = {
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  caption: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textSubtle },
  label: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: colors.textSubtle,
  },
  title: { fontFamily: fonts.display, fontSize: 16, color: colors.text },
  big: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.5, color: colors.text },
  display: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
} as const;

export interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
}

/** Texto com tokens do tema; limita o zoom de fonte para não quebrar o layout. */
export function AppText({ variant = 'body', color, center, style, ...rest }: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      style={[
        VARIANTS[variant],
        color ? { color } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      {...rest}
    />
  );
}
