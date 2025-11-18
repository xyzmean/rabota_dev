-- Базовые правила валидации для AutoSched
-- Вставляем базовые правила, чтобы система начала работать

-- 1. Минимум сотрудников на смене (обязательное правило)
INSERT INTO validation_rules (rule_type, enabled, config, enforcement_type, priority, description)
VALUES
(
  'min_employees_per_shift',
  true,
  '{"min": 2}',
  'error',
  1,
  'Минимум 2 сотрудника на смене'
) ON CONFLICT DO NOTHING;

-- 2. Максимум рабочих дней подряд (предупреждение)
INSERT INTO validation_rules (rule_type, enabled, config, enforcement_type, priority, description)
VALUES
(
  'max_consecutive_work_days',
  true,
  '{"max_days": 5}',
  'warning',
  2,
  'Не более 5 рабочих дней подряд'
) ON CONFLICT DO NOTHING;

-- 3. Максимум сотрудников на смене (предупреждение)
INSERT INTO validation_rules (rule_type, enabled, config, enforcement_type, priority, description)
VALUES
(
  'max_employees_per_shift',
  true,
  '{"max": 5}',
  'warning',
  3,
  'Не более 5 сотрудников на смене'
) ON CONFLICT DO NOTHING;

-- 4. Максимум часов в неделю
INSERT INTO validation_rules (rule_type, enabled, config, enforcement_type, priority, description)
VALUES
(
  'max_hours_per_week',
  true,
  '{"max_hours": 40}',
  'warning',
  4,
  'Не более 40 часов в неделю'
) ON CONFLICT DO NOTHING;

-- 5. Утвержденные выходные
INSERT INTO validation_rules (rule_type, enabled, config, enforcement_type, priority, description)
VALUES
(
  'approved_day_off_requests',
  true,
  '{}',
  'error',
  1,
  'Утвержденные запросы на выходные должны быть соблюдены'
) ON CONFLICT DO NOTHING;