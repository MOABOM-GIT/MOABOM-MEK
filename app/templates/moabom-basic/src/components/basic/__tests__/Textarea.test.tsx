import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Textarea } from '../Textarea';

describe('Textarea', () => {
  it('className이 없으면 재사용 필드 표면(glass-sm + moa-field)을 적용해야 함', () => {
    render(<Textarea aria-label="본문" />);
    const el = screen.getByLabelText('본문');
    expect(el.className).toContain('glass-sm');
    expect(el.className).toContain('moa-field');
    expect(el.className).toContain('moa-field--textarea');
  });

  it('className에 bg-가 있으면 전달한 클래스만 사용해야 함', () => {
    const custom = 'w-full bg-gray-900 text-gray-100';
    render(<Textarea aria-label="코드" className={custom} />);
    expect(screen.getByLabelText('코드').className).toBe(custom);
  });

  it('이미 glass-sm + moa-field가 있으면 이중 병합하지 않아야 함', () => {
    const prebuilt = 'glass-sm moa-field moa-reuse-core moa-field--textarea moa-field--medium resize-none min-h-[80px]';
    render(<Textarea aria-label="소개" className={prebuilt} />);
    expect(screen.getByLabelText('소개').className).toBe(prebuilt);
  });

  it('유틸만 있으면 재사용 표면에 병합해야 함', () => {
    render(<Textarea aria-label="메모" className="min-h-[120px]" />);
    const el = screen.getByLabelText('메모');
    expect(el.className).toContain('glass-sm');
    expect(el.className).toContain('min-h-[120px]');
  });
});
