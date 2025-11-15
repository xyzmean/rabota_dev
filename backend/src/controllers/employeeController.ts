import { Request, Response } from 'express';
import pool from '../config/database';
import { Employee, EmployeeInput } from '../models/types';

/**
 * Получить всех сотрудников
 */
export const getAllEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<Employee>(
      'SELECT id, name, exclude_from_hours as "excludeFromHours" FROM employees ORDER BY name ASC'
    );
    res.json(result.rows);
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
    const result = await pool.query<Employee>(
      'SELECT id, name, exclude_from_hours as "excludeFromHours" FROM employees WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    res.json(result.rows[0]);
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
    const { id, name, excludeFromHours }: EmployeeInput = req.body;

    if (!id || !name) {
      res.status(400).json({ error: 'ID and name are required' });
      return;
    }

    const result = await pool.query<Employee>(
      'INSERT INTO employees (id, name, exclude_from_hours) VALUES ($1, $2, $3) RETURNING id, name, exclude_from_hours as "excludeFromHours"',
      [id, name, excludeFromHours || false]
    );

    res.status(201).json(result.rows[0]);
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
    const { name, excludeFromHours }: Partial<EmployeeInput> = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const result = await pool.query<Employee>(
      'UPDATE employees SET name = $1, exclude_from_hours = $2 WHERE id = $3 RETURNING id, name, exclude_from_hours as "excludeFromHours"',
      [name, excludeFromHours || false, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    res.json(result.rows[0]);
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
