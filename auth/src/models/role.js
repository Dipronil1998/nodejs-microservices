import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    enum: ['user', 'admin', 'vendor']
  },
  description: {
    type: String,
    trim: true
  }
}, { timestamps: true });

const Role = mongoose.model('Role', roleSchema);

export default Role;
