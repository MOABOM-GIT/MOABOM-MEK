import { afterEach, describe, expect, it } from 'vitest';
import { __resetDomXssGuardForTest, installDomXssGuard } from '../domGuard';

describe('domGuard', () => {
    afterEach(() => {
        __resetDomXssGuardForTest();
        document.body.innerHTML = '';
    });

    it('초기 DOM의 inline 이벤트 속성과 javascript URL을 제거한다', () => {
        document.body.innerHTML = `
            <a id="link" href="javascript:alert(1)" onclick="alert(2)">링크</a>
            <form id="form" action="javascript:alert(3)"></form>
        `;

        installDomXssGuard();

        const link = document.querySelector<HTMLAnchorElement>('#link')!;
        const form = document.querySelector<HTMLFormElement>('#form')!;

        expect(link.hasAttribute('onclick')).toBe(false);
        expect(link.hasAttribute('href')).toBe(false);
        expect(form.hasAttribute('action')).toBe(false);
    });

    it('동적으로 추가되는 위험 속성도 제거한다', async () => {
        installDomXssGuard();

        const button = document.createElement('button');
        button.setAttribute('onclick', 'alert(1)');
        document.body.appendChild(button);

        await Promise.resolve();

        expect(button.hasAttribute('onclick')).toBe(false);
    });

    it('기존 요소에 나중에 추가되는 inline 이벤트 속성도 제거한다', async () => {
        document.body.innerHTML = '<button id="target">버튼</button>';
        installDomXssGuard();

        const target = document.querySelector<HTMLButtonElement>('#target')!;
        target.setAttribute('onclick', 'alert(1)');

        await Promise.resolve();

        expect(target.hasAttribute('onclick')).toBe(false);
    });

    it('class 등 일반 속성 변경만으로 observer 무한 루프가 발생하지 않는다', async () => {
        document.body.innerHTML = '<motion.div id="react-like"></motion.div>';
        installDomXssGuard();

        const el = document.querySelector<HTMLElement>('#react-like')!;
        for (let i = 0; i < 200; i += 1) {
            el.setAttribute('class', `state-${i}`);
        }

        await Promise.resolve();

        expect(el.getAttribute('data-moa-xss-guarded')).toBe('1');
    });
});
