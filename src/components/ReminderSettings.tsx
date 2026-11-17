import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { SwitchRow } from './SwitchRow';
import { feedbackStore } from '@/feedback/feedbackStore';
import { useAct } from '@/feedback/useAct';
import { ensurePermission } from '@/notifications/reminders';
import { useGame } from '@/store';
import { colors, fonts, MIN_TOUCH, radius } from '@/theme';

const pad = (n: number) => String(n).padStart(2, '0');

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (d: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(-1)}
        accessibilityRole="button"
        accessibilityLabel={`Diminuir ${label}`}
        style={styles.btn}
      >
        <Icon name="minus" size={16} color={colors.text} />
      </Pressable>
      <AppText style={styles.value} accessibilityLabel={`${label}: ${value}`}>
        {value}
      </AppText>
      <Pressable
        onPress={() => onChange(1)}
        accessibilityRole="button"
        accessibilityLabel={`Aumentar ${label}`}
        style={styles.btn}
      >
        <Icon name="plus" size={16} color={colors.text} />
      </Pressable>
    </View>
  );
}

/** Lembrete diário opcional no horário escolhido. */
export function ReminderSettings() {
  const reminder = useGame((s) => s.state.profile.reminder);
  const doAct = useAct();
  const set = (patch: Partial<typeof reminder>) =>
    doAct({ type: 'UPDATE_PROFILE', patch: { reminder: { ...reminder, ...patch } } });

  const toggle = async (enabled: boolean) => {
    if (enabled && !(await ensurePermission())) {
      feedbackStore
        .getState()
        .toast('Permissão de notificação negada. Ative nas configurações do aparelho.', 'danger');
      return;
    }
    set({ enabled });
  };

  return (
    <View>
      <SwitchRow
        label="Lembrete diário"
        hint="Avisa no horário escolhido se você ainda não garantiu a sequência do dia."
        value={reminder.enabled}
        onChange={(v) => void toggle(v)}
      />
      {reminder.enabled ? (
        <View
          style={styles.row}
          accessibilityLabel={`Horário do lembrete: ${pad(reminder.hour)}:${pad(reminder.minute)}`}
        >
          <Stepper
            label="hora"
            value={pad(reminder.hour)}
            onChange={(d) => set({ hour: (reminder.hour + d + 24) % 24 })}
          />
          <AppText style={styles.colon}>:</AppText>
          <Stepper
            label="minutos"
            value={pad(reminder.minute)}
            onChange={(d) =>
              set({ minute: (Math.floor(reminder.minute / 15) * 15 + d * 15 + 60) % 60 })
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontFamily: fonts.display, fontSize: 22, minWidth: 34, textAlign: 'center' },
  colon: { fontFamily: fonts.display, fontSize: 22 },
});
