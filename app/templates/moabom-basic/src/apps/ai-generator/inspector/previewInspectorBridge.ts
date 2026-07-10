/**
 * srcdoc 미리보기용 Inspector 브릿지.
 *
 * 미리보기 iframe 은 sandbox 에 allow-same-origin 이 없어 opaque origin 이다.
 * 부모는 contentDocument 에 접근할 수 없으므로, 주입 스크립트가
 * moabom-shell ↔ moabom-app postMessage 로 선택 모드를 제어한다.
 *
 * - inspector-enable / inspector-disable (부모 → iframe)
 * - inspector-selection (iframe → 부모)
 * - backdrop-probe → backdrop-tone (부모 → iframe → 부모, liquid-glass 대비)
 * - 비활성 시 클릭·포인터는 앱 기본 동작 그대로
 */
export const PREVIEW_INSPECTOR_BRIDGE_SCRIPT_ID = 'moabom-preview-inspector-bridge';

export const PREVIEW_INSPECTOR_BRIDGE_JS = `(function(){
  if (window.__moabomPreviewInspector) { return; }
  window.__moabomPreviewInspector = true;

  var active = false;
  var highlight = null;
  var MAX_SNIPPET = 800;

  function ensureHighlight() {
    if (highlight && highlight.isConnected) { return highlight; }
    highlight = document.createElement('div');
    highlight.id = 'moabom-inspector-highlight';
    highlight.setAttribute('aria-hidden', 'true');
    highlight.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:2147483646',
      'border:2px solid #6366f1',
      'background:rgba(99,102,241,0.14)',
      'border-radius:4px',
      'box-sizing:border-box',
      'display:none',
      'inset:auto'
    ].join(';');
    (document.documentElement || document.body).appendChild(highlight);
    return highlight;
  }

  function hideHighlight() {
    if (highlight) { highlight.style.display = 'none'; }
  }

  function placeHighlight(el) {
    if (!(el instanceof Element)) { return; }
    if (el.id === 'moabom-inspector-highlight') { return; }
    var rect = el.getBoundingClientRect();
    var node = ensureHighlight();
    node.style.display = 'block';
    node.style.left = Math.max(0, rect.left) + 'px';
    node.style.top = Math.max(0, rect.top) + 'px';
    node.style.width = Math.max(0, rect.width) + 'px';
    node.style.height = Math.max(0, rect.height) + 'px';
  }

  function buildCssPath(el) {
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && parts.length < 8) {
      var part = String(node.tagName || '').toLowerCase();
      if (node.id) {
        part += '#' + String(node.id).replace(/[^a-zA-Z0-9_-]/g, '');
        parts.unshift(part);
        break;
      }
      var parent = node.parentElement;
      if (parent) {
        var siblings = [];
        for (var i = 0; i < parent.children.length; i += 1) {
          if (parent.children[i].tagName === node.tagName) {
            siblings.push(parent.children[i]);
          }
        }
        if (siblings.length > 1) {
          var index = siblings.indexOf(node) + 1;
          part += ':nth-of-type(' + index + ')';
        }
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }

  function summarize(el) {
    var outer = String(el.outerHTML || '').replace(/\\s+/g, ' ').trim();
    var text = String(el.textContent || '').replace(/\\s+/g, ' ').trim();
    return {
      cssPath: buildCssPath(el),
      tagName: String(el.tagName || '').toLowerCase(),
      outerHtmlSnippet: outer.slice(0, MAX_SNIPPET),
      textSnippet: text.slice(0, 200)
    };
  }

  function postSelection(el) {
    try {
      parent.postMessage({
        source: 'moabom-app',
        type: 'inspector-selection',
        selection: summarize(el)
      }, '*');
    } catch (e) {}
  }

  function setActive(next) {
    active = !!next;
    try {
      document.documentElement.style.cursor = active ? 'crosshair' : '';
    } catch (e) {}
    if (!active) {
      hideHighlight();
    }
  }

  function onMove(event) {
    if (!active) { return; }
    var target = event.target;
    if (!(target instanceof Element)) { return; }
    if (target.id === 'moabom-inspector-highlight') { return; }
    placeHighlight(target);
  }

  function onPick(event) {
    if (!active) { return; }
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    var target = event.target;
    if (!(target instanceof Element)) { return; }
    if (target.id === 'moabom-inspector-highlight') { return; }
    placeHighlight(target);
    postSelection(target);
  }

  function parseRgb(s) {
    var m = /rgba?\\(([^)]+)\\)/i.exec(s || '');
    if (!m) { return null; }
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    var a = p.length > 3 ? p[3] : 1;
    return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: isNaN(a) ? 1 : a };
  }

  function compositeOnWhite(c) {
    var a = Math.max(0, Math.min(1, c.a));
    return {
      r: c.r * a + 255 * (1 - a),
      g: c.g * a + 255 * (1 - a),
      b: c.b * a + 255 * (1 - a)
    };
  }

  function bgAt(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el !== document.documentElement) {
      if (el.id !== 'moabom-inspector-highlight') {
        var c = parseRgb(getComputedStyle(el).backgroundColor);
        if (c && c.a > 0) { return compositeOnWhite(c); }
      }
      el = el.parentElement;
    }
    var base = parseRgb(getComputedStyle(document.body).backgroundColor)
      || parseRgb(getComputedStyle(document.documentElement).backgroundColor);
    if (base && base.a > 0) { return compositeOnWhite(base); }
    return { r: 255, g: 255, b: 255 };
  }

  function luminance(c) {
    function ch(v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  }

  function measure(points) {
    var pts = (points && points.length) ? points : [{ x: 28, y: 28 }];
    var sum = 0;
    var n = 0;
    for (var i = 0; i < pts.length; i++) {
      var x = Math.max(0, Math.min(window.innerWidth - 1, pts[i].x));
      var y = Math.max(0, Math.min(window.innerHeight - 1, pts[i].y));
      sum += luminance(bgAt(x, y));
      n++;
    }
    var L = n ? sum / n : 1;
    return { tone: L < 0.5 ? 'dark' : 'light', luminance: L };
  }

  function replyTone(id, points) {
    try {
      var res = measure(points);
      parent.postMessage({
        source: 'moabom-app',
        type: 'backdrop-tone',
        id: id,
        tone: res.tone,
        luminance: res.luminance
      }, '*');
    } catch (e) {}
  }

  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (!data || data.source !== 'moabom-shell') { return; }
    if (data.type === 'inspector-enable') {
      setActive(true);
      return;
    }
    if (data.type === 'inspector-disable') {
      setActive(false);
      return;
    }
    if (data.type === 'backdrop-probe') {
      replyTone(data.id, data.points);
    }
  });

  function initialTone() { replyTone('initial', null); }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initialTone, 80);
  } else {
    window.addEventListener('DOMContentLoaded', function () { setTimeout(initialTone, 80); });
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('pointerdown', onPick, true);
  document.addEventListener('click', onPick, true);
})();`;

export function stripPreviewInspectorBridge(html: string): string {
  if (!html) {
    return '';
  }
  return html.replace(
    /<script\b[^>]*\bid=["']moabom-preview-inspector-bridge["'][^>]*>[\s\S]*?<\/script>/gi,
    '',
  );
}

/**
 * 미리보기 iframe 전용 — 저장 HTML 에는 넣지 않는다.
 */
export function injectPreviewInspectorBridge(html: string): string {
  if (!html.trim()) {
    return '';
  }

  const stripped = stripPreviewInspectorBridge(html);
  const script = `<script id="${PREVIEW_INSPECTOR_BRIDGE_SCRIPT_ID}">${PREVIEW_INSPECTOR_BRIDGE_JS}</script>`;

  if (/<\/head>/i.test(stripped)) {
    return stripped.replace(/<\/head>/i, `${script}</head>`);
  }
  if (/<body\b/i.test(stripped)) {
    return stripped.replace(/<body\b/i, `<head>${script}</head><body`);
  }
  return `${script}${stripped}`;
}
