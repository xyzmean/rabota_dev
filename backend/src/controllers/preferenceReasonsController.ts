import { Request, Response } from 'express';
import pool from '../config/database';
import { PreferenceReason, PreferenceReasonInput } from '../models/types';

// Конвертация из snake_case (БД) в camelCase (API)
const dbToApi = (dbRow: any): PreferenceReason => ({
  id: dbRow.id,
  name: dbRow.name,
  priority: dbRow.priority,
  color: dbRow.color,
  description: dbRow.description,
  created_at: dbRow.created_at,
  updated_at: dbRow.updated_at,
});

/**
 * GET /api/preference-reasons
 * Получить все причины (сортировка по приоритету)
 */
export const getAllReasons = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM preference_reasons ORDER BY priority DESC, id');
    const reasons = result.rows.map(dbToApi);
    res.json(reasons);
  } catch (error) {
    console.error('Error fetching preference reasons:', error);
    res.status(500).json({ error: 'Failed to fetch preference reasons' });
  }
};

/**
 * GET /api/preference-reasons/:id
 * Получить причину по ID
 */
export const getReasonById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM preference_reasons WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Preference reason not found' });
      return;
    }

    res.json(dbToApi(result.rows[0]));
  } catch (error) {
    console.error('Error fetching preference reason:', error);
    res.status(500).json({ error: 'Failed to fetch preference reason' });
  }
};

/**
 * POST /api/preference-reasons
 * Создать новую причину
 */
export const createReason = async (req: Request, res: Response): Promise<void> => {
  const { name, priority = 0, color, description }: PreferenceReasonInput = req.body;

  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  try {
    const result = await pool.query(
      'INSERT INTO preference_reasons (name, priority, color, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, priority, color, description]
    );

    res.status(201).json(dbToApi(result.rows[0]));
  } catch (error) {
    console.error('Error creating preference reason:', error);
    res.status(500).json({ error: 'Failed to create preference reason' });
  }
};

/**
 * PUT /api/preference-reasons/:id
 * Обновить причину
 */
export const updateReason = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, priority, color, description }: Partial<PreferenceReasonInput> = req.body;

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(priority);
    }
    if (color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      values.push(color);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(id);
    const query = `UPDATE preference_reasons SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Preference reason not found' });
      return;
    }

    res.json(dbToApi(result.rows[0]));
  } catch (error) {
    console.error('Error updating preference reason:', error);
    res.status(500).json({ error: 'Failed to update preference reason' });
  }
};

/**
 * DELETE /api/preference-reasons/:id
 * Удалить причину
 */
export const deleteReason = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM preference_reasons WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Preference reason not found' });
      return;
    }

    res.json({ message: 'Preference reason deleted successfully' });
  } catch (error) {
    console.error('Error deleting preference reason:', error);
    res.status(500).json({ error: 'Failed to delete preference reason' });
  }
};

/**
 * POST /api/preference-reasons/reorder
 * Изменить порядок причин (для drag-and-drop)
 */
export const reorderReasons = async (req: Request, res: Response): Promise<void> => {
  const { orderedIds } = req.body as { orderedIds: number[] };

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    res.status(400).json({ error: 'orderedIds array is required' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Обновляем приоритеты в обратном порядке (последний = самый низкий приоритет)
    for (let i = 0; i < orderedIds.length; i++) {
      const priority = (orderedIds.length - i) * 10; // Интервалы по 10 для будущих вставок
      await client.query(
        'UPDATE preference_reasons SET priority = $1 WHERE id = $2',
        [priority, orderedIds[i]]
      );
    }

    await client.query('COMMIT');

    // Возвращаем обновленный список
    const result = await client.query('SELECT * FROM preference_reasons ORDER BY priority DESC, id');
    const reasons = result.rows.map(dbToApi);

    res.json(reasons);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reordering preference reasons:', error);
    res.status(500).json({ error: 'Failed to reorder preference reasons' });
  } finally {
    client.release();
  }
};
