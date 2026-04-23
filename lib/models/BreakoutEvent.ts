import mongoose from 'mongoose';

const BreakoutEventSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    meetingId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
    createdBy: { type: String, required: true, trim: true, maxlength: 120 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'breakout_events',
  },
);

BreakoutEventSchema.index({ meetingId: 1, createdAt: -1 });

export default mongoose.models.BreakoutEvent
  || mongoose.model('BreakoutEvent', BreakoutEventSchema);
