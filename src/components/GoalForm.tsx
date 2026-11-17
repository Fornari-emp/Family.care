import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { Dialog } from './Dialog';
import { TextField } from './TextField';
import { CATEGORIES } from '@/domain/categories';
import { addMonths } from '@/domain/dates';
import { CUSTOM_GOAL_REWARD, MAX_GOAL_NAME } from '@/domain/goals';
import { maskBRLInput } from '@/domain/money';
import type { CategoryId, Goal } from '@/domain/types';
import { useAct } from '@/feedback/useAct';
import { useToday } from '@/hooks/useGameView';
import { formatDay } from '@/ui/format';

const DEADLINES = [
  { months: 3, label: '3 meses' },
  { months: 6, label: '6 meses' },
  { months: 12, label: '1 ano' },
  { months: 24, label: '2 anos' },
] as const;

/** Criar/editar meta personalizada (nome, valor, prazo opcional e categoria opcional). */
export function GoalForm({ editing, onDone }: { editing?: Goal; onDone: () => void }) {
  const today = useToday();
  const doAct = useAct();
  const [name, setName] = useState(editing?.name ?? '');
  const [cents, setCents] = useState(editing?.targetCents ?? 0);
  const [deadline, setDeadline] = useState<string | undefined>(editing?.deadline);
  const [category, setCategory] = useState<CategoryId | undefined>(editing?.category);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    const goal = {
      name,
      targetCents: cents,
      ...(deadline ? { deadline } : {}),
      ...(category ? { category } : {}),
    };
    const r = doAct(
      editing ? { type: 'EDIT_GOAL', id: editing.id, goal } : { type: 'ADD_GOAL', goal },
    );
    if (!r.error) onDone();
  };

  const presetDays = DEADLINES.map((d) => addMonths(today, d.months));
  const customDeadline = deadline && !presetDays.includes(deadline);

  return (
    <View style={styles.form}>
      <TextField
        label="Nome da meta"
        value={name}
        onChangeText={setName}
        maxLength={MAX_GOAL_NAME}
        placeholder="Ex.: Viagem"
        style={styles.text}
      />
      <TextField
        label="Valor da meta"
        prefix="R$"
        keyboardType="number-pad"
        placeholder="0,00"
        value={cents > 0 ? maskBRLInput(String(cents)).text : ''}
        onChangeText={(t) => setCents(maskBRLInput(t).cents)}
      />

      <AppText variant="label">Prazo</AppText>
      <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Prazo">
        <Chip label="Sem prazo" selected={!deadline} onPress={() => setDeadline(undefined)} />
        {DEADLINES.map((d, i) => (
          <Chip
            key={d.months}
            label={d.label}
            accessibilityLabel={`${d.label}, até ${formatDay(presetDays[i]!, today)}`}
            selected={deadline === presetDays[i]}
            onPress={() => setDeadline(presetDays[i])}
          />
        ))}
        {customDeadline ? (
          <Chip label={`Até ${formatDay(deadline, today)}`} selected onPress={() => undefined} />
        ) : null}
      </View>

      <AppText variant="label">Contar progresso de</AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.wrapRow}
        accessibilityRole="radiogroup"
      >
        <Chip
          label="Patrimônio total"
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

      <AppText variant="caption">
        Ao concluir: +{CUSTOM_GOAL_REWARD.coins} moedas e +{CUSTOM_GOAL_REWARD.xp} XP, uma única
        vez.
      </AppText>
      <Button
        label={editing ? 'Salvar meta' : 'Criar meta'}
        onPress={save}
        disabled={!name.trim() || cents < 100}
      />
      {editing ? (
        <Button label="Excluir meta" variant="danger" onPress={() => setConfirmDelete(true)} />
      ) : null}

      <Dialog
        visible={confirmDelete}
        title="Excluir meta?"
        message={editing ? `"${editing.name}" será removida.` : ''}
        confirmLabel="Excluir"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          if (editing && !doAct({ type: 'DELETE_GOAL', id: editing.id }).error) onDone();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  text: { fontSize: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wrapRow: { flexDirection: 'row', gap: 8 },
});
