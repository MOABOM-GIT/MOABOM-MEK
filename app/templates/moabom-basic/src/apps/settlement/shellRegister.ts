import type { ComponentType } from 'react';
import { SettlementApp } from './SettlementApp';
import { settlementAppMetadata } from './metadata';

const w = window as unknown as { moabomShellApps?: Record<string, ComponentType> };
w.moabomShellApps = w.moabomShellApps ?? {};
w.moabomShellApps[settlementAppMetadata.id] = SettlementApp;

export {};
