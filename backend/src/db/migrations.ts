import pool from '../config/database';
import fs from 'fs';
import path from 'path';

/**
 * Выполняет миграции базы данных
 */
export const runMigrations = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    console.log('Starting database migrations...');

    // Читаем SQL файл со схемой
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    // Выполняем миграцию
    await client.query(schemaSql);

    console.log('✓ Database migrations completed successfully');
  } catch (error) {
    console.error('✗ Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Очищает все данные из таблиц (для тестирования)
 */
export const resetDatabase = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    console.log('Resetting database...');

    await client.query('TRUNCATE TABLE schedule, employees, shifts RESTART IDENTITY CASCADE');

    console.log('✓ Database reset completed');
  } catch (error) {
    console.error('✗ Reset error:', error);
    throw error;
  } finally {
    client.release();
  }
};
