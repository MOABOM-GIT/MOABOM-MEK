import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ensureMoabomShellBootLoaded,
    getMoabomShellBootData,
    installMoabomShellBootFetch,
    resetMoabomShellBootCacheForTest,
    resetMoabomShellBootFetchForTest,
} from './moabomShellBoot';

const BOOT_PAYLOAD = {
    success: true,
    data: {
        defaults: {
            version: 1,
            layout: { leftPanelOpen: true, rightPanelOpen: false, centerMode: 'moabom-apps' },
            appearance: { theme: 'light', pointColor: '#8b5cf6', backgroundImageId: '', fontSize: 3 },
            preferences: {
                language: 'ko',
                systemOptions: {
                    sound: true,
                    animation: true,
                    haptic: true,
                    toast: true,
                    weather: false,
                },
            },
        },
        defaults_revision: 3,
        locale_catalog: { locales: [{ code: 'ko', label: '한국어' }] },
        shell_routes: { version: '1', routes: [{ path: '/', layout: 'home' }] },
        social_providers: ['google', 'kakao'],
    },
};

describe('ensureMoabomShellBootLoaded', () => {
    afterEach(() => {
        resetMoabomShellBootCacheForTest();
        vi.restoreAllMocks();
    });

    it('502/503 시 shell-boot 를 재시도한다', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response('', { status: 502 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(BOOT_PAYLOAD), { status: 200 }));

        const loaded = await ensureMoabomShellBootLoaded(fetchMock);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(loaded?.social_providers).toEqual(['google', 'kakao']);
    });

    it('shell-boot 1회만 호출하고 캐시를 재사용한다', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(BOOT_PAYLOAD), { status: 200 }),
        );

        const first = await ensureMoabomShellBootLoaded(fetchMock);
        const second = await ensureMoabomShellBootLoaded(fetchMock);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain('shell-boot');
        expect(first?.social_providers).toEqual(['google', 'kakao']);
        expect(second).toBe(first);
    });

    it('별도 셸 앱 청크도 window singleton 의 shell-boot 데이터를 재사용한다', async () => {
        const sharedPayload = {
            ...BOOT_PAYLOAD.data,
            site: { site_name: '상쾌한이비인후과', is_platform: false },
            social_providers: ['naver'],
        };
        const fetchMock = vi.fn();

        window.__MoabomShellBoot = { data: sharedPayload as Awaited<ReturnType<typeof ensureMoabomShellBootLoaded>> };

        expect(getMoabomShellBootData()?.site?.site_name).toBe('상쾌한이비인후과');
        const loaded = await ensureMoabomShellBootLoaded(fetchMock);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(loaded?.site?.site_name).toBe('상쾌한이비인후과');
    });
});

describe('installMoabomShellBootFetch', () => {
    afterEach(() => {
        resetMoabomShellBootCacheForTest();
        resetMoabomShellBootFetchForTest();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('frontend-defaults·providers·template-routes-shell 은 shell-boot 1회로 응답한다', async () => {
        const innerMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(BOOT_PAYLOAD), { status: 200 }),
        );

        vi.stubGlobal('window', {
            ...window,
            fetch: innerMock,
            location: { href: 'https://example.com/', origin: 'https://example.com' } as Location,
        } as unknown as Window & typeof globalThis);

        installMoabomShellBootFetch();

        const defaultsRes = await window.fetch(
            'https://example.com/api/modules/moabom-system/public/frontend-defaults',
        );
        const providersRes = await window.fetch(
            'https://example.com/api/modules/moabom-social-auth/providers',
        );
        const routesRes = await window.fetch(
            'https://example.com/api/modules/moabom-system/public/template-routes-shell?template=moabom-basic&scope=shell',
        );

        expect(innerMock).toHaveBeenCalledTimes(1);
        expect(String(innerMock.mock.calls[0]?.[0])).toContain('shell-boot');

        const defaultsJson = await defaultsRes.json();
        expect(defaultsJson.data.defaults_revision).toBe(3);

        const providersJson = await providersRes.json();
        expect(providersJson.data.providers).toEqual(['google', 'kakao']);

        const routesJson = await routesRes.json();
        expect(routesJson.data.routes.length).toBeGreaterThan(1);
        expect(routesJson.data.routes.some((r: { path?: string }) => r.path === '/404')).toBe(true);
    });
});
