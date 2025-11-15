# API Examples - RaboTA

Примеры использования REST API для RaboTA.

Base URL: `http://localhost:3001/api`

## Health Check

Проверка состояния сервера:

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 123.456
}
```

---

## Employees API

### Получить всех сотрудников

```bash
curl http://localhost:3001/api/employees
```

Response:
```json
[
  {
    "id": "emp_12345",
    "name": "Иван Иванов",
    "excludeFromHours": false
  },
  {
    "id": "emp_67890",
    "name": "Петр Петров (УМ)",
    "excludeFromHours": true
  }
]
```

### Получить сотрудника по ID

```bash
curl http://localhost:3001/api/employees/emp_12345
```

### Создать сотрудника

```bash
curl -X POST http://localhost:3001/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "id": "emp_12345",
    "name": "Иван Иванов",
    "excludeFromHours": false
  }'
```

### Обновить сотрудника

```bash
curl -X PUT http://localhost:3001/api/employees/emp_12345 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Иван Иванов (обновлен)",
    "excludeFromHours": false
  }'
```

### Удалить сотрудника

```bash
curl -X DELETE http://localhost:3001/api/employees/emp_12345
```

---

## Shifts API

### Получить все смены

```bash
curl http://localhost:3001/api/shifts
```

Response:
```json
[
  {
    "id": "shift_weekend",
    "name": "Выходной",
    "abbreviation": "В",
    "color": "#EF4444",
    "hours": 0,
    "isDefault": true
  },
  {
    "id": "shift_day",
    "name": "День",
    "abbreviation": "Д",
    "color": "#3B82F6",
    "hours": 8,
    "isDefault": false
  }
]
```

### Получить смену по ID

```bash
curl http://localhost:3001/api/shifts/shift_day
```

### Создать смену

```bash
curl -X POST http://localhost:3001/api/shifts \
  -H "Content-Type: application/json" \
  -d '{
    "id": "shift_night",
    "name": "Ночь",
    "abbreviation": "Н",
    "color": "#1F2937",
    "hours": 12,
    "isDefault": false
  }'
```

### Обновить смену

```bash
curl -X PUT http://localhost:3001/api/shifts/shift_night \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ночная смена",
    "abbreviation": "Н",
    "color": "#111827",
    "hours": 12,
    "isDefault": false
  }'
```

### Удалить смену

```bash
curl -X DELETE http://localhost:3001/api/shifts/shift_night
```

**Примечание**: Невозможно удалить смену с `isDefault: true`

---

## Schedule API

### Получить весь график

```bash
curl http://localhost:3001/api/schedule
```

### Получить график за конкретный месяц

```bash
# Январь 2025 (month=0, year=2025)
curl "http://localhost:3001/api/schedule?month=0&year=2025"
```

Response:
```json
[
  {
    "id": 1,
    "employeeId": "emp_12345",
    "day": 15,
    "month": 0,
    "year": 2025,
    "shiftId": "shift_day"
  },
  {
    "id": 2,
    "employeeId": "emp_67890",
    "day": 15,
    "month": 0,
    "year": 2025,
    "shiftId": "shift_weekend"
  }
]
```

### Получить запись по ID

```bash
curl http://localhost:3001/api/schedule/1
```

### Создать запись в графике

```bash
curl -X POST http://localhost:3001/api/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "emp_12345",
    "day": 16,
    "month": 0,
    "year": 2025,
    "shiftId": "shift_day"
  }'
```

### Обновить запись

```bash
curl -X PUT http://localhost:3001/api/schedule/1 \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "emp_12345",
    "day": 16,
    "month": 0,
    "year": 2025,
    "shiftId": "shift_night"
  }'
```

### Удалить запись

```bash
curl -X DELETE http://localhost:3001/api/schedule/1
```

### Удалить по дате и сотруднику

```bash
curl -X POST http://localhost:3001/api/schedule/delete-by-date \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "emp_12345",
    "day": 16,
    "month": 0,
    "year": 2025
  }'
```

### Массовое создание/обновление (Bulk Upsert)

Полезно для синхронизации всего графика:

```bash
curl -X POST http://localhost:3001/api/schedule/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      {
        "employeeId": "emp_12345",
        "day": 16,
        "month": 0,
        "year": 2025,
        "shiftId": "shift_day"
      },
      {
        "employeeId": "emp_12345",
        "day": 17,
        "month": 0,
        "year": 2025,
        "shiftId": "shift_day"
      },
      {
        "employeeId": "emp_67890",
        "day": 16,
        "month": 0,
        "year": 2025,
        "shiftId": "shift_weekend"
      }
    ]
  }'
