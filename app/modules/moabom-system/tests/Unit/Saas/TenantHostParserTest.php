<?php

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Modules\Moabom\System\Saas\TenantHostParser;
use PHPUnit\Framework\TestCase;

class TenantHostParserTest extends TestCase
{
    private function parser(): TenantHostParser
    {
        return new TenantHostParser('mek360.com', ['mek360.com', 'www.mek360.com']);
    }

    public function test_platform_apex(): void
    {
        $r = $this->parser()->parse('mek360.com');
        $this->assertSame('platform', $r['type']);
    }

    public function test_tenant_subdomain(): void
    {
        $r = $this->parser()->parse('miso.mek360.com');
        $this->assertSame('tenant', $r['type']);
        $this->assertSame('miso', $r['slug']);
    }

    public function test_numeric_subdomain(): void
    {
        $r = $this->parser()->parse('1004.mek360.com');
        $this->assertSame('tenant', $r['type']);
        $this->assertSame('1004', $r['slug']);
    }

    public function test_unknown_domain(): void
    {
        $r = $this->parser()->parse('other.example.com');
        $this->assertSame('unknown', $r['type']);
    }
}
