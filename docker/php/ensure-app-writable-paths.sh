#!/bin/sh
# Laravel / G7 가 런타임에 쓰는 bind-mount 디렉터리 권한 정렬.
# PUID/PGID 로 맞춘 www-data(보통 호스트 UID 1000) 가 PHP-FPM·artisan·설치 UI 와 동일해야 함.
# 예전 root exec 또는 호스트 uid 33 www-data 가 만든 33:33 트리는 여기서 1000:1000 으로 복구.
set -eu

APP_ROOT="${APP_ROOT:-/var/www/html}"

# storage·확장·언어팩 — 코어/ExtensionManager/LanguagePackService 가 쓰는 경로
WRITABLE_DIRS="
storage
bootstrap/cache
lang-packs
modules
plugins
templates
"

for envfile in .env .env.testing; do
    if [ -f "${APP_ROOT}/${envfile}" ]; then
        chown www-data:www-data "${APP_ROOT}/${envfile}"
        chmod 600 "${APP_ROOT}/${envfile}"
    fi
done

for dir in $WRITABLE_DIRS; do
    target="${APP_ROOT}/${dir}"
    mkdir -p "${target}"
    chown -R www-data:www-data "${target}"
    chmod -R ug+rwX "${target}"
done

# named volume (vendor, node_modules) — bind mount 가 아니어도 www-data 쓰기 보장
for dir in vendor node_modules; do
    target="${APP_ROOT}/${dir}"
    if [ -d "${target}" ]; then
        mkdir -p "${target}"
        chown -R www-data:www-data "${target}"
        chmod -R ug+rwX "${target}"
    fi
done

# 컨테이너 안 npm/composer 캐시 (template:build, module:build)
for dir in /var/www/.npm /var/www/.config; do
    mkdir -p "${dir}"
    chown -R www-data:www-data "${dir}" 2>/dev/null || true
done
