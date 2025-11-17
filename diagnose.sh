#!/bin/bash

# Скрипт диагностики проблем с deployment

echo "=========================================="
echo "  Диагностика RaboTA Deployment"
echo "=========================================="
echo ""

# 1. Проверка Git статуса
echo "📦 1. Git статус:"
echo "Текущая ветка:"
git branch --show-current
echo ""
echo "Последний коммит:"
git log -1 --oneline
echo ""
echo "Изменённые файлы:"
git status --short
echo ""

# 2. Проверка содержимого api.ts
echo "🔍 2. Содержимое api.ts (API_URL):"
grep -A 3 "const API_URL" work-schedule-app/src/services/api.ts
echo ""

# 3. Проверка nginx.conf (frontend)
echo "🔍 3. Содержимое nginx.conf (проверка proxy):"
grep -A 5 "location /api" work-schedule-app/nginx.conf || echo "❌ location /api не найден!"
echo ""

# 4. Проверка Docker образов
echo "🐳 4. Docker образы:"
docker images | grep rabota
echo ""

# 5. Проверка Docker контейнеров
echo "🐳 5. Docker контейнеры:"
docker compose ps
echo ""

# 6. Проверка содержимого frontend контейнера
echo "🔍 6. Проверка файлов в frontend контейнере:"
echo "HTML файл:"
docker compose exec frontend cat /usr/share/nginx/html/index.html | grep -o 'index-[^"]*\.js'
echo ""
echo "Nginx конфигурация в контейнере:"
docker compose exec frontend grep -A 5 "location /api" /etc/nginx/conf.d/default.conf || echo "❌ location /api не найден в контейнере!"
echo ""

# 7. Проверка API запроса через frontend контейнер
echo "🧪 7. Тест API через frontend контейнер:"
docker compose exec frontend wget -q -O- http://rabota_backend:3001/health && echo "✅ Backend доступен из frontend" || echo "❌ Backend недоступен"
echo ""

# 8. Проверка логов
echo "📝 8. Последние логи frontend (5 строк):"
docker compose logs frontend --tail 5
echo ""
echo "📝 Последние логи backend (5 строк):"
docker compose logs backend --tail 5
echo ""

# 9. Проверка доступности API
echo "🧪 9. Тесты доступности:"
echo -n "Backend напрямую (localhost:3001): "
curl -s http://localhost:3001/health > /dev/null && echo "✅" || echo "❌"

echo -n "Frontend (localhost:8081): "
curl -s http://localhost:8081 > /dev/null && echo "✅" || echo "❌"

echo -n "API через frontend (localhost:8081/api/shifts): "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/api/shifts)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ (HTTP $HTTP_CODE)"
else
    echo "❌ (HTTP $HTTP_CODE)"
fi
echo ""

# 10. Проверка какой файл загружается
echo "🔍 10. Какой JS файл в контейнере:"
docker compose exec frontend ls -lh /usr/share/nginx/html/assets/ | grep index- | grep .js
echo ""

echo "=========================================="
echo "  Диагностика завершена"
echo "=========================================="
echo ""
echo "💡 Проблема в том, что загружается index-BBcwpLcW.js вместо index-BQbn_S1t.js"
echo ""
echo "Возможные причины:"
echo "  1. Docker не пересобрал frontend образ"
echo "  2. Кэш браузера"
echo "  3. Кэш Docker build"
echo ""
