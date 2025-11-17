import { Request, Response } from 'express';
import { pool } from '../config/database';

// Полная очистка базы данных (кроме системных данных)
export const clearDatabase = async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Получаем список таблиц для очистки в правильном порядке (учитывая зависимости)
      const tablesToClear = [
        'employee_preferences',      // Зависит от employees, preference_reasons
        'schedule',                  // Зависит от employees, shifts
        'preference_reasons',        // Может использоваться employee_preferences
        'validation_rules',          // Независимая таблица
        'app_settings',              // Независимая таблица
        'employees',                 // Может использоваться другими таблицами
        'shifts'                     // Может использоваться другими таблицами
      ];

      const clearedTables = [];

      for (const table of tablesToClear) {
        try {
          // Проверяем существование таблицы
          const tableExists = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_name = $1
            );
          `, [table]);

          if (tableExists.rows[0].exists) {
            // Очищаем таблицу, но оставляем структуру
            await client.query(`DELETE FROM ${table}`);
            clearedTables.push(table);
            console.log(`Таблица ${table} очищена`);
          }
        } catch (error) {
          console.error(`Ошибка при очистке таблицы ${table}:`, error);
          // Продолжаем очистку других таблиц даже если одна не удалась
        }
      }

      // Сбрасываем счетчики (sequences) для таблиц с SERIAL полями
      const resetSequences = [
        'employee_preferences_id_seq',
        'schedule_id_seq',
        'preference_reasons_id_seq',
        'validation_rules_id_seq',
        'app_settings_id_seq'
      ];

      for (const seq of resetSequences) {
        try {
          await client.query(`ALTER SEQUENCE IF EXISTS ${seq} RESTART WITH 1`);
        } catch (error) {
          // Игнорируем ошибки сброса счетчиков
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'База данных успешно очищена',
        clearedTables,
        note: 'Системные таблицы и структура базы данных сохранены'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Ошибка при очистке базы данных:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера при очистке базы данных'
    });
  }
};

// Очистка только графика (с сохранением сотрудников, смен, настроек и правил)
export const clearSchedule = async (req: Request, res: Response) => {
  try {
    const { month, year } = req.query;

    let query = 'DELETE FROM schedule';
    const params: any[] = [];

    if (month !== undefined && year !== undefined) {
      query += ' WHERE month = $1 AND year = $2';
      params.push(parseInt(month), parseInt(year));
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      message: params.length > 0
        ? `График за ${parseInt(month) + 1}/${year} очищен`
        : 'Весь график очищен',
      deletedRecords: result.rowCount
    });

  } catch (error) {
    console.error('Ошибка при очистке графика:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера при очистке графика'
    });
  }
};

// Получение статистики базы данных
export const getDatabaseStats = async (req: Request, res: Response) => {
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM employees'),
      pool.query('SELECT COUNT(*) as count FROM shifts'),
      pool.query('SELECT COUNT(*) as count FROM schedule'),
      pool.query('SELECT COUNT(*) as count FROM validation_rules'),
      pool.query('SELECT COUNT(*) as count FROM preference_reasons'),
      pool.query('SELECT COUNT(*) as count FROM employee_preferences'),
      pool.query('SELECT COUNT(*) as count FROM app_settings')
    ]);

    const result = {
      employees: parseInt(stats[0].rows[0].count),
      shifts: parseInt(stats[1].rows[0].count),
      schedule: parseInt(stats[2].rows[0].count),
      validationRules: parseInt(stats[3].rows[0].count),
      preferenceReasons: parseInt(stats[4].rows[0].count),
      employeePreferences: parseInt(stats[5].rows[0].count),
      appSettings: parseInt(stats[6].rows[0].count)
    };

    res.json({
      success: true,
      stats: result,
      totalRecords: Object.values(result).reduce((sum, count) => sum + count, 0)
    });

  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера при получении статистики'
    });
  }
};