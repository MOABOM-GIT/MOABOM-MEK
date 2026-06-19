import { beforeEach, describe, expect, it } from 'vitest';
import {
  adaptG7LayoutTreeForContainerWidth,
  rewriteViewportBreakpointPrefixes,
} from './g7WindowContainerResponsive';

describe('g7WindowContainerResponsive', () => {
  describe('rewriteViewportBreakpointPrefixes', () => {
    it('sm:/lg: 접두사를 @sm:/@lg: 로 바꾼다', () => {
      expect(rewriteViewportBreakpointPrefixes('flex flex-col sm:flex-row lg:hidden')).toBe(
        'flex flex-col @sm:flex-row @lg:hidden',
      );
    });

    it('이미 @ 접두사가 있으면 중복 치환하지 않는다', () => {
      expect(rewriteViewportBreakpointPrefixes('@sm:flex-row')).toBe('@sm:flex-row');
    });
  });

  describe('adaptG7LayoutTreeForContainerWidth', () => {
    const mockManager = {
      getMatchingKey: (responsive: Record<string, unknown>, width: number) => {
        if (width >= 1024 && responsive.desktop) return 'desktop';
        if (width >= 768 && responsive.tablet) return 'tablet';
        if (responsive.mobile) return 'mobile';
        return null;
      },
    };

    beforeEach(() => {
      (window as { G7Core?: { ResponsiveManager?: typeof mockManager } }).G7Core = {
        ResponsiveManager: mockManager,
      };
    });

    it('JSON responsive 를 컨테이너 폭에 맞게 병합하고 responsive 키를 제거한다', () => {
      const roots = [
        {
          name: 'Grid',
          props: { className: 'grid-cols-1' },
          responsive: {
            tablet: { props: { className: 'grid-cols-2' } },
            desktop: { props: { className: 'grid-cols-3' } },
          },
        },
      ];

      const tablet = adaptG7LayoutTreeForContainerWidth(roots, 800);
      expect(tablet[0]?.props?.className).toBe('grid-cols-2');
      expect(tablet[0]?.responsive).toBeUndefined();

      const desktop = adaptG7LayoutTreeForContainerWidth(roots, 1200);
      expect(desktop[0]?.props?.className).toBe('grid-cols-3');
    });

    it('자식 노드 className 의 viewport breakpoint 를 컨테이너 변형으로 바꾼다', () => {
      const roots = [
        {
          name: 'Div',
          props: { className: 'hidden lg:grid' },
          children: [
            {
              name: 'Div',
              props: { className: 'w-full sm:w-auto' },
            },
          ],
        },
      ];

      const adapted = adaptG7LayoutTreeForContainerWidth(roots, 400);
      expect(adapted[0]?.props?.className).toBe('hidden @lg:grid');
      expect(adapted[0]?.children?.[0]?.props?.className).toBe('w-full @sm:w-auto');
    });
  });
});
