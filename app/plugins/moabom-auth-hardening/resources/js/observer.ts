/**
 * MutationObserver 기반 하드닝 엔진
 *
 * 폼·입력 표면이 추가될 때만 autocomplete 주입을 수행한다.
 * documentElement 전역 subtree 감시는 유지하되, 입력 관련 노드가 없으면 즉시 return.
 */

import { applyAutocompleteHardening } from './autocompleteInjector';

/**
 * requestIdleCallback 이 없는 환경 (테스트/구형 브라우저) 을 위한 타입 정의
 */
type IdleRequestCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;

interface IdleCapableWindow extends Window {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: { timeout: number }) => number;
}

/**
 * defer: 가능하면 requestIdleCallback, 없으면 setTimeout 0 으로 작업을 비동기 큐잉.
 */
function defer(task: () => void): void {
    const win = window as IdleCapableWindow;
    if (typeof win.requestIdleCallback === 'function') {
        win.requestIdleCallback(() => task(), { timeout: 200 });
    } else {
        setTimeout(task, 0);
    }
}

const FORM_CONTROL_SELECTOR = 'input, textarea, select, form, [contenteditable="true"]';

function nodeMayContainFormControls(node: ParentNode): boolean {
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }
    const el = node as Element;
    if (el.matches?.(FORM_CONTROL_SELECTOR)) {
        return true;
    }
    return Boolean(el.querySelector?.(FORM_CONTROL_SELECTOR));
}

/**
 * MutationRecord 배열에서 하드닝 대상이 될 가능성이 있는 노드를 수집합니다.
 *
 * 성능상 addedNodes 만 관심 대상이며 (삭제된 노드는 무시),
 * 입력/폼 관련 노드가 없으면 스킵한다.
 */
function collectTargets(records: MutationRecord[]): ParentNode[] {
    const targets: ParentNode[] = [];
    for (const record of records) {
        record.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && nodeMayContainFormControls(node as ParentNode)) {
                targets.push(node as ParentNode);
            }
        });
    }
    return targets;
}

/**
 * observer 인스턴스 (중복 설치 방지용 싱글톤)
 */
let installedObserver: MutationObserver | null = null;
let pendingTargets: ParentNode[] = [];
let pendingIdle = false;

function flushPendingTargets(): void {
    const targets = pendingTargets;
    pendingTargets = [];
    pendingIdle = false;
    for (const target of targets) {
        try {
            applyAutocompleteHardening(target);
        } catch (err) {
            console.debug('[moabom-auth-hardening] harden target failed', err);
        }
    }
}

/**
 * 전역 MutationObserver 를 설치합니다.
 *
 * 추가되는 input 은 mutation 시 idle 처리하고, 기존 DOM 은 idle 백업 스캔으로 보완합니다.
 * 이미 설치된 경우 중복 설치를 하지 않습니다.
 */
export function installGlobalHardeningObserver(): void {
    if (installedObserver) return;

    const observer = new MutationObserver(records => {
        const targets = collectTargets(records);
        if (targets.length === 0) return;

        pendingTargets.push(...targets);
        if (pendingIdle) return;
        pendingIdle = true;
        defer(flushPendingTargets);
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });

    installedObserver = observer;

    // SPA 는 폼을 나중에 mount 하므로 크리티컬 패스를 막지 않고 idle 에 백업 스캔
    defer(() => applyAutocompleteHardening(document));
}

/**
 * 테스트 목적으로 observer 를 해제합니다. 일반 런타임에서는 호출하지 않습니다.
 */
export function __resetHardeningObserverForTest(): void {
    if (installedObserver) {
        installedObserver.disconnect();
        installedObserver = null;
    }
    pendingTargets = [];
    pendingIdle = false;
}
