import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { AccountCard } from '@/components/AccountCard';
import { BackupSettings } from '@/components/BackupSettings';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Dialog } from '@/components/Dialog';
import { Icon, isIconName } from '@/components/Icon';
import { ReminderSettings } from '@/components/ReminderSettings';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SwitchRow } from '@/components/SwitchRow';
import { TextField } from '@/components/TextField';
import { ACHIEVEMENTS } from '@/domain/achievements';
import { RESET_CONFIRMATION, MAX_NICKNAME } from '@/domain/engine';
import { formatBRL } from '@/domain/money';
import { totalInvested } from '@/domain/portfolio';
import { useAct } from '@/feedback/useAct';
import { useGame } from '@/store';
import { alpha, colors, fonts, radius } from '@/theme';
import { TIME_ZONES } from '@/ui/timezones';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

export default function ProfileScreen() {
  const state = useGame((s) => s.state);
  const doAct = useAct();
  const [nick, setNick] = useState(state.profile.nickname);
  const [resetOpen, setResetOpen] = useState(false);
  const p = state.profile;
  const unlocked = new Set(state.achievements);

  return (
    <Screen testID="screen-perfil">
      <Card>
        <SectionHeader title="Apelido" />
        <TextField
          label="Como quer ser chamado"
          value={nick}
          onChangeText={setNick}
          maxLength={MAX_NICKNAME}
          style={styles.nickInput}
        />
        <Button
          label="Salvar apelido"
          variant="secondary"
          style={styles.mt}
          disabled={nick.trim() === p.nickname}
          onPress={() => doAct({ type: 'UPDATE_PROFILE', patch: { nickname: nick } })}
        />
      </Card>

      <Card>
        <SectionHeader title="Estatísticas" />
        <View style={styles.stats}>
          <Stat
            label="Total aportado"
            value={formatBRL(totalInvested(state.entries), { cents: false })}
          />
          <Stat label="Aportes registrados" value={String(state.stats.contributionsCount)} />
          <Stat label="Melhor sequência" value={`${state.streak.best} dias`} />
          <Stat label="Semanas seguidas" value={String(state.weekRun.count)} />
          <Stat label="Dicas lidas" value={String(state.stats.tipsRead)} />
          <Stat label="Baús abertos" value={String(state.stats.chestsOpened)} />
        </View>
      </Card>

      <Card>
        <SectionHeader title={`Conquistas (${unlocked.size}/${ACHIEVEMENTS.length})`} />
        <View style={styles.achievements}>
          {ACHIEVEMENTS.map((a) => {
            const on = unlocked.has(a.id);
            return (
              <View
                key={a.id}
                style={[styles.ach, on && styles.achOn]}
                accessible
                accessibilityLabel={`Conquista ${a.title}: ${on ? 'desbloqueada' : 'bloqueada'}. ${a.description}`}
              >
                <View
                  style={[
                    styles.achIcon,
                    { backgroundColor: on ? alpha(colors.gold, 0.18) : colors.surfaceSunken },
                  ]}
                >
                  {on && isIconName(a.icon) ? (
                    <Icon name={a.icon} size={22} color={colors.gold} />
                  ) : (
                    <Icon name="lock" size={20} color={colors.textSubtle} />
                  )}
                </View>
                <AppText
                  style={[styles.achTitle, { color: on ? colors.text : colors.textMuted }]}
                  numberOfLines={2}
                  center
                >
                  {a.title}
                </AppText>
              </View>
            );
          })}
        </View>
      </Card>

      <Card>
        <SectionHeader title="Preferências" />
        <SwitchRow
          label="Sons"
          value={p.sound}
          onChange={(v) => doAct({ type: 'UPDATE_PROFILE', patch: { sound: v } })}
        />
        <SwitchRow
          label="Vibração"
          value={p.haptics}
          onChange={(v) => doAct({ type: 'UPDATE_PROFILE', patch: { haptics: v } })}
        />
        <AppText variant="label" style={styles.tzLabel}>
          Fuso horário (vira o dia à meia-noite local)
        </AppText>
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Fuso horário">
          {TIME_ZONES.map((tz) => (
            <Chip
              key={tz.id}
              label={tz.label}
              selected={p.timeZone === tz.id}
              onPress={() => doAct({ type: 'UPDATE_PROFILE', patch: { timeZone: tz.id } })}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionHeader title="Lembrete" />
        <ReminderSettings />
      </Card>

      <Card>
        <SectionHeader title="Conta e sincronização" />
        <AccountCard />
      </Card>

      <Card>
        <SectionHeader title="Backup" />
        <BackupSettings />
      </Card>

      <Button
        label="Reiniciar progresso"
        variant="danger"
        style={styles.mtLarge}
        onPress={() => setResetOpen(true)}
        accessibilityHint="Pede confirmação antes de apagar"
      />

      <Dialog
        visible={resetOpen}
        title="Reiniciar progresso?"
        message="Apaga aportes, XP, moedas, itens e conquistas. Apelido e preferências são mantidos. Não dá para desfazer."
        confirmLabel="Reiniciar"
        destructive
        requireText={RESET_CONFIRMATION}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          doAct({ type: 'RESET', confirmation: RESET_CONFIRMATION });
          setResetOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  mt: { marginTop: 10 },
  mtLarge: { marginTop: 18 },
  nickInput: { fontSize: 16 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: 12,
  },
  statValue: { fontFamily: fonts.display, fontSize: 17 },
  achievements: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ach: {
    width: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  achOn: { borderColor: alpha(colors.gold, 0.4) },
  achIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achTitle: { fontFamily: fonts.bodyBold, fontSize: 11.5 },
  tzLabel: { marginTop: 12, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
