import { afterEach, describe, expect, it } from 'vitest';
import type { App } from '../../data/Moa_apps';
import {
  appendNewShellBootApps,
  getShellBootApps,
  resetShellBootAppsForTest,
  setShellBootApps,
  shellBootChunkFileFor,
} from '../shellBootApps';

afterEach(() => {
  resetShellBootAppsForTest();
});

describe('shellBootApps (앱 SDK 런타임)', () => {
  it('유효한 매니페스트만 보관하고 잘못된 항목은 거른다', () => {
    setShellBootApps([
      { id: 'consulting', frontend: { chunk: 'moabom-shell-consulting.iife.js' } },
      // @ts-expect-error 잘못된 항목(런타임 방어)
      { name: 'no id' },
      // @ts-expect-error null 방어
      null,
    ]);

    expect(getShellBootApps().map(a => a.id)).toEqual(['consulting']);
  });

  it('매니페스트 청크 파일을 id 로 조회한다', () => {
    setShellBootApps([{ id: 'consulting', frontend: { chunk: 'moabom-shell-consulting.iife.js' } }]);

    expect(shellBootChunkFileFor('consulting')).toBe('moabom-shell-consulting.iife.js');
    expect(shellBootChunkFileFor('missing')).toBeUndefined();
  });

  it('기존 그리드에 없는 신규 앱만 추가하고 시스템 도구는 제외한다(중복 방지)', () => {
    const base: App[] = [
      { id: 'cpap-mask', name: '마스크', description: '', icon: 'x', gradient: 'g', category: 'basic', source: 'system' },
    ];
    setShellBootApps([
      { id: 'cpap-mask', name: '마스크(매니페스트)', frontend: { chunk: 'a.js' } },
      { id: 'create-app', name: 'AI', frontend: { chunk: 'b.js' } },
      { id: 'ai-smart-chat', name: '스마트챗', frontend: { chunk: 's.js' } },
      { id: 'consulting', name: '컨설팅', description: '상담', icon: 'comment', gradient: 'grad', category: 'user', frontend: { chunk: 'c.js' } },
    ]);

    const merged = appendNewShellBootApps(base);
    const ids = merged.map(a => a.id);

    expect(ids).toContain('cpap-mask');
    expect(ids).toContain('consulting');
    expect(ids).not.toContain('create-app');
    expect(ids).not.toContain('ai-smart-chat');
    // 기존 cpap-mask 는 그대로(매니페스트가 덮어쓰지 않음)
    expect(merged.find(a => a.id === 'cpap-mask')?.name).toBe('마스크');
    // 신규 consulting 은 매니페스트 메타로 변환
    const consulting = merged.find(a => a.id === 'consulting');
    expect(consulting?.category).toBe('user');
    expect(consulting?.name).toBe('컨설팅');
  });

  it('부트 앱이 없으면 원본 그리드를 그대로 반환한다(무손상)', () => {
    const base: App[] = [
      { id: 'mypage', name: '마이', description: '', icon: 'x', gradient: 'g', category: 'user', source: 'system' },
    ];
    expect(appendNewShellBootApps(base)).toEqual(base);
  });

  it('i18n 객체 name 은 ko 우선으로 표시 문자열을 고른다', () => {
    setShellBootApps([
      { id: 'x', name: { en: 'Hello', ko: '안녕' }, frontend: { chunk: 'x.js' } },
    ]);
    const merged = appendNewShellBootApps([]);
    expect(merged.find(a => a.id === 'x')?.name).toBe('안녕');
  });
});
