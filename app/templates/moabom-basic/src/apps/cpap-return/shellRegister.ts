import type { ComponentType } from 'react';
import { CpapReturnApp } from './CpapReturnApp';
import { cpapReturnAppMetadata } from './metadata';

const w = window as unknown as { moabomShellApps?: Record<string, ComponentType> };
w.moabomShellApps = w.moabomShellApps ?? {};
w.moabomShellApps[cpapReturnAppMetadata.id] = CpapReturnApp;

export {};
