-- Создание базы данных RaboTA
-- Схема оптимизирована для быстрой работы с небольшим количеством пользователей

-- Таблица сотрудников
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(255) PRIMARY KEY, -- Используем строковый ID как во frontend
    name VARCHAR(255) NOT NULL,
    exclude_from_hours BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица смен
CREATE TABLE IF NOT EXISTS shifts (
    id VARCHAR(255) PRIMARY KEY, -- Используем строковый ID как во frontend
    name VARCHAR(255) NOT NULL,
    abbreviation VARCHAR(10) NOT NULL, -- 2-буквенное сокращение
    color VARCHAR(7) NOT NULL, -- HEX цвет (#RRGGBB)
    hours INTEGER NOT NULL DEFAULT 0, -- Часы за смену
    is_default BOOLEAN DEFAULT FALSE, -- Флаг неизменяемой смены
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица расписания
CREATE TABLE IF NOT EXISTS schedule (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(255) REFERENCES employees(id) ON DELETE CASCADE,
    day INTEGER NOT NULL, -- День месяца (1-31)
    month INTEGER NOT NULL, -- Месяц (0-11, JavaScript формат)
    year INTEGER NOT NULL, -- Год
    shift_id VARCHAR(255) REFERENCES shifts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Уникальность: один сотрудник - одна смена в день
    UNIQUE(employee_id, day, month, year)
);

-- Индексы для ускорения запросов
CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule(year, month, day);
CREATE INDEX IF NOT EXISTS idx_schedule_employee ON schedule(employee_id);
CREATE INDEX IF NOT EXISTS idx_schedule_shift ON schedule(shift_id);
CREATE INDEX IF NOT EXISTS idx_schedule_date_range ON schedule(year, month, employee_id);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_updated_at BEFORE UPDATE ON schedule
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
