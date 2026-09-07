import { redisClient } from '../config/redis.js';

/**
 * Distributed Redis Rate Limiter Middleware
 * Tracks and limits requests per client IP across microservices using shared Redis cache.
 *
 * @param {Object} options
 * @param {number} [options.limit] - Maximum allowed requests within the window (default: 100)
 * @param {number} [options.windowSeconds] - Time window duration in seconds (default: 60)
 * @param {string} [options.keyPrefix] - Redis key prefix for grouping limits (default: 'ratelimit:global')
 * @param {string} [options.message] - Custom message on rate limit exceeded
 */
export const rateLimiter = ({
    limit = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    windowSeconds = parseInt(process.env.RATE_LIMIT_WINDOW_SECS, 10) || 60,
    keyPrefix = 'ratelimit:global',
    message = 'Too many requests from this IP. Please try again later.'
} = {}) => {
    return async (req, res, next) => {
        try {
            // If Redis client is not ready, fail open to avoid downtime
            if (!redisClient.isReady) {
                return next();
            }

            // Extract client IP address
            const clientIp =
                req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                req.headers['x-real-ip'] ||
                req.socket?.remoteAddress ||
                req.ip ||
                '127.0.0.1';

            const redisKey = `${keyPrefix}:${clientIp}`;

            // Increment request count atomically
            const currentRequests = await redisClient.incr(redisKey);

            // Set expiry TTL on the first request in the window
            if (currentRequests === 1) {
                await redisClient.expire(redisKey, windowSeconds);
            }

            // Get remaining TTL for reset header
            let ttl = await redisClient.ttl(redisKey);
            if (ttl < 0) {
                // In case key had no TTL set, ensure it has one
                await redisClient.expire(redisKey, windowSeconds);
                ttl = windowSeconds;
            }

            const remaining = Math.max(0, limit - currentRequests);

            // Set standard rate limit headers
            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', remaining);
            res.setHeader('X-RateLimit-Reset', ttl);

            // If limit exceeded, respond with 429 Too Many Requests
            if (currentRequests > limit) {
                res.setHeader('Retry-After', ttl);
                return res.status(429).json({
                    status: false,
                    message: `${message} (Please retry after ${ttl}s)`,
                    retryAfter: ttl
                });
            }

            next();
        } catch (error) {
            console.error('Error in rateLimiter middleware:', error.message || error);
            // Fail open so service remains available if Redis encounters an issue
            next();
        }
    };
};

export default rateLimiter;
