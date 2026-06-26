<?php

namespace Modules\Moabom\Presence\Tests\Unit;

use Modules\Moabom\Presence\Support\PresenceClientIpMasker;
use PHPUnit\Framework\TestCase;

final class PresenceClientIpMaskerTest extends TestCase
{
    public function test_masks_ipv4(): void
    {
        $masker = new PresenceClientIpMasker;

        $this->assertSame('123.158.*.*', $masker->mask('123.158.45.67'));
    }

    public function test_returns_null_for_invalid_ip(): void
    {
        $masker = new PresenceClientIpMasker;

        $this->assertNull($masker->mask(''));
        $this->assertNull($masker->mask('not-an-ip'));
    }
}
