<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\Apps\Contracts\AppCommunityPostRepositoryInterface;
use Modules\Moabom\Apps\Enums\AppCommunityPostStatus;
use Modules\Moabom\Apps\Enums\AppCommunityPostType;
use Modules\Moabom\Apps\Models\AppCommunityPost;
use Modules\Moabom\Apps\Support\AppCommunityTenantScope;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;

class AppCommunityPostRepository implements AppCommunityPostRepositoryInterface
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): AppCommunityPost
    {
        if (GeneratedAppsConnection::usesPlatformStore()) {
            $data['tenant_slug'] = AppCommunityTenantScope::authorSlugForWrite();
        }

        return GeneratedAppsConnection::communityPosts()->create($data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(AppCommunityPost $post, array $data): AppCommunityPost
    {
        $post->update($data);

        return $post->fresh() ?? $post;
    }

    public function delete(AppCommunityPost $post): void
    {
        $post->delete();
    }

    public function hardDeleteByAppId(int $generatedAppId): void
    {
        GeneratedAppsConnection::communityPosts()
            ->withTrashed()
            ->where('generated_app_id', $generatedAppId)
            ->each(static function (AppCommunityPost $post): void {
                $post->forceDelete();
            });
    }

    public function findById(int $id): ?AppCommunityPost
    {
        return $this->baseQuery()
            ->with(['generatedApp'])
            ->whereKey($id)
            ->first();
    }

    public function findActiveReviewForUser(int $generatedAppId, int $userId): ?AppCommunityPost
    {
        return $this->findReviewForUser($generatedAppId, $userId, false);
    }

    public function findReviewForUser(int $generatedAppId, int $userId, bool $withTrashed = false): ?AppCommunityPost
    {
        $query = AppCommunityTenantScope::applyAuthorTenant(
            $this->baseQuery()
                ->where('generated_app_id', $generatedAppId)
                ->where('user_id', $userId)
                ->where('post_type', AppCommunityPostType::Review->value),
        );

        if ($withTrashed) {
            $query->withTrashed();
        } else {
            $query->whereNull('deleted_at');
        }

        return $query->first();
    }

    public function paginatePublishedForApp(int $generatedAppId, int $perPage = 20): LengthAwarePaginator
    {
        $perPage = max(1, min(50, $perPage));

        return $this->publishedQuery($generatedAppId)
            ->latest('created_at')
            ->paginate($perPage);
    }

    public function findPublishedForApp(int $generatedAppId, int $postId): ?AppCommunityPost
    {
        return $this->publishedQuery($generatedAppId)
            ->whereKey($postId)
            ->first();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{items: Collection<int, AppCommunityPost>, total: int}
     */
    public function adminList(array $filters, ?string $tenantSlugScope, int $limit = 200): array
    {
        $query = $this->baseQuery()
            ->with(['generatedApp'])
            ->latest('created_at');

        $this->applyAdminScopeFilters($query, $tenantSlugScope, $filters);

        $appId = (int) ($filters['generated_app_id'] ?? 0);
        if ($appId > 0) {
            $query->where('generated_app_id', $appId);
        }

        $userId = (int) ($filters['user_id'] ?? 0);
        if ($userId > 0) {
            $query->where('user_id', $userId);
        }

        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '' && AppCommunityPostStatus::tryFrom($status) !== null) {
            $query->where('status', $status);
        }

        $rating = (int) ($filters['rating'] ?? 0);
        if ($rating >= 1 && $rating <= 5) {
            $query->where('rating', $rating);
        }

        $search = trim((string) ($filters['q'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $inner) use ($search): void {
                $inner->where('title', 'like', '%'.$search.'%')
                    ->orWhere('body', 'like', '%'.$search.'%');
            });
        }

        $createdFrom = trim((string) ($filters['created_from'] ?? ''));
        if ($createdFrom !== '') {
            $query->whereDate('created_at', '>=', $createdFrom);
        }

        $createdTo = trim((string) ($filters['created_to'] ?? ''));
        if ($createdTo !== '') {
            $query->whereDate('created_at', '<=', $createdTo);
        }

        $limit = max(1, min(500, $limit));
        $total = (clone $query)->count();
        $items = $query->limit($limit)->get();

        return [
            'items' => $items,
            'total' => $total,
        ];
    }

    /**
     * @return array{rating_avg: ?float, rating_count: int, post_count: int}
     */
    public function aggregatePublishedStats(int $generatedAppId): array
    {
        $connection = GeneratedAppsConnection::usesPlatformStore()
            ? GeneratedAppsConnection::NAME
            : config('database.default');

        $row = DB::connection($connection)
            ->table('moabom_app_community_posts')
            ->where('generated_app_id', $generatedAppId)
            ->where('status', AppCommunityPostStatus::Published->value)
            ->whereNull('deleted_at')
            ->selectRaw('COUNT(*) as post_count')
            ->selectRaw('COUNT(rating) as rating_count')
            ->selectRaw('AVG(rating) as rating_avg')
            ->first();

        $postCount = (int) ($row->post_count ?? 0);
        $ratingCount = (int) ($row->rating_count ?? 0);
        $ratingAvg = $ratingCount > 0
            ? round((float) ($row->rating_avg ?? 0), 2)
            : null;

        return [
            'rating_avg' => $ratingAvg,
            'rating_count' => $ratingCount,
            'post_count' => $postCount,
        ];
    }

    /**
     * Admin scope — 앱 소유 tenant(생성앱 admin 과 동일) · 작성자 tenant 분리.
     *
     * @param  array<string, mixed>  $filters
     * @param  Builder<AppCommunityPost>  $query
     */
    private function applyAdminScopeFilters(Builder $query, ?string $tenantSlugScope, array $filters): void
    {
        $appOwnerTenant = trim((string) ($filters['tenant_slug'] ?? ''));
        $authorTenant = trim((string) ($filters['author_tenant_slug'] ?? ''));

        $ownerTenant = ($tenantSlugScope !== null && $tenantSlugScope !== '')
            ? $tenantSlugScope
            : ($appOwnerTenant !== '' ? $appOwnerTenant : null);

        if ($ownerTenant !== null) {
            // whereHas(generatedApp)는 Eloquent 기본 connection(tenant DB)을 탈 수 있어
            // platform plane 글·앱과 split-brain이 생긴다. apps() subquery로 같은 DB plane에서 필터한다.
            $appIds = GeneratedAppsConnection::apps()
                ->select('id')
                ->where('tenant_slug', $ownerTenant)
                ->toBase();

            $query->whereIn('generated_app_id', $appIds);
        }

        if ($authorTenant !== '') {
            $query->where('tenant_slug', $authorTenant);
        }
    }

    /**
     * @return Builder<AppCommunityPost>
     */
    private function baseQuery(): Builder
    {
        return GeneratedAppsConnection::communityPosts();
    }

    /**
     * @return Builder<AppCommunityPost>
     */
    private function publishedQuery(int $generatedAppId): Builder
    {
        return $this->baseQuery()
            ->where('generated_app_id', $generatedAppId)
            ->where('status', AppCommunityPostStatus::Published->value)
            ->whereNull('deleted_at');
    }
}
