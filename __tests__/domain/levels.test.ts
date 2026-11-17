import { getLevel, levelProgress, MAX_LEVEL, rankTitle, XP_THRESHOLDS } from '@/domain/levels';

describe('níveis', () => {
  it('getLevel segue a tabela do protótipo', () => {
    expect(getLevel(0)).toBe(1);
    expect(getLevel(99)).toBe(1);
    expect(getLevel(100)).toBe(2);
    expect(getLevel(3300)).toBe(8);
    expect(getLevel(66200)).toBe(21);
    expect(getLevel(1_000_000)).toBe(21);
    expect(MAX_LEVEL).toBe(XP_THRESHOLDS.length);
  });

  it('títulos por faixa', () => {
    expect(rankTitle(1)).toBe('Iniciante');
    expect(rankTitle(4)).toBe('Poupador');
    expect(rankTitle(10)).toBe('Investidor');
    expect(rankTitle(11)).toBe('Estrategista');
    expect(rankTitle(15)).toBe('Especialista');
    expect(rankTitle(21)).toBe('Magnata');
  });

  it('progresso dentro do nível', () => {
    const p = levelProgress(175);
    expect(p).toMatchObject({
      level: 2,
      floorXp: 100,
      nextXp: 250,
      isMax: false,
      rank: 'Iniciante',
    });
    expect(p.ratio).toBeCloseTo(0.5);
  });

  it('bug 11: nível máximo tem estado explícito, sem divisão estranha', () => {
    // protótipo: next = base + 12000 e a barra travava sem aviso
    const p = levelProgress(70_000);
    expect(p).toEqual({
      level: 21,
      rank: 'Magnata',
      floorXp: 66200,
      nextXp: null,
      ratio: 1,
      isMax: true,
    });
  });
});
