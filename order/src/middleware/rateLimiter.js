import { redisClient } from '../config/redis.js';

/**
 * Distributed Redis Rate Limiter Middleware
 * Tracks and limits requests per client IP across microservices using shared Redis cache.
 *
 * @param {Object} options
 * @param {number} [options.limit] - Maximum allowed requests within the window (default: 100)
 * @param {number} [options.windowSeconds] - Time window duration in seconds (default: 60)
 * @param {string} [options.keyPrefix] - Redis key prefix for grouping limits (default: 'ratelimit:order')
 * @param {string} [options.message] - Custom message on rate limit exceeded
 */
export const rateLimiter = ({
    limit = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    windowSeconds = parseInt(process.env.RATE_LIMIT_WINDOW_SECS, 10) || 60,
    keyPrefix = 'ratelimit:order',
    message = 'Too many requests. Please try again later.'
} = {}) => {
    return async (req, res, next) => {
        try {
            if (!redisClient.isReady) {
                return next();
            }

            const clientIp =
                req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                req.headers['x-real-ip'] ||
                req.socket?.remoteAddress ||
                req.ip ||
                '127.0.0.1';

            const redisKey = `${keyPrefix}:${clientIp}`;

            const currentRequests = await redisClient.incr(redisKey);

            if (currentRequests === 1) {
                await redisClient.expire(redisKey, windowSeconds);
            }

            let ttl = await redisClient.ttl(redisKey);
            if (ttl < 0) {
                await redisClient.expire(redisKey, windowSeconds);
                ttl = windowSeconds;
            }

            const remaining = Math.max(0, limit - currentRequests);

            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', remaining);
            res.setHeader('X-RateLimit-Reset', ttl);

            if (currentRequests > limit) {
                res.setHeader('Retry-After', ttl);
                return res.status(429).json({
                    success: false,
                    message: `${message} (Please retry after ${ttl}s)`,
                    retryAfter: ttl
                });
            }

            next();
        } catch (error) {
            console.error('Error in rateLimiter middleware:', error.message || error);
            next();
        }
    };
};

export default rateLimiter;
