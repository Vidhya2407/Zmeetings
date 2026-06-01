import { redirect } from 'next/navigation';
import CalendarWorkspaceScreen from '@/features/calendar-workspace/screen';
import { auth } from '@/lib/auth/auth';

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent('/calendar')}`);
  }

  return <CalendarWorkspaceScreen />;
}
