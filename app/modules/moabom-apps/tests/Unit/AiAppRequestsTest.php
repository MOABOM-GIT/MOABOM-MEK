<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use Illuminate\Support\Facades\Validator;
use Modules\Moabom\Apps\Http\Requests\GenerateAiAppRequest;
use Modules\Moabom\Apps\Http\Requests\StoreGeneratedAppRequest;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AiAppRequestsTest extends ModuleTestCase
{
    public function test_generate_ai_app_request_accepts_supported_app_type(): void
    {
        $passes = Validator::make([
            'prompt' => '수면 리포트 앱을 만들어줘',
            'app_type' => 'dataviz',
            'model_id' => 'claude-sonnet',
        ], (new GenerateAiAppRequest)->rules())->passes();

        $this->assertTrue($passes);
    }

    public function test_generate_ai_app_request_rejects_gemini_flash(): void
    {
        $passes = Validator::make([
            'prompt' => '수면 리포트 앱을 만들어줘',
            'app_type' => 'dataviz',
            'model_id' => 'gemini-flash',
        ], (new GenerateAiAppRequest)->rules())->passes();

        $this->assertFalse($passes);
    }

    public function test_store_generated_app_request_requires_complete_html(): void
    {
        $passes = Validator::make([
            'title' => '테스트 앱',
            'app_type' => 'general',
            'html' => '<html></html>',
        ], (new StoreGeneratedAppRequest)->rules())->passes();

        $this->assertFalse($passes);
    }

    public function test_store_generated_app_request_accepts_tier(): void
    {
        $passes = Validator::make([
            'title' => '테스트 앱',
            'app_type' => 'general',
            'tier' => 'hosted',
            'html' => '<!DOCTYPE html><html><head></head><body>테스트</body></html>',
        ], (new StoreGeneratedAppRequest)->rules())->passes();

        $this->assertTrue($passes);
    }
}
