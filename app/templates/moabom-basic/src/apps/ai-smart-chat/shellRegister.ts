import type { ComponentType } from 'react';
import { AiSmartChatApp } from './AiSmartChatApp';
import { smartChatShellMetadata } from './metadata';

const w = window as unknown as { moabomShellApps?: Record<string, ComponentType> };
w.moabomShellApps = w.moabomShellApps ?? {};
w.moabomShellApps[smartChatShellMetadata.id] = AiSmartChatApp;

export {};
