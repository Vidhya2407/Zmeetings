export type MeetingCarbonRoomType = 'main' | 'breakout';

export type MeetingCarbonRoomScope = {
  breakoutRoomId: string | null;
  breakoutSessionId: string | null;
  meetingId: string;
  roomKey: string;
  roomLabel: string;
  roomType: MeetingCarbonRoomType;
};

function normalizeId(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveMeetingCarbonRoomKey(
  meetingId: string,
  breakoutSessionId?: string | null,
  breakoutRoomId?: string | null,
) {
  const normalizedSessionId = normalizeId(breakoutSessionId);
  const normalizedRoomId = normalizeId(breakoutRoomId);
  if (!normalizedSessionId || !normalizedRoomId) {
    return meetingId.trim();
  }
  return `${meetingId.trim()}::breakout::${normalizedSessionId}::${normalizedRoomId}`.slice(0, 120);
}

export function resolveMeetingCarbonRoomScope(input: {
  breakoutRoomId?: string | null;
  breakoutRoomName?: string | null;
  breakoutSessionId?: string | null;
  meetingId: string;
}) : MeetingCarbonRoomScope {
  const meetingId = input.meetingId.trim();
  const breakoutSessionId = normalizeId(input.breakoutSessionId);
  const breakoutRoomId = normalizeId(input.breakoutRoomId);
  const breakoutRoomName = normalizeId(input.breakoutRoomName);

  if (!breakoutSessionId || !breakoutRoomId) {
    return {
      breakoutRoomId: null,
      breakoutSessionId: null,
      meetingId,
      roomKey: meetingId,
      roomLabel: 'Main Room',
      roomType: 'main',
    };
  }

  return {
    breakoutRoomId,
    breakoutSessionId,
    meetingId,
    roomKey: resolveMeetingCarbonRoomKey(meetingId, breakoutSessionId, breakoutRoomId),
    roomLabel: breakoutRoomName ?? `Breakout ${breakoutRoomId.slice(-4).toUpperCase()}`,
    roomType: 'breakout',
  };
}
