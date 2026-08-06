<?php

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\PublicBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Moabom\Apps\Services\AiAppService;

class PublicGeneratedAppController extends PublicBaseController
{
    public function __construct(
        private readonly AiAppService $aiAppService,
    ) {
        parent::__construct();
    }

    /**
     * 공유 공개된 생성 앱 목록을 조회합니다.
     */
    public function shared(): JsonResponse
    {
        $viewerUserId = $this->getCurrentUser()?->id;

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.fetch_success',
            [
                'items' => $this->aiAppService->listPublished(viewerUserId: $viewerUserId),
            ]
        );
    }

    /**
     * 공유 공개된 생성 앱 단건을 조회합니다.
     *
     * `include_html=0` 이면 메타·preview_url 만 (실행용). 기본은 HTML 포함.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $app = $this->aiAppService->findPublished($id);
        if (! $app) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        $includeHtml = $request->boolean('include_html', true);

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.show_success',
            $this->aiAppService->serialize(
                $app,
                includeHtml: $includeHtml,
                viewerUserId: $this->getCurrentUser()?->id,
            )
        );
    }
}
