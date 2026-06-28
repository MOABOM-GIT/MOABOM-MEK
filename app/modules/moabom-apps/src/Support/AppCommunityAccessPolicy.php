<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Support;

use Modules\Moabom\Apps\Models\GeneratedApp;

/**
 * 앱 이야기 열람·작성 권한 SSOT.
 */
final class AppCommunityAccessPolicy
{
    public static function canRead(?int $viewerUserId, GeneratedApp $app): bool
    {
        if ($viewerUserId !== null && (int) $app->user_id === $viewerUserId) {
            return true;
        }

        if (! GeneratedAppPublishPolicy::isPublished($app)) {
            return false;
        }

        return GeneratedAppPublishPolicy::viewerCanSeePublished($app);
    }

    public static function canWrite(?int $viewerUserId, GeneratedApp $app): bool
    {
        if ($viewerUserId === null) {
            return false;
        }

        if (! self::canRead($viewerUserId, $app)) {
            return false;
        }

        if ((int) $app->user_id === $viewerUserId) {
            return true;
        }

        return GeneratedAppPublishPolicy::isPublished($app)
            && GeneratedAppPublishPolicy::viewerCanSeePublished($app);
    }
}
