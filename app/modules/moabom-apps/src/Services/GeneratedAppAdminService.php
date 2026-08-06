<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use App\Enums\UserStatus;
use Illuminate\Support\Collection;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Repositories\GeneratedAppRepository;
use Modules\Moabom\Apps\Support\GeneratedAppAdminScope;
use Modules\Moabom\Apps\Support\GeneratedAppOwnerSnapshot;
use Modules\Moabom\Apps\Support\GeneratedAppPublishPolicy;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * 생성앱 admin 목록·공개범위 변경 SSOT.
 */
class GeneratedAppAdminService
{
    private const DEFAULT_LIMIT = 200;

    private const MAX_LIMIT = 500;

    public function __construct(
        private readonly GeneratedAppRepository $appRepository,
        private readonly GeneratedAppOwnerSnapshot $ownerSnapshot,
        private readonly GeneratedAppPreviewService $previewService,
    ) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return array{items: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function list(GeneratedAppAdminScope $scope, array $filters = []): array
    {
        $query = GeneratedAppsConnection::apps()->latest('updated_at');
        $scope->applyToQuery($query);

        $tenantSlug = $scope->resolveFilterTenantSlug(
            isset($filters['tenant_slug']) ? (string) $filters['tenant_slug'] : null,
        );
        if ($tenantSlug !== null) {
            $query->where('tenant_slug', $tenantSlug);
        }

        $visibility = trim((string) ($filters['visibility'] ?? ''));
        if ($visibility !== '' && GeneratedAppVisibility::tryFrom($visibility) !== null) {
            $query->where('visibility', $visibility);
        }

        $tier = trim((string) ($filters['tier'] ?? ''));
        if ($tier !== '') {
            $query->where('tier', $tier);
        }

        $search = trim((string) ($filters['q'] ?? ''));
        if ($search !== '') {
            $query->where('title', 'like', '%'.$search.'%');
        }

        $limit = (int) ($filters['limit'] ?? self::DEFAULT_LIMIT);
        $limit = max(1, min(self::MAX_LIMIT, $limit));

        /** @var Collection<int, GeneratedApp> $apps */
        $apps = $query->limit($limit)->get();

        $ownerWithdrawnOnly = filter_var($filters['owner_withdrawn'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($ownerWithdrawnOnly) {
            $apps = $apps->filter(function (GeneratedApp $app): bool {
                $owner = $this->ownerSnapshot->forApp($app);

                return ($owner['status'] ?? '') === UserStatus::Withdrawn->value;
            })->values();
        }

        $items = $apps
            ->map(fn (GeneratedApp $app): array => $this->serializeApp($app))
            ->values()
            ->all();

        return [
            'items' => $items,
            'meta' => array_merge($scope->listMeta(), [
                'total' => count($items),
            ]),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function show(GeneratedApp $app, GeneratedAppAdminScope $scope): array
    {
        $scope->assertCanManage($app);

        return $this->serializeApp($app);
    }

    public function setVisibility(
        GeneratedApp $app,
        GeneratedAppAdminScope $scope,
        GeneratedAppVisibility $visibility,
    ): GeneratedApp {
        $scope->assertCanManage($app);

        return $this->appRepository->update($app, [
            'visibility' => $visibility->value,
            'is_shared' => $visibility->isPublished(),
        ]);
    }

    public function findManagedOrFail(int $id, GeneratedAppAdminScope $scope): GeneratedApp
    {
        $query = GeneratedAppsConnection::apps()->whereKey($id);
        $scope->applyToQuery($query);

        $app = $query->first();
        if ($app === null) {
            throw new NotFoundHttpException;
        }

        return $app;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeApp(GeneratedApp $app): array
    {
        $visibility = GeneratedAppPublishPolicy::visibilityOf($app);

        return [
            'id' => (int) $app->id,
            'title' => (string) ($app->title ?? ''),
            'tenant_slug' => (string) ($app->tenant_slug ?? ''),
            'tier' => (string) ($app->tier ?? ''),
            'app_type' => (string) ($app->app_type ?? ''),
            'version' => (int) ($app->version ?? 1),
            'visibility' => $visibility->value,
            'owner' => $this->ownerSnapshot->forApp($app),
            'parent_app_id' => $app->parent_app_id !== null ? (int) $app->parent_app_id : null,
            'is_fork' => $app->parent_app_id !== null,
            'created_at' => $app->created_at?->toIso8601String(),
            'updated_at' => $app->updated_at?->toIso8601String(),
            // 비공개 html_paste·AI 앱도 admin 미리보기가 가능하도록 viewer 토큰을 붙인다.
            // website_link 는 PreviewService 가 metadata.website_url 로 분기한다.
            'preview_url' => $this->previewService->buildPreviewUrl($app, $this->viewerUserId()),
            'community_rating_avg' => $app->community_rating_avg !== null
                ? (float) $app->community_rating_avg
                : null,
            'community_rating_count' => (int) ($app->community_rating_count ?? 0),
            'community_post_count' => (int) ($app->community_post_count ?? 0),
        ];
    }

    private function viewerUserId(): ?int
    {
        $id = auth()->id();

        return is_numeric($id) && (int) $id > 0 ? (int) $id : null;
    }
}
