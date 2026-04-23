import mongoose from 'mongoose';

const BreakoutRoomSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, trim: true, maxlength: 120 },
    sessionId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    meetingId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    position: { type: Number, required: true, min: 1, max: 1000 },
    status: {
      type: String,
      enum: ['open', 'closing', 'merged'],
      default: 'open',
      index: true,
    },
    mergeReadyAt: { type: Date, default: null },
    mergedAt: { type: Date, default: null },
    mergeRequestedBy: { type: String, default: null, trim: true, maxlength: 120 },
  },
  {
    timestamps: true,
    collection: 'breakout_rooms',
  },
);

BreakoutRoomSchema.index({ sessionId: 1, position: 1 });

export default mongoose.models.BreakoutRoom
  || mongoose.model('BreakoutRoom', BreakoutRoomSchema);
