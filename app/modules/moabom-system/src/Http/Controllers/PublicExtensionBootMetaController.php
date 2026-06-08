<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Controllers;

use App\Extension\ModuleManager;
use App\Helpers\ResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

/**
 * SPA 가 확장 캐시 세대(Epoch)와 부트 메타를 폴링할 때 사용하는 공개 API입니다.
 *
 * 응답 스키마는 `docs/extension-boot-meta-api.md` 를 참고합니다.
 */
final class PublicExtensionBootMetaController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $epoch = ModuleManager::getExtensionCacheVersion();

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.extension_boot_meta.fetch_success',
            [
                'extension_epoch' => $epoch,
                'client_actions' => [
                    'reload_deferred_assets' => false,
                    'notify_user' => false,
                    'message_key' => null,
                ],
                'module_hints' => [],
            ]
        );
    }
}
