<?php

declare(strict_types=1);

namespace Modules\Moabom\Consulting\Tests\Unit;

use Modules\Moabom\Apps\Apps\AppManifest;
use PHPUnit\Framework\TestCase;

/**
 * Consulting 앱 매니페스트(app.json)가 SDK 계약을 만족하는지 검증한다.
 */
class ConsultingAppManifestTest extends TestCase
{
    public function test_app_json_is_a_valid_manifest(): void
    {
        $file = dirname(__DIR__, 2).'/app.json';
        $this->assertFileExists($file);

        $data = json_decode((string) file_get_contents($file), true);
        $this->assertIsArray($data);

        $manifest = AppManifest::fromArray('moabom-consulting', $data);

        $this->assertSame('consulting', $manifest->id);
        $this->assertSame('moabom-consulting', $manifest->module);
        $this->assertSame('moabom-shell-consulting.iife.js', $manifest->frontendChunk);
    }
}
