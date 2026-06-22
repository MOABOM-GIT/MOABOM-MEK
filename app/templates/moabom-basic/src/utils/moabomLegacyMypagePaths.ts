/** sirsoft-basic / 이커머스 레거시 `/mypage/*` 하위 경로 (G7 전체 routes 병합 필요) */
export const ECOMMERCE_MYPAGE_SEGMENTS = new Set([
  'orders',
  'inquiries',
  'wishlist',
  'addresses',
  'notifications',
  'board',
]);

export function normalizePathname(pathname: string): string {
  let p = (pathname || '/').trim();
  const locale = p.match(/^\/([a-z]{2})(?=\/|$)/);
  if (locale) {
    p = p.slice(3) || '/';
  }
  if (!p.startsWith('/')) {
    p = `/${p}`;
  }
  return p.replace(/\/+$/, '') || '/';
}

/** `/mypage/orders` 등 이커머스 G7 레이아웃 경로인지 */
export function isEcommerceMypageSubpath(pathname: string): boolean {
  const parts = normalizePathname(pathname).split('/').filter(Boolean);
  if (parts[0] !== 'mypage' || parts.length < 2) {
    return false;
  }
  return ECOMMERCE_MYPAGE_SEGMENTS.has(parts[1]);
}

/** Ghost merge 또는 G7 Router `navigate`가 필요한 비-셸 경로 */
export function pathNeedsLegacyG7RouterPath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return (
    isEcommerceMypageSubpath(p) ||
    p.startsWith('/shop') ||
    p.startsWith('/cart') ||
    p.startsWith('/checkout') ||
    p.startsWith('/orders') ||
    p.startsWith('/reset-password') ||
    p.startsWith('/login') ||
    p.startsWith('/register')
  );
}
