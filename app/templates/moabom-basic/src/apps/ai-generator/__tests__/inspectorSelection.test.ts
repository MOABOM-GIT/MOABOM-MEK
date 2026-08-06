import { describe, expect, it } from 'vitest';
import {
  buildCssPath,
  buildInspectorPatchPrompt,
  parseInspectorSelectionMessage,
  summarizeElement,
} from '../inspector/inspectorSelection';
import {
  injectPreviewInspectorBridge,
  PREVIEW_INSPECTOR_BRIDGE_JS,
  PREVIEW_INSPECTOR_BRIDGE_SCRIPT_ID,
  stripPreviewInspectorBridge,
} from '../inspector/previewInspectorBridge';
import { parseBackdropToneMessage } from '../../generated/liquidGlassOverlay';

describe('inspectorSelection', () => {
  it('builds a css path and patch prompt from a DOM element', () => {
    const root = document.createElement('div');
    root.innerHTML = '<section><button id="save-btn">저장</button></section>';
    document.body.appendChild(root);
    const button = root.querySelector('button')!;
    const selection = summarizeElement(button);
    expect(selection.tagName).toBe('button');
    expect(selection.cssPath).toContain('button');
    expect(buildCssPath(button)).toContain('#save-btn');
    expect(buildInspectorPatchPrompt(selection, '더 크게')).toContain('수정 요청: 더 크게');
    root.remove();
  });

  it('parses inspector-selection postMessage payloads', () => {
    expect(parseInspectorSelectionMessage({
      source: 'moabom-app',
      type: 'inspector-selection',
      selection: {
        cssPath: 'body > button',
        tagName: 'BUTTON',
        outerHtmlSnippet: '<button>ok</button>',
        textSnippet: 'ok',
      },
    })).toEqual({
      cssPath: 'body > button',
      tagName: 'button',
      outerHtmlSnippet: '<button>ok</button>',
      textSnippet: 'ok',
    });
    expect(parseInspectorSelectionMessage({ source: 'other', type: 'inspector-selection' })).toBeNull();
  });

  it('parses backdrop-tone postMessage payloads via shared overlay helper', () => {
    expect(parseBackdropToneMessage({
      source: 'moabom-app',
      type: 'backdrop-tone',
      tone: 'dark',
    })).toBe('dark');
    expect(parseBackdropToneMessage({
      source: 'moabom-app',
      type: 'backdrop-tone',
      tone: 'light',
    })).toBe('light');
    expect(parseBackdropToneMessage({
      source: 'moabom-app',
      type: 'backdrop-tone',
      tone: 'mid',
    })).toBeNull();
    expect(parseBackdropToneMessage({
      source: 'other',
      type: 'backdrop-tone',
      tone: 'dark',
    })).toBeNull();
  });
});

describe('previewInspectorBridge', () => {
  it('injects bridge into head and strips it idempotently', () => {
    const html = '<!DOCTYPE html><html><head><title>t</title></head><body><button>a</button></body></html>';
    const injected = injectPreviewInspectorBridge(html);
    expect(injected).toContain(`id="${PREVIEW_INSPECTOR_BRIDGE_SCRIPT_ID}"`);
    expect(injected).toContain('inspector-enable');
    expect(injected).toContain('moabom-app');
    const stripped = stripPreviewInspectorBridge(injected);
    expect(stripped).not.toContain(PREVIEW_INSPECTOR_BRIDGE_SCRIPT_ID);
    expect(stripPreviewInspectorBridge(stripped)).toBe(stripped);
    expect(injectPreviewInspectorBridge(injected).match(/moabom-preview-inspector-bridge/g)?.length).toBe(1);
  });

  it('includes backdrop-probe measurement for liquid-glass contrast', () => {
    expect(PREVIEW_INSPECTOR_BRIDGE_JS).toContain('backdrop-probe');
    expect(PREVIEW_INSPECTOR_BRIDGE_JS).toContain('backdrop-tone');
    expect(PREVIEW_INSPECTOR_BRIDGE_JS).toContain('elementFromPoint');
    expect(PREVIEW_INSPECTOR_BRIDGE_JS).toContain('backgroundImage');
    expect(PREVIEW_INSPECTOR_BRIDGE_JS).toContain('avgFromBackgroundImage');
    const injected = injectPreviewInspectorBridge('<html><body></body></html>');
    expect(injected).toContain('backdrop-probe');
  });
});
