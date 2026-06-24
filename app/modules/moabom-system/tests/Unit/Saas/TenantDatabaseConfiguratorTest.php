<?php

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use PHPUnit\Framework\TestCase;

class TenantDatabaseConfiguratorTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite', [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
        ]);
    }

    public function test_run_on_database_restores_original_connection(): void
    {
        $configurator = new TenantDatabaseConfigurator;
        $seen = null;

        $configurator->runOnDatabase('tenant_a', function (string $connection) use (&$seen): string {
            $seen = (string) config("database.connections.{$connection}.database");

            return 'ok';
        });

        $this->assertSame('tenant_a', $seen);
        $this->assertSame(':memory:', (string) config('database.connections.sqlite.database'));
    }

    public function test_run_on_database_purges_connection_between_switches(): void
    {
        $configurator = new TenantDatabaseConfigurator;

        $configurator->runOnDatabase('tenant_b', function (): void {
            DB::connection('sqlite')->getPdo();
        });

        $this->assertSame(':memory:', (string) config('database.connections.sqlite.database'));
    }
}
