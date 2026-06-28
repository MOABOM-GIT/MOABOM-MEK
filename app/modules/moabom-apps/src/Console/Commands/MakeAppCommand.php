<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * 앱 SDK 스캐폴드 (Phase 4) — `php artisan moabom:make-app {name}`.
 *
 * 신규 앱 모듈 골격(module.json/module.php/Provider/config/routes/app.json/test)을 생성한다.
 * app.json 만 있으면 AppRegistry 가 자동 집계 → shell-boot apps[] → 프론트 동적 로드.
 * 프론트 청크(템플릿) 골격은 명령 출력의 다음 단계 안내를 따른다.
 */
final class MakeAppCommand extends Command
{
    protected $signature = 'moabom:make-app
        {name : 앱/모듈 식별자 (kebab-case, 예: consulting, hospital-intro)}
        {--vendor=moabom : 벤더}
        {--category=basic : basic|user}
        {--force : 기존 디렉토리가 있어도 덮어쓰기}
        {--no-provision : hospital-default 패키지 자동 등록 생략}';

    protected $description = '신규 Moabom 앱 모듈 골격(app.json 포함)을 생성합니다.';

    public function handle(): int
    {
        $name = (string) $this->argument('name');
        if (! preg_match('/^[a-z][a-z0-9-]*$/', $name)) {
            $this->error("name 은 kebab-case 여야 합니다(소문자/숫자/하이픈): {$name}");

            return self::FAILURE;
        }

        $vendor = (string) $this->option('vendor');
        $category = (string) $this->option('category');
        if (! in_array($category, ['basic', 'user'], true)) {
            $category = 'basic';
        }

        $moduleId = "moabom-{$name}";
        $studly = Str::studly($name);
        $camel = Str::camel($name);
        $namespace = "Modules\\Moabom\\{$studly}";
        $base = base_path("modules/{$moduleId}");

        if (is_dir($base) && ! $this->option('force')) {
            $this->error("이미 존재합니다: modules/{$moduleId} (--force 로 덮어쓰기)");

            return self::FAILURE;
        }

        $chunk = "moabom-shell-{$name}.iife.js";

        $files = [
            "module.json" => $this->moduleJson($moduleId, $vendor, $studly),
            "module.php" => $this->modulePhp($namespace),
            "app.json" => $this->appJson($name, $moduleId, $category, $chunk),
            "config/{$moduleId}.php" => $this->configPhp($moduleId),
            "src/routes/api.php" => $this->routesPhp($moduleId),
            "src/Providers/{$studly}ServiceProvider.php" => $this->providerPhp($namespace, $moduleId),
            "tests/Unit/{$studly}AppManifestTest.php" => $this->testPhp($namespace, $studly, $name, $moduleId, $chunk),
        ];

        foreach ($files as $relative => $contents) {
            $path = "{$base}/{$relative}";
            $dir = dirname($path);
            if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
                $this->error("디렉토리 생성 실패: {$dir}");

                return self::FAILURE;
            }
            file_put_contents($path, $contents);
            $this->line("  created  modules/{$moduleId}/{$relative}");
        }

        // 프론트 청크 골격 (컨벤션: 폴더명 == 앱 id) — 자동 발견 빌드/등록의 입력.
        $this->scaffoldFrontend($name, $studly, $camel, $category);

        // bootstrap/cache/autoload-extensions.php 커밋본에 PSR-4/classmap 추가 (배포 전 정적 검사용).
        $this->updateAutoload($namespace, $moduleId, $studly);

        // hospital-default 패키지에 모듈 등록 (모든 신규 업체 테넌트 자동 프로비저닝).
        if (! $this->option('no-provision')) {
            $this->provisionHospitalDefault($moduleId);
        }

