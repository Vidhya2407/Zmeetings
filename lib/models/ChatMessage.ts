import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    threadId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    senderUserId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  },
);

ChatMessageSchema.index({ threadId: 1, createdAt: 1 });

export default mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageSchema);
