import { alpha, contrastRatio, TEXT_BACKGROUNDS, TEXT_COLORS } from '@/theme';

describe('contraste WCAG AA (item 22)', () => {
  it.each(Object.entries(TEXT_COLORS))('%s ≥ 4,5:1 em todos os fundos', (_name, fg) => {
    for (const bg of TEXT_BACKGROUNDS) expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('os tons do protótipo reprovavam', () => {
    expect(contrastRatio('#655843', '#100D0A')).toBeLessThan(4.5);
    expect(contrastRatio('#5E5142', '#140F0B')).toBeLessThan(4.5);
  });

  it('alpha', () => {
    expect(alpha('#FFC53D', 0.5)).toBe('#FFC53D80');
    expect(alpha('#000000', 2)).toBe('#000000ff');
  });
});
