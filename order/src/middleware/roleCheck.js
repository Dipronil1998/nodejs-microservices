import axios from 'axios';

const checkUserRole = async (req, res, next, allowedRoles = ['admin']) => {
  try {
    const userId =
      req.headers['x-user-id'] ||
      req.user?.id ||
      req.body?.userId ||
      req.query?.userId ||
      req.params?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User ID not found in headers'
      });
    }

    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth:3001';
    const response = await axios.get(`${authServiceUrl}/api/v1/role/user/${userId}`, {
      timeout: 3000
    });

    const data = response.data?.data;
    const userRoles = Array.isArray(data?.roles)
      ? data.roles.map((r) => r.toLowerCase())
      : (data?.role ? [data.role.toLowerCase()] : []);

    const isAuthorized = userRoles.some((role) =>
      allowedRoles.map((r) => r.toLowerCase()).includes(role)
    );

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${allowedRoles.join(', ')}] roles`
      });
    }

    req.userRole = data?.role;
    req.userRoles = userRoles;
    next();
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: error.response.data?.message || 'Failed to verify user role'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error during role verification',
      error: error.message
    });
  }
};

const roleCheck = (reqOrRoles, res, next) => {
  if (
    reqOrRoles &&
    reqOrRoles.headers &&
    typeof res?.status === 'function' &&
    typeof next === 'function'
  ) {
    return checkUserRole(reqOrRoles, res, next, ['admin']);
  }

  const allowedRoles = Array.isArray(reqOrRoles)
    ? reqOrRoles
    : (typeof reqOrRoles === 'string' ? [reqOrRoles] : ['admin']);

  return (req, res, next) => checkUserRole(req, res, next, allowedRoles);
};

export default roleCheck;
