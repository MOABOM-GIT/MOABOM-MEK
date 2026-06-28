<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use Modules\Moabom\Apps\Contracts\AppCommunityPostRepositoryInterface;
use Modules\Moabom\Apps\Enums\AppCommunityHiddenReason;
use Modules\Moabom\Apps\Enums\AppCommunityPostStatus;
use Modules\Moabom\Apps\Models\AppCommunityPost;
use Modules\Moabom\Apps\Support\AppCommunityPostAuthorResolver;
use Modules\Moabom\Apps\Support\GeneratedAppAdminScope;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * 앱 이야기 admin 목록·상태 변경 SSOT.
 */
class AppCommunityAdminService
{
    private const DEFAULT_LIMIT = 200;

    private const MAX_LIMIT = 500;

    public function __construct(
        private readonly AppCommunityPostRepositoryInterface $postRepository,
        private readonly AppCommunityStatsService $statsService,
        private readonly AppCommunityPostAuthorResolver $authorResolver,
        private readonly AppCommunityRevisionService $revisionService,
    ) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return array{items: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function list(GeneratedAppAdminScope $scope, array $filters = []): array
    {
        $tenantSlug = $scope->resolveFilterTenantSlug(
            isset($filters['tenant_slug']) ? (string) $filters['tenant_slug'] : null,
        );
        $limit = $this->resolveLimit($filters);

        $result = $this->postRepository->adminList(
            $filters,
            $scope->isPlatform() ? $tenantSlug : $scope->tenantSlug,
            $limit,
        );

        $items = $result['items'];
        $nicknames = $this->authorResolver->nicknamesByPostId($items);

        $serialized = $items
            ->map(fn (AppCommunityPost $post): array => $this->serializePost(
                $post,
                $nicknames[(int) $post->id] ?? null,
            ))
            ->values()
            ->all();

        return [
            'items' => $serialized,
            'meta' => array_merge($scope->listMeta(), [
                'total' => $result['total'],
                'applied_filters' => $this->appliedFilters($scope, $filters, $tenantSlug, $limit),
                'filter_semantics' => [
                    'tenant_slug' => 'generated_app_owner_tenant',
                    'author_tenant_slug' => 'post_author_tenant',
                ],
            ]),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function show(int $id, GeneratedAppAdminScope $scope): array
    {
        $post = $this->findManagedOrFail($id, $scope);

        return $this->serializePost($post);
    }

    public function updateStatus(
        int $id,
        GeneratedAppAdminScope $scope,
        AppCommunityPostStatus $status,
        ?AppCommunityHiddenReason $hiddenReason = null,
    ): array {
        $post = $this->findManagedOrFail($id, $scope);

        $payload = ['status' => $status->value];
        if ($status === AppCommunityPostStatus::Hidden) {
            $payload['hidden_reason'] = ($hiddenReason ?? AppCommunityHiddenReason::Admin)->value;
        } else {
            $payload['hidden_reason'] = null;
        }

        $updated = $this->postRepository->update($post, $payload);
        $appId = (int) $updated->generated_app_id;
        $this->statsService->recalculate($appId);
        $this->revisionService->bump($appId, 'admin_status_'.$status->value);

        return $this->serializePost($updated->load('generatedApp'));
    }

    public function destroy(int $id, GeneratedAppAdminScope $scope): void
    {
        $post = $this->findManagedOrFail($id, $scope);
        $appId = (int) $post->generated_app_id;

        $this->postRepository->update($post, [
            'status' => AppCommunityPostStatus::Deleted->value,
        ]);
        $this->postRepository->delete($post);
        $this->statsService->recalculate($appId);
        $this->revisionService->bump($appId, 'admin_deleted');
    }

    public function findManagedOrFail(int $id, GeneratedAppAdminScope $scope): AppCommunityPost
    {
        $post = $this->postRepository->findById($id);
        if ($post === null) {
            throw new NotFoundHttpException;
        }

        if ($scope->mode === GeneratedAppAdminScope::MODE_TENANT) {
            if ($scope->tenantSlug === null || trim($scope->tenantSlug) === '') {
                throw new NotFoundHttpException;
            }
            $post->loadMissing('generatedApp');
            $appTenantSlug = trim((string) ($post->generatedApp?->tenant_slug ?? ''));
            if ($appTenantSlug !== $scope->tenantSlug) {
                throw new NotFoundHttpException;
            }
        }

        return $post;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function appliedFilters(
        GeneratedAppAdminScope $scope,
        array $filters,
        ?string $resolvedTenantSlug,
        int $limit,
    ): array {
        $appId = (int) ($filters['generated_app_id'] ?? 0);
        $userId = (int) ($filters['user_id'] ?? 0);
        $rating = (int) ($filters['rating'] ?? 0);
        $status = trim((string) ($filters['status'] ?? ''));

        return [
            'generated_app_id' => $appId > 0 ? $appId : null,
            'user_id' => $userId > 0 ? $userId : null,
            'app_owner_tenant_slug' => $scope->isPlatform() ? $resolvedTenantSlug : $scope->tenantSlug,
            'app_owner_tenant_locked' => ! $scope->isPlatform(),
            'author_tenant_slug' => $this->nonEmptyString($filters['author_tenant_slug'] ?? null),
            'status' => AppCommunityPostStatus::tryFrom($status) !== null ? $status : null,
            'rating' => $rating >= 1 && $rating <= 5 ? $rating : null,
            'q' => $this->nonEmptyString($filters['q'] ?? null),
            'created_from' => $this->nonEmptyString($filters['created_from'] ?? null),
            'created_to' => $this->nonEmptyString($filters['created_to'] ?? null),
            'limit' => $limit,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function resolveLimit(array $filters): int
    {
        $limit = (int) ($filters['limit'] ?? self::DEFAULT_LIMIT);

        return max(1, min(self::MAX_LIMIT, $limit));
    }

    private function nonEmptyString(mixed $value): ?string
    {
        $string = trim((string) ($value ?? ''));

        return $string !== '' ? $string : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePost(AppCommunityPost $post, ?string $nicknameOverride = null): array
    {
        $nickname = $nicknameOverride ?? $this->authorResolver->nickname($post);
        if ($nickname === '') {
            $nickname = __('moabom-apps::messages.apps.generated.owner_unknown');
        }

        return [
            'id' => (int) $post->id,
            'generated_app_id' => (int) $post->generated_app_id,
            'generated_app_title' => (string) ($post->generatedApp?->title ?? ''),
            'generated_app_tenant_slug' => (string) ($post->generatedApp?->tenant_slug ?? ''),
            'tenant_slug' => (string) ($post->tenant_slug ?? ''),
            'post_type' => $post->post_type instanceof \Modules\Moabom\Apps\Enums\AppCommunityPostType
                ? $post->post_type->value
                : (string) $post->post_type,
            'rating' => $post->rating !== null ? (int) $post->rating : null,
            'title' => (string) $post->title,
            'body' => (string) $post->body,
            'status' => $post->status instanceof AppCommunityPostStatus
                ? $post->status->value
                : (string) $post->status,
            'hidden_reason' => $post->hidden_reason,
            'author' => [
                'id' => (int) $post->user_id,
                'nickname' => $nickname,
            ],
            'created_at' => $post->created_at?->toIso8601String(),
            'updated_at' => $post->updated_at?->toIso8601String(),
        ];
    }
}
