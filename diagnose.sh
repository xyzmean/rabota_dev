#!/bin/bash
# Диагностика проблемы с API на production сервере

echo "=== 1. Проверка Docker контейнеров ==="
docker ps -a

echo ""
echo "=== 2. Проверка конфигурации Nginx на хосте ==="
cat /etc/nginx/sites-available/rabota.yo1nk.ru 2>/dev/null || echo "Конфигурация не найдена"

echo ""
echo "=== 3. Проверка логов Nginx на хосте ==="
echo "--- Access log (последние 20 строк) ---"
tail -n 20 /var/log/nginx/rabota_access.log 2>/dev/null || echo "Access log не найден"
echo ""
echo "--- Error log (последние 20 строк) ---"
tail -n 20 /var/log/nginx/rabota_error.log 2>/dev/null || echo "Error log не найден"

echo ""
echo "=== 4. Проверка логов Frontend контейнера ==="
docker logs rabota_frontend --tail 30

echo ""
echo "=== 5. Проверка логов Backend контейнера ==="
docker logs rabota_backend --tail 30

echo ""
echo "=== 6. Тест API запросов ==="
echo "--- Прямой запрос к backend (localhost:3001) ---"
curl -s http://localhost:3001/api/employees | head -c 100
echo ""
echo ""
echo "--- Запрос через frontend nginx (localhost:8081) ---"
curl -s http://localhost:8081/api/employees | head -c 100
echo ""
echo ""
echo "--- Запрос через хост nginx (localhost) ---"
curl -s http://localhost/api/employees | head -c 100
echo ""

echo ""
echo "=== 7. Проверка конфигурации nginx в frontend контейнере ==="
docker exec rabota_frontend cat /etc/nginx/conf.d/default.conf

echo ""
echo "=== 8. Проверка активной конфигурации Nginx на хосте ==="
nginx -T 2>&1 | grep -A 20 "server_name rabota.yo1nk.ru"
