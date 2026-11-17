import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { GoalForm } from '@/components/GoalForm';
import { Icon } from '@/components/Icon';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { getCategory } from '@/domain/categories';
import { daysLeftInWeek, weekElapsedFraction } from '@/domain/dates';
import { evaluateGoal } from '@/domain/goals';
import { LEAGUE_DISCLAIMER, LEAGUE_NAME, leagueStandings } from '@/domain/league';
import { formatBRL } from '@/domain/money';
import type { Goal } from '@/domain/types';
import { useAct } from '@/feedback/useAct';
import { useToday } from '@/hooks/useGameView';
import { useNow } from '@/hooks/useNow';
import { useGame } from '@/store';
import { alpha, colors, fonts, radius } from '@/theme';
import { formatDay, plural } from '@/ui/format';

function Goals() {
  const goals = useGame((s) => s.state.goals);
  const entries = useGame((s) => s.state.entries);
  const today = useToday();
  const doAct = useAct();
  const insets = useSafeAreaInsets();
  // null = fechado; 'new' = criar; Goal = editar
  const [form, setForm] = useState<Goal | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Goal | null>(null);

  return (
    <View>
      <SectionHeader
        title="Metas de patrimônio"
        right={
          <Button
            label="Nova meta"
            icon="plus"
            variant="ghost"
            compact
            onPress={() => setForm('new')}
          />
        }
      />
      {goals.map((g) => {
        const v = evaluateGoal(g, entries, today);
        const pct = Math.round(v.ratio * 100);
        const scope = g.category ? ` em ${getCategory(g.category).name}` : '';
        return (
          <Card key={g.id} tone={v.claimable ? 'gold' : 'default'}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <AppText variant="title">{g.name}</AppText>
                <AppText variant="caption">
                  {g.kind === 'custom' ? 'Meta pessoal' : 'Meta padrão'}
                  {scope}
                  {g.deadline ? ` · prazo ${formatDay(g.deadline, today)}` : ''}
                  {v.overdue ? ' · prazo vencido' : ''}
                </AppText>
              </View>
              <AppText style={styles.reward}>+{g.rewardCoins} moedas</AppText>
            </View>
            <View style={styles.progress}>
              <ProgressBar
                ratio={v.ratio}
                color={colors.money}
                label={`Progresso da meta ${g.name}`}
                valueText={`${formatBRL(v.currentCents)} de ${formatBRL(g.targetCents)}, ${pct}%`}
              />
            </View>
            <AppText variant="small">
              {formatBRL(v.currentCents, { cents: false })} de{' '}
              {formatBRL(g.targetCents, { cents: false })} · {pct}%
            </AppText>
            {g.claimed ? (
              <View style={styles.claimed}>
                <Icon name="check" size={14} color={colors.money} strokeWidth={3} />
                <AppText variant="small" color={colors.money}>
                  Recompensa resgatada
                </AppText>
              </View>
            ) : v.claimable ? (
              <Button
                label="Resgatar recompensa"
                style={styles.mt}
                onPress={() => doAct({ type: 'CLAIM_GOAL', id: g.id })}
                accessibilityLabel={`Resgatar ${g.rewardCoins} moedas e ${g.rewardXp} XP da meta ${g.name}`}
              />
            ) : null}
            {g.kind === 'custom' ? (
              <View style={styles.manage}>
                {!g.claimed ? (
                  <Button
                    label="Editar"
                    variant="secondary"
                    compact
                    onPress={() => setForm(g)}
                    accessibilityLabel={`Editar meta ${g.name}`}
                  />
                ) : (
                  <Button
                    label="Excluir"
                    variant="danger"
                    compact
                    onPress={() => setToDelete(g)}
                    accessibilityLabel={`Excluir meta ${g.name}`}
                  />
                )}
              </View>
            ) : null}
          </Card>
        );
      })}

      <Modal
        visible={form !== null}
        animationType="slide"
        onRequestClose={() => setForm(null)}
        presentationStyle="pageSheet"
      >
        <View style={[styles.modal, { paddingTop: insets.top + 16 }]}>
          <View style={styles.rowBetween}>
            <AppText variant="display" accessibilityRole="header">
              {form === 'new' ? 'Nova meta' : 'Editar meta'}
            </AppText>
            <Button label="Fechar" variant="ghost" compact onPress={() => setForm(null)} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalContent}
          >
            {form !== null ? (
              <GoalForm editing={form === 'new' ? undefined : form} onDone={() => setForm(null)} />
            ) : null}
          </ScrollView>
        </View>
      </Modal>
      <Dialog
        visible={!!toDelete}
        title="Excluir meta?"
        message={
          toDelete
            ? `"${toDelete.name}" será removida. A recompensa já recebida continua com você.`
            : ''
        }
        confirmLabel="Excluir"
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) doAct({ type: 'DELETE_GOAL', id: toDelete.id });
          setToDelete(null);
        }}
      />
    </View>
  );
}

