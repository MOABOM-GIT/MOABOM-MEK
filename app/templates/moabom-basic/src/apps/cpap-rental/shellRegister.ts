import type { ComponentType } from 'react';
import { CpapRentalApp } from './CpapRentalApp';
import { cpapRentalAppMetadata } from './metadata';

const w = window as unknown as { moabomShellApps?: Record<string, ComponentType> };
w.moabomShellApps = w.moabomShellApps ?? {};
w.moabomShellApps[cpapRentalAppMetadata.id] = CpapRentalApp;

export {};
