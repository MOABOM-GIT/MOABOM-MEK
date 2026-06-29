import type { PointerEvent } from 'react';
import { Button } from '../../components/basic/Button';
import { Icon } from '../../components/basic/Icon';

export interface AiGenerationSplitHandleProps {
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onNudgeUp: () => void;
  onNudgeDown: () => void;
  ariaLabel: string;
  nudgeUpLabel: string;
  nudgeDownLabel: string;
}

export function AiGenerationSplitHandle({
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onNudgeUp,
  onNudgeDown,
  ariaLabel,
  nudgeUpLabel,
  nudgeDownLabel,
}: AiGenerationSplitHandleProps) {
  return (
    <div className="moa-ai-split-handle-row" role="separator" aria-orientation="horizontal" aria-label={ariaLabel}>
      <Button
        type="button"
        variant="dark-outline"
        size="xxs"
        className="moa-ai-split-handle-nudge"
        aria-label={nudgeUpLabel}
        onClick={onNudgeUp}
      >
        <Icon name="chevron-up" className="text-xs" aria-hidden />
      </Button>
      <button
        type="button"
        className="moa-ai-split-handle"
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="moa-ai-split-handle-grip" aria-hidden>
          <Icon name="arrows-alt-v" className="text-sm" />
        </span>
      </button>
      <Button
        type="button"
        variant="dark-outline"
        size="xxs"
        className="moa-ai-split-handle-nudge"
        aria-label={nudgeDownLabel}
        onClick={onNudgeDown}
      >
        <Icon name="chevron-down" className="text-xs" aria-hidden />
      </Button>
    </div>
  );
}
