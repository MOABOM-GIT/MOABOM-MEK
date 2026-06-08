<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Feature;

use App\Enums\ExtensionStatus;
use App\Models\Module;
use App\Models\Template;
use App\Services\TemplateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * 사용자 셸(moabom-basic) 부트 시 TemplateApp이 병렬로 가져가는 JSON 응답이
 * 비정상적으로 비대해지지 않았는지 회귀 방지한다.
 *
 * 로컬 `.env`의 `APP_VERSION`이 template.json `g7_version`(Semver 하한)보다 낮으면 `installTemplate`이
 * 실패하므로, 이 테스트만 코어 버전을 beta로 맞춘 뒤 설치한다(실제 배포 버전과 무관).
 */
class MoabomBasicBootJsonPayloadTest extends TestCase
{
    use RefreshDatabase;

    private const TEMPLATE_ID = 'moabom-basic';

    /** @var array<string, int> 응답 본문 상한(바이트) */
    private const MAX_BYTES = [
        'lang_ko' => 400_000,
        'lang_en' => 250_000,
        'components' => 200_000,
        'routes' => 2_000_000,
    ];

    protected function setUp(): void
    {
        parent::setUp();

        // CoreVersionChecker::getCoreVersion() — env 가 config 보다 우선 (코어 주석 참고).
        $_ENV['APP_VERSION'] = '7.0.0-beta.3';
        $_SERVER['APP_VERSION'] = '7.0.0-beta.3';
        putenv('APP_VERSION=7.0.0-beta.3');
        Config::set('app.version', '7.0.0-beta.3');

        $this->seedSirsoftPageModuleIfNeeded();

        $service = app(TemplateService::class);
        $service->installTemplate(self::TEMPLATE_ID);
        $tpl = Template::where('identifier', self::TEMPLATE_ID)->first();
        $this->assertNotNull($tpl, 'moabom-basic 설치 후 DB에 템플릿이 있어야 한다.');
        $service->activateTemplate($tpl->id);
    }

    /**
     * moabom-basic template.json이 sirsoft-page 모듈을 요구하므로, 테스트 DB에 활성 행을 둔다.
     */
    private function seedSirsoftPageModuleIfNeeded(): void
    {
        Module::firstOrCreate(
            ['identifier' => 'sirsoft-page'],
            [
                'vendor' => 'sirsoft',
                'name' => ['ko' => 'Page', 'en' => 'Page'],
                'status' => ExtensionStatus::Active->value,
                'version' => '1.0.0-beta.2',
                'config' => [],
            ]
        );
    }

    public function test_boot_json_endpoints_respond_and_stay_under_size_caps(): void
    {
        $config = $this->getJson('/api/templates/'.self::TEMPLATE_ID.'/config.json');
        $config->assertOk()->assertJsonPath('success', true);
        $cacheVersion = (int) ($config->json('data.cache_version') ?? 0);
        $this->assertGreaterThan(0, $cacheVersion, 'cache_version가 있어야 lang/routes에 v=로 붙는다.');

        $langKo = $this->getJson('/api/templates/'.self::TEMPLATE_ID.'/lang/ko.json?v='.$cacheVersion);
        $langKo->assertOk();
        $this->assertJson($langKo->getContent());
        $this->assertLessThanOrEqual(
            self::MAX_BYTES['lang_ko'],
            strlen($langKo->getContent()),
            'ko.json 이 비정상적으로 커졌는지 확인'
        );

        $langEn = $this->getJson('/api/templates/'.self::TEMPLATE_ID.'/lang/en.json?v='.$cacheVersion);
        $langEn->assertOk();
        $this->assertJson($langEn->getContent());
        $this->assertLessThanOrEqual(
            self::MAX_BYTES['lang_en'],
            strlen($langEn->getContent()),
            'en.json 이 비정상적으로 커졌는지 확인'
        );

        $components = $this->getJson('/api/templates/'.self::TEMPLATE_ID.'/components.json?v='.$cacheVersion);
        $components->assertOk();
        $this->assertIsArray($components->json());
        $this->assertLessThanOrEqual(
            self::MAX_BYTES['components'],
            strlen($components->getContent()),
            'components.json 이 비정상적으로 커졌는지 확인'
        );

        $routes = $this->getJson('/api/templates/'.self::TEMPLATE_ID.'/routes.json?v='.$cacheVersion);
        $routes->assertOk()->assertJsonPath('success', true);
        $this->assertNotEmpty($routes->json('data'), 'routes payload 비어 있으면 안 됨');
        $this->assertLessThanOrEqual(
            self::MAX_BYTES['routes'],
            strlen($routes->getContent()),
            'routes.json 이 비정상적으로 커졌는지 확인'
        );
    }
}
