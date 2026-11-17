import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { STREAK_FREEZE } from '@/domain/shop';
import { MAX_FREEZES } from '@/domain/streak';
import { useAct } from '@/feedback/useAct';
import { useGame } from '@/store';
import { alpha, colors, radius } from '@/theme';

/** Proteção de sequência: salva 1 dia perdido; guarda no máximo 2. */
export function FreezeCard() {
  const freezes = useGame((s) => s.state.streak.freezes);
  const coins = useGame((s) => s.state.coins);
  const doAct = useAct();
  const [confirm, setConfirm] = useState(false);
  const full = freezes >= MAX_FREEZES;
  const affordable = coins >= STREAK_FREEZE.price;

  return (
    <Card tone="raised">
      <View style={styles.row}>
        <View style={styles.icon}>
          <Icon name="snow" size={26} color={colors.xp} />
        </View>
        <View style={styles.flex}>
          <AppText variant="title">{STREAK_FREEZE.name}</AppText>
          <AppText variant="small">{STREAK_FREEZE.description}</AppText>
          <AppText variant="caption" accessibilityLabel={`Guardados: ${freezes} de ${MAX_FREEZES}`}>
            Guardados: {freezes}/{MAX_FREEZES}
          </AppText>
        </View>
      </View>
      <Button
        label={
          full
            ? 'Limite atingido'
            : affordable
              ? `Comprar · ${STREAK_FREEZE.price} moedas`
              : 'Sem moedas'
        }
        variant="xp"
        style={styles.mt}
        disabled={full || !affordable}
        onPress={() => setConfirm(true)}
        accessibilityLabel={
          full
            ? `${STREAK_FREEZE.name}: você já guarda o máximo de ${MAX_FREEZES}`
            : `Comprar ${STREAK_FREEZE.name} por ${STREAK_FREEZE.price} moedas`
        }
      />
      <Dialog
        visible={confirm}
        title={`Comprar ${STREAK_FREEZE.name}?`}
        message={`Custa ${STREAK_FREEZE.price} moedas. Se você perder um dia, ele é usado automaticamente.`}
        confirmLabel="Comprar"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          doAct({ type: 'BUY', itemId: STREAK_FREEZE.id });
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  flex: { flex: 1, gap: 2 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.xp, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  mt: { marginTop: 12 },
});
