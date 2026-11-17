import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { tipForDay } from '@/content/tips';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Character, describeLoadout } from '@/components/Character';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { IndicatorsCard } from '@/components/IndicatorsCard';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Sparkline } from '@/components/Sparkline';
import { formatCountdown, msUntilNextDay } from '@/domain/dates';
import { DAILY_MISSIONS, WEEKLY_MISSIONS, weeklyProgress, weeklyStatus } from '@/domain/missions';
import { formatBRL } from '@/domain/money';
import { cumulativeSeries, totalInvested } from '@/domain/portfolio';
import { getItem } from '@/domain/shop';
import { displayStreak, streakStatus, weekDots } from '@/domain/streak';
import { useAct } from '@/feedback/useAct';
import { useToday } from '@/hooks/useGameView';
import { useNow } from '@/hooks/useNow';
import { useGame } from '@/store';
import { alpha, colors, fonts, MIN_TOUCH, radius } from '@/theme';
import { formatDay, plural, spokenDuration, weekdayLetter, weekdayName } from '@/ui/format';

const itemName = (id: string) => getItem(id)?.name ?? id;

function CharacterCard() {
  const equipped = useGame((s) => s.state.equipped);
  return (
    <Card tone="raised" style={styles.hero}>
      <View style={styles.rowBetween}>
        <AppText variant="label">Seu investidor</AppText>
        <Button
          label="Personalizar"
          variant="ghost"
          compact
          onPress={() => router.navigate('/loja')}
          accessibilityHint="Abre a loja"
        />
      </View>
      <View style={styles.center}>
        <Character equipped={equipped} accessibilityLabel={describeLoadout(equipped, itemName)} />
      </View>
    </Card>
  );
}

