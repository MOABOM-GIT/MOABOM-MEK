import type { ComponentType } from 'react';
import { GlobalSearchApp } from './GlobalSearchApp';
import { globalSearchAppMetadata } from './metadata';

const w = window as unknown as { moabomShellApps?: Record<string, ComponentType> };
w.moabomShellApps = w.moabomShellApps ?? {};
w.moabomShellApps[globalSearchAppMetadata.id] = GlobalSearchApp;

export {};
