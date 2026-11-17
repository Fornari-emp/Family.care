/**
 * Conta e sincronização (Fase 4): login por código de e-mail, status da sincronização,
 * liga com outras pessoas (opt-in), sair e excluir conta.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { SwitchRow } from './SwitchRow';
import { TextField } from './TextField';
import { cloud, useCloud } from '@/cloud';
import { cloudMessage } from '@/cloud/api';
import { feedbackStore } from '@/feedback/feedbackStore';
import { useGame } from '@/store';
import { colors } from '@/theme';

export const PRIVACY_NOTE =
  'Ao entrar, seus registros (incluindo os valores), metas e progresso ficam guardados na nuvem do Invest Level, protegidos pelo seu login, para você usar em outros aparelhos. Você pode excluir tudo quando quiser.';

function formatStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(cloudMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.gap}>
      <AppText variant="small">{PRIVACY_NOTE}</AppText>
      {step === 'email' ? (
        <>
          <TextField
            label="Seu e-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            placeholder="voce@exemplo.com"
            style={styles.input}
            error={error}
          />
          <Button
            label="Enviar código"
            busy={busy}
            disabled={!email.trim()}
            onPress={() =>
              void run(async () => {
                await cloud!.sendCode(email);
                setStep('code');
              })
            }
          />
        </>
      ) : (
        <>
          <AppText variant="small">Enviamos um código de 6 dígitos para {email.trim()}.</AppText>
          <TextField
            label="Código recebido"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            placeholder="000000"
            error={error}
          />
          <Button
            label="Entrar"
            busy={busy}
            disabled={code.length < 6}
            onPress={() => void run(() => cloud!.verifyCode(email, code))}
          />
          <Button
            label="Trocar e-mail"
            variant="ghost"
            onPress={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          />
        </>
      )}
    </View>
  );
}

function SignedIn() {
  const user = useCloud((s) => s.user);
  const status = useCloud((s) => s.status);
  const lastSyncedAt = useCloud((s) => s.lastSyncedAt);
  const error = useCloud((s) => s.error);
  const publicLeague = useGame((s) => s.state.profile.publicLeague);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusText =
    status === 'syncing'
      ? 'Sincronizando…'
      : status === 'error'
        ? (error ?? 'Erro ao sincronizar')
        : lastSyncedAt
          ? `Sincronizado em ${formatStamp(lastSyncedAt)}`
          : 'Ainda não sincronizado';

  const safely = async (fn: () => Promise<void>, ok?: string) => {
    try {
      await fn();
      if (ok) feedbackStore.getState().toast(ok, 'money');
    } catch (e) {
      feedbackStore.getState().toast(cloudMessage(e), 'danger');
    }
  };

  return (
    <View style={styles.gap}>
      <AppText style={styles.email}>{user?.email ?? 'Conta conectada'}</AppText>
      <AppText
        variant="small"
        color={status === 'error' ? colors.danger : colors.textMuted}
        accessibilityLiveRegion="polite"
      >
        {statusText}
      </AppText>
      <Button
        label="Sincronizar agora"
        variant="secondary"
        busy={status === 'syncing'}
        onPress={() => void cloud!.syncNow()}
      />
      <SwitchRow
        label="Liga com outras pessoas"
        hint="Mostra seu apelido e seu XP da semana para até 29 participantes. Nenhum valor investido é compartilhado."
        value={publicLeague}
        onChange={(v) => void safely(() => cloud!.setPublicLeague(v))}
      />
      <Button
        label="Sair da conta"
        variant="ghost"
        onPress={() =>
          void safely(() => cloud!.signOut(), 'Você saiu. Seus dados continuam neste aparelho.')
        }
      />
      <Button
        label="Excluir conta e dados da nuvem"
        variant="danger"
        onPress={() => setConfirmDelete(true)}
      />
      <Dialog
        visible={confirmDelete}
        title="Excluir conta?"
        message="Apaga sua conta e tudo que está na nuvem (registros, metas, progresso e liga). Os dados deste aparelho continuam aqui."
        confirmLabel="Excluir conta"
        destructive
        requireText="EXCLUIR"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void safely(() => cloud!.deleteAccount(), 'Conta excluída.');
        }}
      />
    </View>
  );
}

export function AccountCard() {
  const user = useCloud((s) => s.user);
  if (!cloud) {
    return (
      <AppText variant="small">
        A sincronização entre aparelhos não está configurada nesta versão do app. Seus dados ficam
        só neste aparelho (use o backup para levá-los a outro).
      </AppText>
    );
  }
  return user ? <SignedIn /> : <SignIn />;
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  input: { fontSize: 16 },
  email: { fontSize: 15 },
});
