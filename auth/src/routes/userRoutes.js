import express from 'express';
import { getUserById, getUsers } from '../controllers/userController.js';  
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.get("/", authMiddleware, getUsers);
router.get("/:id", getUserById);

export default router;
