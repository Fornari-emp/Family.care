import { Tabs } from 'expo-router';

// Fase 2: ícones SVG, tema e acessibilidade completos.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="investir" options={{ title: 'Investir' }} />
      <Tabs.Screen name="metas" options={{ title: 'Metas' }} />
      <Tabs.Screen name="loja" options={{ title: 'Loja' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
