import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Dialog } from '@/components/Dialog';
import { EntryForm } from '@/components/EntryForm';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { CATEGORIES, getCategory } from '@/domain/categories';
import { formatBRL } from '@/domain/money';
import { filterEntries, holdingsByCategory, type EntryFilter } from '@/domain/portfolio';
import type { CategoryId, Entry } from '@/domain/types';
import { useAct } from '@/feedback/useAct';
import { useToday } from '@/hooks/useGameView';
import { useGame } from '@/store';
import { colors, fonts, MIN_TOUCH, radius } from '@/theme';
import { relativeDay } from '@/ui/format';

const PAGE = 15;

function Wallet() {
  const entries = useGame((s) => s.state.entries);
  const holdings = holdingsByCategory(entries);
  return (
    <Card>
      <SectionHeader title="Carteira por categoria" />
      {holdings.length === 0 ? (
        <AppText variant="small">Nenhum saldo registrado ainda.</AppText>
      ) : (
        holdings.map((h) => {
          const c = getCategory(h.category);
          const pct = Math.round(h.share * 100);
          return (
            <View
              key={h.category}
              style={styles.holding}
              accessible
              accessibilityLabel={`${c.name}: ${formatBRL(h.cents)}, ${pct}% da carteira`}
            >
              <View style={styles.rowBetween}>
                <AppText style={styles.holdingName}>{c.name}</AppText>
                <AppText style={styles.holdingValue}>
                  {formatBRL(h.cents)} · {pct}%
                </AppText>
              </View>
              <View style={styles.bar}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.max(3, pct)}%`, backgroundColor: c.color },
                  ]}
                />
              </View>
            </View>
          );
        })
      )}
    </Card>
  );
}

function History({ onEdit }: { onEdit: (e: Entry) => void }) {
  const entries = useGame((s) => s.state.entries);
  const today = useToday();
  const doAct = useAct();
  const [kind, setKind] = useState<EntryFilter['kind']>(undefined);
  const [category, setCategory] = useState<CategoryId | undefined>(undefined);
  const [limit, setLimit] = useState(PAGE);
  const [toDelete, setToDelete] = useState<Entry | null>(null);

  const list = useMemo(
    () => filterEntries(entries, { ...(kind ? { kind } : {}), ...(category ? { category } : {}) }),
    [entries, kind, category],
  );

  return (
    <Card>
      <SectionHeader title={`Histórico (${list.length})`} />
      <View
        style={styles.filters}
        accessibilityRole="radiogroup"
        accessibilityLabel="Filtrar por tipo"
      >
        <Chip label="Todos" selected={!kind} onPress={() => setKind(undefined)} />
        <Chip
          label="Aportes"
          selected={kind === 'contribution'}
          color={colors.money}
          onPress={() => setKind('contribution')}
        />
        <Chip
          label="Resgates"
          selected={kind === 'withdrawal'}
          color={colors.flame}
          onPress={() => setKind('withdrawal')}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        accessibilityRole="radiogroup"
        accessibilityLabel="Filtrar por categoria"
      >
        <Chip
          label="Todas as categorias"
          selected={!category}
          onPress={() => setCategory(undefined)}
        />
        {CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            color={c.color}
            selected={category === c.id}
            onPress={() => setCategory(c.id)}
          />
        ))}
      </ScrollView>

      {list.length === 0 ? (
        <AppText variant="small" style={styles.empty}>
          Nenhum registro {kind || category ? 'com esse filtro' : 'ainda'}.
        </AppText>
      ) : null}

      {list.slice(0, limit).map((e) => {
        const c = getCategory(e.category);
        const sign = e.kind === 'contribution' ? '+' : '−';
        const what = e.kind === 'contribution' ? 'Aporte' : 'Resgate';
        const when = relativeDay(e.day, today);
        return (
          <View key={e.id} style={styles.entry}>
            <View style={[styles.catDot, { backgroundColor: c.color }]} />
            <View
              style={styles.flex}
              accessible
              accessibilityLabel={`${what} de ${formatBRL(e.amountCents)} em ${c.name}, ${when}${e.note ? `. ${e.note}` : ''}`}
            >
              <AppText style={styles.entryTitle}>{c.name}</AppText>
              <AppText variant="caption" numberOfLines={1}>
                {when}
                {e.note ? ` · ${e.note}` : ''}
              </AppText>
            </View>
            <AppText
              style={[
                styles.amount,
                { color: e.kind === 'contribution' ? colors.money : colors.flame },
              ]}
            >
              {sign}
              {formatBRL(e.amountCents)}
            </AppText>
            <Pressable
              onPress={() => onEdit(e)}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${what.toLowerCase()} de ${formatBRL(e.amountCents)}, ${when}`}
              style={styles.iconBtn}
            >
              <Icon name="edit" size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable
              onPress={() => setToDelete(e)}
              accessibilityRole="button"
              accessibilityLabel={`Excluir ${what.toLowerCase()} de ${formatBRL(e.amountCents)}, ${when}`}
              style={styles.iconBtn}
            >
              <Icon name="trash" size={18} color={colors.danger} />
            </Pressable>
          </View>
        );
      })}
      {list.length > limit ? (
        <Button label="Mostrar mais" variant="ghost" onPress={() => setLimit((l) => l + PAGE)} />
      ) : null}

      <Dialog
        visible={!!toDelete}
        title="Excluir registro?"
        message={
          toDelete
            ? `${toDelete.kind === 'contribution' ? 'Aporte' : 'Resgate'} de ${formatBRL(toDelete.amountCents)}. O total e as metas serão recalculados; o XP já ganho continua.`
            : ''
        }
        confirmLabel="Excluir"
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) doAct({ type: 'DELETE_ENTRY', id: toDelete.id });
          setToDelete(null);
        }}
      />
    </Card>
  );
}

