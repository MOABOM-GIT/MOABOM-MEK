<?php

declare(strict_types=1);

namespace Modules\Moabom\Cpap\Http\Controllers\Admin;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AdminBaseController;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Cpap\Http\Requests\Admin\CpapMeasurementListRequest;
use Modules\Moabom\Cpap\Services\CpapMeasurementAdminService;

class CpapMeasurementAdminController extends AdminBaseController
{
    public function __construct(
        private readonly CpapMeasurementAdminService $adminService,
    ) {}

    public function index(CpapMeasurementListRequest $request): JsonResponse
    {
        $paginator = $this->adminService->paginate($request->validated());

        return ResponseHelper::moduleSuccess(
            'moabom-cpap',
            'messages.cpap.admin.list_success',
            [
                'data' => collect($paginator->items())
                    ->map(fn ($item) => $this->adminService->serializeListItem($item))
                    ->values()
                    ->all(),
                'meta' => [
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                ],
            ],
        );
    }
}
