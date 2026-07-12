/**
 * 셸 전용 별도 번들 진입점 — `components.iife.js`에 포함되지 않음.
 */
import type { ComponentType } from 'react';
import { MysumIntegrationApp } from './MysumIntegrationApp';
import { mysumIntegrationAppMetadata } from './metadata';

const w = window as unknown as { moabomShellApps?: Record<string, ComponentType> };
w.moabomShellApps = w.moabomShellApps ?? {};
w.moabomShellApps[mysumIntegrationAppMetadata.id] = MysumIntegrationApp;

export {};
