import React, { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Div } from '../basic/Div';
import { Icon } from '../basic/Icon';
import { Input } from '../basic/Input';
import { Span } from '../basic/Span';

export interface MypageMenuRow {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  enabled?: boolean;
  guest_enabled?: boolean;
  order?: number;
}

export interface SortableMypageMenuListProps {
  menus: MypageMenuRow[];
  readOnly?: boolean;
  onMenusChange?: (menus: MypageMenuRow[]) => void;
  className?: string;
}

function renumberOrders(list: MypageMenuRow[]): MypageMenuRow[] {
  return list.map((row, idx) => ({
    ...row,
    order: (idx + 1) * 10,
  }));
}

const SortableMypageRow: React.FC<{
  menu: MypageMenuRow;
  readOnly?: boolean;
  onPatch: (id: string, patch: Partial<MypageMenuRow>) => void;
}> = ({ menu, readOnly, onPatch }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: menu.id,
    disabled: !!readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };

  return (
    <Div
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-800 lg:flex-nowrap lg:items-center"
    >
      <button
        type="button"
        className={`shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 ${readOnly ? 'cursor-not-allowed opacity-40' : 'cursor-grab active:cursor-grabbing'}`}
        aria-label="순서 변경"
        disabled={readOnly}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip-vertical" className="text-base" />
      </button>
      <Div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <Div className="flex min-w-0 shrink-0 items-center gap-2 sm:w-36">
          <Span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
            <Icon name={(menu.icon || 'circle') as any} className="text-gray-600 dark:text-gray-300" />
          </Span>
          <Span className="truncate text-xs font-mono font-medium text-gray-500 dark:text-gray-400">{menu.id}</Span>
        </Div>
        <Div className="min-w-0 flex-1 space-y-2">
          <Input
            type="text"
            value={menu.label ?? ''}
            disabled={readOnly}
            placeholder="메뉴명"
            className="w-full px-3 py-2 text-sm"
            onChange={(e) => onPatch(menu.id, { label: e.target.value })}
          />
          <Input
            type="text"
            value={menu.description ?? ''}
            disabled={readOnly}
            placeholder="설명"
            className="w-full px-3 py-2 text-xs"
            onChange={(e) => onPatch(menu.id, { description: e.target.value })}
          />
        </Div>
      </Div>
      <Div className="flex w-full flex-wrap items-center gap-4 lg:w-auto lg:justify-end">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Input
            type="checkbox"
            checked={!!menu.enabled}
            disabled={readOnly}
            className="h-4 w-4 rounded border-gray-300"
            onChange={(e) => onPatch(menu.id, { enabled: e.target.checked })}
          />
          <Span>노출</Span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Input
            type="checkbox"
            checked={!!menu.guest_enabled}
            disabled={readOnly}
            className="h-4 w-4 rounded border-gray-300"
            onChange={(e) => onPatch(menu.id, { guest_enabled: e.target.checked })}
          />
          <Span>게스트</Span>
        </label>
      </Div>
    </Div>
  );
};

/**
 * Moabom 마이페이지 사이드바 메뉴 — 드래그로 순서 변경(관리자 메뉴 관리와 유사)
 */
export const SortableMypageMenuList: React.FC<SortableMypageMenuListProps> = ({
  menus = [],
  readOnly = false,
  onMenusChange,
  className = '',
}) => {
  const ordered = useMemo(() => {
    const list = [...menus].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return renumberOrders(list);
  }, [menus]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!onMenusChange || readOnly) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex(i => i.id === active.id);
    const newIndex = ordered.findIndex(i => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onMenusChange(renumberOrders(arrayMove(ordered, oldIndex, newIndex)));
  };

  const patchRow = (id: string, patch: Partial<MypageMenuRow>) => {
    if (!onMenusChange || readOnly) return;
    onMenusChange(renumberOrders(ordered.map(row => (row.id === id ? { ...row, ...patch } : row))));
  };

  return (
    <Div className={className}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ordered.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <Div className="flex flex-col gap-2">
            {ordered.map(menu => (
              <SortableMypageRow key={menu.id} menu={menu} readOnly={readOnly} onPatch={patchRow} />
            ))}
          </Div>
        </SortableContext>
      </DndContext>
      {ordered.length === 0 ? (
        <Div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">메뉴가 없습니다.</Div>
      ) : null}
    </Div>
  );
};
