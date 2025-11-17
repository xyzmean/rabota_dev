-- Миграция 003: Добавление смены "Выходной" по умолчанию
-- Дата: 2025-11-18

-- Вставляем смену "Выходной" если она еще не существует
INSERT INTO shifts (id, name, abbreviation, color, hours, is_default) VALUES
    ('day-off', 'Выходной', 'В', '#dc2626', 0, true)
ON CONFLICT (id) DO NOTHING;

-- Обновляем существующие записи schedule, где shift_id NULL или не существует, устанавливая выходной
-- Эта операция безопасна и не нарушит существующие данные
DO $$
BEGIN
    -- Проверяем, есть ли записи с NULL shift_id или несуществующими shift_id
    FOR rec IN
        SELECT DISTINCT s.id, s.employee_id, s.day, s.month, s.year
        FROM schedule s
        LEFT JOIN shifts sh ON s.shift_id = sh.id
        WHERE s.shift_id IS NULL OR sh.id IS NULL
    LOOP
        UPDATE schedule
        SET shift_id = 'day-off'
        WHERE id = rec.id;
    END LOOP;
END $$;