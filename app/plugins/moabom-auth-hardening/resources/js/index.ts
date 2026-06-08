/**
 * moabom-auth-hardening 플러그인 엔트리포인트
 *
 * 설계 목표:
 *   - 코어/템플릿 수정 없이 전역 입력 보안, 콘솔 마스킹,
 *     DOM XSS 보조 가드를 설치한다.
 *   - G7Core 등 외부 글로벌 의존성 없이 순수 DOM 로 동작한다.
 *   - DOM 이 이미 파싱되었든, 이후 SPA 라우팅/모달로 새로 추가되든 동작한다.
 *
 * 전역 IIFE 로 번들되어 어떤 페이지에서든 빠르게 초기화됩니다.
 */

import { installGlobalHardeningObserver } from './observer';
import { installConsoleMasker } from './consoleMasker';
import { getSecurityGuardConfig } from './config';
import { installDomXssGuard } from './domGuard';
import { installTrustedTypesPolicy } from './trustedTypes';

/* eslint-disable @typescript-eslint/no-explicit-any */

(function initMoabomAuthHardening() {
    try {
        // SSR / 비브라우저 가드
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        // 중복 초기화 방지 플래그
        const w = window as any;
        if (w.__moabomAuthHardeningInitialized) return;
        w.__moabomAuthHardeningInitialized = true;

        const start = () => {
            try {
                const config = getSecurityGuardConfig();
                if (!config.enabled) return;

                if (config.consoleMaskingEnabled) {
                    installConsoleMasker();
                }

                installGlobalHardeningObserver();

                if (config.trustedTypesEnabled) {
                    installTrustedTypesPolicy();
                }

                if (config.domGuardEnabled) {
                    installDomXssGuard();
                }

                console.debug('[moabom-auth-hardening] security guard installed');
            } catch (err) {
                console.debug('[moabom-auth-hardening] install failed', err);
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            // 이미 DOM 이 준비된 경우 즉시 실행
            start();
        }
    } catch (err) {
        // 플러그인 자체 예외가 페이지를 깨뜨리지 않도록 최상위 캐치
        console.debug('[moabom-auth-hardening] bootstrap failed', err);
    }
})();
