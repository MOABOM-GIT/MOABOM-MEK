#!/usr/bin/env bash
# 플랫폼 DB(moabom-db) → 테넌트 DB 전체 복제 (templates·layouts 포함)
# Usage: bash deploy/saas-clone-tenant.sh hospital_freshent
set -euo pipefail

TARGET_DB="${1:?Usage: saas-clone-tenant.sh <target_database>}"
SOURCE_DB="${SAAS_CLONE_SOURCE_DB:-moabom-db}"

echo "[saas-clone-tenant] ${SOURCE_DB} → ${TARGET_DB}"
php modules/moabom-system/database/saas-clone-tenant-db.php "${TARGET_DB}"
echo "[saas-clone-tenant] done"