        $this->info("앱 모듈 골격 생성 완료: modules/{$moduleId}");
        $this->newLine();
        $this->line('생성·자동화된 것:');
        $this->line("  - 백엔드 모듈 modules/{$moduleId} (module.json/app.json/provider/routes/test)");
        $this->line("  - 프론트 청크 골격 templates/moabom-basic/src/apps/{$name} (metadata/shellRegister/컴포넌트/index)");
        $this->line('  - autoload-extensions.php PSR-4/classmap 등록 (배포 전 정적 검사용 커밋본)');
        if (! $this->option('no-provision')) {
            $this->line('  - hospital-default 패키지 등록 (신규 업체 테넌트 자동 프로비저닝)');
        }
        $this->newLine();
        $this->line('다음 단계 (운영 반영):');
        $this->line("  1) templates/moabom-basic/src/apps/{$name}/ 의 컴포넌트에 실제 UI/로직 구현");
        $this->line('  2) bash deploy/rebuild-moabom-basic-dist.sh');
        $this->line("       → build-shell-apps.cjs 가 자동 발견해 dist/js/{$chunk} 빌드, 청크맵·그리드는 import.meta.glob 자동 집계");
        $this->line('  3) (선택) 신규 테이블은 {module}_* prefix 규약 준수 (invariant v9-table-prefix)');

