import express from 'express';
import { createAccessToken } from '../controllers/tokenController.js';

const router = express.Router();

router.post("/generate-access-token", createAccessToken);

export default router;
