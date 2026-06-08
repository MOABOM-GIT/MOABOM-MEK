import { useEffect, useState } from 'react';

export type MoabomThemeId = 'light' | 'dark' | 'flat-light' | 'flat-dark';

const DEFAULT_THEME: MoabomThemeId = 'light';

function readActiveTheme(): MoabomThemeId {
  if (typeof document === 'undefined') {
    return DEFAULT_THEME;
  }
  const raw = document.documentElement.dataset.moaTheme;
  if (raw === 'light' || raw === 'dark' || raw === 'flat-light' || raw === 'flat-dark') {
    return raw;
  }
  return DEFAULT_THEME;
}

/**
 * `html[data-moa-theme]` 속성값을 실시간으로 감지하는 훅.
 *
 * 테마 id 자체가 필요한 서드파티 컴포넌트(react-glass-ui 등)에서
 * 테마별 props 를 분기할 때 사용한다.
 *
 * `useMoabomDarkMode()` 가 단순 "다크 여부" 에 특화되어 있다면, 이 훅은
 * 네 가지 테마(`light` / `dark` / `flat-light` / `flat-dark`)를 구분해야 할 때 쓴다.
 */
export function useMoabomTheme(): MoabomThemeId {
  const [theme, setTheme] = useState<MoabomThemeId>(() => readActiveTheme());

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return;
    }
    const root = document.documentElement;
    const sync = (): void => setTheme(readActiveTheme());
    sync();

    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes' && record.attributeName === 'data-moa-theme') {
          sync();
          return;
        }
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-moa-theme'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

/**
 * 현재 테마가 심플(flat) 계열인지 반환한다.
 * 심플 테마는 그림자·blur·애니메이션을 모두 무력화하는 "속도 우선" 모드.
 */
export function isMoabomFlatTheme(theme: MoabomThemeId): boolean {
  return theme === 'flat-light' || theme === 'flat-dark';
}
