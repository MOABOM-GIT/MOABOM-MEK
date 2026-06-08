<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Apps;

use InvalidArgumentException;

/**
 * 앱 SDK 매니페스트 1건 (app.json 항목) — deploy/PROJECT-ARCHITECTURE-HARDENING.md (Phase 4).
 *
 * "앱"을 1급 개념으로 만들기 위한 계약. 모듈이 app.json 으로 자신을 앱으로 선언하면
 * AppRegistry 가 집계해 shell-boot apps[] 로 노출하고, 프론트는 매니페스트의 frontend.chunk
 * 로 동적 로드한다. 신규 앱 추가 = 모듈 + app.json (코어/셸 코드 무수정).
 */
final readonly class AppManifest
{
    /**
     * @param  list<string>  $permissions
     */
    public function __construct(
        public string $id,
        public string $module,
        public array|string $name,
        public array|string $description,
        public string $icon,
        public string $gradient,
        public string $category,
        public string $source,
        public ?string $frontendTemplate,
        public ?string $frontendChunk,
        public ?string $frontendGlobal,
        public ?string $apiPrefix,
        public array $permissions,
        public bool $tenantScoped,
        public int $order,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(string $module, array $data): self
    {
        $id = isset($data['id']) ? (string) $data['id'] : '';
        if ($id === '') {
            throw new InvalidArgumentException("app.json ({$module}): 'id' 필수");
        }

        $category = (string) ($data['category'] ?? 'basic');
        if (! in_array($category, ['basic', 'user'], true)) {
            $category = 'basic';
        }

        $source = (string) ($data['source'] ?? 'system');
        if (! in_array($source, ['system', 'user-created'], true)) {
            $source = 'system';
        }

        $frontend = is_array($data['frontend'] ?? null) ? $data['frontend'] : [];

        return new self(
            id: $id,
            module: $module,
            name: $data['name'] ?? $id,
            description: $data['description'] ?? '',
            icon: (string) ($data['icon'] ?? 'cube'),
            gradient: (string) ($data['gradient'] ?? 'linear-gradient(135deg,#6366f1,#8b5cf6)'),
            category: $category,
            source: $source,
            frontendTemplate: isset($frontend['template']) ? (string) $frontend['template'] : null,
            frontendChunk: isset($frontend['chunk']) ? (string) $frontend['chunk'] : null,
            frontendGlobal: isset($frontend['global']) ? (string) $frontend['global'] : null,
            apiPrefix: isset($data['api_prefix']) ? (string) $data['api_prefix'] : null,
            permissions: array_values(array_filter(array_map(
                static fn ($p): string => (string) $p,
                (array) ($data['permissions'] ?? []),
            ))),
            tenantScoped: (bool) ($data['tenant_scoped'] ?? true),
            order: (int) ($data['order'] ?? 100),
        );
    }

    /**
     * shell-boot apps[] 페이로드 형태.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'module' => $this->module,
            'name' => $this->name,
            'description' => $this->description,
            'icon' => $this->icon,
            'gradient' => $this->gradient,
            'category' => $this->category,
            'source' => $this->source,
            'frontend' => [
                'template' => $this->frontendTemplate,
                'chunk' => $this->frontendChunk,
                'global' => $this->frontendGlobal,
            ],
            'api_prefix' => $this->apiPrefix,
            'permissions' => $this->permissions,
            'tenant_scoped' => $this->tenantScoped,
            'order' => $this->order,
        ];
    }
}
