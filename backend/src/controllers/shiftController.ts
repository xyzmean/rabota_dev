import { Request, Response } from 'express';
import pool from '../config/database';
import { Shift, ShiftInput } from '../models/types';

/**
 * Получить все смены
 */
export const getAllShifts = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<Shift>(
      'SELECT id, name, abbreviation, color, hours, is_default as "isDefault" FROM shifts ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching shifts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Получить смену по ID
 */
export const getShiftById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query<Shift>(
      'SELECT id, name, abbreviation, color, hours, is_default as "isDefault" FROM shifts WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Shift not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching shift:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Создать новую смену
 */
export const createShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, name, abbreviation, color, hours, isDefault }: ShiftInput = req.body;

    if (!id || !name || !abbreviation || !color || hours === undefined) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const result = await pool.query<Shift>(
      'INSERT INTO shifts (id, name, abbreviation, color, hours, is_default) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, abbreviation, color, hours, is_default as "isDefault"',
      [id, name, abbreviation, color, hours, isDefault || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Shift with this ID already exists' });
      return;
    }
    console.error('Error creating shift:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Обновить смену
 */
export const updateShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, abbreviation, color, hours, isDefault }: Partial<ShiftInput> = req.body;

    if (!name || !abbreviation || !color || hours === undefined) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const result = await pool.query<Shift>(
      'UPDATE shifts SET name = $1, abbreviation = $2, color = $3, hours = $4, is_default = $5 WHERE id = $6 RETURNING id, name, abbreviation, color, hours, is_default as "isDefault"',
      [name, abbreviation, color, hours, isDefault || false, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Shift not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating shift:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Удалить смену
 */
export const deleteShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Проверяем, не является ли смена дефолтной
    const checkResult = await pool.query(
      'SELECT is_default FROM shifts WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Shift not found' });
      return;
    }

    if (checkResult.rows[0].is_default) {
      res.status(403).json({ error: 'Cannot delete default shift' });
      return;
    }

    const result = await pool.query(
      'DELETE FROM shifts WHERE id = $1 RETURNING id',
      [id]
    );

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting shift:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
