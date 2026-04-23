import mongoose from 'mongoose';

const ActivityItemSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    kind: {
      type: String,
      enum: ['meeting_invite', 'meeting_update', 'meeting_recording_ready', 'mention', 'chat_message', 'system'],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    createdAt: {
      type: Date,
      required: true,
      index: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    priority: {
      type: String,
      enum: ['meeting_now', 'mention', 'direct', 'general'],
      required: true,
      index: true,
    },
    relatedMeetingId: {
      type: String,
      default: null,
      index: true,
    },
    relatedThreadId: {
      type: String,
      default: null,
      index: true,
    },
    targetUserIds: {
      type: [String],
      default: [],
      index: true,
    },
  },
  {
    timestamps: false,
  },
);

ActivityItemSchema.index({ priority: 1, createdAt: -1 });

export default mongoose.models.ActivityItem || mongoose.model('ActivityItem', ActivityItemSchema);
