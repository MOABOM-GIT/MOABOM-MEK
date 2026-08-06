<?php

namespace Modules\Moabom\Apps\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Support\GeneratedAppPreviewRouting;
use Modules\Moabom\Apps\Support\GeneratedAppPublishPolicy;

class GeneratedAppRepository implements GeneratedAppRepositoryInterface
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): GeneratedApp
    {
        if (GeneratedAppsConnection::usesPlatformStore() && ! array_key_exists('tenant_slug', $data)) {
            $data['tenant_slug'] = GeneratedAppsConnection::tenantSlugForWrite();
        }

        return GeneratedAppsConnection::apps()->create($data);
    }

    /**
     * @return Collection<int, GeneratedApp>
     */
    public function getForUser(int $userId, int $limit = 100): Collection
    {
        $query = GeneratedAppsConnection::apps()
            ->where('user_id', $userId)
            ->latest()
            ->limit($limit);

        $this->scopeTenant($query);
        $this->eagerUser($query);

        return $query->get();
    }

    public function countForUser(int $userId): int
    {
        $query = GeneratedAppsConnection::apps()->where('user_id', $userId);
        $this->scopeTenant($query);

        return (int) $query->count();
    }

    /**
     * @return Collection<int, GeneratedApp>
     */
    public function getPublished(int $limit = 50): Collection
    {
        $query = GeneratedAppsConnection::apps()->latest()->limit($limit);

        GeneratedAppPublishPolicy::applyPublishedCatalogScope($query);
        $this->eagerUser($query);

        return $query->get();
    }

    public function paginatePublishedForUser(int $userId, int $perPage = 20): LengthAwarePaginator
    {
        $query = GeneratedAppsConnection::apps()
            ->where('user_id', $userId)
            ->latest();

        GeneratedAppPublishPolicy::applyPublishedCatalogScope($query);
        $this->eagerUser($query);

        return $query->paginate($perPage);
    }

    public function findForUser(int $userId, int $id): ?GeneratedApp
    {
        $query = GeneratedAppsConnection::apps()
            ->where('user_id', $userId)
            ->whereKey($id);

        $this->scopeTenant($query);
        $this->eagerUser($query);

        return $query->first();
    }

    /**
     * 로그인 사용자가 열 수 있는 앱(본인 소유·등록된 앱)을 조회합니다.
     */
    public function findVisibleForUser(int $userId, int $id): ?GeneratedApp
    {
        $query = GeneratedAppsConnection::apps()
            ->whereKey($id)
            ->where(function ($inner) use ($userId): void {
                $inner->where(function ($owned) use ($userId): void {
                    $this->scopeOwnedForViewer($owned, $userId);
                })->orWhere(function ($published): void {
                    GeneratedAppPublishPolicy::applyPublishedCatalogScope($published);
                });
            });

        $this->eagerUser($query);

        $app = $query->first();
        if ($app !== null) {
            return $app;
        }

        return null;
    }

    public function findPublished(int $id): ?GeneratedApp
    {
        $query = GeneratedAppsConnection::apps()->whereKey($id);

        GeneratedAppPublishPolicy::applyPublishedCatalogScope($query);
        $this->eagerUser($query);

        return $query->first();
    }

    public function findById(int $id): ?GeneratedApp
    {
        $query = GeneratedAppsConnection::apps()->whereKey($id);
        $this->eagerUser($query);

        return $query->first();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(GeneratedApp $app, array $data): GeneratedApp
    {
        $app->update($data);

        return $app->fresh() ?? $app;
    }

    public function delete(GeneratedApp $app): void
    {
        $app->delete();
    }

    /** @deprecated use getPublished() */
    public function getShared(int $limit = 50): Collection
    {
        return $this->getPublished($limit);
    }

    /** @deprecated use findPublished() */
    public function findShared(int $id): ?GeneratedApp
    {
        return $this->findPublished($id);
    }

    /**
     * @param  Builder<GeneratedApp>  $query
     */
    private function scopeTenant($query): void
    {
        GeneratedAppsConnection::scopeToCurrentTenant($query);
    }

    /**
     * 열람·리뷰 등 단건 접근 — 소유자는 플랫폼·전용 프리뷰 host 에서도 tenant_slug 불일치 허용.
     *
     * @param  Builder<GeneratedApp>  $query
     */
    private function scopeOwnedForViewer($query, int $userId): void
    {
        $query->where('user_id', $userId);

        if (! GeneratedAppsConnection::usesPlatformStore()) {
            return;
        }

        $slug = GeneratedAppPreviewRouting::tenantScopeKey();
        if ($slug === 'unknown') {
            $query->whereRaw('1 = 0');

            return;
        }

        if ($slug === 'platform' || GeneratedAppPreviewRouting::isDedicatedPreviewHostRequest()) {
            return;
        }

        $query->where('tenant_slug', $slug);
    }

    /**
     * @param  Builder<GeneratedApp>  $query
     */
    private function eagerUser($query): void
    {
        if (! GeneratedAppsConnection::usesPlatformStore()) {
            $query->with('user');
        }
    }
}
