import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      select: false,
    },
    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false,
      index: true,
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    image: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'creator', 'admin'],
      default: 'user',
      index: true,
    },
    carbonPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    carbonSaved: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ carbonPoints: -1 });
UserSchema.index({ passwordResetTokenHash: 1, passwordResetExpiresAt: 1 });

export default mongoose.models.User || mongoose.model('User', UserSchema);

