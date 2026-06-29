(function () {
  if (window.__moabomDataApiBridge) {
    return;
  }
  window.__moabomDataApiBridge = true;

  var TOKEN_PARAM = 'preview_token';
  var TOKEN_HEADER = 'X-Moabom-Preview-Token';
  var DATA_API_PATTERN = /\/api\/data\/[A-Za-z0-9_-]+/;

  function resolvePreviewToken() {
    try {
      var params = new URLSearchParams(window.location.search);
      var fromQuery = params.get(TOKEN_PARAM);
      if (fromQuery) {
        return fromQuery;
      }
    } catch (e) {}
    return '';
  }

  function isHostedDataApiUrl(url) {
    try {
      var resolved = new URL(url, window.location.href);
      return (
        resolved.origin === window.location.origin &&
        DATA_API_PATTERN.test(resolved.pathname)
      );
    } catch (e) {
      return false;
    }
  }

  function withPreviewToken(init) {
    var token = resolvePreviewToken();
    if (!token) {
      return init || {};
    }
    var nextInit = Object.assign({}, init || {});
    var headers = new Headers(nextInit.headers || undefined);
    if (!headers.has(TOKEN_HEADER)) {
      headers.set(TOKEN_HEADER, token);
    }
    nextInit.headers = headers;
    return nextInit;
  }

  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url =
      typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : String(input || '');
    if (isHostedDataApiUrl(url)) {
      return nativeFetch(input, withPreviewToken(init));
    }
    return nativeFetch(input, init);
  };

  window.__MOABOM_SHELL__ = window.__MOABOM_SHELL__ || {};
  window.__MOABOM_SHELL__.getPreviewToken = resolvePreviewToken;
  window.__MOABOM_SHELL__.dataApiUrl = function (tableKey) {
    return '/api/data/' + encodeURIComponent(String(tableKey || '').trim());
  };
  window.__MOABOM_SHELL__.dataApiFetch = function (tableKey, init) {
    return window.fetch(window.__MOABOM_SHELL__.dataApiUrl(tableKey), init);
  };
})();
