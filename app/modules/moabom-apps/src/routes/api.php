<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Apps\Http\Controllers\Admin\AppCommunityAdminController;
use Modules\Moabom\Apps\Http\Controllers\Admin\GeneratedAppAdminController;
use Modules\Moabom\Apps\Http\Controllers\AiAppController;
use Modules\Moabom\Apps\Http\Controllers\AiGenerationSessionController;
use Modules\Moabom\Apps\Http\Controllers\AiStreamQueueController;
use Modules\Moabom\Apps\Http\Controllers\AppCommunityController;
use Modules\Moabom\Apps\Http\Controllers\AppSeoController;
use Modules\Moabom\Apps\Http\Controllers\GeneratedAppOwnerDataController;
use Modules\Moabom\Apps\Http\Controllers\GeneratedAppVersionController;
use Modules\Moabom\Apps\Http\Controllers\GeneratedAppWebsiteIconController;
use Modules\Moabom\Apps\Http\Controllers\PublicGeneratedAppController;
use Modules\Moabom\Apps\Http\Controllers\PublicUserGeneratedAppController;
use Modules\Moabom\Apps\Http\Controllers\WebsiteLinkController;

/*
|--------------------------------------------------------------------------
| Moabom Apps Module API Routes
|--------------------------------------------------------------------------
|
| ModuleRouteServiceProvider가 자동으로 prefix를 적용합니다.
| - URL prefix: 'api/modules/moabom-apps'
| - Name prefix: 'api.modules.moabom-apps.'
|
| 모든 엔드포인트는 사용자 본인 자원만 다루므로 `auth:sanctum` 만 사용한다.
|
*/

Route::prefix('seo')->middleware(['throttle:120,1'])->group(function (): void {
    Route::get('apps', [AppSeoController::class, 'index'])
        ->name('seo.apps.index');
    Route::get('apps/{id}', [AppSeoController::class, 'show'])
        ->where('id', '[A-Za-z0-9_-]+')
        ->name('seo.apps.show');
});

Route::prefix('apps')->middleware(['optional.sanctum'])->group(function () {
    Route::get('generated/shared', [PublicGeneratedAppController::class, 'shared'])
        ->name('apps.generated.shared.public');
    Route::get('generated/shared/{id}', [PublicGeneratedAppController::class, 'show'])
        ->whereNumber('id')
        ->name('apps.generated.show.public');
    Route::get('generated/{id}/website-icon', [GeneratedAppWebsiteIconController::class, 'show'])
        ->whereNumber('id')
        ->name('apps.generated.website_icon');

    Route::prefix('generated/{id}/community')->whereNumber('id')->group(function (): void {
        Route::get('summary', [AppCommunityController::class, 'summary'])
            ->name('apps.generated.community.summary');
        Route::get('posts', [AppCommunityController::class, 'index'])
            ->name('apps.generated.community.posts.index');
        Route::get('posts/{postId}', [AppCommunityController::class, 'show'])
            ->whereNumber('postId')
            ->name('apps.generated.community.posts.show');
    });
});

Route::prefix('users/{user:uuid}')->middleware(['optional.sanctum', 'throttle:600,1'])->group(function (): void {
    Route::get('generated-apps', [PublicUserGeneratedAppController::class, 'index'])
        ->name('users.generated_apps.index');
    Route::get('frequent-apps', [PublicUserGeneratedAppController::class, 'frequent'])
        ->name('users.frequent_apps.index');
});

