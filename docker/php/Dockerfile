FROM php:8.4-fpm

# G7 프론트 빌드용 Node.js (로컬: npm ci / build:core)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
    git curl unzip zip \
    libpng-dev libjpeg62-turbo-dev libfreetype6-dev libwebp-dev \
    libicu-dev libxml2-dev libzip-dev libonig-dev \
    default-mysql-client \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install pdo_mysql mysqli gd zip intl opcache bcmath \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY docker/php/opcache-dev.ini /usr/local/etc/php/conf.d/99-opcache-dev.ini
COPY docker/php/ensure-app-writable-paths.sh /usr/local/bin/ensure-app-writable-paths.sh
COPY docker/php/entrypoint.sh /usr/local/bin/moabom-entrypoint.sh
RUN chmod +x /usr/local/bin/ensure-app-writable-paths.sh /usr/local/bin/moabom-entrypoint.sh

WORKDIR /var/www/html

ENTRYPOINT ["/usr/local/bin/moabom-entrypoint.sh"]