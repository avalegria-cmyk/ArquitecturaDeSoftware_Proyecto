FROM php:8.4-apache
RUN apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/* \
 && docker-php-ext-install pdo_mysql sockets \
 && sed -i 's/Listen 80/Listen 3001/' /etc/apache2/ports.conf \
 && printf '<VirtualHost *:3001>\n  DocumentRoot /app/public\n  <Directory /app/public>\n    Require all granted\n    FallbackResource /index.php\n  </Directory>\n</VirtualHost>\n' > /etc/apache2/sites-available/000-default.conf \
 && printf 'display_errors=Off\nlog_errors=On\nexpose_php=Off\n' > /usr/local/etc/php/conf.d/app.ini
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY composer.json ./
RUN composer install --no-interaction --prefer-dist --no-scripts --no-dev
COPY . ./
RUN composer dump-autoload --optimize --no-dev
EXPOSE 3001
CMD ["sh", "-c", "php bin/esquema.php && apache2-foreground"]
