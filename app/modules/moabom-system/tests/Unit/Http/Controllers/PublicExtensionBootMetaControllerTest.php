<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Moabom\System\Http\Controllers\PublicExtensionBootMetaController;
use Tests\TestCase;

class PublicExtensionBootMetaControllerTest extends TestCase
{
    public function test_invoke_returns_epoch_payload_shape(): void
    {
        $response = (new PublicExtensionBootMetaController)();

        $this->assertInstanceOf(JsonResponse::class, $response);
        $this->assertTrue($response->getData(true)['success']);
        $data = $response->getData(true)['data'];
        $this->assertIsInt($data['extension_epoch']);
        $this->assertArrayHasKey('reload_deferred_assets', $data['client_actions']);
        $this->assertArrayHasKey('notify_user', $data['client_actions']);
        $this->assertArrayHasKey('message_key', $data['client_actions']);
        $this->assertIsArray($data['module_hints']);
    }
}
