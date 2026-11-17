import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from './AppText';
import { colors, MIN_TOUCH } from '@/theme';

export function SwitchRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText style={styles.label}>{label}</AppText>
        {hint ? <AppText variant="caption">{hint}</AppText> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        accessibilityHint={hint}
        trackColor={{ false: colors.borderStrong, true: colors.money }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH + 8,
    paddingVertical: 6,
    gap: 12,
  },
  text: { flex: 1 },
  label: { fontSize: 14 },
});
