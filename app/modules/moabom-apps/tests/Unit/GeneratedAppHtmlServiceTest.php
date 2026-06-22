<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use Modules\Moabom\Apps\Services\GeneratedAppHtmlService;
use PHPUnit\Framework\TestCase;

class GeneratedAppHtmlServiceTest extends TestCase
{
    public function test_harden_preserves_app_styles_and_injects_csp(): void
    {
        $service = new GeneratedAppHtmlService;
        $html = '<!DOCTYPE html><html><head><title>x</title>'
            .'<style>.card{color:red}</style>'
            .'</head><body>ok</body></html>';

        $out = $service->harden($html);

        $this->assertStringContainsString('.card{color:red}', $out);
        $this->assertStringContainsString('http-equiv="Content-Security-Policy"', $out);
    }

    public function test_harden_skips_csp_when_already_present(): void
    {
        $service = new GeneratedAppHtmlService;
        $html = '<html><head><meta http-equiv="Content-Security-Policy" content="default-src https:"></head><body></body></html>';

        $out = $service->harden($html);

        $this->assertSame(1, substr_count($out, 'http-equiv="Content-Security-Policy"'));
    }

    public function test_harden_strips_base_and_manifest(): void
    {
        $service = new GeneratedAppHtmlService;
        $html = '<html><head><base href="https://evil.test/"><link rel="manifest" href="/m.json"></head><body></body></html>';

        $out = $service->harden($html);

        $this->assertStringNotContainsString('<base', $out);
        $this->assertStringNotContainsString('rel="manifest"', $out);
        $this->assertStringContainsString('http-equiv="Content-Security-Policy"', $out);
    }
}