        return self::SUCCESS;
    }

    private function moduleJson(string $moduleId, string $vendor, string $studly): string
    {
        return json_encode([
            'identifier' => $moduleId,
            'vendor' => $vendor,
            'name' => ['ko' => $studly, 'en' => $studly],
            'version' => '0.1.0',
            'license' => 'MIT',
            'description' => [
                'ko' => "{$studly} 앱 모듈",
                'en' => "{$studly} app module",
            ],
            'g7_version' => '>=7.0.0-beta.1,<8.0.0',
            'dependencies' => ['modules' => (object) [], 'plugins' => (object) []],
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n";
    }

    private function modulePhp(string $namespace): string
    {
        return <<<PHP
        <?php

        namespace {$namespace};

        use App\Extension\AbstractModule;

        class Module extends AbstractModule
        {
            public function getPermissions(): array
            {
                return [];
            }

            public function getAdminMenus(): array
            {
                return [];
            }

            public function getDynamicTables(): array
            {
                return [];
            }
        }

        PHP;
    }

    private function appJson(string $name, string $moduleId, string $category, string $chunk): string
    {
        return json_encode([
            'id' => $name,
            'module' => $moduleId,
            'name' => ['ko' => $name, 'en' => $name],
            'description' => ['ko' => '', 'en' => ''],
            'icon' => 'cube',
            'gradient' => 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            'category' => $category,
            'source' => 'system',
            'frontend' => [
                'template' => 'moabom-basic',
                'chunk' => $chunk,
                'global' => $name,
            ],
            'api_prefix' => "api/modules/{$moduleId}",
            'permissions' => [],
            'tenant_scoped' => true,
            'order' => 100,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n";
    }

    private function configPhp(string $moduleId): string
    {
        return <<<PHP
        <?php

        // {$moduleId} 모듈 설정.
        return [
            //
        ];

        PHP;
    }

    private function routesPhp(string $moduleId): string
    {
        return <<<PHP
        <?php

        use Illuminate\Support\Facades\Route;

        // {$moduleId} API 라우트. prefix(api/modules/{$moduleId})는 코어가 부여한다.
        // 예: Route::middleware('auth:sanctum')->get('items', [ItemController::class, 'index']);

        PHP;
    }

    private function providerPhp(string $namespace, string $moduleId): string
    {
        return <<<PHP
        <?php

        namespace {$namespace}\\Providers;

        use App\Extension\BaseModuleServiceProvider;

        class ServiceProvider extends BaseModuleServiceProvider
        {
            protected string \$moduleIdentifier = '{$moduleId}';

            protected array \$repositories = [];

            public function register(): void
            {
                parent::register();

                \$this->mergeConfigFrom(
                    dirname(__DIR__, 2).'/config/{$moduleId}.php',
                    '{$moduleId}',
                );
            }
        }

        PHP;
    }

    private function testPhp(string $namespace, string $studly, string $name, string $moduleId, string $chunk): string
    {
        return <<<PHP
        <?php

        declare(strict_types=1);

        namespace {$namespace}\\Tests\\Unit;

        use Modules\\Moabom\\Apps\\Apps\\AppManifest;
        use PHPUnit\\Framework\\TestCase;

        /**
         * {$studly} 앱 매니페스트(app.json)가 SDK 계약을 만족하는지 검증한다.
         */
        class {$studly}AppManifestTest extends TestCase
        {
            public function test_app_json_is_a_valid_manifest(): void
            {
                \$file = dirname(__DIR__, 2).'/app.json';
                \$this->assertFileExists(\$file);

                \$data = json_decode((string) file_get_contents(\$file), true);
                \$this->assertIsArray(\$data);

                \$manifest = AppManifest::fromArray('{$moduleId}', \$data);

                \$this->assertSame('{$name}', \$manifest->id);
                \$this->assertSame('{$moduleId}', \$manifest->module);
                \$this->assertSame('{$chunk}', \$manifest->frontendChunk);
            }
        }

        PHP;
    }

    /** 프론트 청크 골격을 templates/moabom-basic/src/apps/<name> 에 생성한다. */
    private function scaffoldFrontend(string $name, string $studly, string $camel, string $category): void
    {
        $frontBase = base_path("templates/moabom-basic/src/apps/{$name}");
        if (is_dir($frontBase) && ! $this->option('force')) {
            $this->warn("  skip   프론트 폴더 이미 존재: templates/moabom-basic/src/apps/{$name} (--force 로 덮어쓰기)");

            return;
        }

        $repl = [
            '__APP_ID__' => $name,
            '__STUDLY__' => $studly,
            '__CAMEL__' => $camel,
            '__NAME__' => $name,
            '__CATEGORY__' => $category === 'user' ? 'user' : 'basic',
        ];
        $apply = static fn (string $tpl): string => strtr($tpl, $repl);

        $files = [
            'metadata.ts' => $apply($this->feMetadata()),
            "{$studly}App.tsx" => $apply($this->feComponent()),
            'shellRegister.ts' => $apply($this->feShellRegister()),
            'index.ts' => $apply($this->feIndex()),
        ];

        if (! is_dir($frontBase) && ! mkdir($frontBase, 0775, true) && ! is_dir($frontBase)) {
            $this->error("프론트 디렉토리 생성 실패: {$frontBase}");

            return;
        }
        foreach ($files as $rel => $contents) {
            file_put_contents("{$frontBase}/{$rel}", $contents);
            $this->line("  created  templates/moabom-basic/src/apps/{$name}/{$rel}");
        }
    }

    /** autoload-extensions.php 커밋본에 PSR-4 + classmap 항목을 추가(멱등). */
    private function updateAutoload(string $namespace, string $moduleId, string $studly): void
    {
        $path = base_path('bootstrap/cache/autoload-extensions.php');
        if (! is_file($path)) {
            $this->warn('  skip   autoload-extensions.php 없음 — extension:update-autoload 로 생성 필요');

            return;
        }
        $content = (string) file_get_contents($path);
        $changed = false;

        $anchorPsr4 = "    'psr4' => [\n";
        if (strpos($content, "modules/{$moduleId}/src/") === false && strpos($content, $anchorPsr4) !== false) {
            $psr4Line = '        "Modules\\\\Moabom\\\\'.$studly.'\\\\" => "modules/'.$moduleId.'/src/",'."\n";
            $content = str_replace($anchorPsr4, $anchorPsr4.$psr4Line, $content);
            $changed = true;
        }

        $anchorClass = "    'classmap' => [\n";
        if (strpos($content, "\"modules/{$moduleId}/module.php\"") === false && strpos($content, $anchorClass) !== false) {
            $classLine = '        "modules/'.$moduleId.'/module.php",'."\n";
            $content = str_replace($anchorClass, $anchorClass.$classLine, $content);
            $changed = true;
        }

        if ($changed) {
            file_put_contents($path, $content);
            $this->line('  updated  bootstrap/cache/autoload-extensions.php (PSR-4 + classmap)');
        }
    }

    /** hospital-default 패키지에 모듈을 등록(멱등). sirsoft-ecommerce 앞에 삽입. */
    private function provisionHospitalDefault(string $moduleId): void
    {
        $path = base_path('modules/moabom-system/database/saas/packages/hospital-default.json');
        if (! is_file($path)) {
            $this->warn('  skip   hospital-default.json 없음 — 수동 등록 필요');

            return;
        }
        $data = json_decode((string) file_get_contents($path), true);
        if (! is_array($data)) {
            $this->warn('  skip   hospital-default.json 파싱 실패');

            return;
        }

        $changed = false;
        if (isset($data['modules']) && is_array($data['modules']) && ! in_array($moduleId, $data['modules'], true)) {
            $data['modules'] = $this->insertBefore($data['modules'], $moduleId, 'sirsoft-ecommerce');
            $changed = true;
        }
        $decl = $data['post_bootstrap_artisan']['module_sync_declarations'] ?? null;
        if (is_array($decl) && ! in_array($moduleId, $decl, true)) {
            $data['post_bootstrap_artisan']['module_sync_declarations'] = $this->insertBefore($decl, $moduleId, 'sirsoft-ecommerce');
            $changed = true;
        }

        if ($changed) {
            file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n");
            $this->line('  updated  hospital-default.json (modules + module_sync_declarations)');
        }
    }

    /** $before 항목 앞에 $value 를 삽입(없으면 끝에). */
    private function insertBefore(array $list, string $value, string $before): array
    {
        $idx = array_search($before, $list, true);
        if ($idx === false) {
            $list[] = $value;

            return array_values($list);
        }
        array_splice($list, (int) $idx, 0, [$value]);

        return array_values($list);
    }

    private function feMetadata(): string
    {
        return <<<'TS'
        import type { App } from '../../data/Moa_apps';

        export const __CAMEL__AppMetadata: App = {
          id: '__APP_ID__',
          name: '__NAME__',
          description: '',
          defaultLocale: 'ko',
          icon: 'cube',
          gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          category: '__CATEGORY__',
          source: 'system',
        };

        TS;
    }

    private function feComponent(): string
    {
        return <<<'TS'
        import { useState } from 'react';
        import { Div } from '../../components/basic/Div';
        import { AppTabsShell, type AppTab } from '../_shared';

        export function __STUDLY__App() {
          const [activeTab, setActiveTab] = useState('home');

          const tabs: AppTab[] = [
            {
              key: 'home',
              no: '01',
              icon: 'house',
              label: '홈',
              content: (
                <Div className="p-4 text-sm text-muted">
                  __NAME__ 앱 시작점입니다. 탭과 콘텐츠를 채우세요.
                </Div>
              ),
            },
          ];

          return (
            <AppTabsShell
              title="__NAME__"
              icon="cube"
              tabs={tabs}
              activeKey={activeTab}
              onActiveKeyChange={setActiveTab}
            />
          );
        }

        TS;
    }

    private function feShellRegister(): string
    {
        return <<<'TS'
        import type { ComponentType } from 'react';
        import { __STUDLY__App } from './__STUDLY__App';
        import { __CAMEL__AppMetadata } from './metadata';

        const w = window as unknown as { moabomShellApps?: Record<string, ComponentType> };
        w.moabomShellApps = w.moabomShellApps ?? {};
        w.moabomShellApps[__CAMEL__AppMetadata.id] = __STUDLY__App;

        export {};

        TS;
    }

    private function feIndex(): string
    {
        return <<<'TS'
        export { __STUDLY__App } from './__STUDLY__App';
        export { __CAMEL__AppMetadata } from './metadata';

        TS;
    }
}
