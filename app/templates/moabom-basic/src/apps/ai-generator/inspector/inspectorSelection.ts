export interface InspectorSelection {
  cssPath: string;
  tagName: string;
  outerHtmlSnippet: string;
  textSnippet: string;
}

const MAX_SNIPPET = 800;

export function buildCssPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && parts.length < 8) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      const safeId = node.id.replace(/[^a-zA-Z0-9_-]/g, '');
      part += `#${safeId}`;
      parts.unshift(part);
      break;
    }
    const parent: Element | null = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child: Element) => child.tagName === node!.tagName,
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(node) + 1;
        part += `:nth-of-type(${index})`;
      }
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(' > ');
}

export function summarizeElement(el: Element): InspectorSelection {
  const outer = el.outerHTML.replace(/\s+/g, ' ').trim();
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return {
    cssPath: buildCssPath(el),
    tagName: el.tagName.toLowerCase(),
    outerHtmlSnippet: outer.slice(0, MAX_SNIPPET),
    textSnippet: text.slice(0, 200),
  };
}

export function buildInspectorPatchPrompt(selection: InspectorSelection, userRequest: string): string {
  const request = userRequest.trim();
  return [
    '선택한 UI 요소만 최소 변경으로 수정해주세요. 전체 HTML을 다시 쓰지 마세요.',
    `요소: <${selection.tagName}>`,
    `CSS path: ${selection.cssPath}`,
    selection.textSnippet ? `텍스트: ${selection.textSnippet}` : null,
    `outerHTML 요약:\n${selection.outerHtmlSnippet}`,
    request ? `수정 요청: ${request}` : '수정 요청: 이 요소의 스타일과 문구를 더 명확하고 현대적으로 다듬어주세요.',
  ].filter(Boolean).join('\n');
}

export function parseInspectorSelectionMessage(data: unknown): InspectorSelection | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const message = data as {
    source?: string;
    type?: string;
    selection?: Partial<InspectorSelection>;
  };
  if (message.source !== 'moabom-app' || message.type !== 'inspector-selection') {
    return null;
  }
  const selection = message.selection;
  if (!selection || typeof selection !== 'object') {
    return null;
  }
  const cssPath = String(selection.cssPath ?? '').trim();
  const tagName = String(selection.tagName ?? '').trim().toLowerCase();
  if (!cssPath || !tagName) {
    return null;
  }
  return {
    cssPath: cssPath.slice(0, 500),
    tagName: tagName.slice(0, 40),
    outerHtmlSnippet: String(selection.outerHtmlSnippet ?? '').slice(0, MAX_SNIPPET),
    textSnippet: String(selection.textSnippet ?? '').slice(0, 200),
  };
}

export function postPreviewInspectorMode(
  iframe: HTMLIFrameElement | null | undefined,
  enabled: boolean,
): void {
  const win = iframe?.contentWindow;
  if (!win) {
    return;
  }
  try {
    win.postMessage(
      {
        source: 'moabom-shell',
        type: enabled ? 'inspector-enable' : 'inspector-disable',
      },
      '*',
    );
  } catch {
    /* opaque / unloaded iframe */
  }
}

/** @deprecated liquidGlassOverlay 사용 — 기존 import 호환 */
export {
  parseBackdropToneMessage as parseInspectorBackdropToneMessage,
  postIframeBackdropProbe as postPreviewBackdropProbe,
} from '../../generated/liquidGlassOverlay';
export type { LiquidGlassBackdropTone as InspectorBackdropTone } from '../../generated/liquidGlassOverlay';
