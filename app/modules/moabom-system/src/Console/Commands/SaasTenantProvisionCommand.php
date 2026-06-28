<?php

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Modules\Moabom\System\Saas\TenantProvisioner;

class SaasTenantProvisionCommand extends Command
{
    protected $signature = 'moabom:saas:tenant-provision
        {slug : 서브도메인 라벨 (예: miso)}
        {--name= : 업체명 (필수)}
        {--region= : 지역 (예: 대구)}
        {--address= : 주소}
        {--host= : FQDN (기본 slug.mek360.com)}
        {--database= : MySQL database (기본 hospital_{slug})}
        {--gcs-prefix= : GCS prefix (기본 tenants/{slug})}
        {--package=hospital-default : 시드 패키지 ID}
        {--clone-from= : 스키마/legacy clone 원본 DB (기본 moabom-db)}
        {--legacy-clone : (구) 플랫폼 DB 전체 복제 — 신규는 기본 package bootstrap}
        {--skip-clone : DB 작업 생략 (기존 DB + registry/GCS만, v1 호환)}
        {--force : 기존 active 테넌트 덮어쓰기}';

    protected $description = '업체 테넌트 1건 프로비저닝: package bootstrap(기본) → GCS settings → registry';

    public function handle(TenantProvisioner $provisioner): int
    {
        if (! config('moabom-system.saas.enabled')) {
            $this->warn('MOABOM_SAAS_ENABLED=false — 로컬/단일 DB 환경에서는 주의해서 실행하세요.');
        }

        $slug = strtolower((string) $this->argument('slug'));

        try {
            $result = $provisioner->provision($slug, [
                'name' => (string) $this->option('name'),
                'region' => (string) $this->option('region'),
                'address' => (string) $this->option('address'),
                'host' => $this->option('host') ? (string) $this->option('host') : null,
                'database' => $this->option('database') ? (string) $this->option('database') : null,
                'gcs_prefix' => $this->option('gcs-prefix') ? (string) $this->option('gcs-prefix') : null,
                'package' => (string) $this->option('package'),
                'clone_from' => $this->option('clone-from') ? (string) $this->option('clone-from') : null,
                'legacy_clone' => (bool) $this->option('legacy-clone'),
                'skip_clone' => (bool) $this->option('skip-clone'),
                'force' => (bool) $this->option('force'),
            ]);
        } catch (\InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        } catch (\RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("완료: {$result['app_url']}");
        $this->line("  mode: {$result['mode']}");
        $this->line("  DB: {$result['database']}");
        $this->line("  GCS: {$result['gcs_prefix']}/settings/general.json");
        if ($result['tables_cloned'] !== null) {
            $this->line("  Cloned tables: {$result['tables_cloned']}");
        }
        if ($result['tables_bootstrapped'] !== null) {
            $this->line("  Bootstrapped tables: {$result['tables_bootstrapped']} (package {$result['package_id']})");
        }

        return self::SUCCESS;
    }
}
