import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

export interface ProgressBarProps {
  /** 0–1 */
  ratio: number;
  label: string;
  color?: string;
  height?: number;
  /** Texto falado do valor, ex.: "150 de 250 XP". */
  valueText?: string;
}

export function ProgressBar({
  ratio,
  label,
  color = colors.gold,
  height = 9,
  valueText,
}: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct, ...(valueText ? { text: valueText } : {}) }}
      style={[styles.track, { height, borderRadius: height }]}
    >
      <View
        style={[styles.fill, { width: `${pct}%`, backgroundColor: color, borderRadius: height }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: '#322516',
    overflow: 'hidden',
  },
  fill: { height: '100%' },
});
