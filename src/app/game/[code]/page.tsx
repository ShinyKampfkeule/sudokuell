import MatchExperience from '../../match-experience';

export default async function GamePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <MatchExperience code={code} route="game" />;
}
