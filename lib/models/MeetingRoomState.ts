import mongoose from 'mongoose';

const MediaSchema = new mongoose.Schema(
  {
    camera: { type: Boolean, default: false },
    microphone: { type: Boolean, default: false },
    screenShare: { type: Boolean, default: false },
  },
  { _id: false },
);

const NetworkDetailsSchema = new mongoose.Schema(
  {
    downlinkMbps: { type: Number, default: null, min: 0 },
    effectiveType: { type: String, trim: true, maxlength: 24, default: null },
    isOnline: { type: Boolean, default: true },
    level: { type: String, enum: ['excellent', 'good', 'fair', 'poor', 'offline'], default: 'good' },
    locale: { type: String, trim: true, maxlength: 40, default: null },
    locationLabel: { type: String, trim: true, maxlength: 160, default: null },
    rttMs: { type: Number, default: null, min: 0 },
    timezone: { type: String, trim: true, maxlength: 80, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const WaitingParticipantSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 120 },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, required: true, trim: true, maxlength: 80 },
    media: { type: MediaSchema, required: true },
    network: { type: NetworkDetailsSchema, default: null },
  },
  { _id: false },
);

const RoomParticipantSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 120 },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, required: true, trim: true, maxlength: 80 },
    media: { type: MediaSchema, required: true },
    cumulativeG: { type: Number, default: 0, min: 0 },
    rateGPerMin: { type: Number, default: 0, min: 0 },
    joinedAt: { type: Date, default: Date.now },
    lastStateChange: { type: Date, default: Date.now },
    network: { type: NetworkDetailsSchema, default: null },
  },
  { _id: false },
);

const MeetingRoomStateSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, trim: true, maxlength: 120 },
    meetingId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    roomType: { type: String, enum: ['main', 'breakout'], default: 'main', index: true },
    roomLabel: { type: String, trim: true, maxlength: 160, default: 'Main Room' },
    breakoutSessionId: { type: String, trim: true, maxlength: 120, default: null },
    breakoutRoomId: { type: String, trim: true, maxlength: 120, default: null },
    startedAt: { type: Date, required: true, default: Date.now },
    lastAccumulatedAt: { type: Date, required: true, default: Date.now },
    roomLocked: { type: Boolean, default: false },
    recordingEnabled: { type: Boolean, default: false },
    transcriptEnabled: { type: Boolean, default: false },
    participants: { type: [RoomParticipantSchema], default: [] },
    waitingParticipants: { type: [WaitingParticipantSchema], default: [] },
    participantOwners: { type: Map, of: String, default: {} },
  },
  {
    timestamps: true,
  },
);

MeetingRoomStateSchema.index({ updatedAt: -1 });
MeetingRoomStateSchema.index({ meetingId: 1, roomType: 1, updatedAt: -1 });

export default mongoose.models.MeetingRoomState || mongoose.model('MeetingRoomState', MeetingRoomStateSchema);
