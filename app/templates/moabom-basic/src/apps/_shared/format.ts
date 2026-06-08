/**
 * 앱 공용 포맷 유틸 (SSOT) — 여러 셸 앱이 공유한다.
 */

/** 원 → "1억 2,788만원" 형태의 한국어 통화 표기. */
export function formatKrwManwon(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(Math.round(value));
  const eok = Math.floor(abs / 100_000_000);
  const man = Math.floor((abs % 100_000_000) / 10_000);
  if (eok > 0 && man > 0) return `${sign}${eok}억 ${man.toLocaleString()}만원`;
  if (eok > 0) return `${sign}${eok}억원`;
  if (man > 0) return `${sign}${man.toLocaleString()}만원`;
  return `${sign}${abs.toLocaleString()}원`;
}