export default function InvestScreen() {
  const doAct = useAct();
  const [editing, setEditing] = useState<Entry | null>(null);
  const insets = useSafeAreaInsets();

  // Missão "Conferir sua carteira": concluída ao abrir esta aba (evento real).
  useFocusEffect(
    useCallback(() => {
      doAct({ type: 'VISIT', screen: 'portfolio' });
    }, [doAct]),
  );

  return (
    <Screen testID="screen-investir">
      <Card tone="raised">
        <SectionHeader title="Registrar" />
        <AppText variant="caption" style={styles.hint}>
          Registre aqui o que você já investiu (ou resgatou) na sua corretora.
        </AppText>
        <EntryForm />
      </Card>
      <Wallet />
      <History onEdit={setEditing} />

      <Modal
        visible={!!editing}
        animationType="slide"
        onRequestClose={() => setEditing(null)}
        presentationStyle="pageSheet"
      >
        <View style={[styles.modal, { paddingTop: insets.top + 16 }]}>
          <View style={styles.rowBetween}>
            <AppText variant="display" accessibilityRole="header">
              Editar registro
            </AppText>
            <Pressable
              onPress={() => setEditing(null)}
              accessibilityRole="button"
              accessibilityLabel="Fechar edição"
              style={styles.iconBtn}
            >
              <Icon name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalContent}
          >
            {editing ? <EntryForm editing={editing} onDone={() => setEditing(null)} /> : null}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hint: { marginTop: -4, marginBottom: 12 },
  holding: { marginBottom: 12, gap: 6 },
  holdingName: { fontFamily: fonts.bodyBold, fontSize: 13.5 },
  holdingValue: { fontFamily: fonts.displayBold, fontSize: 13, color: colors.textMuted },
  bar: { height: 7, borderRadius: 7, backgroundColor: colors.surfaceSunken, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 7 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  empty: { paddingVertical: 8 },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#241D14',
  },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  entryTitle: { fontFamily: fonts.bodyBold, fontSize: 13.5 },
  amount: { fontFamily: fonts.display, fontSize: 13.5 },
  iconBtn: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  modal: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  modalContent: { paddingVertical: 16, paddingBottom: 40 },
});
