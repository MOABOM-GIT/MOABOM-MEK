<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Support;

use Illuminate\Http\Request;

/**
 * moabom-basic 홈 셸(최소 부트) HTTP 경로 판별 — Ghost Composer 와 동일 규칙.
 */
final class MoabomHomeShellRequest
{
    public static function matchesCurrentRequest(): bool
    {
        if (! config('moabom-system.boot_asset_ghost.enabled', true)) {
            return false;
        }

        $request = request();
        if (! $request instanceof Request) {
            return false;
        }

        $paths = config('moabom-system.boot_asset_ghost.strip_deferred_on_request_paths', ['']);
        if (! is_array($paths) || $paths === []) {
            return false;
        }

        $current = trim($request->path(), '/');

        foreach ($paths as $p) {
            if ($current === trim((string) $p, '/')) {
                return true;
            }
        }

        return false;
    }
}
