import User from '../models/user.js';
import Role from '../models/role.js';
import UserRole from '../models/userRole.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { publishToQueue } from '../config/rabbitmq.js';

import { redisClient } from '../config/redis.js';
import { accessTokenGenerate, refreshTokenGenerate } from '../utils/token.js';

export const register = async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            username,
            email,
            password: hashedPassword
        });
        await user.save();

        const roleName = (role || 'user').toLowerCase().trim();
        let roleDoc = await Role.findOne({ name: roleName });
        if (!roleDoc) {
            roleDoc = await Role.create({ name: roleName });
        }

        await UserRole.create({
            userId: user._id,
            roleId: roleDoc._id
        });

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                isVerified: user.isVerified,
                roles: [roleDoc.name],
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message || error });
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

        const userRoles = await UserRole.find({ userId: user._id }).populate('roleId');
        const roles = userRoles.map(ur => ur.roleId?.name).filter(Boolean);
        if (roles.length === 0) {
            roles.push('user');
        }

        const accesstoken = await accessTokenGenerate(user, roles);
        const refreshToken = await refreshTokenGenerate(user, roles);

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
            EX: 7 * 24 * 60 * 60, // 7 days
        });

        res.status(200).json({
            message: 'Login successful',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                isVerified: user.isVerified,
                roles
            },
            accesstoken,
            refreshToken
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message || error });
    }
};

export const generateOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const otp = crypto.randomInt(100000, 999999).toString();

        await redisClient.set(`otp:${user._id}`, otp, {
            EX: 2 * 60, // 2 minutes
        });

        // Publish message to RabbitMQ email_queue
        try {
            await publishToQueue('email_queue', {
                to: user.email,
                subject: 'Your OTP Verification Code',
                body: `Your OTP is: ${otp}. It is valid for 2 minutes.`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #2d3748; text-align: center;">Account Verification</h2>
                        <p>Hello <strong>${user.username || 'User'}</strong>,</p>
                        <p>Your one-time password (OTP) for verification is:</p>
                        <div style="background-color: #edf2f7; padding: 14px 24px; font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center; border-radius: 6px; color: #2b6cb0; margin: 20px 0;">
                            ${otp}
                        </div>
                        <p style="color: #718096; font-size: 14px;">This OTP is valid for <strong>2 minutes</strong>. Please do not share it with anyone.</p>
                    </div>
                `
            });
        } catch (queueError) {
            console.error('Failed to publish OTP email to RabbitMQ:', queueError.message || queueError);
            return res.status(500).json({
                message: 'Failed to queue OTP email for delivery. Please try again.',
                error: queueError.message || queueError
            });
        }

        res.status(200).json({
            status: true,
            message: 'OTP generated and queued for email delivery',
            otp
        });
    } catch (error) {
        console.error('Error generating OTP:', error);
        res.status(500).json({ message: 'Server error', error: error.message || error });
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
        res.clearCookie('accessToken', {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            path: '/'
        });

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            path: '/'
        });
        return res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Error during logout:', error);
        return res.status(500).json({ message: 'Server error', error });
    }
}
