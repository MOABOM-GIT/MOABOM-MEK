import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlidingToggleSwitch } from './Moa_SlidingToggleSwitch';

afterEach(() => {
  cleanup();
});

describe('SlidingToggleSwitch', () => {
  it('role="switch" 및 상태에 맞는 aria-label·aria-checked를 노출한다', () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <SlidingToggleSwitch
        checked={false}
        onCheckedChange={onCheckedChange}
        ariaLabelWhenOn="닫기"
        ariaLabelWhenOff="열기"
      />,
    );

    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAttribute('aria-label', '열기');

    rerender(
      <SlidingToggleSwitch
        checked
        onCheckedChange={onCheckedChange}
        ariaLabelWhenOn="닫기"
        ariaLabelWhenOff="열기"
      />,
    );
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).toHaveAttribute('aria-label', '닫기');
  });

  it('클릭 시 onCheckedChange를 호출한다', () => {
    const onCheckedChange = vi.fn();
    render(
      <SlidingToggleSwitch
        checked={false}
        onCheckedChange={onCheckedChange}
        ariaLabelWhenOn="A"
        ariaLabelWhenOff="B"
      />,
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
  });

  it('checked 상태에서 썸 이동은 rem 기반 translate 클래스를 사용한다', () => {
    const { rerender } = render(
      <SlidingToggleSwitch
        checked={false}
        onCheckedChange={vi.fn()}
        ariaLabelWhenOn="A"
        ariaLabelWhenOff="B"
      />,
    );
    const thumb = screen.getByRole('switch').querySelector('span');
    expect(thumb).toHaveClass('translate-x-0');
    expect(thumb).not.toHaveStyle({ transform: 'translateX(20px)' });

    rerender(
      <SlidingToggleSwitch
        checked
        onCheckedChange={vi.fn()}
        ariaLabelWhenOn="A"
        ariaLabelWhenOff="B"
      />,
    );
    expect(thumb).toHaveClass('translate-x-5');
  });

  it('비활성 트랙은 시각용 클래스를 포함한다', () => {
    render(
      <SlidingToggleSwitch
        checked={false}
        onCheckedChange={vi.fn()}
        ariaLabelWhenOn="A"
        ariaLabelWhenOff="B"
      />,
    );
    expect(screen.getByRole('switch')).toHaveClass('moa-sliding-toggle--off');
  });
});
