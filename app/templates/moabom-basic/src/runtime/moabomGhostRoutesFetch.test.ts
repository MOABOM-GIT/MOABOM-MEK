/**
 * Ghost routes fetch — 경로 판별 단위 테스트
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import {
    installMoabomGhostRoutesFetch,
    isSirsoftEcommercePresentInG7Config,
    pathNeedsEcommerceMergedRoutes,
} from './moabomGhostRoutesFetch';

describe('moabomGhostRoutesFetch', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        delete (window as unknown as { __moabomGhostFetchInstalled?: boolean }).__moabomGhostFetchInstalled;
        delete (window as unknown as { __moabomGhostFetchOriginal?: typeof fetch }).__moabomGhostFetchOriginal;
    });

    it('pathNeedsEcommerceMergedRoutes는 /shop·/cart·/checkout·/orders 접두를 감지한다', () => {
        expect(pathNeedsEcommerceMergedRoutes('/shop')).toBe(true);
        expect(pathNeedsEcommerceMergedRoutes('/shop/foo')).toBe(true);
        expect(pathNeedsEcommerceMergedRoutes('/cart')).toBe(true);
        expect(pathNeedsEcommerceMergedRoutes('/checkout')).toBe(true);
        expect(pathNeedsEcommerceMergedRoutes('/orders')).toBe(true);
        expect(pathNeedsEcommerceMergedRoutes('/')).toBe(false);
        expect(pathNeedsEcommerceMergedRoutes('/me')).toBe(false);
    });

    it('선행 2글자 로케일 세그먼트를 제거한 뒤 이커머스 경로를 판별한다', () => {
        expect(pathNeedsEcommerceMergedRoutes('/en/shop')).toBe(true);
        expect(pathNeedsEcommerceMergedRoutes('/ko')).toBe(false);
    });
});

describe('isSirsoftEcommercePresentInG7Config', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('G7Config 없으면 false', () => {
        vi.stubGlobal('window', { ...window, G7Config: undefined } as unknown as Window & typeof globalThis);
        expect(isSirsoftEcommercePresentInG7Config()).toBe(false);
    });

    it('moduleAssets·deferred·레지스트리 모두 없으면 false', () => {
        vi.stubGlobal('window', {
            ...window,
            G7Config: { moduleAssets: {}, deferredModuleAssets: {} },
        } as unknown as Window & typeof globalThis);
        expect(isSirsoftEcommercePresentInG7Config()).toBe(false);
    });

    it('deferredModuleAssets에 sirsoft-ecommerce가 있으면 true', () => {
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                deferredModuleAssets: { 'sirsoft-ecommerce': { js: '/m.js' } },
            },
        } as unknown as Window & typeof globalThis);
        expect(isSirsoftEcommercePresentInG7Config()).toBe(true);
    });
});

describe('installMoabomGhostRoutesFetch', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        delete (window as unknown as { __moabomGhostFetchInstalled?: boolean }).__moabomGhostFetchInstalled;
        delete (window as unknown as { __moabomGhostFetchOriginal?: typeof fetch }).__moabomGhostFetchOriginal;
        window.fetch = globalThis.fetch;
    });

    it('이커머스 메타가 없으면 routes.json 요청이 Ghost API로 바뀌지 않는다', async () => {
        const innerMock = vi.fn().mockResolvedValue(new Response('{"success":true,"data":{"routes":[]}}', { status: 200 }));
        vi.stubGlobal('window', {
            ...window,
            fetch: innerMock,
            location: { href: 'https://example.com/', origin: 'https://example.com' } as Location,
            G7Config: { moduleAssets: {}, deferredModuleAssets: {} },
        } as unknown as Window & typeof globalThis);

        installMoabomGhostRoutesFetch();
        const routesUrl = 'https://example.com/api/templates/moabom-basic/routes.json?v=1';
        await window.fetch(routesUrl);

        expect(innerMock).toHaveBeenCalled();
        const firstArg = innerMock.mock.calls[0]?.[0];
        expect(String(firstArg)).toBe(routesUrl);
        expect(String(firstArg)).not.toContain('template-routes-shell');
    });
});
