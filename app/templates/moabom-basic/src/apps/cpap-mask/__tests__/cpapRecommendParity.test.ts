import { describe, expect, it } from 'vitest';
import parityFixtures from '@moabom-cpap/recommend-parity-fixtures.json';
import type { CpapUserProfile } from '../../../api/moabomAppsApi';
import { recommendMask } from '../cpapRecommendMask';
import type { CpapFaceMeasurements, CpapProfileMeasurements } from '../cpapMeasurementTypes';

type ParityFixture = {
  id: string;
  profile: CpapUserProfile;
  measurements: Partial<CpapFaceMeasurements>;
  profile_measurements: Partial<CpapProfileMeasurements>;
  expected: {
    type?: string;
    name?: string;
    confidence?: number;
    reasons_contains?: string[];
  };
};

const baseMeasurements: CpapFaceMeasurements = {
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

const baseProfileMeasurements: CpapProfileMeasurements = {
  noseHeight: 18,
  jawProjection: 22,
  chinLength: 24,
};

describe('recommendMask parity fixtures', () => {
  it.each(parityFixtures as ParityFixture[])('$id', (fixture) => {
    const recommendation = recommendMask(
      { ...baseMeasurements, ...fixture.measurements },
      { ...baseProfileMeasurements, ...fixture.profile_measurements },
      fixture.profile,
    );

    if (fixture.expected.type) {
      expect(recommendation.type).toBe(fixture.expected.type);
    }
    if (fixture.expected.name) {
      expect(recommendation.name).toBe(fixture.expected.name);
    }
    if (fixture.expected.confidence != null) {
      expect(recommendation.confidence).toBe(fixture.expected.confidence);
    }
    fixture.expected.reasons_contains?.forEach((reason) => {
      expect(recommendation.reasons).toContain(reason);
    });
  });
});
