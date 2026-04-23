import mongoose from 'mongoose';

const WorkspaceEventSchema = new mongoose.Schema(
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
      maxlength: 180,
    },
    startsAt: {
      type: Date,
      required: true,
      index: true,
    },
    endsAt: {
      type: Date,
      required: true,
    },
    ownerUserId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    attendeeUserIds: {
      type: [String],
      default: [],
      index: true,
    },
    meetingId: {
      type: String,
      default: null,
      maxlength: 120,
      index: true,
    },
    color: {
      type: String,
      enum: ['blue', 'green', 'amber', 'purple'],
      default: 'blue',
    },
  },
  {
    timestamps: true,
  },
);

WorkspaceEventSchema.index({ startsAt: 1, ownerUserId: 1 });
WorkspaceEventSchema.index({ startsAt: 1, attendeeUserIds: 1 });

export default mongoose.models.WorkspaceEvent || mongoose.model('WorkspaceEvent', WorkspaceEventSchema);
