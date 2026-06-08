<?php

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;

class SaasTenantRegisterCommand extends Command
{
    protected $signature = 'moabom:saas:tenant-register
        {slug : 서브도메인 라벨 (예: miso)}
        {--host= : FQDN (기본 slug.mek360.com)}
        {--database= : MySQL database 이름 (기본: hospital_{slug})}
        {--gcs-prefix= : GCS prefix (기본: tenants/{slug})}
        {--package=hospital-default : 시드 패키지 ID}
        {--status=active : active|suspended|provisioning}';

    protected $description = '플랫폼 레지스트리에 병원 테넌트 1건 등록 (DB·GCS는 별도 생성)';

    public function handle(PlatformConnectionFactory $platformConnections): int
    {
        $platformConnections->registerConnection();

        $slug = strtolower((string) $this->argument('slug'));
        $base = (string) config('moabom-system.saas.base_domain', 'mek360.com');
        $host = (string) ($this->option('host') ?: "{$slug}.{$base}");
        $database = (string) ($this->option('database') ?: 'hospital_'.$slug);
        $gcsPrefix = (string) ($this->option('gcs-prefix') ?: 'tenants/'.$slug);

        $now = now();
        $payload = [
            'host' => $host,
            'db_database' => $database,
            'gcs_prefix' => $gcsPrefix,
            'package_id' => (string) $this->option('package'),
            'status' => (string) $this->option('status'),
            'app_url' => 'https://'.$host,
            'updated_at' => $now,
        ];

        $table = DB::connection('moabom_platform')->table('moabom_saas_tenants');
        if ($table->where('slug', $slug)->exists()) {
            $table->where('slug', $slug)->update($payload);
        } else {
            $table->insert(array_merge($payload, [
                'slug' => $slug,
                'created_at' => $now,
            ]));
        }

        $this->info("등록됨: {$host} → DB {$database}, GCS {$gcsPrefix}");
        $this->line('다음: CREATE DATABASE · migrate · 패키지 시드 · Cafe24 DNS');

        return self::SUCCESS;
    }
}
