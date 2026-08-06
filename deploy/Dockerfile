# Cloud Run용 프로덕션 이미지 (nginx + php-fpm, bind mount 없음)
#
# !!! 이 Dockerfile 은 Google Cloud Build 전용입니다 !!!
#   - 운영 진입점: ./deploy/build-and-deploy.sh  (= gcloud builds submit --config deploy/cloudbuild-v3.yaml)
#   - 로컬 docker build 금지 — 활성 modules/templates/plugins 만 이미지에 포함되도록
#     .dockerignore + .gcloudignore 양쪽에서 _bundled / node_modules / sirsoft 등을 제외하며,
#     이 가드는 의도치 않은 로컬 빌드로 잘못된 이미지가 만들어지는 사고를 막습니다.
#   - 로컬 개발 컨테이너는 docker-compose + docker-compose.override.yml + ./docker/php/Dockerfile (별도 이미지)
#
# 예외 빌드는 운영 경로가 아니다. 결과 이미지는 Cloud Run 에 push/deploy 하지 않는다.

# --- 1) Composer dependencies ---
FROM composer:2 AS vendor

# >>> Cloud Build 전용 가드 (재발 방지: 로컬에서 운영 이미지 빌드 차단) <<<
ARG MOABOM_BUILD_ENV=local
ARG MOABOM_LOCAL_BUILD_ACK=0
RUN if [ "$MOABOM_BUILD_ENV" != "cloudbuild" ] && [ "$MOABOM_LOCAL_BUILD_ACK" != "1" ]; then \
      echo ""; \
      echo "================================================================"; \
      echo " ERROR: deploy/Dockerfile 은 Google Cloud Build 전용입니다."; \
      echo "        활성 modules/templates 만 패키징해야 하므로 로컬 빌드 금지."; \
      echo ""; \
      echo " 올바른 명령:"; \
      echo "   ./deploy/build-and-deploy.sh         # 검증 + Cloud Build + Cloud Run"; \
      echo "   ./deploy/build-and-deploy.sh --async # 비동기 (배포는 별도)"; \
      echo ""; \
      echo " 운영 이미지는 Cloud Build 경로로만 생성하세요."; \
      echo "================================================================"; \
      echo ""; \
      exit 1; \
    fi

WORKDIR /app
COPY app/composer.json app/composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

COPY app/ ./
COPY scripts/generate-extension-autoload.php /usr/local/bin/generate-extension-autoload.php
# moabom-chat SSOT — 부분 api.php 가 이미지에 들어가면 즉시 빌드 실패
RUN grep -q "Route::delete('blocks/{userUuid}'" modules/moabom-chat/src/routes/api.php \
 && grep -q "Route::delete('conversations/{conversationUuid}'" modules/moabom-chat/src/routes/api.php \
 && grep -q '\[0-9a-f\]{8}-\[0-9a-f\]{4}-\[0-9a-f\]{4}-\[0-9a-f\]{4}-\[0-9a-f\]{12}' modules/moabom-chat/src/routes/api.php \
 && grep -q registerMissingUserRoutes modules/moabom-chat/src/Providers/ChatServiceProvider.php \
 || (echo "ERROR: moabom-chat SSOT routes/provider guard missing in image context" && exit 1)
# 빌드 단계: .env·DB 없이 autoload + package discover (GCS 드라이버 등록)
RUN rm -f .env .env.* 2>/dev/null || true \
    && mkdir -p bootstrap/cache storage/framework/cache/data storage/framework/sessions storage/framework/views \
    && composer dump-autoload --optimize --no-dev --no-scripts \
    && FILESYSTEM_DISK=local APP_ENV=local G7_JSON_SETTINGS_CACHE_TTL=0 php artisan package:discover --ansi --no-interaction \
    && php /usr/local/bin/generate-extension-autoload.php /app \
    && test -s bootstrap/cache/autoload-extensions.php

# --- 2) Frontend build (G7 core + 활성 템플릿 dist) ---
FROM node:22-bookworm-slim AS assets
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
COPY deploy/check-bundle-budget.sh ./deploy/check-bundle-budget.sh
# 코어 번들 (public/build/core) — 실패 시 구 번들 실어 올리면 DataGate/엔진 수정이 운영에 안 감 (RF-29)
RUN npm run build:core \
 && test -f public/build/core/template-engine.min.js \
 && grep -q 'auto_fetch' public/build/core/template-engine.min.js \
 || (echo "ERROR: npm run build:core failed or DataGate (auto_fetch) missing in template-engine.min.js" && exit 1)
# 활성 템플릿/모듈 dist — 모든 빌드는 Cloud Build 안에서 (호스트 빌드 금지 SSOT)
RUN cd templates/moabom-admin_basic && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd templates/moabom-basic && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd modules/sirsoft-ecommerce && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd plugins/sirsoft-ckeditor5 && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd plugins/sirsoft-daum_postcode && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd plugins/sirsoft-tosspayments && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd plugins/sirsoft-pay_kginicis && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd plugins/sirsoft-verification_kginicis && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd plugins/moabom-auth-hardening && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN MOABOM_APP_ROOT=/app bash deploy/check-bundle-budget.sh

