import { Request, Response } from 'express';
import pool from '../config/database';
import { AppSetting, AppSettingInput } from '../models/types';

// Конвертация из snake_case (БД) в camelCase (API)
const dbToApi = (dbRow: any): AppSetting => ({
  id: dbRow.id,
  key: dbRow.key,
  value: dbRow.value,
  description: dbRow.description,
  created_at: dbRow.created_at,
  updated_at: dbRow.updated_at,
});

/**
 * GET /api/settings
 * Получить все настройки
 */
export const getAllSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM app_settings ORDER BY key');
    const settings = result.rows.map(dbToApi);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

/**
 * GET /api/settings/:key
 * Получить настройку по ключу
 */
export const getSettingByKey = async (req: Request, res: Response): Promise<void> => {
  const { key } = req.params;

  try {
    const result = await pool.query('SELECT * FROM app_settings WHERE key = $1', [key]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Setting not found' });
      return;
    }

    res.json(dbToApi(result.rows[0]));
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
};

/**
 * POST /api/settings
 * Создать новую настройку
 */
export const createSetting = async (req: Request, res: Response): Promise<void> => {
  const { key, value, description }: AppSettingInput = req.body;

  if (!key || !value) {
    res.status(400).json({ error: 'Key and value are required' });
    return;
  }

  try {
    const result = await pool.query(
      'INSERT INTO app_settings (key, value, description) VALUES ($1, $2, $3) RETURNING *',
      [key, value, description]
    );

    res.status(201).json(dbToApi(result.rows[0]));
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'Setting with this key already exists' });
      return;
    }
    console.error('Error creating setting:', error);
    res.status(500).json({ error: 'Failed to create setting' });
  }
};

/**
 * PUT /api/settings/:key
 * Обновить настройку
 */
export const updateSetting = async (req: Request, res: Response): Promise<void> => {
  const { key } = req.params;
  const { value, description }: Partial<AppSettingInput> = req.body;

  if (!value) {
    res.status(400).json({ error: 'Value is required' });
    return;
  }

  try {
    const result = await pool.query(
      'UPDATE app_settings SET value = $1, description = COALESCE($2, description) WHERE key = $3 RETURNING *',
      [value, description, key]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Setting not found' });
      return;
    }

    res.json(dbToApi(result.rows[0]));
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
};

/**
 * DELETE /api/settings/:key
 * Удалить настройку
 */
export const deleteSetting = async (req: Request, res: Response): Promise<void> => {
  const { key } = req.params;

  try {
    const result = await pool.query('DELETE FROM app_settings WHERE key = $1 RETURNING *', [key]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Setting not found' });
      return;
    }

    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
};

/**
 * GET /api/settings/bulk
 * Получить несколько настроек по ключам (через query параметры)
 * Пример: /api/settings/bulk?keys=theme,work_hours_start,work_hours_end
 */
export const getBulkSettings = async (req: Request, res: Response): Promise<void> => {
  const { keys } = req.query;

  if (!keys || typeof keys !== 'string') {
    res.status(400).json({ error: 'Keys parameter is required' });
    return;
  }

  const keyArray = keys.split(',').map(k => k.trim());

  try {
    const result = await pool.query(
      'SELECT * FROM app_settings WHERE key = ANY($1)',
      [keyArray]
    );

    const settings = result.rows.map(dbToApi);

    // Возвращаем в виде объекта { key: value } для удобства
    const settingsObj = settings.reduce((acc, setting) => {
      try {
        acc[setting.key] = JSON.parse(setting.value);
      } catch {
        acc[setting.key] = setting.value;
      }
      return acc;
    }, {} as Record<string, any>);

    res.json(settingsObj);
  } catch (error) {
    console.error('Error fetching bulk settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};
