<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services;

use App\Services\TemplateService;
use Illuminate\Support\Facades\File;

/**
 * 병합 lang JSON 을 public/ext-static 에 기록해 nginx 가 PHP 없이 서빙하게 한다.
 * API serveLanguage 와 동일하게 TemplateService::getLanguageDataWithModules 결과를 쓴다.
 */
final class MoabomWarmTemplateLangStatic
{
    /** @var list<string> */
    public const DEFAULT_TEMPLATES = ['moabom-basic', 'moabom-admin_basic'];

    /** @var list<string> */
    public const DEFAULT_LOCALES = ['ko', 'en', 'ja', 'zh'];

    public function __construct(
        private readonly TemplateService $templateService,
    ) {}

    /**
     * @param  list<string>|null  $templates
     * @param  list<string>|null  $locales
     * @return array{written: list<string>, skipped: list<string>}
     */
    public function warm(?array $templates = null, ?array $locales = null): array
    {
        $templates ??= self::DEFAULT_TEMPLATES;
        $locales ??= self::DEFAULT_LOCALES;
        $written = [];
        $skipped = [];

        foreach ($templates as $templateId) {
            $templateId = trim((string) $templateId);
            if ($templateId === '' || ! preg_match('/^[A-Za-z0-9._-]+$/', $templateId)) {
                continue;
            }

            $dir = public_path('ext-static/lang/'.$templateId);
            if (! File::isDirectory($dir)) {
                File::makeDirectory($dir, 0o755, true);
            }

            foreach ($locales as $locale) {
                $locale = strtolower(trim((string) $locale));
                if ($locale === '' || ! preg_match('/^[a-z]{2}$/', $locale)) {
                    continue;
                }

                $relative = "lang/{$templateId}/{$locale}.json";
                $result = $this->templateService->getLanguageDataWithModules($templateId, $locale);
                if (! ($result['success'] ?? false) || ! is_array($result['data'] ?? null)) {
                    $skipped[] = $relative;

                    continue;
                }

                $json = json_encode(
                    $result['data'],
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
                );
                if ($json === false) {
                    $skipped[] = $relative;

                    continue;
                }

                $target = $dir.'/'.$locale.'.json';
                $tmp = $target.'.tmp.'.getmypid();
                if (File::put($tmp, $json) === false) {
                    $skipped[] = $relative;

                    continue;
                }

                if (! @rename($tmp, $target)) {
                    @unlink($tmp);
                    $skipped[] = $relative;

                    continue;
                }

                $written[] = $relative;
            }
        }

        return ['written' => $written, 'skipped' => $skipped];
    }
}
