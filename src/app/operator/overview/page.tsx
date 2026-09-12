import { createDemoScenario } from "@/domain/fixtures";
import { classifyBalance, dispatchBattery } from "@/domain/scheduling/engine";
import { summarizeScenario } from "@/domain/summary";
import { OperatorDashboard } from "@/components/operator-dashboard";
import { requireOperatorPageSession } from "@/lib/operator-page";
import { getScenario } from "@/lib/demo-store";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const scenario = getScenario(await requireOperatorPageSession()) ?? createDemoScenario();
  const balances = classifyBalance(scenario.forecast, scenario.schedules, scenario.sitePowerLimitKW);
  const battery = dispatchBattery(scenario.forecast, scenario.schedules, scenario.battery);
  return <OperatorDashboard scenario={scenario} balances={balances} battery={battery} summary={summarizeScenario(scenario)} />;
}

