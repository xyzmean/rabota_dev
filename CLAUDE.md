# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RaboTA** - Внутренний сайт для управления рабочими процессами и инструментов для личной продуктивности.

Проект представляет собой модульное веб-приложение с различными функциональными блоками. Каждый модуль доступен через главную страницу и работает как отдельное приложение внутри единой экосистемы.

### Текущие модули

- **График работы** (`/schedule`) - Система управления рабочими сменами и сотрудниками
  - Управление сотрудниками
  - Создание и редактирование смен
  - Визуальный календарь с назначением смен
  - Автоматическое сохранение данных в Local Storage

## Technology Stack

### Frontend
- **React 19.2.0** - UI библиотека
- **TypeScript 5.9.3** - Типизация
- **Vite 7.2.2** - Сборщик и dev сервер
- **React Router 7.9.6** - Маршрутизация

### Styling
- **Tailwind CSS 3.4.18** - Utility-first CSS фреймворк
- **PostCSS 8.5.6** - Обработка CSS
- **Autoprefixer 10.4.22** - Автоматические вендорные префиксы

### UI Components
- **lucide-react 0.553.0** - Иконки
- **react-colorful 5.6.1** - Выбор цвета

### Development Tools
- **ESLint 9.39.1** - Линтер
- **TypeScript ESLint 8.46.3** - TypeScript правила для ESLint

## Project Structure

```
RaboTA/
├── work-schedule-app/          # Основное приложение
│   ├── src/
│   │   ├── components/         # Переиспользуемые компоненты
│   │   │   ├── EmployeeManager.tsx
│   │   │   ├── ScheduleCalendar.tsx
│   │   │   └── ShiftManager.tsx
│   │   ├── pages/              # Страницы приложения
│   │   │   ├── Home.tsx        # Главная страница (/)
│   │   │   └── Schedule.tsx    # График работы (/schedule)
│   │   ├── hooks/              # Custom React hooks
│   │   │   └── useLocalStorage.ts
│   │   ├── types.ts            # TypeScript типы
│   │   ├── App.tsx             # Главный компонент с роутингом
│   │   ├── main.tsx            # Точка входа
│   │   ├── index.css           # Глобальные стили
│   │   └── App.css             # Стили компонента App
│   ├── public/                 # Статические файлы
│   ├── index.html              # HTML шаблон
│   ├── package.json            # Зависимости проекта
│   ├── tsconfig.json           # TypeScript конфигурация
│   ├── vite.config.ts          # Vite конфигурация
│   ├── tailwind.config.js      # Tailwind конфигурация
│   ├── postcss.config.js       # PostCSS конфигурация
│   └── eslint.config.js        # ESLint конфигурация
├── CLAUDE.md                   # Этот файл
└── .gitignore                  # Git ignore правила
```

## Architecture

### Routing
Приложение использует React Router для навигации:
- `/` - Главная страница с карточками модулей
- `/schedule` - Модуль управления графиком работы

### Data Management
- **Local Storage** - Все данные хранятся в браузере через custom hook `useLocalStorage`
- **State Management** - Используется встроенный React state (useState)
- Ключи в Local Storage:
  - `workSchedule_shifts` - Смены
  - `workSchedule_employees` - Сотрудники
  - `workSchedule_schedule` - График

### Component Structure
- **Pages** - Страницы верхнего уровня с роутингом
- **Components** - Переиспользуемые компоненты для конкретных функций
- **Hooks** - Custom React hooks для общей логики

## Development Commands

Все команды выполняются из директории `work-schedule-app/`:

```bash
# Установка зависимостей
npm install

# Запуск dev сервера (http://localhost:5173)
npm run dev

# Сборка для production
npm run build

# Предварительный просмотр production сборки
npm run preview

# Запуск линтера
npm run lint
```

## Git Workflow

Проект использует Git для контроля версий:
- **Repository**: git@github.com:xyzmean/rabota_dev.git
- **Branch**: master

### Commit Guidelines
- Используйте осмысленные сообщения коммитов
- Коммиты создаются через Claude Code с автоматическим footer

## Development Guidelines

### Adding New Modules
1. Создайте новую страницу в `src/pages/`
2. Добавьте маршрут в `src/App.tsx`
3. Добавьте карточку модуля на главной странице `src/pages/Home.tsx`
4. Создайте необходимые компоненты в `src/components/`

### Styling
- Используйте Tailwind CSS классы для стилизации
- Следуйте существующей цветовой схеме (синий градиент для header)
- Адаптивный дизайн через Tailwind responsive breakpoints

### TypeScript
- Все типы должны быть определены в `src/types.ts` или локально в компонентах
- Избегайте использования `any`
- Используйте строгую типизацию

## Future Development

Планируемые модули (заглушки на главной странице):
- Дополнительные инструменты для управления задачами
- Другие утилиты для повышения продуктивности

## Notes

- Проект ориентирован на личное использование
- Данные хранятся локально в браузере
- Нет бэкенда или авторизации
- Фокус на простоте и удобстве использования
