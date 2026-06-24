import type { CpapRecommendation, CpapUserProfile } from '../../api/moabomAppsApi';
import recommendRules from '@moabom-cpap/recommend-rules.json';
import type { CpapFaceMeasurements, CpapProfileMeasurements } from './cpapMeasurementTypes';

type ScoreKey = 'nasal' | 'pillow' | 'full';
type ScoreState = { score: number; reasons: string[]; warnings: string[] };

const RULES = recommendRules;

function sizeBucket(
  value: number | null | undefined,
  bucket: { low: number; mid: number } | undefined,
): number {
  const missing = RULES.missing_measurement_bucket;
  if (value == null || bucket == null) {
    return missing;
  }
  if (value < bucket.low) return 1;
  if (value < bucket.mid) return 2;
  return 3;
}

function resolveSizeLabel(sizeScore: number): string {
  if (sizeScore <= RULES.size_labels.small_max_score) return RULES.size_labels.small;
  if (sizeScore <= RULES.size_labels.medium_max_score) return RULES.size_labels.medium;
  return RULES.size_labels.large;
}

function applyMeasurementAdjustment(
  scores: Record<ScoreKey, ScoreState>,
  rule:
    | {
        threshold: number;
        type: ScoreKey;
        score: number;
        reason?: string;
        compare?: 'lt' | 'gt';
      }
    | undefined,
  value: number | null | undefined,
  defaultCompare: 'lt' | 'gt',
): void {
  if (!rule || value == null) return;
  const compare = rule.compare ?? defaultCompare;
  const matches = compare === 'lt' ? value < rule.threshold : value > rule.threshold;
  if (!matches) return;
  scores[rule.type].score += rule.score;
  if (rule.reason) {
    scores[rule.type].reasons.push(rule.reason);
  }
}

function maskMeta(scoreKey: ScoreKey): { apiType: string; displayName: string } {
  const meta = RULES.mask_types[scoreKey];
  return { apiType: meta.api_type, displayName: meta.display_name };
}

/**
 * 프로필 + 측정값으로 추천 마스크를 계산한다.
 * 서버 CpapRecommendEngine 과 1:1 동작(동점 시 score_order 우선).
 */
export function recommendMask(
  measurements: CpapFaceMeasurements,
  profileMeasurements: CpapProfileMeasurements,
  profile: CpapUserProfile,
): CpapRecommendation {
  const buckets = RULES.size_buckets;
  const sizeScore =
    sizeBucket(measurements.noseWidth, buckets.nose_width) +
    sizeBucket(measurements.faceLength, buckets.face_length) +
    sizeBucket(measurements.faceWidth, buckets.face_width) +
    sizeBucket(measurements.mouthWidth, buckets.mouth_width);
  const size = resolveSizeLabel(sizeScore);

  const scores: Record<ScoreKey, ScoreState> = {
    nasal: { score: RULES.base_score, reasons: [], warnings: [] },
    pillow: { score: RULES.base_score, reasons: [], warnings: [] },
    full: { score: RULES.base_score, reasons: [], warnings: [] },
  };

  const ageBonus = RULES.age_bonus[profile.ageGroup];
  if (ageBonus) {
    (Object.entries(ageBonus) as [ScoreKey, number][]).forEach(([type, bonus]) => {
      scores[type].score += bonus;
    });
  }

  if (profile.mouthBreathing) {
    const mouthRules = RULES.mouth_breathing.true;
    scores.full.score += mouthRules.full_score;
    scores.full.reasons.push(mouthRules.full_reason);
    scores.nasal.warnings.push(mouthRules.nasal_warning);
    scores.pillow.warnings.push(mouthRules.pillow_warning);
  } else {
    scores.nasal.score += RULES.mouth_breathing.false.nasal_score;
    scores.pillow.score += RULES.mouth_breathing.false.pillow_score;
  }

  const pressureRules = RULES.pressure[profile.pressure as keyof typeof RULES.pressure];
  if (pressureRules) {
    if ('pillow_score' in pressureRules) scores.pillow.score += pressureRules.pillow_score;
    if ('full_score' in pressureRules) scores.full.score += pressureRules.full_score;
    if ('pillow_reason' in pressureRules && pressureRules.pillow_reason) {
      scores.pillow.reasons.push(pressureRules.pillow_reason);
    }
    if ('full_reason' in pressureRules && pressureRules.full_reason) {
      scores.full.reasons.push(pressureRules.full_reason);
    }
  }

  const tossingRules = RULES.tossing[profile.tossing as keyof typeof RULES.tossing];
  if (tossingRules) {
    if ('pillow_score' in tossingRules) scores.pillow.score += tossingRules.pillow_score;
    if ('full_score' in tossingRules) scores.full.score += tossingRules.full_score;
    if ('pillow_reason' in tossingRules && tossingRules.pillow_reason) {
      scores.pillow.reasons.push(tossingRules.pillow_reason);
    }
  }

  const adj = RULES.measurement_adjustments;
  applyMeasurementAdjustment(scores, adj.nose_height_high, profileMeasurements.noseHeight, 'gt');
  applyMeasurementAdjustment(scores, adj.nose_height_low, profileMeasurements.noseHeight, 'lt');
  applyMeasurementAdjustment(scores, adj.philtrum_length, measurements.philtrumLength, 'lt');
  applyMeasurementAdjustment(scores, adj.mouth_width, measurements.mouthWidth, 'gt');
  applyMeasurementAdjustment(scores, adj.bridge_width, measurements.bridgeWidth, 'lt');

  const preferredRules = RULES.preferred_type;
  profile.preferredTypes.slice(0, preferredRules.max_count).forEach((type) => {
    const key: ScoreKey = type === 'full' ? 'full' : type === 'pillow' ? 'pillow' : 'nasal';
    scores[key].score += preferredRules.score_bonus;
    scores[key].reasons.push(preferredRules.reason);
  });

  const { min, max } = RULES.score_clamp;
  let best: { type: ScoreKey; score: number; reasons: string[]; warnings: string[] } | null = null;
  for (const type of RULES.score_order as ScoreKey[]) {
    const data = scores[type];
    const clamped = Math.max(min, Math.min(max, data.score));
    if (!best || clamped > best.score) {
      best = { type, score: clamped, reasons: data.reasons, warnings: data.warnings };
    }
  }

  const winner = best ?? { type: 'nasal' as ScoreKey, score: RULES.base_score, reasons: [], warnings: [] };
  const mask = maskMeta(winner.type);
  const defaultReason = RULES.defaults.reason_template.replace('{size}', size);

  return {
    type: mask.apiType as CpapRecommendation['type'],
    name: `${mask.displayName} ${size}`,
    confidence: winner.score,
    reasons: winner.reasons.length ? winner.reasons : [defaultReason],
    tips: winner.warnings.length ? winner.warnings : [...RULES.defaults.tips],
  };
}
