export type ClientFormFactor = 'desktop' | 'mobile';

/** heartbeat·접속자 목록용 단말 구분 (모바일 뷰포트·터치 기기) */
export function resolveClientFormFactor(): ClientFormFactor {
  if (typeof window === 'undefined') {
    return 'desktop';
  }
  if (window.matchMedia('(max-width: 768px)').matches) {
    return 'mobile';
  }
  if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
    return 'mobile';
  }
  return 'desktop';
}
