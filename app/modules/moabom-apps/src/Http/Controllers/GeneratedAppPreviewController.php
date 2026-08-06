<?php

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Moabom\Apps\Enums\AppTier;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Services\GeneratedAppHostingService;
use Modules\Moabom\Apps\Services\GeneratedAppPreviewService;
use Modules\Moabom\Apps\Support\GeneratedAppDataScope;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class GeneratedAppPreviewController extends Controller
{
    public function __construct(
        private readonly GeneratedAppPreviewService $previewService,
        private readonly GeneratedAppHostingService $hostingService,
    ) {
    }

    public function standard(Request $request, int $id): Response
    {
        $app = $this->previewService->findStandardApp($id);
        if ($app === null) {
            throw new NotFoundHttpException;
        }

        return $this->htmlResponse($app, $this->previewToken($request));
    }

    public function hostedRoot(Request $request): Response
    {
        $app = $this->previewService->findHostedAppByHost((string) $request->getHost());
        if ($app === null) {
            throw new NotFoundHttpException;
        }

        return $this->htmlResponse($app, $this->previewToken($request));
    }

    public function hostedPathFallback(Request $request, int $id): Response
    {
        $app = $this->previewService->findHostedApp($id);
        if ($app === null) {
            throw new NotFoundHttpException;
        }

        return $this->htmlResponse($app, $this->previewToken($request));
    }

    public function listHostedData(Request $request, GeneratedApp $hostedApp, string $tableKey): Response
    {
        return $this->hostedDataList($request, $hostedApp, $tableKey);
    }

    public function listHostedDataByHost(Request $request, string $tableKey): Response
    {
        return $this->hostedDataList($request, $this->resolveHostedFromHost($request), $tableKey);
    }

    public function storeHostedData(Request $request, GeneratedApp $hostedApp, string $tableKey): Response
    {
        return $this->hostedDataStore($request, $hostedApp, $tableKey);
    }

    public function storeHostedDataByHost(Request $request, string $tableKey): Response
    {
        return $this->hostedDataStore($request, $this->resolveHostedFromHost($request), $tableKey);
    }

    public function updateHostedData(Request $request, GeneratedApp $hostedApp, string $tableKey, int $rowId): Response
    {
        return $this->hostedDataUpdate($request, $hostedApp, $tableKey, $rowId);
    }

    public function updateHostedDataByHost(Request $request, string $tableKey, int $rowId): Response
    {
        return $this->hostedDataUpdate($request, $this->resolveHostedFromHost($request), $tableKey, $rowId);
    }

    public function destroyHostedData(Request $request, GeneratedApp $hostedApp, string $tableKey, int $rowId): Response
    {
        return $this->hostedDataDestroy($request, $hostedApp, $tableKey, $rowId);
    }

    public function destroyHostedDataByHost(Request $request, string $tableKey, int $rowId): Response
    {
        return $this->hostedDataDestroy($request, $this->resolveHostedFromHost($request), $tableKey, $rowId);
    }

    private function hostedDataList(Request $request, GeneratedApp $hostedApp, string $tableKey): Response
    {
        $scope = $this->requireHostedDataScope($request, $hostedApp, false);

        return response([
            'items' => $this->hostingService->listRows($hostedApp, $tableKey, $scope),
        ], 200, ['Content-Type' => 'application/json']);
    }

    private function hostedDataStore(Request $request, GeneratedApp $hostedApp, string $tableKey): Response
    {
        $scope = $this->requireHostedDataScope($request, $hostedApp, true);

        $payload = $request->validate([
            'payload' => ['required', 'array'],
        ]);

        $row = $this->hostingService->createRow(
            $hostedApp,
            $tableKey,
            $payload['payload'],
            $scope,
        );

        return response($row, 201, ['Content-Type' => 'application/json']);
    }

    private function hostedDataUpdate(Request $request, GeneratedApp $hostedApp, string $tableKey, int $rowId): Response
    {
        $scope = $this->requireHostedDataScope($request, $hostedApp, true);

        $payload = $request->validate([
            'payload' => ['required', 'array'],
        ]);

        $row = $this->hostingService->updateRow($hostedApp, $rowId, $tableKey, $payload['payload'], $scope);
        if ($row === null) {
            throw new NotFoundHttpException;
        }

        return response($row, 200, ['Content-Type' => 'application/json']);
    }

    private function hostedDataDestroy(Request $request, GeneratedApp $hostedApp, string $tableKey, int $rowId): Response
    {
        $scope = $this->requireHostedDataScope($request, $hostedApp, true);

        if (! $this->hostingService->deleteRow($hostedApp, $rowId, $tableKey, $scope)) {
            throw new NotFoundHttpException;
        }

        return response(null, 204);
    }

    private function requireHostedDataScope(Request $request, GeneratedApp $hostedApp, bool $write): GeneratedAppDataScope
    {
        $this->assertHostedApp($hostedApp);
        $token = $this->previewToken($request);
        if ($write) {
            $this->previewService->assertCanAccessHostedDataWrite($hostedApp, $token);
        } else {
            $this->previewService->assertCanAccessHostedDataRead($hostedApp, $token);
        }

        $scope = $this->previewService->resolveDataScope($hostedApp, $token);
        if ($scope === null) {
            throw new NotFoundHttpException;
        }

        return $scope;
    }

    private function resolveHostedFromHost(Request $request): GeneratedApp
    {
        $appId = $request->attributes->get('moabom_generated_app_id');
        if (is_int($appId) || (is_string($appId) && ctype_digit($appId))) {
            $app = $this->previewService->findHostedApp((int) $appId);
            if ($app !== null) {
                return $app;
            }
        }

        $app = $this->previewService->findHostedAppByHost((string) $request->getHost());
        if ($app === null) {
            throw new NotFoundHttpException;
        }

        return $app;
    }

    private function htmlResponse(GeneratedApp $app, ?string $previewToken): Response
    {
        $this->previewService->assertCanAccessPreviewHtml($app, $previewToken);

        return response(
            $this->previewService->previewHtml($app, $previewToken),
            200,
            array_merge(
                ['Content-Type' => 'text/html; charset=UTF-8'],
                $this->previewService->previewResponseHeaders($app, $previewToken),
            ),
        );
    }

    private function assertHostedApp(GeneratedApp $app): void
    {
        if (AppTier::tryFrom((string) ($app->tier ?? AppTier::Standard->value)) !== AppTier::Hosted) {
            throw new NotFoundHttpException;
        }
    }

    private function previewToken(Request $request): ?string
    {
        $header = (string) $request->header('X-Moabom-Preview-Token', '');
        if ($header !== '') {
            return $header;
        }

        $query = (string) $request->query('preview_token', '');

        return $query !== '' ? $query : null;
    }
}
