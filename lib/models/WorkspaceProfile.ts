import mongoose from 'mongoose';

const WorkspaceProfileSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
      unique: true,
      index: true,
    },
    avatarInitials: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8,
    },
    presence: {
      type: String,
      enum: ['online', 'away', 'busy', 'offline'],
      default: 'offline',
      index: true,
    },
    carbonSavedKg: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

WorkspaceProfileSchema.index({ name: 'text', title: 'text', email: 'text' });

export default mongoose.models.WorkspaceProfile || mongoose.model('WorkspaceProfile', WorkspaceProfileSchema);
