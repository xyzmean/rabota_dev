import { Request, Response } from 'express';
import pool from '../config/database';
import { ValidationRule, ValidationRuleInput } from '../models/types';

// Конвертация из snake_case (БД) в camelCase (API)
const dbToApi = (dbRow: any): ValidationRule => ({
  id: dbRow.id,
  ruleType: dbRow.rule_type,
  enabled: dbRow.enabled,
  config: dbRow.config,
  appliesToRoles: dbRow.applies_to_roles,
  appliesToEmployees: dbRow.applies_to_employees,
  enforcementType: dbRow.enforcement_type,
  customMessage: dbRow.custom_message,
  priority: dbRow.priority,
  description: dbRow.description,
  created_at: dbRow.created_at,
  updated_at: dbRow.updated_at,
});

/**
 * GET /api/validation-rules
 * Получить все правила валидации
 */
export const getAllRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM validation_rules ORDER BY priority, id');
    const rules = result.rows.map(dbToApi);
    res.json(rules);
  } catch (error) {
    console.error('Error fetching validation rules:', error);
    res.status(500).json({ error: 'Failed to fetch validation rules' });
  }
};

/**
 * GET /api/validation-rules/enabled
 * Получить только включенные правила
 */
export const getEnabledRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT * FROM validation_rules WHERE enabled = true ORDER BY priority, id'
    );
    const rules = result.rows.map(dbToApi);
    res.json(rules);
  } catch (error) {
    console.error('Error fetching enabled rules:', error);
    res.status(500).json({ error: 'Failed to fetch enabled rules' });
  }
};

/**
 * GET /api/validation-rules/:id
 * Получить правило по ID
 */
export const getRuleById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM validation_rules WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Validation rule not found' });
      return;
    }

    res.json(dbToApi(result.rows[0]));
  } catch (error) {
    console.error('Error fetching validation rule:', error);
    res.status(500).json({ error: 'Failed to fetch validation rule' });
  }
};

/**
 * POST /api/validation-rules
 * Создать новое правило
 */
export const createRule = async (req: Request, res: Response): Promise<void> => {
  const {
    ruleType,
    enabled = true,
    config,
    appliesToRoles,
    appliesToEmployees,
    enforcementType = 'warning',
    customMessage,
    priority = 0,
    description,
  }: ValidationRuleInput = req.body;

  if (!ruleType || !config) {
    res.status(400).json({ error: 'ruleType and config are required' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO validation_rules (rule_type, enabled, config, applies_to_roles, applies_to_employees, enforcement_type, custom_message, priority, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [ruleType, enabled, JSON.stringify(config), appliesToRoles, appliesToEmployees, enforcementType, customMessage, priority, description]
    );

    res.status(201).json(dbToApi(result.rows[0]));
  } catch (error) {
    console.error('Error creating validation rule:', error);
    res.status(500).json({ error: 'Failed to create validation rule' });
  }
};

/**
 * PUT /api/validation-rules/:id
 * Обновить правило
 */
export const updateRule = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const {
    ruleType,
    enabled,
    config,
    appliesToRoles,
    appliesToEmployees,
    enforcementType,
    customMessage,
    priority,
    description,
  }: Partial<ValidationRuleInput> = req.body;

  try {
    // Строим динамический запрос только для переданных полей
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (ruleType !== undefined) {
      updates.push(`rule_type = $${paramIndex++}`);
      values.push(ruleType);
    }
    if (enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(enabled);
    }
    if (config !== undefined) {
      updates.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(config));
    }
    if (appliesToRoles !== undefined) {
      updates.push(`applies_to_roles = $${paramIndex++}`);
      values.push(appliesToRoles);
    }
    if (appliesToEmployees !== undefined) {
      updates.push(`applies_to_employees = $${paramIndex++}`);
      values.push(appliesToEmployees);
    }
    if (enforcementType !== undefined) {
      updates.push(`enforcement_type = $${paramIndex++}`);
      values.push(enforcementType);
    }
    if (customMessage !== undefined) {
      updates.push(`custom_message = $${paramIndex++}`);
      values.push(customMessage);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(priority);
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
    const query = `UPDATE validation_rules SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Validation rule not found' });
      return;
    }

    res.json(dbToApi(result.rows[0]));
  } catch (error) {
    console.error('Error updating validation rule:', error);
    res.status(500).json({ error: 'Failed to update validation rule' });
  }
};

/**
 * DELETE /api/validation-rules/:id
 * Удалить правило
 */
export const deleteRule = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM validation_rules WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Validation rule not found' });
      return;
    }

    res.json({ message: 'Validation rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting validation rule:', error);
    res.status(500).json({ error: 'Failed to delete validation rule' });
  }
};

/**
 * PATCH /api/validation-rules/:id/toggle
 * Быстро включить/выключить правило
 */
export const toggleRule = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'UPDATE validation_rules SET enabled = NOT enabled WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Validation rule not found' });
      return;
    }

    res.json(dbToApi(result.rows[0]));
  } catch (error) {
    console.error('Error toggling validation rule:', error);
    res.status(500).json({ error: 'Failed to toggle validation rule' });
  }
};

/**
 * POST /api/validation-rules/reorder
 * Изменить порядок правил (для drag-and-drop)
 */
export const reorderRules = async (req: Request, res: Response): Promise<void> => {
  const { orderedIds } = req.body as { orderedIds: number[] };

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    res.status(400).json({ error: 'orderedIds array is required' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Обновляем приоритеты (первый элемент = самый высокий приоритет)
    for (let i = 0; i < orderedIds.length; i++) {
      const priority = i + 1;
      await client.query(
        'UPDATE validation_rules SET priority = $1 WHERE id = $2',
        [priority, orderedIds[i]]
      );
    }

    await client.query('COMMIT');

    // Возвращаем обновленный список
    const result = await client.query('SELECT * FROM validation_rules ORDER BY priority, id');
    const rules = result.rows.map(dbToApi);

    res.json(rules);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reordering validation rules:', error);
    res.status(500).json({ error: 'Failed to reorder validation rules' });
  } finally {
    client.release();
  }
};
