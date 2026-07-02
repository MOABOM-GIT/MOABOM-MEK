/**
 * Hosted 생성앱 — 온라인(/api/data) + 오프라인(localStorage) 이중 저장.
 *
 * @see GeneratedAppHtmlService::hostedStorageBridgeScript()
 */
(function () {
  if (window.__moabomHostedStorage) {
    return;
  }
  window.__moabomHostedStorage = true;

  var SNAPSHOT_TABLE = '__local_storage_mirror';
  var SYNC_DEBOUNCE_MS = 600;
  var runtime = window.__MOABOM_APP_RUNTIME__ || {};
  var prefix = String(runtime.storagePrefix || 'ga0.');
  var shell = (window.__MOABOM_SHELL__ = window.__MOABOM_SHELL__ || {});

  var readyResolve;
  var readyPromise = new Promise(function (resolve) {
    readyResolve = resolve;
  });
  var hydrateStarted = false;
  var syncTimer = null;
  var mirroring = false;

  function normalizeTableKey(tableKey) {
    var key = String(tableKey || '').trim();
    if (!/^[A-Za-z0-9_-]+$/.test(key)) {
      throw new Error('Invalid table_key');
    }
    return key;
  }

  function hasOnlineAccess() {
    try {
      return typeof shell.getPreviewToken === 'function' && !!shell.getPreviewToken();
    } catch (e) {
      return false;
    }
  }

  function localTableKey(tableKey) {
    return prefix + 'tbl.' + tableKey;
  }

  function serverMetaKey(tableKey) {
    return prefix + 'srv.' + tableKey;
  }

  function shouldMirrorLocalKey(key) {
    if (!key || typeof key !== 'string') {
      return false;
    }
    if (key.indexOf(prefix) === 0) {
      return false;
    }
    return true;
  }

  function readJson(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function readServerMeta(tableKey) {
    return readJson(serverMetaKey(tableKey), null);
  }

  function writeServerMeta(tableKey, meta) {
    writeJson(serverMetaKey(tableKey), meta);
  }

  function readLocalTable(tableKey) {
    return readJson(localTableKey(tableKey), null);
  }

  function writeLocalTable(tableKey, value) {
    writeJson(localTableKey(tableKey), value);
  }

  function collectMirrorEntries() {
    var entries = {};
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var key = window.localStorage.key(i);
        if (shouldMirrorLocalKey(key)) {
          entries[key] = window.localStorage.getItem(key);
        }
      }
    } catch (e) {}
    return entries;
  }

  function applyMirrorEntries(entries) {
    if (!entries || typeof entries !== 'object') {
      return;
    }
    mirroring = true;
    try {
      Object.keys(entries).forEach(function (key) {
        if (!shouldMirrorLocalKey(key)) {
          return;
        }
        var next = entries[key];
        if (next == null) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, String(next));
        }
      });
    } finally {
      mirroring = false;
    }
  }

  function latestItem(items) {
    if (!items || !items.length) {
      return null;
    }
    return items[0];
  }

  async function fetchServerDocument(tableKey) {
    if (!hasOnlineAccess() || typeof shell.dataApiFetch !== 'function') {
      return null;
    }
    var res = await shell.dataApiFetch(tableKey);
    if (!res || !res.ok) {
      return null;
    }
    var body = await res.json();
    var item = latestItem(body.items || []);
    if (!item) {
      return null;
    }
    writeServerMeta(tableKey, {
      rowId: item.id,
      updatedAt: item.updated_at || null,
    });
    return item.payload == null ? null : item.payload;
  }

  async function pushServerDocument(tableKey, payload) {
    if (!hasOnlineAccess() || typeof shell.dataApiFetch !== 'function') {
      return false;
    }
    var meta = readServerMeta(tableKey) || {};
    var url =
      meta.rowId && typeof shell.dataApiUrl === 'function'
        ? shell.dataApiUrl(tableKey) + '/' + meta.rowId
        : typeof shell.dataApiUrl === 'function'
          ? shell.dataApiUrl(tableKey)
          : '/api/data/' + encodeURIComponent(tableKey);
    var res = await window.fetch(url, {
      method: meta.rowId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: payload }),
    });
    if (!res.ok) {
      return false;
    }
    var row = await res.json();
    writeServerMeta(tableKey, {
      rowId: row.id,
      updatedAt: row.updated_at || new Date().toISOString(),
    });
    return true;
  }

  function scheduleMirrorSync() {
    if (!hasOnlineAccess() || mirroring) {
      return;
    }
    if (syncTimer) {
      window.clearTimeout(syncTimer);
    }
    syncTimer = window.setTimeout(function () {
      syncTimer = null;
      void pushServerDocument(SNAPSHOT_TABLE, {
        updatedAt: new Date().toISOString(),
        entries: collectMirrorEntries(),
      });
    }, SYNC_DEBOUNCE_MS);
  }

  function installLocalStorageMirror() {
    if (!window.localStorage || window.localStorage.__moabomMirrorHook) {
      return;
    }
    var proto = Storage.prototype;
    var nativeSet = proto.setItem;
    var nativeRemove = proto.removeItem;
    var nativeClear = proto.clear;

    proto.setItem = function (key, value) {
      nativeSet.call(this, key, value);
      if (this === window.localStorage && shouldMirrorLocalKey(key)) {
        scheduleMirrorSync();
      }
    };
    proto.removeItem = function (key) {
      nativeRemove.call(this, key);
      if (this === window.localStorage && shouldMirrorLocalKey(key)) {
        scheduleMirrorSync();
      }
    };
    proto.clear = function () {
      nativeClear.call(this);
      if (this === window.localStorage) {
        scheduleMirrorSync();
      }
    };
    window.localStorage.__moabomMirrorHook = true;
  }

  async function hydrateMirrorFromServer() {
    if (!hasOnlineAccess()) {
      return;
    }
    var serverDoc = await fetchServerDocument(SNAPSHOT_TABLE);
    if (!serverDoc || !serverDoc.entries) {
      return;
    }
    var localEntries = collectMirrorEntries();
    var localHasData = Object.keys(localEntries).length > 0;
    var serverUpdated = serverDoc.updatedAt ? Date.parse(serverDoc.updatedAt) : 0;
    var localMeta = readServerMeta(SNAPSHOT_TABLE) || {};
    var localUpdated = localMeta.updatedAt ? Date.parse(localMeta.updatedAt) : 0;
    if (!localHasData || (serverUpdated && serverUpdated >= localUpdated)) {
      applyMirrorEntries(serverDoc.entries);
      writeServerMeta(SNAPSHOT_TABLE, {
        rowId: localMeta.rowId || null,
        updatedAt: serverDoc.updatedAt || null,
      });
      window.dispatchEvent(new CustomEvent('moabom-hosted-storage-synced'));
    } else if (localHasData) {
      await pushServerDocument(SNAPSHOT_TABLE, {
        updatedAt: new Date().toISOString(),
        entries: localEntries,
      });
    }
  }

  async function hydrateAll() {
    if (hydrateStarted) {
      return readyPromise;
    }
    hydrateStarted = true;
    installLocalStorageMirror();
    try {
      await hydrateMirrorFromServer();
    } catch (e) {}
    readyResolve();
    window.dispatchEvent(new CustomEvent('moabom-hosted-storage-ready'));
    return readyPromise;
  }

  var MoabomAppStorage = {
    whenReady: function () {
      return hydrateAll();
    },
    hasOnlineAccess: hasOnlineAccess,
    load: async function (tableKey) {
      tableKey = normalizeTableKey(tableKey);
      await hydrateAll();
      var local = readLocalTable(tableKey);
      if (!hasOnlineAccess()) {
        return local;
      }
      try {
        var server = await fetchServerDocument(tableKey);
        if (server == null) {
          return local;
        }
        var meta = readServerMeta(tableKey) || {};
        var serverUpdated = meta.updatedAt ? Date.parse(meta.updatedAt) : 0;
        var localUpdated = local && local.__moabomUpdatedAt ? Date.parse(local.__moabomUpdatedAt) : 0;
        if (!local || (serverUpdated && serverUpdated >= localUpdated)) {
          writeLocalTable(tableKey, server);
          return server;
        }
        return local;
      } catch (e) {
        return local;
      }
    },
    save: async function (tableKey, value) {
      tableKey = normalizeTableKey(tableKey);
      var payload =
        value && typeof value === 'object'
          ? Object.assign({}, value, { __moabomUpdatedAt: new Date().toISOString() })
          : { value: value, __moabomUpdatedAt: new Date().toISOString() };
      writeLocalTable(tableKey, payload);
      if (!hasOnlineAccess()) {
        return;
      }
      try {
        await pushServerDocument(tableKey, payload);
      } catch (e) {}
    },
    syncMirror: async function () {
      await hydrateAll();
      if (!hasOnlineAccess()) {
        return false;
      }
      return pushServerDocument(SNAPSHOT_TABLE, {
        updatedAt: new Date().toISOString(),
        entries: collectMirrorEntries(),
      });
    },
  };

  window.MoabomAppStorage = MoabomAppStorage;
  shell.appStorage = MoabomAppStorage;
  void hydrateAll();
})();
