import { useEffect, useRef, type ReactNode } from 'react';
import type { LiquidGlassBackdropTone } from '../../components/composite/liquidGlassBackdropTone';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { useMoaBoundedPointerDrag } from '../../hooks/useMoaBoundedPointerDrag';
import {
  liquidGlassOverlayClass,
  MOA_LIQUID_GLASS_SURFACE_CLASS,
} from './liquidGlassOverlay';

export interface GeneratedAppSidePanelShellProps {
  open: boolean;
  title: string;
  closeLabel: string;
  backdropTone: LiquidGlassBackdropTone | null | undefined;
  onClose: () => void;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * 버전 기록·데이터 콘솔 공통 셸 — liquid-glass + 배경톤 대비 텍스트.
 * 헤더 타이틀 영역으로 경계 내 드래그(클릭과 분리).
 */
export function GeneratedAppSidePanelShell({
  open,
  title,
  closeLabel,
  backdropTone,
  onClose,
  meta,
  actions,
  children,
}: GeneratedAppSidePanelShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    style,
    handleClassName,
    targetClassName,
    resetPosition,
    pointerHandlers,
  } = useMoaBoundedPointerDrag({
    targetRef: panelRef,
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      resetPosition();
    }
  }, [open, resetPosition]);

  if (!open) {
    return null;
  }

  return (
    <Div
      ref={panelRef}
      className={`${liquidGlassOverlayClass(
        backdropTone,
        MOA_LIQUID_GLASS_SURFACE_CLASS,
        'generated-app-side-panel',
      )}${targetClassName ? ` ${targetClassName}` : ''}`}
      role="dialog"
      aria-label={title}
      style={style}
    >
      <Div className="generated-app-side-panel__header">
        <Div
          className={`generated-app-side-panel__title ${handleClassName}`}
          {...pointerHandlers}
        >
          {title}
        </Div>
        <Button
          type="button"
          variant="neutral"
          size="xs"
          className="generated-app-side-panel__icon-btn"
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <Icon name="times" aria-hidden />
        </Button>
      </Div>
      {meta ? <Div className="generated-app-side-panel__meta">{meta}</Div> : null}
      {actions ? <Div className="generated-app-side-panel__actions">{actions}</Div> : null}
      <Div className="generated-app-side-panel__body">{children}</Div>
    </Div>
  );
}