```

---

## Использование в JavaScript/TypeScript

### С использованием встроенного API клиента

```typescript
import { employeeApi, shiftApi, scheduleApi } from './services/api';

// Получить всех сотрудников
const employees = await employeeApi.getAll();

// Создать сотрудника
const newEmployee = await employeeApi.create({
  id: 'emp_12345',
  name: 'Иван Иванов',
  excludeFromHours: false
});

// Получить график за январь 2025
const schedule = await scheduleApi.getAll(0, 2025);

// Массовое создание
const result = await scheduleApi.bulkUpsert([
  {
    employeeId: 'emp_12345',
    day: 16,
    month: 0,
    year: 2025,
    shiftId: 'shift_day'
  }
]);
```

### С использованием Fetch API

```javascript
// Получить сотрудников
const response = await fetch('http://localhost:3001/api/employees');
const employees = await response.json();

// Создать сотрудника
const response = await fetch('http://localhost:3001/api/employees', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'emp_12345',
    name: 'Иван Иванов',
    excludeFromHours: false
  })
});
const newEmployee = await response.json();
```

---

## Обработка ошибок

### Успешные ответы
- `200 OK` - Успешный GET/PUT запрос
- `201 Created` - Успешный POST запрос
- `204 No Content` - Успешный DELETE запрос

### Ошибки

#### 400 Bad Request
Неверные параметры запроса:

```json
{
  "error": "All fields are required"
}
```

#### 404 Not Found
Ресурс не найден:

```json
{
  "error": "Employee not found"
}
```

#### 409 Conflict
Конфликт данных (например, дубликат):

```json
{
  "error": "Schedule entry already exists for this employee on this date"
}
```

#### 500 Internal Server Error
Внутренняя ошибка сервера:

```json
{
  "error": "Internal server error"
}
```

---

## Примеры сценариев использования

### Сценарий 1: Создание расписания на месяц

```bash
# 1. Создать сотрудников
curl -X POST http://localhost:3001/api/employees \
  -H "Content-Type: application/json" \
  -d '{"id":"emp1","name":"Сотрудник 1","excludeFromHours":false}'

curl -X POST http://localhost:3001/api/employees \
  -H "Content-Type: application/json" \
  -d '{"id":"emp2","name":"Сотрудник 2","excludeFromHours":false}'

# 2. Создать смены
curl -X POST http://localhost:3001/api/shifts \
  -H "Content-Type: application/json" \
  -d '{"id":"day","name":"День","abbreviation":"Д","color":"#3B82F6","hours":8,"isDefault":false}'

curl -X POST http://localhost:3001/api/shifts \
  -H "Content-Type: application/json" \
  -d '{"id":"weekend","name":"Выходной","abbreviation":"В","color":"#EF4444","hours":0,"isDefault":true}'

# 3. Создать расписание (bulk)
curl -X POST http://localhost:3001/api/schedule/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      {"employeeId":"emp1","day":1,"month":0,"year":2025,"shiftId":"day"},
      {"employeeId":"emp1","day":2,"month":0,"year":2025,"shiftId":"day"},
      {"employeeId":"emp2","day":1,"month":0,"year":2025,"shiftId":"weekend"}
    ]
  }'

# 4. Получить расписание
curl "http://localhost:3001/api/schedule?month=0&year=2025"
```

### Сценарий 2: Обновление смены сотрудника

```bash
# Найти запись по дате и сотруднику, затем удалить
curl -X POST http://localhost:3001/api/schedule/delete-by-date \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"emp1","day":1,"month":0,"year":2025}'

# Создать новую запись с другой сменой
curl -X POST http://localhost:3001/api/schedule \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"emp1","day":1,"month":0,"year":2025,"shiftId":"weekend"}'
```

---

## Тестирование API с Postman

1. Импортируйте коллекцию или создайте новую
2. Установите базовый URL: `http://localhost:3001/api`
3. Создайте запросы по примерам выше
4. Для тестирования используйте environment variables

---

## Дополнительная информация

- **CORS**: Backend настроен для работы с `http://localhost:5173` в development режиме
- **Rate Limiting**: Не реализовано (может быть добавлено в будущем)
- **Аутентификация**: Пока не требуется (может быть добавлена в будущем)

Для более подробной информации см. [CLAUDE.md](./CLAUDE.md)
