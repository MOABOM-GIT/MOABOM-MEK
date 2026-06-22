<?php

namespace Plugins\Moabom\Pwa\Services;

use Illuminate\Support\Facades\Cache;

/**
 * PWA Service Worker 버전 리졸버.
 *
 * `moabom-basic` 템플릿의 dist 산출물 + 활성 플러그인 dist(`plugins/* /dist/** `) 의 mtime 집합을 입력으로 하여
 * 결정적 버전 문자열을 산출한다. 파일이 하나라도 갱신되면 결과 문자열이
 * 단조 변경되며, 동일 입력에 대해 동일 출력을 보장한다(Req 4.3/4.4).
 *
 * Spec: `.kiro/specs/moabom-pwa-service-worker/` Req 4 · Design §4.6 ·
 *       §Open Decisions (mtimes 입력 집합).
 */
final class PwaVersionResolver
{
    private const VERSION_CACHE_KEY = 'plugins.moabom-pwa.version.v1';

    private const VERSION_CACHE_TTL_SECONDS = 10;

    /**
     * 버전 계산 시 포함할 dist 파일 목록(상대 경로 → 절대 경로).
     *
     * glob 패턴은 `base_path()` 기준으로 해석한다. 디렉토리 부재 시
     * 해당 그룹은 자동으로 빈 결과가 되어 graceful 처리된다.
     */
    private const DIST_GLOBS = [
        // moabom-basic 활성 디렉토리 산출물
        'templates/moabom-basic/dist/css/**/*',
        'templates/moabom-basic/dist/js/**/*',
    ];

    /** 활성 플러그인 번들 — 본 플러그인의 의존 범위에서만 스캔. */
    private const PLUGIN_GLOB = 'plugins/*/dist/**/*';

    /**
     * 파일 경로 → mtime 맵(Req 4.2 / 4.4).
     *
     * @return array<string, int>
     */
    public function mtimes(): array
    {
        $paths = [];

        foreach (self::DIST_GLOBS as $pattern) {
            foreach ($this->glob($pattern) as $file) {
                if (is_file($file)) {
                    $paths[] = $file;
                }
            }
        }

        foreach ($this->glob(self::PLUGIN_GLOB) as $file) {
            if (is_file($file)) {
                $paths[] = $file;
            }
        }

        sort($paths, SORT_STRING);

        $result = [];
        foreach ($paths as $file) {
            $mtime = @filemtime($file);
            if ($mtime === false) {
                continue;
            }
            $result[$file] = (int) $mtime;
        }

        return $result;
    }

    /**
     * 버전 문자열(Req 4.3).
     *
     * 포맷: `<max16>-<sha8>` — 예: `68199f8a-2d41c5b7`.
     * - max16 : 전체 mtime 의 최대값 16진수.
     * - sha8  : 정렬된 per-file (경로,mtime) 벡터의 SHA-1 앞 8 자.
     *
     * 빈 입력 → `'0-0'` 고정(§8 Error Handling).
     */
    public function resolve(): string
    {
        if (app()->runningUnitTests()) {
            return $this->resolveFresh();
        }

        return Cache::remember(
            self::VERSION_CACHE_KEY,
            now()->addSeconds(self::VERSION_CACHE_TTL_SECONDS),
            fn (): string => $this->resolveFresh(),
        );
    }

    /**
     * 실제 파일 시스템 스캔을 통해 버전을 계산한다.
     */
    private function resolveFresh(): string
    {
        $mtimes = $this->mtimes();
        if ($mtimes === []) {
            return '0-0';
        }

        $max = max($mtimes);

        // 경로와 mtime 을 함께 해시하여 파일 단위 변경(리네임 포함) 도 감지.
        $payload = json_encode($mtimes, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $hash = substr(sha1($payload), 0, 8);

        return dechex($max).'-'.$hash;
    }

    /**
     * `base_path()` 상대 glob 수행. `**` 재귀 매칭을 지원하기 위해
     * `GLOB_BRACE` + 수동 재귀 확장 대신 PHP 의 `RecursiveDirectoryIterator` 를
     * 사용한다. 테스트 가능성을 위해 얇은 helper 로 분리.
     *
     * @return array<int, string>
     */
    private function glob(string $pattern): array
    {
        $baseRoot = rtrim(base_path(), DIRECTORY_SEPARATOR);

        // `**` 기준으로 베이스 디렉토리 분리.
        $separatorPos = strpos($pattern, '**');
        if ($separatorPos === false) {
            // `**` 없는 패턴은 표준 glob 으로 처리.
            $matched = glob($baseRoot.DIRECTORY_SEPARATOR.$pattern) ?: [];

            return $matched;
        }

        $prefix = rtrim(substr($pattern, 0, $separatorPos), '/');
        $suffix = ltrim(substr($pattern, $separatorPos + 2), '/');

        // 접두에 와일드카드가 포함될 수 있으므로 먼저 glob 으로 디렉토리 후보 확장.
        $candidateDirs = glob($baseRoot.DIRECTORY_SEPARATOR.$prefix, GLOB_ONLYDIR) ?: [];
        if ($candidateDirs === []) {
            return [];
        }

        $results = [];
        foreach ($candidateDirs as $dir) {
            $this->collectRecursive($dir, $suffix, $results);
        }

        return $results;
    }

    /**
     * 재귀 수집. `$suffix` 는 `**` 뒤에 오는 glob 패턴(예: `*.js` 또는 빈 문자열).
     *
     * @param  array<int, string>  $out
     */
    private function collectRecursive(string $dir, string $suffix, array &$out): void
    {
        if (! is_dir($dir)) {
            return;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST,
        );

        foreach ($iterator as $entry) {
            if (! $entry->isFile()) {
                continue;
            }
            $path = $entry->getPathname();
            if ($suffix === '' || fnmatch($suffix, $entry->getFilename()) || fnmatch($suffix, $path)) {
                $out[] = $path;
            }
        }
    }
}
