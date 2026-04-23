export const MEETING_EMISSION_CONSTANTS = {
  VIDEO_G_PER_MIN: 0.068,
  AUDIO_G_PER_MIN: 0.012,
  SCREEN_G_PER_MIN: 0.022,
  SERVER_G_PER_MIN: 0.008,
  NETWORK_G_PER_MIN: 0.003,
} as const;

export type MeetingUsageProfile = {
  cameraOnRatio: number;
  microphoneOnRatio: number;
  screenShareRatio: number;
};

export const DEFAULT_MEETING_USAGE_PROFILE = {
  cameraOnRatio: 0.72,
  microphoneOnRatio: 0.9,
  screenShareRatio: 0.28,
} as const satisfies MeetingUsageProfile;

export type MeetingMediaState = {
  camera: boolean;
  microphone: boolean;
  screenShare: boolean;
};

export type MeetingNetworkQualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

export type MeetingParticipantNetworkDetails = {
  downlinkMbps: number | null;
  effectiveType: string | null;
  isOnline: boolean;
  level: MeetingNetworkQualityLevel;
  locale: string | null;
  locationLabel: string | null;
  rttMs: number | null;
  timezone: string | null;
  updatedAt: Date;
};

export type MeetingParticipantSeed = {
  id: string;
  displayName: string;
  role: string;
  media: MeetingMediaState;
  network?: Partial<MeetingParticipantNetworkDetails> | null;
};

export type MeetingParticipantState = Omit<MeetingParticipantSeed, 'network'> & {
  cumulativeG: number;
  joinedAt: Date;
  lastStateChange: Date;
  network?: MeetingParticipantNetworkDetails | null;
  rateGPerMin: number;
};

export type MeetingCarbonBreakdown = {
  videoContribG: number;
  audioContribG: number;
  screenContribG: number;
  serverContribG: number;
  networkContribG: number;
};

export type MeetingCarbonSnapshot = {
  durationSeconds: number;
  totalCumulativeG: number;
  totalRateGPerMin: number;
  participantCount: number;
  breakdown: MeetingCarbonBreakdown;
  comparisonFlightKg: number;
  savingFactor: number;
};

export function calcParticipantRate(media: MeetingMediaState): number {
  const E = MEETING_EMISSION_CONSTANTS;
  return (
    (media.camera ? E.VIDEO_G_PER_MIN : 0) +
    (media.microphone ? E.AUDIO_G_PER_MIN : 0) +
    (media.screenShare ? E.SCREEN_G_PER_MIN : 0) +
    E.SERVER_G_PER_MIN +
    E.NETWORK_G_PER_MIN
  );
}

export function calcEstimatedParticipantRate(profile: MeetingUsageProfile = DEFAULT_MEETING_USAGE_PROFILE): number {
  const E = MEETING_EMISSION_CONSTANTS;
  return (
    (E.VIDEO_G_PER_MIN * profile.cameraOnRatio) +
    (E.AUDIO_G_PER_MIN * profile.microphoneOnRatio) +
    (E.SCREEN_G_PER_MIN * profile.screenShareRatio) +
    E.SERVER_G_PER_MIN +
    E.NETWORK_G_PER_MIN
  );
}

export function estimateMeetingEmissionKgFromParticipantMinutes(
  participantMinutes: number,
  profile: MeetingUsageProfile = DEFAULT_MEETING_USAGE_PROFILE,
): number {
  return (Math.max(0, participantMinutes) * calcEstimatedParticipantRate(profile)) / 1000;
}

export function createParticipantState(seed: MeetingParticipantSeed): MeetingParticipantState {
  const now = new Date();
  return {
    ...seed,
    media: { ...seed.media },
    network: seed.network
      ? {
          downlinkMbps: typeof seed.network.downlinkMbps === 'number' ? seed.network.downlinkMbps : null,
          effectiveType: seed.network.effectiveType ?? null,
          isOnline: seed.network.isOnline !== false,
          level: seed.network.level ?? 'good',
          locale: seed.network.locale ?? null,
          locationLabel: seed.network.locationLabel ?? null,
          rttMs: typeof seed.network.rttMs === 'number' ? seed.network.rttMs : null,
          timezone: seed.network.timezone ?? null,
          updatedAt: seed.network.updatedAt ? new Date(seed.network.updatedAt) : now,
        }
      : null,
    cumulativeG: 0,
    joinedAt: now,
    lastStateChange: now,
    rateGPerMin: calcParticipantRate(seed.media),
  };
}

