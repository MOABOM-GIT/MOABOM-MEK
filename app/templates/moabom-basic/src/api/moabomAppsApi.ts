import { createModuleApi } from './moabomModuleApi';

export type AiAppType = 'general' | '3d' | 'game' | 'dataviz';

export interface GenerateAiAppPayload {
  prompt: string;
  app_type: AiAppType;
  model_id: string;
  current_html?: string | null;
}

export interface GenerateAiAppResult {
  html: string;
  model_id: string;
  provider: string;
  fallback?: boolean;
  notice?: string | null;
}

export interface StoreGeneratedAppPayload {
  title: string;
  app_type: AiAppType;
  model_id?: string | null;
  prompt?: string | null;
  html: string;
  metadata?: Record<string, unknown>;
}

export interface StoredGeneratedApp extends StoreGeneratedAppPayload {
  id: number;
  created_at?: string | null;
}

/** 목록 조회 응답 항목 (HTML 제외) */
export type StoredGeneratedAppSummary = Pick<
  StoredGeneratedApp,
  'id' | 'title' | 'app_type' | 'model_id' | 'prompt' | 'metadata' | 'created_at'
>;

export interface CpapUserProfile {
  gender: 'male' | 'female';
  ageGroup: '20s' | '30s' | '40s' | '50s' | '60s+';
  tossing: 'low' | 'medium' | 'high';
  mouthBreathing: boolean;
  pressure: 'low' | 'medium' | 'high';
  preferredTypes: string[];
}

export interface CpapRecommendation {
  type: string;
  name: string;
  confidence: number;
  reasons?: string[];
  tips?: string[];
}

export interface CpapMeasurementPayload {
  profile: CpapUserProfile;
  measurements: Record<string, number>;
  profile_measurements?: Record<string, number> | null;
  recommendation: CpapRecommendation;
  metadata?: Record<string, unknown>;
}

export interface CpapStoredMeasurement extends CpapMeasurementPayload {
  id: number;
  mask_type?: string | null;
  confidence?: number | null;
  created_at?: string | null;
}

/**
 * 2026-06-02 모듈 분리 완료:
 *  - AI 앱(`apps/ai/*`, `apps/generated/*`) → moabom-apps 모듈
 *  - CPAP 측정(`apps/cpap-mask/*`) → moabom-cpap 모듈
 */
const requestMoabomAppsApi = createModuleApi('moabom-apps');
const requestMoabomCpapApi = createModuleApi('moabom-cpap');

export async function generateAiApp(payload: GenerateAiAppPayload): Promise<GenerateAiAppResult> {
  return requestMoabomAppsApi<GenerateAiAppResult>('apps/ai/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function storeGeneratedApp(payload: StoreGeneratedAppPayload): Promise<StoredGeneratedApp> {
  return requestMoabomAppsApi<StoredGeneratedApp>('apps/generated', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchGeneratedApps(): Promise<StoredGeneratedAppSummary[]> {
  const data = await requestMoabomAppsApi<{ items: StoredGeneratedAppSummary[] }>('apps/generated');
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchGeneratedApp(id: number): Promise<StoredGeneratedApp> {
  return requestMoabomAppsApi<StoredGeneratedApp>(`apps/generated/${id}`);
}

export async function updateGeneratedApp(id: number, payload: StoreGeneratedAppPayload): Promise<StoredGeneratedApp> {
  return requestMoabomAppsApi<StoredGeneratedApp>(`apps/generated/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function fetchLatestCpapMeasurement(): Promise<CpapStoredMeasurement | null> {
  const data = await requestMoabomCpapApi<{ measurement: CpapStoredMeasurement | null }>('apps/cpap-mask/measurements/latest');

  return data.measurement;
}

export async function storeCpapMeasurement(payload: CpapMeasurementPayload): Promise<CpapStoredMeasurement> {
  const data = await requestMoabomCpapApi<{ measurement: CpapStoredMeasurement }>('apps/cpap-mask/measurements', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return data.measurement;
}
