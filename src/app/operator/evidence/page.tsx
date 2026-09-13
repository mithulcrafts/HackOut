import { requireOperatorPageSession } from "@/lib/operator-page";
import { getScenario } from "@/lib/demo-store";
import { EvidenceReviewConsole } from "@/components/evidence-review-console";

export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const scenario = getScenario(await requireOperatorPageSession());
  return <EvidenceReviewConsole activities={scenario.activities} />;
}

