#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8080}"
APP_DIR="/var/www/html/backend"

echo "[tracely-backend] Configuring Apache on port ${PORT}..."
cat > /etc/apache2/ports.conf <<EOF
Listen ${PORT}
EOF

cat > /etc/apache2/sites-available/000-default.conf <<EOF
<VirtualHost *:${PORT}>
    ServerName localhost
    DocumentRoot ${APP_DIR}/public

    <Directory ${APP_DIR}/public>
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog /dev/stderr
    CustomLog /dev/stdout combined
</VirtualHost>
EOF

cat > /etc/apache2/conf-enabled/99-tracely-ddos.conf <<'EOF'
ServerTokens Prod
ServerSignature Off
Timeout 30
KeepAlive On
KeepAliveTimeout 5
MaxKeepAliveRequests 100
LimitRequestBody 167772160
LimitRequestFields 64
LimitRequestFieldSize 8190
LimitRequestLine 8190

<IfModule mod_reqtimeout.c>
    RequestReadTimeout header=10-20,MinRate=500 body=15-30,MinRate=500
</IfModule>

<IfModule mpm_prefork_module>
    StartServers             4
    MinSpareServers          4
    MaxSpareServers          12
    MaxRequestWorkers        80
    MaxConnectionsPerChild   1000
</IfModule>
EOF

cd "${APP_DIR}"

# Ensure storage and cache directories exist (important when a Railway Volume is mounted at storage/app)
mkdir -p \
    storage/app/private \
    storage/app/public \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache

# Ensure public/storage symlink exists
php artisan storage:link --no-interaction >/dev/null 2>&1 || true

# Clear any stale cached config before running DB checks/migrations
php artisan config:clear --no-interaction

# Wait for MySQL when DB_CONNECTION=mysql
if [ "${DB_CONNECTION:-}" = "mysql" ]; then
    echo "[tracely-backend] Waiting for MySQL (${DB_HOST:-127.0.0.1}:${DB_PORT:-3306}/${DB_DATABASE:-railway})..."
    MAX_TRIES=20
    TRY=1
    until php -r '
        $dsn = sprintf("mysql:host=%s;port=%s;dbname=%s", getenv("DB_HOST"), getenv("DB_PORT") ?: "3306", getenv("DB_DATABASE"));
        new PDO($dsn, getenv("DB_USERNAME"), getenv("DB_PASSWORD"), [PDO::ATTR_TIMEOUT => 3]);
    ' >/dev/null 2>&1; do
        if [ "${TRY}" -ge "${MAX_TRIES}" ]; then
            echo "[tracely-backend] ERROR: MySQL did not become ready after ${MAX_TRIES} attempts." >&2
            exit 1
        fi
        echo "[tracely-backend] MySQL not ready yet (attempt ${TRY}/${MAX_TRIES}), retrying in 3s..."
        TRY=$((TRY + 1))
        sleep 3
    done
    echo "[tracely-backend] MySQL connection verified."
fi

echo "[tracely-backend] Running database migrations..."
php artisan migrate --force --no-interaction

if [ "${RUN_SEED_ON_EMPTY:-false}" = "true" ]; then
    USER_COUNT="$(php -r '
        require "/var/www/html/backend/vendor/autoload.php";
        $app = require "/var/www/html/backend/bootstrap/app.php";
        $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
        echo App\Models\User::query()->count();
    ' 2>/dev/null || echo "1")"

    if [ "${USER_COUNT}" = "0" ]; then
        echo "[tracely-backend] Empty database detected; running initial DatabaseSeeder..."
        php artisan db:seed --force --no-interaction
    else
        echo "[tracely-backend] Existing users detected (${USER_COUNT}); skipping seed."
    fi
fi

echo "[tracely-backend] Caching Laravel configuration and views..."
php artisan config:cache --no-interaction
php artisan view:cache --no-interaction

chown -R www-data:www-data storage bootstrap/cache

if [ "${ENABLE_SCHEDULER:-true}" = "true" ]; then
    echo "[tracely-backend] Starting background Laravel scheduler loop (60s interval)..."
    (
        while true; do
            sleep 60
            su -s /bin/sh www-data -c "cd ${APP_DIR} && php artisan schedule:run --no-interaction" >/dev/null 2>&1 || true
        done
    ) &
fi

echo "[tracely-backend] Starting Apache on 0.0.0.0:${PORT}..."
rm -f /etc/apache2/mods-enabled/mpm_event.* /etc/apache2/mods-enabled/mpm_worker.*
exec apache2-foreground
