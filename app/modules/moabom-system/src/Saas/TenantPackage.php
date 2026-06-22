<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

/**
 * SaaS 테넌트 provision package — extension·artisan 시드 SSOT.
 *
 * @phpstan-type PackageArray array{
 *   id: string,
 *   label?: string,
 *   templates?: list<string>,
 *   active_user_template?: string,
 *   active_admin_template?: string,
 *   modules?: list<string>,
 *   plugins?: list<string>,
 *   post_bootstrap_artisan?: array{
 *     module_sync_declarations?: list<string>,
 *     module_refresh_layout?: list<string>,
 *   },
 * }
 */
final readonly class TenantPackage
{
    /**
     * @param  list<string>  $templates
     * @param  list<string>  $modules
     * @param  list<string>  $plugins
     * @param  list<string>  $moduleSyncDeclarations
     * @param  list<string>  $moduleRefreshLayout
     */
    public function __construct(
        public string $id,
        public string $label,
        public array $templates,
        public string $activeUserTemplate,
        public string $activeAdminTemplate,
        public array $modules,
        public array $plugins,
        public array $moduleSyncDeclarations,
        public array $moduleRefreshLayout,
    ) {}

    /**
     * @param  PackageArray  $data
     */
    public static function fromArray(array $data): self
    {
        $id = (string) ($data['id'] ?? '');
        if ($id === '') {
            throw new \InvalidArgumentException('package id is required');
        }

        $templates = array_values(array_filter(array_map('strval', $data['templates'] ?? [])));
        $modules = array_values(array_filter(array_map('strval', $data['modules'] ?? [])));
        $plugins = array_values(array_filter(array_map('strval', $data['plugins'] ?? [])));

        $activeUser = (string) ($data['active_user_template'] ?? ($templates[0] ?? 'moabom-basic'));
        $activeAdmin = (string) ($data['active_admin_template'] ?? 'moabom-admin_basic');

        $artisan = is_array($data['post_bootstrap_artisan'] ?? null) ? $data['post_bootstrap_artisan'] : [];

        $explicitRefresh = $artisan['module_refresh_layout'] ?? null;
        if (is_array($explicitRefresh)) {
            $moduleRefreshLayout = array_values(array_filter(array_map('strval', $explicitRefresh)));
        } else {
            $moduleRefreshLayout = array_values(array_intersect(
                $modules,
                ModuleLayoutSyncCatalog::identifiersWithFilesystemLayouts($modules),
            ));
        }

        return new self(
            id: $id,
            label: (string) ($data['label'] ?? $id),
            templates: $templates,
            activeUserTemplate: $activeUser,
            activeAdminTemplate: $activeAdmin,
            modules: $modules,
            plugins: $plugins,
            moduleSyncDeclarations: array_values(array_filter(array_map(
                'strval',
                $artisan['module_sync_declarations'] ?? $modules,
            ))),
            moduleRefreshLayout: $moduleRefreshLayout,
        );
    }
}
