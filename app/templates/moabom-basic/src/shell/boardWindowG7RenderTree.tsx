import React, { useEffect, useMemo, useState } from 'react';
import type { BoardComponentDefinition } from './boardWindowLayoutRuntime';
import { mergeShellContextIntoGlobalState } from './ShellContextBridge';

type ActionDispatcherLike = {
  createHandler?: (
    action: { type: string; handler: string },
    dataContext: Record<string, unknown>,
  ) => () => void;
};

type DynamicRendererLike = React.ComponentType<{
  componentDef: BoardComponentDefinition;
  dataContext: Record<string, unknown>;
  translationContext: { templateId: string; locale: string };
  registry: unknown;
  bindingEngine: unknown;
  translationEngine: unknown;
  actionDispatcher: unknown;
  isRootRenderer?: boolean;
  parentDataContext?: Record<string, unknown>;
}>;

export function isBoardWindowModalDef(def: BoardComponentDefinition): boolean {
  return def.name === 'Modal' && typeof def.id === 'string' && def.id.length > 0;
}

/** layout.components + layout.modals 병합 배열을 본문·모달로 분리한다. */
export function splitBoardWindowComponentDefs(defs: BoardComponentDefinition[]): {
  contentDefs: BoardComponentDefinition[];
  modalDefs: BoardComponentDefinition[];
} {
  const contentDefs: BoardComponentDefinition[] = [];
  const modalDefs: BoardComponentDefinition[] = [];

  for (const def of defs) {
    if (isBoardWindowModalDef(def)) {
      modalDefs.push(def);
    } else {
      contentDefs.push(def);
    }
  }

  return { contentDefs, modalDefs };
}

type TemplateAppGlobalListener = {
  onGlobalStateChange?: (listener: (state: Record<string, unknown>) => void) => void;
  offGlobalStateChange?: (listener: (state: Record<string, unknown>) => void) => void;
  getGlobalState?: () => Record<string, unknown>;
};

function getTemplateAppGlobalListener(): TemplateAppGlobalListener | undefined {
  return (window as { __templateApp?: TemplateAppGlobalListener }).__templateApp;
}

/** 셸 게시판 윈도우 dataContext._global 을 TemplateApp 전역 상태와 동기화한다. */
export function mergeBoardWindowLiveGlobalState(
  baseContext: Record<string, unknown>,
): Record<string, unknown> {
  const liveGlobal = getTemplateAppGlobalListener()?.getGlobalState?.() ?? {};
  const baseGlobal =
    typeof baseContext._global === 'object' && baseContext._global != null
      ? (baseContext._global as Record<string, unknown>)
      : {};

  // AuthManager 기준 currentUser.uuid 를 매 렌더 재해석 — 캐시·불완전 live 객체로
  // 게시판 guest 폼(`!_global.currentUser?.uuid`)이 남는 회귀를 막는다.
  return {
    ...baseContext,
    _global: mergeShellContextIntoGlobalState({
      ...baseGlobal,
      ...liveGlobal,
    }),
  };
}

function resolveModalOpenState(
  modalId: string,
  dataContext: Record<string, unknown>,
): { isOpen: boolean; zIndex: number } {
  const global =
    typeof dataContext._global === 'object' && dataContext._global != null
      ? (dataContext._global as Record<string, unknown>)
      : {};
  const modalStack = Array.isArray(global.modalStack)
    ? (global.modalStack as string[])
    : [];
  const stackIndex = modalStack.indexOf(modalId);
  const isInStack = stackIndex >= 0;
  const isOpen = isInStack || global.activeModal === modalId;

  return {
    isOpen: Boolean(isOpen),
    zIndex: isInStack ? 50 + stackIndex : 50,
  };
}

export interface BoardWindowG7RenderTreeProps {
  componentDefs: BoardComponentDefinition[];
  dataContext: Record<string, unknown>;
  translationContext: { templateId: string; locale: string };
  registry: unknown;
  bindingEngine: unknown;
  translationEngine: unknown;
  actionDispatcher: unknown;
  layoutName: string;
  dataRevision: number;
  DynamicRenderer: DynamicRendererLike;
}

/**
 * G7 TemplateApp.renderTemplate 과 동일하게 modals 섹션에 isOpen/onClose 를 주입하고
 * modalStack 변경 시 리렌더한다.
 */
export function BoardWindowG7RenderTree({
  componentDefs,
  dataContext,
  translationContext,
  registry,
  bindingEngine,
  translationEngine,
  actionDispatcher,
  layoutName,
  dataRevision,
  DynamicRenderer,
}: BoardWindowG7RenderTreeProps): React.ReactElement {
  const [globalRevision, setGlobalRevision] = useState(0);

  useEffect(() => {
    const app = getTemplateAppGlobalListener();
    if (!app?.onGlobalStateChange) {
      return;
    }

    const listener = () => setGlobalRevision(revision => revision + 1);
    app.onGlobalStateChange(listener);
    return () => app.offGlobalStateChange?.(listener);
  }, []);

  const { contentDefs, modalDefs } = useMemo(
    () => splitBoardWindowComponentDefs(componentDefs),
    [componentDefs],
  );

  const liveDataContext = useMemo(() => {
    return mergeBoardWindowLiveGlobalState(dataContext);
  }, [dataContext, globalRevision]);

  const dispatcher = actionDispatcher as ActionDispatcherLike;

  return (
    <>
      {contentDefs.map((componentDef, index) => (
        <DynamicRenderer
          key={
            componentDef.id
              ? `${componentDef.id}_${layoutName}_${dataRevision}`
              : `board-window-${index}_${layoutName}_${dataRevision}`
          }
          componentDef={componentDef}
          dataContext={liveDataContext}
          translationContext={translationContext}
          registry={registry}
          bindingEngine={bindingEngine}
          translationEngine={translationEngine}
          actionDispatcher={actionDispatcher}
          isRootRenderer={index === 0}
        />
      ))}
      {modalDefs.map(modalDef => {
        const modalId = modalDef.id as string;
        const { isOpen, zIndex } = resolveModalOpenState(modalId, liveDataContext);
        const layoutContextStack = (window as {
          __g7LayoutContextStack?: Array<{ dataContext?: Record<string, unknown> }>;
        }).__g7LayoutContextStack ?? [];
        const parentDataContext = layoutContextStack[layoutContextStack.length - 1]?.dataContext;

        return (
          <DynamicRenderer
            key={`modal_${modalId}_${layoutName}_${dataRevision}_${globalRevision}`}
            componentDef={{
              ...modalDef,
              props: {
                ...(typeof modalDef.props === 'object' && modalDef.props != null
                  ? (modalDef.props as Record<string, unknown>)
                  : {}),
                isOpen,
                style: {
                  ...(typeof modalDef.props === 'object'
                    && modalDef.props != null
                    && typeof (modalDef.props as Record<string, unknown>).style === 'object'
                    ? ((modalDef.props as Record<string, unknown>).style as Record<string, unknown>)
                    : {}),
                  zIndex,
                },
                onClose: dispatcher.createHandler?.(
                  { type: 'click', handler: 'closeModal' },
                  liveDataContext,
                ),
              },
            }}
            dataContext={liveDataContext}
            translationContext={translationContext}
            registry={registry}
            bindingEngine={bindingEngine}
            translationEngine={translationEngine}
            actionDispatcher={actionDispatcher}
            parentDataContext={parentDataContext}
          />
        );
      })}
    </>
  );
}
