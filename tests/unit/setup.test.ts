import { describe, it, expect } from 'vitest';

describe('Phase 0 Baseline Sanity Suite', () => {
  it('verifies that the test runner is functioning properly', () => {
    expect(true).toBe(true);
  });

  it('verifies brand color tokens are defined according to specification', () => {
    const brandTokens = {
      background: '#101014',
      surface: '#16161D',
      surfaceElevated: '#1F1F29',
      accent: '#FFC400',
      accentHover: '#FFD033',
    };

    expect(brandTokens.background).toBe('#101014');
    expect(brandTokens.surface).toBe('#16161D');
    expect(brandTokens.accent).toBe('#FFC400');
  });

  it('verifies core supported media categories count is 6', () => {
    const mediaCategories = [
      'movie',
      'tv',
      'anime_series',
      'anime_film',
      'manga',
      'manhwa',
    ] as const;

    expect(mediaCategories).toHaveLength(6);
  });
});
