import { describe, expect, it } from 'vitest';
import {
  MOA_POINTER_DRAGGABLE_CLASS,
  moaPointerDraggableClassName,
} from './useMoaBoundedPointerDrag';

describe('moaPointerDraggableClassName', () => {
  it('returns base class when idle', () => {
    expect(moaPointerDraggableClassName()).toBe(MOA_POINTER_DRAGGABLE_CLASS);
  });

  it('appends is-dragging while dragging', () => {
    expect(moaPointerDraggableClassName(true)).toBe(`${MOA_POINTER_DRAGGABLE_CLASS} is-dragging`);
  });
});
