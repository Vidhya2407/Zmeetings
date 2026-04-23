import mongoose from 'mongoose';

const BreakoutAssignmentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, trim: true, maxlength: 200 },
    sessionId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    meetingId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    roomId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    participantId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    participantName: { type: String, required: true, trim: true, maxlength: 160 },
    participantRole: { type: String, required: true, trim: true, maxlength: 80 },
    assignmentMethod: {
      type: String,
      enum: ['auto', 'manual'],
      required: true,
      default: 'manual',
    },
    assignedBy: { type: String, required: true, trim: true, maxlength: 120 },
    assignedAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'breakout_assignments',
  },
);

BreakoutAssignmentSchema.index({ sessionId: 1, participantId: 1 }, { unique: true });

export default mongoose.models.BreakoutAssignment
  || mongoose.model('BreakoutAssignment', BreakoutAssignmentSchema);

