-- Миграция 003: Enhanced AutoSched Schema
-- Дата: 2025-11-19
-- Цель: Добавление расширенной схемы для системы автогенерации графика AutoSched

-- 1. Улучшение таблицы rules валидации для соответствия AutoSched требованиям
ALTER TABLE validation_rules
ADD COLUMN IF NOT EXISTS enforcement_type VARCHAR(50) DEFAULT 'warning' CHECK (enforcement_type IN ('error', 'warning')),
ADD COLUMN IF NOT applies_to_employees VARCHAR(255)[], -- Массив ID сотрудников для индивидуальных правил
ADD COLUMN IF NOT EXISTS custom_message TEXT; -- Кастомное сообщение об ошибке

-- 2. Улучшение таблицы employee_preferences для лучшей интеграции
ALTER TABLE employee_preferences
ADD COLUMN IF NOT EXISTS preference_date_range DATE RANGE, -- Для периодических запросов
ADD COLUMN IF NOT EXISTS auto_process BOOLEAN DEFAULT false, -- Флаг автоматической обработки
ADD COLUMN IF NOT EXISTS conflict_resolution VARCHAR(50) DEFAULT 'manual'; -- Как разрешать конфликты

-- 3. Новая таблица для хранения результатов автогенерации
CREATE TABLE IF NOT EXISTS schedule_generations (
    id SERIAL PRIMARY KEY,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    algorithm_config JSONB DEFAULT '{}'::jsonb, -- Конфигурация алгоритма генерации
    total_violations INTEGER DEFAULT 0, -- Общее количество нарушений правил
    violation_details JSONB DEFAULT '[]'::jsonb, -- Детали нарушений
    generation_time_ms INTEGER, -- Время генерации в миллисекундах
    generated_by VARCHAR(255) REFERENCES employees(id), -- Кто запустил генерацию
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(month, year) -- Одна генерация на месяц
);

-- 4. Таблица для хранения приоритетов правил (для динамической оптимизации)
CREATE TABLE IF NOT EXISTS rule_priorities (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES validation_rules(id) ON DELETE CASCADE,
    priority_level INTEGER NOT NULL CHECK (priority_level > 0),
    weight_factor DECIMAL(3,2) DEFAULT 1.0 CHECK (weight_factor > 0), -- Весовой коэффициент для оптимизации
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rule_id)
);

