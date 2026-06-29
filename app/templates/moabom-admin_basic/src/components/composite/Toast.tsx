import React, { useEffect, useState, useCallback } from 'react';
import { Div } from '../basic/Div';
import { Span } from '../basic/Span';
import { Button } from '../basic/Button';
import { Icon } from '../basic/Icon';
import { IconName } from '../basic/IconTypes';

/**
 * G7Core.t() 번역 함수 참조
 * 런타임에 G7Core.t를 접근하여 테스트 환경에서도 모킹이 적용되도록 함
 */
const getTranslation = (key: string, params?: Record<string, string | number>) => {
  const G7Core = (window as any).G7Core;
  return G7Core?.t?.(key, params) ?? key;
};

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/** 토스트 액션 버튼 (확인/취소 등). 공용 토스트 라이브러리 표면 — moabom-basic Toast 와 동일 계약. */
export interface ToastActionButton {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: 'primary' | 'secondary';
}

export interface ToastItem {
  id: string | number;
  type: ToastType;
  message: string;
  /** 커스텀 아이콘 이름 (지정하지 않으면 타입별 기본 아이콘 사용) */
  icon?: string;
  /** 개별 토스트 자동 닫힘 시간 (ms) */
  duration?: number;
  /** 단일 액션 버튼. `actions` 가 있으면 무시된다. */
  action?: ToastActionButton;
  /** 복수 액션 버튼(확인 등). `actions` 가 있으면 `action` 보다 우선한다. */
  actions?: ToastActionButton[];
  /** X(닫기) 버튼 클릭 시 호출. 확인 토스트에서 취소와 동일한 처리에 사용한다. */
  onDismiss?: () => void;
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
 * // 레이아웃 JSON 사용 예시 (_admin_base.json)
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
 *     "message": "$t:admin.users.modals.bulk_activate_success",
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
  // 내부적으로 표시할 토스트 상태 관리 (애니메이션용)
  const [visibleToasts, setVisibleToasts] = useState<Map<string | number, boolean>>(new Map());

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
    if (!toasts || toasts.length === 0) return;

    toasts.forEach(toast => {
      // 이미 처리된 토스트는 건너뜀
      if (visibleToasts.has(toast.id)) return;

      // visible 상태 추가
      setVisibleToasts(prev => {
        const next = new Map(prev);
        next.set(toast.id, true);
        return next;
      });

      // 자동 제거 타이머 설정 (duration: 0 이면 자동 닫힘 비활성 — 확인/취소 토스트용)
      const effectiveDuration = toast.duration !== undefined ? toast.duration : duration;
      if (effectiveDuration > 0) {
        setTimeout(() => {
          handleRemove(toast.id);
        }, effectiveDuration);
      }
    });
  }, [toasts, duration, handleRemove, visibleToasts]);

  // 토스트가 없으면 렌더링하지 않음
  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <Div
      className={`fixed z-[9999] flex flex-col gap-2 ${positionClassMap[position]}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          position={position}
          isVisible={visibleToasts.get(toast.id) ?? true}
          onClose={() => {
            toast.onDismiss?.();
            handleRemove(toast.id);
          }}
        />
      ))}
    </Div>
  );
};

interface ToastItemProps {
  toast: ToastItem;
  position: ToastPosition;
  isVisible: boolean;
  onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, position, isVisible, onClose }) => {
  const typeStyle = typeStyleMap[toast.type] || typeStyleMap.info;
  const actionButtons = toast.actions?.length
    ? toast.actions
    : (toast.action ? [toast.action] : []);

  // 아이콘 결정: 커스텀 아이콘 > 타입별 기본 아이콘
  const iconName = toast.icon
    ? (toast.icon as IconName)
    : defaultIconMap[toast.type];

  // position에 따라 숨김 애니메이션 방향 결정 (top → 위로, bottom → 아래로)
  const hideTranslate = position.startsWith('bottom') ? 'translate-y-2' : '-translate-y-2';

  const actionButtonClass = (variant: 'primary' | 'secondary' = 'primary'): string => {
    if (variant === 'secondary') {
      return `moa-toast-action moa-toast-action--secondary flex-shrink-0 min-h-8 px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-sm transition-colors ${typeStyle.text} border-current/25 bg-white/70 hover:bg-white/90 dark:bg-black/20 dark:hover:bg-black/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-current/30`;
    }
    return `moa-toast-action moa-toast-action--primary flex-shrink-0 min-h-8 px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-sm transition-colors ${typeStyle.text} border-current/35 bg-current/10 hover:bg-current/20 dark:bg-white/10 dark:hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-current/30`;
  };

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
      <Span className={`flex-1 text-sm font-medium ${typeStyle.text}`}>
        {toast.message}
      </Span>
      {actionButtons.length > 0 ? (
        <Div className="flex flex-shrink-0 items-center gap-2">
          {actionButtons.map((actionButton, index) => (
            <Button
              key={`${actionButton.label}-${index}`}
              type="button"
              onClick={() => {
                void actionButton.onClick();
              }}
              className={actionButtonClass(actionButton.variant ?? (index === actionButtons.length - 1 ? 'primary' : 'secondary'))}
            >
              {actionButton.label}
            </Button>
          ))}
        </Div>
      ) : null}
      <Button
        type="button"
        onClick={onClose}
        className={`flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 ${typeStyle.text} focus:outline-none`}
        aria-label={getTranslation('common.close_notification')}
      >
        <Icon name={IconName.Times} className="w-4 h-4" />
      </Button>
    </Div>
  );
};
