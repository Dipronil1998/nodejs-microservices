import User from '../models/user.js';
import UserRole from '../models/userRole.js';

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("username email isVerified createdAt");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const userRoles = await UserRole.find({ userId: user._id }).populate('roleId');
    const roles = userRoles.map(ur => ur.roleId?.name).filter(Boolean);

    res.status(200).json({
      status: true,
      message: 'User fetched successfully',
      data: {
        ...user.toObject(),
        roles: roles.length > 0 ? roles : ['user'],
        role: roles[0] || 'user'
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("username email _id isVerified createdAt");

    if (users.length === 0) {
      return res.status(404).json({
        message: "User not found",
        user: []
      });
    }

    const userIds = users.map(u => u._id);
    const userRoles = await UserRole.find({ userId: { $in: userIds } }).populate('roleId');

    const roleMap = {};
    userRoles.forEach(ur => {
      const uId = ur.userId.toString();
      if (!roleMap[uId]) roleMap[uId] = [];
      if (ur.roleId?.name) roleMap[uId].push(ur.roleId.name);
    });

    const usersWithRoles = users.map(u => {
      const roles = roleMap[u._id.toString()] || ['user'];
      return {
        ...u.toObject(),
        roles,
        role: roles[0] || 'user'
      };
    });

    res.status(200).json({
      status: true,
      message: 'Users fetch successfully',
      data: usersWithRoles
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message
    });
  }
};
