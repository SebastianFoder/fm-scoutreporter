import SquadClient from "@scoutreporter/ui/features/squad/SquadClient";
import { WorkedScoutingExample } from "@/components/WorkedScoutingExample";

export default function SquadPage() {
  return (
    <>
      <SquadClient />
      <WorkedScoutingExample page="squad" />
    </>
  );
}
