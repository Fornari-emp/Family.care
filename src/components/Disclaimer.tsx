import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors } from '@/theme';

export const DISCLAIMER =
  'O Invest Level não é corretora, não recomenda investimentos e não movimenta dinheiro. Os registros são feitos por você.';

/** Aviso fixo (item 19). */
export function Disclaimer() {
  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={DISCLAIMER}>
      <Icon name="info" size={15} color={colors.textSubtle} />
      <AppText variant="caption" style={styles.text}>
        {DISCLAIMER}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 18,
    paddingHorizontal: 4,
  },
  text: { flex: 1, lineHeight: 16 },
});
