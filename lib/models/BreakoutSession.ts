import mongoose from 'mongoose';

const BreakoutSessionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, trim: true, maxlength: 120 },
    meetingId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    createdBy: { type: String, required: true, trim: true, maxlength: 120 },
    status: {
      type: String,
      enum: ['draft', 'countdown', 'active', 'ended'],
      default: 'draft',
      index: true,
    },
    assignmentMode: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'manual',
    },
    roomCount: { type: Number, required: true, min: 1, max: 50 },
    countdownSeconds: { type: Number, default: 0, min: 0, max: 3600 },
    startsAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'breakout_sessions',
  },
);

BreakoutSessionSchema.index({ meetingId: 1, createdAt: -1 });

export default mongoose.models.BreakoutSession
  || mongoose.model('BreakoutSession', BreakoutSessionSchema);

