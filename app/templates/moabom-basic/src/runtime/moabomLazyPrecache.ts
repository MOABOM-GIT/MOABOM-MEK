/**
 * moabom-pwa SW — `MOABOM_LAZY_PRECACHE` 메시지 발신 (docs/moabom-pwa-lazy-precache.md).
 */

export function postMoabomLazyPrecache(urls: string[], appId?: string): void {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
        return;
    }
    const clean = urls.filter((u) => typeof u === 'string' && u.length > 0).slice(0, 30);
    if (clean.length === 0) {
        return;
    }
    try {
        const absolute = clean.map((u) => new URL(u, window.location.origin).href);
        navigator.serviceWorker.controller.postMessage({
            type: 'MOABOM_LAZY_PRECACHE',
            urls: absolute,
            appId,
        });
    } catch {
        // SW 미가동·postMessage 실패 무시
    }
}
