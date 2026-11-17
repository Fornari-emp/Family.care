import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { Outfit_800ExtraBold } from '@expo-google-fonts/outfit/800ExtraBold';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Dialog } from '@/components/Dialog';
import { FeedbackLayer } from '@/components/FeedbackLayer';
import { act } from '@/feedback/useAct';
import { gameStore, useGame } from '@/store';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_700Bold,
    Outfit_800ExtraBold,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const hydrated = useGame((s) => s.hydrated);
  const issue = useGame((s) => s.issue);

  useEffect(() => {
    gameStore
      .getState()
      .hydrate()
      .catch((e: unknown) => console.warn('[invest-level] falha ao carregar', e));
  }, []);

  // Ao voltar para o app, aplica a virada de dia/semana (sequência, baú, missões).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && gameStore.getState().hydrated) act({ type: 'SYNC' });
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (fontError)
      console.warn('[invest-level] fontes indisponíveis, usando as do sistema', fontError);
  }, [fontError]);
  const ready = hydrated && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return <View style={styles.root} />;

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen name="dica" options={{ presentation: 'modal' }} />
        </Stack>
        <FeedbackLayer />
        <Dialog
          visible={!!issue}
          title="Aviso"
          message={issue ?? ''}
          confirmLabel="Entendi"
          cancelLabel="Fechar"
          onConfirm={() => gameStore.getState().dismissIssue()}
          onCancel={() => gameStore.getState().dismissIssue()}
        />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg } });
