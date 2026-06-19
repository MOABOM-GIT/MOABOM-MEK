import type { ComponentType } from 'react';
import { AsRequestApp } from './AsRequestApp';
import { asRequestAppMetadata } from './metadata';

const w = window as unknown as { moabomShellApps?: Record<string, ComponentType> };
w.moabomShellApps = w.moabomShellApps ?? {};
w.moabomShellApps[asRequestAppMetadata.id] = AsRequestApp;

export {};
