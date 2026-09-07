import jwt from 'jsonwebtoken';
import { accessTokenGenerate } from '../utils/token.js';
import User from '../models/user.js';
import UserRole from '../models/userRole.js';
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
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }

        const userRoles = await UserRole.find({ userId: user._id }).populate('roleId');
        const roles = userRoles.map(ur => ur.roleId?.name).filter(Boolean);
        if (roles.length === 0) {
            roles.push('user');
        }

        const accessToken = await accessTokenGenerate(user, roles);

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

export const verifyJWT = (req, res) => {
    const token = req.cookies?.accessToken;
    const originalMethod = req.headers['x-original-method'];

    if (!token) {
        // Allow public GET requests without token
        if (originalMethod === 'GET') {
            return res.status(200).json({
                status: true,
                message: 'Public GET access granted'
            });
        }

        return res.status(401).json({
            status: false,
            message: 'No access token provided'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_ACCESS);
        req.user = decoded; // Attach user info to request object

        res.setHeader("X-User-Id", decoded.id);
        if (decoded.email) {
            res.setHeader("X-User-Email", decoded.email);
        }
        if (decoded.role) {
            res.setHeader("X-User-Role", decoded.role);
        }
        console.log("X-User-Id", decoded.id);

        return res.status(200).json({
            status: true,
            message: 'Access token is valid',
            data: decoded
        });
    } catch (error) {
        console.error('Error verifying access token:', error);

        // If GET request but token is expired or invalid, still permit public access without identity headers
        if (originalMethod === 'GET') {
            return res.status(200).json({
                status: true,
                message: 'Public GET access granted (unauthenticated)'
            });
        }

        return res.status(401).json({
            status: false,
            message: 'Invalid or expired access token'
        });
    }
};