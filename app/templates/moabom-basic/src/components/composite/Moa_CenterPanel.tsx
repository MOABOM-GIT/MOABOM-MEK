import React, { useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Div } from '../basic/Div';
import { Button } from '../basic/Button';
import { Icon } from '../basic/Icon';
import { Span } from '../basic/Span';
import { SlidingToggleSwitch } from '../basic/Moa_SlidingToggleSwitch';
import { GlassPanel } from './Moa_GlassPanel';
import { ModeSelector } from './Moa_ModeSelector';
import { SortableAppGrid } from './Moa_SortableAppGrid';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { resolveWindowTitle } from '../../i18n/resolveAppStrings';
import type { App } from '../../data/Moa_apps';
import type { MyPageTab } from './Moa_MyPageWindowContent';

const FOOTER_HIDE_SCROLL_DISTANCE = 24;
const FOOTER_SHOW_SCROLL_DISTANCE = 16;
const FOOTER_TOP_VISIBLE_THRESHOLD = 8;
const FOOTER_TRANSITION_LOCK_MS = 260;

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  icon: string;
  gradient: string;
  zIndex: number;
  initialX?: number;
  initialY?: number;
  isMaximized: boolean;
  isMinimized: boolean;
  myPageInitialTab?: MyPageTab;
  /** create-app 셸에서 편집 중인 저장 AI 앱 id */
  editGeneratedAppId?: number;
}

export interface CenterPanelProps {
  /** 중앙 패널 왼쪽 오프셋 */
  centerLeft: number;
  /** 중앙 패널 오른쪽 오프셋 */
  centerRight: number;
  /** 좌측 패널 열림 상태 */
  leftOpen: boolean;
  /** 우측 패널 열림 상태 */
  rightOpen: boolean;
  /** 좌측 패널 토글 */
  onToggleLeft: () => void;
  /** 우측 패널 토글 */
  onToggleRight: () => void;
  /** 현재 모드 인덱스 */
  modeIdx: number;
  /** 모드 변경 핸들러 */
  onModeChange: (idx: number) => void;
  /** 필터링된 앱 목록 (순서 포함) */
  filteredApps: App[];
  /** 앱 열기 핸들러 */
  onOpenApp: (app: App) => void;
  /** 최소화된 윈도우 목록 */
  minimizedWindows: WindowState[];
  /** 윈도우 포커스 핸들러 */
  onFocusWindow: (id: string) => void;
  /** 편집 모드 여부 */
  editMode?: boolean;
  /** 편집 모드 진입 핸들러 */
  onEnterEditMode?: () => void;
  /** 편집 모드 해제 핸들러 */
  onExitEditMode?: () => void;
  /** 앱 삭제 핸들러 */
  onDeleteApp?: (appId: string) => void;
  /** 모바일 오버레이 헤더 축소 여부 */
  compactControls?: boolean;
  /** 앱 ID → 앱 객체 (태스크바 타이틀 로케일 해석) */
  appsById: Map<string, App>;
  /** 인증 창 appId 목록 */
  authWindowAppIds: readonly string[];
  /** 푸터: 언어·환경설정(마이페이지 settings 탭) 열기 */
  onOpenMyPageSettings?: () => void;
  /** 푸터: sirsoft-page 공개 페이지(슬러그 terms | privacy)를 셸 윈도우로 열기 */
  onOpenLegalPage?: (slug: 'terms' | 'privacy') => void;
}

/**
 * CenterPanel 컴포넌트
 *
 * 중앙 패널: 헤더(모드 선택, 패널 토글), 태스크바, 앱 그리드, 푸터
 * 편집모드 지원: 드래그앤드롭 정렬, 삭제, 완료 버튼
 */
