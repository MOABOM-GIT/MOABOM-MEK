<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Http\Controllers\Api\Base\PublicBaseController;
use Modules\Moabom\Apps\Services\AiAppService;
use Modules\Moabom\Apps\Services\WebsiteLinkIconStorageService;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class GeneratedAppWebsiteIconController extends PublicBaseController
{
    public function __construct(
        private readonly AiAppService $aiAppService,
        private readonly WebsiteLinkIconStorageService $iconStorageService,
    ) {
        parent::__construct();
    }

    /**
     * 저장된 웹사이트 연결 앱 파비콘을 스트리밍합니다.
     */
    public function show(int $id): StreamedResponse|Response
    {
        $viewerUserId = $this->getCurrentUser()?->id;
        $app = $viewerUserId !== null
            ? $this->aiAppService->findVisibleForUser($viewerUserId, $id)
            : null;

        if ($app === null) {
            $app = $this->aiAppService->findPublished($id);
        }

        if ($app === null || $app->app_type !== 'website_link') {
            abort(404);
        }

        $response = $this->iconStorageService->response($app);
        if ($response === null) {
            abort(404);
        }

        return $response;
    }
}
