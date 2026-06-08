import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { Button } from '../basic/Button';
import { Div } from '../basic/Div';
import { Icon } from '../basic/Icon';
import { Select } from '../basic/Select';
import { Span } from '../basic/Span';

export type HomeBackgroundMode = 'light' | 'dark';

export interface HomeBackgroundItem {
  id: string;
  /** 이 배경이 노출될 테마 모드 (라이트/다크). 미지정 시 light */
  mode?: HomeBackgroundMode;
  /**
   * 이 배경에 바인딩되는 포인트 컬러 hex (`#rrggbb`).
   * 사용자 마이페이지에서 해당 색을 클릭하면 이 배경이 자동 선택된다.
   * 같은 색은 여러 배경에 지정할 수 없다 — 서버 저장 시 첫 번째 항목만 유지하고 나머지는 null.
   */
  point_color?: string | null;
  url?: string;
  thumb_url?: string;
}

export interface HomeBackgroundManagerProps {
  items: HomeBackgroundItem[];
  readOnly?: boolean;
  /** POST multipart (file 필드) 업로드 엔드포인트 */
  uploadUrl?: string;
  maxItems?: number;
  /** 포인트 컬러 배타 바인딩 Select 의 선택지 (관리자 팔레트) */
  pointColorPresets?: string[];
  onItemsChange?: (items: HomeBackgroundItem[]) => void;
  className?: string;
}

const DEFAULT_UPLOAD = '/api/modules/moabom-system/admin/home-backgrounds';

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const t = localStorage.getItem('auth_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null;
}

const MODE_OPTIONS: readonly { value: HomeBackgroundMode; labelKo: string }[] = [
  { value: 'light', labelKo: '라이트 모드' },
  { value: 'dark', labelKo: '다크 모드' },
];

