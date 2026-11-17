import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { alpha, colors, fonts, MIN_TOUCH, radius } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'xp';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  /** Texto falado quando o rótulo visível não basta. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
  compact?: boolean;
  testID?: string;
}

const BG: Record<Variant, string> = {
  primary: colors.gold,
  secondary: colors.surfaceRaised,
  ghost: 'transparent',
  danger: alpha(colors.danger, 0.14),
  xp: alpha(colors.xp, 0.18),
};
const FG: Record<Variant, string> = {
  primary: colors.textOnAccent,
  secondary: colors.text,
  ghost: colors.gold,
  danger: colors.danger,
  xp: colors.xp,
};

/** Botão acessível: papel de botão, rótulo, estado e área de toque ≥ 44×44 (item 21). */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  busy,
  accessibilityLabel,
  accessibilityHint,
  style,
  compact,
  testID,
}: ButtonProps) {
  const inactive = disabled || busy;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      hitSlop={compact ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: BG[variant], opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'secondary' && styles.bordered,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={FG[variant]} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={16} color={FG[variant]} /> : null}
          <AppText style={[styles.label, { color: FG[variant] }]}>{label}</AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { borderRadius: radius.pill, paddingHorizontal: 14 },
  bordered: { borderWidth: 1, borderColor: colors.borderStrong },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: fonts.display, fontSize: 14 },
});
