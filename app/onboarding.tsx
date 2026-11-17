import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Character } from '@/components/Character';
import { DISCLAIMER } from '@/components/Disclaimer';
import { Icon, type IconName } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { MAX_NICKNAME } from '@/domain/engine';
import { maskBRLInput } from '@/domain/money';
import { defaultEquipped } from '@/domain/shop';
import { useAct } from '@/feedback/useAct';
import { colors, radius } from '@/theme';

const IS: { icon: IconName; text: string }[] = [
  { icon: 'check', text: 'Um diário para registrar os aportes que você já fez na sua corretora' },
  { icon: 'check', text: 'Um jogo que recompensa constância: sequência, missões, níveis e metas' },
];
const IS_NOT: { icon: IconName; text: string }[] = [
  { icon: 'close', text: 'Não é corretora e não movimenta dinheiro' },
  { icon: 'close', text: 'Não recomenda em que investir' },
];

/** Onboarding em 3 passos: o que o app é (e não é), apelido e primeira meta. */
export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [nick, setNick] = useState('');
  const [goalName, setGoalName] = useState('Reserva de emergência');
  const [goalCents, setGoalCents] = useState(0);
  const doAct = useAct();
  const insets = useSafeAreaInsets();

  const finish = (withGoal: boolean) => {
    const r = doAct({
      type: 'COMPLETE_ONBOARDING',
      nickname: nick,
      ...(withGoal ? { firstGoal: { name: goalName, targetCents: goalCents } } : {}),
    });
    if (!r.error) router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="caption" accessibilityLabel={`Passo ${step + 1} de 3`}>
          {step + 1} / 3
        </AppText>

        {step === 0 ? (
          <View style={styles.step}>
            <View style={styles.center}>
              <Character equipped={defaultEquipped()} size={150} />
            </View>
            <AppText variant="display" accessibilityRole="header">
              Bem-vindo ao Invest Level
            </AppText>
            <AppText variant="label">O que é</AppText>
            {IS.map((i) => (
              <Bullet key={i.text} {...i} color={colors.money} />
            ))}
            <AppText variant="label">O que não é</AppText>
            {IS_NOT.map((i) => (
              <Bullet key={i.text} {...i} color={colors.danger} />
            ))}
            <AppText variant="caption">{DISCLAIMER}</AppText>
            <Button label="Entendi, continuar" onPress={() => setStep(1)} />
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.step}>
            <AppText variant="display" accessibilityRole="header">
              Como quer ser chamado?
            </AppText>
            <TextField
              label="Apelido"
              value={nick}
              onChangeText={setNick}
              maxLength={MAX_NICKNAME}
              placeholder="Ex.: Ana"
              autoFocus
            />
            <Button
              label="Continuar"
              disabled={nick.trim().length === 0}
              onPress={() => setStep(2)}
            />
            <Button label="Voltar" variant="ghost" onPress={() => setStep(0)} />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.step}>
            <AppText variant="display" accessibilityRole="header">
              Sua primeira meta
            </AppText>
            <AppText variant="small">
              Defina um objetivo para acompanhar. Você pode pular e criar depois.
            </AppText>
            <TextField
              label="Nome da meta"
              value={goalName}
              onChangeText={setGoalName}
              maxLength={40}
              style={styles.textInput}
            />
            <TextField
              label="Valor da meta"
              prefix="R$"
              keyboardType="number-pad"
              placeholder="0,00"
              value={goalCents > 0 ? maskBRLInput(String(goalCents)).text : ''}
              onChangeText={(t) => setGoalCents(maskBRLInput(t).cents)}
            />
            <Button
              label="Criar meta e começar"
              disabled={goalCents < 100 || goalName.trim().length === 0}
              onPress={() => finish(true)}
            />
            <Button label="Pular por enquanto" variant="secondary" onPress={() => finish(false)} />
            <Button label="Voltar" variant="ghost" onPress={() => setStep(1)} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Bullet({ icon, text, color }: { icon: IconName; text: string; color: string }) {
  return (
    <View style={styles.bullet}>
      <View style={[styles.bulletIcon, { borderColor: color }]}>
        <Icon name={icon} size={14} color={color} strokeWidth={2.6} />
      </View>
      <AppText style={styles.flex}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 22, gap: 14 },
  step: { gap: 14 },
  center: { alignItems: 'center' },
  flex: { flex: 1 },
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  bulletIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: { fontSize: 16 },
});