function League() {
  const weekly = useGame((s) => s.state.weekly);
  const nickname = useGame((s) => s.state.profile.nickname);
  const tz = useGame((s) => s.state.profile.timeZone);
  const now = useNow(60_000);
  const rows = leagueStandings(weekly.week, weekElapsedFraction(now, tz), {
    name: nickname,
    xp: weekly.xp,
  });
  const left = daysLeftInWeek(now, tz);

  return (
    <View style={styles.mtLarge}>
      <SectionHeader
        title={LEAGUE_NAME}
        right={
          <AppText variant="caption">
            {left === 0 ? 'termina hoje' : `termina em ${plural(left, 'dia', 'dias')}`}
          </AppText>
        }
      />
      <Card style={styles.noMt}>
        <View style={styles.notice}>
          <Icon name="info" size={15} color={colors.xp} />
          <AppText variant="caption" style={styles.flex}>
            {LEAGUE_DISCLAIMER} XP da semana (segunda a domingo).
          </AppText>
        </View>
        {rows.map((r) => (
          <View
            key={r.name + r.position}
            style={[styles.leagueRow, r.isPlayer && styles.me]}
            accessible
            accessibilityLabel={`${r.position}º lugar: ${r.isPlayer ? `você, ${r.name}` : `${r.name}, rival fictício`}, ${r.xp} XP`}
          >
            <AppText style={styles.pos}>{r.position}º</AppText>
            <View
              style={[
                styles.avatar,
                { backgroundColor: r.isPlayer ? colors.gold : colors.surfaceRaised },
              ]}
            >
              <AppText
                style={[
                  styles.initial,
                  { color: r.isPlayer ? colors.textOnAccent : colors.textMuted },
                ]}
              >
                {r.name.charAt(0).toUpperCase()}
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText style={styles.name}>{r.isPlayer ? `${r.name} (você)` : r.name}</AppText>
              {r.isBot ? <AppText variant="caption">rival fictício</AppText> : null}
            </View>
            <AppText style={styles.xp}>{r.xp.toLocaleString('pt-BR')} XP</AppText>
          </View>
        ))}
      </Card>
    </View>
  );
}

export default function GoalsScreen() {
  const doAct = useAct();
  // Missão "Visitar a Liga": concluída ao abrir esta aba.
  useFocusEffect(
    useCallback(() => {
      doAct({ type: 'VISIT', screen: 'league' });
    }, [doAct]),
  );
  return (
    <Screen testID="screen-metas">
      <View style={styles.mt}>
        <Goals />
      </View>
      <League />
    </Screen>
  );
}

const styles = StyleSheet.create({
  manage: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  modal: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  modalContent: { paddingVertical: 16, paddingBottom: 40 },
  flex: { flex: 1 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reward: { fontFamily: fonts.display, fontSize: 12.5, color: colors.gold },
  progress: { marginVertical: 10 },
  claimed: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 10 },
  mt: { marginTop: 12 },
  mtLarge: { marginTop: 22 },
  noMt: { marginTop: 0 },
  notice: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.xp, 0.1),
    marginBottom: 8,
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: radius.md,
  },
  me: { backgroundColor: alpha(colors.gold, 0.1) },
  pos: { width: 28, fontFamily: fonts.display, fontSize: 14, color: colors.textMuted },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: fonts.display, fontSize: 14 },
  name: { fontFamily: fonts.bodyBold, fontSize: 13.5 },
  xp: { fontFamily: fonts.display, fontSize: 13, color: colors.xp },
});
