import express from 'express';
import { createAccessToken, verifyJWT } from '../controllers/tokenController.js';

const router = express.Router();

router.post("/verify-token", verifyJWT);
router.post("/generate-access-token", createAccessToken);

export default router;
