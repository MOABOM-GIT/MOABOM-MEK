#!/usr/bin/env bash
# v279 등 purge artisan 명령 배포 전 — tenant legacy moabom_system_generated_apps 일괄 삭제 (1회성)
#
# Usage:
#   bash deploy/run-purge-tenant-legacy-inline.sh --dry-run
#   bash deploy/run-purge-tenant-legacy-inline.sh --force
#
# platform(moabom-platform) 은 건드리지 않음. 배포 후 moabom:apps:purge-tenant-legacy-generated 사용 권장.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIMEOUT="${MOABOM_PURGE_LEGACY_TIMEOUT:-900s}"

# shellcheck source=lib/cloud-run-artisan-job.sh
source "${ROOT}/deploy/lib/cloud-run-artisan-job.sh"

dry_run=0
force=0
for arg in "$@"; do
  case "${arg}" in
    --dry-run) dry_run=1 ;;
    --force) force=1 ;;
    *)
      echo "Unknown arg: ${arg} (use --dry-run or --force)" >&2
      exit 1
      ;;
  esac
done

if [[ "${dry_run}" -eq 0 && "${force}" -eq 0 ]]; then
  echo "Specify --dry-run or --force" >&2
  exit 1
fi

job_name="moabom-purge-tenant-legacy-inline"
image="$(moabom_container_image)"
service_account="$(moabom_cloud_run_job_service_account)"
boot_sleep="${MOABOM_CRJ_BOOT_SLEEP:-10}"

php_script="$(mktemp)"
trap 'rm -f "${php_script}"' EXIT

cat >"${php_script}" <<'PHP'
<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\System\Saas\SaasMysqlPdoFactory;
use Modules\Moabom\System\Saas\TenantRecord;

$dryRun = (bool) getenv('MOABOM_PURGE_LEGACY_DRY_RUN');

GeneratedAppsConnection::register();

$platformDb = (string) config('moabom-system.saas.platform_database', 'moabom-platform');
$write = SaasMysqlPdoFactory::writeSlice();
$mainDb = (string) ($write['database'] ?? '');

/** @var list<array{label: string, db: string}> $targets */
$targets = [];

if ($mainDb !== '' && $mainDb !== $platformDb) {
    $targets[] = ['label' => 'main-write', 'db' => $mainDb];
}

if (Schema::connection(GeneratedAppsConnection::NAME)->hasTable('moabom_saas_tenants')) {
    $rows = DB::connection(GeneratedAppsConnection::NAME)
        ->table('moabom_saas_tenants')
        ->where('status', 'active')
        ->orderBy('slug')
        ->get();

    foreach ($rows as $row) {
        $tenant = TenantRecord::fromRow((array) $row);
        $targets[] = ['label' => $tenant->slug, 'db' => $tenant->dbDatabase];
    }
}

$appsDeleted = 0;
$rowsDeleted = 0;
$databasesScanned = 0;

foreach ($targets as $target) {
    $database = trim((string) ($target['db'] ?? ''));
    $label = (string) ($target['label'] ?? 'unknown');
    if ($database === '') {
        echo "--- {$label} (skip: empty db)\n";
        continue;
    }

    $connection = (string) config('database.default', 'mysql');
    $original = config("database.connections.{$connection}");
    if (! is_array($original)) {
        echo "--- {$label} (skip: no connection config)\n";
        continue;
    }

    $config = $original;
    if (isset($config['write']) && is_array($config['write'])) {
        $config['write']['database'] = $database;
    }
    if (isset($config['read']) && is_array($config['read'])) {
        $config['read']['database'] = $database;
    }
    if (! isset($config['write'])) {
        $config['database'] = $database;
    }

    config(["database.connections.{$connection}" => $config]);
    DB::purge($connection);
    DB::reconnect($connection);

    try {
        $databasesScanned++;

        if (! Schema::connection($connection)->hasTable('moabom_system_generated_apps')) {
            echo "--- {$label} (db={$database}) (no apps table)\n";
            continue;
        }

        $appsCount = (int) DB::connection($connection)->table('moabom_system_generated_apps')->count();
        $rowsCount = 0;
        if (Schema::connection($connection)->hasTable('moabom_generated_app_rows')) {
            $rowsCount = (int) DB::connection($connection)->table('moabom_generated_app_rows')->count();
        }

        echo "--- {$label} (db={$database}) apps={$appsCount} rows={$rowsCount}\n";

        if ($dryRun || ($appsCount === 0 && $rowsCount === 0)) {
            continue;
        }

        if ($rowsCount > 0) {
            $deleted = (int) DB::connection($connection)->table('moabom_generated_app_rows')->delete();
            $rowsDeleted += $deleted;
            echo "  deleted rows={$deleted}\n";
        }

        if ($appsCount > 0) {
            $deleted = (int) DB::connection($connection)->table('moabom_system_generated_apps')->delete();
            $appsDeleted += $deleted;
            echo "  deleted apps={$deleted}\n";
        }
    } finally {
        config(["database.connections.{$connection}" => $original]);
        DB::purge($connection);
        DB::reconnect($connection);
    }
}

