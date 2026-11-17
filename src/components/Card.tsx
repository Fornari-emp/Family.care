import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius } from '@/theme';

export interface CardProps extends ViewProps {
  tone?: 'default' | 'money' | 'flame' | 'gold' | 'raised';
}

const TONES = {
  default: { backgroundColor: colors.surface, borderColor: colors.border },
  raised: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong },
  money: { backgroundColor: colors.moneySurface, borderColor: colors.moneyBorder },
  flame: { backgroundColor: '#211611', borderColor: '#3A2418' },
  gold: { backgroundColor: '#251C0F', borderColor: 'rgba(255,197,61,0.45)' },
} as const;

export function Card({ tone = 'default', style, ...rest }: CardProps) {
  return <View style={[styles.card, TONES[tone], style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 15, marginTop: 12 },
});
