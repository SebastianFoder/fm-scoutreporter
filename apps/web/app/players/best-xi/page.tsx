import BestXiClient from "@scoutreporter/ui/features/best-xi/BestXiClient";
import { WorkedScoutingExample } from "@/components/WorkedScoutingExample";

export default function BestXiPage() {
  return (
    <>
      <BestXiClient />
      <WorkedScoutingExample page="bestXi" />
    </>
  );
}
