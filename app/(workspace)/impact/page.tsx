import { redirect } from 'next/navigation';
import SustainabilityImpactScreen from '@/features/sustainability-impact/screen';
import { auth } from '@/lib/auth/auth';

export default async function ImpactPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent('/impact')}`);
  }

  return <SustainabilityImpactScreen />;
}
