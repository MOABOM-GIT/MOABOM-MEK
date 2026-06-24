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
# moabom-chat SSOT — 부분 api.php 가 이미지에 들어가면 즉시 빌드 실패
RUN grep -q "Route::delete('blocks/{userUuid}'" modules/moabom-chat/src/routes/api.php \
 && grep -q '\[0-9a-f\]{8}-\[0-9a-f\]{4}-\[0-9a-f\]{4}-\[0-9a-f\]{4}-\[0-9a-f\]{12}' modules/moabom-chat/src/routes/api.php \
 && grep -q registerMissingUserRoutes modules/moabom-chat/src/Providers/ChatServiceProvider.php \
 || (echo "ERROR: moabom-chat SSOT routes/provider guard missing in image context" && exit 1)
# 빌드 단계: .env·DB 없이 autoload + package discover (GCS 드라이버 등록)
RUN rm -f .env .env.* 2>/dev/null || true \
    && mkdir -p bootstrap/cache storage/framework/cache/data storage/framework/sessions storage/framework/views \
    && composer dump-autoload --optimize --no-dev --no-scripts \
    && FILESYSTEM_DISK=local APP_ENV=local php artisan package:discover --ansi --no-interaction

# --- 2) Frontend build (G7 core + 활성 템플릿 dist) ---
FROM node:22-bookworm-slim AS assets
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
# 코어 번들 (public/build/core)
RUN npm run build:core 2>/dev/null || npm run build 2>/dev/null || true
# 활성 템플릿/모듈 dist — 모든 빌드는 Cloud Build 안에서 (호스트 빌드 금지 SSOT)
RUN cd templates/moabom-admin_basic && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd templates/moabom-basic && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd modules/sirsoft-ecommerce && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd plugins/sirsoft-ckeditor5 && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd plugins/sirsoft-daum_postcode && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd plugins/sirsoft-tosspayments && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build
RUN cd plugins/moabom-auth-hardening && MOABOM_BUILD_ENV=cloudbuild npm ci && MOABOM_BUILD_ENV=cloudbuild npm run build

# --- 3) Runtime ---
FROM php:8.4-fpm-bookworm

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
    && pecl install redis \
    && pecl install imagick \
    && docker-php-ext-enable redis imagick \
    && apt-get purge -y --auto-remove $PHPIZE_DEPS \
    && apt-get clean && rm -rf /var/lib/mysql /var/lib/apt/lists/*

COPY deploy/nginx-cloudrun.conf /etc/nginx/conf.d/default.conf
COPY deploy/supervisord.conf /etc/supervisor/conf.d/moabom.conf
COPY deploy/cloudrun-entrypoint.sh /usr/local/bin/cloudrun-entrypoint.sh
COPY deploy/saas-module-sync.sh deploy/saas-clone-tenant.sh deploy/saas-extension-bootstrap.sh deploy/saas-tenant-extension-sync.sh /var/www/html/deploy/
RUN chmod +x /usr/local/bin/cloudrun-entrypoint.sh

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
COPY --from=assets --chown=www-data:www-data /app/plugins/moabom-auth-hardening/dist ./plugins/moabom-auth-hardening/dist

# Opcache 프로덕션 (Cloud Run: 요청마다 PHP 재로드 비용 절감)
RUN { \
    echo 'opcache.enable=1'; \
    echo 'opcache.validate_timestamps=0'; \
    echo 'opcache.memory_consumption=256'; \
    echo 'opcache.max_accelerated_files=20000'; \
    echo 'opcache.interned_strings_buffer=16'; \
    } > /usr/local/etc/php/conf.d/99-opcache-prod.ini

# extension autoload를 이미지에 포함해 콜드스타트 시 artisan 스킵 가능
RUN FILESYSTEM_DISK=local APP_ENV=production APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
    php artisan extension:update-autoload --no-interaction 2>/dev/null || true

ENV PORT=8080
EXPOSE 8080

CMD ["/usr/local/bin/cloudrun-entrypoint.sh"]
