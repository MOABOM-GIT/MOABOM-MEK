import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastItem } from '../../components/composite/Toast';
import type { MoabomSystemDefaults, MoabomSystemState, MoabomSystemStateMergePatch } from '../../types/moabomSystem';
import {
  CENTER_MODE_TO_INDEX,
  INDEX_TO_CENTER_MODE,
  MOABOM_SYSTEM_STATE_CHANGED_EVENT,
  applyMoabomSystemAppearance,
  loadMoabomSystemState,
  mergeMoabomSystemState,
  saveMoabomSystemState,
} from '../../utils/moabomSystemStore';
import { areMoabomSystemStatesEqual } from '../../utils/moabomSystemStore';
import { applyMoabomAnimationRuntime } from '../../runtime/applyAnimationRuntime';
import { useEffectiveSystemOptions } from '../../runtime/useEffectiveSystemOptions';
import { useWeatherEffectRuntime } from '../../runtime/weather/useWeatherEffectRuntime';
import {
  BREAKPOINT_COMPACT_CONTROLS,
  BREAKPOINT_MOBILE_OVERLAY,
  BREAKPOINT_RIGHT_OVERLAY,
  MOA_HOME_EDGE,
  MOA_HOME_INNER,
  MOA_HOME_OVERLAY_EDGE,
  MOA_HOME_PANEL_WIDTH,
} from '../../shell/moaShellLayoutConstants';
import type { ResponsiveMode } from '../../shell/moaShellTypes';

function getViewportWidth(): number {
  return typeof window === 'undefined' ? 1440 : window.innerWidth;
}

function getResponsiveMode(width: number): ResponsiveMode {
  if (width <= BREAKPOINT_MOBILE_OVERLAY) return 'mobile-overlay';
  if (width <= BREAKPOINT_RIGHT_OVERLAY) return 'right-overlay';
  return 'desktop';
}

