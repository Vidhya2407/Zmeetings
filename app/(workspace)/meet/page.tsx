import { redirect } from 'next/navigation';
import MeetWorkspaceScreen from '@/features/meet-workspace/screen';
import { auth } from '@/lib/auth/auth';

type MeetPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MeetPage({ searchParams }: MeetPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    const params = new URLSearchParams();
    const resolvedParams = await searchParams;
    const meetingId = typeof resolvedParams?.meetingId === 'string' ? resolvedParams.meetingId : undefined;
    if (meetingId) {
      params.set('meetingId', meetingId);
    }
    const nextPath = params.size ? `/meet?${params.toString()}` : '/meet';
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return <MeetWorkspaceScreen />;
}
