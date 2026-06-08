<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;

class SaasHydratePlatformSettingsCommand extends Command
{
    protected $signature = 'moabom:saas:hydrate-platform-settings
        {--apply : 실제 DB 반영 (기본 dry-run)}
        {--module=moabom-system : module}
        {--category=appearance : category}
        {--key=home_background_items : list key (콤마 구분 다수)}
        {--source-db= : platform DB (기본 schema_source_db)}';

    protected $description = 'platform settings DB row 를 GCS 최신 스냅샷으로 1회 hydrate (dry-run 기본)';

    public function handle(PlatformConnectionFactory $platformConnections): int
    {
        $platformConnections->registerConnection();

        $apply = (bool) $this->option('apply');
        $module = trim((string) $this->option('module'));
        $category = trim((string) $this->option('category'));
        $sourceDb = (string) ($this->option('source-db')
            ?: config('moabom-system.saas.provision.schema_source_db', 'moabom-db'));
        /** @var list<string> $keys */
        $keys = array_values(array_filter(array_map('trim', explode(',', (string) $this->option('key')))));
        if ($keys === []) {
            $keys = ['home_background_items'];
        }

        if ($module === '' || $category === '' || $sourceDb === '') {
            $this->error('module/category/source-db 는 비어 있을 수 없습니다.');

            return self::FAILURE;
        }

        $dbPayload = $this->readDbPayload($sourceDb, $module, $category);
        $gcsPayload = $this->readGcsPayload($module, $category);
        if ($gcsPayload === null) {
            $this->error('GCS payload 가 없어 hydrate 할 수 없습니다.');

            return self::FAILURE;
        }

        $shouldHydrate = $dbPayload === null;
        foreach ($keys as $key) {
            $dbCount = $dbPayload === null ? -1 : $this->countList($dbPayload, $key);
            $gcsCount = $this->countList($gcsPayload, $key);
            $this->line(sprintf('key=%s DB=%s GCS=%s', $key, (string) $dbCount, (string) $gcsCount));
            if ($dbCount < $gcsCount) {
                $shouldHydrate = true;
            }
        }

        if (! $shouldHydrate) {
            $this->info('hydrate 대상 없음 (DB 가 GCS 와 동등/최신).');

            return self::SUCCESS;
        }

        if (! $apply) {
            $this->warn('dry-run: hydrate 필요. --apply 로 반영하세요.');

            return self::SUCCESS;
        }

        try {
            $this->writeDbPayload($sourceDb, $module, $category, $gcsPayload);
            $reloaded = $this->readDbPayload($sourceDb, $module, $category);
            if ($reloaded === null) {
                $this->error('hydrate 실패: 적용 후 DB row 재조회 실패');

                return self::FAILURE;
            }
            foreach ($keys as $key) {
                $dbCount = $this->countList($reloaded, $key);
                $gcsCount = $this->countList($gcsPayload, $key);
                if ($dbCount !== $gcsCount) {
                    $this->error(sprintf(
                        'hydrate 검증 실패: key=%s DB=%d GCS=%d',
                        $key,
                        $dbCount,
                        $gcsCount,
                    ));

                    return self::FAILURE;
                }
            }
            $this->info('hydrate 적용 완료 (post-check OK).');

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('hydrate 실패: '.$e->getMessage());

            return self::FAILURE;
        }
    }

    /**
     * @return array<string,mixed>|null
     */
    private function readDbPayload(string $db, string $module, string $category): ?array
    {
        $prefix = (string) DB::connection()->getTablePrefix();
        $table = $prefix.'moabom_module_settings';
        $stmt = DB::connection()->getPdo()->prepare(
            "SELECT payload FROM `{$db}`.`{$table}` WHERE module = ? AND category = ? LIMIT 1"
        );
        $stmt->execute([$module, $category]);
        $raw = $stmt->fetchColumn();
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function readGcsPayload(string $module, string $category): ?array
    {
        $disk = Storage::disk('gcs');
        $path = 'modules/'.$module.'/settings/'.$category.'.json';
        if (! $disk->exists($path)) {
            return null;
        }
        $raw = $disk->get($path);
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }

        $decoded = json_decode(ltrim($raw, "\xEF\xBB\xBF"), true);

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @param  array<string,mixed>  $payload
     */
    private function writeDbPayload(string $db, string $module, string $category, array $payload): void
    {
        $prefix = (string) DB::connection()->getTablePrefix();
        $table = $prefix.'moabom_module_settings';
        $pdo = DB::connection()->getPdo();
        $now = now()->toDateTimeString();
        $json = (string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $check = $pdo->prepare("SELECT 1 FROM `{$db}`.`{$table}` WHERE module = ? AND category = ? LIMIT 1");
        $check->execute([$module, $category]);
        $exists = (bool) $check->fetchColumn();

        if ($exists) {
            $stmt = $pdo->prepare("UPDATE `{$db}`.`{$table}` SET payload = ?, updated_at = ? WHERE module = ? AND category = ?");
            if (! $stmt->execute([$json, $now, $module, $category])) {
                throw new \RuntimeException('UPDATE execute 실패');
            }

            return;
        }

        $stmt = $pdo->prepare(
            "INSERT INTO `{$db}`.`{$table}` (`module`,`category`,`payload`,`created_at`,`updated_at`) VALUES (?,?,?,?,?)"
        );
        if (! $stmt->execute([$module, $category, $json, $now, $now])) {
            throw new \RuntimeException('INSERT execute 실패');
        }
    }

    /**
     * @param  array<string,mixed>  $payload
     */
    private function countList(array $payload, string $key): int
    {
        $value = $payload[$key] ?? null;

        return is_array($value) ? count($value) : -1;
    }
}
