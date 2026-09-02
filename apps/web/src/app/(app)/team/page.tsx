import { TeamScreen } from '@/components/team-screen';
import { getTeam } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

export default async function TeamPage() {
  await requireAdmin();
  const team = await getTeam();
  return <TeamScreen team={team} />;
}
