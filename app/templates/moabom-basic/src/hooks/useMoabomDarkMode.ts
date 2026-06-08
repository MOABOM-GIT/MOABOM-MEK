import { useEffect, useState } from 'react';

/**
 * `html.classList`에 `dark` 클래스가 붙어 있는지 실시간으로 감지하는 훅.
 *
 * 그누보드7 표준 다크 모드는 `document.documentElement.classList.toggle('dark')` 로 활성화된다.
 * `react-glass-ui` 처럼 props 로 직접 색상 hex 를 받는 서드파티 컴포넌트에서
 * 다크 모드 색상 세트를 분기할 때 사용한다.
 *
 * @example
 * const isDark = useMoabomDarkMode();
 * <GlassCard backgroundColor={isDark ? '#0f172a' : '#ffffff'} ... />
 */
export function useMoabomDarkMode(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') {
      return false;
    }
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const sync = (): void => {
      setIsDark(root.classList.contains('dark'));
    };
    sync();

    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes' && record.attributeName === 'class') {
          sync();
          return;
        }
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  return isDark;
}