Route::prefix('apps')->middleware(['auth:sanctum'])->group(function () {
    Route::get('community/reviews', [AppCommunityController::class, 'mine'])
        ->name('apps.community.reviews.mine');

    Route::post('ai/generate', [AiAppController::class, 'generate'])
        ->middleware('throttle:20,1')
        ->name('apps.ai.generate');

    Route::post('ai/generate/stream', [AiAppController::class, 'stream'])
        ->middleware('throttle:20,1')
        ->name('apps.ai.generate.stream');

    Route::get('ai/generate/queue', [AiStreamQueueController::class, 'show'])
        ->middleware('throttle:60,1')
        ->name('apps.ai.generate.queue.show');
    Route::delete('ai/generate/queue', [AiStreamQueueController::class, 'destroy'])
        ->middleware('throttle:30,1')
        ->name('apps.ai.generate.queue.destroy');

    Route::get('ai/sessions/active', [AiGenerationSessionController::class, 'active'])
        ->name('apps.ai.sessions.active');
    Route::delete('ai/sessions/streaming', [AiGenerationSessionController::class, 'cancelStreaming'])
        ->name('apps.ai.sessions.cancel_streaming');
    Route::get('ai/sessions/{id}', [AiGenerationSessionController::class, 'show'])
        ->whereNumber('id')
        ->name('apps.ai.sessions.show');
    Route::delete('ai/sessions/{id}', [AiGenerationSessionController::class, 'destroy'])
        ->whereNumber('id')
        ->name('apps.ai.sessions.destroy');

    Route::get('generated/library', [AiAppController::class, 'library'])
        ->name('apps.generated.library');
    Route::get('generated', [AiAppController::class, 'index'])
        ->name('apps.generated.index');
    Route::get('generated/{id}', [AiAppController::class, 'show'])
        ->whereNumber('id')
        ->name('apps.generated.show');
    Route::post('generated', [AiAppController::class, 'store'])
        ->name('apps.generated.store');
    Route::post('website-link/resolve', [WebsiteLinkController::class, 'resolve'])
        ->middleware('throttle:30,1')
        ->name('apps.website_link.resolve');
    Route::put('generated/{id}', [AiAppController::class, 'update'])
        ->whereNumber('id')
        ->name('apps.generated.update');
    Route::get('generated/{id}/revisions', [GeneratedAppVersionController::class, 'index'])
        ->whereNumber('id')
        ->middleware('throttle:60,1')
        ->name('apps.generated.revisions.index');
    Route::get('generated/{id}/revisions/{revisionId}', [GeneratedAppVersionController::class, 'show'])
        ->whereNumber('id')
        ->whereNumber('revisionId')
        ->middleware('throttle:60,1')
        ->name('apps.generated.revisions.show');
    Route::post('generated/{id}/revisions/{revisionId}/restore', [GeneratedAppVersionController::class, 'restore'])
        ->whereNumber('id')
        ->whereNumber('revisionId')
        ->middleware('throttle:20,1')
        ->name('apps.generated.revisions.restore');
    Route::patch('generated/{id}/share', [AiAppController::class, 'share'])
        ->whereNumber('id')
        ->name('apps.generated.share');
    Route::delete('generated/{id}', [AiAppController::class, 'destroy'])
        ->whereNumber('id')
        ->name('apps.generated.destroy');

    Route::get('generated/{id}/data-tables', [GeneratedAppOwnerDataController::class, 'tables'])
        ->whereNumber('id')
        ->middleware('throttle:60,1')
        ->name('apps.generated.data.tables');
    Route::get('generated/{id}/data/{tableKey}', [GeneratedAppOwnerDataController::class, 'index'])
        ->whereNumber('id')
        ->where('tableKey', '[A-Za-z0-9_-]+')
        ->middleware('throttle:60,1')
        ->name('apps.generated.data.index');
    Route::delete('generated/{id}/data/{tableKey}/{rowId}', [GeneratedAppOwnerDataController::class, 'destroy'])
        ->whereNumber('id')
        ->where('tableKey', '[A-Za-z0-9_-]+')
        ->whereNumber('rowId')
        ->middleware('throttle:30,1')
        ->name('apps.generated.data.destroy');
    Route::get('generated/{id}/data-export', [GeneratedAppOwnerDataController::class, 'export'])
        ->whereNumber('id')
        ->middleware('throttle:20,1')
        ->name('apps.generated.data.export');

    Route::prefix('generated/{id}/community')->whereNumber('id')->group(function (): void {
        Route::post('posts', [AppCommunityController::class, 'store'])
            ->middleware('throttle:30,1')
            ->name('apps.generated.community.posts.store');
        Route::put('posts/{postId}', [AppCommunityController::class, 'update'])
            ->whereNumber('postId')
            ->middleware('throttle:30,1')
            ->name('apps.generated.community.posts.update');
        Route::delete('posts/{postId}', [AppCommunityController::class, 'destroy'])
            ->whereNumber('postId')
            ->middleware('throttle:30,1')
            ->name('apps.generated.community.posts.destroy');
    });
});

Route::prefix('admin')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::prefix('generated-apps')->group(function () {
        Route::get('/', [GeneratedAppAdminController::class, 'index'])
            ->middleware('permission:admin,moabom-apps.generated.read')
            ->name('admin.generated-apps.index');
        Route::get('{id}', [GeneratedAppAdminController::class, 'show'])
            ->whereNumber('id')
            ->middleware('permission:admin,moabom-apps.generated.read')
            ->name('admin.generated-apps.show');
        Route::patch('{id}/visibility', [GeneratedAppAdminController::class, 'updateVisibility'])
            ->whereNumber('id')
            ->middleware('permission:admin,moabom-apps.generated.manage')
            ->name('admin.generated-apps.visibility');
        Route::delete('{id}', [GeneratedAppAdminController::class, 'destroy'])
            ->whereNumber('id')
            ->middleware('permission:admin,moabom-apps.generated.manage')
            ->name('admin.generated-apps.destroy');
    });

    Route::prefix('app-community')->group(function (): void {
        Route::get('posts', [AppCommunityAdminController::class, 'index'])
            ->middleware('permission:admin,moabom-apps.community.read')
            ->name('admin.app-community.posts.index');
        Route::get('posts/{id}', [AppCommunityAdminController::class, 'show'])
            ->whereNumber('id')
            ->middleware('permission:admin,moabom-apps.community.read')
            ->name('admin.app-community.posts.show');
        Route::patch('posts/{id}/status', [AppCommunityAdminController::class, 'updateStatus'])
            ->whereNumber('id')
            ->middleware('permission:admin,moabom-apps.community.manage')
            ->name('admin.app-community.posts.status');
        Route::delete('posts/{id}', [AppCommunityAdminController::class, 'destroy'])
            ->whereNumber('id')
            ->middleware('permission:admin,moabom-apps.community.manage')
            ->name('admin.app-community.posts.destroy');
    });
});
