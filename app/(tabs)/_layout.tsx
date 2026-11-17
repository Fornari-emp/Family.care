import { Redirect, Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components/Icon';
import { useGame } from '@/store';
import { colors, fonts } from '@/theme';

const TABS: { name: string; title: string; icon: IconName; hint: string }[] = [
  { name: 'index', title: 'Início', icon: 'home', hint: 'Personagem, baú, sequência e missões' },
  { name: 'investir', title: 'Investir', icon: 'chart', hint: 'Registrar aportes e ver carteira' },
  { name: 'metas', title: 'Metas', icon: 'trophy', hint: 'Metas de patrimônio e liga de treino' },
  { name: 'loja', title: 'Loja', icon: 'bag', hint: 'Itens para o seu investidor' },
  { name: 'perfil', title: 'Perfil', icon: 'user', hint: 'Conquistas e configurações' },
];

/** Abas nativas do Expo Router: barra sempre fixa no rodapé (item 20). */
export default function TabsLayout() {
  const onboarded = useGame((s) => s.state.profile.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: { backgroundColor: '#140F0B', borderTopColor: colors.border, minHeight: 60 },
        tabBarLabelStyle: { fontFamily: fonts.bodyHeavy, fontSize: 10.5 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarAccessibilityLabel: `${t.title}. ${t.hint}`,
            tabBarIcon: ({ color }) => (
              <Icon
                name={t.icon}
                size={22}
                color={typeof color === 'string' ? color : colors.textSubtle}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
