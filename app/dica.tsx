import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tipForDay } from '@/content/tips';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Disclaimer } from '@/components/Disclaimer';
import { Icon } from '@/components/Icon';
import { useAct } from '@/feedback/useAct';
import { useToday } from '@/hooks/useGameView';
import { useGame } from '@/store';
import { colors, radius } from '@/theme';

/** Dica do dia (bug 7): conteúdo real; a missão é concluída ao confirmar a leitura. */
export default function TipScreen() {
  const today = useToday();
  const tip = tipForDay(today);
  const read = useGame((s) => s.state.daily.tipRead);
  const doAct = useAct();
  const insets = useSafeAreaInsets();

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badge}>
          <Icon name="book" size={26} color={colors.xp} />
        </View>
        <AppText variant="label" color={colors.xp}>
          Dica do dia
        </AppText>
        <AppText variant="display" accessibilityRole="header">
          {tip.title}
        </AppText>
        <AppText style={styles.body}>{tip.body}</AppText>
        <AppText variant="caption">
          Conteúdo educacional. Não é recomendação de investimento.
        </AppText>
        <Disclaimer />
      </ScrollView>
      <View style={styles.actions}>
        {read ? (
          <AppText variant="small" color={colors.money} center>
            Você já leu a dica de hoje.
          </AppText>
        ) : (
          <Button
            label="Li a dica"
            variant="xp"
            accessibilityHint="Conclui a missão e conta para a sequência de hoje"
            onPress={() => {
              doAct({ type: 'READ_TIP' });
              close();
            }}
          />
        )}
        <Button label="Fechar" variant="secondary" onPress={close} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  content: { gap: 12, paddingBottom: 20 },
  badge: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: '#211833',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { fontSize: 16, lineHeight: 24 },
  actions: { gap: 10 },
});
