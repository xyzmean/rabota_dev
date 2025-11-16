import { Request, Response } from 'express';
import pool from '../config/database';
import { Employee, EmployeeInput } from '../models/types';

/**
 * Получить всех сотрудников
 */
export const getAllEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT
        e.id,
        e.name,
        e.exclude_from_hours as "excludeFromHours",
        e.role_id as "roleId",
        r.id as "role.id",
        r.name as "role.name",
        r.permissions as "role.permissions",
        r.color as "role.color",
        r.description as "role.description",
        r.is_system as "role.isSystem"
      FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      ORDER BY e.name ASC`
    );

    // Преобразуем плоскую структуру в вложенную
    const employees = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      excludeFromHours: row.excludeFromHours,
      roleId: row.roleId,
      role: row['role.id'] ? {
        id: row['role.id'],
        name: row['role.name'],
        permissions: row['role.permissions'],
        color: row['role.color'],
        description: row['role.description'],
        isSystem: row['role.isSystem']
      } : undefined
    }));

    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Получить сотрудника по ID
 */
export const getEmployeeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT
        e.id,
        e.name,
        e.exclude_from_hours as "excludeFromHours",
        e.role_id as "roleId",
        r.id as "role.id",
        r.name as "role.name",
        r.permissions as "role.permissions",
        r.color as "role.color",
        r.description as "role.description",
        r.is_system as "role.isSystem"
      FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const row = result.rows[0];
    const employee = {
      id: row.id,
      name: row.name,
      excludeFromHours: row.excludeFromHours,
      roleId: row.roleId,
      role: row['role.id'] ? {
        id: row['role.id'],
        name: row['role.name'],
        permissions: row['role.permissions'],
        color: row['role.color'],
        description: row['role.description'],
        isSystem: row['role.isSystem']
      } : undefined
    };

    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Создать нового сотрудника
 */
export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, name, excludeFromHours, roleId }: EmployeeInput = req.body;

    if (!id || !name) {
      res.status(400).json({ error: 'ID and name are required' });
      return;
    }

    // Если указан roleId, проверяем что роль существует
    if (roleId !== undefined && roleId !== null) {
      const roleCheck = await pool.query('SELECT id FROM roles WHERE id = $1', [roleId]);
      if (roleCheck.rows.length === 0) {
        res.status(400).json({ error: 'Invalid role ID' });
        return;
      }
    }

    const result = await pool.query(
      `INSERT INTO employees (id, name, exclude_from_hours, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, exclude_from_hours as "excludeFromHours", role_id as "roleId"`,
      [id, name, excludeFromHours || false, roleId || null]
    );

    // Если есть роль, получаем её данные
    if (result.rows[0].roleId) {
      const employeeWithRole = await pool.query(
        `SELECT
          e.id,
          e.name,
          e.exclude_from_hours as "excludeFromHours",
          e.role_id as "roleId",
          r.id as "role.id",
          r.name as "role.name",
          r.permissions as "role.permissions",
          r.color as "role.color",
          r.description as "role.description",
          r.is_system as "role.isSystem"
        FROM employees e
        LEFT JOIN roles r ON e.role_id = r.id
        WHERE e.id = $1`,
        [id]
      );

      const row = employeeWithRole.rows[0];
      res.status(201).json({
        id: row.id,
        name: row.name,
        excludeFromHours: row.excludeFromHours,
        roleId: row.roleId,
        role: row['role.id'] ? {
          id: row['role.id'],
          name: row['role.name'],
          permissions: row['role.permissions'],
          color: row['role.color'],
          description: row['role.description'],
          isSystem: row['role.isSystem']
        } : undefined
      });
    } else {
      res.status(201).json(result.rows[0]);
    }
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Employee with this ID already exists' });
      return;
    }
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Обновить сотрудника
 */
export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, excludeFromHours, roleId }: Partial<EmployeeInput> = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    // Если указан roleId, проверяем что роль существует
    if (roleId !== undefined && roleId !== null) {
      const roleCheck = await pool.query('SELECT id FROM roles WHERE id = $1', [roleId]);
      if (roleCheck.rows.length === 0) {
        res.status(400).json({ error: 'Invalid role ID' });
        return;
      }
    }

    const result = await pool.query(
      `UPDATE employees
       SET name = $1, exclude_from_hours = $2, role_id = $3
       WHERE id = $4
       RETURNING id, name, exclude_from_hours as "excludeFromHours", role_id as "roleId"`,
      [name, excludeFromHours || false, roleId !== undefined ? roleId : null, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    // Получаем полные данные с ролью
    const employeeWithRole = await pool.query(
      `SELECT
        e.id,
        e.name,
        e.exclude_from_hours as "excludeFromHours",
        e.role_id as "roleId",
        r.id as "role.id",
        r.name as "role.name",
        r.permissions as "role.permissions",
        r.color as "role.color",
        r.description as "role.description",
        r.is_system as "role.isSystem"
      FROM employees e
      LEFT JOIN roles r ON e.role_id = r.id
      WHERE e.id = $1`,
      [id]
    );

    const row = employeeWithRole.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      excludeFromHours: row.excludeFromHours,
      roleId: row.roleId,
      role: row['role.id'] ? {
        id: row['role.id'],
        name: row['role.name'],
        permissions: row['role.permissions'],
        color: row['role.color'],
        description: row['role.description'],
        isSystem: row['role.isSystem']
      } : undefined
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Удалить сотрудника
 */
export const deleteEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM employees WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
