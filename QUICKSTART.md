# RaboTA - Быстрый старт

Это краткое руководство для быстрого запуска проекта локально.

## Предварительные требования

### С Docker (Рекомендуется)
- Docker Desktop или Docker Engine
- Docker Compose plugin

### Без Docker
- Node.js 20.x
- PostgreSQL 15
- Git

## Вариант 1: Запуск с Docker (5 минут)

### 1. Клонирование репозитория

```bash
cd /path/to/your/projects
git clone git@github.com:xyzmean/rabota_dev.git
cd rabota_dev
```

### 2. Создание .env файла

```bash
# Создаем .env в корне проекта
cat > .env << 'EOF'
DB_PASSWORD=mySecurePassword123
CORS_ORIGIN=http://localhost
EOF
```

### 3. Запуск всех сервисов

```bash
docker compose up -d
```

### 4. Проверка работоспособности

```bash
# Проверка backend
curl http://localhost:3001/health
# Должен вернуть: {"status":"OK",...}

# Открыть в браузере
# Frontend: http://localhost
```

### 5. Просмотр логов (если нужно)

```bash
docker compose logs -f
```

### Остановка

```bash
docker compose stop
```

---

## Вариант 2: Локальная разработка (15 минут)

### 1. Клонирование репозитория

```bash
cd /path/to/your/projects
git clone git@github.com:xyzmean/rabota_dev.git
cd rabota_dev
```

### 2. Установка и настройка PostgreSQL

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-contrib -y
sudo systemctl start postgresql
```

#### macOS
```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Windows
Скачайте и установите PostgreSQL с официального сайта: https://www.postgresql.org/download/windows/

### 3. Создание базы данных

```bash
# Подключитесь к PostgreSQL
sudo -u postgres psql

# Выполните следующие команды:
CREATE DATABASE rabota_db;
CREATE USER rabota_user WITH PASSWORD 'changeme';
GRANT ALL PRIVILEGES ON DATABASE rabota_db TO rabota_user;
\q
```

### 4. Настройка Backend

```bash
cd backend

# Установка зависимостей
npm install

# Создание .env файла
cat > .env << 'EOF'
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rabota_db
DB_USER=rabota_user
DB_PASSWORD=changeme
CORS_ORIGIN=http://localhost:5173
EOF

# Запуск миграций
npm run migrate

# Запуск dev сервера
npm run dev
```

Backend запустится на `http://localhost:3001`

### 5. Настройка Frontend (в новом терминале)

```bash
cd work-schedule-app

# Установка зависимостей
npm install

# Создание .env файла
cat > .env << 'EOF'
VITE_API_URL=http://localhost:3001/api
EOF

# Запуск dev сервера
npm run dev
```

Frontend запустится на `http://localhost:5173`

### 6. Проверка

Откройте браузер:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/health

---

## Часто используемые команды

### Docker

```bash
# Запуск всех сервисов
docker compose up -d

# Остановка всех сервисов
docker compose stop

# Перезапуск
docker compose restart

# Просмотр логов
docker compose logs -f backend
docker compose logs -f postgres

# Удаление контейнеров и данных
docker compose down -v

# Пересборка и запуск
docker compose up --build -d
```

### Локальная разработка

```bash
# Backend
cd backend
npm run dev          # Запуск dev сервера
npm run build        # Сборка
npm run migrate      # Запуск миграций

# Frontend
cd work-schedule-app
npm run dev          # Запуск dev сервера
npm run build        # Сборка
npm run lint         # Проверка кода
```

### База данных

```bash
# Подключение к БД (Docker)
docker compose exec postgres psql -U rabota_user rabota_db

# Подключение к БД (локально)
psql -U rabota_user -d rabota_db

# Создание бэкапа
docker compose exec postgres pg_dump -U rabota_user rabota_db > backup.sql

# Восстановление
docker compose exec -T postgres psql -U rabota_user rabota_db < backup.sql
```

---

## Troubleshooting

### Порт уже занят

```bash
# Проверить что использует порт 3001
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# Или измените PORT в backend/.env
```

### Backend не может подключиться к PostgreSQL

1. Проверьте что PostgreSQL запущен:
   ```bash
   # Docker
   docker compose ps postgres

   # Локально
   sudo systemctl status postgresql  # Linux
   brew services list  # macOS
   ```

2. Проверьте настройки в backend/.env

### Frontend не может подключиться к backend

1. Убедитесь что backend запущен: `curl http://localhost:3001/health`
2. Проверьте VITE_API_URL в work-schedule-app/.env
3. Проверьте CORS_ORIGIN в backend/.env

### Ошибка "permission denied" при работе с Docker

```bash
# Linux: добавьте пользователя в группу docker
sudo usermod -aG docker $USER
# Перелогиньтесь
```

---

## Следующие шаги

1. Прочитайте [CLAUDE.md](./CLAUDE.md) для понимания архитектуры проекта
2. Изучите [DEPLOYMENT.md](./DEPLOYMENT.md) для развертывания на сервере
3. Начните разработку новых модулей

## Поддержка

- GitHub Issues: https://github.com/xyzmean/rabota_dev/issues
- Repository: git@github.com:xyzmean/rabota_dev.git
