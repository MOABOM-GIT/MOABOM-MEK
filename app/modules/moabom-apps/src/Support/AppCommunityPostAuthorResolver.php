<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Support;

use App\Models\User;
use Illuminate\Support\Collection;
use Modules\Moabom\Apps\Models\AppCommunityPost;
use Modules\Moabom\System\Saas\SaasMysqlPdoFactory;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRegistry;

/**
 * platform DB 앱 이야기 글 → tenant_slug(작성자 tenant) 기준 users DB에서 작성자 조회.
 */
final class AppCommunityPostAuthorResolver
{
    public function __construct(
        private readonly TenantRegistry $tenantRegistry,
        private readonly TenantDatabaseConfigurator $databaseConfigurator,
    ) {}

    public function nickname(AppCommunityPost $post): string
    {
        $nicknames = $this->nicknamesByPostId([$post]);

        return $nicknames[(int) $post->id] ?? '';
    }

    /**
     * @param  iterable<AppCommunityPost>  $posts
     * @return array<int, string> post id → nickname
     */
    public function nicknamesByPostId(iterable $posts): array
    {
        $postList = $posts instanceof Collection ? $posts->all() : [...$posts];
        if ($postList === []) {
            return [];
        }

        if (! GeneratedAppsConnection::usesPlatformStore()) {
            return $this->nicknamesFromSingleDatabase($postList);
        }

        /** @var array<string, list<int>> $userIdsBySlug */
        $userIdsBySlug = [];
        foreach ($postList as $post) {
            $slug = trim((string) ($post->tenant_slug ?? ''));
            $userIdsBySlug[$slug][] = (int) $post->user_id;
        }

        /** @var array<string, array<int, string>> $nicknameBySlugUser */
        $nicknameBySlugUser = [];
        foreach ($userIdsBySlug as $slug => $userIds) {
            $database = $this->resolveDatabaseForAuthorSlug($slug);
            if ($database === '') {
                continue;
            }

            $uniqueUserIds = array_values(array_unique(array_filter($userIds, static fn (int $id): bool => $id > 0)));
            if ($uniqueUserIds === []) {
                continue;
            }

            $users = $this->databaseConfigurator->runOnDatabase(
                $database,
                static fn (): Collection => User::query()->whereIn('id', $uniqueUserIds)->get()->keyBy('id'),
            );

            foreach ($uniqueUserIds as $userId) {
                $user = $users->get($userId);
                $nickname = trim((string) ($user?->nickname ?: ($user?->name ?: '')));
                $nicknameBySlugUser[$slug][$userId] = $nickname;
            }
        }

        $result = [];
        foreach ($postList as $post) {
            $slug = trim((string) ($post->tenant_slug ?? ''));
            $userId = (int) $post->user_id;
            $result[(int) $post->id] = $nicknameBySlugUser[$slug][$userId] ?? '';
        }

        return $result;
    }

    public function resolveUser(AppCommunityPost $post): ?User
    {
        if (! GeneratedAppsConnection::usesPlatformStore()) {
            return User::query()->whereKey((int) $post->user_id)->first();
        }

        $slug = trim((string) ($post->tenant_slug ?? ''));
        $database = $this->resolveDatabaseForAuthorSlug($slug);
        if ($database === '') {
            return null;
        }

        return $this->userFromDatabase($database, (int) $post->user_id);
    }

    /**
     * @param  list<AppCommunityPost>  $posts
     * @return array<int, string>
     */
    private function nicknamesFromSingleDatabase(array $posts): array
    {
        $userIds = array_values(array_unique(array_map(
            static fn (AppCommunityPost $post): int => (int) $post->user_id,
            $posts,
        )));

        $users = User::query()->whereIn('id', $userIds)->get()->keyBy('id');
        $result = [];
        foreach ($posts as $post) {
            $user = $users->get((int) $post->user_id);
            $nickname = trim((string) ($user?->nickname ?: ($user?->name ?: '')));
            $result[(int) $post->id] = $nickname;
        }

        return $result;
    }

    private function resolveDatabaseForAuthorSlug(string $slug): string
    {
        if (AppCommunityTenantScope::isMainDatabaseAuthorSlug($slug)) {
            return $this->mainWriteDatabase();
        }

        $tenant = $this->tenantRegistry->findBySlug($slug);
        if ($tenant === null) {
            return '';
        }

        return (string) $tenant->dbDatabase;
    }

    private function userFromDatabase(string $database, int $userId): ?User
    {
        if ($database === '' || $userId <= 0) {
            return null;
        }

        return $this->databaseConfigurator->runOnDatabase(
            $database,
            static fn (): ?User => User::query()->whereKey($userId)->first(),
        );
    }

    private function mainWriteDatabase(): string
    {
        $write = SaasMysqlPdoFactory::writeSlice();

        return (string) ($write['database'] ?? '');
    }
}
