import mongoose from 'mongoose';

const MeetingParticipantSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    role: {
      type: String,
      enum: ['host', 'cohost', 'attendee'],
      default: 'attendee',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

const MeetingSchema = new mongoose.Schema(
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
    hostUserId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    roomCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
      maxlength: 40,
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
    status: {
      type: String,
      enum: ['scheduled', 'live', 'ended'],
      default: 'scheduled',
      index: true,
    },
    attendeesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    participants: {
      type: [MeetingParticipantSchema],
      default: [],
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

MeetingSchema.index({ startsAt: 1, status: 1 });
MeetingSchema.index({ hostUserId: 1, startsAt: -1 });

export default mongoose.models.Meeting || mongoose.model('Meeting', MeetingSchema);