# --- 3) Runtime ---
FROM php:8.4-fpm-bookworm
ARG MOABOM_IMAGE_TAG=dev

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx supervisor \
    libpng-dev libjpeg62-turbo-dev libfreetype6-dev libwebp-dev \
    libicu-dev libxml2-dev libzip-dev libonig-dev \
    libldap2-dev zlib1g-dev libmagickwand-dev \
    $PHPIZE_DEPS \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-configure ldap --with-libdir=lib/x86_64-linux-gnu/ \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql mysqli gd zip intl opcache bcmath pcntl exif ldap \
    && pecl channel-update pecl.php.net \
    && (pecl install redis-6.1.0 || pecl install https://github.com/phpredis/phpredis/archive/refs/tags/6.1.0.tar.gz) \
    && pecl install imagick \
    && docker-php-ext-enable redis imagick \
    && apt-get purge -y --auto-remove $PHPIZE_DEPS \
    && apt-get clean && rm -rf /var/lib/mysql /var/lib/apt/lists/*

COPY deploy/nginx-cloudrun.conf /etc/nginx/conf.d/default.conf
COPY deploy/supervisord.conf /etc/supervisor/conf.d/moabom.conf
COPY deploy/supervisord-web.conf /etc/supervisor/supervisord-web.conf
COPY deploy/supervisord-queue.conf /etc/supervisor/supervisord-queue.conf
COPY deploy/php-fpm/zz-moabom.conf /usr/local/etc/php-fpm.d/zz-moabom.conf
COPY deploy/cloudrun-entrypoint.sh /usr/local/bin/cloudrun-entrypoint.sh
COPY deploy/cloudrun-deferred-sync.sh deploy/saas-module-sync.sh deploy/saas-clone-tenant.sh deploy/saas-extension-bootstrap.sh deploy/saas-tenant-extension-sync.sh /var/www/html/deploy/
RUN chmod +x /usr/local/bin/cloudrun-entrypoint.sh /var/www/html/deploy/cloudrun-deferred-sync.sh

RUN mkdir -p /var/www/html/storage /var/www/html/bootstrap/cache \
    && chown -R www-data:www-data /var/www/html

WORKDIR /var/www/html

COPY --from=vendor --chown=www-data:www-data /app/ ./
COPY --from=assets --chown=www-data:www-data /app/public/build ./public/build
COPY --from=assets --chown=www-data:www-data /app/templates/moabom-admin_basic/dist ./templates/moabom-admin_basic/dist
COPY --from=assets --chown=www-data:www-data /app/templates/moabom-basic/dist ./templates/moabom-basic/dist
COPY --from=assets --chown=www-data:www-data /app/modules/sirsoft-ecommerce/dist ./modules/sirsoft-ecommerce/dist
COPY --from=assets --chown=www-data:www-data /app/plugins/sirsoft-ckeditor5/dist ./plugins/sirsoft-ckeditor5/dist
COPY --from=assets --chown=www-data:www-data /app/plugins/sirsoft-daum_postcode/dist ./plugins/sirsoft-daum_postcode/dist
COPY --from=assets --chown=www-data:www-data /app/plugins/sirsoft-tosspayments/dist ./plugins/sirsoft-tosspayments/dist
COPY --from=assets --chown=www-data:www-data /app/plugins/sirsoft-pay_kginicis/dist ./plugins/sirsoft-pay_kginicis/dist
COPY --from=assets --chown=www-data:www-data /app/plugins/sirsoft-verification_kginicis/dist ./plugins/sirsoft-verification_kginicis/dist
COPY --from=assets --chown=www-data:www-data /app/plugins/moabom-auth-hardening/dist ./plugins/moabom-auth-hardening/dist

# Service Worker는 tenant 비의존 산출물이다. 이미지 태그로 치환해 nginx에서 직접 서빙한다.
RUN mkdir -p public/pwa \
    && php -r '$src="templates/moabom-basic/dist/pwa/sw.bundled.js"; if (!is_file($src)) { exit(0); } $manifest="templates/moabom-basic/dist/pwa/precache-manifest.json"; $json=is_file($manifest)?file_get_contents($manifest):"[]"; if (json_decode($json)===null) { $json="[]"; } $quoted=json_encode($json, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE); $single=chr(39)."__PRECACHE_MANIFEST_JSON__".chr(39); $body=strtr(file_get_contents($src), ["\"__PRECACHE_MANIFEST_JSON__\""=>$quoted, $single=>$quoted, "{{VERSION}}"=>$argv[1]]); file_put_contents("public/pwa/sw.js", $body);' "${MOABOM_IMAGE_TAG}" \
    && chown -R www-data:www-data public/pwa

# Opcache 프로덕션 (Cloud Run: 요청마다 PHP 재로드 비용 절감)
RUN { \
    echo 'opcache.enable=1'; \
    echo 'opcache.validate_timestamps=0'; \
    echo 'opcache.memory_consumption=256'; \
    echo 'opcache.max_accelerated_files=20000'; \
    echo 'opcache.interned_strings_buffer=16'; \
    } > /usr/local/etc/php/conf.d/99-opcache-prod.ini

# DB가 없는 이미지 빌드 단계에서는 워킹트리의 검증된 확장 오토로드를 그대로 포함한다.
# extension:update-autoload/view:cache 는 앱을 부팅하며 DB를 요구하므로 cold-start 제거 목적으로 실행하지 않는다.
RUN test -s bootstrap/cache/autoload-extensions.php \
    && chown -R www-data:www-data storage bootstrap/cache

ENV PORT=8080
EXPOSE 8080

CMD ["/usr/local/bin/cloudrun-entrypoint.sh"]
