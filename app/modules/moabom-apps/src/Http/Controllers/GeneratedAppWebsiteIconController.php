<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Http\Controllers\Api\Base\PublicBaseController;
use Illuminate\Http\Request;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Services\AiAppService;
use Modules\Moabom\Apps\Services\WebsiteLinkIconAccessService;
use Modules\Moabom\Apps\Services\WebsiteLinkIconStorageService;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class GeneratedAppWebsiteIconController extends PublicBaseController
{
    public function __construct(
        private readonly AiAppService $aiAppService,
        private readonly WebsiteLinkIconStorageService $iconStorageService,
        private readonly WebsiteLinkIconAccessService $iconAccessService,
    ) {
        parent::__construct();
    }

    /**
     * 저장된 웹사이트 연결 앱 파비콘을 스트리밍합니다.
     */
    public function show(int $id, Request $request): StreamedResponse|Response
    {
        $iconToken = $request->query('icon_token');
        $app = $this->resolveAccessibleWebsiteLinkApp(
            $id,
            is_string($iconToken) ? $iconToken : null,
        );

        if ($app === null) {
            abort(404);
        }

        $response = $this->iconStorageService->response($app);
        if ($response === null) {
            $app = $this->aiAppService->repairWebsiteLinkIcon($app);
            $response = $this->iconStorageService->response($app);
        }

        if ($response === null) {
            abort(404);
        }

        return $response;
    }

    private function resolveAccessibleWebsiteLinkApp(int $id, ?string $iconToken): ?GeneratedApp
    {
        $viewerUserId = $this->getCurrentUser()?->id;
        if ($viewerUserId !== null) {
            $app = $this->aiAppService->findVisibleForUser($viewerUserId, $id);
            if ($app !== null && $app->app_type === 'website_link') {
                return $app;
            }
        }

        $app = $this->aiAppService->findPublished($id);
        if ($app !== null && $app->app_type === 'website_link') {
            return $app;
        }

        if (! $this->iconAccessService->validatesAccess($id, $iconToken)) {
            return null;
        }

        $app = $this->aiAppService->findById($id);

        return ($app !== null && $app->app_type === 'website_link') ? $app : null;
    }
}
