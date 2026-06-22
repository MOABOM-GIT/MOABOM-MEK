<?php

namespace Modules\Moabom\Apps\Contracts;

use Illuminate\Database\Eloquent\Collection;
use Modules\Moabom\Apps\Models\GeneratedApp;

interface GeneratedAppRepositoryInterface
{
    /**
     * 생성 앱을 저장합니다.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): GeneratedApp;

    /**
     * 사용자의 최근 생성 앱 목록을 조회합니다.
     *
     * @return Collection<int, GeneratedApp>
     */
    public function getForUser(int $userId, int $limit = 20): Collection;

    /**
     * 등록·공개된 생성 앱 목록을 조회합니다.
     *
     * @return Collection<int, GeneratedApp>
     */
    public function getPublished(int $limit = 50): Collection;

    /**
     * 사용자 소유의 생성 앱 1건을 조회합니다.
     */
    public function findForUser(int $userId, int $id): ?GeneratedApp;

    /**
     * 본인 앱이거나 등록·공개된 생성 앱 1건을 조회합니다.
     */
    public function findVisibleForUser(int $userId, int $id): ?GeneratedApp;

    /**
     * 등록·공개된 생성 앱 1건을 조회합니다.
     */
    public function findPublished(int $id): ?GeneratedApp;

    /**
     * @deprecated use getPublished()
     * @return Collection<int, GeneratedApp>
     */
    public function getShared(int $limit = 50): Collection;

    /**
     * @deprecated use findPublished()
     */
    public function findShared(int $id): ?GeneratedApp;

    /**
     * 생성 앱 ID로 1건을 조회합니다.
     */
    public function findById(int $id): ?GeneratedApp;

    /**
     * 생성 앱을 갱신하고 최신 인스턴스를 반환합니다.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(GeneratedApp $app, array $data): GeneratedApp;

    /**
     * 생성 앱을 삭제합니다.
     */
    public function delete(GeneratedApp $app): void;
}
