import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SwitchCheckbox } from '../SwitchCheckbox';

describe('SwitchCheckbox 컴포넌트', () => {
  it('레이블과 체크박스를 함께 렌더링해야 함', () => {
    render(<SwitchCheckbox label="이용약관 동의" />);

    expect(screen.getByLabelText('이용약관 동의')).toBeInTheDocument();
  });

  it('클릭 시 onChange를 호출해야 함', () => {
    const onChange = vi.fn();
    render(<SwitchCheckbox label="개인정보 동의" onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('개인정보 동의'));

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
