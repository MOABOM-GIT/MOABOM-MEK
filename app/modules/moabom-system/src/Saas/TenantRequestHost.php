<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Http\Request;

/**
 * SaaS Host SSOT — Cloud Run/LB 는 X-Forwarded-Host, 앱은 getHost() 만 쓰면
 * ResolveMoabomTenant(미부트) + Aggregator(테넌트 plane) split-brain 이 난다.
 */
final class TenantRequestHost
{
    public static function resolve(?Request $request = null): string
    {
        $request ??= request();
        if (! $request instanceof Request) {
            return '';
        }

        $forwarded = $request->header('X-Forwarded-Host');
        if (is_string($forwarded) && trim($forwarded) !== '') {
            return trim(explode(',', $forwarded)[0]);
        }

        return (string) $request->getHost();
    }
}
