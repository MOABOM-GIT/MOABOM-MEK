/**
 * 에러 윈도우 — G7 layouts/errors/*.json 로드·DynamicRenderer 렌더 준비.
 */
import type React from 'react';
import { resolveMoabomTemplateLangDictionary } from '../i18n/moabomTemplateLangJsonFetch';
import type { ShellErrorCode } from './moaShellErrorIds';

export interface ErrorComponentDefinition {
  id?: string;
  type?: string;
  name?: string;
  children?: ErrorComponentDefinition[];
  [key: string]: unknown;
}

type LayoutJson = {
  layout_name?: string;
  meta?: { title?: string };
  components?: ErrorComponentDefinition[];
  slots?: Record<string, ErrorComponentDefinition[]>;
};

type TemplateAppLike = {
  getLayoutLoader?: () => {
    loadLayout: (templateId: string, layoutPath: string) => Promise<LayoutJson>;
  } | null;
  getConfig?: () => { templateId?: string; locale?: string };
  getGlobalState?: () => Record<string, unknown>;
  getActionDispatcher?: () => unknown;
};

type G7CoreLike = {
  getDynamicRenderer?: () => React.ComponentType<Record<string, unknown>> | null;
  getComponentRegistry?: () => unknown;
  getDataBindingEngine?: () => unknown;
  getTranslationEngine?: () => unknown;
  getActionDispatcher?: () => unknown;
};

const TEMPLATE_ID = 'moabom-basic';

const FALLBACK_ERROR_LAYOUTS: Record<string, string> = {
  '401': '403',
  '403': '403',
  '404': '404',
  '500': '500',
  '503': '503',
  maintenance: 'maintenance',
};

function getG7Core(): G7CoreLike | undefined {
  return (window as { G7Core?: G7CoreLike }).G7Core;
}

function getTemplateApp(): TemplateAppLike | undefined {
  return (window as { __templateApp?: TemplateAppLike }).__templateApp;
}

function extractErrorComponents(layout: LayoutJson): ErrorComponentDefinition[] {
  return layout.slots?.content ?? layout.components ?? [];
}

async function resolveErrorLayoutName(code: ShellErrorCode): Promise<string> {
  const key = String(code);
  try {
    const response = await fetch(`/api/templates/${TEMPLATE_ID}/config.json`);
    if (response.ok) {
      const result = await response.json() as { success?: boolean; data?: { error_config?: { layouts?: Record<string, string> } } };
      const mapped = result?.data?.error_config?.layouts?.[key];
      if (mapped) {
        return mapped;
      }
    }
  } catch {
    /* template config fetch 실패 시 폴백 */
  }
  return FALLBACK_ERROR_LAYOUTS[key] ?? key;
}

async function ensureErrorWindowTranslations(locale: string): Promise<void> {
  const engine = getG7Core()?.getTranslationEngine?.() as {
    loadTranslations?: (
      templateId: string,
      loc: string,
      apiBaseUrl?: string,
      bustCache?: boolean,
    ) => Promise<unknown>;
  } | null;

  if (engine?.loadTranslations) {
    try {
      await engine.loadTranslations(TEMPLATE_ID, locale, '/api');
      return;
    } catch {
      /* 엔진 로드 실패 시 fetch 폴백 */
    }
  }

  await resolveMoabomTemplateLangDictionary(locale);
}

export interface ErrorWindowRenderPayload {
  DynamicRenderer: React.ComponentType<Record<string, unknown>>;
  componentDefs: ErrorComponentDefinition[];
  dataContext: Record<string, unknown>;
  translationContext: { templateId: string; locale: string };
  registry: unknown;
  bindingEngine: unknown;
  translationEngine: unknown;
  actionDispatcher: unknown;
  layoutName: string;
}

export async function loadErrorWindowRenderPayload(
  code: ShellErrorCode,
): Promise<ErrorWindowRenderPayload> {
  const G7Core = getG7Core();
  const templateApp = getTemplateApp();
  const layoutLoader = templateApp?.getLayoutLoader?.();
  const DynamicRenderer = G7Core?.getDynamicRenderer?.();

  if (!layoutLoader || !DynamicRenderer) {
    throw new Error('Layout engine unavailable');
  }

  const layoutName = await resolveErrorLayoutName(code);
  const config = templateApp?.getConfig?.();
  const locale = config?.locale ?? 'ko';

  await ensureErrorWindowTranslations(locale);

  const layoutData = await layoutLoader.loadLayout(TEMPLATE_ID, layoutName);
  const globalState = templateApp?.getGlobalState?.() ?? {};

  const dataContext: Record<string, unknown> = {
    errorCode: code,
    route: {},
    query: {},
    _global: { ...globalState },
    _local: {},
  };

  return {
    DynamicRenderer,
    componentDefs: extractErrorComponents(layoutData),
    dataContext,
    translationContext: {
      templateId: config?.templateId ?? TEMPLATE_ID,
      locale,
    },
    registry: G7Core?.getComponentRegistry?.(),
    bindingEngine: G7Core?.getDataBindingEngine?.(),
    translationEngine: G7Core?.getTranslationEngine?.(),
    actionDispatcher: templateApp?.getActionDispatcher?.() ?? G7Core?.getActionDispatcher?.(),
    layoutName: layoutData.layout_name ?? layoutName,
  };
}
