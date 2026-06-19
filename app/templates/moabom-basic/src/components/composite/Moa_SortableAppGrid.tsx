import React from 'react';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Div } from '../basic/Div';
import { DraggableAppIcon } from './Moa_DraggableAppIcon';
import type { App } from '../../data/Moa_apps';

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
 * - 모든 앱은 동일하게 정렬/삭제 가능하며, 좌측 패널에서 다시 추가할 수 있습니다.
 * - rectSortingStrategy 사용 (그리드 레이아웃)
 */
export const SortableAppGrid: React.FC<SortableAppGridProps> = ({
  apps,
  editMode,
  onEnterEditMode,
  onOpenApp,
  onDeleteApp,
}) => {
  const sortableIds = apps.map(a => a.id);

  return (
    <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
        <Div
          className="moa-main-app-grid"
          style={{
            display: 'grid',
            justifyItems: 'stretch',
          }}
        >
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
