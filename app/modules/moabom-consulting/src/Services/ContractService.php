<?php

namespace Modules\Moabom\Consulting\Services;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Modules\Moabom\Consulting\Contracts\ContractRepositoryInterface;
use Modules\Moabom\Consulting\Enums\ContractStatus;
use Modules\Moabom\Consulting\Models\Contract;

class ContractService
{
    public function __construct(
        private readonly ProfitabilitySimulationService $simulationService,
        private readonly ContractRepositoryInterface $contractRepository,
    ) {
    }

    /**
     * 전자계약을 생성한다.
     *
     * 보안(C5): 클라이언트가 보낸 simulation_result 는 신뢰하지 않고, simulation_input 으로
     * 서버에서 재계산한 권위 있는 결과를 저장한다.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(int $userId, array $data): Contract
    {
        $simulationInput = is_array($data['simulation_input'] ?? null) ? $data['simulation_input'] : null;
        $simulationResult = $simulationInput !== null
            ? $this->simulationService->simulate($simulationInput)
            : null;

        $signature = isset($data['signature']) && is_string($data['signature']) ? $data['signature'] : null;
        $signed = $signature !== null && $signature !== '';

        return $this->contractRepository->create([
            'user_id' => $userId,
            'hospital_name' => $data['hospital_name'],
            'representative_name' => $data['representative_name'] ?? null,
            'contact' => $data['contact'] ?? null,
            'business_number' => $data['business_number'] ?? null,
            'plan' => $data['plan'] ?? null,
            'simulation_input' => $simulationInput,
            'simulation_result' => $simulationResult,
            'signer_name' => $data['signer_name'] ?? null,
            'signature' => $signature,
            'signed_at' => $signed ? Carbon::now() : null,
            'status' => ContractStatus::fromSigned($signed),
            'memo' => $data['memo'] ?? null,
        ]);
    }

    /**
     * 상담원 본인의 계약 목록(서명 이미지 제외)을 최신순으로 조회한다.
     *
     * @return Collection<int, Contract>
     */
    public function listForUser(int $userId): Collection
    {
        return $this->contractRepository->getForUser($userId);
    }

    public function findForUser(int $userId, int $id): ?Contract
    {
        return $this->contractRepository->findForUser($userId, $id);
    }

    /**
     * 목록용 요약(서명 이미지 제외).
     *
     * @return array<string, mixed>
     */
    public function serializeSummary(Contract $contract): array
    {
        return [
            'id' => $contract->id,
            'hospital_name' => $contract->hospital_name,
            'representative_name' => $contract->representative_name,
            'contact' => $contract->contact,
            'plan' => $contract->plan,
            'signer_name' => $contract->signer_name,
            'status' => $contract->status?->value,
            'signed_at' => $contract->signed_at?->toISOString(),
            'created_at' => $contract->created_at?->toISOString(),
        ];
    }

    /**
     * 상세(서명 이미지 + 시뮬레이션 결과 포함).
     *
     * @return array<string, mixed>
     */
    public function serialize(Contract $contract): array
    {
        return array_merge($this->serializeSummary($contract), [
            'business_number' => $contract->business_number,
            'simulation_input' => $contract->simulation_input,
            'simulation_result' => $contract->simulation_result,
            'signature' => $contract->signature,
            'memo' => $contract->memo,
        ]);
    }
}