export function calcRoomBreakdown(participants: MeetingParticipantState[]): MeetingCarbonBreakdown & { total: number } {
  const E = MEETING_EMISSION_CONSTANTS;
  let video = 0;
  let audio = 0;
  let screen = 0;
  let server = 0;
  let network = 0;

  for (const participant of participants) {
    if (participant.media.camera) video += E.VIDEO_G_PER_MIN;
    if (participant.media.microphone) audio += E.AUDIO_G_PER_MIN;
    if (participant.media.screenShare) screen += E.SCREEN_G_PER_MIN;
    server += E.SERVER_G_PER_MIN;
    network += E.NETWORK_G_PER_MIN;
  }

  return {
    videoContribG: video,
    audioContribG: audio,
    screenContribG: screen,
    serverContribG: server,
    networkContribG: network,
    total: video + audio + screen + server + network,
  };
}

export function calcMeetingSnapshot(participants: MeetingParticipantState[], startedAt: Date): MeetingCarbonSnapshot {
  const breakdown = calcRoomBreakdown(participants);
  const totalCumulativeG = participants.reduce((sum, participant) => sum + participant.cumulativeG, 0);
  const durationSeconds = (Date.now() - startedAt.getTime()) / 1000;
  const comparisonFlightKg = participants.length * 250;
  const savingFactor = comparisonFlightKg > 0 && totalCumulativeG > 0
    ? (comparisonFlightKg * 1000) / totalCumulativeG
    : Infinity;

  return {
    durationSeconds,
    totalCumulativeG,
    totalRateGPerMin: breakdown.total,
    participantCount: participants.length,
    breakdown: {
      videoContribG: breakdown.videoContribG,
      audioContribG: breakdown.audioContribG,
      screenContribG: breakdown.screenContribG,
      serverContribG: breakdown.serverContribG,
      networkContribG: breakdown.networkContribG,
    },
    comparisonFlightKg,
    savingFactor,
  };
}

export function calcCameraOffSaving(participants: MeetingParticipantState[]) {
  const currentRateGPerMin = calcRoomBreakdown(participants).total;
  const audioOnlyRateGPerMin = participants.reduce((sum, participant) => (
    sum + calcParticipantRate({ ...participant.media, camera: false })
  ), 0);
  const savingGPerMin = currentRateGPerMin - audioOnlyRateGPerMin;
  const savingPercent = currentRateGPerMin > 0 ? (savingGPerMin / currentRateGPerMin) * 100 : 0;

  return {
    currentRateGPerMin,
    audioOnlyRateGPerMin,
    savingGPerMin,
    savingPercent,
  };
}

export function formatCarbonGrams(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)} kg`;
  if (value >= 1) return `${value.toFixed(2)} g`;
  return `${value.toFixed(3)} g`;
}

export function formatRate(value: number): string {
  return `${value.toFixed(3)} g/min`;
}

export function describeScenario(media: MeetingMediaState): string {
  if (media.camera && media.microphone && media.screenShare) return 'Cam + Mic + Share';
  if (media.camera && media.microphone) return 'Cam + Mic';
  if (media.camera && media.screenShare) return 'Cam + Share';
  if (media.microphone && media.screenShare) return 'Mic + Share';
  if (media.camera) return 'Cam only';
  if (media.microphone) return 'Mic only';
  if (media.screenShare) return 'Share only';
  return 'Idle connected';
}

export function stateReferenceTable() {
  const states: Array<{ label: string; media: MeetingMediaState }> = [
    { label: 'Camera + Mic + Screen ON', media: { camera: true, microphone: true, screenShare: true } },
    { label: 'Camera + Mic ON', media: { camera: true, microphone: true, screenShare: false } },
    { label: 'Camera ON only', media: { camera: true, microphone: false, screenShare: false } },
    { label: 'Camera ON + Screen share', media: { camera: true, microphone: false, screenShare: true } },
    { label: 'Mic ON only', media: { camera: false, microphone: true, screenShare: false } },
    { label: 'Mic ON + Screen share', media: { camera: false, microphone: true, screenShare: true } },
    { label: 'Screen share only', media: { camera: false, microphone: false, screenShare: true } },
    { label: 'All off (idle/connected)', media: { camera: false, microphone: false, screenShare: false } },
  ];

  return states.map((state) => ({
    ...state,
    rateGPerMin: calcParticipantRate(state.media),
  }));
}
