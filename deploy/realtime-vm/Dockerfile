# Moabom dedicated Reverb — minimal PHP CLI image (realtime VM only)
FROM php:8.3-cli-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libzip-dev \
    && docker-php-ext-install pcntl sockets \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY reverb-app/composer.json ./
RUN composer config --global audit.block-insecure false \
    && composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-autoloader

COPY reverb-app/ ./
RUN mkdir -p bootstrap/cache storage/framework/{cache,sessions,views} storage/logs \
    && chmod -R 777 bootstrap/cache storage \
    && composer dump-autoload --optimize \
    && php artisan package:discover --ansi

ENV REVERB_SERVER_HOST=0.0.0.0
ENV REVERB_SERVER_PORT=6001

EXPOSE 6001

CMD ["php", "artisan", "reverb:start", "--host=0.0.0.0", "--port=6001"]
