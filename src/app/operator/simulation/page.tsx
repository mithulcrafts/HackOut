import { requireOperatorPageSession } from "@/lib/operator-page";
import { getScenario } from "@/lib/demo-store";
import { SimulationConsole } from "@/components/simulation-console";
export const dynamic = "force-dynamic";
export default async function SimulationPage() {
  const scenario = getScenario(await requireOperatorPageSession());
  const initialReadingCounts = Object.fromEntries(scenario.activities.map((activity) => [activity.id, scenario.readings.filter((reading) => reading.activityId === activity.id).length]));
  return <SimulationConsole activities={scenario.activities} forecast={scenario.forecast} initialReadingCounts={initialReadingCounts} />;
}

