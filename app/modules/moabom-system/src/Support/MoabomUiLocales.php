<?php

namespace Modules\Moabom\System\Support;

/**
 * Moabom UI 언어 카탈로그 — 코어 수정 없이 템플릿 lang·G7 supported_locales 와 정렬합니다.
 */
final class MoabomUiLocales
{
    public const USER_TEMPLATE_ID = 'moabom-basic';

    /** 마이페이지·프론트 UI 언어 표시 순서 (한국어 → 영어 → 일본어 → 중국어) */
    public const UI_LOCALE_ORDER = ['ko', 'en', 'ja', 'zh'];

    /** @var list<string> */
    private const FALLBACK_UI_LOCALES = self::UI_LOCALE_ORDER;

    /**
     * @param  list<string>  $locales
     * @return list<string>
     */
    private static function orderUiLocales(array $locales): array
    {
        $set = array_fill_keys($locales, true);
        $ordered = [];
        foreach (self::UI_LOCALE_ORDER as $code) {
            if (isset($set[$code])) {
                $ordered[] = $code;
                unset($set[$code]);
            }
        }
        foreach (array_keys($set) as $extra) {
            $ordered[] = $extra;
        }

        return $ordered;
    }

    /**
     * @return list<string>
     */
    public static function templateOverlayLocales(): array
    {
        $dir = self::resolveUserTemplateLangDir();
        if ($dir === null) {
            return self::FALLBACK_UI_LOCALES;
        }

        $locales = [];
        foreach (glob($dir.'/*.json') ?: [] as $file) {
            $code = pathinfo($file, PATHINFO_FILENAME);
            if ($code !== '' && preg_match('/^[a-z]{2}(-[A-Za-z0-9]+)?$/', $code) === 1) {
                $locales[] = $code;
            }
        }

        if ($locales === []) {
            return self::FALLBACK_UI_LOCALES;
        }

        return self::orderUiLocales(array_values(array_unique($locales)));
    }

    /**
     * @return list<string>
     */
    public static function supportedCoreLocales(): array
    {
        $locales = config('app.supported_locales', ['ko', 'en']);

        return is_array($locales) ? array_values($locales) : ['ko', 'en'];
    }

    /**
     * @return list<string>
     */
    public static function allowedUiLocaleIds(): array
    {
        return self::templateOverlayLocales();
    }

    public static function isAllowed(string $locale): bool
    {
        return in_array($locale, self::allowedUiLocaleIds(), true);
    }

    /**
     * Moabom UI 언어 → Laravel App::locale.
     * 코어 supported_locales 에 있으면 그대로, 없으면 en(또는 첫 코어 로케일)로 API·관리자 축을 맞춥니다.
     */
    public static function toAppLocale(string $language): string
    {
        if (! self::isAllowed($language)) {
            return (string) config('app.locale', 'ko');
        }

        $core = self::supportedCoreLocales();
        if (in_array($language, $core, true)) {
            return $language;
        }

        // UI 전용 로케일(템플릿 lang 파일)은 Laravel API 메시지용으로 en 우선
        if (in_array('en', $core, true)) {
            return 'en';
        }

        return $core[0] ?? 'ko';
    }

    /**
     * 프론트·관리자 API용 로케일 메타 (코어 config 읽기만, 쓰기 없음).
     *
     * @return array{
     *   supported_locales: list<string>,
     *   locale_names: array<string, string>,
     *   ui_locales: list<string>,
     *   ui_locale_names: array<string, string>
     * }
     */
    public static function catalog(): array
    {
        $uiLocales = self::templateOverlayLocales();
        $coreNames = config('app.locale_names', []);
        $coreNames = is_array($coreNames) ? $coreNames : [];

        $uiNames = [];
        foreach ($uiLocales as $code) {
            $uiNames[$code] = is_string($coreNames[$code] ?? null)
                ? $coreNames[$code]
                : self::defaultNativeLabel($code);
        }

        return [
            'supported_locales' => self::supportedCoreLocales(),
            'locale_names' => $coreNames,
            'ui_locales' => $uiLocales,
            'ui_locale_names' => $uiNames,
            'core_sync_locales' => self::coreSyncLocaleMap($uiLocales),
        ];
    }

    /**
     * Moabom UI 로케일 → G7 `users.language` / API 축 매핑.
     *
     * @param  list<string>  $uiLocales
     * @return array<string, string>
     */
    public static function coreSyncLocaleMap(array $uiLocales): array
    {
        $core = self::supportedCoreLocales();
        $fallback = in_array('en', $core, true) ? 'en' : ($core[0] ?? 'ko');
        $map = [];
        foreach ($uiLocales as $code) {
            $map[$code] = in_array($code, $core, true) ? $code : $fallback;
        }

        return $map;
    }

    /**
     * 관리자 preferences.languages 행 목록을 템플릿·저장값과 병합합니다.
     *
     * @param  list<array{id: string, label?: string, enabled?: bool}>|null  $stored
     * @return list<array{id: string, label: string, enabled: bool}>
     */
    public static function mergeLanguagePreferenceRows(?array $stored): array
    {
        $storedById = [];
        foreach ($stored ?? [] as $row) {
            if (! is_array($row) || ! isset($row['id']) || ! is_string($row['id'])) {
                continue;
            }
            $storedById[$row['id']] = $row;
        }

        $catalog = self::catalog();
        $coreLocales = self::supportedCoreLocales();
        $out = [];
        foreach ($catalog['ui_locales'] as $id) {
            $prev = $storedById[$id] ?? [];
            $label = is_string($prev['label'] ?? null) && trim($prev['label']) !== ''
                ? $prev['label']
                : ($catalog['ui_locale_names'][$id] ?? self::defaultNativeLabel($id));
            $enabled = array_key_exists('enabled', $prev)
                ? (bool) $prev['enabled']
                : in_array($id, $coreLocales, true);
            $out[] = [
                'id' => $id,
                'label' => $label,
                'enabled' => $enabled,
            ];
        }

        return $out;
    }

    /**
     * 마이페이지 언어 선택에 노출 가능한 UI 로케일.
     * G7 supported_locales 에 등록된 언어 + 템플릿 오버레이 lang 파일이 있는 언어.
     *
     * @return list<string>
     */
    public static function mypageSelectableUiLocales(): array
    {
        $overlay = self::templateOverlayLocales();
        $core = self::supportedCoreLocales();

        return self::orderUiLocales(array_values(array_unique(array_merge($core, $overlay))));
    }

    private static function resolveUserTemplateLangDir(): ?string
    {
        $id = self::USER_TEMPLATE_ID;
        $dir = base_path("templates/{$id}/lang");
        if (is_dir($dir)) {
            return $dir;
        }

        return null;
    }

    private static function defaultNativeLabel(string $code): string
    {
        return match ($code) {
            'ko' => '한국어',
            'en' => 'English',
            'ja' => '日本語',
            'zh' => '中文',
            default => strtoupper($code),
        };
    }
}
