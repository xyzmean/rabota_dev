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

    // 1. Выполняем базовую схему
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await client.query(schemaSql);
    console.log('✓ Base schema applied');

    // 2. Выполняем все миграции из папки migrations
    const migrationsDir = path.join(__dirname, 'migrations');

    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Сортировка по имени для правильного порядка

      for (const file of migrationFiles) {
        console.log(`Running migration: ${file}`);
        const migrationPath = path.join(migrationsDir, file);
        const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
        await client.query(migrationSql);
        console.log(`✓ Migration ${file} completed`);
      }
    }

    console.log('✓ All database migrations completed successfully');
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

    await client.query('TRUNCATE TABLE employee_preferences, schedule, employees, shifts, validation_rules, app_settings RESTART IDENTITY CASCADE');

    console.log('✓ Database reset completed');
  } catch (error) {
    console.error('✗ Reset error:', error);
    throw error;
  } finally {
    client.release();
  }
};
