import { describe, expect, it } from 'vitest';
import { appendHostedModernStoragePrompt } from './aiGeneratorPrompt';

describe('appendHostedModernStoragePrompt', () => {
  const addon =
    '현대적인 디자인으로 UI/UX를 설계.\n웹 서버에 저장 옵션에서는 온라인(*.apps.mek360.com api 스토리지), 오프라인(로컬스토리지) 저장기능을 모두 사용할 수 있게 구성.';

  it('hosted + enabled 이면 addon 을 덧붙인다', () => {
    expect(appendHostedModernStoragePrompt('메모장', 'hosted', true, addon)).toContain(addon);
    expect(appendHostedModernStoragePrompt('메모장', 'hosted', true, addon)).toContain('메모장');
  });

  it('standard 이거나 비활성이면 원문만 반환한다', () => {
    expect(appendHostedModernStoragePrompt('메모장', 'standard', true, addon)).toBe('메모장');
    expect(appendHostedModernStoragePrompt('메모장', 'hosted', false, addon)).toBe('메모장');
  });

  it('이미 addon 이 포함되면 중복하지 않는다', () => {
    const merged = `${addon}\n\n메모장`;
    expect(appendHostedModernStoragePrompt(merged, 'hosted', true, addon)).toBe(merged);
  });
});
