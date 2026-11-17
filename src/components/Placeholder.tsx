import { StyleSheet, Text, View } from 'react-native';

/** Tela provisória da Fase 1 — substituída na Fase 2. */
export function Placeholder({ title }: { title: string }) {
  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.sub}>Em construção (Fase 2)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#100D0A' },
  title: { color: '#F6EEE0', fontSize: 22, fontWeight: '800' },
  sub: { color: '#C2B29A', marginTop: 6 },
});
