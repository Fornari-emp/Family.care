import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { SectionHeader } from './SectionHeader';
import { formatIndicator, INDICATORS } from '@/market/sgs';
import { useIndicators } from '@/market/useIndicators';
import { colors, fonts, radius } from '@/theme';
import { formatDay } from '@/ui/format';

function formatStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Indicadores reais do Banco Central, com data. Só informativo (itens 17 e 19). */
export function IndicatorsCard() {
  const { result, loading, refresh } = useIndicators();
  const snap = result?.snapshot ?? null;

  return (
    <Card>
      <SectionHeader
        title="Indicadores"
        right={
          <Button
            label="Atualizar"
            variant="ghost"
            compact
            busy={loading}
            onPress={refresh}
            accessibilityLabel="Atualizar indicadores"
          />
        }
      />
      {!snap ? (
        <AppText variant="small">
          {loading ? 'Carregando…' : 'Indisponível no momento. Verifique sua conexão.'}
        </AppText>
      ) : (
        <>
          <View style={styles.grid}>
            {INDICATORS.map((def) => {
              const v = snap.values.find((x) => x.id === def.id);
              return (
                <View
                  key={def.id}
                  style={styles.cell}
                  accessible
                  accessibilityLabel={
                    v
                      ? `${def.label}: ${formatIndicator(def, v.value)} ${def.unit === 'R$' ? '' : def.unit}, referência ${formatDay(v.refDate)}`
                      : `${def.label}: indisponível`
                  }
                >
                  <AppText variant="label">{def.label}</AppText>
                  <AppText style={styles.value}>{v ? formatIndicator(def, v.value) : '—'}</AppText>
                  <AppText variant="caption">
                    {v
                      ? `${def.unit === 'R$' ? '' : `${def.unit} · `}ref. ${formatDay(v.refDate)}`
                      : 'indisponível'}
                  </AppText>
                </View>
              );
            })}
          </View>
          <AppText variant="caption" style={styles.foot}>
            Fonte: Banco Central (SGS). Atualizado em {formatStamp(snap.fetchedAt)}
            {result?.source === 'stale-cache' ? ' (sem conexão: mostrando a última consulta)' : ''}.
            Informativo, não é recomendação.
          </AppText>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  cell: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: 11,
    gap: 2,
  },
  value: { fontFamily: fonts.display, fontSize: 16 },
  foot: { marginTop: 10 },
});
