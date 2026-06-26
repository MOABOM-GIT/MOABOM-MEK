<?php

declare(strict_types=1);

namespace Modules\Moabom\GlobalSearch\Tests\Unit;

use Modules\Moabom\Apps\Apps\AppManifest;
use PHPUnit\Framework\TestCase;

/**
 * GlobalSearch 앱 매니페스트(app.json)가 SDK 계약을 만족하는지 검증한다.
 */
class GlobalSearchAppManifestTest extends TestCase
{
    public function test_app_json_is_a_valid_manifest(): void
    {
        $file = dirname(__DIR__, 2).'/app.json';
        $this->assertFileExists($file);

        $data = json_decode((string) file_get_contents($file), true);
        $this->assertIsArray($data);

        $manifest = AppManifest::fromArray('moabom-global-search', $data);

        $this->assertSame('global-search', $manifest->id);
        $this->assertSame('moabom-global-search', $manifest->module);
        $this->assertSame('moabom-shell-global-search.iife.js', $manifest->frontendChunk);
    }
}
