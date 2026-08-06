export const GENERATED_APP_FILE_DOWNLOAD_MAX_BYTES = 10 * 1024 * 1024;

export type GeneratedAppFileDownloadEncoding = 'utf8' | 'base64';

export interface MoabomAppFileDownloadMessage {
  source: 'moabom-app';
  type: 'file-download';
  filename: string;
  mimeType: string;
  encoding: GeneratedAppFileDownloadEncoding;
  data: string;
}

const ALLOWED_ENCODINGS = new Set<GeneratedAppFileDownloadEncoding>(['utf8', 'base64']);

export function sanitizeGeneratedAppDownloadFilename(raw: unknown): string {
  const base = String(raw ?? 'download').replace(/\\/g, '/').split('/').pop()?.trim() || 'download';
  const sanitized = base.replace(/[^\w.\- ()[\]\uAC00-\uD7A3]+/g, '_').slice(0, 180);
  return sanitized || 'download';
}

export function isAllowedGeneratedAppDownloadMimeType(mime: unknown): boolean {
  const value = String(mime ?? '').trim();
  if (!value || value.length > 120) {
    return false;
  }
  if (/^text\/html/i.test(value) || /^application\/xhtml/i.test(value)) {
    return false;
  }
  if (/javascript|svg\+xml/i.test(value)) {
    return false;
  }
  return /^[\w.+-]+\/[\w.+-]+(?:;[\w.=-]+)*$/i.test(value);
}

export function decodeGeneratedAppDownloadPayload(
  encoding: GeneratedAppFileDownloadEncoding,
  data: string,
): Uint8Array | null {
  try {
    if (encoding === 'base64') {
      const binary = atob(data);
      if (binary.length > GENERATED_APP_FILE_DOWNLOAD_MAX_BYTES) {
        return null;
      }
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
    const bytes = new TextEncoder().encode(data);
    if (bytes.length > GENERATED_APP_FILE_DOWNLOAD_MAX_BYTES) {
      return null;
    }
    return bytes;
  } catch {
    return null;
  }
}

export function triggerGeneratedAppDownload(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
): boolean {
  if (typeof document === 'undefined' || bytes.length <= 0) {
    return false;
  }
  const blobBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(blobBuffer).set(bytes);
  const blob = new Blob([blobBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export function parseMoabomAppFileDownloadMessage(data: unknown): MoabomAppFileDownloadMessage | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const message = data as Partial<MoabomAppFileDownloadMessage>;
  if (message.source !== 'moabom-app' || message.type !== 'file-download') {
    return null;
  }
  const encoding = message.encoding;
  if (!encoding || !ALLOWED_ENCODINGS.has(encoding)) {
    return null;
  }
  if (typeof message.data !== 'string' || message.data.length === 0) {
    return null;
  }
  if (encoding === 'base64' && message.data.length * 0.75 > GENERATED_APP_FILE_DOWNLOAD_MAX_BYTES) {
    return null;
  }
  const mimeType = String(message.mimeType ?? '').trim();
  if (!isAllowedGeneratedAppDownloadMimeType(mimeType)) {
    return null;
  }
  const filename = sanitizeGeneratedAppDownloadFilename(message.filename);
  return {
    source: 'moabom-app',
    type: 'file-download',
    filename,
    mimeType,
    encoding,
    data: message.data,
  };
}

export function handleMoabomAppFileDownloadMessage(data: unknown): boolean {
  const message = parseMoabomAppFileDownloadMessage(data);
  if (!message) {
    return false;
  }
  const bytes = decodeGeneratedAppDownloadPayload(message.encoding, message.data);
  if (!bytes || bytes.length <= 0) {
    return false;
  }
  return triggerGeneratedAppDownload(bytes, message.filename, message.mimeType);
}

export type MoabomAppShellToastSeverity = 'info' | 'success' | 'warning' | 'error';

export interface MoabomAppShellToastMessage {
  source: 'moabom-app';
  type: 'shell-toast';
  message: string;
  severity: MoabomAppShellToastSeverity;
}

export interface MoabomAppShellOpenAppMessage {
  source: 'moabom-app';
  type: 'shell-open-app';
  appId: string;
}

const ALLOWED_TOAST_SEVERITIES = new Set<MoabomAppShellToastSeverity>([
  'info',
  'success',
  'warning',
  'error',
]);

export function parseMoabomAppShellToastMessage(data: unknown): MoabomAppShellToastMessage | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const message = data as Partial<MoabomAppShellToastMessage>;
  if (message.source !== 'moabom-app' || message.type !== 'shell-toast') {
    return null;
  }
  const text = String(message.message ?? '').trim().slice(0, 240);
  if (!text) {
    return null;
  }
  const severity = ALLOWED_TOAST_SEVERITIES.has(message.severity as MoabomAppShellToastSeverity)
    ? (message.severity as MoabomAppShellToastSeverity)
    : 'info';
  return {
    source: 'moabom-app',
    type: 'shell-toast',
    message: text,
    severity,
  };
}

export function parseMoabomAppShellOpenAppMessage(data: unknown): MoabomAppShellOpenAppMessage | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const message = data as Partial<MoabomAppShellOpenAppMessage>;
  if (message.source !== 'moabom-app' || message.type !== 'shell-open-app') {
    return null;
  }
  const appId = String(message.appId ?? '').trim().slice(0, 120);
  if (!appId || !/^[a-z0-9][a-z0-9._-]*$/i.test(appId)) {
    return null;
  }
  return {
    source: 'moabom-app',
    type: 'shell-open-app',
    appId,
  };
}

/**
 * allowlist 셸 메시지 처리. 처리했으면 true.
 * openApp 은 콜백으로 위임 (셸 창 오케스트레이터).
 */
export function handleMoabomAppShellBridgeMessage(
  data: unknown,
  handlers: {
    onToast: (message: string, severity: MoabomAppShellToastSeverity) => void;
    onOpenApp?: (appId: string) => void;
  },
): boolean {
  const toast = parseMoabomAppShellToastMessage(data);
  if (toast) {
    handlers.onToast(toast.message, toast.severity);
    return true;
  }
  const openApp = parseMoabomAppShellOpenAppMessage(data);
  if (openApp) {
    handlers.onOpenApp?.(openApp.appId);
    return true;
  }
  return false;
}
