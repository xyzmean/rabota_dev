-- Миграция 004: Добавление правила валидации для проверки одобренных выходных дней
-- Дата: 2025-11-18

-- Добавляем правило валидации для проверки одобренных запросов выходных дней
INSERT INTO validation_rules (
  rule_type,
  enabled,
  config,
  applies_to_roles,
  priority,
  description
) VALUES (
  'approved_day_off_requests',
  true,
  '{"enforcement_type": "error"}'::jsonb,
  NULL, -- Применяется ко всем сотрудникам
  100, -- Высокий приоритет
  'Проверка, что в одобренные выходные дни не назначены рабочие смены'
) ON CONFLICT DO NOTHING;