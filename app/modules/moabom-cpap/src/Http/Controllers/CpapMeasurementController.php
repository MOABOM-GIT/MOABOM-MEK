<?php

namespace Modules\Moabom\Cpap\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Cpap\Http\Requests\StoreCpapMeasurementRequest;
use Modules\Moabom\Cpap\Services\CpapMeasurementService;

class CpapMeasurementController extends AuthBaseController
{
    public function __construct(
        private readonly CpapMeasurementService $measurementService,
    ) {
        parent::__construct();
    }

    /**
     * 최근 CPAP 측정 결과를 조회합니다.
     */
    public function latest(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $measurement = $this->measurementService->latestForUser($user->id);

        return ResponseHelper::moduleSuccess(
            'moabom-cpap',
            'messages.cpap.fetch_success',
            [
                'measurement' => $measurement
                    ? $this->measurementService->serialize($measurement)
                    : null,
            ]
        );
    }

    /**
     * CPAP 측정 결과를 저장합니다.
     */
    public function store(StoreCpapMeasurementRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $measurement = $this->measurementService->store($user->id, $request->validated());

        return ResponseHelper::moduleSuccess(
            'moabom-cpap',
            'messages.cpap.save_success',
            [
                'measurement' => $this->measurementService->serialize($measurement),
            ],
            201
        );
    }
}
