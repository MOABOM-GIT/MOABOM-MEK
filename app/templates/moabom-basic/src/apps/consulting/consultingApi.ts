/**
 * moabom-consulting 모듈 API 클라이언트.
 * canonical prefix: /api/modules/moabom-consulting/apps/consulting/*
 */
import { createShellModuleApi, hasShellAccessToken } from '../../api/moabomShellHttp';
import type { SimulationResult } from './simulationModel';

const request = createShellModuleApi('moabom-consulting');

/** 서버 권위 시뮬레이션 (snake_case 페이로드) */
export async function simulateOnServer(input: Record<string, number>): Promise<unknown> {
  const data = await request<{ simulation: unknown }>('apps/consulting/simulate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.simulation;
}

export interface ContractSummary {
  id: number;
  hospital_name: string;
  representative_name?: string | null;
  contact?: string | null;
  plan?: string | null;
  signer_name?: string | null;
  status: string;
  signed_at?: string | null;
  created_at?: string | null;
}

export interface ContractDetail extends ContractSummary {
  business_number?: string | null;
  simulation_input?: Record<string, number> | null;
  simulation_result?: SimulationResult | null;
  signature?: string | null;
  memo?: string | null;
}

export interface StoreContractPayload {
  hospital_name: string;
  representative_name?: string | null;
  contact?: string | null;
  business_number?: string | null;
  plan?: string | null;
  simulation_input?: Record<string, number> | null;
  signer_name?: string | null;
  signature?: string | null;
  memo?: string | null;
}

export async function fetchContracts(): Promise<ContractSummary[]> {
  if (!hasShellAccessToken()) {
    return [];
  }
  const data = await request<{ items: ContractSummary[] }>('apps/consulting/contracts');
  return Array.isArray(data.items) ? data.items : [];
}

export async function storeContract(payload: StoreContractPayload): Promise<ContractDetail> {
  const data = await request<{ contract: ContractDetail }>('apps/consulting/contracts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.contract;
}
