import express from 'express';
import { getUserRole, getAllRoles } from '../controllers/roleController.js';

const router = express.Router();

router.get('/', getAllRoles);
router.get('/user/:userId', getUserRole);

export default router;
