import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

const MEDIAPIPE_WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let visionModulePromise: Promise<typeof import('@mediapipe/tasks-vision')> | null = null;

async function loadVisionModule() {
  if (!visionModulePromise) {
    visionModulePromise = import('@mediapipe/tasks-vision');
  }
  return visionModulePromise;
}
import type { CpapRecommendation, CpapUserProfile } from '../../api/moabomAppsApi';

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

const LANDMARKS = {
  LEFT_EYE_INNER: 133,
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_INNER: 362,
  RIGHT_EYE_OUTER: 263,
  LEFT_EYE_TOP: 159,
  LEFT_EYE_BOTTOM: 145,
  RIGHT_EYE_TOP: 386,
  RIGHT_EYE_BOTTOM: 374,
  LEFT_PUPIL: 468,
  RIGHT_PUPIL: 473,
  NOSE_TIP: 1,
  NOSE_BRIDGE: 6,
  NOSE_LEFT: 98,
  NOSE_RIGHT: 327,
  NOSE_BOTTOM: 2,
  MOUTH_LEFT: 61,
  MOUTH_RIGHT: 291,
  UPPER_LIP_TOP: 13,
  LOWER_LIP_BOTTOM: 14,
  FACE_TOP: 10,
  FACE_LEFT: 234,
  FACE_RIGHT: 454,
  CHIN: 152,
} as const;

const AVERAGE_IPD_MM = {
  male: 38,
  female: 36,
  default: 37,
};

type Landmark = { x: number; y: number; z?: number };

function distance(point1: Landmark, point2: Landmark): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const dz = point2.z && point1.z ? point2.z - point1.z : 0;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function toPixel(point: Landmark, width: number, height: number): Landmark {
  return { x: point.x * width, y: point.y * height, z: point.z };
}

function roundMm(value: number): number {
  return Math.round(value * 10) / 10;
}

/** WASM·모델(.task)·vision JS는 호출 시점에만 CDN에서 내려받음 (앱 진입 시 로드하지 않음) */
export async function initializeFaceLandmarker(): Promise<FaceLandmarker> {
  const { FaceLandmarker: FaceLandmarkerCtor, FilesetResolver } = await loadVisionModule();
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);

  try {
    return await FaceLandmarkerCtor.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: FACE_LANDMARKER_MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  } catch {
    return FaceLandmarkerCtor.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: FACE_LANDMARKER_MODEL_URL,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  }
}

export function performMeasurement(
  result: FaceLandmarkerResult,
  width: number,
  height: number,
  gender: CpapUserProfile['gender'] | 'default' = 'default',
): CpapFaceMeasurements | null {
  if (!result.faceLandmarks?.length) return null;

  const landmarks = result.faceLandmarks[0] as Landmark[];
  const ipdPixels = distance(toPixel(landmarks[LANDMARKS.LEFT_EYE_INNER], width, height), toPixel(landmarks[LANDMARKS.RIGHT_EYE_INNER], width, height));
  if (ipdPixels <= 0) return null;

  const scaleFactor = AVERAGE_IPD_MM[gender] / ipdPixels;
  const noseWidth = distance(toPixel(landmarks[LANDMARKS.NOSE_LEFT], width, height), toPixel(landmarks[LANDMARKS.NOSE_RIGHT], width, height)) * scaleFactor * 1.18;
  const faceLength = distance(toPixel(landmarks[LANDMARKS.FACE_TOP], width, height), toPixel(landmarks[LANDMARKS.CHIN], width, height)) * scaleFactor * 0.9;
  const faceWidth = distance(toPixel(landmarks[LANDMARKS.FACE_LEFT], width, height), toPixel(landmarks[LANDMARKS.FACE_RIGHT], width, height)) * scaleFactor * 1.05;
  const philtrumLength = distance(toPixel(landmarks[LANDMARKS.NOSE_BOTTOM], width, height), toPixel(landmarks[LANDMARKS.UPPER_LIP_TOP], width, height)) * scaleFactor * 0.62;
  const mouthWidth = distance(toPixel(landmarks[LANDMARKS.MOUTH_LEFT], width, height), toPixel(landmarks[LANDMARKS.MOUTH_RIGHT], width, height)) * scaleFactor * 1.05;
  const bridgeWidth = distance(toPixel(landmarks[LANDMARKS.LEFT_EYE_INNER], width, height), toPixel(landmarks[LANDMARKS.RIGHT_EYE_INNER], width, height)) * scaleFactor;

  return {
    ipdPixels,
    scaleFactor,
    noseWidth: roundMm(noseWidth),
    faceLength: roundMm(faceLength),
    faceWidth: roundMm(faceWidth),
    philtrumLength: roundMm(philtrumLength),
    mouthWidth: roundMm(mouthWidth),
    bridgeWidth: roundMm(bridgeWidth),
    confidence: 0.95,
  };
}

