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

  it('matches expanded title and prompt keywords', () => {
    expect(resolveGeneratedAppIconFromTitle('세금 계산기', '', 'html_paste')).toBe('calculator');
    expect(resolveGeneratedAppIconFromTitle('할일 메모', '체크리스트', 'general')).toBe('tasks');
    expect(resolveGeneratedAppIconFromTitle('날씨 예보', '', 'general')).toBe('cloud-sun');
    expect(resolveGeneratedAppIconFromTitle('쇼핑 장바구니', '', 'html_paste')).toBe('shopping-cart');
    expect(resolveGeneratedAppIconFromTitle('채팅 상담', '', 'general')).toBe('comments');
    expect(resolveGeneratedAppIconFromTitle('HTML 도구', '개발용', 'html_paste')).toBe('code');
  });

  it('falls back to link icon for generic website titles', () => {
    expect(resolveGeneratedAppIconFromTitle('알파', '', 'website_link')).toBe('link');
  });

  it('falls back to sparkles for unmatched html_paste titles', () => {
    expect(resolveGeneratedAppIconFromTitle('알파', '', 'html_paste')).toBe('sparkles');
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
