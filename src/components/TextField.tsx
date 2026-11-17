import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from './AppText';
import { colors, fonts, MIN_TOUCH, radius } from '@/theme';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  prefix?: string;
}

export function TextField({ label, error, prefix, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      <AppText variant="label">{label}</AppText>
      <View style={[styles.box, error ? styles.boxError : null]}>
        {prefix ? <AppText style={styles.prefix}>{prefix}</AppText> : null}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error ?? undefined}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.gold}
          maxFontSizeMultiplier={1.6}
          style={[styles.input, style]}
          {...rest}
        />
      </View>
      {error ? (
        <AppText variant="small" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
  },
  boxError: { borderColor: colors.danger },
  prefix: { fontFamily: fonts.displayBold, color: colors.textMuted, marginRight: 6, fontSize: 18 },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 18,
    paddingVertical: 10,
  },
});
