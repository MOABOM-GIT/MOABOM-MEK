<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Support;

final class FormatBytes
{
    public static function human(int $bytes): string
    {
        if ($bytes < 0) {
            $bytes = 0;
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $value = (float) $bytes;
        $unitIndex = 0;

        while ($value >= 1024 && $unitIndex < count($units) - 1) {
            $value /= 1024;
            $unitIndex++;
        }

        $precision = $unitIndex === 0 ? 0 : 1;

        return sprintf('%s %s', rtrim(rtrim(number_format($value, $precision, '.', ''), '0'), '.'), $units[$unitIndex]);
    }
}
