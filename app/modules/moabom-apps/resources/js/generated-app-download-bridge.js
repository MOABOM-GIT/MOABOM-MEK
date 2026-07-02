(function () {
  if (window.__moabomDownloadBridge) {
    return;
  }
  window.__moabomDownloadBridge = true;

  var MAX_BYTES = 10 * 1024 * 1024;
  // HTML 인라인 <script> 주입 시 regex \/\\ 이 깨지는 회귀 방지 — 백슬래시 리터럴 금지.
  var PATH_BACKSLASH = String.fromCharCode(92);

  function sanitizeFilename(name) {
    var base = String(name || 'download').split(PATH_BACKSLASH).join('/').split('/').pop() || 'download';
    base = base.replace(/[^\w.\- ()[\]\uAC00-\uD7A3]+/g, '_').slice(0, 180);
    return base || 'download';
  }

  function isAllowedMime(mime) {
    if (!mime || mime.length > 120) {
      return false;
    }
    if (/^text\/html/i.test(mime) || /^application\/xhtml/i.test(mime)) {
      return false;
    }
    if (/javascript|svg\+xml/i.test(mime)) {
      return false;
    }
    return /^[\w.+-]+\/[\w.+-]+(?:;[\w.=-]+)*$/i.test(mime);
  }

  function postDownload(payload) {
    try {
      parent.postMessage(
        Object.assign({ source: 'moabom-app', type: 'file-download' }, payload),
        '*',
      );
    } catch (e) {}
  }

  function blobToBase64(blob, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var result = String(reader.result || '');
      var idx = result.indexOf(',');
      cb(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = function () {};
    reader.readAsDataURL(blob);
  }

  function sendBlob(blob, filename, mimeType) {
    if (!blob || blob.size <= 0 || blob.size > MAX_BYTES) {
      return false;
    }
    var mime = isAllowedMime(mimeType) ? mimeType : 'application/octet-stream';
    blobToBase64(blob, function (b64) {
      postDownload({
        filename: sanitizeFilename(filename),
        mimeType: mime,
        encoding: 'base64',
        data: b64,
      });
    });
    return true;
  }

  window.__MOABOM_SHELL__ = window.__MOABOM_SHELL__ || {};
  window.__MOABOM_SHELL__.downloadFile = function (opts) {
    if (!opts || opts.data == null) {
      return false;
    }
    var enc = opts.encoding === 'base64' ? 'base64' : 'utf8';
    var mime = isAllowedMime(opts.mimeType) ? opts.mimeType : 'application/octet-stream';
    var name = sanitizeFilename(opts.filename);
    if (enc === 'base64') {
      var raw = String(opts.data);
      if (raw.length * 0.75 > MAX_BYTES) {
        return false;
      }
      postDownload({ filename: name, mimeType: mime, encoding: 'base64', data: raw });
      return true;
    }
    var bytes;
    try {
      bytes = new TextEncoder().encode(String(opts.data));
    } catch (e) {
      return false;
    }
    if (bytes.length <= 0 || bytes.length > MAX_BYTES) {
      return false;
    }
    sendBlob(new Blob([bytes], { type: mime }), name, mime);
    return true;
  };

  document.addEventListener(
    'click',
    function (ev) {
      var target = ev.target;
      if (!target || !target.closest) {
        return;
      }
      var anchor = target.closest('a');
      if (!anchor) {
        return;
      }
      var downloadName = anchor.getAttribute('download');
      if (downloadName == null) {
        return;
      }
      var href = anchor.getAttribute('href') || '';
      if (!href.startsWith('blob:') && !href.startsWith('data:')) {
        return;
      }

      ev.preventDefault();
      ev.stopPropagation();

      var filename = sanitizeFilename(downloadName || 'download');

      if (href.startsWith('data:')) {
        var parts = href.split(',');
        var meta = parts[0] || '';
        var body = parts.slice(1).join(',');
        var mimeMatch = /data:([^;,]+)/i.exec(meta);
        var mime = mimeMatch && isAllowedMime(mimeMatch[1]) ? mimeMatch[1] : 'application/octet-stream';
        if (/;base64/i.test(meta)) {
          if (body.length * 0.75 > MAX_BYTES) {
            return;
          }
          postDownload({ filename: filename, mimeType: mime, encoding: 'base64', data: body });
        } else {
          try {
            var text = decodeURIComponent(body);
            if (new TextEncoder().encode(text).length > MAX_BYTES) {
              return;
            }
            postDownload({ filename: filename, mimeType: mime, encoding: 'utf8', data: text });
          } catch (e) {}
        }
        return;
      }

      fetch(href)
        .then(function (response) {
          return response.blob();
        })
        .then(function (blob) {
          sendBlob(blob, filename, blob.type || 'application/octet-stream');
        })
        .catch(function () {});
    },
    true,
  );
})();
