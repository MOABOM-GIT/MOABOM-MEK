<?php

namespace Modules\Moabom\Consulting\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Consulting\Http\Requests\StoreContractRequest;
use Modules\Moabom\Consulting\Services\ContractService;

class ContractController extends AuthBaseController
{
    public function __construct(
        private readonly ContractService $contractService,
    ) {
        parent::__construct();
    }

    /**
     * 상담원 본인이 작성한 전자계약 목록을 조회합니다.
     */
    public function index(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $items = $this->contractService->listForUser($user->id)
            ->map(fn ($contract) => $this->contractService->serializeSummary($contract))
            ->values()
            ->all();

        return ResponseHelper::moduleSuccess(
            'moabom-consulting',
            'messages.consulting.contract_list_success',
            ['items' => $items],
        );
    }

    /**
     * 전자계약 상세(서명 이미지 포함)를 조회합니다.
     */
    public function show(int $id): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $contract = $this->contractService->findForUser($user->id, $id);
        if (! $contract) {
            return ResponseHelper::moduleError('moabom-consulting', 'messages.consulting.contract_not_found', 404);
        }

        return ResponseHelper::moduleSuccess(
            'moabom-consulting',
            'messages.consulting.contract_fetch_success',
            ['contract' => $this->contractService->serialize($contract)],
        );
    }

    /**
     * 전자계약을 생성(서명 포함 가능)합니다.
     */
    public function store(StoreContractRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $contract = $this->contractService->create($user->id, $request->validated());

        return ResponseHelper::moduleSuccess(
            'moabom-consulting',
            'messages.consulting.contract_save_success',
            ['contract' => $this->contractService->serialize($contract)],
            201,
        );
    }
}