function ChestCard() {
  const opened = useGame((s) => s.state.daily.chestOpened);
  const tz = useGame((s) => s.state.profile.timeZone);
  const doAct = useAct();
  const now = useNow();
  const left = msUntilNextDay(now, tz);
  return (
    <Pressable
      onPress={() => doAct({ type: 'OPEN_CHEST' })}
      disabled={opened}
      accessibilityRole="button"
      accessibilityLabel={
        opened ? `Baú resgatado hoje. Próximo em ${spokenDuration(left)}` : 'Abrir baú diário'
      }
      accessibilityState={{ disabled: opened }}
      style={({ pressed }) => [
        styles.chest,
        opened ? styles.chestDone : styles.chestReady,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.chestIcon}>
        <Icon name="chest" size={27} color={colors.textOnAccent} />
      </View>
      <View style={styles.flex}>
        <AppText variant="title" color={opened ? colors.textMuted : colors.text}>
          {opened ? 'Baú resgatado hoje' : 'Baú diário pronto!'}
        </AppText>
        <AppText variant="small">
          {opened ? `Próximo em ${formatCountdown(left)}` : 'Moedas e XP esperando por você'}
        </AppText>
      </View>
      {!opened ? (
        <View style={styles.chestCta}>
          <AppText style={styles.chestCtaText}>Abrir</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const DOT_LABEL = {
  done: 'ação feita',
  frozen: 'salvo por congelamento',
  today: 'hoje, pendente',
  missed: 'sem ação',
  future: 'ainda não chegou',
};

function StreakCard() {
  const streak = useGame((s) => s.state.streak);
  const tz = useGame((s) => s.state.profile.timeZone);
  const today = useToday();
  const now = useNow(30_000);
  const count = displayStreak(streak, today);
  const status = streakStatus(streak, today);
  const left = formatCountdown(msUntilNextDay(now, tz)).slice(0, 5);
  const statusText =
    status === 'safe'
      ? 'garantida hoje'
      : status === 'at-risk'
        ? `faça uma ação até 00:00 (${left})`
        : 'comece hoje';
  return (
    <Card tone="flame">
      <View style={styles.rowBetween}>
        <View style={styles.rowGap}>
          <Icon name="flame" size={16} color={colors.flame} fill={colors.flame} />
          <AppText variant="title">{plural(count, 'dia seguido', 'dias seguidos')}</AppText>
        </View>
        <AppText
          style={[styles.status, { color: status === 'safe' ? colors.money : colors.flame }]}
        >
          {statusText}
        </AppText>
      </View>
      <AppText variant="small" style={styles.rule}>
        Conta o dia quando você registra um aporte de hoje ou lê a dica do dia.
        {streak.freezes > 0 ? ` Congelamentos guardados: ${streak.freezes}.` : ''}
      </AppText>
      <View style={styles.dots}>
        {weekDots(streak, today).map((d) => (
          <View
            key={d.day}
            style={styles.dotCol}
            accessible
            accessibilityLabel={`${weekdayName(d.day)} ${formatDay(d.day)}: ${DOT_LABEL[d.state]}`}
          >
            <View
              style={[
                styles.dot,
                d.state === 'done' && { backgroundColor: colors.flame, borderColor: colors.flame },
                d.state === 'frozen' && {
                  backgroundColor: alpha(colors.xp, 0.3),
                  borderColor: colors.xp,
                },
                d.state === 'today' && { borderColor: colors.flame },
              ]}
            >
              {d.state === 'done' ? (
                <Icon name="check" size={12} color={colors.textOnAccent} strokeWidth={3} />
              ) : null}
              {d.state === 'frozen' ? <Icon name="snow" size={12} color={colors.xp} /> : null}
            </View>
            <AppText variant="caption">{weekdayLetter(d.day)}</AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

function TotalCard() {
  const entries = useGame((s) => s.state.entries);
  const total = totalInvested(entries);
  const series = cumulativeSeries(entries);
  return (
    <Card tone="money">
      <AppText variant="label" color={colors.moneyMuted}>
        Total aportado
      </AppText>
      <AppText variant="big" style={styles.total}>
        {formatBRL(total)}
      </AppText>
      <AppText variant="caption" color={colors.moneyMuted}>
        {series.length === 0
          ? 'Registre seu primeiro aporte para ver a evolução.'
          : `Soma dos seus registros (aportes − resgates) desde ${formatDay(series[0]!.day)}. Não inclui rendimentos.`}
      </AppText>
      {series.length > 0 ? (
        <Sparkline
          values={series.map((p) => p.cents)}
          label={`Gráfico do total acumulado: de ${formatBRL(series[0]!.cents)} em ${formatDay(series[0]!.day)} para ${formatBRL(total)} hoje`}
        />
      ) : null}
    </Card>
  );
}

function TipCard() {
  const today = useToday();
  const read = useGame((s) => s.state.daily.tipRead);
  const tip = tipForDay(today);
  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={styles.rowGap}>
          <Icon name="book" size={16} color={colors.xp} />
          <AppText variant="label">Dica do dia</AppText>
        </View>
        {read ? <AppText style={[styles.status, { color: colors.money }]}>lida</AppText> : null}
      </View>
      <AppText variant="title" style={styles.tipTitle}>
        {tip.title}
      </AppText>
      <AppText variant="small" numberOfLines={2}>
        {tip.body}
      </AppText>
      <Button
        label={read ? 'Ler de novo' : 'Ler a dica'}
        variant="xp"
        onPress={() => router.push('/dica')}
        style={styles.mt}
        accessibilityLabel={`${read ? 'Ler de novo' : 'Ler'} a dica do dia: ${tip.title}`}
      />
    </Card>
  );
}

function Missions() {
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const daily = useGame((s) => s.state.daily);
  const weekly = useGame((s) => s.state.weekly);
  const doAct = useAct();

  return (
    <View style={styles.mt14}>
      <SectionHeader title="Missões" />
      <View style={styles.rowGap} accessibilityRole="radiogroup">
        <Chip label="Diárias" selected={tab === 'daily'} onPress={() => setTab('daily')} />
        <Chip
          label="Semanais"
          color={colors.xp}
          selected={tab === 'weekly'}
          onPress={() => setTab('weekly')}
        />
      </View>
      <Card style={styles.missions}>
        {tab === 'daily'
          ? DAILY_MISSIONS.map((m) => {
              const done = daily.missionsDone.includes(m.id);
              return (
                <Pressable
                  key={m.id}
                  disabled={done}
                  onPress={() =>
                    router.navigate(
                      m.route === 'dica'
                        ? '/dica'
                        : m.route === 'investir'
                          ? '/investir'
                          : '/metas',
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${m.title}. ${done ? 'Concluída' : m.hint}. Recompensa ${m.xp} XP e ${m.coins} moedas`}
                  accessibilityHint={done ? undefined : 'Abre a tela da missão'}
                  accessibilityState={{ disabled: done, checked: done }}
                  style={styles.missionRow}
                >
                  <View style={[styles.check, done && styles.checkDone]}>
                    {done ? (
                      <Icon name="check" size={14} color={colors.textOnAccent} strokeWidth={3} />
                    ) : null}
                  </View>
                  <View style={styles.flex}>
                    <AppText style={[styles.missionTitle, done && styles.strike]}>
                      {m.title}
                    </AppText>
                    <AppText variant="caption">{m.hint}</AppText>
                  </View>
                  <AppText style={styles.reward}>+{m.xp} XP</AppText>
                </Pressable>
              );
            })
          : WEEKLY_MISSIONS.map((m) => {
              const cur = weeklyProgress(weekly, m.id);
              const status = weeklyStatus(weekly, m.id);
              return (
                <View key={m.id} style={styles.weekRow}>
                  <View style={styles.rowBetween}>
                    <AppText style={[styles.missionTitle, styles.flex]}>{m.title}</AppText>
                    <AppText style={[styles.reward, { color: colors.gold }]}>
                      +{m.rewardCoins} moedas
                    </AppText>
                  </View>
                  <ProgressBar
                    ratio={cur / m.goal}
                    color={colors.xp}
                    height={7}
                    label={m.title}
                    valueText={`${cur} de ${m.goal}`}
                  />
                  <View style={styles.rowBetween}>
                    <AppText variant="caption">
                      {cur.toLocaleString('pt-BR')} / {m.goal.toLocaleString('pt-BR')}
                    </AppText>
                    {status === 'claimable' ? (
                      <Button
                        label="Resgatar"
                        compact
                        onPress={() => doAct({ type: 'CLAIM_WEEKLY', id: m.id })}
                        accessibilityLabel={`Resgatar ${m.rewardCoins} moedas: ${m.title}`}
                      />
                    ) : (
                      <AppText
                        variant="caption"
                        color={status === 'claimed' ? colors.money : colors.textSubtle}
                      >
                        {status === 'claimed' ? 'Resgatada' : 'Em andamento'}
                      </AppText>
                    )}
                  </View>
                </View>
              );
            })}
      </Card>
    </View>
  );
}

export default function HomeScreen() {
  return (
    <Screen testID="screen-home">
      <CharacterCard />
      <ChestCard />
      <StreakCard />
      <TotalCard />
      <IndicatorsCard />
      <TipCard />
      <Missions />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hero: { borderRadius: radius.xl, paddingBottom: 12 },
  chest: {
    marginTop: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    minHeight: MIN_TOUCH,
  },
  chestReady: { backgroundColor: '#2A1F10', borderColor: alpha(colors.gold, 0.45) },
  chestDone: { backgroundColor: colors.surface, borderColor: colors.border },
  chestIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chestCta: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chestCtaText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.textOnAccent },
  status: { fontFamily: fonts.bodyHeavy, fontSize: 11 },
  rule: { marginTop: 8 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 11 },
  dotCol: { flex: 1, alignItems: 'center', gap: 3 },
  dot: {
    height: 30,
    alignSelf: 'stretch',
    borderRadius: 10,
    backgroundColor: '#1B150F',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  total: { marginTop: 4 },
  tipTitle: { marginTop: 8, marginBottom: 4 },
  mt: { marginTop: 12 },
  mt14: { marginTop: 18 },
  missions: { paddingVertical: 4 },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: MIN_TOUCH,
    borderBottomWidth: 1,
    borderBottomColor: '#241D14',
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.money, borderColor: colors.money },
  missionTitle: { fontFamily: fonts.bodyBold, fontSize: 13.5 },
  strike: { color: colors.textMuted, textDecorationLine: 'line-through' },
  reward: { fontFamily: fonts.display, fontSize: 12, color: colors.xp },
  weekRow: { gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#241D14' },
});
