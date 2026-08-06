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

    public function test_harden_injects_download_bridge_script(): void
    {
        $service = new GeneratedAppHtmlService;
        $html = '<!DOCTYPE html><html><head><title>x</title></head><body>ok</body></html>';

        $out = $service->harden($html);

        $this->assertStringContainsString('id="moabom-app-download-bridge"', $out);
        $this->assertStringContainsString('__moabomDownloadBridge', $out);
        $this->assertStringContainsString('file-download', $out);
        $this->assertStringContainsString('PATH_BACKSLASH', $out);
        $this->assertStringNotContainsString('.replace(/\\/g', $out);
        $this->assertStringNotContainsString('.replace(/\/g', $out);
    }

    public function test_harden_injects_data_api_bridge_for_hosted_apps(): void
    {
        $service = new GeneratedAppHtmlService;
        $html = '<!DOCTYPE html><html><head><title>x</title></head><body>ok</body></html>';

        $out = $service->harden($html, null, true);

        $this->assertStringContainsString('id="moabom-app-data-api-bridge"', $out);
        $this->assertStringContainsString('__moabomDataApiBridge', $out);
        $this->assertStringContainsString('id="moabom-app-hosted-storage"', $out);
        $this->assertStringContainsString('MoabomAppStorage', $out);
    }

    public function test_harden_injects_backdrop_probe_with_gradient_support(): void
    {
        $service = new GeneratedAppHtmlService;
        $html = '<!DOCTYPE html><html><head><title>x</title></head><body>ok</body></html>';

        $out = $service->harden($html);

        $this->assertStringContainsString('id="moabom-app-backdrop-probe"', $out);
        $this->assertStringContainsString('__moabomBackdropProbe', $out);
        $this->assertStringContainsString('backdrop-probe', $out);
        $this->assertStringContainsString('backgroundImage', $out);
        $this->assertStringContainsString('avgFromBackgroundImage', $out);
        $this->assertStringContainsString('heartbeat-ping', $out);
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
