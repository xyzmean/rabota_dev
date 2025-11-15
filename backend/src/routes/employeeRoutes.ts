import { Router } from 'express';
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee
} from '../controllers/employeeController';

const router = Router();

/**
 * @route   GET /api/employees
 * @desc    Получить всех сотрудников
 */
router.get('/', getAllEmployees);

/**
 * @route   GET /api/employees/:id
 * @desc    Получить сотрудника по ID
 */
router.get('/:id', getEmployeeById);

/**
 * @route   POST /api/employees
 * @desc    Создать нового сотрудника
 */
router.post('/', createEmployee);

/**
 * @route   PUT /api/employees/:id
 * @desc    Обновить сотрудника
 */
router.put('/:id', updateEmployee);

/**
 * @route   DELETE /api/employees/:id
 * @desc    Удалить сотрудника
 */
router.delete('/:id', deleteEmployee);

export default router;
