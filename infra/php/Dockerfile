FROM php:8.4-fpm
RUN apt-get update && apt-get install -y --no-install-recommends libonig-dev libxml2-dev libjpeg62-turbo-dev libpng-dev libzip-dev unzip git && docker-php-ext-configure gd --with-jpeg && docker-php-ext-install pdo_mysql mbstring dom gd zip && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY backend/composer.* ./
RUN composer install --no-interaction --prefer-dist --no-scripts
COPY backend/ ./
RUN composer dump-autoload --optimize
RUN printf 'display_errors=Off\nlog_errors=On\nexpose_php=Off\n' > /usr/local/etc/php/conf.d/app.ini

COPY infra/php/events.conf /usr/local/etc/php-fpm.d/events.conf

RUN printf 'post_max_size=30M\nmemory_limit=256M\n' > /usr/local/etc/php/conf.d/uploads.ini
