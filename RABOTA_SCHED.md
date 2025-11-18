# RABOTA_SCHED - Логика работы системы графиков и запросов выходных

## Обзор

Документ описывает текущую реализацию двух ключевых подсистем RaboTA:
1. **Автогенерация графика работы** - автоматическое создание рабочих смен
2. **Система запросов выходных** - управление запросами сотрудников на выходные дни

---

## 1. Автогенерация графика работы

### 1.1 Основной компонент

**Файл**: `backend/src/controllers/autoScheduleController.ts`

**Основная функция**: `generateSchedule()` - эндпоинт `POST /api/auto-schedule`

### 1.2 Алгоритм работы

#### 1.2.1 Подготовка данных

```typescript
// Получаем необходимые данные
const [employees, shifts, validationRules, approvedDayOffs] = await Promise.all([
  getEmployees(),
  getShifts(),
  getValidationRules(),
  getApprovedDayOffs(month, year)
]);
```

**Данные для генерации:**
- **Сотрудники** (`employees`) - все активные сотрудники с ролями
- **Смены** (`shifts`) - все доступные смены, включая выходную смену 'day-off'
- **Правила валидации** (`validationRules`) - включенные правила с приоритетами
- **Одобренные выходные** (`approvedDayOffs`) - утвержденные запросы на выходные

#### 1.2.2 Очистка существующего графика

```typescript
await clearExistingSchedule(month, year);
```

Полная очистка существующего графика за указанный месяц перед генерацией нового.

#### 1.2.3 Генерация оптимального графика

**Основная функция**: `generateOptimalSchedule()`

##### Шаг 1: Распределение выходных по запросам

```typescript
// Назначаем выходные по запросам
for (const employee of employees) {
  for (const dayOff of approvedDayOffs) {
    if (dayOff.employeeId === employee.id) {
      // Добавляем выходной день в график
      schedule.push({
        employee_id: employee.id,
        day: offDay,
        month,
        year,
        shift_id: 'day-off'
      });
    }
  }
}
```

##### Шаг 2: Создание трекера рабочих дней

```typescript
const workDaysTracker = new Map<string, number>();
employees.forEach(emp => workDaysTracker.set(emp.id, 0));
```

Отслеживание количества рабочих дней подряд для каждого сотрудника.

##### Шаг 3: Генерация расписания по дням

**Функция**: `generateDayScheduleSimple()`

**Приоритеты сотрудников:**
1. Сотрудники, которым нужен выходной (больше maxConsecutiveDays)
2. Сотрудники с меньшим количеством рабочих дней подряд
3. Сотрудники с меньшим количеством смен в месяце

**Формула приоритета:**
```typescript
priority: needsDayOff ? -1 : 1000 - consecutiveDays - monthlyShifts * 10
```

##### Шаг 4: Распределение смен

```typescript
// Распределяем смены поочередно для равномерности
for (let i = 0; i < shifts.length; i++) {
  const shift = shifts[i];
  let employeesAssigned = 0;

  // Назначаем минимальное количество сотрудников на смену
  for (const empData of employeePriorities) {
    if (employeesAssigned >= minEmployeesPerShift) break;
    if (empData.needsDayOff) continue;

    // Назначение смены
    daySchedule.push({
      employee_id: empData.employee.id,
      day, month, year,
      shift_id: shift.id
    });
    employeesAssigned++;
  }
}
```

**Правила распределения:**
- Сначала назначаются сотрудники с наивысшим приоритетом
- Каждая смена должна иметь минимум `minEmployeesPerShift` сотрудников
- Если недостаточно сотрудников, нарушается правило `needsDayOff`
- Оставшимся сотрудникам назначаются выходные

##### Шаг 5: Проверка последовательности рабочих дней

**Функция**: `getConsecutiveWorkDays()`

```typescript
function getConsecutiveWorkDays(employeeId, currentDay, currentMonth, currentYear, schedule) {
  let consecutiveDays = 0;
  let checkDay = currentDay - 1;

  // Проверяем дни в обратном порядке
  while (checkDay > 0) {
    const dayEntry = schedule.find(s =>
      s.employee_id === employeeId &&
      s.day === checkDay &&
      s.month === currentMonth &&
      s.year === currentYear
    );

    if (!dayEntry || dayEntry.shift_id === 'day-off') {
      break; // Прерываем последовательность
    }

    consecutiveDays++;
    checkDay--;
  }

  return consecutiveDays;
}
```

