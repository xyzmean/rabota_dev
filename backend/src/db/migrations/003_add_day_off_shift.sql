-- Миграция 003: Добавление смены "Выходной" по умолчанию
-- Дата: 2025-11-18

-- Вставляем смену "Выходной" если она еще не существует
INSERT INTO shifts (id, name, abbreviation, color, hours, is_default) VALUES
    ('day-off', 'Выходной', 'В', '#dc2626', 0, true)
ON CONFLICT (id) DO NOTHING;

-- Обновляем существующие записи schedule, где shift_id NULL, устанавливая выходной
UPDATE schedule
SET shift_id = 'day-off'
WHERE shift_id IS NULL;