<?php

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Support\Facades\Config;
use Modules\Moabom\System\Saas\SaasMysqlPdoFactory;
use Tests\TestCase;

class SaasMysqlPdoFactoryTest extends TestCase
{
    public function test_platform_write_database_uses_config_ssot_not_tenant_swapped_connection(): void
    {
        Config::set('moabom-saas.platform_write_database', 'moabom-db');
        Config::set('database.connections.mysql', [
            'driver' => 'mysql',
            'write' => [
                'host' => '127.0.0.1',
                'database' => 'hospital_freshent',
            ],
            'read' => [
                'host' => '127.0.0.1',
                'database' => 'hospital_freshent',
            ],
        ]);

        $this->assertSame('moabom-db', SaasMysqlPdoFactory::platformWriteDatabase());
    }
}
