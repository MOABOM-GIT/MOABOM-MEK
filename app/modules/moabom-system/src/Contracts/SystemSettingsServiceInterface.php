<?php

namespace Modules\Moabom\System\Contracts;

interface SystemSettingsServiceInterface
{
    public function getSettingsDefaultsPath(): ?string;

    public function getSetting(string $key, mixed $default = null): mixed;

    public function setSetting(string $key, mixed $value): bool;

    /**
     * 전체 설정을 조회합니다.
     *
     * @return array<string, mixed>
     */
    public function getAllSettings(): array;

    /**
     * 설정을 저장합니다.
     *
     * @param  array<string, mixed>  $settings
     */
    public function saveSettings(array $settings): bool;

    /**
     * TenantSettingsPlane — 카테고리 JSON 전체 replace (stored merge 없음).
     *
     * @param  array<string, mixed>  $settings
     */
    public function replaceSettings(array $settings): bool;

    /**
     * 프론트엔드 노출 설정을 조회합니다.
     *
     * @return array<string, mixed>
     */
    public function getFrontendSettings(): array;

    /**
     * 관리자가 플랫폼 설정을 저장할 때마다 증가하는 정수.
     * 사용자 셸이 로컬 상태를 플랫폼 기본값에 다시 맞출지(localStorage·DB 동기화) 판별합니다.
     */
    public function getFrontendDefaultsRevision(): int;

    /**
     * @param  array<string, mixed>  $storedAppearance
     * @return array<string, mixed>
     */
    public function buildAppearanceApiResponse(array $storedAppearance): array;

    /**
     * @param  array<string, mixed>  $stored
     * @return array<string, mixed>
     */
    public function buildModuleCategoryApiResponse(string $category, array $stored): array;

    public function clearCache(): void;
}
