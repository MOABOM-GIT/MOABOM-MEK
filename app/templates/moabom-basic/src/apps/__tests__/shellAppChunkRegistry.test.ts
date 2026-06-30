import { describe, expect, it } from 'vitest';
import { createAppShellMetadata } from '../ai-generator/metadata';
import { hasMoabomShellAppChunk } from '../index';

describe('shell app chunk registry', () => {
  it('hospital-info는 메인 번들 인라인 렌더 — 별도 청크 prefetch 대상이 아니다', () => {
    expect(hasMoabomShellAppChunk('hospital-info')).toBe(false);
  });

  it('shellRegister가 있는 앱은 청크 대상이다', () => {
    expect(hasMoabomShellAppChunk('consulting')).toBe(true);
    expect(hasMoabomShellAppChunk('cpap-mask')).toBe(true);
    expect(hasMoabomShellAppChunk(createAppShellMetadata.id)).toBe(true);
  });
});
