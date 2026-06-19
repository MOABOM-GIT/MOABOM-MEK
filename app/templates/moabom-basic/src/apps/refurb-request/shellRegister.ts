import type { ComponentType } from 'react';
import { RefurbRequestApp } from './RefurbRequestApp';
import { refurbRequestAppMetadata } from './metadata';

const w = window as unknown as { moabomShellApps?: Record<string, ComponentType> };
w.moabomShellApps = w.moabomShellApps ?? {};
w.moabomShellApps[refurbRequestAppMetadata.id] = RefurbRequestApp;

export {};
