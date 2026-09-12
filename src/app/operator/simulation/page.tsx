import { getOrCreateDemoSession } from "@/lib/demo-cookie";
import { getScenario } from "@/lib/demo-store";
import { SimulationConsole } from "@/components/simulation-console";
export const dynamic = "force-dynamic";
export default async function SimulationPage() { const scenario = getScenario(await getOrCreateDemoSession()); return <SimulationConsole activities={scenario.activities} forecast={scenario.forecast} />; }
