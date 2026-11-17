import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors, radius } from '@/theme';

export interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  /** Exige digitar esta palavra para liberar a confirmação (ex.: "REINICIAR"). */
  requireText?: string;
}

/** Diálogo modal em camada fixa sobre a tela (item 20). */
export function Dialog({
  visible,
  title,
  message,
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  destructive,
  requireText,
}: DialogProps) {
  const [typed, setTyped] = useState('');
  const unlocked = !requireText || typed.trim() === requireText;
  // Limpa o texto digitado ao fechar, por qualquer caminho.
  const cancel = () => {
    setTyped('');
    onCancel();
  };
  const confirm = () => {
    setTyped('');
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={cancel}
          accessibilityRole="button"
          accessibilityLabel="Fechar diálogo"
        />
        <View style={styles.box} accessibilityViewIsModal>
          <AppText variant="title" accessibilityRole="header" style={styles.title}>
            {title}
          </AppText>
          {message ? <AppText variant="small">{message}</AppText> : null}
          {children}
          {requireText ? (
            <TextField
              label={`Digite ${requireText} para confirmar`}
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          ) : null}
          <View style={styles.actions}>
            <Button
              label={cancelLabel}
              variant="secondary"
              onPress={cancel}
              style={styles.action}
            />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={confirm}
              disabled={!unlocked}
              style={styles.action}
            />
          </View>
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
    gap: 12,
  },
  title: { fontSize: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  action: { flex: 1 },
});
