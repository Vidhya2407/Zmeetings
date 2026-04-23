import { redirect } from 'next/navigation';

type JoinSearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function JoinMeetingRedirectPage({
  searchParams,
}: {
  searchParams: JoinSearchParams;
}) {
  const params = await searchParams;
  const meetingId = firstSearchValue(params.meetingId)?.trim();
  const targetParams = new URLSearchParams();

  if (meetingId) {
    targetParams.set('meetingId', meetingId);
  } else {
    redirect('/meet');
  }

  redirect(`/meetings/attendee?${targetParams.toString()}`);
}
