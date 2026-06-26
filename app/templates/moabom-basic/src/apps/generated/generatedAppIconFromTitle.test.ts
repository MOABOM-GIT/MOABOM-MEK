import { describe, expect, it } from 'vitest';
import {
  buildWebsiteLinkGradientFromPointColor,
  normalizeWebsitePointColor,
  resolveGeneratedAppIconFromTitle,
} from './generatedAppIconFromTitle';

describe('generatedAppIconFromTitle', () => {
  it('matches medical keywords for NHIS-style titles', () => {
    expect(resolveGeneratedAppIconFromTitle('국민건강보험', '공단 포털', 'website_link')).toBe('notes-medical');
  });

  it('falls back to link icon for generic website titles', () => {
    expect(resolveGeneratedAppIconFromTitle('내 사이트', '', 'website_link')).toBe('link');
  });

  it('normalizes theme-color hex values', () => {
    expect(normalizeWebsitePointColor('#005EB8')).toBe('#005eb8');
    expect(normalizeWebsitePointColor('rgb(0, 94, 184)')).toBe('#005eb8');
  });

  it('builds gradient from point color', () => {
    expect(buildWebsiteLinkGradientFromPointColor('#005eb8')).toMatch(
      /^linear-gradient\(135deg,#005eb8,#[0-9a-f]{6}\)$/,
    );
  });
});
