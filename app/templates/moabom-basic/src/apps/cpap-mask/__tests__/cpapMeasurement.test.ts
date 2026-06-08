import { describe, expect, it } from 'vitest';
import { recommendMask } from '../cpapMeasurement';

const measurements = {
  ipdPixels: 70,
  scaleFactor: 0.54,
  faceWidth: 140,
  faceLength: 160,
  noseWidth: 38,
  philtrumLength: 14,
  mouthWidth: 58,
  bridgeWidth: 32,
  confidence: 0.95,
};

const profileMeasurements = {
  noseHeight: 18,
  jawProjection: 22,
  chinLength: 24,
};

describe('CPAP 마스크 추천', () => {
  it('입 호흡 사용자는 풀페이스 마스크를 추천한다', () => {
    const recommendation = recommendMask(measurements, profileMeasurements, {
      gender: 'male',
      ageGroup: '30s',
      tossing: 'medium',
      mouthBreathing: true,
      pressure: 'medium',
      preferredTypes: [],
    });

    expect(recommendation.type).toBe('full-face');
  });

  it('뒤척임이 많고 코 폭이 좁으면 나잘 필로우를 추천한다', () => {
    const recommendation = recommendMask({ ...measurements, noseWidth: 30 }, profileMeasurements, {
      gender: 'female',
      ageGroup: '40s',
      tossing: 'high',
      mouthBreathing: false,
      pressure: 'low',
      preferredTypes: [],
    });

    expect(recommendation.type).toBe('nasal-pillow');
  });
});
