import { Router } from 'express';
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole
} from '../controllers/roleController';

const router = Router();

// GET /api/roles - Получить все роли
router.get('/', getAllRoles);

// GET /api/roles/:id - Получить роль по ID
router.get('/:id', getRoleById);

// POST /api/roles - Создать новую роль
router.post('/', createRole);

// PUT /api/roles/:id - Обновить роль
router.put('/:id', updateRole);

// DELETE /api/roles/:id - Удалить роль
router.delete('/:id', deleteRole);

export default router;
