import express from 'express';
import { body } from 'express-validator';
import { generateSchedule } from '../controllers/autoScheduleController';

const router = express.Router();

// POST /api/auto-schedule/generate - Генерация графика
router.post('/generate',
  [
    body('month')
      .isInt({ min: 0, max: 11 })
      .withMessage('Месяц должен быть числом от 0 до 11'),
    body('year')
      .isInt({ min: 2020, max: 2030 })
      .withMessage('Год должен быть числом от 2020 до 2030')
  ],
  generateSchedule
);

export default router;