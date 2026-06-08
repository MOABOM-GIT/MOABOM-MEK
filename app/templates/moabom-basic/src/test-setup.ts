/**
 * Vitest 테스트 환경 설정
 */
import { vi } from 'vitest';
import { act } from 'react';
import '@testing-library/jest-dom/vitest';

// React 19 + @testing-library/react 호환성 설정
// React 19에서 act가 react 패키지로 이동했으므로 react-dom/test-utils를 mock
vi.mock('react-dom/test-utils', () => ({
  act,
}));

if (typeof window !== 'undefined') {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver (constructor 형태 유지)
  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  (window as any).ResizeObserver = MockResizeObserver;
  (globalThis as any).ResizeObserver = MockResizeObserver;

  // Mock IntersectionObserver (constructor 형태 유지)
  class MockIntersectionObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  (window as any).IntersectionObserver = MockIntersectionObserver;
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;

  // Mock scrollTo
  window.scrollTo = vi.fn();

  // localStorage: vi.fn()만 두면 getItem이 항상 undefined라 Bearer 토큰 등이 깨짐 → 인메모리 구현 사용
  const createLocalStorageMock = () => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
    };
  };
  Object.defineProperty(window, 'localStorage', {
    value: createLocalStorageMock(),
    configurable: true,
  });
}
