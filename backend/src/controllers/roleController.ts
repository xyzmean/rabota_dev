import { Request, Response } from 'express';
import pool from '../config/database';
import { Role, RoleInput } from '../models/types';

/**
 * Получить все роли
 */
export const getAllRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT id, name, permissions, color, description, is_system as "isSystem", created_at, updated_at FROM roles ORDER BY is_system DESC, name ASC'
    );

    // Возвращаем роли с правильными именами полей
    const roles = result.rows;

    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

/**
 * Получить роль по ID
 */
export const getRoleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id, name, permissions, color, description, is_system as "isSystem", created_at, updated_at FROM roles WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
};

/**
 * Создать новую роль
 */
export const createRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, permissions = {}, color = '#6b7280', description }: RoleInput = req.body;

    if (!name) {
      res.status(400).json({ error: 'Role name is required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO roles (name, permissions, color, description, is_system)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, name, permissions, color, description, is_system as "isSystem", created_at, updated_at`,
      [name, JSON.stringify(permissions), color, description]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating role:', error);

    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'Role with this name already exists' });
      return;
    }

    res.status(500).json({ error: 'Failed to create role' });
  }
};

/**
 * Обновить роль
 */
export const updateRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, permissions, color, description }: Partial<RoleInput> = req.body;

    // Проверяем, не является ли роль системной
    const checkResult = await pool.query(
      'SELECT is_system as "isSystem" FROM roles WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    // Для системных ролей разрешаем обновлять только permissions и description
    const isSystem = checkResult.rows[0].isSystem;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined && !isSystem) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (permissions !== undefined) {
      updates.push(`permissions = $${paramIndex++}`);
      values.push(JSON.stringify(permissions));
    }

    if (color !== undefined && !isSystem) {
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

    const result = await pool.query(
      `UPDATE roles
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, permissions, color, description, is_system as "isSystem", created_at, updated_at`,
      values
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating role:', error);

    if (error.code === '23505') {
      res.status(409).json({ error: 'Role with this name already exists' });
      return;
    }

    res.status(500).json({ error: 'Failed to update role' });
  }
};

/**
 * Удалить роль
 */
export const deleteRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Проверяем, не является ли роль системной
    const checkResult = await pool.query(
      'SELECT is_system as "isSystem" FROM roles WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    if (checkResult.rows[0].isSystem) {
      res.status(403).json({ error: 'Cannot delete system role' });
      return;
    }

    // Проверяем, не используется ли роль сотрудниками
    const usageCheck = await pool.query(
      'SELECT COUNT(*) as count FROM employees WHERE role_id = $1',
      [id]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      res.status(409).json({
        error: 'Cannot delete role that is assigned to employees',
        employeeCount: parseInt(usageCheck.rows[0].count)
      });
      return;
    }

    await pool.query('DELETE FROM roles WHERE id = $1', [id]);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
};
