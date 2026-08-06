/**
 * iframe 내부 배경 휘도 프로브.
 *
 * 부모(셸)가 보낸 지점(buttons 좌표)을 받아 elementFromPoint 로 해당 위치의
 * 실효 배경색을 합성·휘도 계산하고, 'light'|'dark' 톤을 postMessage 로 회신한다.
 *
 * solid: backgroundColor
 * gradient: backgroundImage 색 stop 평균 (computed backgroundColor 는 투명)
 *
 * AI 미리보기 브릿지(previewInspectorBridge)의 bgAt 과 동일 규칙을 유지한다.
 */
(function () {
  if (window.__moabomBackdropProbe) {
    return;
  }
  window.__moabomBackdropProbe = true;

  function parseRgb(s) {
    var m = /rgba?\(([^)]+)\)/i.exec(s || '');
    if (!m) {
      return null;
    }
    var raw = m[1]
      .trim()
      .replace(/\s*\/\s*/g, ' ')
      .replace(/,/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    if (raw.length < 3) {
      return null;
    }
    var r = parseFloat(raw[0]);
    var g = parseFloat(raw[1]);
    var b = parseFloat(raw[2]);
    var a = raw.length > 3 ? parseFloat(raw[3]) : 1;
    return {
      r: isNaN(r) ? 0 : r,
      g: isNaN(g) ? 0 : g,
      b: isNaN(b) ? 0 : b,
      a: isNaN(a) ? 1 : a,
    };
  }

  function parseHex(s) {
    var h = String(s || '').slice(1);
    if (h.length === 3 || h.length === 4) {
      return {
        r: parseInt(h.charAt(0) + h.charAt(0), 16),
        g: parseInt(h.charAt(1) + h.charAt(1), 16),
        b: parseInt(h.charAt(2) + h.charAt(2), 16),
        a: h.length === 4 ? parseInt(h.charAt(3) + h.charAt(3), 16) / 255 : 1,
      };
    }
    if (h.length === 6 || h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }
    return null;
  }

  function compositeOnWhite(c) {
    var a = Math.max(0, Math.min(1, c.a));
    return {
      r: c.r * a + 255 * (1 - a),
      g: c.g * a + 255 * (1 - a),
      b: c.b * a + 255 * (1 - a),
    };
  }

  function collectColorsFromCssValue(value) {
    var colors = [];
    var src = String(value || '');
    var hexRe = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi;
    var hex;
    while ((hex = hexRe.exec(src))) {
      var hc = parseHex(hex[0]);
      if (hc) {
        colors.push(hc);
      }
    }
    var rgbRe = /rgba?\(([^)]+)\)/gi;
    var rgb;
    while ((rgb = rgbRe.exec(src))) {
      var rc = parseRgb(rgb[0]);
      if (rc) {
        colors.push(rc);
      }
    }
    return colors;
  }

  /** backgroundImage 그라데이션 stop 평균. url()만 있으면 null. */
  function avgFromBackgroundImage(img) {
    if (!img || img === 'none') {
      return null;
    }
    if (!/gradient\s*\(/i.test(img) && !/#|rgba?\(/i.test(img)) {
      return null;
    }
    var colors = collectColorsFromCssValue(img);
    if (!colors.length) {
      return null;
    }
    var sumR = 0;
    var sumG = 0;
    var sumB = 0;
    for (var i = 0; i < colors.length; i++) {
      var c = compositeOnWhite(colors[i]);
      sumR += c.r;
      sumG += c.g;
      sumB += c.b;
    }
    var n = colors.length;
    return { r: sumR / n, g: sumG / n, b: sumB / n };
  }

  function sampleFromComputedStyle(cs) {
    if (!cs) {
      return null;
    }
    // 그라데이션이 위에 그려지므로 backgroundImage 를 먼저 본다.
    var fromImg = avgFromBackgroundImage(cs.backgroundImage);
    if (fromImg) {
      return fromImg;
    }
    var c = parseRgb(cs.backgroundColor);
    if (c && c.a > 0) {
      return compositeOnWhite(c);
    }
    return null;
  }

  function bgAt(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el !== document.documentElement) {
      var sampled = sampleFromComputedStyle(getComputedStyle(el));
      if (sampled) {
        return sampled;
      }
      el = el.parentElement;
    }
    var base =
      sampleFromComputedStyle(getComputedStyle(document.body)) ||
      sampleFromComputedStyle(getComputedStyle(document.documentElement));
    if (base) {
      return base;
    }
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
    var pts = points && points.length ? points : [{ x: 28, y: window.innerHeight - 28 }];
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

  function reply(id, points) {
    try {
      var res = measure(points);
      parent.postMessage(
        {
          source: 'moabom-app',
          type: 'backdrop-tone',
          id: id,
          tone: res.tone,
          luminance: res.luminance,
        },
        '*',
      );
    } catch (e) {}
  }

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.source !== 'moabom-shell') {
      return;
    }
    if (d.type === 'heartbeat-ping') {
      try {
        parent.postMessage({ source: 'moabom-app', type: 'heartbeat-pong', id: d.id }, '*');
      } catch (e) {}
      return;
    }
    if (d.type !== 'backdrop-probe') {
      return;
    }
    reply(d.id, d.points);
  });

  function initial() {
    reply('initial', null);
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initial, 80);
  } else {
    window.addEventListener('DOMContentLoaded', function () {
      setTimeout(initial, 80);
    });
  }
})();
