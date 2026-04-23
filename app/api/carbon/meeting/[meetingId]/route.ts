import { apiError, apiSuccess } from '@/lib/api/response';
import { getMeetingRepo } from '@/lib/meetings/meetingRepository';

type RouteContext = { params: Promise<{ meetingId: string }> };

function formatKg(value: number) {
  return value >= 1 ? `${value.toFixed(2)} kg` : `${(value * 1000).toFixed(1)} g`;
}

function getEstimateLabel(meeting: NonNullable<Awaited<ReturnType<typeof getMeetingRepo>>['value']>, lang: 'en' | 'de') {
  const trackedLabel = lang === 'de'
    ? `${formatKg(meeting.carbonSummary?.totalKg ?? 0)} CO2 gemessen (${formatKg(meeting.carbonSummary?.breakoutKg ?? 0)} Breakouts)`
    : `${formatKg(meeting.carbonSummary?.totalKg ?? 0)} CO2 tracked (${formatKg(meeting.carbonSummary?.breakoutKg ?? 0)} breakouts)`;

  if (meeting.status === 'scheduled') {
    return lang === 'de'
      ? `${formatKg(meeting.carbonSavedKg)} geschaetzte CO2-Einsparung`
      : `${formatKg(meeting.carbonSavedKg)} estimated CO2 savings`;
  }

  if (meeting.status === 'live') {
    return lang === 'de' ? `Live: ${trackedLabel}` : `Live: ${trackedLabel}`;
  }

  return trackedLabel;
}

export async function GET(request: Request, context: RouteContext) {
  const { meetingId } = await context.params;
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') === 'de' ? 'de' : 'en';
  const meetingResult = await getMeetingRepo(meetingId);
  const meeting = meetingResult.value;
  if (!meeting) {
    return apiError('Meeting not found.', 404);
  }

  const carbon = {
    meetingId,
    title: meeting.title,
    savedKg: meeting.carbonSavedKg,
    trackedKg: meeting.carbonSummary?.totalKg ?? 0,
    mainRoomKg: meeting.carbonSummary?.mainRoomKg ?? 0,
    breakoutKg: meeting.carbonSummary?.breakoutKg ?? 0,
    breakoutSharePercent: meeting.carbonSummary?.breakoutSharePercent ?? 0,
    breakoutRoomCount: meeting.carbonSummary?.breakoutRoomCount ?? 0,
    rooms: meeting.carbonSummary?.rooms ?? [],
    participants: meeting.attendeesCount,
    estimateLabel: getEstimateLabel(meeting, lang),
  };
  return apiSuccess({ carbon }, meetingResult.demoMode ? { _demoMode: true } : {});
}