export function useMoaHomeShellState() {
  const initialSystemState = loadMoabomSystemState();
  const weatherCanvasRef = useRef<HTMLCanvasElement>(null);

  const [viewportWidth, setViewportWidth] = useState(() => getViewportWidth());
  const [responsiveMode, setResponsiveMode] = useState<ResponsiveMode>(() => getResponsiveMode(getViewportWidth()));
  const [activeTab, setActiveTab] = useState<'basic' | 'user'>('basic');
  const [systemState, setSystemState] = useState<MoabomSystemState>(initialSystemState);
  const [modeIdx, setModeIdx] = useState(() => CENTER_MODE_TO_INDEX[initialSystemState.layout.centerMode]);
  const [leftOpen, setLeftOpen] = useState(() => getViewportWidth() > BREAKPOINT_MOBILE_OVERLAY && initialSystemState.layout.leftPanelOpen);
  const [rightOpen, setRightOpen] = useState(() => getViewportWidth() > BREAKPOINT_RIGHT_OVERLAY && initialSystemState.layout.rightPanelOpen);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [systemDefaults, setSystemDefaults] = useState<MoabomSystemDefaults | null>(null);
  const [editMode, setEditMode] = useState(false);

  const updateSystemState = useCallback((patch: MoabomSystemStateMergePatch) => {
    setSystemState(() => {
      const base = loadMoabomSystemState();
      const next = mergeMoabomSystemState(base, patch);
      saveMoabomSystemState(next);
      applyMoabomSystemAppearance(next.appearance);
      return next;
    });
  }, []);

  useEffect(() => {
    const sync = () => {
      setSystemState(prev => {
        const disk = loadMoabomSystemState();
        return areMoabomSystemStatesEqual(prev, disk) ? prev : disk;
      });
    };
    window.addEventListener(MOABOM_SYSTEM_STATE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(MOABOM_SYSTEM_STATE_CHANGED_EVENT, sync);
  }, []);

  const effectiveSystemOptions = useEffectiveSystemOptions({ systemDefaults });
  useEffect(() => {
    applyMoabomAnimationRuntime(effectiveSystemOptions.animation !== false);
  }, [effectiveSystemOptions.animation]);

  useWeatherEffectRuntime({
    canvasRef: weatherCanvasRef,
    effective: effectiveSystemOptions,
    systemDefaults,
  });

  useEffect(() => {
    applyMoabomSystemAppearance(systemState.appearance);
  }, [systemState.appearance]);

  useEffect(() => {
    const updateViewport = () => {
      const width = getViewportWidth();
      setViewportWidth(width);
      setResponsiveMode(getResponsiveMode(width));
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    const G7Core = (window as { G7Core?: { state?: { get?: () => Record<string, unknown>; subscribe?: (fn: (s?: Record<string, unknown>) => void) => (() => void) | void } } }).G7Core;
    const syncToasts = (state?: Record<string, unknown>) => {
      const nextToasts = Array.isArray(state?.toasts) ? state.toasts as ToastItem[] : [];
      setToasts(nextToasts);
    };

    syncToasts(G7Core?.state?.get?.());

    if (G7Core?.state?.subscribe) {
      return G7Core.state.subscribe(syncToasts);
    }
  }, []);

  useEffect(() => {
    const resizeWeatherCanvas = () => {
      const canvas = weatherCanvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeWeatherCanvas();
    window.addEventListener('resize', resizeWeatherCanvas);
    return () => window.removeEventListener('resize', resizeWeatherCanvas);
  }, []);

  const prevResponsiveModeRef = useRef<ResponsiveMode | null>(null);

  useEffect(() => {
    const prevMode = prevResponsiveModeRef.current;
    prevResponsiveModeRef.current = responsiveMode;
    const enteredNewMode = prevMode !== responsiveMode;

    if (responsiveMode === 'desktop') {
      setLeftOpen(systemState.layout.leftPanelOpen);
      setRightOpen(systemState.layout.rightPanelOpen);
      return;
    }

    if (responsiveMode === 'right-overlay') {
      setLeftOpen(systemState.layout.leftPanelOpen);
      if (enteredNewMode) {
        setRightOpen(false);
      }
      return;
    }

    if (enteredNewMode) {
      setLeftOpen(false);
      setRightOpen(false);
    }
  }, [responsiveMode, systemState.layout.leftPanelOpen, systemState.layout.rightPanelOpen]);

  const overlayActive = (responsiveMode === 'mobile-overlay' && (leftOpen || rightOpen))
    || (responsiveMode === 'right-overlay' && rightOpen);
  const isMobileOverlay = responsiveMode === 'mobile-overlay';
  const isRightOverlay = responsiveMode !== 'desktop';

  useEffect(() => {
    document.body.classList.toggle('lock-scroll', overlayActive);
    return () => document.body.classList.remove('lock-scroll');
  }, [overlayActive]);

  useEffect(() => {
    document.body.classList.add('moa-home-active');
    return () => document.body.classList.remove('moa-home-active');
  }, []);

  const overlayFlushEdges = isMobileOverlay && viewportWidth <= BREAKPOINT_COMPACT_CONTROLS;
  const overlayPanelWidth = isMobileOverlay
    ? Math.min(MOA_HOME_PANEL_WIDTH, Math.max(260, viewportWidth - 60))
    : MOA_HOME_PANEL_WIDTH;
  const leftPanelEdge = isMobileOverlay ? (overlayFlushEdges ? 0 : MOA_HOME_OVERLAY_EDGE) : MOA_HOME_EDGE;
  const rightPanelEdge = !isRightOverlay
    ? MOA_HOME_EDGE
    : isMobileOverlay
      ? (overlayFlushEdges ? 0 : MOA_HOME_OVERLAY_EDGE)
      : MOA_HOME_OVERLAY_EDGE;
  const centerEdge = isRightOverlay || isMobileOverlay ? MOA_HOME_OVERLAY_EDGE : MOA_HOME_EDGE;
  const leftOffset = leftOpen ? leftPanelEdge : -(overlayPanelWidth + leftPanelEdge);
  const rightOffset = rightOpen ? rightPanelEdge : -(overlayPanelWidth + rightPanelEdge);
  const centerLeft = isMobileOverlay ? centerEdge : leftOpen ? MOA_HOME_PANEL_WIDTH + MOA_HOME_EDGE + MOA_HOME_INNER : MOA_HOME_EDGE;
  const centerRight = isRightOverlay ? centerEdge : rightOpen ? MOA_HOME_PANEL_WIDTH + MOA_HOME_EDGE + MOA_HOME_INNER : MOA_HOME_EDGE;

  const handleModeChange = useCallback((idx: number) => {
    setModeIdx(idx);
    updateSystemState({ layout: { centerMode: INDEX_TO_CENTER_MODE[idx] ?? 'moabom-apps' } });
  }, [updateSystemState]);

  const handleEnterEditMode = useCallback(() => {
    setEditMode(true);
  }, []);

  const handleExitEditMode = useCallback(() => {
    setEditMode(false);
  }, []);

  return {
    weatherCanvasRef,
    viewportWidth,
    responsiveMode,
    activeTab,
    setActiveTab,
    systemState,
    setSystemState,
    systemDefaults,
    setSystemDefaults,
    modeIdx,
    leftOpen,
    setLeftOpen,
    rightOpen,
    setRightOpen,
    toasts,
    editMode,
    effectiveSystemOptions,
    overlayActive,
    isMobileOverlay,
    isRightOverlay,
    overlayFlushEdges,
    overlayPanelWidth,
    leftOffset,
    rightOffset,
    centerLeft,
    centerRight,
    updateSystemState,
    handleModeChange,
    handleEnterEditMode,
    handleExitEditMode,
  };
}
