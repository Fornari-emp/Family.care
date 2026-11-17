import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Disclaimer } from './Disclaimer';
import { Header } from './Header';
import { colors } from '@/theme';

/** Tela de aba: cabeçalho fixo + conteúdo rolável + aviso legal no fim. */
export function Screen({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View style={styles.root} testID={testID}>
      <Header />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
          <Disclaimer />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
});
