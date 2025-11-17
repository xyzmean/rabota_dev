-- Скрипт для очистки автоматически созданных данных
-- Выполните этот скрипт, чтобы удалить все правила валидации и причины запросов

-- 1. Удалить все правила валидации
DELETE FROM validation_rules;

-- 2. Удалить все причины запросов
DELETE FROM preference_reasons;

-- 3. Сбросить счетчики ID
ALTER SEQUENCE validation_rules_id_seq RESTART WITH 1;
ALTER SEQUENCE preference_reasons_id_seq RESTART WITH 1;

-- Готово! Теперь вы можете добавлять правила и причины вручную через UI.
