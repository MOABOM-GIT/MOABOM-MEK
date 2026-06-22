<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services;

/**
 * Ghost shell / template-routes-shell API — DB routes.json 동기화 지연 시에도
 * 셸 윈도우(에러·게시판) URL 이 G7 Router 에 매칭되도록 필수 경로를 보강한다.
 */
final class MoabomShellEssentialRoutes
{
    /**
     * @return list<array<string, mixed>>
     */
    public static function definitions(): array
    {
        return [
            [
                'path' => '/board/:slug',
                'layout' => 'home',
                'auth_required' => false,
                'meta' => ['title' => '게시판'],
            ],
            [
                'path' => '/board/:slug/write',
                'layout' => 'home',
                'auth_required' => false,
                'meta' => ['title' => '게시글 작성'],
            ],
            [
                'path' => '/board/:slug/:id',
                'layout' => 'home',
                'auth_required' => false,
                'meta' => ['title' => '게시글'],
            ],
            [
                'path' => '/board/:slug/:id/edit',
                'layout' => 'home',
                'auth_required' => false,
                'meta' => ['title' => '게시글 수정'],
            ],
            [
                'path' => '/404',
                'layout' => 'home',
                'auth_required' => false,
                'meta' => ['title' => '페이지를 찾을 수 없습니다'],
            ],
            [
                'path' => '/403',
                'layout' => 'home',
                'auth_required' => false,
                'meta' => ['title' => '접근 권한이 없습니다'],
            ],
            [
                'path' => '/500',
                'layout' => 'home',
                'auth_required' => false,
                'meta' => ['title' => '서버 오류'],
            ],
            [
                'path' => '/503',
                'layout' => 'home',
                'auth_required' => false,
                'meta' => ['title' => '서비스 점검'],
            ],
            [
                'path' => '/maintenance',
                'layout' => 'home',
                'auth_required' => false,
                'meta' => ['title' => '점검 중'],
            ],
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $routes
     * @return array<int, array<string, mixed>>
     */
    public static function mergeInto(array $routes, string $templateIdentifier): array
    {
        if ($templateIdentifier !== 'moabom-basic') {
            return $routes;
        }

        $existing = [];
        foreach ($routes as $route) {
            if (! is_array($route)) {
                continue;
            }
            $path = $route['path'] ?? null;
            if (is_string($path) && $path !== '') {
                $existing[$path] = true;
            }
        }

        $merged = $routes;
        foreach (self::definitions() as $essential) {
            $path = $essential['path'];
            if (! isset($existing[$path])) {
                $merged[] = $essential;
                $existing[$path] = true;
            }
        }

        return $merged;
    }
}
