-- Миграция 001: Добавление системы настроек, валидации и пожеланий сотрудников
-- Дата: 2025-11-15

-- 1. Добавление роли сотрудника
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'employee';
-- Возможные роли: 'manager', 'deputy_manager', 'storekeeper', 'employee'

-- 2. Добавление времени работы в смены
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS end_time TIME;

-- 3. Таблица глобальных настроек приложения
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL, -- Ключ настройки (например: 'theme', 'work_hours_start')
    value TEXT NOT NULL, -- Значение в JSON формате
    description TEXT, -- Описание настройки
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Таблица правил валидации графика
CREATE TABLE IF NOT EXISTS validation_rules (
    id SERIAL PRIMARY KEY,
    rule_type VARCHAR(100) NOT NULL, -- Тип правила (max_consecutive_shifts, min_employees_per_shift, etc.)
    enabled BOOLEAN DEFAULT TRUE, -- Включено ли правило
    config JSONB NOT NULL, -- Конфигурация правила в JSON
    applies_to_roles VARCHAR(255)[], -- Массив ролей, к которым применяется правило (null = все)
    priority INTEGER DEFAULT 0, -- Приоритет правила (для сортировки)
    description TEXT, -- Описание правила
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Таблица причин для запросов сотрудников
CREATE TABLE IF NOT EXISTS preference_reasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL, -- Название причины (например: "Семейные обстоятельства", "Учеба")
    priority INTEGER DEFAULT 0, -- Приоритет причины (выше = важнее)
    color VARCHAR(7), -- Цвет для визуального отображения
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Таблица пожеланий/запросов сотрудников
CREATE TABLE IF NOT EXISTS employee_preferences (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(255) REFERENCES employees(id) ON DELETE CASCADE,
    preference_type VARCHAR(50) NOT NULL, -- 'day_off', 'preferred_shift', 'avoid_shift'
    target_date DATE, -- Конкретная дата (для разовых запросов)
    target_shift_id VARCHAR(255) REFERENCES shifts(id) ON DELETE SET NULL, -- ID желаемой/нежелательной смены
    reason_id INTEGER REFERENCES preference_reasons(id) ON DELETE SET NULL, -- Причина запроса
    priority INTEGER DEFAULT 0, -- Приоритет запроса (автоматически наследуется от reason_id или задается вручную)
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    notes TEXT, -- Примечание от сотрудника
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
CREATE INDEX IF NOT EXISTS idx_validation_rules_type ON validation_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_validation_rules_enabled ON validation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_validation_rules_priority ON validation_rules(priority);
CREATE INDEX IF NOT EXISTS idx_preference_reasons_priority ON preference_reasons(priority);
CREATE INDEX IF NOT EXISTS idx_employee_preferences_employee ON employee_preferences(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_preferences_date ON employee_preferences(target_date);
CREATE INDEX IF NOT EXISTS idx_employee_preferences_status ON employee_preferences(status);
CREATE INDEX IF NOT EXISTS idx_employee_preferences_priority ON employee_preferences(priority);

-- Триггеры для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_validation_rules_updated_at ON validation_rules;
CREATE TRIGGER update_validation_rules_updated_at BEFORE UPDATE ON validation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_preference_reasons_updated_at ON preference_reasons;
CREATE TRIGGER update_preference_reasons_updated_at BEFORE UPDATE ON preference_reasons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_preferences_updated_at ON employee_preferences;
CREATE TRIGGER update_employee_preferences_updated_at BEFORE UPDATE ON employee_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Вставка дефолтных настроек
INSERT INTO app_settings (key, value, description) VALUES
    ('theme', '"light"', 'Тема приложения (light/dark)'),
    ('work_hours_start', '"09:00"', 'Начало рабочего дня предприятия'),
    ('work_hours_end', '"22:00"', 'Конец рабочего дня предприятия'),
    ('business_hours_start', '"08:00"', 'Время начала работы предприятия'),
    ('business_hours_end', '"22:00"', 'Время окончания работы предприятия'),
    ('default_validation_enabled', 'true', 'Включена ли валидация графика по умолчанию')
ON CONFLICT (key) DO NOTHING;

-- Правила валидации и причины запросов теперь создаются вручную через UI
-- (удалены автоматические INSERT'ы)
