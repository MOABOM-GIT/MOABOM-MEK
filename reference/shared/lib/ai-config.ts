/**
 * AI App Generator - Configuration
 * 
 * Vercel AI SDK 설정 파일
 * 다중 모델 지원: Claude, GPT-4, Gemini
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

// 사용 가능한 AI 모델 목록
export const AI_MODELS = {
  // Claude (Anthropic) - 코딩에 최적화, 추론 능력 우수
  'claude-sonnet': {
    id: 'claude-sonnet',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    model: anthropic('claude-sonnet-4-20250514'),
    description: '코딩 전문, 추론 능력 우수',
    icon: 'ri-brain-line',
    color: '#D97757',
  },
  
  // GPT-4 (OpenAI) - 범용 성능 우수
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    model: openai('gpt-4o'),
    description: '범용 성능 우수, 빠른 응답',
    icon: 'ri-openai-line',
    color: '#10A37F',
  },
  
  // Gemini (Google) - 빠르고 저렴
  'gemini-flash': {
    id: 'gemini-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    model: google('gemini-2.5-flash-lite'),
    description: '빠르고 저렴한 모델',
    icon: 'ri-google-line',
    color: '#4285F4',
  },
} as const;

export type AIModelId = keyof typeof AI_MODELS;

// 기본 모델 (Claude Sonnet - 코딩에 가장 강함)
export const DEFAULT_MODEL_ID: AIModelId = 'claude-sonnet';

export const AI_CONFIG = {
  // 기본 모델
  defaultModel: AI_MODELS[DEFAULT_MODEL_ID].model,
  
  // Generation 설정
  temperature: 0.7,
  maxOutputTokens: 8000,
  
  // 모델 선택 함수
  getModel: (modelId: AIModelId = DEFAULT_MODEL_ID) => {
    return AI_MODELS[modelId]?.model || AI_MODELS[DEFAULT_MODEL_ID].model;
  },
} as const;

/**
 * Backend Configuration
 * PHP 백엔드 서버 설정
 */
const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.trim() || '';

const BACKEND_ENDPOINTS = {
  saveApp: '/theme/moabom/apps/ai-generator/save.php',
  deleteApp: '/theme/moabom/apps/ai-generator/delete.php',
  viewApp: '/theme/moabom/apps/ai-generator/view.php',
  library: '/theme/moabom/apps/ai-generator/library.php',
} as const;

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');

const resolveBackendBaseUrl = (): string => {
  // 명시 URL이 있으면 우선 사용
  if (BACKEND_BASE_URL && BACKEND_BASE_URL !== 'auto') {
    return normalizeBaseUrl(BACKEND_BASE_URL);
  }

  // 클라이언트: 현재 접속 origin 사용
  if (typeof window !== 'undefined') {
    return normalizeBaseUrl(window.location.origin);
  }

  // 서버: 배포 환경에서 사용할 fallback origin
  const serverOrigin =
    process.env.BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    '';

  return serverOrigin ? normalizeBaseUrl(serverOrigin) : '';
};

export const BACKEND_CONFIG = {
  baseUrl: BACKEND_BASE_URL,
  endpoints: BACKEND_ENDPOINTS,
  
  // 전체 URL 생성 헬퍼
  getUrl: (endpoint: keyof typeof BACKEND_ENDPOINTS, options?: { origin?: string }): string => {
    const path = BACKEND_ENDPOINTS[endpoint];
    const overrideOrigin = options?.origin?.trim();
    const baseUrl = overrideOrigin
      ? normalizeBaseUrl(overrideOrigin)
      : resolveBackendBaseUrl();

    if (!baseUrl) {
      return path;
    }

    return `${baseUrl}${path}`;
  }
};
