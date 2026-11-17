import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { ProgressBar } from './ProgressBar';
import { useHeaderData } from '@/hooks/useGameView';
import { greeting, plural } from '@/ui/format';
import { alpha, colors, fonts, radius } from '@/theme';

/** Cabeçalho: saudação, sequência, moedas, nível/rank e barra de XP. */
export function Header() {
  const h = useHeaderData();
  const insets = useSafeAreaInsets();
  const p = h.progress;
  const xpText = p.isMax
    ? `${h.xp.toLocaleString('pt-BR')} XP · Nível máximo`
    : `${h.xp.toLocaleString('pt-BR')} / ${p.nextXp?.toLocaleString('pt-BR')} XP`;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={styles.row}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Icon name="chart" size={19} color={colors.textOnAccent} />
          </View>
          <View style={styles.shrink}>
            <AppText style={styles.appName} accessibilityRole="header">
              Invest Level
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {greeting(new Date(), h.timeZone, h.nickname)}
            </AppText>
          </View>
        </View>
        <View style={styles.pills}>
          <View
            style={[
              styles.pill,
              { borderColor: alpha(colors.flame, 0.4), backgroundColor: alpha(colors.flame, 0.14) },
            ]}
            accessible
            accessibilityLabel={`Sequência: ${plural(h.streak, 'dia', 'dias')}`}
          >
            <Icon name="flame" size={14} color={colors.flame} fill={colors.flame} />
            <AppText style={[styles.pillText, { color: colors.flameLight }]}>{h.streak}</AppText>
          </View>
          <View
            style={[
              styles.pill,
              { borderColor: alpha(colors.gold, 0.36), backgroundColor: alpha(colors.gold, 0.12) },
            ]}
            accessible
            accessibilityLabel={`${plural(h.coins, 'moeda', 'moedas')}`}
          >
            <Icon name="coin" size={14} color={colors.gold} />
            <AppText style={[styles.pillText, { color: colors.goldLight }]}>
              {h.coins.toLocaleString('pt-BR')}
            </AppText>
          </View>
        </View>
      </View>
      <View style={styles.levelRow}>
        <AppText variant="label">
          Nível {p.level} · {p.rank}
        </AppText>
        <AppText style={styles.xpText}>{xpText}</AppText>
      </View>
      <ProgressBar
        ratio={p.ratio}
        label={`Progresso do nível ${p.level}`}
        valueText={p.isMax ? 'Nível máximo alcançado' : xpText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: '#1D160F',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  shrink: { flexShrink: 1 },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { fontFamily: fonts.display, fontSize: 15 },
  pills: { flexDirection: 'row', gap: 7 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 11,
  },
  pillText: { fontFamily: fonts.display, fontSize: 13 },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 13,
    marginBottom: 6,
  },
  xpText: { fontFamily: fonts.displayBold, fontSize: 11, color: colors.textMuted },
});