export const CenterPanel: React.FC<CenterPanelProps> = ({
  centerLeft,
  centerRight,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  modeIdx,
  onModeChange,
  filteredApps,
  onOpenApp,
  minimizedWindows,
  onFocusWindow,
  editMode = false,
  onEnterEditMode,
  onExitEditMode,
  onDeleteApp,
  compactControls = false,
  appsById,
  authWindowAppIds,
  onOpenMyPageSettings,
  onOpenLegalPage,
}) => {
  const { t, language } = useMoabomShellT();
  const { setNodeRef: setGridDropRef } = useDroppable({ id: 'main-grid' });
  const lastGridScrollTopRef = useRef(0);
  const footerScrollIntentRef = useRef({ direction: 0, distance: 0 });
  const footerHiddenRef = useRef(false);
  const footerTransitionLockedUntilRef = useRef(0);
  const taskbarRef = useRef<HTMLDivElement | null>(null);
  const taskbarDragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
    windowId: '',
  });
  const [isFooterHidden, setIsFooterHidden] = useState(false);

  /** 클릭 시 편집모드 해제 (삭제 버튼 클릭은 제외) */
  const handleGridClick = (e: React.MouseEvent) => {
    if (!editMode || !onExitEditMode) return;
    const target = e.target as HTMLElement;
    if (target.closest('.edit-delete-btn')) return;
    if (target.closest('.moa-main-app-item, .create-app-btn')) return;
    onExitEditMode();
  };

  const setFooterHidden = (hidden: boolean) => {
    if (footerHiddenRef.current === hidden) return;

    footerHiddenRef.current = hidden;
    footerScrollIntentRef.current = { direction: 0, distance: 0 };
    footerTransitionLockedUntilRef.current = Date.now() + FOOTER_TRANSITION_LOCK_MS;
    setIsFooterHidden(hidden);
  };

  /** 모바일에서 앱 목록 스크롤 방향에 따라 하단 푸터 노출을 제어합니다. */
  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollTop = e.currentTarget.scrollTop;
    const previousScrollTop = lastGridScrollTopRef.current;
    const delta = currentScrollTop - previousScrollTop;

    lastGridScrollTopRef.current = currentScrollTop;

    if (Date.now() < footerTransitionLockedUntilRef.current) return;

    if (currentScrollTop <= FOOTER_TOP_VISIBLE_THRESHOLD) {
      setFooterHidden(false);
      return;
    }

    if (Math.abs(delta) < 3) return;

    const direction = delta > 0 ? 1 : -1;
    const intent = footerScrollIntentRef.current;
    const nextDistance = intent.direction === direction ? intent.distance + Math.abs(delta) : Math.abs(delta);

    footerScrollIntentRef.current = { direction, distance: nextDistance };

    if (direction > 0 && !footerHiddenRef.current && nextDistance >= FOOTER_HIDE_SCROLL_DISTANCE) {
      setFooterHidden(true);
    }

    if (direction < 0 && footerHiddenRef.current && nextDistance >= FOOTER_SHOW_SCROLL_DISTANCE) {
      setFooterHidden(false);
    }
  };

  const handleTaskbarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const taskbar = taskbarRef.current;
    if (!taskbar) return;

    taskbar.setPointerCapture(e.pointerId);
    taskbarDragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      scrollLeft: taskbar.scrollLeft,
      windowId: (e.target as HTMLElement).closest<HTMLElement>('[data-taskbar-window-id]')?.dataset.taskbarWindowId ?? '',
    };
  };

  const handleTaskbarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const taskbar = taskbarRef.current;
    const drag = taskbarDragRef.current;
    if (!taskbar || !drag.active) return;

    const deltaX = e.clientX - drag.startX;
    if (Math.abs(deltaX) > 4) {
      drag.moved = true;
    }

    if (drag.moved) {
      taskbar.scrollLeft = drag.scrollLeft - deltaX;
      e.preventDefault();
    }
  };

  const handleTaskbarPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const taskbar = taskbarRef.current;
    const drag = taskbarDragRef.current;
    if (taskbar?.hasPointerCapture(e.pointerId)) {
      taskbar.releasePointerCapture(e.pointerId);
    }

    taskbarDragRef.current.active = false;
    if (drag.moved) {
      taskbarDragRef.current.moved = false;
      taskbarDragRef.current.windowId = '';
      return;
    }

    if (drag.windowId) {
      onFocusWindow(drag.windowId);
    }

    taskbarDragRef.current.windowId = '';
  };

  return (
    <GlassPanel
      className="moa-center-panel absolute top-5 bottom-5"
      style={{ left: `${centerLeft}px`, right: `${centerRight}px`, zIndex: 10, borderRadius: '24px' }}
    >
      {/* 헤더 */}
      <Div
        className={`glass box-border flex h-[47px] min-[480px]:h-[58px] items-center shrink-0 mb-2 rounded-2xl ${compactControls ? 'p-2' : 'px-5 py-3'}`}
      >
        <SlidingToggleSwitch
          checked={leftOpen}
          onCheckedChange={onToggleLeft}
          compact={compactControls}
          ariaLabelWhenOn={t('moa_shell.center.toggle_left_panel_on')}
          ariaLabelWhenOff={t('moa_shell.center.toggle_left_panel_off')}
        />
        <Div className="flex-1 flex items-center justify-center">
          {editMode ? (
            <Span className={compactControls ? 'font-bold text-secondary text-sm tracking-tight' : 'inline-flex items-center px-[15px] py-[5px] font-bold text-secondary text-base tracking-tight'}>
              {t('moa_shell.center.edit_mode_title')}
            </Span>
          ) : (
            <ModeSelector modeIdx={modeIdx} onModeChange={onModeChange} compact={compactControls} />
          )}
        </Div>
        <SlidingToggleSwitch
          checked={rightOpen}
          onCheckedChange={onToggleRight}
          icon="user"
          compact={compactControls}
          ariaLabelWhenOn={t('moa_shell.center.toggle_right_panel_on')}
          ariaLabelWhenOff={t('moa_shell.center.toggle_right_panel_off')}
        />
      </Div>

      {/* 태스크바 (최소화된 윈도우) */}
      {!editMode && minimizedWindows.length > 0 && (
        <Div
          ref={taskbarRef}
          className="moa-taskbar flex items-center gap-2 px-3 pt-1 pb-3 shrink-0 overflow-x-auto cursor-grab active:cursor-grabbing"
          onPointerDown={handleTaskbarPointerDown}
          onPointerMove={handleTaskbarPointerMove}
          onPointerUp={handleTaskbarPointerEnd}
          onPointerCancel={handleTaskbarPointerEnd}
        >
          {minimizedWindows.map(w => (
            <Button
              key={w.id}
              data-taskbar-window-id={w.id}
              variant="taskbar"
              size={compactControls ? 'xs' : 'sm'}
              className="shrink-0 whitespace-nowrap"
              style={{ background: w.gradient }}
            >
              <Div className="moa-taskbar-btn">
                <Div className="moa-taskbar-btn__icon" aria-hidden>
                  <Icon name={w.icon} />
                </Div>
                <Span className="moa-taskbar-btn__label">{resolveWindowTitle(w, appsById, language, t, authWindowAppIds)}</Span>
              </Div>
            </Button>
          ))}
        </Div>
      )}

      {/* 앱 그리드 */}
      <Div
        ref={setGridDropRef}
        data-testid="moa-center-grid"
        className="moa-center-grid glass-sm flex-1 overflow-y-auto rounded-2xl py-12 px-10"
        onClick={handleGridClick}
        onScroll={handleGridScroll}
      >
        <SortableAppGrid
          apps={filteredApps}
          editMode={editMode}
          onEnterEditMode={onEnterEditMode ?? (() => {})}
          onOpenApp={onOpenApp}
          onDeleteApp={onDeleteApp ?? (() => {})}
        />
      </Div>

      {/* 푸터 */}
      <Div
        data-testid="moa-center-footer"
        className={`moa-center-footer flex items-center justify-between px-4 pt-4 pb-2 shrink-0 ${isFooterHidden ? 'is-hidden' : ''}`.trim()}
      >
        <Span className="text-xs text-muted">{t('moa_shell.center.copyright')}</Span>
        <Div className="flex items-center gap-2">
          {onOpenLegalPage ? (
            <Button
              type="button"
              data-testid="moa-center-footer-terms"
              className="cursor-pointer rounded-md px-1.5 py-0.5 text-xs font-normal text-muted transition-colors duration-200 hover:bg-black/5 hover:text-primary dark:hover:bg-white/10 dark:hover:text-primary"
              onClick={() => onOpenLegalPage('terms')}
            >
              {t('moa_shell.center.terms')}
            </Button>
          ) : (
            <Span className="text-xs text-muted">{t('moa_shell.center.terms')}</Span>
          )}
          {onOpenLegalPage ? (
            <Button
              type="button"
              data-testid="moa-center-footer-privacy"
              className="cursor-pointer rounded-md px-1.5 py-0.5 text-xs font-normal text-muted transition-colors duration-200 hover:bg-black/5 hover:text-primary dark:hover:bg-white/10 dark:hover:text-primary"
              onClick={() => onOpenLegalPage('privacy')}
            >
              {t('moa_shell.center.privacy')}
            </Button>
          ) : (
            <Span className="text-xs text-muted">{t('moa_shell.center.privacy')}</Span>
          )}
          {onOpenMyPageSettings ? (
            <Button
              type="button"
              variant="primary-outline"
              size="xxsDuo"
              data-testid="moa-center-footer-locale"
              aria-label={t('moa_shell.center.locale_settings_aria')}
              title={t('moa_shell.center.locale_settings_aria')}
              onClick={() => onOpenMyPageSettings()}
            >
              <Icon name="globe" size="xxs" />
              <Icon name="cog" size="xxs" />
            </Button>
          ) : null}
        </Div>
      </Div>
    </GlassPanel>
  );
};
