-- Миграция 002: Добавление динамической системы ролей с правами доступа
-- Дата: 2025-11-16

-- 1. Создание таблицы ролей
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL, -- Название роли
    permissions JSONB DEFAULT '{}'::jsonb, -- Права доступа в формате JSON
    color VARCHAR(7) DEFAULT '#6b7280', -- Цвет для UI
    description TEXT, -- Описание роли
    is_system BOOLEAN DEFAULT FALSE, -- Системная роль (нельзя удалить)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Добавление поля role_id в таблицу employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL;

-- 3. Создание индексов
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role_id);

-- 4. Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Вставка дефолтных ролей с правами доступа
INSERT INTO roles (name, permissions, color, description, is_system) VALUES
    ('Управляющий', '{
        "manage_schedule": true,
        "manage_employees": true,
        "manage_shifts": true,
        "manage_settings": true,
        "view_statistics": true,
        "approve_preferences": true,
        "manage_roles": true,
        "manage_validation_rules": true
    }'::jsonb, '#3b82f6', 'Полный доступ ко всем функциям системы', true),

    ('Заместитель управляющего', '{
        "manage_schedule": true,
        "manage_employees": true,
        "manage_shifts": true,
        "manage_settings": false,
        "view_statistics": true,
        "approve_preferences": true,
        "manage_roles": false,
        "manage_validation_rules": false
    }'::jsonb, '#10b981', 'Управление графиком и сотрудниками без доступа к настройкам', true),

    ('Кладовщик', '{
        "manage_schedule": false,
        "manage_employees": false,
        "manage_shifts": false,
        "manage_settings": false,
        "view_statistics": true,
        "approve_preferences": false,
        "manage_roles": false,
        "manage_validation_rules": false
    }'::jsonb, '#f59e0b', 'Доступ только к просмотру графика и статистики', true),

    ('Сотрудник', '{
        "manage_schedule": false,
        "manage_employees": false,
        "manage_shifts": false,
        "manage_settings": false,
        "view_statistics": false,
        "approve_preferences": false,
        "manage_roles": false,
        "manage_validation_rules": false
    }'::jsonb, '#6b7280', 'Базовый доступ - просмотр своего графика', true)
ON CONFLICT (name) DO NOTHING;

-- 6. Миграция данных из старого поля role в role_id
-- Обновляем существующих сотрудников, назначая им соответствующие роли
UPDATE employees
SET role_id = (SELECT id FROM roles WHERE name = 'Управляющий')
WHERE role = 'manager';

UPDATE employees
SET role_id = (SELECT id FROM roles WHERE name = 'Заместитель управляющего')
WHERE role = 'deputy_manager';

UPDATE employees
SET role_id = (SELECT id FROM roles WHERE name = 'Кладовщик')
WHERE role = 'storekeeper';

UPDATE employees
SET role_id = (SELECT id FROM roles WHERE name = 'Сотрудник')
WHERE role = 'employee' OR role IS NULL;

-- 7. Удаление старого поля role (после миграции данных)
ALTER TABLE employees DROP COLUMN IF EXISTS role;
