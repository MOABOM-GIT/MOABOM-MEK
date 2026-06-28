<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\Apps\Contracts\AppCommunityPostRepositoryInterface;
use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Enums\AppCommunityPostStatus;
use Modules\Moabom\Apps\Enums\AppCommunityPostType;
use Modules\Moabom\Apps\Models\AppCommunityPost;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Support\AppCommunityAccessPolicy;
use Modules\Moabom\Apps\Support\AppCommunityPostAuthorResolver;
use Modules\Moabom\Apps\Support\AppCommunityTenantScope;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * 앱 이야기 사용자 CRUD SSOT.
 */
class AppCommunityService
{
    public function __construct(
        private readonly GeneratedAppRepositoryInterface $appRepository,
        private readonly AppCommunityPostRepositoryInterface $postRepository,
        private readonly AppCommunityStatsService $statsService,
        private readonly AppCommunityPostAuthorResolver $authorResolver,
        private readonly GeneratedAppLineageService $lineageService,
        private readonly AppCommunityRevisionService $revisionService,
    ) {}

    public function resolveViewableApp(int $appId, ?int $viewerUserId): GeneratedApp
    {
        $app = $this->findAppForViewer($appId, $viewerUserId);
        if ($app === null || ! AppCommunityAccessPolicy::canRead($viewerUserId, $app)) {
            throw new NotFoundHttpException;
        }

        return $app;
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(int $appId, ?int $viewerUserId): array
    {
        $app = $this->resolveViewableApp($appId, $viewerUserId);

        $myReview = null;
        if ($viewerUserId !== null) {
            $review = $this->postRepository->findActiveReviewForUser($appId, $viewerUserId);
            if ($review !== null && $review->status === AppCommunityPostStatus::Published) {
                $myReview = [
                    'id' => (int) $review->id,
                    'rating' => (int) $review->rating,
                ];
            }
        }

        return [
            'rating_avg' => $app->community_rating_avg !== null ? (float) $app->community_rating_avg : null,
            'rating_count' => (int) ($app->community_rating_count ?? 0),
            'post_count' => (int) ($app->community_post_count ?? 0),
            'my_review' => $myReview,
            'creators' => $this->lineageService->creatorsForApp($appId),
        ];
    }

    /**
     * @return array{items: list<array<string, mixed>>, meta: array<string, mixed>}
     */
    public function listPosts(int $appId, ?int $viewerUserId, int $perPage = 20): array
    {
        $this->resolveViewableApp($appId, $viewerUserId);

        $paginator = $this->postRepository->paginatePublishedForApp($appId, $perPage);
        $posts = collect($paginator->items());
        $nicknames = $this->authorResolver->nicknamesByPostId($posts);

        return [
            'items' => $posts
                ->map(fn (AppCommunityPost $post): array => $this->serializePost(
                    $post,
                    $viewerUserId,
                    $nicknames[(int) $post->id] ?? null,
                ))
                ->values()
                ->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function showPost(int $appId, int $postId, ?int $viewerUserId): array
    {
        $this->resolveViewableApp($appId, $viewerUserId);

        $post = $this->postRepository->findPublishedForApp($appId, $postId);
        if ($post === null) {
            throw new NotFoundHttpException;
        }

        return $this->serializePost($post, $viewerUserId);
    }

    /**
     * @param  array{title: string, body: string, rating: int}  $data
     * @return array<string, mixed>
     */
    public function createReview(int $appId, int $userId, array $data): array
    {
        AppCommunityTenantScope::assertWritableAuthorTenant();
        $this->resolveWritableApp($appId, $userId);

        $existing = $this->postRepository->findReviewForUser($appId, $userId, true);
        if ($existing !== null && ! $existing->trashed()) {
            throw new ConflictHttpException(__('moabom-apps::messages.apps.community.review_exists'));
        }

        try {
            return $this->runCommunityMutation(function () use ($appId, $userId, $data, $existing): array {
                if ($existing !== null && $existing->trashed()) {
                    $existing->restore();
                    $post = $this->postRepository->update($existing, [
                        'rating' => $data['rating'],
                        'title' => $data['title'],
                        'body' => $data['body'],
                        'status' => AppCommunityPostStatus::Published->value,
                        'hidden_reason' => null,
                    ]);
                } else {
                    $post = $this->postRepository->create([
                        'generated_app_id' => $appId,
                        'user_id' => $userId,
                        'post_type' => AppCommunityPostType::Review->value,
                        'rating' => $data['rating'],
                        'title' => $data['title'],
                        'body' => $data['body'],
                        'status' => AppCommunityPostStatus::Published->value,
                    ]);
                }

                $this->statsService->recalculate($appId);
                $this->revisionService->bump($appId, 'review_created');

                return $this->serializePost($post, $userId);
            });
        } catch (QueryException $exception) {
            if ($this->isDuplicateReviewConstraint($exception)) {
                throw new ConflictHttpException(__('moabom-apps::messages.apps.community.review_exists'), $exception);
            }

            throw $exception;
        }
    }

    /**
     * @param  array{title: string, body: string, rating: int}  $data
     * @return array<string, mixed>
     */
    public function updateReview(int $appId, int $postId, int $userId, array $data): array
    {
        AppCommunityTenantScope::assertWritableAuthorTenant();
        $this->resolveWritableApp($appId, $userId);

        $post = $this->postRepository->findActiveReviewForUser($appId, $userId);
        if ($post === null || (int) $post->id !== $postId) {
            throw new NotFoundHttpException;
        }

        if ($post->status === AppCommunityPostStatus::Deleted) {
            throw new NotFoundHttpException;
        }

        return $this->runCommunityMutation(function () use ($appId, $post, $data, $userId): array {
            $updated = $this->postRepository->update($post, [
                'rating' => $data['rating'],
                'title' => $data['title'],
                'body' => $data['body'],
                'status' => AppCommunityPostStatus::Published->value,
                'hidden_reason' => null,
            ]);

            $this->statsService->recalculate($appId);
            $this->revisionService->bump($appId, 'review_updated');

            return $this->serializePost($updated, $userId);
        });
    }

    public function deleteReview(int $appId, int $postId, int $userId): void
    {
        $this->resolveWritableApp($appId, $userId);

        $post = $this->postRepository->findActiveReviewForUser($appId, $userId);
        if ($post === null || (int) $post->id !== $postId) {
            throw new NotFoundHttpException;
        }

        $this->runCommunityMutation(function () use ($appId, $post): void {
            $this->postRepository->update($post, [
                'status' => AppCommunityPostStatus::Deleted->value,
            ]);
            $this->postRepository->delete($post);
            $this->statsService->recalculate($appId);
            $this->revisionService->bump($appId, 'review_deleted');
        });
    }

    private function resolveWritableApp(int $appId, int $userId): GeneratedApp
    {
        $app = $this->findAppForViewer($appId, $userId);
        if ($app === null || ! AppCommunityAccessPolicy::canWrite($userId, $app)) {
            throw new NotFoundHttpException;
        }

        return $app;
    }

    private function findAppForViewer(int $appId, ?int $viewerUserId): ?GeneratedApp
    {
        if ($viewerUserId !== null) {
            return $this->appRepository->findVisibleForUser($viewerUserId, $appId);
        }

        return $this->appRepository->findPublished($appId);
    }

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    private function runCommunityMutation(callable $callback)
    {
        $connection = GeneratedAppsConnection::usesPlatformStore()
            ? GeneratedAppsConnection::NAME
            : config('database.default');

        return DB::connection($connection)->transaction($callback);
    }

    private function isDuplicateReviewConstraint(QueryException $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, 'moabom_app_comm_posts_app_tenant_user_type_uniq')
            || str_contains($message, 'moabom_app_comm_posts_app_user_type_uniq')
            || str_contains($message, 'unique constraint failed');
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePost(AppCommunityPost $post, ?int $viewerUserId, ?string $nicknameOverride = null): array
    {
        $nickname = $nicknameOverride ?? $this->authorResolver->nickname($post);
        if ($nickname === '') {
            $nickname = __('moabom-apps::messages.apps.generated.owner_unknown');
        }

        return [
            'id' => (int) $post->id,
            'generated_app_id' => (int) $post->generated_app_id,
            'post_type' => $post->post_type instanceof AppCommunityPostType
                ? $post->post_type->value
                : (string) $post->post_type,
            'rating' => $post->rating !== null ? (int) $post->rating : null,
            'title' => (string) $post->title,
            'body' => (string) $post->body,
            'author' => [
                'id' => (int) $post->user_id,
                'nickname' => $nickname,
            ],
            'is_mine' => $viewerUserId !== null
                && AppCommunityTenantScope::isPostAuthoredByViewer($post, $viewerUserId),
            'created_at' => $post->created_at?->toIso8601String(),
        ];
    }
}
