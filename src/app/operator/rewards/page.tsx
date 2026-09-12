import { requireOperatorPageSession } from "@/lib/operator-page";
import { getScenario } from "@/lib/demo-store";
import { OperatorSection } from "@/components/operator-section";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  return <OperatorSection scenario={getScenario(await requireOperatorPageSession())} section="rewards" />;
}
