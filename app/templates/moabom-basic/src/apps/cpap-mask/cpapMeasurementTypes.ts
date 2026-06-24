import type { CpapRecommendation } from '../../api/moabomAppsApi';

export interface CpapFaceMeasurements {
  ipdPixels: number;
  scaleFactor: number;
  faceWidth: number;
  faceLength: number;
  noseWidth: number;
  philtrumLength: number;
  mouthWidth: number;
  bridgeWidth: number;
  confidence: number;
}

export interface CpapProfileMeasurements {
  noseHeight: number;
  jawProjection: number;
  chinLength: number;
}

export interface CpapMeasurementResult {
  measurements: CpapFaceMeasurements;
  profileMeasurements: CpapProfileMeasurements;
  recommendation: CpapRecommendation;
}
