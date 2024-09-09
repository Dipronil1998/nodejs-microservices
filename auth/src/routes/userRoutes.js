import express from 'express';
import { register, login, generateOtp, verifyOtp } from '../controllers/userController.js';  

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/generate-otp', generateOtp);
router.post('/verify-otp', verifyOtp);

export default router;
