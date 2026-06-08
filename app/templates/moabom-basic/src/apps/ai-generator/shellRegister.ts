import type { ComponentType } from 'react';
import { AiGeneratorApp } from './AiGeneratorApp';
import { createAppShellMetadata } from './metadata';

const w = window as unknown as { moabomShellApps?: Record<string, ComponentType> };
w.moabomShellApps = w.moabomShellApps ?? {};
w.moabomShellApps[createAppShellMetadata.id] = AiGeneratorApp;

export {};
