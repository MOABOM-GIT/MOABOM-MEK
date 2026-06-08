import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from '../Input';

describe('Input', () => {
  it('className이 없으면 재사용 필드 토큰을 적용해야 함', () => {
    render(<Input aria-label="이름" />);
    const el = screen.getByLabelText('이름');
    expect(el.className).toContain('moa-reuse-core');
    expect(el.className).toContain('moa-field--medium');
  });

  it('type=checkbox 는 className 해석을 건너뛰어야 함', () => {
    render(<Input type="checkbox" aria-label="동의" className="peer" />);
    expect(screen.getByLabelText('동의').className).toBe('peer');
  });

  it('type=hidden 은 재사용 필드 클래스를 붙이지 않아야 함', () => {
    render(<Input type="hidden" name="x" value="1" />);
    const el = document.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(el.className).toBe('');
  });
});
