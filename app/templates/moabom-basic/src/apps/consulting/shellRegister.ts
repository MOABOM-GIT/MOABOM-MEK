/**
 * 셸 전용 별도 번들 진입점 — `components.iife.js`에 포함되지 않음.
 * 로드 시 `window.moabomShellApps` 에 360 컨설팅 컴포넌트를 등록합니다.
 */
import type { ComponentType } from 'react';
import { ConsultingApp } from './ConsultingApp';
import { consultingAppMetadata } from './metadata';

const w = window as unknown as { moabomShellApps?: Record<string, ComponentType> };
w.moabomShellApps = w.moabomShellApps ?? {};
w.moabomShellApps[consultingAppMetadata.id] = ConsultingApp;

export {};
