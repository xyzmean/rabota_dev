import { Router } from 'express';
import {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift
} from '../controllers/shiftController';

const router = Router();

/**
 * @route   GET /api/shifts
 * @desc    Получить все смены
 */
router.get('/', getAllShifts);

/**
 * @route   GET /api/shifts/:id
 * @desc    Получить смену по ID
 */
router.get('/:id', getShiftById);

/**
 * @route   POST /api/shifts
 * @desc    Создать новую смену
 */
router.post('/', createShift);

/**
 * @route   PUT /api/shifts/:id
 * @desc    Обновить смену
 */
router.put('/:id', updateShift);

/**
 * @route   DELETE /api/shifts/:id
 * @desc    Удалить смену
 */
router.delete('/:id', deleteShift);

export default router;
