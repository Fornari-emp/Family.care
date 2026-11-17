/**
 * Formulário de aporte/resgate (bug 9): estado controlado — trocar categoria não apaga
 * o valor — e prévia de recompensa recalculada a cada tecla.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { TextField } from './TextField';
import { CATEGORIES } from '@/domain/categories';
import { daysBetween } from '@/domain/dates';
import { previewContribution, type Action } from '@/domain/engine';
import { formatBRL, maskBRLInput } from '@/domain/money';
import { MAX_BACKDATE_DAYS } from '@/domain/rewards';
import type { CategoryId, Entry, EntryKind } from '@/domain/types';
import { useAct } from '@/feedback/useAct';
import { useToday } from '@/hooks/useGameView';
import { feedbackStore } from '@/feedback/feedbackStore';
import { useGame } from '@/store';
import { alpha, colors, fonts, MIN_TOUCH, radius } from '@/theme';
import { relativeDay, shiftDay } from '@/ui/format';
import { errorMessage } from '@/ui/messages';

const QUICK = [5_000, 10_000, 25_000, 50_000];

export interface EntryFormProps {
  /** Quando presente, edita este registro. */
  editing?: Entry;
  onDone?: () => void;
}

export function EntryForm({ editing, onDone }: EntryFormProps) {
  const today = useToday();
  const doAct = useAct();
  const [kind, setKind] = useState<EntryKind>(editing?.kind ?? 'contribution');
  const [cents, setCents] = useState(editing?.amountCents ?? 0);
  const [category, setCategory] = useState<CategoryId>(editing?.category ?? 'tesouro-selic');
  const [day, setDay] = useState(editing?.day ?? today);
  const [note, setNote] = useState(editing?.note ?? '');
  const [confirmLarge, setConfirmLarge] = useState(false);
  const [touched, setTouched] = useState(false);

  const text = cents > 0 ? maskBRLInput(String(cents)).text : '';
  const age = daysBetween(day, today);

  const game = useGame((s) => s.state);
  // Recalcula a cada tecla e quando o jogo muda (aportes de hoje, sequência…).
  const preview = useMemo(
    () => previewContribution(game, cents, day, new Date()),
    [game, cents, day],
  );
  const showError = touched && cents > 0 && preview.error && preview.error !== 'needs-confirmation';

  const reset = () => {
    setCents(0);
    setNote('');
    setTouched(false);
    setDay(today);
  };

  const submit = (confirmedLarge = false) => {
    setTouched(true);
    const action: Action = editing
      ? {
          type: 'EDIT_ENTRY',
          id: editing.id,
          patch: { amountCents: cents, category, day, note },
          confirmedLarge,
        }
      : {
          type: 'ADD_ENTRY',
          entry: { kind, amountCents: cents, category, day, ...(note.trim() ? { note } : {}) },
          confirmedLarge,
        };
    const r = doAct(action, { silentError: true });
    if (r.error === 'needs-confirmation') {
      setConfirmLarge(true);
      return;
    }
    if (r.error) {
      feedbackStore.getState().toast(errorMessage(r.error), 'danger');
      return;
    }
    if (!editing) reset();
    onDone?.();
  };

  const isContribution = kind === 'contribution';
  const rewardText = !isContribution
    ? 'Resgates não rendem XP: servem para seu total refletir a realidade.'
    : preview.reward.note === 'retroactive'
      ? 'Data passada: entra no total, mas não rende XP nem conta para a sequência.'
      : preview.reward.note === 'daily-limit'
        ? `Limite diário de recompensa: +${preview.reward.xp} XP · +${preview.reward.coins} moedas`
        : `Você ganha +${preview.reward.xp} XP · +${preview.reward.coins} moedas${
            preview.reward.note === 'diminishing'
              ? ' (recompensa reduzida após 3 aportes hoje)'
              : ''
          }`;

  return (
    <View style={styles.form}>
      {!editing ? (
        <View style={styles.row} accessibilityRole="radiogroup">
          <Chip
            label="Aporte"
            selected={isContribution}
            color={colors.money}
            onPress={() => setKind('contribution')}
          />
          <Chip
            label="Resgate"
            selected={!isContribution}
            color={colors.flame}
            onPress={() => setKind('withdrawal')}
          />
        </View>
      ) : null}

      <TextField
        label={isContribution ? 'Valor do aporte' : 'Valor do resgate'}
        prefix="R$"
        value={text}
        placeholder="0,00"
        keyboardType="number-pad"
        onChangeText={(t) => setCents(maskBRLInput(t).cents)}
        onBlur={() => setTouched(true)}
        error={showError ? errorMessage(preview.error!) : null}
        testID="amount-input"
      />

      <View style={styles.row}>
        {QUICK.map((q) => (
          <Pressable
            key={q}
            onPress={() => setCents(q)}
            accessibilityRole="button"
            accessibilityLabel={`Preencher ${formatBRL(q, { cents: false })}`}
            style={styles.quick}
          >
            <AppText style={styles.quickText}>{formatBRL(q, { cents: false })}</AppText>
          </Pressable>
        ))}
      </View>

      <AppText variant="label">Categoria</AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cats}
        accessibilityRole="radiogroup"
      >
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

      <AppText variant="label">Data</AppText>
      <View style={styles.dateRow}>
        <Pressable
          onPress={() => setDay(shiftDay(day, -1))}
          disabled={age >= MAX_BACKDATE_DAYS}
          accessibilityRole="button"
          accessibilityLabel="Dia anterior"
          accessibilityState={{ disabled: age >= MAX_BACKDATE_DAYS }}
          style={[styles.stepper, age >= MAX_BACKDATE_DAYS && styles.disabled]}
        >
          <Icon name="minus" size={18} color={colors.text} />
        </Pressable>
        <View
          style={styles.dateLabel}
          accessible
          accessibilityLabel={`Data: ${relativeDay(day, today)}`}
          accessibilityLiveRegion="polite"
        >
          <AppText style={styles.dateText}>{relativeDay(day, today)}</AppText>
          <AppText variant="caption">até {MAX_BACKDATE_DAYS} dias atrás</AppText>
        </View>
        <Pressable
          onPress={() => setDay(shiftDay(day, 1))}
          disabled={age <= 0}
          accessibilityRole="button"
          accessibilityLabel="Próximo dia"
          accessibilityState={{ disabled: age <= 0 }}
          style={[styles.stepper, age <= 0 && styles.disabled]}
        >
          <Icon name="plus" size={18} color={colors.text} />
        </Pressable>
      </View>

      <TextField
        label="Observação (opcional)"
        value={note}
        onChangeText={setNote}
        maxLength={80}
        placeholder="Ex.: corretora, ativo, objetivo"
        style={styles.noteInput}
      />

      {!editing ? (
        <View
          style={styles.preview}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Prévia: ${rewardText}`}
        >
          <Icon name="star" size={16} color={isContribution ? colors.xp : colors.textMuted} />
          <AppText
            variant="small"
            style={styles.flex}
            color={isContribution ? colors.text : colors.textMuted}
          >
            {rewardText}
          </AppText>
        </View>
      ) : (
        <AppText variant="caption">
          Editar não altera o XP já ganho; totais e metas são recalculados.
        </AppText>
      )}

      <Button
        label={
          editing ? 'Salvar alterações' : isContribution ? 'Registrar aporte' : 'Registrar resgate'
        }
        onPress={() => submit(false)}
        disabled={cents <= 0}
        testID="submit-entry"
      />

      <Dialog
        visible={confirmLarge}
        title="Confirmar valor alto"
        message={`Você está registrando ${formatBRL(cents)}. Confira se o valor está certo.`}
        confirmLabel="Confirmar"
        onCancel={() => setConfirmLarge(false)}
        onConfirm={() => {
          setConfirmLarge(false);
          submit(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quick: {
    flex: 1,
    minHeight: MIN_TOUCH,
    minWidth: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.text },
  cats: { gap: 8, paddingRight: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepper: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  dateLabel: { flex: 1, alignItems: 'center' },
  dateText: { fontFamily: fonts.display, fontSize: 16 },
  noteInput: { fontSize: 14, fontFamily: fonts.body },
  preview: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.xp, 0.1),
    borderWidth: 1,
    borderColor: alpha(colors.xp, 0.3),
  },
});
