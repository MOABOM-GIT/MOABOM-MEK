<?php

namespace Modules\Moabom\Apps\Repositories;

use Illuminate\Database\Eloquent\Collection;
use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Models\GeneratedApp;

class GeneratedAppRepository implements GeneratedAppRepositoryInterface
{
    /**
     * 생성 앱을 저장합니다.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): GeneratedApp
    {
        return GeneratedApp::query()->create($data)->load('user');
    }

    /**
     * 사용자의 최근 생성 앱 목록을 조회합니다.
     *
     * @return Collection<int, GeneratedApp>
     */
    public function getForUser(int $userId, int $limit = 20): Collection
    {
        return GeneratedApp::query()
            ->with('user')
            ->where('user_id', $userId)
            ->latest()
            ->limit($limit)
            ->get();
    }

    /**
     * 공유 공개된 생성 앱 목록을 조회합니다.
     *
     * @return Collection<int, GeneratedApp>
     */
    public function getShared(int $limit = 50): Collection
    {
        return GeneratedApp::query()
            ->with('user')
            ->where('is_shared', true)
            ->latest()
            ->limit($limit)
            ->get();
    }

    /**
     * 사용자 소유의 생성 앱 1건을 조회합니다.
     */
    public function findForUser(int $userId, int $id): ?GeneratedApp
    {
        return GeneratedApp::query()
            ->with('user')
            ->where('user_id', $userId)
            ->whereKey($id)
            ->first();
    }

    /**
     * 본인 앱이거나 공유 공개된 생성 앱 1건을 조회합니다.
     */
    public function findVisibleForUser(int $userId, int $id): ?GeneratedApp
    {
        return GeneratedApp::query()
            ->with('user')
            ->whereKey($id)
            ->where(function ($query) use ($userId): void {
                $query->where('user_id', $userId)
                    ->orWhere('is_shared', true);
            })
            ->first();
    }

    /**
     * 공유 공개된 생성 앱 1건을 조회합니다.
     */
    public function findShared(int $id): ?GeneratedApp
    {
        return GeneratedApp::query()
            ->with('user')
            ->whereKey($id)
            ->where('is_shared', true)
            ->first();
    }

    /**
     * 생성 앱을 갱신하고 최신 인스턴스를 반환합니다.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(GeneratedApp $app, array $data): GeneratedApp
    {
        $app->update($data);

        return $app->fresh(['user']) ?? $app;
    }

    public function delete(GeneratedApp $app): void
    {
        $app->delete();
    }
}
