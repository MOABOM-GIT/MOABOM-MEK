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
        return GeneratedApp::query()->create($data);
    }

    /**
     * 사용자의 최근 생성 앱 목록을 조회합니다.
     *
     * @return Collection<int, GeneratedApp>
     */
    public function getForUser(int $userId, int $limit = 20): Collection
    {
        return GeneratedApp::query()
            ->where('user_id', $userId)
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
            ->where('user_id', $userId)
            ->whereKey($id)
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

        return $app->fresh() ?? $app;
    }
}
