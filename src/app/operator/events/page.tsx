import { requireOperatorPageSession } from "@/lib/operator-page";
import { getScenario } from "@/lib/demo-store";
import { EventConsole } from "@/components/event-console";
export const dynamic = "force-dynamic";
export default async function EventsPage() { const scenario = getScenario(await requireOperatorPageSession()); return <EventConsole initialEvents={scenario.events} />; }

