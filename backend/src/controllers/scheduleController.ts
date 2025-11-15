import { Request, Response } from 'express';
import pool from '../config/database';
import { ScheduleEntry, ScheduleEntryInput } from '../models/types';

/**
 * Получить весь график
 * Опционально с фильтрацией по месяцу и году
 */
export const getAllSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query;

    let query = `
      SELECT
        id, employee_id as "employeeId", day, month, year, shift_id as "shiftId"
      FROM schedule
    `;

    const params: (string | number)[] = [];

    if (month !== undefined && year !== undefined) {
      query += ' WHERE month = $1 AND year = $2';
      params.push(parseInt(month as string), parseInt(year as string));
    }

    query += ' ORDER BY year DESC, month DESC, day ASC';

    const result = await pool.query<ScheduleEntry>(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Получить запись графика по ID
 */
export const getScheduleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query<ScheduleEntry>(
      'SELECT id, employee_id as "employeeId", day, month, year, shift_id as "shiftId" FROM schedule WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Schedule entry not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching schedule entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Создать запись в графике
 */
export const createScheduleEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, day, month, year, shiftId }: ScheduleEntryInput = req.body;

    if (!employeeId || day === undefined || month === undefined || year === undefined || !shiftId) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const result = await pool.query<ScheduleEntry>(
      'INSERT INTO schedule (employee_id, day, month, year, shift_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, employee_id as "employeeId", day, month, year, shift_id as "shiftId"',
      [employeeId, day, month, year, shiftId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    // Обработка ошибки уникальности
    if (error.code === '23505') {
      res.status(409).json({ error: 'Schedule entry already exists for this employee on this date' });
      return;
    }
    // Обработка ошибки внешнего ключа
    if (error.code === '23503') {
      res.status(400).json({ error: 'Invalid employee or shift ID' });
      return;
    }
    console.error('Error creating schedule entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Обновить запись в графике
 */
export const updateScheduleEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { employeeId, day, month, year, shiftId }: ScheduleEntryInput = req.body;

    if (!employeeId || day === undefined || month === undefined || year === undefined || !shiftId) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const result = await pool.query<ScheduleEntry>(
      'UPDATE schedule SET employee_id = $1, day = $2, month = $3, year = $4, shift_id = $5 WHERE id = $6 RETURNING id, employee_id as "employeeId", day, month, year, shift_id as "shiftId"',
      [employeeId, day, month, year, shiftId, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Schedule entry not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Schedule entry already exists for this employee on this date' });
      return;
    }
    if (error.code === '23503') {
      res.status(400).json({ error: 'Invalid employee or shift ID' });
      return;
    }
    console.error('Error updating schedule entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Удалить запись из графика
 */
export const deleteScheduleEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM schedule WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Schedule entry not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting schedule entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Удалить запись по дате и сотруднику (удобно для фронтенда)
 */
export const deleteScheduleByDateAndEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, day, month, year } = req.body;

    if (!employeeId || day === undefined || month === undefined || year === undefined) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const result = await pool.query(
      'DELETE FROM schedule WHERE employee_id = $1 AND day = $2 AND month = $3 AND year = $4 RETURNING id',
      [employeeId, day, month, year]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Schedule entry not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting schedule entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Массовое создание/обновление записей графика
 * Полезно для синхронизации с frontend
 */
export const bulkUpsertSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entries }: { entries: ScheduleEntryInput[] } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'Entries array is required' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results: ScheduleEntry[] = [];

      for (const entry of entries) {
        const { employeeId, day, month, year, shiftId } = entry;

        // Используем INSERT ... ON CONFLICT для upsert
        const result = await client.query<ScheduleEntry>(
          `INSERT INTO schedule (employee_id, day, month, year, shift_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (employee_id, day, month, year)
           DO UPDATE SET shift_id = EXCLUDED.shift_id
           RETURNING id, employee_id as "employeeId", day, month, year, shift_id as "shiftId"`,
          [employeeId, day, month, year, shiftId]
        );

        results.push(result.rows[0]);
      }

      await client.query('COMMIT');
      res.json(results);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error.code === '23503') {
      res.status(400).json({ error: 'Invalid employee or shift ID in entries' });
      return;
    }
    console.error('Error bulk upserting schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
