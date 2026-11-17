import { useState } from 'react';
import { Modal, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './AppText';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { feedbackStore } from '@/feedback/feedbackStore';
import { formatBRL } from '@/domain/money';
import { totalInvested } from '@/domain/portfolio';
import { exportBackup, importBackup, type ImportResult } from '@/store/backup';
import { gameStore } from '@/store';
import { colors, fonts, radius } from '@/theme';

/**
 * Exportar: abre a folha de compartilhamento do sistema com o JSON (salvar em arquivo,
 * mandar para si mesmo…). Importar: colar o JSON. Não exige dependências extras.
 */
export function BackupSettings() {
  const [importOpen, setImportOpen] = useState(false);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<Extract<ImportResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const doExport = async () => {
    const now = new Date();
    await gameStore.getState().whenSaved();
    const json = exportBackup(gameStore.getState().state, now);
    try {
      await Share.share({
        title: `invest-level-backup-${now.toISOString().slice(0, 10)}.json`,
        message: json,
      });
    } catch (e) {
      console.warn('[invest-level] falha ao compartilhar backup', e);
      feedbackStore.getState().toast('Não foi possível abrir o compartilhamento.', 'danger');
    }
  };

  const check = () => {
    const r = importBackup(text, new Date());
    if (r.ok) {
      setError(null);
      setParsed(r);
    } else {
      setError(r.message);
    }
  };

  const close = () => {
    setImportOpen(false);
    setText('');
    setError(null);
    setParsed(null);
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="small">
        Guarde uma cópia dos seus registros ou leve para outro aparelho.
      </AppText>
      <Button label="Exportar backup" variant="secondary" onPress={() => void doExport()} />
      <Button label="Importar backup" variant="secondary" onPress={() => setImportOpen(true)} />

      <Modal
        visible={importOpen}
        animationType="slide"
        onRequestClose={close}
        presentationStyle="pageSheet"
      >
        <View
          style={[styles.modal, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
        >
          <AppText variant="display" accessibilityRole="header">
            Importar backup
          </AppText>
          <AppText variant="small">
            Cole abaixo o conteúdo exportado. Os dados atuais serão substituídos.
          </AppText>
          <ScrollView style={styles.flex} keyboardShouldPersistTaps="handled">
            <TextInput
              value={text}
              onChangeText={(t) => {
                setText(t);
                setError(null);
              }}
              multiline
              autoCorrect={false}
              autoCapitalize="none"
              placeholder='{"schemaVersion":1,…}'
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel="Conteúdo do backup"
              style={styles.input}
            />
            {error ? (
              <AppText variant="small" color={colors.danger} accessibilityLiveRegion="polite">
                {error}
              </AppText>
            ) : null}
          </ScrollView>
          <Button
            label="Verificar e importar"
            onPress={check}
            disabled={text.trim().length === 0}
          />
          <Button label="Cancelar" variant="ghost" onPress={close} />
        </View>
        <Dialog
          visible={!!parsed}
          title="Substituir dados atuais?"
          message={
            parsed
              ? `Backup de ${parsed.summary.nickname}${parsed.summary.savedAt ? ` (${parsed.summary.savedAt.slice(0, 10).split('-').reverse().join('/')})` : ''}: ${parsed.summary.entries} registros, total ${formatBRL(totalInvested(parsed.state.entries))}, ${parsed.summary.xp} XP e ${parsed.summary.coins} moedas.`
              : ''
          }
          confirmLabel="Importar"
          destructive
          onCancel={() => setParsed(null)}
          onConfirm={() => {
            if (!parsed) return;
            void gameStore
              .getState()
              .importState(parsed.state)
              .then(() => feedbackStore.getState().toast('Backup importado', 'money'));
            close();
          }}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  flex: { flex: 1, marginVertical: 12 },
  modal: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, gap: 8 },
  input: {
    minHeight: 220,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 12,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 12,
    textAlignVertical: 'top',
  },
});
