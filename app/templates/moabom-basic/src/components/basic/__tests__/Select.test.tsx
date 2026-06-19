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

  it('게시판 카테고리처럼 bg-* 커스텀 className만 넘겨도 moa-reuse-select-row가 붙어야 한다', () => {
    const boardCategoryClass =
      'w-full sm:w-auto sm:min-w-48 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm';
    render(<Select options={opts} value="a" onChange={() => {}} className={boardCategoryClass} />);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('moa-reuse-select-row');
    expect(btn.className).toContain('items-center');
  });
});
