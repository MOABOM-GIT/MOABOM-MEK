import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetConsoleMaskerForTest, installConsoleMasker } from '../consoleMasker';

describe('consoleMasker', () => {
    afterEach(() => {
        __resetConsoleMaskerForTest();
        vi.restoreAllMocks();
    });

    it('console 문자열의 이메일/토큰/비밀번호를 마스킹한다', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        installConsoleMasker();
        console.log('email=user@example.com password=secret Bearer abcdefghijklmnop');

        expect(spy).toHaveBeenCalledWith(
            'email: [MOABOM_MASKED] password: [MOABOM_MASKED] Bearer [MOABOM_MASKED]'
        );
    });

    it('객체의 민감 키를 재귀적으로 마스킹한다', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        installConsoleMasker();
        console.warn({
            user: {
                email: 'user@example.com',
                profile: { name: '홍길동' },
            },
            token: 'plain-token',
        });

        expect(spy).toHaveBeenCalledWith({
            user: {
                email: '[MOABOM_MASKED]',
                profile: { name: '홍길동' },
            },
            token: '[MOABOM_MASKED]',
        });
    });
});
