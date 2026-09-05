import express from 'express';
import { register, login, generateOtp, verifyOtp, logout } from '../controllers/AuthController.js';  

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/generate-otp', generateOtp);
router.post('/verify-otp', verifyOtp);
router.post('/logout', logout);

export default router;
