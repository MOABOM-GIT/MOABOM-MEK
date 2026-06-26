import React, { useCallback, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Div } from '../basic/Div';
import { Span } from '../basic/Span';
import { Button } from '../basic/Button';
import { useLongPress } from '../../hooks/Moa_useLongPress';
import type { App } from '../../data/Moa_apps';
import { useResolvedAppStrings } from '../../i18n/useResolvedAppStrings';
import { createAppShellMetadata, getCreateAppShellCssVars } from '../../apps/ai-generator';
import { isGeneratedLibraryAppId } from '../../apps/generatedAppLibrary';
import { Moa_GeneratedAppIconShell } from './Moa_GeneratedAppIconShell';

export interface LeftPanelAppIconProps {
  /** 앱 데이터 */
  app: App;
  /** 편집 모드 여부 */
  editMode: boolean;
  /** 편집 모드 진입 핸들러 */
  onEnterEditMode: () => void;
  /** 앱 열기 핸들러 */
  onOpenApp: (app: App) => void;
  /** 앱 추가 핸들러 (모바일 편집모드 탭 추가용) */
  onAddApp?: (app: App) => void;
  /** 편집모드에서 탭으로 앱을 추가할지 여부 */
  tapToAdd?: boolean;
  /** 아이콘 크기 클래스 (기본: w-[56px] h-[56px] rounded-2xl) */
  iconSize?: string;
  /** 아이콘 텍스트 크기 (기본: text-xl) */
  iconTextSize?: string;
  /** 이름 표시 여부 (기본: true) */
  showName?: boolean;
  /**
   * 그리드 셀용 전체 폭(기본 true).
   * 가로 한 줄(앱순위 랭킹 등)에서는 false — `w-full`이 플렉스 행에서 옆 텍스트 영역을 밀어냄.
   */
  fullWidth?: boolean;
}

/**
 * LeftPanelAppIcon 컴포넌트
 *
 * 좌측 패널 라이브러리 탭의 앱 아이콘.
 * - 데스크톱 편집모드: dnd-kit 드래그로 메인에 추가
 * - 모바일 편집모드: 탭으로 메인에 추가 (스크롤 제스처와 충돌 방지)
 * - 편집모드 아닐 때: 클릭으로 앱 열기 + 롱프레스로 편집모드 진입
 */
export const LeftPanelAppIcon: React.FC<LeftPanelAppIconProps> = ({
  app,
  editMode,
  onEnterEditMode,
  onOpenApp,
  onAddApp,
  tapToAdd = false,
  iconSize = 'w-[56px] h-[56px] rounded-2xl',
  iconTextSize = 'text-xl',
  showName = true,
  fullWidth = true,
}) => {
  const clickBlockedRef = useRef(false);
  const { name: displayName } = useResolvedAppStrings(app);
  const isCreateApp = app.id === createAppShellMetadata.id;
  const isGeneratedApp = isGeneratedLibraryAppId(app.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: `left-${app.id}`, disabled: !editMode || tapToAdd });

  const { handlers: longPressHandlers, wasLongPress } = useLongPress(
    useCallback(() => {
      clickBlockedRef.current = true;
      onEnterEditMode();
    }, [onEnterEditMode]),
  );

  const handleClick = useCallback(() => {
    if (editMode) {
      if (tapToAdd) {
        onAddApp?.(app);
      }
      return;
    }
    if (clickBlockedRef.current) {
      clickBlockedRef.current = false;
      return;
    }
    if (wasLongPress()) return;
    onOpenApp(app);
  }, [editMode, tapToAdd, app, onAddApp, onOpenApp, wasLongPress]);

  /** 편집모드가 아닐 때 롱프레스 핸들러 */
  const normalModeHandlers = editMode ? {} : longPressHandlers;
  const dndHandlers = editMode && !tapToAdd ? listeners : {};

  const rootWidthClass = fullWidth
    ? 'min-w-0 w-full max-w-full'
    : 'shrink-0 w-auto max-w-full min-w-0';

  const buttonWidthClass = fullWidth ? 'w-full max-w-full min-w-0' : 'w-auto max-w-full min-w-0';
  return (
    <Div
      ref={setNodeRef}
      className={rootWidthClass}
      draggable={false}
      style={{
        cursor: editMode ? 'copy' : 'pointer',
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.5 : 1,
        ...(isCreateApp ? getCreateAppShellCssVars() : {}),
      }}
      {...attributes}
      {...dndHandlers}
    >
      <Div className="relative">
      <Button
        onClick={handleClick}
        className={`group app-btn moa-left-panel-app-btn flex flex-col items-center gap-2 p-0 border-0 bg-transparent ${buttonWidthClass} ${editMode ? 'cursor-copy' : 'cursor-pointer'} ${
          editMode ? 'wiggle is-editing' : ''
        }`}
        draggable={false}
        {...normalModeHandlers}
      >
        <Moa_GeneratedAppIconShell
          app={app}
          isCreateApp={isCreateApp}
          showUserBadge={isGeneratedApp}
          badgeSize="sm"
          iconClassName={`${isCreateApp ? 'create-app-icon create-app-icon--compact' : ''} ${iconSize} shadow-lg`}
          symbolClassName={`text-white ${iconTextSize} ${isCreateApp ? 'relative z-[1]' : ''}`}
        />
        {showName && (
          <Span
            className={`moa-app-icon-label ${isCreateApp ? 'create-app-title-gradient' : 'text-primary'} moa-left-panel-app-title font-bold leading-tight`}
            title={displayName}
          >
            {displayName}
          </Span>
        )}
      </Button>
      </Div>
    </Div>
  );
};
