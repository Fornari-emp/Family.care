import { ACHIEVEMENTS, newlyUnlocked } from '@/domain/achievements';
import { chestReward } from '@/domain/chest';
import { leagueStandings, LEAGUE_NAME, playerPosition, rivalXpAt } from '@/domain/league';
import { hashString, seededInt, seededUnit } from '@/domain/random';
import {
  buyItem,
  equipItem,
  ITEMS,
  previewLoadout,
  SHOP_GROUPS,
  STREAK_FREEZE,
  unequipSlot,
} from '@/domain/shop';
import { tipForDay, TIPS } from '@/content/tips';
import { fresh } from '../helpers/game';

describe('loja', () => {
  it('18 itens em 5 grupos', () => {
    expect(ITEMS).toHaveLength(18);
    expect(SHOP_GROUPS).toHaveLength(5);
    for (const g of SHOP_GROUPS) expect(ITEMS.some((i) => i.slot === g.slot)).toBe(true);
  });

  it('comprar desconta, adiciona e equipa', () => {
    const s = fresh();
    const r = buyItem(s, 'acc-glasses');
    if ('error' in r) throw new Error(r.error);
    expect(r.state.coins).toBe(s.coins - 120);
    expect(r.state.ownedItems).toContain('acc-glasses');
    expect(r.state.equipped.accessory).toBe('acc-glasses');
    expect(buyItem(r.state, 'acc-glasses')).toEqual({ error: 'already-owned' });
  });

  it('erros de compra', () => {
    const s = fresh();
    expect(buyItem(s, 'suit-diamond')).toEqual({ error: 'insufficient-coins' });
    expect(buyItem(s, 'nope')).toEqual({ error: 'not-found' });
    expect(buyItem({ ...s, coins: 0 }, STREAK_FREEZE.id)).toEqual({ error: 'insufficient-coins' });
  });

  it('congelar sequência: máx. 2 guardados', () => {
    let s = { ...fresh(), coins: 10_000 };
    for (let i = 0; i < 2; i++) {
      const r = buyItem(s, STREAK_FREEZE.id);
      if ('error' in r) throw new Error(r.error);
      s = r.state;
    }
    expect(s.streak.freezes).toBe(2);
    expect(s.coins).toBe(10_000 - 2 * STREAK_FREEZE.price);
    expect(buyItem(s, STREAK_FREEZE.id)).toEqual({ error: 'freeze-limit' });
  });

  it('equipar, desequipar e prévia antes de comprar', () => {
    const s = fresh();
    expect(equipItem(s, 'pet-pig')).toEqual({ error: 'not-owned' });
    expect(equipItem(s, 'nope')).toEqual({ error: 'not-found' });
    const eq = equipItem(s, 'suit-basic');
    expect('state' in eq && eq.state.equipped.suit).toBe('suit-basic');
    expect(unequipSlot(s, 'suit')).toEqual({ error: 'cannot-unequip-suit' });
    const un = unequipSlot({ ...s, equipped: { ...s.equipped, pet: 'pet-pig' } }, 'pet');
    expect('state' in un && un.state.equipped.pet).toBeNull();
    const preview = previewLoadout(s.equipped, 'aura-violet');
    expect(preview.aura).toBe('aura-violet');
    expect(s.equipped.aura).toBeNull(); // não altera o estado real
    expect(previewLoadout(s.equipped, 'nope')).toBe(s.equipped);
  });
});

describe('liga de treino (item 18)', () => {
  it('determinística por semana e crescente ao longo da semana', () => {
    expect(rivalXpAt('2026-W47', 0, 0.5)).toBe(rivalXpAt('2026-W47', 0, 0.5));
    expect(rivalXpAt('2026-W47', 0, 0)).toBe(0);
    const a = rivalXpAt('2026-W47', 1, 0.3);
    const b = rivalXpAt('2026-W47', 1, 0.8);
    expect(b).toBeGreaterThanOrEqual(a);
    expect(rivalXpAt('2026-W47', 1, 2)).toBe(rivalXpAt('2026-W47', 1, 1));
  });

  it('rivais são identificados como fictícios e o jogador aparece', () => {
    expect(LEAGUE_NAME).toBe('Liga de treino');
    const rows = leagueStandings('2026-W47', 1, { name: 'Ana', xp: 5000 });
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({ name: 'Ana', isPlayer: true, position: 1 });
    expect(rows.filter((r) => r.isBot)).toHaveLength(5);
    expect(playerPosition('2026-W47', 1, 0)).toBe(6);
    // empate: jogador à frente
    const tie = leagueStandings('2026-W47', 0, { name: 'Ana', xp: 0 });
    expect(tie[0]?.isPlayer).toBe(true);
  });
});

describe('baú, aleatório, conquistas e dicas', () => {
  it('baú determinístico por dia, entre 40 e 120 moedas', () => {
    expect(chestReward('2026-11-17')).toEqual(chestReward('2026-11-17'));
    for (let d = 1; d <= 28; d++) {
      const { coins, xp } = chestReward(`2026-02-${String(d).padStart(2, '0')}`);
      expect([40, 60, 80, 100, 120]).toContain(coins);
      expect(xp).toBe(50);
    }
  });

  it('random', () => {
    expect(hashString('a')).toBe(hashString('a'));
    expect(hashString('a')).not.toBe(hashString('b'));
    const u = seededUnit('x');
    expect(u).toBeGreaterThanOrEqual(0);
    expect(u).toBeLessThan(1);
    expect(seededInt('x', 3, 3)).toBe(3);
  });

  it('~15 conquistas com ids únicos', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(newlyUnlocked(fresh())).toEqual([]);
  });

  it('bug 7: dica do dia real, rotacionando por data', () => {
    expect(TIPS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length);
    expect(tipForDay('2026-11-17')).toBe(tipForDay('2026-11-17'));
    expect(tipForDay('2026-11-17')).not.toBe(tipForDay('2026-11-18'));
    expect(tipForDay('2025-06-01').title.length).toBeGreaterThan(0);
    for (const t of TIPS) expect(t.body.length).toBeGreaterThan(60);
  });

  it('item 19: nenhuma dica recomenda um ativo', () => {
    const banned = /\b(compre|invista em|recomendamos|aposte)\b/i;
    for (const t of TIPS) expect(`${t.title} ${t.body}`).not.toMatch(banned);
  });
});
