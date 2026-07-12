<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use Illuminate\Support\Arr;
use Modules\Moabom\System\Models\UserSystemSetting;

/**
 * 생성앱 삭제 시 user settings 의 shell.home order/recent/unpinned 잔존 ID 제거.
 * 프론트 PUT 실패·다기기 pull 재주입으로 GET …/generated/{id} 404 가 재발하지 않게 한다.
 */
final class MoabomShellHomeAppOrderPruner
{
    public function pruneForUser(int $userId, int $generatedAppId): bool
    {
        if ($userId <= 0 || $generatedAppId <= 0) {
            return false;
        }

        $appId = 'generated-app-'.$generatedAppId;
        $row = UserSystemSetting::query()->where('user_id', $userId)->first();
        if ($row === null) {
            return false;
        }

        /** @var array<string, mixed> $settings */
        $settings = Arr::wrap($row->settings);
        $home = Arr::get($settings, 'shell.home');
        if (! is_array($home)) {
            return false;
        }

        $changed = false;

        foreach (['mainAppOrder', 'recentAppIds', 'mainUnpinnedGeneratedIds'] as $key) {
            $list = $home[$key] ?? null;
            if (! is_array($list)) {
                continue;
            }
            $filtered = array_values(array_filter(
                $list,
                static fn ($id): bool => ! is_string($id) || $id !== $appId,
            ));
            if (count($filtered) !== count($list)) {
                $home[$key] = $filtered;
                $changed = true;
            }
        }

        if (! $changed) {
            return false;
        }

        Arr::set($settings, 'shell.home', $home);
        $row->settings = $settings;
        $row->save();

        return true;
    }
}
