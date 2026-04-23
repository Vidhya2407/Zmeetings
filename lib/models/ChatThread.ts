import mongoose from 'mongoose';

const ChatThreadSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    participantUserIds: {
      type: [String],
      default: [],
      index: true,
    },
    lastMessagePreview: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

ChatThreadSchema.index({ updatedAt: -1 });

export default mongoose.models.ChatThread || mongoose.model('ChatThread', ChatThreadSchema);
