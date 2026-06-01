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
      trim: true,
      maxlength: 2000,
      default: '',
    },
    attachments: {
      type: [
        new mongoose.Schema(
          {
            id: { type: String, required: true, trim: true, maxlength: 140 },
            name: { type: String, required: true, trim: true, maxlength: 240 },
            type: { type: String, required: true, trim: true, maxlength: 160 },
            size: { type: Number, required: true, min: 0 },
            dataUrl: { type: String, required: true, maxlength: 5_000_000 },
            kind: { type: String, enum: ['file', 'image', 'video'], required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
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
