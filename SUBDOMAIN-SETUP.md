# Настройка поддомена rabota.yo1nk.ru

Это руководство описывает настройку приложения RaboTA для работы на поддомене **rabota.yo1nk.ru** с использованием HTTPS (порт 443).

## Архитектура решения

```
Интернет (HTTPS:443)
    ↓
rabota.yo1nk.ru
    ↓
Nginx на хост-машине (Reverse Proxy)
    ↓
    ├─→ Frontend (Docker контейнер, порт 8081)
    └─→ Backend API (Docker контейнер, порт 3001)
```

## Предварительные требования

1. **DNS настройки**: Поддомен rabota.yo1nk.ru должен указывать на IP-адрес вашего сервера
   ```
   A-запись: rabota.yo1nk.ru → IP_СЕРВЕРА
   ```

2. **Nginx установлен на хост-машине** (не в Docker):
   ```bash
   sudo apt update
   sudo apt install nginx -y
   ```

3. **Docker и Docker Compose установлены**

4. **Порт 443 и 80 открыты в файрволе**:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw reload
   ```

---

## Шаг 1: Клонирование и настройка проекта

```bash
# Клонирование проекта
cd /opt
sudo git clone git@github.com:xyzmean/rabota_dev.git rabota
cd rabota

# Создание .env файла
sudo nano .env
```

Содержимое `.env`:
```env
# PostgreSQL
DB_PASSWORD=your_secure_password_here

# CORS (используем HTTPS домен)
CORS_ORIGIN=https://rabota.yo1nk.ru
```

---

## Шаг 2: Запуск Docker контейнеров

```bash
# Убедитесь что находитесь в директории проекта
cd /opt/rabota

# Запуск всех сервисов
sudo docker compose up -d

# Проверка статуса
sudo docker compose ps

# Должны быть запущены:
# - rabota_postgres (порт 5432)
# - rabota_backend (порт 3001)
# - rabota_frontend (порт 8081)
```

Проверьте что сервисы работают:
```bash
# Backend health check
curl http://localhost:3001/health

# Frontend
curl http://localhost:8081
```

---

## Шаг 3: Установка SSL сертификата (Let's Encrypt)

### 3.1 Установка Certbot

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

### 3.2 Создание директории для ACME challenge

```bash
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot
```

### 3.3 Временная конфигурация Nginx (для получения сертификата)

Создайте временную конфигурацию:
```bash
sudo nano /etc/nginx/sites-available/rabota-temp
```

Содержимое:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name rabota.yo1nk.ru;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 "OK";
        add_header Content-Type text/plain;
    }
}
```

Активируйте конфигурацию:
```bash
sudo ln -s /etc/nginx/sites-available/rabota-temp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3.4 Получение SSL сертификата

```bash
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d rabota.yo1nk.ru \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email
```

Certbot создаст сертификаты в:
- `/etc/letsencrypt/live/rabota.yo1nk.ru/fullchain.pem`
- `/etc/letsencrypt/live/rabota.yo1nk.ru/privkey.pem`

---

## Шаг 4: Настройка финальной конфигурации Nginx

### 4.1 Удаление временной конфигурации

```bash
sudo rm /etc/nginx/sites-enabled/rabota-temp
sudo rm /etc/nginx/sites-available/rabota-temp
```

### 4.2 Установка финальной конфигурации

Скопируйте конфигурацию из репозитория:
```bash
sudo cp /opt/rabota/nginx-host.conf /etc/nginx/sites-available/rabota.yo1nk.ru
```

ИЛИ создайте вручную:
```bash
sudo nano /etc/nginx/sites-available/rabota.yo1nk.ru
```

И вставьте содержимое из файла `nginx-host.conf` в репозитории.

### 4.3 Активация конфигурации

```bash
# Создание символической ссылки
sudo ln -s /etc/nginx/sites-available/rabota.yo1nk.ru /etc/nginx/sites-enabled/

# Проверка конфигурации
sudo nginx -t

# Перезагрузка Nginx
sudo systemctl reload nginx
```

---

## Шаг 5: Проверка работоспособности

1. **Откройте браузер и перейдите на**: https://rabota.yo1nk.ru

2. **Проверка SSL сертификата**:
   ```bash
   curl -I https://rabota.yo1nk.ru
   ```

3. **Проверка API**:
   ```bash
   curl https://rabota.yo1nk.ru/api/shifts
   ```

4. **Проверка health endpoint**:
   ```bash
   curl https://rabota.yo1nk.ru/health
   ```

---

## Автоматическое обновление SSL сертификата

Let's Encrypt сертификаты действительны 90 дней. Certbot автоматически настраивает cron job для обновления.

Проверка автообновления:
```bash
# Тест обновления (dry run)
sudo certbot renew --dry-run

# Просмотр cron задач certbot
sudo systemctl status certbot.timer
```

Если нужно настроить вручную:
```bash
# Добавление cron задачи
sudo crontab -e

# Добавьте строку (обновление каждый день в 3:00)
0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

## Обновление переменных окружения для frontend

Если frontend использует `.env` файл для API URL, обновите его:

```bash
cd /opt/rabota/work-schedule-app
sudo nano .env
```

Содержимое:
```env
VITE_API_URL=https://rabota.yo1nk.ru/api
```

После изменения пересоберите frontend:
```bash
cd /opt/rabota
sudo docker compose build frontend
sudo docker compose up -d frontend
```

---

## Управление сервисами

