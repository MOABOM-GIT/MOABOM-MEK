/**
 * autocompleteInjector — 순수 DOM 유틸리티
 *
 * 비밀번호 / 이메일 / 사용자명 input 에 적절한 autocomplete 토큰을
 * 비파괴 방식으로 주입합니다. 템플릿이 이미 autocomplete 를 지정한 경우
 * 어떠한 경우에도 값을 덮어쓰지 않습니다.
 */

const hardenedInputs = new WeakSet<HTMLInputElement>();

/**
 * @deprecated DOM 마커 대신 WeakSet 을 사용합니다. 테스트 호환용으로만 유지합니다.
 */
export const HARDENED_MARKER = 'data-moa-auth-hardened';

/**
 * username 추정에 사용할 name 힌트 패턴
 *
 * login input 은 보통 name 이 email / username / login / userid 를 포함합니다.
 * 대소문자 무시로 부분 일치합니다.
 */
const USERNAME_NAME_HINT_PATTERN = /(email|username|user_?name|login|userid|user_?id)/i;

/**
 * input 이 username 후보 (text 타입에 한함) 인지 판정합니다.
 *
 * email 타입 input 은 별도로 바로 username 후보이므로 본 함수에서는
 * type="text" 이면서 이름이 username 계열인 input만을 걸러냅니다.
 */
function isUsernameCandidateTextInput(input: HTMLInputElement): boolean {
    if (input.type !== 'text') return false;
    const name = input.getAttribute('name') ?? '';
    const id = input.getAttribute('id') ?? '';
    return USERNAME_NAME_HINT_PATTERN.test(name) || USERNAME_NAME_HINT_PATTERN.test(id);
}

/**
 * input 이 이미 사람이 명시한 autocomplete 속성을 가지는지 확인합니다.
 *
 * 빈 문자열은 지정된 것으로 간주하지 않습니다 (대부분의 브라우저가 공백으로
 * 처리하므로 주입해도 안전합니다).
 */
function hasExplicitAutocomplete(input: HTMLInputElement): boolean {
    if (!input.hasAttribute('autocomplete')) return false;
    const value = input.getAttribute('autocomplete') ?? '';
    return value.trim().length > 0;
}

/**
 * input 의 가장 가까운 form 조상을 반환합니다.
 *
 * 일부 템플릿은 form 태그 없이 div 기반 컨테이너로 감싸기도 하므로
 * form 이 없을 수도 있다고 가정합니다.
 */
function findOwningForm(input: HTMLInputElement): HTMLFormElement | null {
    // 표준 HTMLInputElement.form 프로퍼티 우선 사용 (form="id" 속성도 지원)
    if (input.form instanceof HTMLFormElement) {
        return input.form;
    }
    const closestForm = input.closest('form');
    return closestForm instanceof HTMLFormElement ? closestForm : null;
}

/**
 * form 내부에서 password 타입 input 의 개수를 계산합니다.
 */
function countPasswordFields(form: HTMLFormElement): number {
    return form.querySelectorAll('input[type="password"]').length;
}

function hasRegistrationHints(form: HTMLFormElement): boolean {
    const hintText = [
        form.getAttribute('id') ?? '',
        form.getAttribute('name') ?? '',
        form.getAttribute('class') ?? '',
        form.getAttribute('action') ?? '',
        form.textContent ?? '',
    ].join(' ');

    return /(register|signup|sign-up|join|reset|change|confirm|회원가입|가입|재설정|변경|확인)/i.test(hintText);
}

/**
 * password input 에 적용할 autocomplete 토큰을 추론합니다.
 *
 * 규칙:
 *   - 같은 form 에 password 가 2개 이상 → 'new-password'
 *     (회원가입 / 비밀번호 재설정 시 "새 비밀번호" + "확인" 구조 가정)
 *   - password 가 1개 → 'current-password' (로그인 가정)
 *   - form 을 찾지 못한 경우 → 'current-password' (보수적 기본값)
 */
export function inferPasswordAutocomplete(
    input: HTMLInputElement
): 'current-password' | 'new-password' {
    const form = findOwningForm(input);
    if (!form) return 'current-password';
    return countPasswordFields(form) >= 2 || hasRegistrationHints(form)
        ? 'new-password'
        : 'current-password';
}

/**
 * username / email input 에 적용할 autocomplete 토큰을 추론합니다.
 *
 * 현재 규칙에서는 로그인/회원가입 여부와 무관하게 항상 'username' 을
 * 사용합니다 (브라우저 힌트 측면에서 동일하게 동작).
 */
export function inferUsernameAutocomplete(_input: HTMLInputElement): 'username' {
    return 'username';
}

/**
 * name 속성이 비어있는 경우 최소한의 name 을 보강합니다.
 *
 * 이미 name 이 있으면 절대 덮어쓰지 않습니다 (템플릿의 폼 바인딩 존중).
 */
function setInputSecurityAttributes(input: HTMLInputElement): void {
    if (!input.hasAttribute('spellcheck')) {
        input.setAttribute('spellcheck', 'false');
    }

    if (!input.hasAttribute('autocapitalize')) {
        input.setAttribute('autocapitalize', 'none');
    }

    if (!input.hasAttribute('data-1p-ignore')) {
        input.setAttribute('data-1p-ignore', 'false');
    }
}

/**
 * 단일 input 을 하드닝합니다. 이미 처리됐거나 autocomplete 가
 * 명시되어 있으면 비파괴적으로 skip 합니다.
 */
function hardenInput(input: HTMLInputElement): void {
    if (hardenedInputs.has(input)) return;

    const type = (input.getAttribute('type') ?? input.type ?? '').toLowerCase();

    if (type === 'password') {
        if (!hasExplicitAutocomplete(input)) {
            input.setAttribute('autocomplete', inferPasswordAutocomplete(input));
        }
        setInputSecurityAttributes(input);
        hardenedInputs.add(input);
        return;
    }

    if (type === 'email') {
        if (!hasExplicitAutocomplete(input)) {
            input.setAttribute('autocomplete', inferUsernameAutocomplete(input));
        }
        setInputSecurityAttributes(input);
        hardenedInputs.add(input);
        return;
    }

    if (isUsernameCandidateTextInput(input)) {
        if (!hasExplicitAutocomplete(input)) {
            input.setAttribute('autocomplete', inferUsernameAutocomplete(input));
        }
        setInputSecurityAttributes(input);
        hardenedInputs.add(input);
        return;
    }

    // 위 조건 어디에도 해당하지 않는 input 은 마커를 남기지 않음 (다음 스캔에서 재평가 가능)
}

/**
 * root 하위 전체를 스캔하여 하드닝을 적용합니다.
 *
 * idempotent (여러 번 호출해도 같은 결과):
 *   - 이미 하드닝된 input 은 WeakSet 으로 skip
 *   - 명시된 autocomplete 는 존중
 *
 * 성능 참고:
 *   - 스캔은 root.querySelectorAll 한 번 + 루프
 *   - 개별 form 의 password 개수 계산은 input 당 한 번
 */
export function applyAutocompleteHardening(root: ParentNode): void {
    // root 자체가 input 인 경우도 처리
    if (root instanceof HTMLInputElement) {
        hardenInput(root);
        return;
    }

    const inputs = root.querySelectorAll<HTMLInputElement>(
        'input[type="password"], input[type="email"], input[type="text"], input:not([type])'
    );

    for (const input of Array.from(inputs)) {
        hardenInput(input);
    }
}

/** 테스트 전용: input 이 하드닝 처리됐는지 확인합니다. */
export function __isInputHardenedForTest(input: HTMLInputElement): boolean {
    return hardenedInputs.has(input);
}