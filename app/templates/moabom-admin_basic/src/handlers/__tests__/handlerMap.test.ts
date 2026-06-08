import { describe, expect, it } from 'vitest';
import { handlerMap } from '../index';

describe('handlerMap', () => {
  it('setLocale은 템플릿에서 오버라이드하지 않고 엔진 빌트인을 사용한다', () => {
    expect(handlerMap).not.toHaveProperty('setLocale');
  });
});
