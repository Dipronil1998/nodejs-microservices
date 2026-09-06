import User from '../models/user.js';

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("username email role");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.status(200).json({status: true, message: 'User fetched successfully', data: user});
  } catch (error) {
    res.status(500).json({
      message: "Server Error"
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const user = await User.find()
      .select("username email _id role isVerified createdAt");

    if (user.length === 0) {
      return res.status(404).json({
        message: "User not found",
        user: []
      });
    }

    res.status(200).json({status: true, message:'Users fetch successfully',data:user});
  } catch (error) {
    res.status(500).json({
      message: "Server Error"
    });
  }
};
