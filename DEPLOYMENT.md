# Руководство по развертыванию RaboTA

Это руководство описывает процесс развертывания приложения RaboTA на сервере с PostgreSQL.

> **📌 Настройка на поддомене rabota.yo1nk.ru**
> Если вы хотите развернуть приложение на поддомене с HTTPS (порт 443), см. подробное руководство: **[SUBDOMAIN-SETUP.md](./SUBDOMAIN-SETUP.md)**

---

## Системные требования

### Минимальные характеристики сервера
- **CPU**: 1 ядро
- **RAM**: 2GB
- **ROM**: 30GB
- **ОС**: Ubuntu 20.04+ / Debian 10+ или аналогичная
- **Пользователи**: 3-4 одновременных пользователя

### Программное обеспечение
- Docker & Docker Compose (рекомендуется) **ИЛИ**
- Node.js 20.x
- PostgreSQL 15+
- Nginx (опционально, для production)

---

## Вариант 1: Развертывание с Docker Compose (Рекомендуется)

### Шаг 1: Установка Docker

```bash
# Обновление пакетов
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo apt install docker-compose-plugin -y

# Проверка установки
docker --version
docker compose version
```

### Шаг 2: Клонирование проекта

```bash
cd /opt
sudo git clone git@github.com:xyzmean/rabota_dev.git rabota
cd rabota
```

### Шаг 3: Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```bash
sudo nano .env
```

Добавьте следующие переменные:

```env
# PostgreSQL
DB_PASSWORD=your_secure_password_here

# CORS (замените на IP вашего сервера)
CORS_ORIGIN=http://your-server-ip
```

### Шаг 4: Запуск приложения

```bash
# Запуск всех сервисов
sudo docker compose up -d

# Проверка статуса
sudo docker compose ps

# Просмотр логов
sudo docker compose logs -f
```

### Шаг 5: Проверка работоспособности

```bash
# Проверка backend
curl http://localhost:3001/health

# Проверка frontend
curl http://localhost:80
```

Приложение будет доступно по адресу: `http://your-server-ip`

### Управление сервисами

```bash
# Остановка
sudo docker compose stop

# Перезапуск
sudo docker compose restart

# Удаление контейнеров
sudo docker compose down

# Удаление контейнеров и данных
sudo docker compose down -v
```

---

## Вариант 2: Ручное развертывание (без Docker)

### Шаг 1: Установка PostgreSQL

```bash
# Установка PostgreSQL 15
sudo apt update
sudo apt install postgresql-15 postgresql-contrib -y

# Запуск PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Шаг 2: Настройка базы данных

```bash
# Переключение на пользователя postgres
sudo -u postgres psql

# Создание базы данных и пользователя
CREATE DATABASE rabota_db;
CREATE USER rabota_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE rabota_db TO rabota_user;
\q
```

### Шаг 3: Установка Node.js

```bash
# Установка Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Проверка установки
node --version
npm --version
```

### Шаг 4: Клонирование и настройка backend

```bash
cd /opt
sudo git clone git@github.com:xyzmean/rabota_dev.git rabota
cd rabota/backend

# Установка зависимостей
npm install

# Настройка .env
sudo nano .env
```

Содержимое `.env` для backend:

```env
PORT=3001
NODE_ENV=production

DB_HOST=localhost
DB_PORT=5432
DB_NAME=rabota_db
DB_USER=rabota_user
DB_PASSWORD=your_secure_password

CORS_ORIGIN=http://your-server-ip
```

```bash
# Сборка проекта
npm run build

# Запуск миграций
npm run migrate
```

### Шаг 5: Настройка frontend

```bash
cd /opt/rabota/work-schedule-app

# Установка зависимостей
npm install

# Настройка .env
sudo nano .env
```

Содержимое `.env` для frontend:

```env
VITE_API_URL=http://your-server-ip:3001/api
```

```bash
# Сборка проекта
npm run build
```

### Шаг 6: Установка PM2 (для управления процессами)

```bash
# Установка PM2
sudo npm install -g pm2

# Запуск backend
cd /opt/rabota/backend
pm2 start dist/server.js --name rabota-backend

# Автозапуск при перезагрузке
pm2 startup
pm2 save
```

### Шаг 7: Настройка Nginx

```bash
# Установка Nginx
sudo apt install nginx -y

