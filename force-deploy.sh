#!/bin/bash

# АГРЕССИВНЫЙ деплой - полная очистка и пересборка
# Использовать когда обычный deploy.sh не помогает

set -e

echo "=========================================="
echo "  🔥 АГРЕССИВНЫЙ DEPLOY"
echo "  ⚠️  Удаляет ВСЕ образы и контейнеры!"
echo "=========================================="
echo ""

read -p "Продолжить? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Отменено"
    exit 0
fi

echo ""
echo "🔴 Шаг 1: Остановка и удаление контейнеров..."
docker compose down -v
echo "✅ Контейнеры удалены"
echo ""

echo "🔴 Шаг 2: Удаление Docker образов..."
docker rmi rabota-frontend rabota-backend || true
echo "✅ Образы удалены"
echo ""

echo "🔴 Шаг 3: Очистка Docker build cache..."
docker builder prune -f
echo "✅ Build cache очищен"
echo ""

echo "📦 Шаг 4: Git pull..."
git pull origin master
echo "✅ Код обновлён"
echo ""

echo "🔧 Шаг 5: Обновление nginx конфигурации..."
if [ -f "/etc/nginx/sites-available/rabota.yo1nk.ru" ]; then
    sudo cp nginx-host.conf /etc/nginx/sites-available/rabota.yo1nk.ru
    sudo nginx -t
    sudo systemctl reload nginx
    echo "✅ Nginx обновлён"
else
    echo "⚠️  Nginx конфиг не найден, пропускаем"
fi
echo ""

echo "🔨 Шаг 6: Пересборка frontend (БЕЗ кэша)..."
cd work-schedule-app
rm -rf node_modules/.vite dist
cd ..
echo "✅ Локальный кэш очищен"
echo ""

echo "🔨 Шаг 7: Пересборка Docker образов (БЕЗ кэша)..."
DOCKER_BUILDKIT=1 docker compose build --no-cache --pull
echo "✅ Образы пересобраны"
echo ""

echo "🚀 Шаг 8: Запуск контейнеров..."
docker compose up -d
echo "✅ Контейнеры запущены"
echo ""

echo "⏳ Ожидание инициализации (15 секунд)..."
sleep 15
echo ""

echo "📊 Шаг 9: Статус контейнеров..."
docker compose ps
echo ""

echo "🔍 Шаг 10: Проверка какой файл в контейнере..."
echo "Файл в HTML:"
docker compose exec frontend cat /usr/share/nginx/html/index.html | grep -o 'index-[^"]*\.js'
echo ""
echo "Файлы в assets:"
docker compose exec frontend ls -lh /usr/share/nginx/html/assets/ | grep index- | grep .js
echo ""

echo "🧪 Шаг 11: Тесты..."
echo -n "Backend health: "
curl -s http://localhost:3001/health > /dev/null && echo "✅" || echo "❌"

echo -n "Frontend: "
curl -s http://localhost:8081 > /dev/null && echo "✅" || echo "❌"

echo -n "API через frontend: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/api/shifts)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ (HTTP $HTTP_CODE)"
    echo ""
    echo "Ответ API:"
    curl -s http://localhost:8081/api/shifts | head -c 200
    echo "..."
else
    echo "❌ (HTTP $HTTP_CODE)"
fi
echo ""

echo "🔍 Шаг 12: Проверка nginx конфига в контейнере..."
docker compose exec frontend grep -A 3 "location /api" /etc/nginx/conf.d/default.conf
echo ""

echo "=========================================="
echo "  ✅ АГРЕССИВНЫЙ DEPLOY ЗАВЕРШЁН!"
echo "=========================================="
echo ""
echo "Теперь откройте https://rabota.yo1nk.ru и нажмите Ctrl+Shift+R"
echo "(жёсткая перезагрузка страницы, игнорируя кэш браузера)"
echo ""
echo "Проверьте в консоли браузера (F12) что загружается:"
echo "  index-BQbn_S1t.js ✅ (новый)"
echo "  index-BBcwpLcW.js ❌ (старый)"
echo ""
