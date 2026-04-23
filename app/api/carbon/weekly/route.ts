import { apiSuccess } from '@/lib/api/response';
import { listMeetingsRepo } from '@/lib/meetings/meetingRepository';

export async function GET() {
  const meetingsResult = await listMeetingsRepo();
  const meetings = meetingsResult.value;
  const totalSavedKg = meetings.reduce((sum, meeting) => sum + meeting.carbonSavedKg, 0);
  const meetingsCount = meetings.length;

  return apiSuccess({
    weekly: {
      totalSavedKg: Number(totalSavedKg.toFixed(2)),
      meetingsCount,
      avgSavedPerMeetingKg: Number((totalSavedKg / Math.max(1, meetingsCount)).toFixed(2)),
    },
  }, meetingsResult.demoMode ? { _demoMode: true } : {});
}