export function estimateYaw(landmarks: Landmark[]): number {
  const noseTip = landmarks[LANDMARKS.NOSE_TIP];
  const leftEyeOuter = landmarks[LANDMARKS.LEFT_EYE_OUTER];
  const rightEyeOuter = landmarks[LANDMARKS.RIGHT_EYE_OUTER];
  const distToLeft = Math.abs(noseTip.x - leftEyeOuter.x);
  const distToRight = Math.abs(noseTip.x - rightEyeOuter.x);
  const totalDist = distToLeft + distToRight;
  if (totalDist === 0) return 0;

  return ((distToLeft - distToRight) / totalDist) * 90;
}

export function performProfileMeasurement(
  landmarks: Landmark[],
  scaleFactor: number,
  width: number,
  height: number,
): CpapProfileMeasurements {
  const noseTip = toPixel(landmarks[LANDMARKS.NOSE_TIP], width, height);
  const noseBottom = toPixel(landmarks[LANDMARKS.NOSE_BOTTOM], width, height);
  const chin = toPixel(landmarks[LANDMARKS.CHIN], width, height);
  const noseBridge = toPixel(landmarks[LANDMARKS.NOSE_BRIDGE], width, height);
  const lowerLip = toPixel(landmarks[LANDMARKS.LOWER_LIP_BOTTOM], width, height);

  const noseHeight = distance(noseTip, noseBottom) * scaleFactor * 2.8;
  const jawProjection = Math.min(40, Math.abs(chin.x - noseBridge.x) * scaleFactor * 13);
  const chinLength = distance(lowerLip, chin) * scaleFactor;

  return {
    noseHeight: roundMm(noseHeight),
    jawProjection: roundMm(jawProjection),
    chinLength: roundMm(chinLength),
  };
}

export class PoseValidator {
  static isFrontFacing(yaw: number, threshold = 10): boolean {
    return Math.abs(yaw) < threshold;
  }

  static isProfileFacing(yaw: number, threshold = 35): boolean {
    return Math.abs(yaw) > threshold;
  }
}

class MeasurementBuffer<T extends CpapFaceMeasurements | CpapProfileMeasurements> {
  private buffer: T[] = [];
  private framesSeen = 0;

  constructor(private readonly maxSize = 90) {}

  collect(measurement?: T): void {
    this.framesSeen = Math.min(this.maxSize, this.framesSeen + 1);
    if (measurement) {
      this.buffer.push(measurement);
    }
  }

  getProgress(): number {
    return Math.min(100, Math.round((this.framesSeen / this.maxSize) * 100));
  }

  isFull(): boolean {
    return this.framesSeen >= this.maxSize;
  }

  clear(): void {
    this.buffer = [];
    this.framesSeen = 0;
  }

  getAverage(): T | null {
    if (this.buffer.length === 0) return null;
    const first = this.buffer[0];
    const count = this.buffer.length;

    if ('noseWidth' in first) {
      const sum = this.buffer.reduce((acc, cur) => {
        const measurement = cur as CpapFaceMeasurements;
        return {
          ipdPixels: acc.ipdPixels + measurement.ipdPixels,
          scaleFactor: acc.scaleFactor + measurement.scaleFactor,
          faceWidth: acc.faceWidth + measurement.faceWidth,
          faceLength: acc.faceLength + measurement.faceLength,
          noseWidth: acc.noseWidth + measurement.noseWidth,
          philtrumLength: acc.philtrumLength + measurement.philtrumLength,
          mouthWidth: acc.mouthWidth + measurement.mouthWidth,
          bridgeWidth: acc.bridgeWidth + measurement.bridgeWidth,
          confidence: acc.confidence + measurement.confidence,
        };
      }, {
        ipdPixels: 0,
        scaleFactor: 0,
        faceWidth: 0,
        faceLength: 0,
        noseWidth: 0,
        philtrumLength: 0,
        mouthWidth: 0,
        bridgeWidth: 0,
        confidence: 0,
      });

      return {
        ipdPixels: sum.ipdPixels / count,
        scaleFactor: sum.scaleFactor / count,
        faceWidth: roundMm(sum.faceWidth / count),
        faceLength: roundMm(sum.faceLength / count),
        noseWidth: roundMm(sum.noseWidth / count),
        philtrumLength: roundMm(sum.philtrumLength / count),
        mouthWidth: roundMm(sum.mouthWidth / count),
        bridgeWidth: roundMm(sum.bridgeWidth / count),
        confidence: roundMm(sum.confidence / count),
      } as T;
    }

    const profileSum = this.buffer.reduce((acc, cur) => {
      const measurement = cur as CpapProfileMeasurements;
      return {
        noseHeight: acc.noseHeight + measurement.noseHeight,
        jawProjection: acc.jawProjection + measurement.jawProjection,
        chinLength: acc.chinLength + measurement.chinLength,
      };
    }, { noseHeight: 0, jawProjection: 0, chinLength: 0 });

    return {
      noseHeight: roundMm(profileSum.noseHeight / count),
      jawProjection: roundMm(profileSum.jawProjection / count),
      chinLength: roundMm(profileSum.chinLength / count),
    } as T;
  }

