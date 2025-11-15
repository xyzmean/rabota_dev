import { Request, Response } from 'express';
import pool from '../config/database';
import { EmployeePreference, EmployeePreferenceInput } from '../models/types';

// Конвертация из snake_case (БД) в camelCase (API)
const dbToApi = (dbRow: any): EmployeePreference => ({
  id: dbRow.id,
  employeeId: dbRow.employee_id,
  preferenceType: dbRow.preference_type,
  targetDate: dbRow.target_date,
  targetShiftId: dbRow.target_shift_id,
  reasonId: dbRow.reason_id,
  priority: dbRow.priority,
  status: dbRow.status,
  notes: dbRow.notes,
  created_at: dbRow.created_at,
  updated_at: dbRow.updated_at,
});

/**
 * GET /api/preferences
 * Получить все пожелания (с опциональными фильтрами)
 * Query params: employeeId, status, startDate, endDate
 */
export const getAllPreferences = async (req: Request, res: Response): Promise<void> => {
  const { employeeId, status, startDate, endDate } = req.query;

  try {
    let query = 'SELECT * FROM employee_preferences WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (employeeId) {
      query += ` AND employee_id = $${paramIndex++}`;
      params.push(employeeId);
    }

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (startDate) {
      query += ` AND target_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND target_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += ' ORDER BY target_date DESC, created_at DESC';

    const result = await pool.query(query, params);
    const preferences = result.rows.map(dbToApi);
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
};

/**
 * GET /api/preferences/:id
 * Получить пожелание по ID
 */
export const getPreferenceById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM employee_preferences WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Preference not found' });
      return;
    }

    res.json(dbToApi(result.rows[0]));
  } catch (error) {
    console.error('Error fetching preference:', error);
    res.status(500).json({ error: 'Failed to fetch preference' });
  }
};

/**
 * GET /api/preferences/employee/:employeeId
 * Получить все пожелания конкретного сотрудника
 */
export const getPreferencesByEmployee = async (req: Request, res: Response): Promise<void> => {
  const { employeeId } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM employee_preferences WHERE employee_id = $1 ORDER BY target_date DESC, created_at DESC',
      [employeeId]
    );

    const preferences = result.rows.map(dbToApi);
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching employee preferences:', error);
    res.status(500).json({ error: 'Failed to fetch employee preferences' });
  }
};

/**
 * POST /api/preferences
 * Создать новое пожелание
 */
export const createPreference = async (req: Request, res: Response): Promise<void> => {
  const {
    employeeId,
    preferenceType,
    targetDate,
    targetShiftId,
    reasonId,
    priority = 0,
    status = 'pending',
    notes,
  }: EmployeePreferenceInput = req.body;

  if (!employeeId || !preferenceType) {
    res.status(400).json({ error: 'employeeId and preferenceType are required' });
    return;
  }

  try {
    // Если указана причина, но не указан приоритет, берем приоритет из reason
    let finalPriority = priority;
    if (reasonId && priority === 0) {
      const reasonResult = await pool.query('SELECT priority FROM preference_reasons WHERE id = $1', [reasonId]);
      if (reasonResult.rows.length > 0) {
        finalPriority = reasonResult.rows[0].priority;
      }
    }

    const result = await pool.query(
      `INSERT INTO employee_preferences (employee_id, preference_type, target_date, target_shift_id, reason_id, priority, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [employeeId, preferenceType, targetDate, targetShiftId, reasonId, finalPriority, status, notes]
    );

    res.status(201).json(dbToApi(result.rows[0]));
  } catch (error: any) {
    if (error.code === '23503') { // Foreign key violation
      res.status(400).json({ error: 'Invalid employeeId, targetShiftId, or reasonId' });
      return;
    }
    console.error('Error creating preference:', error);
    res.status(500).json({ error: 'Failed to create preference' });
  }
};

/**
 * PUT /api/preferences/:id
 * Обновить пожелание
 */
export const updatePreference = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const {
    preferenceType,
    targetDate,
    targetShiftId,
    reasonId,
    priority,
    status,
    notes,
  }: Partial<EmployeePreferenceInput> = req.body;

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (preferenceType !== undefined) {
      updates.push(`preference_type = $${paramIndex++}`);
      values.push(preferenceType);
    }
    if (targetDate !== undefined) {
      updates.push(`target_date = $${paramIndex++}`);
      values.push(targetDate);
    }
    if (targetShiftId !== undefined) {
      updates.push(`target_shift_id = $${paramIndex++}`);
      values.push(targetShiftId);
    }
    if (reasonId !== undefined) {
      updates.push(`reason_id = $${paramIndex++}`);
      values.push(reasonId);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(priority);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(id);
    const query = `UPDATE employee_preferences SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Preference not found' });
      return;
    }

    res.json(dbToApi(result.rows[0]));
  } catch (error) {
    console.error('Error updating preference:', error);
    res.status(500).json({ error: 'Failed to update preference' });
  }
};

/**
 * PATCH /api/preferences/:id/status
 * Обновить только статус пожелания (быстрое одобрение/отклонение)
 */
export const updatePreferenceStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Valid status is required (pending, approved, rejected)' });
    return;
  }

  try {
    const result = await pool.query(
      'UPDATE employee_preferences SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Preference not found' });
      return;
    }

    res.json(dbToApi(result.rows[0]));
  } catch (error) {
    console.error('Error updating preference status:', error);
    res.status(500).json({ error: 'Failed to update preference status' });
  }
};

/**
 * DELETE /api/preferences/:id
 * Удалить пожелание
 */
export const deletePreference = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM employee_preferences WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Preference not found' });
      return;
    }

    res.json({ message: 'Preference deleted successfully' });
  } catch (error) {
    console.error('Error deleting preference:', error);
    res.status(500).json({ error: 'Failed to delete preference' });
  }
};