#### 1.2.4 Сохранение результатов

```typescript
await saveSchedule(generatedSchedule);
```

Сохранение сгенерированного графика в базу данных.

### 1.3 Используемые правила валидации

- **min_employees_per_shift** - минимальное количество сотрудников на смену
- **max_consecutive_work_days** / **max_consecutive_shifts** - максимум рабочих дней подряд

---

## 2. Система запросов выходных

### 2.1 Основные компоненты

**Backend:**
- `backend/src/controllers/preferencesController.ts` - управление запросами
- `backend/src/controllers/preferenceReasonsController.ts` - управление причинами

**Frontend:**
- `work-schedule-app/src/components/DayOffRequestModal.tsx` - модальное окно создания/редактирования
- `work-schedule-app/src/pages/DayOffRequests.tsx` - страница управления запросами
- `work-schedule-app/src/components/DayOffRequestViewer.tsx` - просмотр деталей запроса

### 2.2 Статусы запросов

1. **pending** - ожидает рассмотрения
2. **approved** - одобрено
3. **rejected** - отклонено

### 2.3 Создание запроса

**Форма запроса** (`DayOffRequestModal.tsx`):

```typescript
{
  employeeId: string,      // ID сотрудника
  preferenceType: 'day_off', // Тип запроса
  targetDate: string,      // Дата в формате YYYY-MM-DD
  reasonId?: number,       // ID причины (опционально)
  priority?: number,       // Приоритет (из причины)
  status: 'pending',       // Статус по умолчанию
  notes?: string          // Примечание
}
```

**API эндпоинт**: `POST /api/preferences`

### 2.4 Одобрение запроса

**Функция**: `handleApproveRequest()` в `DayOffRequests.tsx`

**Процесс одобрения:**

1. **Обновление статуса запроса**:
   ```typescript
   await preferencesApi.updateStatus(id, 'approved');
   ```

2. **Создание правила валидации**:
   ```typescript
   const ruleData = {
     ruleType: 'employee_day_off',
     enabled: true,
     config: {
       employeeId: request.employeeId,
       specificDate: request.targetDate,
     },
     appliesToEmployees: [request.employeeId],
     enforcementType: 'error',
     customMessage: `Выходной для ${employee.name} (${request.targetDate})`,
     priority: 1, // Высший приоритет
     description: `Автоматически созданное правило для выходного дня сотрудника ${employee.name}`
   };
   const newRule = await validationRulesApi.create(ruleData);
   ```

3. **Обновление приоритетов существующих правил**:
   ```typescript
   // Новые приоритеты: 2, 3, 4, ...
   const rulesToUpdate = existingRules
     .filter(r => r.id !== newRule.id)
     .sort((a, b) => a.priority - b.priority)
     .map((rule, index) => ({
       ...rule,
       priority: index + 2
     }));
   ```

### 2.5 Причины запросов

**Таблица**: `preference_reasons`

**Структура:**
```typescript
{
  id: number,
  name: string,           // Название причины
  priority: number,       // Приоритет (0-100)
  color?: string,         // Цветовое обозначение
  description?: string    // Описание
}
```

**API эндпоинты:**
- `GET /api/preference-reasons` - получить все причины
- `POST /api/preference-reasons` - создать причину
- `PUT /api/preference-reasons/:id` - обновить причину
- `DELETE /api/preference-reasons/:id` - удалить причину
- `POST /api/preference-reasons/reorder` - изменить порядок (drag-and-drop)

### 2.6 Интеграция с автогенерацией графика

**Учет одобренных выходных**:

```typescript
// Функция getApprovedDayOffs() в autoScheduleController.ts
async function getApprovedDayOffs(month: number, year: number): Promise<DayOffRequest[]> {
  const query = `
    SELECT employee_id as "employeeId", target_date as "date"
    FROM employee_preferences
    WHERE preference_type = 'day_off'
      AND status = 'approved'
      AND EXTRACT(MONTH FROM target_date) = $1
      AND EXTRACT(YEAR FROM target_date) = $2
  `;
  // ...
}
```

Одобренные запросы автоматически учитываются при генерации графика как обязательные выходные дни.

