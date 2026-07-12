<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Support;

/**
 * 사용자 홈 셸 — first paint 에 불필요한 global 확장을 deferred 로 재분류.
 *
 * manifest strategy 는 유지하고, 홈 셸 compose 시에만 immediate→deferred 이동.
 * shop 등 비홈 경로는 기존 global 번들 경로를 유지한다.
 */
final class MoabomUserSurfaceBootAssetPolicy
{
    /**
     * @return list<string>
     */
    public static function forceDeferModuleIds(): array
    {
        $fromConfig = config('moabom-system.user_surface_boot.force_defer_modules');
        if (is_array($fromConfig) && $fromConfig !== []) {
            return array_values(array_filter(array_map('strval', $fromConfig)));
        }

        return [
            'sirsoft-ecommerce',
        ];
    }

    /**
     * @return list<string>
     */
    public static function forceDeferPluginIds(): array
    {
        $fromConfig = config('moabom-system.user_surface_boot.force_defer_plugins');
        if (is_array($fromConfig) && $fromConfig !== []) {
            return array_values(array_filter(array_map('strval', $fromConfig)));
        }

        return [
            'sirsoft-ckeditor5',
            'sirsoft-daum_postcode',
            'sirsoft-pay_kginicis',
            'sirsoft-verification_kginicis',
        ];
    }

    /**
     * @param  array{immediate: array<string, array<string, mixed>>, deferred: array<string, array<string, mixed>>}  $groups
     * @return array{immediate: array<string, array<string, mixed>>, deferred: array<string, array<string, mixed>>}
     */
    public static function forceDeferModules(array $groups): array
    {
        return self::moveToDeferred($groups, self::forceDeferModuleIds());
    }

    /**
     * @param  array{immediate: array<string, array<string, mixed>>, deferred: array<string, array<string, mixed>>}  $groups
     * @return array{immediate: array<string, array<string, mixed>>, deferred: array<string, array<string, mixed>>}
     */
    public static function forceDeferPlugins(array $groups): array
    {
        return self::moveToDeferred($groups, self::forceDeferPluginIds());
    }

    /**
     * @param  array{immediate: array<string, array<string, mixed>>, deferred: array<string, array<string, mixed>>}  $groups
     * @param  list<string>  $ids
     * @return array{immediate: array<string, array<string, mixed>>, deferred: array<string, array<string, mixed>>}
     */
    private static function moveToDeferred(array $groups, array $ids): array
    {
        $immediate = $groups['immediate'] ?? [];
        $deferred = $groups['deferred'] ?? [];

        foreach ($ids as $id) {
            if (! isset($immediate[$id])) {
                continue;
            }
            $deferred[$id] = $immediate[$id];
            unset($immediate[$id]);
        }

        uasort($immediate, static fn (array $a, array $b): int => ($a['priority'] ?? 100) <=> ($b['priority'] ?? 100));
        uasort($deferred, static fn (array $a, array $b): int => ($a['priority'] ?? 100) <=> ($b['priority'] ?? 100));

        return [
            'immediate' => $immediate,
            'deferred' => $deferred,
        ];
    }
}
