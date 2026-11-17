/**
 * Camada fixa sobre TODAS as telas (item 20): toasts, chuva de moedas e overlays.
 * Fica fora do ScrollView, então nunca some ao rolar.
 */
import { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';
import { rankTitle } from '@/domain/levels';
import { seededUnit } from '@/domain/random';
import { useFeedback } from '@/feedback/feedbackStore';
import type { Tone } from '@/feedback/mapEvents';
import { alpha, colors, fonts, radius } from '@/theme';

const TONE_COLOR: Record<Tone, string> = {
  gold: colors.gold,
  xp: colors.xp,
  money: colors.money,
  flame: colors.flame,
  danger: colors.danger,
  neutral: colors.textMuted,
};

function Toasts() {
  const toasts = useFeedback((s) => s.toasts);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={[styles.toasts, { top: insets.top + 8 }]}>
      {toasts.map((t) => (
        <Animated.View
          key={t.id}
          entering={FadeInUp.duration(220)}
          exiting={FadeOutUp.duration(200)}
          style={styles.toast}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <View style={[styles.dot, { backgroundColor: TONE_COLOR[t.tone] }]} />
          <AppText style={styles.toastText}>{t.message}</AppText>
        </Animated.View>
      ))}
    </View>
  );
}

function Coin({ index, burstKey }: { index: number; burstKey: number }) {
  const t = useSharedValue(0);
  // Trajetória pseudoaleatória determinística (render puro).
  const dx = seededUnit(`${burstKey}:x:${index}`) * 240 - 120;
  const dy = -90 - seededUnit(`${burstKey}:y:${index}`) * 150;
  useEffect(() => {
    t.value = 0;
    t.value = withDelay(index * 35, withTiming(1, { duration: 1100 }));
  }, [burstKey, index, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1 - t.value,
    transform: [
      { translateX: dx * t.value },
      { translateY: dy * t.value },
      { scale: 0.4 + 0.7 * t.value },
    ],
  }));
  return (
    <Animated.View style={[styles.coin, style]}>
      <Icon name="coin" size={22} color={colors.gold} fill={alpha(colors.gold, 0.25)} />
    </Animated.View>
  );
}

function CoinBurst() {
  const burstKey = useFeedback((s) => s.burstKey);
  const reduceMotion = useReducedMotion();
  if (burstKey === 0 || reduceMotion) return null;
  return (
    <View
      pointerEvents="none"
      style={styles.burst}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: 14 }, (_, i) => (
        <Coin key={`${burstKey}-${i}`} index={i} burstKey={burstKey} />
      ))}
    </View>
  );
}

function Pop({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const s = useSharedValue(reduceMotion ? 1 : 0.7);
  useEffect(() => {
    if (!reduceMotion) s.value = withSequence(withSpring(1.06), withSpring(1));
  }, [reduceMotion, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View
      entering={reduceMotion ? undefined : ZoomIn.duration(250)}
      style={[styles.panel, style]}
    >
      {children}
    </Animated.View>
  );
}

function LevelUpOverlay() {
  const levelUp = useFeedback((s) => s.levelUp);
  const close = useFeedback((s) => s.closeLevelUp);
  if (!levelUp) return null;
  const many = levelUp.levels > 1;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pop>
          <View style={styles.badge}>
            <Icon name="star" size={40} color={colors.textOnAccent} fill={colors.textOnAccent} />
          </View>
          <AppText variant="label" color={colors.gold} center>
            {many ? `Você subiu ${levelUp.levels} níveis!` : 'Subiu de nível!'}
          </AppText>
          <AppText
            accessibilityRole="header"
            style={styles.levelText}
            center
            accessibilityLabel={`Nível ${levelUp.level}, ${rankTitle(levelUp.level)}`}
          >
            Nível {levelUp.level}
          </AppText>
          <AppText variant="small" center>
            {rankTitle(levelUp.level)} · +{levelUp.bonusCoins} moedas de bônus já creditadas
          </AppText>
          <Button label="Continuar" onPress={close} style={styles.cta} />
        </Pop>
      </View>
    </Modal>
  );
}

function ChestOverlay() {
  const chest = useFeedback((s) => s.chest);
  const levelUp = useFeedback((s) => s.levelUp);
  const close = useFeedback((s) => s.closeChest);
  // O level-up (se houver) aparece depois do baú.
  if (!chest) return null;
  return (
    <Modal
      transparent
      visible={!!chest && !levelUp}
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pop>
          <View style={[styles.badge, { backgroundColor: colors.orange }]}>
            <Icon name="chest" size={40} color={colors.textOnAccent} />
          </View>
          <AppText accessibilityRole="header" style={styles.levelText} center>
            Baú aberto!
          </AppText>
          <AppText variant="body" center color={colors.goldLight}>
            +{chest.coins} moedas · +{chest.xp} XP
          </AppText>
          <Button label="Coletar" onPress={close} style={styles.cta} />
        </Pop>
      </View>
    </Modal>
  );
}

export function FeedbackLayer() {
  return (
    <>
      <CoinBurst />
      <Toasts />
      <ChestOverlay />
      <LevelUpOverlay />
    </>
  );
}

const styles = StyleSheet.create({
  toasts: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 7, zIndex: 40 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#211A12',
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    maxWidth: 420,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  toastText: { fontFamily: fonts.bodyBold, fontSize: 13, flexShrink: 1 },
  burst: { position: 'absolute', left: 0, right: 0, top: '45%', alignItems: 'center', zIndex: 30 },
  coin: { position: 'absolute' },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.45),
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  levelText: { fontFamily: fonts.display, fontSize: 34, color: colors.text },
  cta: { alignSelf: 'stretch', marginTop: 10 },
});