# Создание конфигурации
sudo nano /etc/nginx/sites-available/rabota
```

Содержимое конфигурации:

```nginx
server {
    listen 80;
    server_name your-server-ip;

    # Frontend
    location / {
        root /opt/rabota/work-schedule-app/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Активация конфигурации
sudo ln -s /etc/nginx/sites-available/rabota /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Мониторинг и обслуживание

### Проверка логов (Docker)

```bash
# Backend
sudo docker compose logs backend

# PostgreSQL
sudo docker compose logs postgres

# Frontend
sudo docker compose logs frontend
```

### Проверка логов (PM2)

```bash
# Все процессы
pm2 logs

# Конкретный процесс
pm2 logs rabota-backend

# Статус
pm2 status
```

### Резервное копирование базы данных

```bash
# С Docker
sudo docker compose exec postgres pg_dump -U rabota_user rabota_db > backup.sql

# Без Docker
sudo -u postgres pg_dump rabota_db > backup.sql
```

### Восстановление из резервной копии

```bash
# С Docker
sudo docker compose exec -T postgres psql -U rabota_user rabota_db < backup.sql

# Без Docker
sudo -u postgres psql rabota_db < backup.sql
```

---

## Оптимизация для сервера с ограниченными ресурсами

### PostgreSQL настройки

Файл `docker-compose.yml` уже содержит оптимизации для сервера с 1 CPU и 2GB RAM:

```yaml
command: >
  postgres
  -c shared_buffers=128MB
  -c effective_cache_size=512MB
  -c maintenance_work_mem=64MB
  -c max_connections=20
  -c work_mem=8MB
```

Для ручной установки добавьте в `/etc/postgresql/15/main/postgresql.conf`:

```
shared_buffers = 128MB
effective_cache_size = 512MB
maintenance_work_mem = 64MB
max_connections = 20
work_mem = 8MB
```

### Мониторинг ресурсов

```bash
# Использование памяти
free -h

# Использование CPU
top

# Использование диска
df -h

# Docker статистика
sudo docker stats
```

---

## Обновление приложения

### С Docker

```bash
cd /opt/rabota
sudo git pull origin master
sudo docker compose build
sudo docker compose up -d
```

### Без Docker

```bash
cd /opt/rabota
sudo git pull origin master

# Backend
cd backend
npm install
npm run build
pm2 restart rabota-backend

# Frontend
cd ../work-schedule-app
npm install
npm run build
sudo systemctl reload nginx
```

---

## Миграция данных из Local Storage в PostgreSQL

После развертывания, если у вас есть данные в Local Storage браузера, вам нужно:

1. Экспортировать данные из браузера (используйте console в DevTools):
```javascript
const data = {
  shifts: JSON.parse(localStorage.getItem('workSchedule_shifts')),
  employees: JSON.parse(localStorage.getItem('workSchedule_employees')),
  schedule: JSON.parse(localStorage.getItem('workSchedule_schedule'))
};
console.log(JSON.stringify(data));
```

2. Импортировать данные через API (используйте Postman или curl):
```bash
# Пример для сотрудников
curl -X POST http://your-server-ip:3001/api/employees \
  -H "Content-Type: application/json" \
  -d '{"id":"employee_id","name":"Name","excludeFromHours":false}'
```

---

## Интеграция frontend с API

Для полной интеграции frontend с backend API необходимо заменить `useLocalStorage` hook на API вызовы в следующих компонентах:

### 1. `src/pages/Schedule.tsx`

Замените:
```typescript
const [shifts, setShifts] = useLocalStorage<Shift[]>('workSchedule_shifts', []);
const [employees, setEmployees] = useLocalStorage<Employee[]>('workSchedule_employees', []);
const [schedule, setSchedule] = useLocalStorage<ScheduleEntry[]>('workSchedule_schedule', []);
```

На:
```typescript
import { shiftApi, employeeApi, scheduleApi } from '../services/api';

const [shifts, setShifts] = useState<Shift[]>([]);
const [employees, setEmployees] = useState<Employee[]>([]);
const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);

// Загрузка данных
useEffect(() => {
  const loadData = async () => {
    try {
      const [shiftsData, employeesData, scheduleData] = await Promise.all([
        shiftApi.getAll(),
        employeeApi.getAll(),
        scheduleApi.getAll()
      ]);
      setShifts(shiftsData);
      setEmployees(employeesData);
      setSchedule(scheduleData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };
  loadData();
}, []);
```

### 2. Обновление CRUD операций

Замените локальные операции на API вызовы:

```typescript
// Пример для добавления сотрудника
const handleAddEmployee = async (employeeData: Omit<Employee, 'id'>) => {
  const newEmployee = {
    ...employeeData,
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  try {
    const created = await employeeApi.create(newEmployee);
    setEmployees([...employees, created]);
  } catch (error) {
    console.error('Error creating employee:', error);
  }
};
```

Аналогично обновите все CRUD операции для shifts и schedule.

---

## Troubleshooting

### Backend не стартует

```bash
# Проверьте логи
sudo docker compose logs backend

# Проверьте подключение к БД
sudo docker compose exec postgres psql -U rabota_user -d rabota_db
```

### Frontend не может подключиться к API

1. Проверьте CORS настройки в backend `.env`
2. Убедитесь что backend запущен: `curl http://localhost:3001/health`
3. Проверьте `VITE_API_URL` в frontend `.env`

### PostgreSQL занимает много памяти

Уменьшите `shared_buffers` в `docker-compose.yml` или `postgresql.conf` до 64MB.

---

## Контакты и поддержка

- GitHub Issues: https://github.com/xyzmean/rabota_dev/issues
- Repository: git@github.com:xyzmean/rabota_dev.git
