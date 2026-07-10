import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Button } from '../../../components/basic/Button';
import { Div } from '../../../components/basic/Div';
import { Icon } from '../../../components/basic/Icon';
import { Input } from '../../../components/basic/Input';
import { Span } from '../../../components/basic/Span';
import { useMoaBoundedPointerDrag } from '../../../hooks/useMoaBoundedPointerDrag';
import { APP_SHELL_BODY_CLASS, APP_SHELL_INPUT_CLASS } from '../../appShellTypography';
import {
  liquidGlassOverlayClass,
  MOA_LIQUID_GLASS_CHIP_CLASS,
  MOA_LIQUID_GLASS_SURFACE_CLASS,
} from '../../generated/liquidGlassOverlay';
import { useIframeBackdropTone } from '../../generated/useIframeBackdropTone';
import {
  buildInspectorPatchPrompt,
  parseInspectorSelectionMessage,
  postPreviewInspectorMode,
  type InspectorSelection,
} from './inspectorSelection';

type TranslateFn = (key: string) => string;

export interface AiAppInspectorPanelProps {
  enabled: boolean;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  /** srcDoc(브릿지 주입본) 변경 시 enable 재동기화 · 배경 톤 추정 */
  previewHtml: string;
  disabled?: boolean;
  onRequestPatch: (prompt: string) => void;
  t: TranslateFn;
}

export function AiAppInspectorPanel({
  enabled,
  iframeRef,
  previewHtml,
  disabled = false,
  onRequestPatch,
  t,
}: AiAppInspectorPanelProps) {
  const [active, setActive] = useState(false);
  const [selection, setSelection] = useState<InspectorSelection | null>(null);
  const [requestText, setRequestText] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    style,
    isDragging,
    handleClassName,
    targetClassName,
    resetPosition,
    pointerHandlers,
    shouldSuppressClick,
  } = useMoaBoundedPointerDrag({
    targetRef: panelRef,
    enabled,
  });

  const getToggleAnchor = useCallback(
    () => panelRef.current?.querySelector<HTMLElement>('.moa-ai-inspector-toggle') ?? null,
    [],
  );

  const { tone: backdropTone, requestBackdropProbe } = useIframeBackdropTone({
    iframeRef,
    enabled,
    staticHtml: previewHtml,
    isDragging,
    contentKey: previewHtml || null,
    getAnchorElement: getToggleAnchor,
    fallbackCorner: 'top-left',
  });

  const chipClass = liquidGlassOverlayClass(
    backdropTone,
    MOA_LIQUID_GLASS_CHIP_CLASS,
    'moa-ai-inspector-toggle',
  );
  const bodyClass = liquidGlassOverlayClass(
    backdropTone,
    MOA_LIQUID_GLASS_SURFACE_CLASS,
    'moa-ai-inspector-panel__body',
  );

  const disableInspector = useCallback(() => {
    setActive(false);
    setSelection(null);
    postPreviewInspectorMode(iframeRef.current, false);
  }, [iframeRef]);

  const enableInspector = useCallback(() => {
    setActive(true);
    postPreviewInspectorMode(iframeRef.current, true);
  }, [iframeRef]);

  const toggleInspector = () => {
    if (disabled || shouldSuppressClick()) {
      return;
    }
    requestBackdropProbe();
    if (active) {
      disableInspector();
      return;
    }
    enableInspector();
  };

  useEffect(() => {
    if (!enabled || !active || disabled) {
      return;
    }
    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }

    const sync = () => {
      postPreviewInspectorMode(iframe, true);
    };
    sync();
    iframe.addEventListener('load', sync);
    const timer = window.setTimeout(sync, 50);
    return () => {
      iframe.removeEventListener('load', sync);
      window.clearTimeout(timer);
    };
  }, [enabled, active, disabled, iframeRef, previewHtml]);

  useEffect(() => {
    if (!enabled || !active) {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      const next = parseInspectorSelectionMessage(event.data);
      if (next) {
        setSelection(next);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [enabled, active, iframeRef]);

  useEffect(() => {
    if ((!enabled || disabled) && active) {
      disableInspector();
    }
  }, [enabled, disabled, active, disableInspector]);

  useEffect(() => () => {
    postPreviewInspectorMode(iframeRef.current, false);
  }, [iframeRef]);

  useEffect(() => {
    if (!enabled) {
      resetPosition();
    }
  }, [enabled, resetPosition]);

  if (!enabled) {
    return null;
  }

  return (
    <Div
      ref={panelRef}
      className={`moa-ai-inspector-panel${active ? ' is-active' : ''}${targetClassName ? ` ${targetClassName}` : ''}`}
      style={style}
    >
      <Div className="moa-ai-inspector-panel__toolbar">
        <Button
          type="button"
          aria-disabled={disabled || undefined}
          onClick={toggleInspector}
          {...pointerHandlers}
          className={`${chipClass} ${handleClassName}${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
          aria-pressed={active}
        >
          <Icon name="crosshairs" className="moa-ai-inspector-toggle__icon" aria-hidden />
          <Span className="moa-ai-inspector-toggle__label">
            {active ? t('moa_apps_ai.inspector.active') : t('moa_apps_ai.inspector.enable')}
          </Span>
        </Button>
        {active ? (
          <Button
            type="button"
            disabled={disabled}
            onClick={disableInspector}
            className={`${chipClass} moa-liquid-glass-chip--secondary`}
          >
            <Span className="moa-ai-inspector-toggle__label">
              {t('moa_apps_ai.inspector.cancel')}
            </Span>
          </Button>
        ) : null}
      </Div>
      {active ? (
        <Div className={bodyClass}>
          <Div className="text-sm moa-ai-inspector-panel__hint">
            {selection
              ? t('moa_apps_ai.inspector.selected_hint')
              : t('moa_apps_ai.inspector.hint')}
          </Div>
          {selection ? (
            <>
              <Div className={`${APP_SHELL_BODY_CLASS} moa-ai-inspector-panel__path`}>
                {selection.cssPath}
              </Div>
              <Input
                className={APP_SHELL_INPUT_CLASS}
                value={requestText}
                onChange={(event) => setRequestText(event.target.value)}
                placeholder={t('moa_apps_ai.inspector.request_placeholder')}
                disabled={disabled}
              />
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={disabled}
                onClick={() => {
                  onRequestPatch(buildInspectorPatchPrompt(selection, requestText));
                  disableInspector();
                  setRequestText('');
                }}
              >
                {t('moa_apps_ai.inspector.apply_patch')}
              </Button>
            </>
          ) : null}
        </Div>
      ) : null}
    </Div>
  );
}
