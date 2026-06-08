#!/bin/sh
set -eu

# Moabom 로컬 개발: bind mount(./app)와 PHP-FPM(www-data) UID/GID 정렬 + Laravel 쓰기 경로 보장.
# 프로덕션(deploy/Dockerfile)에는 포함하지 않음.

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

if [ "$(id -u www-data)" != "$PUID" ] || [ "$(id -g www-data)" != "$PGID" ]; then
    groupmod -o -g "$PGID" www-data 2>/dev/null || true
    usermod -o -u "$PUID" -g www-data www-data 2>/dev/null || true
fi

. /usr/local/bin/ensure-app-writable-paths.sh

exec docker-php-entrypoint php-fpm
