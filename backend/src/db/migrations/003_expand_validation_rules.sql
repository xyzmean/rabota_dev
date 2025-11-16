-- Миграция 003: Расширение системы validation_rules
-- Дата: 2025-11-17
-- Описание: Добавление поддержки привязки правил к конкретным сотрудникам и расширенной конфигурации

-- 1. Добавляем поле для привязки правил к конкретным сотрудникам
ALTER TABLE validation_rules ADD COLUMN IF NOT EXISTS applies_to_employees VARCHAR(255)[];
-- Массив ID сотрудников, к которым применяется правило (null = все)

-- 2. Добавляем поле для типа применения правила
ALTER TABLE validation_rules ADD COLUMN IF NOT EXISTS enforcement_type VARCHAR(50) DEFAULT 'warning';
-- 'warning' - предупреждение (желтая подсветка)
-- 'error' - ошибка (красная подсветка)
-- 'info' - информация (синяя подсветка)

-- 3. Добавляем поле для пользовательского сообщения об ошибке
ALTER TABLE validation_rules ADD COLUMN IF NOT EXISTS custom_message TEXT;
-- Пользовательское сообщение, которое будет показано при нарушении правила

-- 4. Обновляем существующие правила с новыми полями конфигурации

-- Правило: Максимальное количество смен подряд
UPDATE validation_rules
SET config = jsonb_set(
  config::jsonb,
  '{max_days}',
  '6'::jsonb,
  true
)::json,
description = 'Максимальное количество рабочих дней подряд (рекомендуется не более 6)'
WHERE rule_type = 'max_consecutive_shifts' AND NOT config::jsonb ? 'recommended';

-- Правило: Минимальное количество сотрудников в смене
UPDATE validation_rules
SET config = jsonb_set(
  config::jsonb,
  '{min_count}',
  '2'::jsonb,
  true
)::json
WHERE rule_type = 'min_employees_per_shift';

-- Правило: Максимальное количество сотрудников в смене
UPDATE validation_rules
SET config = jsonb_set(
  config::jsonb,
  '{max_count}',
  '5'::jsonb,
  true
)::json
WHERE rule_type = 'max_employees_per_shift';

-- 5. Добавляем новые типы правил валидации

-- Правило: Ограничение по часам для конкретного сотрудника
INSERT INTO validation_rules (rule_type, enabled, config, applies_to_roles, applies_to_employees, priority, description, enforcement_type)
VALUES
  ('employee_hours_limit', false, '{
    "min_hours": 0,
    "max_hours": 176,
    "enforcement": "exact"
  }', NULL, NULL, 10, 'Принудительное ограничение часов для конкретного сотрудника', 'error'),

  ('recommended_work_days', false, '{
    "max_consecutive_days": 6,
    "type": "recommended"
  }', NULL, NULL, 11, 'Рекомендуемое максимальное количество рабочих дней подряд', 'warning'),

  ('required_work_days', false, '{
    "days_of_week": [],
    "applies_to": "role"
  }', NULL, NULL, 12, 'Конкретные рабочие дни недели по должностям или сотрудникам', 'error'),

  ('coverage_by_time', false, '{
    "time_ranges": [],
    "min_employees": 1,
    "applies_to_weekdays": true,
    "applies_to_weekends": false
  }', NULL, NULL, 13, 'Обязательное покрытие конкретных часов определенным количеством сотрудников', 'error'),

  ('coverage_by_day', false, '{
    "specific_days": [],
    "min_employees": 1,
    "day_type": "specific"
  }', NULL, NULL, 14, 'Обязательное покрытие конкретных дней определенным количеством сотрудников', 'error'),

  ('shift_type_limit_per_day', false, '{
    "shift_limits": {}
  }', NULL, NULL, 15, 'Максимальное количество людей в конкретной смене в день', 'warning'),

  ('max_consecutive_work_days', false, '{
    "max_days": 6
  }', NULL, NULL, 16, 'Максимальное количество рабочих дней подряд', 'warning'),

  ('max_consecutive_days_off', false, '{
    "max_days": 3
  }', NULL, NULL, 17, 'Максимальное количество выходных дней подряд', 'warning')
ON CONFLICT DO NOTHING;

-- 6. Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_validation_rules_applies_to_employees ON validation_rules USING GIN(applies_to_employees);
CREATE INDEX IF NOT EXISTS idx_validation_rules_enforcement_type ON validation_rules(enforcement_type);

-- 7. Комментарии к таблице для документации
COMMENT ON COLUMN validation_rules.applies_to_employees IS 'Массив ID сотрудников, к которым применяется правило (null = все сотрудники)';
COMMENT ON COLUMN validation_rules.enforcement_type IS 'Тип применения правила: warning, error, info';
COMMENT ON COLUMN validation_rules.custom_message IS 'Пользовательское сообщение об ошибке при нарушении правила';