interface SortableBgThumbProps {
  item: HomeBackgroundItem;
  readOnly?: boolean;
  pointColorPresets: string[];
  onRemove: (id: string) => void;
  onModeChange: (id: string, mode: HomeBackgroundMode) => void;
  onPointColorChange: (id: string, pointColor: string | null) => void;
}
const SortableBgThumb: React.FC<SortableBgThumbProps> = ({
  item,
  readOnly,
  pointColorPresets,
  onRemove,
  onModeChange,
  onPointColorChange,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !!readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  const src = item.thumb_url || item.url || '';
  const mode: HomeBackgroundMode = item.mode === 'dark' ? 'dark' : 'light';
  const pointColor = normalizeHex(item.point_color);

  // 포인트 컬러 팔레트 팝오버 토글
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRootRef = useRef<HTMLDivElement | null>(null);

  // 외부 클릭 시 팝오버 닫기
  useEffect(() => {
    if (!paletteOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!paletteRootRef.current) return;
      if (!paletteRootRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [paletteOpen]);

  return (
    <Div
      ref={setNodeRef}
      style={style}
      className="relative w-full max-w-[6.5rem] shrink-0"
    >
      <Div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700">
        <Div className="aspect-[4/3] w-full bg-gray-200 dark:bg-gray-600">
          {src ? (
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <Div className="flex h-full items-center justify-center text-xs text-gray-500">…</Div>
          )}
        </Div>
      </Div>
      <button
        type="button"
        className={`absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 ${readOnly ? 'hidden' : ''}`}
        aria-label="배경 삭제"
        onClick={() => onRemove(item.id)}
      >
        <Icon name="times" className="text-xs" />
      </button>

      {/* 모드 선택 */}
      <Select
        className="mt-1 w-full rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] text-gray-800 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        value={mode}
        disabled={!!readOnly}
        aria-label="배경 노출 모드"
        options={MODE_OPTIONS.map(opt => ({ value: opt.value, label: opt.labelKo }))}
        onChange={(e) => {
          const raw = String((e as { target: { value: string | number } }).target.value);
          onModeChange(item.id, raw === 'dark' ? 'dark' : 'light');
        }}
      />

      {/* 포인트 컬러 바인딩 (옵션) — 동그라미 스와치 팝오버 */}
      <Div ref={paletteRootRef} className="relative mt-1">
        <button
          type="button"
          disabled={!!readOnly}
          onClick={() => setPaletteOpen(v => !v)}
          aria-label="포인트 컬러 바인딩"
          aria-haspopup="true"
          aria-expanded={paletteOpen}
          className="flex w-full items-center justify-center gap-1 rounded border border-gray-300 bg-white px-1 py-1 text-[10px] text-gray-700 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          {pointColor ? (
            <Span
              className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/70 shadow-sm"
              style={{ background: pointColor }}
              aria-hidden
            />
          ) : (
            <Span className="text-gray-500 dark:text-gray-400">없음</Span>
          )}
          <Icon name="chevron-down" className="text-[9px] text-gray-400" />
        </button>

        {paletteOpen && (
          <Div
            role="listbox"
            className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[7rem] rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800"
          >
            {/* 없음 버튼 */}
            <button
              type="button"
              onClick={() => {
                onPointColorChange(item.id, null);
                setPaletteOpen(false);
              }}
              className={`mb-1 flex w-full items-center justify-center gap-1 rounded px-1 py-1 text-[10px] ${
                !pointColor
                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/60'
              }`}
              role="option"
              aria-selected={!pointColor}
            >
              없음
            </button>

            {/* 3 열 스와치 그리드 */}
            <Div className="grid grid-cols-3 gap-1.5">
              {pointColorPresets.map((hex, idx) => {
                const normalized = (hex || '').toLowerCase();
                const selected = pointColor === normalized;
                return (
                  <button
                    key={`${normalized}-${idx}`}
                    type="button"
                    onClick={() => {
                      onPointColorChange(item.id, normalized);
                      setPaletteOpen(false);
                    }}
                    title={hex}
                    aria-label={`포인트 컬러 ${hex}`}
                    role="option"
                    aria-selected={selected}
                    className={`relative h-6 w-6 cursor-pointer rounded-full border transition ${
                      selected
                        ? 'border-gray-900 ring-2 ring-offset-1 ring-gray-900 dark:border-white dark:ring-white dark:ring-offset-gray-800'
                        : 'border-white/70 shadow-sm hover:scale-110 dark:border-white/30'
                    }`}
                    style={{ background: hex }}
                  >
                    {selected ? (
                      <Icon
                        name="check"
                        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] text-white drop-shadow-[0_1px_1px_rgb(0_0_0/55%)]"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                );
              })}
            </Div>
          </Div>
        )}
      </Div>

      <button
        type="button"
        className={`mt-1 flex w-full items-center justify-center gap-1 rounded border border-dashed border-gray-300 py-0.5 text-[10px] text-gray-500 dark:border-gray-600 ${readOnly ? 'invisible' : ''}`}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip-vertical" className="text-[10px]" />
        <Span>이동</Span>
      </button>
    </Div>
  );
};

/**
 * Moabom 홈 배경 관리자.
 *
 * 기능:
 *  - 이미지 업로드 / 썸네일 그리드 / 드래그 정렬 / 삭제
 *  - 각 배경에 노출 모드(라이트/다크) 바인딩
 *  - 각 배경에 포인트 컬러(hex) 배타 바인딩: 같은 색을 다른 배경에 지정하면 기존 배경은 자동 해제
 */
export const HomeBackgroundManager: React.FC<HomeBackgroundManagerProps> = ({
  items = [],
  readOnly = false,
  uploadUrl = DEFAULT_UPLOAD,
  maxItems = 24,
  pointColorPresets = [],
  onItemsChange,
  className = '',
}) => {
  // 바인딩 타입 방어: 문자열·null 이 들어와도 배열로 정규화 (레이아웃에서 computed 사용을 권장)
  const safePresets: string[] = Array.isArray(pointColorPresets) ? pointColorPresets : [];
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!onItemsChange || readOnly) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onItemsChange(arrayMove(items, oldIndex, newIndex));
  };

  const removeOne = useCallback(
    async (id: string) => {
      setError(null);
      if (!onItemsChange) return;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

      if (isUuid) {
        try {
          setBusy(true);
          const res = await fetch(`${uploadUrl.replace(/\/$/, '')}/${id}`, {
            method: 'DELETE',
            headers: {
              Accept: 'application/json',
              ...authHeaders(),
            },
            credentials: 'include',
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            setError(typeof body?.message === 'string' ? body.message : '삭제에 실패했습니다.');
            setBusy(false);
            return;
          }
        } catch {
          setError('삭제 요청에 실패했습니다.');
          setBusy(false);
          return;
        } finally {
          setBusy(false);
        }
      }

      onItemsChange(items.filter(i => i.id !== id));
    },
    [items, onItemsChange, uploadUrl],
  );

  const handleModeChange = useCallback(
    (id: string, mode: HomeBackgroundMode) => {
      if (!onItemsChange) return;
      onItemsChange(items.map(row => (row.id === id ? { ...row, mode } : row)));
    },
    [items, onItemsChange],
  );

  /**
   * 포인트 컬러 바인딩 업데이트.
   *
   * 배타성: 같은 hex 가 다른 배경에 이미 바인딩돼 있으면 그 배경의 point_color 를 null 로 리셋한다.
   * (없음을 선택한 경우 — null 인자는 유일성 검사 없이 해당 항목만 갱신)
   */
  const handlePointColorChange = useCallback(
    (id: string, pointColor: string | null) => {
      if (!onItemsChange) return;
      const next = pointColor === null ? null : normalizeHex(pointColor);
      onItemsChange(
        items.map(row => {
          if (row.id === id) {
            return { ...row, point_color: next };
          }
          if (next !== null && normalizeHex(row.point_color) === next) {
            return { ...row, point_color: null };
          }
          return row;
        }),
      );
    },
    [items, onItemsChange],
  );

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onItemsChange || readOnly) return;
    if (items.length >= maxItems) {
      setError(`최대 ${maxItems}개까지 등록할 수 있습니다.`);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...authHeaders(),
        },
        body: fd,
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          typeof body?.errors === 'object' && body.errors?.file?.[0]
            ? String(body.errors.file[0])
            : (body?.message ?? '업로드에 실패했습니다.'),
        );
        return;
      }

      const data = body?.data ?? body;
      const row: HomeBackgroundItem = {
        id: String(data?.id ?? ''),
        // 업로드 직후 기본값: 라이트 모드, 포인트 컬러 바인딩 없음
        mode: 'light',
        point_color: null,
        url: typeof data?.url === 'string' ? data.url : undefined,
        thumb_url: typeof data?.thumb_url === 'string' ? data.thumb_url : undefined,
      };
      if (!row.id) {
        setError('응답에 id가 없습니다.');
        return;
      }
      onItemsChange([...items, row]);
    } catch {
      setError('업로드 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Div className={className}>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickFile} />
      <Div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={readOnly || busy || items.length >= maxItems}
          className="gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
          onClick={() => inputRef.current?.click()}
        >
          <Icon name="image" className="text-sm" />
          <Span>이미지 등록</Span>
        </Button>
        <Span className="text-xs text-gray-500 dark:text-gray-400">
          JPEG · PNG · WebP · 최대 {maxItems}개
        </Span>
      </Div>
      {error ? (
        <Div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </Div>
      ) : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <Div className="flex flex-wrap gap-3">
            {items.map(item => (
              <SortableBgThumb
                key={item.id}
                item={item}
                readOnly={readOnly}
                pointColorPresets={safePresets}
                onRemove={removeOne}
                onModeChange={handleModeChange}
                onPointColorChange={handlePointColorChange}
              />
            ))}
          </Div>
        </SortableContext>
      </DndContext>
      {items.length === 0 ? (
        <Div className="mt-4 rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          등록된 배경이 없습니다. 템플릿 기본 이미지 또는 아래에서 업로드하세요.
        </Div>
      ) : null}
    </Div>
  );
};
