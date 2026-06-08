<?php

namespace Modules\Moabom\System\Http\Controllers;

use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Modules\Moabom\System\Services\HomeBackgroundService;

/**
 * 홈 배경 JPEG 공개 제공(사용자 셸·썸네일)
 */
class HomeBackgroundFileController extends Controller
{
    public function __construct(
        private readonly HomeBackgroundService $homeBackgrounds,
    ) {}

    public function show(string $id, string $variant): Response
    {
        $binary = $this->homeBackgrounds->getVariantBinary($id, $variant);
        if ($binary === null) {
            abort(404);
        }

        return response($binary, 200, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => 'public, max-age=604800',
        ]);
    }
}
