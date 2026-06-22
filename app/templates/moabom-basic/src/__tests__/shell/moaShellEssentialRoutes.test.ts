import { describe, expect, it } from 'vitest';
import {
  mergeEssentialRoutesInRoutesApiBody,
  mergeMoabomShellEssentialRoutes,
  MOA_SHELL_ESSENTIAL_ROUTES,
} from '../../shell/moaShellEssentialRoutes';

describe('mergeMoabomShellEssentialRoutes', () => {
  it('누락된 에러·게시판 경로를追加한다', () => {
    const input = [{ path: '/', layout: 'home', auth_required: false }];
    const merged = mergeMoabomShellEssentialRoutes(input);

    expect(merged).toHaveLength(1 + MOA_SHELL_ESSENTIAL_ROUTES.length);
    expect(merged.some(r => (r as { path?: string }).path === '/404')).toBe(true);
    expect(merged.some(r => (r as { path?: string }).path === '/board/:slug')).toBe(true);
  });

  it('이미 있는 path 는 중복追加하지 않는다', () => {
    const input = [
      { path: '/', layout: 'home', auth_required: false },
      { path: '/404', layout: 'home', auth_required: false },
    ];
    const merged = mergeMoabomShellEssentialRoutes(input);

    const paths = merged.map(r => (r as { path?: string }).path);
    expect(paths.filter(p => p === '/404')).toHaveLength(1);
  });
});

describe('mergeEssentialRoutesInRoutesApiBody', () => {
  it('API 응답 data.routes 에 병합한다', () => {
    const body = {
      success: true,
      data: {
        version: '1',
        routes: [{ path: '/', layout: 'home' }],
      },
    };

    const merged = mergeEssentialRoutesInRoutesApiBody(body);
    expect(merged.data?.routes?.some(r => (r as { path?: string }).path === '/403')).toBe(true);
  });
});
