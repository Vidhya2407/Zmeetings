import type { MeetingCarbonBreakdown } from '@/lib/meetings/carbonCalc';
import type { MeetingCarbonRoomType } from '@/lib/meetings/carbonRoomScope';

export type MeetingCarbonRoomContribution = {
  breakoutRoomId: string | null;
  breakoutSessionId: string | null;
  carbonKg: number;
  durationSeconds: number;
  label: string;
  participantCount: number;
  roomKey: string;
  roomType: MeetingCarbonRoomType;
  totalCumulativeG: number;
  totalRateGPerMin: number;
  breakdown: MeetingCarbonBreakdown;
};

export type MeetingCarbonSummary = {
  breakoutKg: number;
  breakoutRoomCount: number;
  breakoutSharePercent: number;
  mainRoomKg: number;
  roomCount: number;
  rooms: MeetingCarbonRoomContribution[];
  totalKg: number;
};
