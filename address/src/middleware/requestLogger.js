/**
 * Request logger middleware
 * Logs: Service Name, HTTP Method, Endpoint, Status Code, Response Time, Client IP, and Timestamp
 * @param {string} serviceName - Name of the microservice
 */
export const requestLogger = (serviceName = 'Address Service') => {
    return (req, res, next) => {
        const start = process.hrtime.bigint();

        res.on('finish', () => {
            const end = process.hrtime.bigint();
            const responseTimeMs = Number(end - start) / 1_000_000;
            const formattedTime = `${responseTimeMs.toFixed(2)}ms`;

            const clientIp =
                req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                req.headers['x-real-ip'] ||
                req.socket?.remoteAddress ||
                req.ip ||
                'Unknown IP';

            const method = req.method;
            const endpoint = req.originalUrl || req.url;
            const statusCode = res.statusCode;
            const timestamp = new Date().toISOString();

            console.log(
                `[${serviceName}] [${timestamp}] ${method} ${endpoint} - Status: ${statusCode} - Response Time: ${formattedTime} - IP: ${clientIp}`
            );
        });

        next();
    };
};

export default requestLogger;
