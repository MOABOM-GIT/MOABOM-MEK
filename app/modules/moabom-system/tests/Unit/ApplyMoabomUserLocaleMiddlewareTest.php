<?php

namespace Modules\Moabom\System\Tests\Unit;

use App\Models\User;
use Illuminate\Http\Request;
use Modules\Moabom\System\Http\Middleware\ApplyMoabomUserLocale;
use Modules\Moabom\System\Models\UserSystemSetting;
use Modules\Moabom\System\Tests\ModuleTestCase;
use Symfony\Component\HttpFoundation\Response;

require_once dirname(__DIR__).'/ModuleTestCase.php';

class ApplyMoabomUserLocaleMiddlewareTest extends ModuleTestCase
{
    public function test_sets_app_locale_en_when_ui_language_is_ja(): void
    {
        $user = User::factory()->create();
        UserSystemSetting::query()->create([
            'user_id' => $user->id,
            'settings' => [
                'preferences' => ['language' => 'ja'],
            ],
        ]);

        $middleware = new ApplyMoabomUserLocale;
        $request = Request::create('/api/example', 'GET');
        $request->headers->set('Authorization', 'Bearer '.$user->createToken('test')->plainTextToken);

        $middleware->handle($request, function (): Response {
            $this->assertSame('en', app()->getLocale());

            return response('ok');
        });
    }

    public function test_sets_app_locale_ko_when_ui_language_is_ko(): void
    {
        $user = User::factory()->create();
        UserSystemSetting::query()->create([
            'user_id' => $user->id,
            'settings' => [
                'preferences' => ['language' => 'ko'],
            ],
        ]);

        $middleware = new ApplyMoabomUserLocale;
        $request = Request::create('/api/example', 'GET');
        $request->headers->set('Authorization', 'Bearer '.$user->createToken('test')->plainTextToken);

        $middleware->handle($request, function (): Response {
            $this->assertSame('ko', app()->getLocale());

            return response('ok');
        });
    }

    public function test_does_not_change_locale_when_setting_missing(): void
    {
        $user = User::factory()->create();
        app()->setLocale('ko');

        $middleware = new ApplyMoabomUserLocale;
        $request = Request::create('/api/example', 'GET');
        $request->headers->set('Authorization', 'Bearer '.$user->createToken('test')->plainTextToken);

        $middleware->handle($request, function (): Response {
            $this->assertSame('ko', app()->getLocale());

            return response('ok');
        });
    }
}
