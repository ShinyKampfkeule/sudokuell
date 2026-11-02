import MatchExperience from '../../match-experience';

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <MatchExperience code={code} route="room" />;
}
