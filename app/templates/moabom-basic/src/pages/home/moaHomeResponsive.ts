import {
  BREAKPOINT_MOBILE_OVERLAY,
  BREAKPOINT_RIGHT_OVERLAY,
} from './moaHomeConstants';
import type { ResponsiveMode } from './moaHomeTypes';

export function getViewportWidth(): number {
  return typeof window === 'undefined' ? 1440 : window.innerWidth;
}

export function getResponsiveMode(width: number): ResponsiveMode {
  if (width <= BREAKPOINT_MOBILE_OVERLAY) return 'mobile-overlay';
  if (width <= BREAKPOINT_RIGHT_OVERLAY) return 'right-overlay';
  return 'desktop';
}
