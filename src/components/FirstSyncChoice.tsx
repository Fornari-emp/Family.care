/**
 * Primeiro login num aparelho que já tem dados, com dados também na nuvem:
 * o usuário escolhe o que manter (nada é sobrescrito sem perguntar).
 */
import { Modal, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { cloud, useCloud } from '@/cloud';
import type { StateSummary } from '@/cloud/cloudService';
import { colors, radius } from '@/theme';

function describe(s: StateSummary): string {
  return `${s.nickname}: ${s.entries} registros, ${s.xp.toLocaleString('pt-BR')} XP, ${s.coins.toLocaleString('pt-BR')} moedas`;
}

export function FirstSyncChoice() {
  const choice = useCloud((s) => s.choice);
  if (!cloud || !choice) return null;
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <View style={styles.backdrop}>
        <View style={styles.box} accessibilityViewIsModal>
          <AppText variant="title" accessibilityRole="header" style={styles.title}>
            Você já tem dados nos dois lugares
          </AppText>
          <AppText variant="small">Neste aparelho — {describe(choice.device)}</AppText>
          <AppText variant="small">Na nuvem — {describe(choice.cloud)}</AppText>
          <Button
            label="Juntar os dois"
            accessibilityHint="Mantém os registros e metas de ambos; o progresso do jogo mais recente vence"
            onPress={() => void cloud!.resolveChoice('merge')}
          />
          <Button
            label="Usar os dados da nuvem"
            variant="secondary"
            onPress={() => void cloud!.resolveChoice('use-cloud')}
          />
          <Button
            label="Usar os dados deste aparelho"
            variant="secondary"
            accessibilityHint="Substitui os dados da nuvem pelos deste aparelho"
            onPress={() => void cloud!.resolveChoice('use-device')}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 },
  box: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 20,
    gap: 10,
  },
  title: { fontSize: 18 },
});
