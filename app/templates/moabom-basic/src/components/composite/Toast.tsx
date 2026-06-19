import React, { useEffect, useReducer, useState, useCallback, useMemo } from 'react';
import { Div } from '../basic/Div';
import { Span } from '../basic/Span';
import { Button } from '../basic/Button';
import { Icon } from '../basic/Icon';
import { IconName } from '../basic/IconTypes';
import { MoabomRuntime } from '../../runtime/MoabomRuntime';
import { MOABOM_RUNTIME_OPTIONS_CHANGED_EVENT } from '../../runtime/events';
import { useMoabomPwaUpdate } from '../../runtime/pwa/usePwaUpdate';

/**
 * G7Core.t() 번역 함수 참조
 * 런타임에 G7Core.t를 접근하여 테스트 환경에서도 모킹이 적용되도록 함
 */
const getTranslation = (key: string, params?: Record<string, string | number>) => {
  const G7Core = (window as any).G7Core;
  return G7Core?.t?.(key, params) ?? key;
};

export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * 토스트의 중요도 분류 (Req 5.4, 5.5).
 *
 * - `'system'` : 저장/검증/권한/업로드 등 사용자 액션에 대한 **즉각 피드백**.
 *                `toast` Effective_Option_Value 가 `false` 인 상태에서도 항상 렌더된다.
 * - `'content'` : 댓글·게시물 알림 등 passive notification. `toast` off 상태에서 차단된다.
 *
 * 미지정(`undefined`) 은 런타임에서 `'content'` 로 취급한다 — 기존 `G7Core.dispatch({ handler: 'toast' })`
 * 호출부(severity 미지정) 는 자동으로 저중요도로 분류되어 회귀가 발생하지 않는다.
 */
export type ToastSeverity = 'system' | 'content';
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ToastItem {
  id: string | number;
  type: ToastType;
  message: string;
  /** 커스텀 아이콘 이름 (지정하지 않으면 타입별 기본 아이콘 사용) */
  icon?: string;
  /** 개별 토스트 자동 닫힘 시간 (ms) */
  duration?: number;
  /**
   * 중요도. 미지정 시 런타임에서 `'content'` 로 취급 (Req 5.4 — 기존 호출부 회귀 방지 계약).
   * `'system'` 으로 명시된 항목만 `toast` 옵션 off 상태에서도 렌더된다.
   */
  severity?: ToastSeverity;
  /** 수동 액션 버튼. PWA 업데이트처럼 사용자 승인이 필요한 시스템 토스트에 사용한다. */
  action?: {
    label: string;
    onClick: () => void | Promise<void>;
  };
}

export interface ToastProps {
  /** 토스트 배열 (전역 상태 _global.toasts) */
  toasts?: ToastItem[] | null;
  /** 토스트 표시 위치 */
  position?: ToastPosition;
  /** 기본 자동 닫힘 시간 (ms, 기본 3000) */
  duration?: number;
  /** 토스트 제거 콜백 (전역 상태 업데이트용) */
  onRemove?: (id: string | number) => void;
}

// 타입별 기본 아이콘 매핑
const defaultIconMap: Record<ToastType, IconName> = {
  success: IconName.CheckCircle,
  error: IconName.XCircle,
  warning: IconName.ExclamationTriangle,
  info: IconName.InfoCircle,
};

// 타입별 스타일 매핑
const typeStyleMap: Record<ToastType, { bg: string; text: string }> = {
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    text: 'text-green-800 dark:text-green-300',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-300',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-800 dark:text-yellow-300',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-300',
  },
};

// position별 스타일 매핑
const positionClassMap: Record<ToastPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
};

/**
 * Toast 컴포넌트
 *
 * 전역 상태(_global.toasts)를 구독하여 토스트 알림을 스택으로 표시하는 컴포넌트.
 * ActionDispatcher의 toast 핸들러와 연동됩니다.
 *
 * 기능:
 * - 다중 토스트 스택 지원
 * - 타입별 스타일 (success, error, warning, info)
 * - 커스텀 아이콘 지정 가능
 * - 개별 토스트 자동 닫힘 시간 설정
 * - 수동 닫기 버튼
 *
 * @example
 * // 레이아웃 JSON 사용 예시 (_user_base.json)
 * {
 *   "id": "global_toast",
 *   "type": "composite",
 *   "name": "Toast",
 *   "props": {
 *     "toasts": "{{_global.toasts}}",
 *     "position": "bottom-center",
 *     "duration": 3000
 *   }
 * }
 *
 * @example
 * // toast 핸들러 호출 예시 (레이아웃 JSON)
 * {
 *   "handler": "toast",
 *   "params": {
 *     "type": "success",
 *     "message": "$t:common.save_success",
 *     "icon": "check",
 *     "duration": 5000
 *   }
 * }
 */
