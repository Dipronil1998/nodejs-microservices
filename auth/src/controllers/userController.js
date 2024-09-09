import User from '../models/user.js';  
import OTP from '../models/otp.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};


export const login = async (req, res) => {
  try {
    const { email, password } = req.body;


    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    res.status(200).json({ message: 'Login successful', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const generateOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); 

    const newOtp = new OTP({ userId: user._id, otp, expiresAt });
    await newOtp.save();

    res.status(200).json({ message: 'OTP generated successfully', otp });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};


export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otpRecord = await OTP.findOne({ userId: user._id, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (otpRecord.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    user.isVerified = true;
    await user.save();

    await OTP.deleteOne({ _id: otpRecord._id });

    res.status(200).json({ message: 'OTP verified successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