### Перезапуск всех сервисов
```bash
cd /opt/rabota
sudo docker compose restart
```

### Перезапуск только frontend
```bash
sudo docker compose restart frontend
```

### Перезапуск только backend
```bash
sudo docker compose restart backend
```

### Просмотр логов
```bash
# Все логи
sudo docker compose logs -f

# Только backend
sudo docker compose logs -f backend

# Только frontend
sudo docker compose logs -f frontend

# Nginx логи
sudo tail -f /var/log/nginx/rabota_access.log
sudo tail -f /var/log/nginx/rabota_error.log
```

### Остановка всех сервисов
```bash
sudo docker compose stop
```

### Полное удаление (с данными)
```bash
sudo docker compose down -v
```

---

## Troubleshooting

### Проблема: "502 Bad Gateway"

**Причина**: Nginx не может подключиться к Docker контейнерам

**Решение**:
```bash
# Проверьте что контейнеры запущены
sudo docker compose ps

# Проверьте что порты доступны
curl http://localhost:8081  # frontend
curl http://localhost:3001/health  # backend

# Перезапустите контейнеры
sudo docker compose restart
```

### Проблема: "NET::ERR_CERT_AUTHORITY_INVALID"

**Причина**: SSL сертификат не установлен или неверно настроен

**Решение**:
```bash
# Проверьте наличие сертификатов
sudo ls -la /etc/letsencrypt/live/rabota.yo1nk.ru/

# Проверьте конфигурацию Nginx
sudo nginx -t

# Переполучите сертификат
sudo certbot certonly --webroot -w /var/www/certbot -d rabota.yo1nk.ru --force-renewal
```

### Проблема: Frontend не загружается (белый экран)

**Причина**: Неверный API URL в frontend

**Решение**:
```bash
# Проверьте .env файл frontend
cat /opt/rabota/work-schedule-app/.env

# Должен быть: VITE_API_URL=https://rabota.yo1nk.ru/api
# Пересоберите frontend
cd /opt/rabota
sudo docker compose build frontend
sudo docker compose up -d frontend
```

### Проблема: CORS ошибки в консоли браузера

**Причина**: Backend не разрешает запросы с домена

**Решение**:
```bash
# Проверьте .env в корне проекта
cat /opt/rabota/.env

# Должен быть: CORS_ORIGIN=https://rabota.yo1nk.ru
# Перезапустите backend
sudo docker compose restart backend
```

---

## Мониторинг

### Проверка использования ресурсов

```bash
# Docker статистика
sudo docker stats

# Память
free -h

# Диск
df -h

# CPU
top
```

### Проверка логов ошибок

```bash
# Nginx ошибки
sudo tail -50 /var/log/nginx/rabota_error.log

# Backend ошибки
sudo docker compose logs --tail=50 backend

# PostgreSQL ошибки
sudo docker compose logs --tail=50 postgres
```

---

## Резервное копирование

### База данных

```bash
# Создание backup
sudo docker compose exec postgres pg_dump -U rabota_user rabota_db > /opt/rabota-backup-$(date +%Y%m%d).sql

# Восстановление
sudo docker compose exec -T postgres psql -U rabota_user rabota_db < /opt/rabota-backup-20250101.sql
```

### SSL сертификаты

```bash
# Backup сертификатов
sudo tar -czf /opt/letsencrypt-backup-$(date +%Y%m%d).tar.gz /etc/letsencrypt

# Восстановление
sudo tar -xzf /opt/letsencrypt-backup-20250101.tar.gz -C /
```

---

## Обновление приложения

```bash
cd /opt/rabota

# Получение обновлений
sudo git pull origin master

# Пересборка и перезапуск
sudo docker compose build
sudo docker compose up -d

# Перезагрузка Nginx (если изменилась конфигурация)
sudo systemctl reload nginx
```

---

## Безопасность

### Рекомендуемые настройки файрвола (UFW)

```bash
# Разрешить SSH
sudo ufw allow 22/tcp

# Разрешить HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Запретить прямой доступ к Docker портам извне
# (они должны быть доступны только локально)
# Убедитесь что в docker-compose.yml используется "127.0.0.1:8080:80"
# вместо "8080:80" для большей безопасности

# Включить файрвол
sudo ufw enable
sudo ufw status
```

### Обновление docker-compose.yml для безопасности

Измените проброс портов на локальный доступ:

```yaml
services:
  postgres:
    ports:
      - "127.0.0.1:5432:5432"  # Только localhost

  backend:
    ports:
      - "127.0.0.1:3001:3001"  # Только localhost

  frontend:
    ports:
      - "127.0.0.1:8081:80"    # Только localhost
```

После изменения:
```bash
sudo docker compose down
sudo docker compose up -d
```

---

## Контакты и поддержка

- GitHub Repository: git@github.com:xyzmean/rabota_dev.git
- Issues: https://github.com/xyzmean/rabota_dev/issues

---

## Краткая справка команд

```bash
# Проверка статуса всех сервисов
sudo docker compose ps
sudo systemctl status nginx

# Перезапуск
sudo docker compose restart
sudo systemctl reload nginx

# Логи
sudo docker compose logs -f
sudo tail -f /var/log/nginx/rabota_access.log

# Обновление SSL
sudo certbot renew

# Обновление приложения
cd /opt/rabota && sudo git pull && sudo docker compose up -d --build

# Проверка здоровья
curl https://rabota.yo1nk.ru/health
```