export const Toast: React.FC<ToastProps> = ({
  toasts,
  position = 'bottom-center',
  duration = 3000,
  onRemove,
}) => {
  useMoabomPwaUpdate();

  // 내부적으로 표시할 토스트 상태 관리 (애니메이션용)
  const [visibleToasts, setVisibleToasts] = useState<Map<string | number, boolean>>(new Map());

  /**
   * Req 5.1 / 5.5 — `toast` Effective_Option_Value 가 false 로 바뀌어도
   * MoabomRuntime 동기 getter 로 가드가 걸리므로 이 컴포넌트는 자체적으로는 리렌더되지 않는다.
   * 런타임 이벤트(`moabom-runtime-options-changed`) 를 구독해 강제 리렌더를 트리거한다.
   */
  const [, forceRerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (): void => forceRerender();
    window.addEventListener(MOABOM_RUNTIME_OPTIONS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MOABOM_RUNTIME_OPTIONS_CHANGED_EVENT, handler);
  }, []);

  /**
   * Req 5.1 / 5.3 / 5.4 / 5.5 — severity 기반 필터 가드.
   *
   * - `toast` effective = true : 입력 배열 전부를 렌더(기존 동작 유지).
   * - `toast` effective = false : `severity === 'system'` 인 항목만 필터해 유지.
   *   `severity` 가 부재(`undefined`) 이거나 `'content'` 인 항목은 렌더에서 제외된다.
   *
   * `_global.toasts` 배열 수집(Req 5.2) 은 본 가드와 무관하며, `toast` off 상태에서도
   * 코어 엔진의 `toast` 액션 핸들러는 payload 를 그대로 push 한다.
   */
  const visibleForSeverity = useMemo<ToastItem[]>(() => {
    const list = toasts ?? [];
    let effectiveToast = true;
    try {
      effectiveToast = MoabomRuntime.getEffectiveOption('toast') !== false;
    } catch {
      effectiveToast = true;
    }
    if (effectiveToast) return list;
    return list.filter((item) => item?.severity === 'system');
  }, [toasts]);

  // 토스트 제거 핸들러
  const handleRemove = useCallback((id: string | number) => {
    // 먼저 숨김 애니메이션 시작
    setVisibleToasts(prev => {
      const next = new Map(prev);
      next.set(id, false);
      return next;
    });

    // 애니메이션 후 실제 제거
    setTimeout(() => {
      if (onRemove) {
        onRemove(id);
      } else {
        // onRemove가 없으면 G7Core.state.update를 통해 전역 상태 업데이트
        const G7Core = (window as any).G7Core;
        if (G7Core?.state?.update) {
          G7Core.state.update((prevState: Record<string, any>) => {
            const currentToasts = Array.isArray(prevState.toasts) ? prevState.toasts : [];
            return {
              toasts: currentToasts.filter((t: ToastItem) => t.id !== id),
            };
          });
        }
      }
    }, 300);
  }, [onRemove]);

  // 새 토스트가 추가되면 visible 상태 설정 및 자동 제거 타이머 설정
  useEffect(() => {
    if (visibleForSeverity.length === 0) return;

    visibleForSeverity.forEach(toast => {
      // 이미 처리된 토스트는 건너뜀
      if (visibleToasts.has(toast.id)) return;

      // visible 상태 추가
      setVisibleToasts(prev => {
        const next = new Map(prev);
        next.set(toast.id, true);
        return next;
      });

      // 자동 제거 타이머 설정
      const effectiveDuration = toast.duration !== undefined ? toast.duration : duration;
      if (effectiveDuration > 0) {
        setTimeout(() => {
          handleRemove(toast.id);
        }, effectiveDuration);
      }
    });
  }, [visibleForSeverity, duration, handleRemove, visibleToasts]);

  // 렌더 대상이 없으면 null — severity 필터 이후 기준
  if (visibleForSeverity.length === 0) {
    return null;
  }

  return (
    <Div
      className={`fixed z-[9999] flex flex-col gap-2 ${positionClassMap[position]}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {visibleForSeverity.map((toast) => (
        <ToastItemComponent
          key={toast.id}
          toast={toast}
          position={position}
          isVisible={visibleToasts.get(toast.id) ?? true}
          onClose={() => handleRemove(toast.id)}
        />
      ))}
    </Div>
  );
};

interface ToastItemComponentProps {
  toast: ToastItem;
  position: ToastPosition;
  isVisible: boolean;
  onClose: () => void;
}

const ToastItemComponent: React.FC<ToastItemComponentProps> = ({ toast, position, isVisible, onClose }) => {
  const typeStyle = typeStyleMap[toast.type] || typeStyleMap.info;

  // 아이콘 결정: 커스텀 아이콘 > 타입별 기본 아이콘
  const iconName = toast.icon
    ? (toast.icon as IconName)
    : defaultIconMap[toast.type];

  // position에 따라 숨김 애니메이션 방향 결정 (top → 위로, bottom → 아래로)
  const hideTranslate = position.startsWith('bottom') ? 'translate-y-2' : '-translate-y-2';

  return (
    <Div
      className={`
        flex items-center gap-3 p-4 rounded-lg border shadow-lg
        min-w-[300px] max-w-md
        transition-all duration-300
        ${typeStyle.bg}
        ${isVisible ? 'opacity-100 translate-y-0' : `opacity-0 ${hideTranslate}`}
      `}
      role="alert"
    >
      <Icon
        name={iconName}
        className={`w-5 h-5 flex-shrink-0 ${typeStyle.text}`}
      />
      <Span className={`flex-1 text-sm font-bold ${typeStyle.text}`}>
        {toast.message}
      </Span>
      {toast.action ? (
        <Button
          type="button"
          onClick={() => {
            void toast.action?.onClick();
          }}
          className={`flex-shrink-0 px-2 py-1 rounded text-xs font-bold hover:bg-black/10 dark:hover:bg-white/10 ${typeStyle.text} focus:outline-none`}
        >
          {toast.action.label}
        </Button>
      ) : null}
      <Button
        type="button"
        onClick={onClose}
        className={`flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 ${typeStyle.text} focus:outline-none`}
        aria-label={getTranslation('common.close')}
      >
        <Icon name={IconName.Times} className="w-4 h-4" />
      </Button>
    </Div>
  );
};

export default Toast;
