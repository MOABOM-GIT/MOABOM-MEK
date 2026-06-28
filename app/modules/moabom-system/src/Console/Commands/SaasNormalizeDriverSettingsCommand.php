<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Contracts\Repositories\ConfigRepositoryInterface;
use Illuminate\Console\Command;
use Modules\Moabom\System\Models\ModuleSetting;
use Modules\Moabom\System\Saas\MoabomRuntimeDriverSettings;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\TenantRegistry;
use Modules\Moabom\System\Saas\TenantRuntimeBootstrap;

final class SaasNormalizeDriverSettingsCommand extends Command
{
    private const MODULE = '_g7_core_';

    protected $signature = 'moabom:saas:normalize-driver-settings
        {slug? : 생략·all·* = platform + 모든 active tenant, 또는 tenant slug 1건}
        {--apply : 실제 DB/GCS 반영 (기본 dry-run)}
        {--skip-platform : platform drivers 정규화 생략}';

    protected $description = '관리자 drivers 설정을 Cloud Run 운영 env 기준으로 DB/GCS에 1회 정규화';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        TenantRegistry $tenantRegistry,
        TenantRuntimeBootstrap $runtimeBootstrap,
    ): int {
        if (! config('moabom-system.saas.enabled', false)) {
            $this->warn('MOABOM_SAAS_ENABLED=false — 건너뜀');

            return self::SUCCESS;
        }

        $platformConnections->registerConnection();

        $slugArg = (string) ($this->argument('slug') ?? '*');
        if ($slugArg === '' || $slugArg === 'all') {
            $slugArg = '*';
        }

        $apply = (bool) $this->option('apply');
        $skipPlatform = (bool) $this->option('skip-platform');
        $errors = [];
        $changed = 0;
        $unchanged = 0;

        $this->line(sprintf('mode=%s target=%s', $apply ? 'APPLY' : 'DRY-RUN', $slugArg));

        if (! $skipPlatform && $slugArg === '*') {
            try {
                $runtimeBootstrap->restorePlatformContext();
                $result = $this->normalizeCurrentContext('platform', $apply);
                $result ? $changed++ : $unchanged++;
            } catch (\Throwable $e) {
                $errors[] = 'platform: '.$e->getMessage();
                $this->error('platform: '.$e->getMessage());
            }
        }

        $tenants = $this->loadTenants($slugArg, $tenantRegistry);
        foreach ($tenants as $slug) {
            try {
                if (! $runtimeBootstrap->bootstrapTenantBySlug($slug)) {
                    $errors[] = "{$slug}: tenant not found";
                    $this->error("{$slug}: tenant not found");

                    continue;
                }

                $result = $this->normalizeCurrentContext($slug, $apply);
                $result ? $changed++ : $unchanged++;
            } catch (\Throwable $e) {
                $errors[] = "{$slug}: ".$e->getMessage();
                $this->error("{$slug}: ".$e->getMessage());
            }
        }

        $runtimeBootstrap->restorePlatformContext();

        $this->newLine();
        $this->info('=== SUMMARY ===');
        $this->line(sprintf('changed=%d unchanged=%d errors=%d', $changed, $unchanged, count($errors)));
        foreach ($errors as $error) {
            $this->error('  '.$error);
        }

        return $errors === [] ? self::SUCCESS : self::FAILURE;
    }

    private function normalizeCurrentContext(string $label, bool $apply): bool
    {
        $repository = app(ConfigRepositoryInterface::class);
        $before = $this->readRawDrivers();
        $current = $repository->getCategory('drivers');
        $normalized = MoabomRuntimeDriverSettings::normalize($current);
        $diffKeys = $this->diffRuntimeKeys($before, $normalized);

        if ($diffKeys === []) {
            $this->line("  [OK] {$label}: drivers already normalized");

            return false;
        }

        $this->line(sprintf('  [%s] %s: %s', $apply ? 'UPDATE' : 'DRY-RUN', $label, implode(', ', $diffKeys)));
        if (! $apply) {
            return true;
        }

        if (! $repository->saveCategory('drivers', $normalized)) {
            throw new \RuntimeException('drivers 저장 실패');
        }

        $after = $this->readRawDrivers();
        $remaining = $this->diffRuntimeKeys($after, MoabomRuntimeDriverSettings::normalize($normalized));
        if ($remaining !== []) {
            throw new \RuntimeException('drivers post-check 불일치: '.implode(', ', $remaining));
        }

        return true;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function readRawDrivers(): ?array
    {
        $row = ModuleSetting::query()
            ->where('module', self::MODULE)
            ->where('category', 'drivers')
            ->first();

        if ($row === null) {
            return null;
        }

        $payload = is_array($row->payload) ? $row->payload : [];
        unset($payload['_meta']);

        return $payload;
    }

    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>  $normalized
     * @return list<string>
     */
    private function diffRuntimeKeys(?array $before, array $normalized): array
    {
        if ($before === null) {
            return ['drivers row missing'];
        }

        $runtime = $normalized['_runtime'] ?? [];
        $keys = is_array($runtime) && is_array($runtime['keys'] ?? null)
            ? $runtime['keys']
            : [];
        $keys[] = '_runtime';

        $diff = [];
        foreach ($keys as $key) {
            if (! is_string($key) || $key === '') {
                continue;
            }

            if (! $this->valuesMatch($key, $before[$key] ?? null, $normalized[$key] ?? null)) {
                $diff[] = $key;
            }
        }

        return $diff;
    }

    private function valuesMatch(string $key, mixed $before, mixed $after): bool
    {
        if ($key !== '_runtime') {
            return $before === $after;
        }

        return $this->runtimeComparable($before) === $this->runtimeComparable($after);
    }

    /**
     * @return array{locked: bool, source: string, keys: list<string>}
     */
    private function runtimeComparable(mixed $value): array
    {
        if (! is_array($value)) {
            return ['locked' => false, 'source' => '', 'keys' => []];
        }

        $keys = $value['keys'] ?? [];
        $keys = is_array($keys)
            ? array_values(array_filter($keys, static fn ($key): bool => is_string($key) && $key !== ''))
            : [];
        sort($keys);

        return [
            'locked' => (bool) ($value['locked'] ?? false),
            'source' => is_string($value['source'] ?? null) ? $value['source'] : '',
            'keys' => $keys,
        ];
    }

    /**
     * @return list<string>
     */
    private function loadTenants(string $slugArg, TenantRegistry $tenantRegistry): array
    {
        if ($slugArg !== '*') {
            return [$slugArg];
        }

        return array_map(
            static fn ($tenant): string => $tenant->slug,
            $tenantRegistry->listActive(),
        );
    }
}