  getAverageScaleFactor(): number {
    const front = this.getAverage();
    return front && 'scaleFactor' in front ? front.scaleFactor : 0;
  }
}

export class FaceMeasurementSession {
  private frontBuffer: MeasurementBuffer<CpapFaceMeasurements>;
  private profileBuffer: MeasurementBuffer<CpapProfileMeasurements>;
  private fixedScaleFactor = 0;

  constructor(scanFrames = 90) {
    this.frontBuffer = new MeasurementBuffer<CpapFaceMeasurements>(scanFrames);
    this.profileBuffer = new MeasurementBuffer<CpapProfileMeasurements>(scanFrames);
  }

  addFrontMeasurement(measurement?: CpapFaceMeasurements): void {
    this.frontBuffer.collect(measurement);
  }

  addProfileMeasurement(measurement: CpapProfileMeasurements): void {
    this.profileBuffer.collect(measurement);
  }

  getFrontProgress(): number {
    return this.frontBuffer.getProgress();
  }

  getProfileProgress(): number {
    return this.profileBuffer.getProgress();
  }

  isFrontComplete(): boolean {
    return this.frontBuffer.isFull();
  }

  isProfileComplete(): boolean {
    return this.profileBuffer.isFull();
  }

  finalizeFrontMeasurement(): void {
    this.fixedScaleFactor = this.frontBuffer.getAverageScaleFactor();
  }

  getFixedScaleFactor(): number {
    return this.fixedScaleFactor;
  }

  getFinalResults(): Omit<CpapMeasurementResult, 'recommendation'> | null {
    const measurements = this.frontBuffer.getAverage();
    const profileMeasurements = this.profileBuffer.getAverage();

    if (!measurements || !profileMeasurements) return null;

    return { measurements, profileMeasurements };
  }

  reset(): void {
    this.frontBuffer.clear();
    this.profileBuffer.clear();
    this.fixedScaleFactor = 0;
  }
}

export function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number,
  faceDetected = true,
): void {
  const faceCenter = { x: width / 2, y: height / 2 };
  const short = Math.min(width, height);
  const guideW = short * 0.36;
  const guideH = short * 0.42;

  ctx.strokeStyle = faceDetected ? 'rgba(0, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = faceDetected ? 3 : 2;
  ctx.setLineDash(faceDetected ? [] : [10, 5]);
  ctx.beginPath();
  ctx.ellipse(faceCenter.x, faceCenter.y, guideW, guideH, 0, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);

  if (!faceDetected) return;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  landmarks.forEach((landmark) => {
    ctx.beginPath();
    ctx.arc(landmark.x * width, landmark.y * height, 2, 0, 2 * Math.PI);
    ctx.fill();
  });

  ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  [
    [LANDMARKS.LEFT_PUPIL, LANDMARKS.RIGHT_PUPIL],
    [LANDMARKS.NOSE_LEFT, LANDMARKS.NOSE_RIGHT],
    [LANDMARKS.FACE_TOP, LANDMARKS.CHIN],
    [LANDMARKS.FACE_LEFT, LANDMARKS.FACE_RIGHT],
  ].forEach(([from, to]) => {
    const start = landmarks[from];
    const end = landmarks[to];
    if (!start || !end) return;
    ctx.beginPath();
    ctx.moveTo(start.x * width, start.y * height);
    ctx.lineTo(end.x * width, end.y * height);
    ctx.stroke();
  });
}

