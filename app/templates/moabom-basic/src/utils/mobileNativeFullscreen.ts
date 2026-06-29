type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

/** iPhone·iPad 등 — Element Fullscreen API 미지원(비디오 제외). 브라우저 뷰포트 맞춤만 사용 */
export function isAppleTouchDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent;
  if (/iPhone|iPod|iPad/i.test(ua)) {
    return true;
  }

  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function isMobileNativeFullscreenSupported(): boolean {
  if (typeof document === 'undefined' || isAppleTouchDevice()) {
    return false;
  }

  return typeof getRequestFullscreen(document.documentElement) === 'function';
}

export function isMobileNativeFullscreenActive(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const doc = document as FullscreenDocument;
  return Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement);
}

function getRequestFullscreen(element: HTMLElement): (() => Promise<void>) | null {
  const el = element as FullscreenElement;
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
  return request ? request.bind(el) : null;
}

function getExitFullscreen(): (() => Promise<void>) | null {
  const doc = document as FullscreenDocument;
  const exit = document.exitFullscreen ?? doc.webkitExitFullscreen;
  return exit ? exit.bind(document) : null;
}

/** 지원 기기(주로 Android)에서 창 루트를 네이티브 풀스크린으로 전환 */
export async function requestMobileNativeFullscreen(target: HTMLElement): Promise<boolean> {
  if (!isMobileNativeFullscreenSupported()) {
    return false;
  }

  const request = getRequestFullscreen(target);
  if (!request) {
    return false;
  }

  try {
    await request();
    return isMobileNativeFullscreenActive();
  } catch {
    return false;
  }
}

export async function exitMobileNativeFullscreen(): Promise<void> {
  if (!isMobileNativeFullscreenActive()) {
    return;
  }

  const exit = getExitFullscreen();
  if (!exit) {
    return;
  }

  try {
    await exit();
  } catch {
    /* 사용자 제스처·이미 종료 등 */
  }
}
