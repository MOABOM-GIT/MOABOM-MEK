import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { moaFieldControlClass, moaFieldSelectTriggerClass } from '../../../theme/moabomFieldSurface';
import { Select } from '../Select';

const opts = [{ value: 'a', label: 'Alpha' }];

describe('Select (커스텀 트리거)', () => {
  afterEach(() => {
    delete (window as unknown as { G7Core?: unknown }).G7Core;
  });

  it('className이 기본 트리거와 동일하면 glass-sm 토큰이 한 번만 있어야 한다', () => {
    const triggerDefault = moaFieldSelectTriggerClass('medium');
    render(<Select options={opts} value="a" onChange={() => {}} className={triggerDefault} />);
    const btn = screen.getByRole('button');
    const hits = (btn.className.match(/\bglass-sm\b/g) ?? []).length;
    expect(hits).toBe(1);
  });

  it('className이 비어 있으면 트리거 표면에 glass-sm 이 한 번만 있어야 한다', () => {
    render(<Select options={opts} value="a" onChange={() => {}} />);
    const btn = screen.getByRole('button');
    const hits = (btn.className.match(/\bglass-sm\b/g) ?? []).length;
    expect(hits).toBe(1);
  });

  it('인풋과 동일한 재사용 표면(moaFieldControlClass)만 넘겨도 moa-reuse-select-row가 붙어야 한다', () => {
    const inputSurface = moaFieldControlClass('medium');
    render(<Select options={opts} value="a" onChange={() => {}} className={inputSurface} />);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('moa-reuse-select-row');
    const hits = (btn.className.match(/\bglass-sm\b/g) ?? []).length;
    expect(hits).toBe(1);
  });
});
