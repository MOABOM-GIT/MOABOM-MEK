/**
 * SW Lazy Precache 발신 유틸 테스트
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { postMoabomLazyPrecache } from './moabomLazyPrecache';

describe('postMoabomLazyPrecache', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('controller가 있으면 MOABOM_LAZY_PRECACHE 메시지를 보낸다', () => {
        const postMessage = vi.fn();
        vi.stubGlobal('navigator', {
            serviceWorker: {
                controller: { postMessage },
            },
        });
        postMoabomLazyPrecache(['/api/templates/assets/moabom-basic/js/x.js'], 'test-app');
        expect(postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'MOABOM_LAZY_PRECACHE',
                appId: 'test-app',
                urls: expect.arrayContaining([expect.stringContaining('/api/templates/assets/moabom-basic/js/x.js')]),
            }),
        );
    });

    it('controller가 없으면 호출하지 않는다', () => {
        const postMessage = vi.fn();
        vi.stubGlobal('navigator', { serviceWorker: { controller: null } });
        postMoabomLazyPrecache(['/x.js']);
        expect(postMessage).not.toHaveBeenCalled();
    });
});
