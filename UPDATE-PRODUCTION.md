# Инструкция по обновлению Production сервера

## Проблемы которые были исправлены

1. **Route not found** - исправлено добавлением nginx proxy в frontend контейнере
2. **Упрощена архитектура** - убрано дублирующее проксирование из host nginx
3. **Подготовлено для мобильных устройств** - все API запросы идут через относительный путь

## Новая архитектура

```
Internet (HTTPS:443)
    ↓
Host Nginx (rabota.yo1nk.ru) - nginx-host.conf
    ↓
Frontend Container (localhost:8081) - nginx.conf
    ↓
    ├─→ Static files (React SPA)
    └─→ API requests (/api) → Backend Container (rabota_backend:3001)
            ↓
        PostgreSQL Container
```

## Шаги обновления на production сервере

### 1. Подключитесь к серверу

```bash
ssh user@rabota.yo1nk.ru
```

### 2. Перейдите в директорию проекта

```bash
cd /path/to/RaboTA
```

### 3. Получите последние изменения

```bash
git pull origin master
```

### 4. Обновите host nginx конфигурацию

```bash
# Скопируйте новую конфигурацию
sudo cp nginx-host.conf /etc/nginx/sites-available/rabota.yo1nk.ru

# Проверьте конфигурацию на ошибки
sudo nginx -t

# Если всё OK, перезагрузите nginx
sudo systemctl reload nginx
```

### 5. Пересоберите и перезапустите Docker контейнеры

```bash
# Остановите контейнеры
docker compose down

# Пересоберите с нуля
docker compose build --no-cache

# Запустите контейнеры
docker compose up -d

# Проверьте статус
docker compose ps
docker compose logs -f
```

### 6. Проверьте работу

```bash
# Проверьте health check
curl http://localhost:3001/health

# Проверьте frontend
curl http://localhost:8081

# Проверьте API через frontend
curl http://localhost:8081/api/shifts

# Проверьте через HTTPS (с реального домена)
curl https://rabota.yo1nk.ru/api/shifts
```

## Решение проблемы с Safari "Мошеннический сайт"

Safari может показывать это предупреждение по нескольким причинам:

### 1. Самоподписанный SSL сертификат

Если вы используете самоподписанный сертификат:

```bash
# Проверьте сертификат
sudo certbot certificates

# Если нет валидного сертификата, получите новый
sudo certbot --nginx -d rabota.yo1nk.ru
```

### 2. Истёкший SSL сертификат

```bash
# Проверьте срок действия
openssl x509 -in /etc/letsencrypt/live/rabota.yo1nk.ru/fullchain.pem -noout -dates

# Обновите сертификат
sudo certbot renew
sudo systemctl reload nginx
```

### 3. Смешанный контент (Mixed Content)

Проверьте в логах браузера (Safari Developer Tools):
- Нажмите Develop → Show Web Inspector → Console
- Ищите ошибки о "Mixed Content" или "Blocked loading"

Наши изменения должны были исправить это (теперь всё идёт через относительные пути).

### 4. Проверка SSL конфигурации

```bash
# Проверьте, что сайт доступен по HTTPS
curl -I https://rabota.yo1nk.ru

# Должен вернуть 200 OK
```

### 5. Очистка кэша Safari

На iPhone/iPad:
1. Настройки → Safari → "Очистить историю и данные сайтов"
2. Или: Настройки → Safari → Дополнения → Данные сайтов → Удалить всё

## Troubleshooting

### Проблема: Контейнеры не запускаются

```bash
# Проверьте логи
docker compose logs backend
docker compose logs frontend
docker compose logs postgres

# Проверьте порты
sudo netstat -tlnp | grep -E '3001|8081|5432'
```

### Проблема: 502 Bad Gateway

```bash
# Проверьте, что контейнеры запущены
docker compose ps

# Проверьте логи nginx
sudo tail -f /var/log/nginx/rabota_error.log

# Перезапустите nginx
sudo systemctl restart nginx
```

### Проблема: API всё ещё не работает

```bash
# Проверьте что frontend контейнер может достучаться до backend
docker compose exec frontend sh -c "wget -O- http://rabota_backend:3001/health"

# Если не работает - проверьте Docker network
docker network ls
docker network inspect rabota_default
```

## После успешного обновления

1. Откройте https://rabota.yo1nk.ru в браузере на ПК
2. Откройте https://rabota.yo1nk.ru в браузере на смартфоне
3. Проверьте, что данные загружаются (смены, сотрудники)
4. Проверьте консоль браузера на наличие ошибок

## Контакты для помощи

Если возникли проблемы, проверьте:
- Логи nginx: `/var/log/nginx/rabota_error.log`
- Логи Docker: `docker compose logs -f`
- Статус сервисов: `sudo systemctl status nginx` и `docker compose ps`
