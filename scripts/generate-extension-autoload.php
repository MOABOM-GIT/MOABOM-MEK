<?php

declare(strict_types=1);

/**
 * DB가 없는 Cloud Build에서 modules/plugins composer.json만으로 확장 오토로드를 생성한다.
 *
 * Usage: php scripts/generate-extension-autoload.php /app
 */

$appRoot = rtrim($argv[1] ?? dirname(__DIR__).'/app', '/');
$outputPath = $appRoot.'/bootstrap/cache/autoload-extensions.php';

$psr4 = [];
$classmap = [];
$files = [];
$vendorAutoloads = [];

$normalizePath = static function (string $base, string $path): string {
    return $base.'/'.ltrim(str_replace('\\', '/', $path), '/');
};

foreach ([['modules', 'module.php'], ['plugins', 'plugin.php']] as [$directory, $entrypoint]) {
    $extensionDirectories = glob($appRoot.'/'.$directory.'/*', GLOB_ONLYDIR) ?: [];
    sort($extensionDirectories, SORT_STRING);

    foreach ($extensionDirectories as $extensionDirectory) {
        $identifier = basename($extensionDirectory);
        if (str_starts_with($identifier, '_')) {
            continue;
        }

        $composerPath = $extensionDirectory.'/composer.json';
        $entrypointPath = $extensionDirectory.'/'.$entrypoint;
        if (! is_file($composerPath) || ! is_file($entrypointPath)) {
            continue;
        }

        $composer = json_decode((string) file_get_contents($composerPath), true, flags: JSON_THROW_ON_ERROR);
        $autoload = is_array($composer['autoload'] ?? null) ? $composer['autoload'] : [];
        $relativeBase = $directory.'/'.$identifier;

        foreach (($autoload['psr-4'] ?? []) as $namespace => $paths) {
            $resolved = [];
            foreach ((array) $paths as $path) {
                if (is_string($path) && $path !== '') {
                    $resolved[] = $normalizePath($relativeBase, $path);
                }
            }
            if ($resolved === []) {
                continue;
            }

            $existing = isset($psr4[$namespace]) ? (array) $psr4[$namespace] : [];
            $merged = array_values(array_unique([...$existing, ...$resolved]));
            $psr4[$namespace] = count($merged) === 1 ? $merged[0] : $merged;
        }

        $classmap[] = $relativeBase.'/'.$entrypoint;
        foreach ((array) ($autoload['classmap'] ?? []) as $path) {
            if (is_string($path) && $path !== '') {
                $classmap[] = $normalizePath($relativeBase, $path);
            }
        }
        foreach ((array) ($autoload['files'] ?? []) as $path) {
            if (is_string($path) && $path !== '') {
                $files[] = $normalizePath($relativeBase, $path);
            }
        }

        if (is_file($extensionDirectory.'/vendor/autoload.php')) {
            $vendorAutoloads[] = $relativeBase.'/vendor/autoload.php';
        }
    }
}

ksort($psr4, SORT_STRING);
$classmap = array_values(array_unique($classmap));
$files = array_values(array_unique($files));
$vendorAutoloads = array_values(array_unique($vendorAutoloads));
sort($classmap, SORT_STRING);
sort($files, SORT_STRING);
sort($vendorAutoloads, SORT_STRING);

$payload = [
    'psr4' => $psr4,
    'classmap' => $classmap,
    'files' => $files,
    'vendor_autoloads' => $vendorAutoloads,
];
$contents = "<?php\n\n"
    ."/**\n"
    ." * Cloud Build filesystem extension autoload.\n"
    ." * Generated from active modules/plugins composer.json; do not edit.\n"
    ." */\n\n"
    .'return '.var_export($payload, true).";\n";

if (! is_dir(dirname($outputPath)) && ! mkdir(dirname($outputPath), 0755, true) && ! is_dir(dirname($outputPath))) {
    throw new RuntimeException('Unable to create bootstrap/cache');
}
if (file_put_contents($outputPath, $contents) === false) {
    throw new RuntimeException('Unable to write '.$outputPath);
}

fwrite(STDOUT, sprintf(
    "extension autoload generated: %d namespaces, %d classmap entries\n",
    count($psr4),
    count($classmap),
));
