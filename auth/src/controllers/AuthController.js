import User from '../models/user.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

import { redisClient } from '../config/redis.js';
import { accessTokenGenerate, refreshTokenGenerate } from '../utils/token.js';

export const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({ username, email, password: hashedPassword });
        await user.save();

        res.status(201).json({ message: 'User registered successfully', user });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};


export const login = async (req, res) => {
    try {
        const { email, password } = req.body;


        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        if (!user.isVerified) {
            return res.status(400).json({ message: 'User not verified' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const accesstoken = await accessTokenGenerate(user);
        const refreshToken = await refreshTokenGenerate(user);

        res.cookie('accessToken', accesstoken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000, // 15 minutes
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        await redisClient.set(`refreshToken:${user._id}`, refreshToken, {
            EX: 30 * 24 * 60 * 60, // 30 days
        });

        res.status(200).json({ message: 'Login successful', user, accesstoken, refreshToken });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

export const generateOtp = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const otp = crypto.randomInt(100000, 999999).toString();

        await redisClient.set(`otp:${user._id}`, otp, {
            EX: 5 * 60, // 5 minutes
        });

        res.status(200).json({ message: 'OTP generated successfully', otp });
    } catch (error) {
        console.error('Error generating OTP:', error);
        res.status(500).json({ message: 'Server error', error });
    }
};


export const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                message: 'User not found',
            });
        }

        const storedOtp = await redisClient.get(`otp:${user._id}`);;

        // OTP doesn't exist or doesn't match
        if (!storedOtp || storedOtp !== otp) {
            return res.status(400).json({
                message: 'Invalid OTP',
            });
        }

        // Verify user
        user.isVerified = true;
        await user.save();

        // Delete OTP after successful verification
        await redisClient.del(`otp:${user._id}`);

        return res.status(200).json({
            message: 'OTP verified successfully',
            user,
        });

    } catch (error) {
        console.error('Error verifying OTP:', error);

        return res.status(500).json({
            message: 'Server error',
            error: error.message,
        });
    }
};


export const logout = async (req, res) => {
    try {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Error during logout:', error);
        return res.status(500).json({ message: 'Server error', error });
    }
}