$suffix = $dryRun ? ' (dry-run)' : '';
echo "SUMMARY databases={$databasesScanned} apps_deleted={$appsDeleted} rows_deleted={$rowsDeleted}{$suffix}\n";
PHP

php_b64="$(base64 -w0 <"${php_script}")"

shell_cmd="sleep ${boot_sleep} && export MOABOM_PURGE_LEGACY_DRY_RUN=${dry_run} && echo ${php_b64} | base64 -d > /tmp/purge-tenant-legacy.php && php artisan tinker --execute=\"require '/tmp/purge-tenant-legacy.php';\""

job_env_file="$(mktemp)"
sed 's/^INSTALLER_COMPLETED: "true"/INSTALLER_COMPLETED: "false"/' \
  "${MOABOM_CRJ_ENV_FILE}" > "${job_env_file}"
trap "rm -f '${job_env_file}' '${php_script}'" EXIT

service_account_args=()
if [[ -n "${service_account}" ]]; then
  service_account_args=(--service-account="${service_account}")
fi

echo "== ${job_name} image=${image} dry_run=${dry_run} ==" >&2

if ! gcloud run jobs describe "${job_name}" \
  --region="${MOABOM_CRJ_REGION}" --project="${MOABOM_CRJ_PROJECT}" &>/dev/null; then
  gcloud run jobs create "${job_name}" \
    --region="${MOABOM_CRJ_REGION}" \
    --project="${MOABOM_CRJ_PROJECT}" \
    --image="${image}" \
    "${service_account_args[@]}" \
    --set-cloudsql-instances="${MOABOM_CRJ_SQL}" \
    --env-vars-file="${job_env_file}" \
    --set-secrets="${MOABOM_CRJ_SECRETS}" \
    --command=bash \
    --args=-lc,"${shell_cmd}" \
    --tasks=1 \
    --max-retries=0 \
    --task-timeout="${TIMEOUT}"
else
  gcloud run jobs update "${job_name}" \
    --region="${MOABOM_CRJ_REGION}" \
    --project="${MOABOM_CRJ_PROJECT}" \
    --image="${image}" \
    "${service_account_args[@]}" \
    --set-cloudsql-instances="${MOABOM_CRJ_SQL}" \
    --env-vars-file="${job_env_file}" \
    --set-secrets="${MOABOM_CRJ_SECRETS}" \
    --command=bash \
    --args=-lc,"${shell_cmd}" \
    --task-timeout="${TIMEOUT}"
fi

exec_name="$(gcloud run jobs execute "${job_name}" \
  --region="${MOABOM_CRJ_REGION}" \
  --project="${MOABOM_CRJ_PROJECT}" \
  --format='value(metadata.name)' \
  --quiet \
  --wait)"

exit_code="$(gcloud run jobs executions describe "${exec_name}" \
  --region="${MOABOM_CRJ_REGION}" \
  --project="${MOABOM_CRJ_PROJECT}" \
  --format='value(status.succeededCount)' 2>/dev/null || echo "0")"

gcloud logging read \
  "resource.type=\"cloud_run_job\"
   resource.labels.job_name=\"${job_name}\"
   labels.\"run.googleapis.com/execution_name\"=\"${exec_name}\"" \
  --project="${MOABOM_CRJ_PROJECT}" \
  --limit=30 \
  --format='value(textPayload)' 2>/dev/null \
  | grep -E '^(---|SUMMARY|  deleted)' || true

if [[ "${exit_code}" != "1" ]]; then
  echo "FAIL: job execution ${exec_name} (succeededCount=${exit_code})" >&2
  exit 1
fi

echo "${exec_name}"
