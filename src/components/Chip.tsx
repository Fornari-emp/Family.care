import { Pressable, StyleSheet } from 'react-native';

import { AppText } from './AppText';
import { alpha, colors, fonts, MIN_TOUCH, radius } from '@/theme';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  accessibilityLabel?: string;
}

/** Opção selecionável (papel "radio" para leitores de tela). */
export function Chip({
  label,
  selected,
  onPress,
  color = colors.gold,
  accessibilityLabel,
}: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, checked: selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? alpha(color, 0.16) : colors.surface,
          borderColor: selected ? alpha(color, 0.6) : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <AppText style={[styles.text, { color: selected ? color : colors.textMuted }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  text: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
});
