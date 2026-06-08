<?php

namespace Modules\Moabom\System\Http\Controllers\Admin;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AdminBaseController;
use Exception;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\System\Experience\HomeBackgroundCatalogSync;
use Modules\Moabom\System\Http\Requests\Admin\UploadHomeBackgroundRequest;
use Modules\Moabom\System\Services\HomeBackgroundService;

class HomeBackgroundController extends AdminBaseController
{
    public function __construct(
        private readonly HomeBackgroundService $homeBackgrounds,
        private readonly HomeBackgroundCatalogSync $backgroundCatalog,
    ) {
        parent::__construct();
    }

    public function store(UploadHomeBackgroundRequest $request): JsonResponse
    {
        try {
            $row = $this->homeBackgrounds->store($request->file('file'));

            return ResponseHelper::moduleSuccess(
                'moabom-system',
                'messages.home_background.upload_success',
                $row,
                201,
            );
        } catch (Exception $e) {
            return ResponseHelper::moduleError(
                'moabom-system',
                'messages.home_background.upload_failed',
                422,
                ['message' => $e->getMessage()],
            );
        }
    }

    public function destroy(string $id): JsonResponse
    {
        try {
            $ok = $this->backgroundCatalog->removeCompletely($id);
            if (! $ok) {
                return ResponseHelper::moduleError(
                    'moabom-system',
                    'messages.home_background.delete_failed',
                    404,
                );
            }

            return ResponseHelper::moduleSuccess(
                'moabom-system',
                'messages.home_background.delete_success',
                ['deleted' => true],
            );
        } catch (Exception $e) {
            return ResponseHelper::moduleError(
                'moabom-system',
                'messages.home_background.delete_failed',
                500,
                config('app.debug') ? $e->getMessage() : null,
            );
        }
    }
}
