<?php

namespace Modules\Moabom\System\Saas;

/**
 * 플랫폼 레지스트리(moabom_saas_tenants) 1행.
 */
final readonly class TenantRecord
{
    public function __construct(
        public int $id,
        public string $slug,
        public string $host,
        public string $dbDatabase,
        public string $gcsPrefix,
        public string $packageId,
        public string $status,
        public ?string $appUrl = null,
        public ?string $displayName = null,
        public ?string $region = null,
        public ?string $address = null,
    ) {}

    public function note(): ?string
    {
        return $this->region;
    }

    /**
     * @param  array<string, mixed>  $row
     */
    public static function fromRow(array $row): self
    {
        return new self(
            id: (int) ($row['id'] ?? 0),
            slug: (string) ($row['slug'] ?? ''),
            host: (string) ($row['host'] ?? ''),
            dbDatabase: (string) ($row['db_database'] ?? ''),
            gcsPrefix: (string) ($row['gcs_prefix'] ?? ''),
            packageId: (string) ($row['package_id'] ?? ''),
            status: (string) ($row['status'] ?? ''),
            appUrl: isset($row['app_url']) ? (string) $row['app_url'] : null,
            displayName: self::nullableString($row, 'display_name'),
            region: self::nullableString($row, 'note') ?? self::nullableString($row, 'region'),
            address: self::nullableString($row, 'address'),
        );
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isPurging(): bool
    {
        return $this->status === 'purging';
    }

    public function isPlatformHost(): bool
    {
        $platformHosts = array_map(
            'strtolower',
            (array) config('moabom-system.saas.platform_hosts', []),
        );

        return in_array(strtolower($this->host), $platformHosts, true);
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private static function nullableString(array $row, string $key): ?string
    {
        if (! array_key_exists($key, $row)) {
            return null;
        }
        $value = $row[$key];
        if ($value === null) {
            return null;
        }

        $value = (string) $value;

        return $value === '' ? null : $value;
    }
}