-- 5. Таблица для хранения истории оптимизации и балансаировки
CREATE TABLE IF NOT EXISTS schedule_optimizations (
    id SERIAL PRIMARY KEY,
    generation_id INTEGER REFERENCES schedule_generations(id) ON DELETE CASCADE,
    optimization_type VARCHAR(100) NOT NULL, -- Тип оптимизации (balance, preference, coverage)
    before_metrics JSONB NOT NULL, -- Метрики до оптимизации
    after_metrics JSONB NOT NULL, -- Метрики после оптимизации
    improvement_score DECIMAL(5,2), -- Оценка улучшения
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Таблица для хранения шаблонов графиков (weekly patterns)
CREATE TABLE IF NOT EXISTS schedule_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    pattern_data JSONB NOT NULL, -- Данные шаблона в JSON
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(255) REFERENCES employees(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Расширение таблицы shifts для улучшенной поддержки AutoSched
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS min_staff INTEGER DEFAULT 1, -- Минимальное количество сотрудников
ADD COLUMN IF NOT EXISTS max_staff INTEGER DEFAULT 10, -- Максимальное количество сотрудников
ADD COLUMN IF NOT EXISTS required_roles JSONB DEFAULT '[]'::jsonb, -- Обязательные роли для смены
ADD COLUMN IF NOT EXISTS shift_difficulty DECIMAL(3,2) DEFAULT 1.0, -- Сложность смены для балансировки
ADD COLUMN IF NOT EXISTS is_night BOOLEAN DEFAULT false, -- Флаг ночной смены
ADD COLUMN IF NOT EXISTS coverage_priority INTEGER DEFAULT 1; -- Приоритет покрытия смены

-- 8. Таблица для хранения статистики нагрузки сотрудников
CREATE TABLE IF NOT EXISTS employee_workload_stats (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(255) REFERENCES employees(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_shifts INTEGER DEFAULT 0,
    total_hours INTEGER DEFAULT 0,
    consecutive_days_max INTEGER DEFAULT 0,
    night_shifts_count INTEGER DEFAULT 0,
    weekend_shifts_count INTEGER DEFAULT 0,
    preference_satisfaction_rate DECIMAL(5,2) DEFAULT 0.0, -- Процент удовлетворенных предпочтений
    workload_score DECIMAL(5,2) DEFAULT 0.0, -- Оценка нагрузки (0-100)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, month, year)
);

-- 9. Индексы для оптимизации производительности
CREATE INDEX IF NOT EXISTS idx_schedule_generations_date ON schedule_generations(year, month);
CREATE INDEX IF NOT EXISTS idx_schedule_generations_status ON schedule_generations(status);
CREATE INDEX IF NOT EXISTS idx_rule_priorities_level ON rule_priorities(priority_level);
CREATE INDEX IF NOT EXISTS idx_schedule_optimizations_generation ON schedule_optimizations(generation_id);
CREATE INDEX IF NOT EXISTS idx_employee_workload_stats_date ON employee_workload_stats(year, month);
CREATE INDEX IF NOT EXISTS idx_validation_rules_enforcement ON validation_rules(enforcement_type);
CREATE INDEX IF NOT EXISTS idx_employee_preferences_auto_process ON employee_preferences(auto_process);
CREATE INDEX IF NOT EXISTS idx_shifts_coverage_priority ON shifts(coverage_priority);

-- 10. Триггеры для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_schedule_generations_updated_at ON schedule_generations;
CREATE TRIGGER update_schedule_generations_updated_at BEFORE UPDATE ON schedule_generations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_templates_updated_at ON schedule_templates;
CREATE TRIGGER update_schedule_templates_updated_at BEFORE UPDATE ON schedule_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_workload_stats_updated_at ON employee_workload_stats;
CREATE TRIGGER update_employee_workload_stats_updated_at BEFORE UPDATE ON employee_workload_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Вставка базовых шаблонов графиков
INSERT INTO schedule_templates (name, description, pattern_data) VALUES
    ('Стандартный 5/2', 'Стандартный график 5 рабочих дней, 2 выходных', '{
        "monday": ["morning", "evening"],
        "tuesday": ["morning", "evening"],
        "wednesday": ["morning", "evening"],
        "thursday": ["morning", "evening"],
        "friday": ["morning", "evening"],
        "saturday": ["morning"],
        "sunday": []
    }'),
    ('Укороченный', 'Укороченный график с меньшей нагрузкой', '{
        "monday": ["morning"],
        "tuesday": ["morning"],
        "wednesday": ["evening"],
        "thursday": ["morning"],
        "friday": ["evening"],
        "saturday": [],
        "sunday": []
    }'),
    ('Интернет-магазин', 'График для интернет-магазина с круглосуточной поддержкой', '{
        "monday": ["morning", "evening", "night"],
        "tuesday": ["morning", "evening", "night"],
        "wednesday": ["morning", "evening", "night"],
        "thursday": ["morning", "evening", "night"],
        "friday": ["morning", "evening", "night"],
        "saturday": ["morning", "evening"],
        "sunday": ["morning", "evening"]
    }')
ON CONFLICT DO NOTHING;

-- 12. Обновление существующих смен с параметрами по умолчанию
UPDATE shifts SET
    min_staff = CASE
        WHEN name = 'Выходной' THEN 0
        WHEN name ILIKE '%ночь%' OR name ILIKE '%night%' THEN 1
        ELSE 2
    END,
    max_staff = CASE
        WHEN name = 'Выходной' THEN 0
        WHEN name ILIKE '%ночь%' OR name ILIKE '%night%' THEN 2
        ELSE 5
    END,
    is_night = CASE
        WHEN name ILIKE '%ночь%' OR name ILIKE '%night%' THEN true
        ELSE false
    END,
    coverage_priority = CASE
        WHEN name ILIKE '%утро%' OR name ILIKE '%morning%' THEN 3
        WHEN name ILIKE '%день%' OR name ILIKE '%day%' THEN 2
        WHEN name ILIKE '%вечер%' OR name ILIKE '%evening%' THEN 2
        WHEN name ILIKE '%ночь%' OR name ILIKE '%night%' THEN 1
        ELSE 2
    END
WHERE min_staff IS NULL OR max_staff IS NULL;

-- 13. Создание представления для быстрого доступа к статистике валидации
CREATE OR REPLACE VIEW validation_summary AS
SELECT
    vr.id,
    vr.rule_type,
    vr.enabled,
    vr.enforcement_type,
    vr.priority,
    rp.priority_level,
    rp.weight_factor,
    vr.description,
    COUNT(CASE WHEN vr.enabled = true THEN 1 END) as total_enabled,
    COUNT(CASE WHEN vr.enforcement_type = 'error' THEN 1 END) as error_rules,
    COUNT(CASE WHEN vr.enforcement_type = 'warning' THEN 1 END) as warning_rules
FROM validation_rules vr
LEFT JOIN rule_priorities rp ON vr.id = rp.rule_id
GROUP BY vr.id, vr.rule_type, vr.enabled, vr.enforcement_type, vr.priority, rp.priority_level, rp.weight_factor, vr.description
ORDER BY rp.priority_level ASC, vr.priority ASC;

-- 14. Добавление COMMENTS для документации
COMMENT ON TABLE schedule_generations IS 'История автогенераций графиков с метриками и результатами';
COMMENT ON TABLE rule_priorities IS 'Приоритеты правил для динамической оптимизации';
COMMENT ON TABLE schedule_optimizations IS 'История оптимизаций графиков с метриками';
COMMENT ON TABLE schedule_templates IS 'Шаблоны графиков для быстрой генерации';
COMMENT ON TABLE employee_workload_stats IS 'Статистика нагрузки сотрудников для балансировки';

-- Завершение миграции
SELECT 'Migration 003: Enhanced AutoSched Schema completed successfully' as migration_status;