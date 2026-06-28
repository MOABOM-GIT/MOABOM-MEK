<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Modules\Moabom\Apps\Models\AppCommunityPost;

interface AppCommunityPostRepositoryInterface
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): AppCommunityPost;

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(AppCommunityPost $post, array $data): AppCommunityPost;

    public function delete(AppCommunityPost $post): void;

    public function hardDeleteByAppId(int $generatedAppId): void;

    public function findById(int $id): ?AppCommunityPost;

    public function findActiveReviewForUser(int $generatedAppId, int $userId): ?AppCommunityPost;

    public function findReviewForUser(int $generatedAppId, int $userId, bool $withTrashed = false): ?AppCommunityPost;

    /**
     * @return LengthAwarePaginator<AppCommunityPost>
     */
    public function paginatePublishedForApp(int $generatedAppId, int $perPage = 20): LengthAwarePaginator;

    public function findPublishedForApp(int $generatedAppId, int $postId): ?AppCommunityPost;

    /**
     * @param  array<string, mixed>  $filters
     * @return array{items: Collection<int, AppCommunityPost>, total: int, diagnostics: array<string, mixed>}
     */
    public function adminList(array $filters, ?string $tenantSlugScope, int $limit = 200): array;

    /**
     * @return array{rating_avg: ?float, rating_count: int, post_count: int}
     */
    public function aggregatePublishedStats(int $generatedAppId): array;
}
