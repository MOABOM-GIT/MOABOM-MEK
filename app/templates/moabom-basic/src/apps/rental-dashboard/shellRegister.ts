import type { ComponentType } from 'react';
import { RentalDashboardApp } from './RentalDashboardApp';
import { rentalDashboardAppMetadata } from './metadata';

const w = window as unknown as { moabomShellApps?: Record<string, ComponentType> };
w.moabomShellApps = w.moabomShellApps ?? {};
w.moabomShellApps[rentalDashboardAppMetadata.id] = RentalDashboardApp;

export {};
