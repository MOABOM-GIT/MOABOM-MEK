<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services;

/**
 * Ghost API용 — 셸 최초 페인트에 불필요한 이커머스 라우트를 제외한다.
 *
 * 정책은 Moabom 전용이며, `scope=full` 요청에서는 컨트롤러가 필터를 건너뛴다.
 */
final class MoabomShellRoutesFilter
{
    /**
     * @param  array<int, array<string, mixed>>  $routes
     * @return array<int, array<string, mixed>>
     */
    public function filterForShell(array $routes, string $templateIdentifier): array
    {
        if ($templateIdentifier !== 'moabom-basic') {
            return $routes;
        }

        $out = [];
        foreach ($routes as $route) {
            if (! is_array($route)) {
                continue;
            }
            $path = $route['path'] ?? '';
            $layout = $route['layout'] ?? '';

            if (is_string($path)) {
                if (
                    str_starts_with($path, '/shop')
                    || str_starts_with($path, '/cart')
                    || str_starts_with($path, '/checkout')
                    || str_starts_with($path, '/orders')
                ) {
                    continue;
                }
            }

            if (is_string($layout) && str_starts_with($layout, 'sirsoft-ecommerce.')) {
                continue;
            }

            $out[] = $route;
        }

        return MoabomShellEssentialRoutes::mergeInto($out, $templateIdentifier);
    }
}
