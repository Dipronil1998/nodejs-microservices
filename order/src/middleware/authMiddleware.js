import axios from 'axios';

/**
 * Authentication Middleware for Order Service (Cookie-based)
 * Extracts the accessToken from cookies, verifies it via Auth Service API (/verify-token),
 * and attaches the decoded user payload to req.user before passing to next middleware/handler.
 */
export const authMiddleware = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;
    console.log('TOKEN FROM COOKIE:', req.cookies);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No accessToken cookie provided'
      });
    }

    // Call Auth Service API with cookie
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth:3001';
    const response = await axios.get(`${authServiceUrl}/api/v1/token/verify-token`, {
      timeout: 5000
    });

    const decoded = response.data?.data || response.data?.user || response.data;

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Failed to retrieve user details from token'
      });
    }

    // Attach decoded token data to request object
    req.user = decoded;
    req.userId = decoded.id || decoded._id || decoded.userId;

    if (decoded.role) {
      req.userRole = decoded.role;
    }

    if (decoded.roles) {
      req.userRoles = Array.isArray(decoded.roles)
        ? decoded.roles
        : [decoded.roles];
    } else if (decoded.role) {
      req.userRoles = [decoded.role];
    }

    // Set x-user-id header for downstream compatibility
    if (req.userId && !req.headers['x-user-id']) {
      req.headers['x-user-id'] = req.userId.toString();
    }

    // Proceed to next middleware
    next();
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status || 401).json({
        success: false,
        message: error.response.data?.message || 'Unauthorized: Invalid or expired access token'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error during token verification',
      error: error.message
    });
  }
};

export const verifyToken = authMiddleware;
export default authMiddleware;
