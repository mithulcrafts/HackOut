import { requireOperatorPageSession } from "@/lib/operator-page";
import { getScenario } from "@/lib/demo-store";
import { OperatorSettings } from "@/components/operator-settings";
export const dynamic = "force-dynamic";
export default async function SettingsPage() { return <OperatorSettings scenario={getScenario(await requireOperatorPageSession())} />; }