---

## 3. Взаимодействие систем

### 3.1 Цикл работы

1. **Создание запроса**: Сотрудник создает запрос на выходной
2. **Рассмотрение**: Менеджер одобряет или отклоняет запрос
3. **Создание правила**: При одобрении автоматически создается правило валидации
4. **Генерация графика**: Автогенератор учитывает одобренные выходные
5. **Применение правил**: Правила с высшим приоритетом блокируют назначение смен

### 3.2 Приоритезация

**Приоритеты правил валидации:**
1. **Приоритет 1**: Индивидуальные выходные (employee_day_off)
2. **Приоритет 2+**: Общие правила валидации

**Приоритеты сотрудников для генерации:**
- Выше приоритет у сотрудников с меньшим количеством рабочих дней подряд
- Учитывается общее количество смен в месяце
- Сотрудники, достигшие лимита рабочих дней, получают выходной

---

## 4. Текущие ограничения и возможные улучшения

### 4.1 Ограничения

1. **Только выходные**: Система поддерживает только запросы на выходные дни
2. **Жесткие приоритеты**: Правила выходных имеют абсолютный приоритет над остальными
3. **Простая генерация**: Алгоритм не учитывает предпочтения сотрудников по сменам
4. **Отсутствие конфликтов**: Нет проверки пересечения запросов разных сотрудников

### 4.2 Потенциальные улучшения

1. **Типы запросов**: Добавить запросы на конкретные смены
2. **Умная генерация**: Учитывать предпочтения и производительность сотрудников
3. **Уведомления**: Информирование сотрудников об изменениях статуса
4. **История**: Отслеживание изменений графиков и запросов
5. **Балансировка**: Оптимизация распределения нагрузки между сотрудниками

---

## 5. API эндпоинты

### 5.1 Автогенерация графика

- `POST /api/auto-schedule` - генерация графика за месяц
- `GET /api/validation-rules` - получить правила валидации
- `GET /api/validation-rules/enabled` - получить включенные правила

### 5.2 Управление запросами

- `GET /api/preferences` - получить все запросы
- `POST /api/preferences` - создать запрос
- `PUT /api/preferences/:id` - обновить запрос
- `PATCH /api/preferences/:id/status` - обновить статус
- `DELETE /api/preferences/:id` - удалить запрос

### 5.3 Причины запросов

- `GET /api/preference-reasons` - получить все причины
- `POST /api/preference-reasons` - создать причину
- `PUT /api/preference-reasons/:id` - обновить причину
- `DELETE /api/preference-reasons/:id` - удалить причину
- `POST /api/preference-reasons/reorder` - изменить порядок

---

## 6. База данных

### 6.1 Таблицы

```sql
-- Запросы сотрудников
CREATE TABLE employee_preferences (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR REFERENCES employees(id),
  preference_type VARCHAR NOT NULL, -- 'day_off'
  target_date DATE NOT NULL,
  target_shift_id VARCHAR REFERENCES shifts(id),
  reason_id INTEGER REFERENCES preference_reasons(id),
  priority INTEGER DEFAULT 0,
  status VARCHAR DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Причины запросов
CREATE TABLE preference_reasons (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  priority INTEGER DEFAULT 0,
  color VARCHAR,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Правила валидации (для индивидуальных выходных)
CREATE TABLE validation_rules (
  id SERIAL PRIMARY KEY,
  rule_type VARCHAR NOT NULL, -- 'employee_day_off'
  enabled BOOLEAN DEFAULT true,
  config JSONB NOT NULL,
  applies_to_roles TEXT[],
  applies_to_employees TEXT[],
  priority INTEGER DEFAULT 0,
  description TEXT,
  enforcement_type VARCHAR DEFAULT 'error',
  custom_message TEXT
);
```

---

## 7. Заключение

Текущая реализация предоставляет функциональную систему для управления запросами на выходные и автоматической генерации графиков работы. Система гибко настраивается через правила валидации и учитывает индивидуальные потребности сотрудников.

Основные принципы:
- **Автоматизация** - минимальное ручное вмешательство
- **Приоритезация** - учет важности запросов и правил
- **Гибкость** - настройка под конкретные требования бизнеса
- **Интеграция** - seamless взаимодействие всех компонентов системы