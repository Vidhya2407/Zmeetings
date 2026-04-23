export type SfuProvider = 'none' | 'livekit';

export type MeetingSfuTokenResponse = {
  enabled: boolean;
  provider: SfuProvider;
  reason: string | null;
  roomName: string;
  token: string | null;
  wsUrl: string | null;
  participant: {
    id: string;
    name: string;
  };
};

export type SfuParticipantMediaState = {
  camera: boolean;
  microphone: boolean;
  screenShare: boolean;
};

export type SfuParticipantState = {
  id: string;
  displayName: string;
  isLocal: boolean;
  media: SfuParticipantMediaState;
  role: 'host' | 'attendee';
};
