import jwt from 'jsonwebtoken';
import { accessTokenGenerate } from '../utils/token.js';
import User from '../models/user.js';
import { redisClient } from '../config/redis.js';

export const createAccessToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                status: false,
                message: 'No refresh token provided'
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_SECRET_REFRESH
        );

        const storedToken = await redisClient.get(`refreshToken:${decoded.id}`);
        

        if (!storedToken || storedToken !== refreshToken) {
            return res.status(401).json({
                status: false,
                message: 'Invalid or expired refresh token'
            });
        }

        // Create new access token

        const user = await User.findById(decoded.id);
        const accessToken = await accessTokenGenerate(user);

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000 // 15 minutes
        });


        return res.status(200).json({
            status: true,
            message: 'Access token created successfully',
            data: {
                accessToken
            }
        });

    } catch (error) {
        console.error('Error creating access token:', error);

        return res.status(401).json({
            status: false,
            message: 'Invalid or expired refresh token'
        });
    }
};