export function recommendMask(
  measurements: CpapFaceMeasurements,
  profileMeasurements: CpapProfileMeasurements,
  profile: CpapUserProfile,
): CpapRecommendation {
  const sizeScore = [
    measurements.noseWidth < 37 ? 1 : measurements.noseWidth < 43 ? 2 : 3,
    measurements.faceLength < 155 ? 1 : measurements.faceLength < 165 ? 2 : 3,
    measurements.faceWidth < 145 ? 1 : measurements.faceWidth < 155 ? 2 : 3,
    measurements.mouthWidth < 43 ? 1 : measurements.mouthWidth < 49 ? 2 : 3,
  ].reduce((sum, score) => sum + score, 0);
  const size = sizeScore <= 6 ? 'S' : sizeScore <= 10 ? 'M' : 'L';
  const scores = {
    nasal: { score: 50, reasons: [] as string[], warnings: [] as string[] },
    pillow: { score: 50, reasons: [] as string[], warnings: [] as string[] },
    full: { score: 50, reasons: [] as string[], warnings: [] as string[] },
  };
  const ageBonus: Record<CpapUserProfile['ageGroup'], { nasal: number; pillow: number; full: number }> = {
    '20s': { nasal: 15, pillow: 15, full: 0 },
    '30s': { nasal: 15, pillow: 10, full: 5 },
    '40s': { nasal: 10, pillow: 5, full: 10 },
    '50s': { nasal: 5, pillow: 0, full: 15 },
    '60s+': { nasal: 0, pillow: 0, full: 20 },
  };

  Object.entries(ageBonus[profile.ageGroup]).forEach(([type, bonus]) => {
    scores[type as keyof typeof scores].score += bonus;
  });

  if (profile.mouthBreathing) {
    scores.full.score += 30;
    scores.full.reasons.push('구강호흡자에게 필수');
    scores.nasal.warnings.push('구강호흡 시 비효율적');
    scores.pillow.warnings.push('구강호흡 시 비효율적');
  } else {
    scores.nasal.score += 10;
    scores.pillow.score += 10;
  }

  if (profile.pressure === 'high') {
    scores.pillow.score -= 30;
    scores.full.score += 10;
    scores.full.reasons.push('고압력에 안정적');
  } else if (profile.pressure === 'low') {
    scores.pillow.score += 15;
    scores.pillow.reasons.push('저압력에 최적화');
  }

  if (profile.tossing === 'high') {
    scores.pillow.score += 15;
    scores.pillow.reasons.push('가볍고 움직임에 강함');
    scores.full.score -= 10;
  }

  if (profileMeasurements.noseHeight > 18) {
    scores.nasal.score += 10;
    scores.nasal.reasons.push('높은 코에 적합');
  } else if (profileMeasurements.noseHeight < 12) {
    scores.pillow.score += 10;
    scores.pillow.reasons.push('낮은 코에 편안함');
  }

  if (measurements.philtrumLength < 15) {
    scores.pillow.score += 5;
  }
  if (measurements.mouthWidth > 70) {
    scores.full.score += 10;
    scores.full.reasons.push('넓은 입에 안정적 밀착');
  }
  if (measurements.bridgeWidth < 30) {
    scores.pillow.score += 5;
  }

  profile.preferredTypes.forEach((type) => {
    const key = type === 'full' ? 'full' : type === 'pillow' ? 'pillow' : 'nasal';
    scores[key].score += 20;
    scores[key].reasons.push('사용자 선호');
  });

  const best = Object.entries(scores)
    .map(([type, data]) => ({
      type,
      score: Math.max(0, Math.min(100, data.score)),
      reasons: data.reasons,
      warnings: data.warnings,
    }))
    .sort((a, b) => b.score - a.score)[0];
  const typeName = best.type === 'full' ? '풀페이스 마스크' : best.type === 'pillow' ? '나잘 필로우 마스크' : '나잘 마스크';

  return {
    type: best.type === 'full' ? 'full-face' : best.type === 'pillow' ? 'nasal-pillow' : 'nasal',
    name: `${typeName} ${size}`,
    confidence: best.score,
    reasons: best.reasons.length ? best.reasons : [`얼굴 측정 결과 ${size} 사이즈가 적합합니다.`],
    tips: best.warnings.length ? best.warnings : ['누운 자세에서 다시 누출 여부를 확인하세요.', '첫 착용 후 2~3일 동안 압박 부위를 확인하세요.'],
  };
}

export function estimateMeasurementsFromVideo(video: HTMLVideoElement): Omit<CpapMeasurementResult, 'recommendation'> {
  const width = Math.max(1, video.videoWidth || 1280);
  const height = Math.max(1, video.videoHeight || 720);
  const shortSide = Math.min(width, height);
  const faceWidth = Math.round(shortSide * 0.28);
  const faceLength = Math.round(shortSide * 0.38);
  const noseWidth = Math.round(faceWidth * 0.27);

  return {
    measurements: {
      ipdPixels: Math.round(faceWidth * 0.48),
      scaleFactor: 1,
      faceWidth,
      faceLength,
      noseWidth,
      philtrumLength: Math.round(faceLength * 0.08),
      mouthWidth: Math.round(faceWidth * 0.42),
      bridgeWidth: Math.round(faceWidth * 0.26),
      confidence: 0.5,
    },
    profileMeasurements: {
      noseHeight: Math.round(noseWidth * 0.58),
      jawProjection: Math.round(faceWidth * 0.18),
      chinLength: Math.round(faceLength * 0.12),
    },
  };
}
