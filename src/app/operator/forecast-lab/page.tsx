import { requireOperatorPageSession } from "@/lib/operator-page";
import { getScenario } from "@/lib/demo-store";
import { ForecastLab } from "@/components/forecast-lab";

export const dynamic = "force-dynamic";

export default async function ForecastLabPage() {
  const session = await requireOperatorPageSession();
  return <ForecastLab scenario={getScenario(session)} />;
}
