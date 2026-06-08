/**
 * 셸 전용 별도 번들 진입점 — `components.iife.js`에 포함되지 않음.
 * 로드 시 `window.moabomShellApps` 에 마스크 피팅 컴포넌트를 등록합니다.
 */
import type { ComponentType } from 'react';
import { CpapMaskFitApp } from './CpapMaskFitApp';
import { cpapMaskFitAppMetadata } from './metadata';

const w = window as unknown as { moabomShellApps?: Record<string, ComponentType> };
w.moabomShellApps = w.moabomShellApps ?? {};
w.moabomShellApps[cpapMaskFitAppMetadata.id] = CpapMaskFitApp;

export {};
