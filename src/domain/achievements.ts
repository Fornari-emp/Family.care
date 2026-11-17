/** Conquistas: 6 do protótipo + 9 novas, todas avaliadas como funções puras do estado. */
import { getLevel } from './levels';
import { holdingsByCategory, totalInvested } from './portfolio';
import type { GameState } from './types';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  check: (s: GameState) => boolean;
}

const contributions = (s: GameState) => s.entries.filter((e) => e.kind === 'contribution').length;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first-contribution',
    title: 'Primeiro Aporte',
    description: 'Registre seu primeiro aporte',
    icon: 'coin',
    check: (s) => s.stats.contributionsCount >= 1 || contributions(s) >= 1,
  },
  {
    id: 'streak-7',
    title: '7 Dias Seguidos',
    description: 'Alcance 7 dias de sequência',
    icon: 'flame',
    check: (s) => s.streak.best >= 7,
  },
  {
    id: 'level-7',
    title: 'Nível 7',
    description: 'Chegue ao nível 7',
    icon: 'star',
    check: (s) => getLevel(s.xp) >= 7,
  },
  {
    id: 'total-1k',
    title: 'R$ 1.000',
    description: 'Tenha R$ 1.000 registrados',
    icon: 'chart',
    check: (s) => totalInvested(s.entries) >= 100_000,
  },
  {
    id: 'total-10k',
    title: 'R$ 10.000',
    description: 'Tenha R$ 10.000 registrados',
    icon: 'gem',
    check: (s) => totalInvested(s.entries) >= 1_000_000,
  },
  {
    id: 'level-15',
    title: 'Nível 15',
    description: 'Chegue ao nível 15',
    icon: 'medal',
    check: (s) => getLevel(s.xp) >= 15,
  },
  {
    id: 'streak-30',
    title: '30 Dias Seguidos',
    description: 'Alcance 30 dias de sequência',
    icon: 'flame',
    check: (s) => s.streak.best >= 30,
  },
  {
    id: 'weeks-4',
    title: 'Mês Constante',
    description: 'Aporte em 4 semanas seguidas',
    icon: 'chart',
    check: (s) => s.weekRun.best >= 4,
  },
  {
    id: 'weeks-12',
    title: 'Trimestre Constante',
    description: 'Aporte em 12 semanas seguidas',
    icon: 'medal',
    check: (s) => s.weekRun.best >= 12,
  },
  {
    id: 'diversify-3',
    title: 'Diversificado',
    description: 'Tenha saldo em 3 categorias diferentes',
    icon: 'gem',
    check: (s) => holdingsByCategory(s.entries).length >= 3,
  },
  {
    id: 'custom-goal',
    title: 'Meta Pessoal',
    description: 'Conclua sua primeira meta personalizada',
    icon: 'star',
    check: (s) => s.goals.some((g) => g.kind === 'custom' && g.claimed),
  },
  {
    id: 'contributions-10',
    title: 'Hábito Criado',
    description: 'Registre 10 aportes',
    icon: 'coin',
    check: (s) => s.stats.contributionsCount >= 10,
  },
  {
    id: 'tips-7',
    title: 'Estudioso',
    description: 'Leia 7 dicas do dia',
    icon: 'sparkle',
    check: (s) => s.stats.tipsRead >= 7,
  },
  {
    id: 'first-purchase',
    title: 'Estilo Próprio',
    description: 'Compre seu primeiro item na loja',
    icon: 'bag',
    check: (s) => s.stats.purchases >= 1,
  },
  {
    id: 'league-podium',
    title: 'Pódio',
    description: 'Termine uma semana no top 3 da liga de treino',
    icon: 'crown',
    check: (s) => s.stats.leaguePodiums >= 1,
  },
];

/** Ids das conquistas que passam a valer agora (ainda não desbloqueadas). */
export function newlyUnlocked(state: GameState): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !state.achievements.includes(a.id) && a.check(state));
}
