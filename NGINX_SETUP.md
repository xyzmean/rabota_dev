# Настройка Nginx для Production

Этот проект использует **SNI-based routing** через Nginx для работы на одном IP:порту вместе с другими сервисами (например, Xray VPN).

## Архитектура

```
Internet (443)
    ↓
Nginx SNI Stream Router (streams-enabled/stream.conf)
    ├─→ yo1nk.ru, www.yo1nk.ru → Xray (127.0.0.1:8443)
    └─→ rabota.yo1nk.ru → Nginx Site (127.0.0.1:4433)
            ├─→ / → Frontend Docker (localhost:8081)
            └─→ /api/ → Backend Docker (localhost:3001)
```

## Быстрый старт для Production

### Вариант 1: Nginx на хосте (рекомендуется)

1. **Скопируйте конфиги на сервер:**
```bash
# Установите nginx если еще не установлен
sudo apt update && sudo apt install nginx -y

# Скопируйте конфиги
sudo cp -r nginx/* /etc/nginx/

# Или скопируйте только нужные файлы
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf
sudo cp nginx/sites-available/rabota.yo1nk.ru /etc/nginx/sites-available/
sudo cp nginx/streams-enabled/stream.conf /etc/nginx/streams-enabled/
sudo ln -s /etc/nginx/sites-available/rabota.yo1nk.ru /etc/nginx/sites-enabled/
```

2. **Получите SSL сертификат:**
```bash
# Установите certbot
sudo apt install certbot -y

# Получите сертификат
sudo certbot certonly --standalone -d rabota.yo1nk.ru
```

3. **Проверьте и перезапустите nginx:**
```bash
sudo nginx -t
sudo systemctl restart nginx
```

4. **Запустите Docker контейнеры:**
```bash
cd /path/to/RaboTA
docker compose up -d
```

### Вариант 2: Все в Docker (для тестирования)

```bash
# Запустите production compose с nginx
docker compose -f docker-compose.prod.yml up -d
```

**Внимание:** Для production варианта 2 нужно:
- SSL сертификаты в `/etc/letsencrypt/`
- Порт 4433 должен быть доступен снаружи

## Файлы конфигурации

### `nginx/nginx.conf`
Основной конфиг nginx с поддержкой:
- Stream модуля (для SNI routing)
- HTTP/HTTPS
- Gzip сжатие
- SSL настройки

### `nginx/streams-enabled/stream.conf`
**SNI-based роутинг** - определяет куда направлять HTTPS трафик по имени домена:
- `yo1nk.ru`, `www.yo1nk.ru` → Xray VPN (порт 8443)
- `rabota.yo1nk.ru` → Web сайт (порт 4433)

### `nginx/sites-available/rabota.yo1nk.ru`
Конфигурация сайта RaboTA:
- Слушает на порту **4433** (внутренний SSL)
- Проксирует запросы на Docker контейнеры:
  - `/` → Frontend (localhost:8081)
  - `/api/` → Backend (localhost:3001)

### `nginx-host.conf`
**Альтернативный конфиг** для простой установки (без SNI routing):
- HTTP → HTTPS редирект
- HTTPS на порту 443
- Не требует stream модуля

## Проверка работы

```bash
# Проверить статус nginx
sudo systemctl status nginx

# Проверить логи nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Проверить Docker контейнеры
docker compose ps

# Проверить backend API
curl http://localhost:3001/health

# Проверить frontend
curl http://localhost:8081

# Проверить через nginx (если на хосте)
curl https://rabota.yo1nk.ru/health
```

## Troubleshooting

### Ошибка "address already in use" на порту 443

Это нормально если уже работает SNI router. Проверьте:
```bash
sudo netstat -tulpn | grep :443
# Должен быть nginx stream
```

### SSL сертификаты не найдены

```bash
# Проверьте наличие сертификатов
ls -la /etc/letsencrypt/live/rabota.yo1nk.ru/

# Если нет, получите их через certbot
sudo certbot certonly --standalone -d rabota.yo1nk.ru

# Или через DNS challenge (если порт 80 занят)
sudo certbot certonly --manual --preferred-challenges dns -d rabota.yo1nk.ru
```

### Backend API не отвечает

```bash
# Проверьте логи backend
docker logs rabota_backend

# Проверьте подключение к PostgreSQL
docker exec rabota_backend wget -q -O- http://localhost:3001/health
```

### Frontend не загружается

```bash
# Проверьте логи frontend
docker logs rabota_frontend

# Проверьте nginx конфиг frontend
docker exec rabota_frontend cat /etc/nginx/conf.d/default.conf
```

## Безопасность

1. **Измените пароль БД** в `.env`:
```bash
echo "DB_PASSWORD=your_secure_password_here" > .env
```

2. **Настройте firewall:**
```bash
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

3. **Регулярно обновляйте сертификаты:**
```bash
# Certbot автоматически обновляет, но можно проверить
sudo certbot renew --dry-run
```

## Переключение между режимами

### Development (без nginx на хосте)
```bash
docker compose up -d
# Доступ: http://localhost:5173 (dev) или http://localhost:8081 (prod)
```

### Production с nginx на хосте
```bash
# 1. Настройте nginx на хосте (см. выше)
# 2. Запустите только Docker контейнеры
docker compose up -d
# Доступ: https://rabota.yo1nk.ru
```

### Production full Docker
```bash
docker compose -f docker-compose.prod.yml up -d
# Доступ: https://your-domain:4433
```

## Полезные команды

```bash
# Перезапуск nginx на хосте
sudo systemctl reload nginx

# Пересборка и перезапуск Docker
docker compose down && docker compose up -d --build

# Просмотр всех логов
docker compose logs -f

# Проверка конфигурации nginx
sudo nginx -t

# Проверка SNI routing
openssl s_client -connect localhost:443 -servername rabota.yo1nk.ru
```
