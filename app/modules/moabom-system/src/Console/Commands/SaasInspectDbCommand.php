<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * 짧은 진단용 — production 환경의 DB 토폴로지 확인.
 *
 * - default connection 의 database 이름 (top-level/write/read)
 * - moabom-db / moabom-platform / 지정 DB 의 테이블 목록
 *
 * @see deploy/AGENT-FAILURE-ANALYSIS.md §12
 */
class SaasInspectDbCommand extends Command
{
    protected $signature = 'moabom:saas:inspect-db {--db=* : 추가 검사 DB 이름}';

    protected $description = 'platform DB 토폴로지 진단 (테이블 누락 확인용)';

    public function handle(): int
    {
        $default = (string) config('database.default');
        $cfg = (array) config('database.connections.'.$default);
        $top = (string) ($cfg['database'] ?? '?');
        $write = (string) ($cfg['write']['database'] ?? '?');
        $read = (string) ($cfg['read']['database'] ?? '?');

        $this->line(sprintf('default conn=%s top.database=%s write.database=%s read.database=%s', $default, $top, $write, $read));
        $this->line(sprintf('host=%s port=%s socket=%s', (string) ($cfg['host'] ?? ''), (string) ($cfg['port'] ?? ''), (string) ($cfg['unix_socket'] ?? '')));
        $this->line(sprintf('platform_database(cfg)=%s', (string) config('moabom-system.saas.platform_database', '?')));
        $this->line(sprintf('schema_source_db(cfg)=%s', (string) config('moabom-system.saas.provision.schema_source_db', '?')));
        $this->newLine();

        $databases = array_unique(array_filter(array_merge(
            ['moabom-db', 'moabom-platform'],
            (array) $this->option('db'),
        )));

        foreach ($databases as $db) {
            $this->info('=== '.$db.' ===');
            try {
                $rows = DB::select('SHOW TABLES FROM `'.$db.'`');
                foreach ($rows as $r) {
                    $arr = (array) $r;
                    $keys = array_keys($arr);
                    $this->line('  '.$arr[$keys[0]]);
                }
            } catch (\Throwable $e) {
                $this->error('  err: '.$e->getMessage());
            }
        }

        return self::SUCCESS;
    }
}
