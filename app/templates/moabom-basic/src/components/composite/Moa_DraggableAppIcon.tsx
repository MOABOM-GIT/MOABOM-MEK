import React, { useCallback, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Div } from '../basic/Div';
import { Span } from '../basic/Span';
import { Button } from '../basic/Button';
import { Icon } from '../basic/Icon';
import { useLongPress } from '../../hooks/Moa_useLongPress';
import type { App } from '../../data/Moa_apps';
import { useResolvedAppStrings } from '../../i18n/useResolvedAppStrings';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { Moa_OverflowMarqueeText } from './Moa_OverflowMarqueeText';
import { createAppShellMetadata, getCreateAppShellCssVars } from '../../apps/ai-generator';
import { isGeneratedLibraryAppId } from '../../apps/generatedAppLibrary';
import { Moa_GeneratedAppIconShell } from './Moa_GeneratedAppIconShell';

/** 서브타이틀 마퀴 허용 최대 글자 수 — 초과 시 말줄임만 */
const APP_ICON_SUBTITLE_MAX_MARQUEE_CHARS = 28;

export interface DraggableAppIconProps {
  /** 앱 데이터 */
  app: App;
  /** 편집 모드 여부 */
  editMode: boolean;
  /** 편집 모드 진입 핸들러 */
  onEnterEditMode: () => void;
  /** 앱 열기 핸들러 */
  onOpenApp: (app: App) => void;
  /** 앱 삭제 핸들러 */
  onDeleteApp: (appId: string) => void;
}

/**
 * DraggableAppIcon 컴포넌트
 *
 * @dnd-kit/sortable의 useSortable을 사용하여 드래그 가능한 앱 아이콘을 렌더링합니다.
 * - editMode일 때: 떨림 애니메이션 + 삭제 버튼 + 드래그 가능
 * - editMode 아닐 때: 일반 클릭으로 앱 열기 + 롱프레스로 편집모드 진입
 */
export const DraggableAppIcon: React.FC<DraggableAppIconProps> = ({
  app,
  editMode,
  onEnterEditMode,
  onOpenApp,
  onDeleteApp,
}) => {
  const { t } = useMoabomShellT();
  const { name: displayName, description: displayDescription } = useResolvedAppStrings(app);
  const isCreateApp = app.id === createAppShellMetadata.id;
  const isGeneratedApp = isGeneratedLibraryAppId(app.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.id, disabled: !editMode });

  const clickBlockedRef = useRef(false);

  const { handlers: longPressHandlers, wasLongPress } = useLongPress(
    useCallback(() => {
      clickBlockedRef.current = true;
      onEnterEditMode();
    }, [onEnterEditMode]),
  );

  const handleClick = useCallback(() => {
    if (editMode) return;
    if (clickBlockedRef.current) {
      clickBlockedRef.current = false;
      return;
    }
    if (wasLongPress()) return;
    onOpenApp(app);
  }, [editMode, app, onOpenApp, wasLongPress]);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onDeleteApp(app.id);
    },
    [app.id, onDeleteApp],
  );

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  };

  /** 편집모드가 아닐 때 롱프레스 핸들러 */
  const normalModeHandlers = editMode ? {} : longPressHandlers;

  /** 편집모드일 때 dnd-kit 리스너 */
  const dndHandlers = editMode ? listeners : {};

  return (
    <Div
      ref={setNodeRef}
      className={`moa-main-app-item min-w-0 w-full max-w-full ${editMode ? 'is-editing' : ''}`.trim()}
      style={style}
      {...attributes}
      {...dndHandlers}
      {...normalModeHandlers}
    >
      {/* 삭제 버튼 (편집모드에서만) */}
      {editMode && (
        <Button
          onClick={handleDeleteClick}
          className="edit-delete-btn"
          aria-label={t('moa_shell.window.remove_app_aria', { name: displayName })}
        >
          <Icon name="times" className="text-white text-xs" />
        </Button>
      )}

      <Button
        data-testid={isCreateApp ? 'moa-shell-create-app' : undefined}
        onClick={handleClick}
        className={`app-btn moa-main-app-btn flex w-full flex-col items-center gap-2.5 p-0 border-0 bg-transparent group ${
          editMode ? 'wiggle is-editing' : ''
        }`}
        draggable={false}
        style={{
          cursor: editMode ? 'grab' : 'pointer',
          ...(isCreateApp ? getCreateAppShellCssVars() : {}),
        }}
      >
        <Moa_GeneratedAppIconShell
          app={app}
          isCreateApp={isCreateApp}
          showUserBadge={isGeneratedApp}
          badgeSize="lg"
          iconClassName={`${isCreateApp ? 'create-app-icon' : ''} moa-main-app-icon rounded-3xl shadow-lg group-hover:shadow-xl transition-shadow`}
          symbolClassName={`moa-main-app-symbol text-white drop-shadow ${isCreateApp ? 'relative z-[1]' : ''}`}
        />
        <Div className="text-center w-full min-w-0">
          <Span
            className={`moa-app-icon-label ${isCreateApp ? 'create-app-title-gradient' : 'text-primary'} moa-main-app-title font-bold leading-tight`}
            title={displayName}
          >
            {displayName}
          </Span>
          {displayDescription ? (
            <Moa_OverflowMarqueeText
              text={displayDescription}
              maxMarqueeChars={APP_ICON_SUBTITLE_MAX_MARQUEE_CHARS}
              className="moa-main-app-desc text-muted leading-tight mt-0.5 text-center"
            />
          ) : null}
        </Div>
      </Button>
    </Div>
  );
};
