# Contributing to RaboTA

Добро пожаловать в проект RaboTA! Этот документ поможет вам начать работу над проектом и следовать нашим стандартам разработки.

## Getting Started

### Требования

- Node.js 20.x или выше
- Docker и Docker Compose (для разработки)
- PostgreSQL 15+ (если разрабатываете без Docker)

### Установка и запуск

1. Клонируйте репозиторий:
   ```bash
   git clone git@github.com:xyzmean/rabota_dev.git
   cd rabota_dev
   ```

2. Запустите через Docker Compose (рекомендуется):
   ```bash
   docker compose up -d
   ```

3. Или запустите вручную:
   ```bash
   # Backend
   cd backend
   npm install
   npm run dev

   # Frontend (в новом терминале)
   cd work-schedule-app
   npm install
   npm run dev
   ```

4. Откройте http://localhost:5173 в браузере

## Структура проекта

```
RaboTA/
├── backend/                    # Backend API сервер
├── work-schedule-app/        # Frontend приложение
├── docker-compose.yml        # Docker конфигурация
├── CLAUDE.md                 # Гайд для Claude Code
└── CONTRIBUTING.md           # Этот файл
```

## Стандарты разработки

### Код стиль

#### Frontend (React + TypeScript)

- Используйте TypeScript со строгой типизацией
- Избегайте типа `any` - всегда указывайте конкретные типы
- Следуйте PascalCase для компонентов и camelCase для переменных/функций
- Используйте функциональные компоненты с хуками

```tsx
// ✅ Хорошо
interface EmployeeProps {
  employee: Employee;
  onUpdate: (id: string) => void;
}

export default function EmployeeCard({ employee, onUpdate }: EmployeeProps) {
  return <div>{employee.name}</div>;
}

// ❌ Плохо
export default function EmployeeCard(props: any) {
  return <div>{props.employee.name}</div>;
}
```

#### Backend (Node.js + TypeScript)

- Используйте async/await вместо Promise.then().catch()
- Всегда обрабатывайте ошибки в API endpoints
- Используйте типизированные Request/Response объекты

```typescript
// ✅ Хорошо
export const getEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const employee = await employeeService.getById(id);
    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

### CSS и стилизация

- Используйте Tailwind CSS классы и кастомные компоненты из `index.css`
- **Темная тема обязательна** для всех новых компонентов
- Используйте готовые CSS классы: `.card`, `.btn`, `.btn-primary`, `.input`
- Применяйте `primary-600/700` для брендовых цветов

```tsx
// ✅ Хорошо
<div className="card p-4">
  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
    Заголовок
  </h2>
  <button className="btn-primary mt-4">
    Действие
  </button>
</div>

// ❌ Плохо (без темной темы)
<div className="bg-white p-4">
  <h2 className="text-xl font-semibold text-gray-900">
    Заголовок
  </h2>
</div>
```

### Компоненты React

#### Правила именования

- Компоненты: PascalCase (`EmployeeManager.tsx`)
- Файлы: kebab-case для утилит, PascalCase для компонентов
- Переменные и функции: camelCase

#### Структура компонента

```tsx
// 1. Импорты (внешние → внутренние)
import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { Employee } from '../types';
import { employeeApi } from '../services/api';

// 2. Интерфейсы (если есть)
interface EmployeeListProps {
  onSelect?: (employee: Employee) => void;
}

// 3. Компонент
export default function EmployeeList({ onSelect }: EmployeeListProps) {
  // 4. Хуки (useState → useEffect → другие)
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployees();
  }, []);

  // 5. Функции-обработчики
  const loadEmployees = async () => {
    try {
      const data = await employeeApi.getAll();
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  // 6. Рендер
  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="space-y-2">
      {employees.map(employee => (
        <div key={employee.id} className="p-2 border rounded">
          {employee.name}
        </div>
      ))}
    </div>
  );
}
```

### API endpoints

#### Структура роутов

```typescript
// routes/employeeRoutes.ts
import express from 'express';
import { getAllEmployees, createEmployee } from '../controllers/employeeController';

const router = express.Router();

// GET /api/employees
router.get('/', getAllEmployees);

// POST /api/employees
router.post('/', createEmployee);

export default router;
```

#### Структура контроллеров

```typescript
// controllers/employeeController.ts
import { Request, Response } from 'express';
import { Employee, EmployeeInput } from '../models/types';
import pool from '../config/database';

export const getAllEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM employees ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

### База данных

- Используйте миграции для изменений схемы
- Следуйте соглашениям об именовании: `snake_case` для таблиц и полей
- Добавляйте индексы для часто используемых полей

```sql
-- 003_add_employee_indexes.sql
CREATE INDEX idx_employees_name ON employees(name);
CREATE INDEX idx_schedule_date ON schedule(month, year);
```

## Процесс разработки

### Ветки

- `master` - основная ветка для production
- `feature/название-фичи` - для новых функций
- `bugfix/описание-бага` - для исправлений

### Коммиты

Используйте осмысленные сообщения коммитов:

```
feat: добавить систему AutoSched для автогенерации графиков
fix: исправить отображение темной темы в настройках
refactor: оптимизировать API endpoints для сотрудников
docs: обновить документацию по развертыванию
```

### Pull Requests

1. Создайте PR из ветки в `master`
2. Добавьте описание изменений
3. Убедитесь, что все тесты проходят
4. Запросите ревью у члена команды

### Тестирование

- Проверьте работу в светлой и темной теме
- Протестируйте адаптивность на мобильных устройствах
- Убедитесь, что Docker контейнеры собираются:
  ```bash
  docker compose build
  ```

## Рекомендации

### Производительность

- Используйте `React.memo()` для компонентов, которые часто перерисовываются
- Применяйте `useCallback()` и `useMemo()` для дорогих вычислений
- Оптимизируйте SQL запросы с индексами

### Безопасность

- Никогда не передавайте чувствительные данные в client-side код
- Используйте параметризованные запросы к БД
- Валидируйте входные данные на бэкенде

### Доступность

- Используйте семантические HTML теги
- Добавляйте `aria-label` для иконок
- Обеспечьте навигацию с клавиатуры

## Полезные команды

```bash
# Frontend
npm run dev          # Запуск dev сервера
npm run build        # Сборка для production
npm run lint         # Проверка линтером

# Backend
npm run dev          # Запуск с hot reload
npm run build        # Сборка TypeScript
npm run migrate      # Запуск миграций БД

# Docker
docker compose up -d            # Запуск всех сервисов
docker compose logs -f           # Просмотр логов
docker compose down              # Остановка сервисов
docker compose up --build -d     # Пересборка и запуск
```

## Вопросы и поддержка

Если у вас возникли вопросы:

1. Проверьте [CLAUDE.md](./CLAUDE.md) для общей информации о проекте
2. Посмотрите существующие Issues в GitHub
3. Создайте новый Issue с описанием проблемы

Спасибо за вклад в развитие RaboTA! 🚀