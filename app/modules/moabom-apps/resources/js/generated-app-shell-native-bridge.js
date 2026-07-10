(function () {
  if (window.__moabomShellNativeBridge) {
    return;
  }
  window.__moabomShellNativeBridge = true;

  var shell = window.__MOABOM_SHELL__ || {};
  window.__MOABOM_SHELL__ = shell;

  function post(type, payload) {
    try {
      parent.postMessage(
        Object.assign({ source: 'moabom-app', type: type }, payload || {}),
        '*',
      );
    } catch (e) {}
  }

  /**
   * Allowlist shell APIs — no arbitrary eval / parent DOM access.
   */
  shell.toast = function (message, severity) {
    var text = String(message || '').trim().slice(0, 240);
    if (!text) {
      return;
    }
    var level = severity === 'warning' || severity === 'error' || severity === 'success'
      ? severity
      : 'info';
    post('shell-toast', { message: text, severity: level });
  };

  shell.openApp = function (appId) {
    var id = String(appId || '').trim().slice(0, 120);
    if (!id || !/^[a-z0-9][a-z0-9._-]*$/i.test(id)) {
      return;
    }
    post('shell-open-app', { appId: id });
  };
})();
