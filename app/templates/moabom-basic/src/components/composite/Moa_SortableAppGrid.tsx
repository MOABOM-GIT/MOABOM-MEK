import React, { useCallback } from 'react';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Div } from '../basic/Div';
import { Button } from '../basic/Button';
import { Icon } from '../basic/Icon';
import { DraggableAppIcon } from './Moa_DraggableAppIcon';
import { Moa_OverflowMarqueeText } from './Moa_OverflowMarqueeText';
import type { App } from '../../data/Moa_apps';
import { createAppShellMetadata, getCreateAppShellCssVars } from '../../apps/ai-generator';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';

export interface SortableAppGridProps {
  /** 표시할 앱 목록 (순서 포함) */
  apps: App[];
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
 * SortableAppGrid 컴포넌트
 *
 * @dnd-kit/sortable의 SortableContext를 사용하여
 * 그리드 레이아웃에서 앱 아이콘의 드래그 앤 드롭 정렬을 지원합니다.
 * DndContext는 HomePage 레벨에서 관리합니다 (좌측 패널 → 메인 크로스 드래그 지원).
 *
 * - AI 앱 만들기 타일은 sortable 아이템에서 제외 (항상 첫 번째 고정)
 * - rectSortingStrategy 사용 (그리드 레이아웃)
 */
export const SortableAppGrid: React.FC<SortableAppGridProps> = ({
  apps,
  editMode,
  onEnterEditMode,
  onOpenApp,
  onDeleteApp,
}) => {
  /** `language`: Context는 `t` 참조 교체로 이미 리렌더된다. 여기서는 DnD/버튼 하위 트리 이슈 방어용 리마운트에만 사용 */
  const { t, language } = useMoabomShellT();
  const createAppTitle = t('moa_shell.center.create_app_title');
  const createAppDesc = t('moa_shell.center.create_app_desc');

  const sortableIds = apps.map(a => a.id);

  const createAppTileStyle = getCreateAppShellCssVars();

  const handleCreateAppClick = useCallback(() => {
    if (editMode) return;
    onOpenApp(createAppShellMetadata);
  }, [editMode, onOpenApp]);

  return (
    <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
        <Div
          className="moa-main-app-grid"
          style={{
            display: 'grid',
            justifyItems: 'stretch',
          }}
        >
          {/* AI 앱 만들기 (항상 첫 번째, sortable 아님) — `create-app` 셸 윈도우로 연결 */}
          <Button
            key={`create-app-${language}`}
            type="button"
            data-testid="moa-shell-create-app"
            onClick={handleCreateAppClick}
            style={createAppTileStyle}
            className={`create-app-btn flex flex-col items-center gap-2.5 p-0 border-0 bg-transparent group min-w-0 w-full max-w-full ${
              editMode ? 'wiggle' : ''
            }`}
          >
            <Div className="create-app-icon moa-main-app-icon rounded-3xl flex items-center justify-center shadow-lg">
              <Icon
                name={createAppShellMetadata.icon}
                className="moa-main-app-symbol text-white drop-shadow relative z-[1]"
              />
            </Div>
            <Div className="text-center w-full min-w-0" key={`create-app-text-${language}`}>
              <Moa_OverflowMarqueeText
                text={createAppTitle}
                className="create-app-title-gradient moa-main-app-title font-bold leading-tight text-center"
              />
              <Moa_OverflowMarqueeText
                text={createAppDesc}
                className="moa-main-app-desc text-muted leading-tight mt-0.5 text-center"
              />
            </Div>
          </Button>

          {/* 정렬 가능한 앱 아이콘들 */}
          {apps.map(app => (
            <DraggableAppIcon
              key={app.id}
              app={app}
              editMode={editMode}
              onEnterEditMode={onEnterEditMode}
              onOpenApp={onOpenApp}
              onDeleteApp={onDeleteApp}
            />
          ))}
        </Div>
      </SortableContext>
  );
};
