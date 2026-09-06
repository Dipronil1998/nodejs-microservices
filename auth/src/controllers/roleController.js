import mongoose from 'mongoose';
import User from '../models/user.js';
import UserRole from '../models/userRole.js';
import Role from '../models/role.js';

export const getUserRole = async (req, res) => {
  try {
    const userId = req.params.userId || req.params.id || req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        status: false,
        message: 'userId is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: false,
        message: 'Invalid userId format'
      });
    }

    const user = await User.findById(userId).select('username email isVerified');
    if (!user) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    const userRoles = await UserRole.find({ userId }).populate('roleId');
    const roles = userRoles.map(ur => ur.roleId?.name).filter(Boolean);

    return res.status(200).json({
      status: true,
      message: 'User role fetched successfully',
      data: {
        userId: user._id,
        username: user.username,
        email: user.email,
        roles: roles.length > 0 ? roles : ['user'],
        role: roles[0] || 'user'
      }
    });
  } catch (error) {
    console.error('Error fetching user role:', error);
    return res.status(500).json({
      status: false,
      message: 'Server error',
      error: error.message
    });
  }
};

export const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find();
    return res.status(200).json({
      status: true,
      message: 'Roles fetched successfully',
      data: roles
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return res.status(500).json({
      status: false,
      message: 'Server error',
      error: error.message
    });
  }
};
