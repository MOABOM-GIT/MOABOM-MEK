<?php

namespace Modules\Moabom\Consulting\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Consulting\Http\Requests\SimulateRequest;
use Modules\Moabom\Consulting\Services\ProfitabilitySimulationService;

class SimulationController extends AuthBaseController
{
    public function __construct(
        private readonly ProfitabilitySimulationService $simulationService,
    ) {
        parent::__construct();
    }

    /**
     * 입력값으로 자체운영 vs 스마트케어360 수익성을 서버에서 계산해 반환합니다.
     */
    public function simulate(SimulateRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $result = $this->simulationService->simulate($request->validated());

        return ResponseHelper::moduleSuccess(
            'moabom-consulting',
            'messages.consulting.simulate_success',
            ['simulation' => $result],
        );
    }
}
