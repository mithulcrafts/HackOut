import { requireOperatorPageSession } from "@/lib/operator-page";
import { getScenario } from "@/lib/demo-store";
import { SimulationConsole } from "@/components/simulation-console";
export const dynamic = "force-dynamic";
export default async function SimulationPage() { const scenario = getScenario(await requireOperatorPageSession()); return <SimulationConsole activities={scenario.activities} forecast={scenario.forecast} />; }

