import { Router } from 'express';
import {
  getAllReasons,
  getReasonById,
  createReason,
  updateReason,
  deleteReason,
  reorderReasons,
} from '../controllers/preferenceReasonsController';

const router = Router();

router.post('/reorder', reorderReasons);

router.get('/', getAllReasons);
router.get('/:id', getReasonById);
router.post('/', createReason);
router.put('/:id', updateReason);
router.delete('/:id', deleteReason);

export default router;
