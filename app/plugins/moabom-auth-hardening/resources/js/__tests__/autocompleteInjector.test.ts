/**
 * autocompleteInjector 테스트
 *
 * jsdom 환경에서 아래를 검증합니다:
 *   1) password 1 + email 1 (로그인 폼) → current-password / username
 *   2) password 2 + email 1 (회원가입 폼) → new-password / new-password / username
 *   3) 이미 autocomplete 가 지정된 input 은 덮어쓰지 않음
 *   4) applyAutocompleteHardening 을 여러 번 호출해도 결과 동일 (idempotent)
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
    applyAutocompleteHardening,
    inferPasswordAutocomplete,
    inferUsernameAutocomplete,
    __isInputHardenedForTest,
} from '../autocompleteInjector';

function setBody(html: string): void {
    document.body.innerHTML = html;
}

describe('autocompleteInjector', () => {
    beforeEach(() => {
        setBody('');
    });

    it('로그인 폼: password 1 + email 1 → current-password / username', () => {
        setBody(`
            <form id="login">
                <input type="email" name="email" />
                <input type="password" name="password" />
                <button type="submit">로그인</button>
            </form>
        `);

        applyAutocompleteHardening(document);

        const email = document.querySelector<HTMLInputElement>('input[type="email"]')!;
        const password = document.querySelector<HTMLInputElement>('input[type="password"]')!;

        expect(email.getAttribute('autocomplete')).toBe('username');
        expect(password.getAttribute('autocomplete')).toBe('current-password');
        expect(__isInputHardenedForTest(email)).toBe(true);
        expect(__isInputHardenedForTest(password)).toBe(true);
    });

    it('회원가입 폼: password 2 + email 1 → new-password / new-password / username', () => {
        setBody(`
            <form id="register">
                <input type="email" name="email" />
                <input type="password" name="password" />
                <input type="password" name="password_confirm" />
            </form>
        `);

        applyAutocompleteHardening(document);

        const email = document.querySelector<HTMLInputElement>('input[type="email"]')!;
        const passwords = document.querySelectorAll<HTMLInputElement>('input[type="password"]');

        expect(email.getAttribute('autocomplete')).toBe('username');
        expect(passwords).toHaveLength(2);
        passwords.forEach(pw => {
            expect(pw.getAttribute('autocomplete')).toBe('new-password');
            expect(__isInputHardenedForTest(pw)).toBe(true);
        });
    });

    it('이미 autocomplete 가 지정된 input 은 덮어쓰지 않음', () => {
        setBody(`
            <form>
                <input type="email" name="email" autocomplete="email" />
                <input type="password" name="password" autocomplete="off" />
            </form>
        `);

        applyAutocompleteHardening(document);

        const email = document.querySelector<HTMLInputElement>('input[type="email"]')!;
        const password = document.querySelector<HTMLInputElement>('input[type="password"]')!;

        // 명시된 값 그대로 유지
        expect(email.getAttribute('autocomplete')).toBe('email');
        expect(password.getAttribute('autocomplete')).toBe('off');
        expect(__isInputHardenedForTest(email)).toBe(true);
        expect(__isInputHardenedForTest(password)).toBe(true);
    });

    it('여러 번 호출해도 idempotent 하다', () => {
        setBody(`
            <form>
                <input type="email" name="email" />
                <input type="password" name="password" />
            </form>
        `);

        applyAutocompleteHardening(document);
        const snapshot1 = document.body.innerHTML;

        applyAutocompleteHardening(document);
        applyAutocompleteHardening(document);
        const snapshot2 = document.body.innerHTML;

        expect(snapshot2).toBe(snapshot1);
    });

    it('text input 의 name 이 username 계열이면 username 토큰을 주입한다', () => {
        setBody(`
            <form>
                <input type="text" name="userid" />
                <input type="password" name="password" />
            </form>
        `);

        applyAutocompleteHardening(document);

        const userid = document.querySelector<HTMLInputElement>('input[name="userid"]')!;
        expect(userid.getAttribute('autocomplete')).toBe('username');
        expect(__isInputHardenedForTest(userid)).toBe(true);
    });

    it('form 이 없는 단독 password input 은 current-password 로 보수적 주입하고 name 은 건드리지 않는다', () => {
        setBody(`<input type="password" id="lonely" />`);

        applyAutocompleteHardening(document);

        const input = document.querySelector<HTMLInputElement>('#lonely')!;
        expect(input.getAttribute('autocomplete')).toBe('current-password');
        expect(input.hasAttribute('name')).toBe(false);
        expect(input.getAttribute('spellcheck')).toBe('false');
        expect(input.getAttribute('autocapitalize')).toBe('none');
    });

    it('회원가입/재설정 힌트가 있는 단일 password form 은 new-password 로 주입한다', () => {
        setBody(`
            <form id="reset-password-form">
                <input type="password" name="password" />
            </form>
        `);

        applyAutocompleteHardening(document);

        const input = document.querySelector<HTMLInputElement>('input[type="password"]')!;
        expect(input.getAttribute('autocomplete')).toBe('new-password');
    });

    it('inferPasswordAutocomplete / inferUsernameAutocomplete 순수 함수 동작', () => {
        setBody(`
            <form id="f1">
                <input type="password" id="p1" />
            </form>
            <form id="f2">
                <input type="password" id="p2a" />
                <input type="password" id="p2b" />
            </form>
            <input type="email" id="e1" />
        `);

        const p1 = document.querySelector<HTMLInputElement>('#p1')!;
        const p2a = document.querySelector<HTMLInputElement>('#p2a')!;
        const e1 = document.querySelector<HTMLInputElement>('#e1')!;

        expect(inferPasswordAutocomplete(p1)).toBe('current-password');
        expect(inferPasswordAutocomplete(p2a)).toBe('new-password');
        expect(inferUsernameAutocomplete(e1)).toBe('username');
    });
});
