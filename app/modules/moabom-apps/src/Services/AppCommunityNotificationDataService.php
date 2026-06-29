<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use App\Models\User;
use Modules\Moabom\Apps\Models\AppCommunityPost;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Support\AppCommunityPostAuthorResolver;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Support\GeneratedAppOwnerResolver;

/**
 * 앱 리뷰 알림용 데이터 추출기.
 */
final class AppCommunityNotificationDataService
{
    public function __construct(
        private readonly GeneratedAppOwnerResolver $ownerResolver,
        private readonly AppCommunityPostAuthorResolver $authorResolver,
    ) {}

    /**
     * @param  array<string, mixed>  $default
     * @param  array<int, mixed>  $args
     * @return array{notifiable: null, notifiables: list<User>|null, data: array<string, mixed>, context: array<string, mixed>}
     */
    public function extractData(array $default, string $type, array $args): array
    {
        if ($type !== 'app_review_created') {
            return $default;
        }

        $post = $args[0] ?? null;
        $app = $args[1] ?? null;
        if (! $post instanceof AppCommunityPost || ! $app instanceof GeneratedApp) {
            return $this->emptyResult();
        }

        $owner = $this->ownerResolver->resolveUser($app);
        if ($owner === null) {
            return $this->emptyResult();
        }

        $reviewer = $this->authorResolver->resolveUser($post);
        if ($this->isSameUser($owner, $reviewer)) {
            return $this->emptyResult();
        }

        $reviewerName = trim($this->authorResolver->nickname($post));
        if ($reviewerName === '') {
            $reviewerName = __('moabom-apps::messages.apps.generated.owner_unknown');
        }

        $appTitle = trim((string) $app->title);
        $reviewTitle = trim((string) $post->title);

        return [
            'notifiable' => null,
            'notifiables' => [$owner],
            'data' => [
                'name' => '{recipient_name}',
                'app_name' => config('app.name'),
                'app_title' => $appTitle !== '' ? $appTitle : __('moabom-apps::messages.apps.generated.untitled_app'),
                'review_author' => $reviewerName,
                'review_title' => $reviewTitle,
                'review_body' => $this->truncateText((string) $post->body),
                'app_url' => $this->buildAppUrl((int) $app->id),
                'site_url' => config('app.url'),
            ],
            'context' => [
                'trigger_user_id' => (int) $post->user_id,
                'trigger_user' => $reviewer,
                'related_users' => [
                    'app_owner' => $owner,
                ],
            ],
        ];
    }

    private function isSameUser(User $owner, ?User $reviewer): bool
    {
        if ($reviewer === null) {
            return false;
        }

        $ownerUuid = trim((string) ($owner->uuid ?? ''));
        $reviewerUuid = trim((string) ($reviewer->uuid ?? ''));
        if ($ownerUuid !== '' && $reviewerUuid !== '') {
            return $ownerUuid === $reviewerUuid;
        }

        if (! GeneratedAppsConnection::usesPlatformStore()) {
            return (int) $owner->id === (int) $reviewer->id;
        }

        return $owner->getConnectionName() === $reviewer->getConnectionName()
            && (int) $owner->id === (int) $reviewer->id;
    }

    /**
     * @return array{notifiable: null, notifiables: null, data: array<string, mixed>, context: array<string, mixed>}
     */
    private function emptyResult(): array
    {
        return ['notifiable' => null, 'notifiables' => null, 'data' => [], 'context' => ['skip' => true]];
    }

    private function truncateText(string $value): string
    {
        $text = trim(strip_tags($value));

        return mb_strlen($text) > 160 ? mb_substr($text, 0, 160).'...' : $text;
    }

    private function buildAppUrl(int $appId): string
    {
        return rtrim((string) config('app.url'), '/').'/app/generated-app-'.$appId;
    }
}
