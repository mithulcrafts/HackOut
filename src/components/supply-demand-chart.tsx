"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ForecastSlot, ScheduleEntry } from "@/domain/types";

export function SupplyDemandChart({ forecast, schedules = [], baselineSchedules = [] }: { forecast: ForecastSlot[]; schedules?: ScheduleEntry[]; baselineSchedules?: ScheduleEntry[] }) {
  const demandAt = (slot: ForecastSlot, entries: ScheduleEntry[]) => slot.fixedDemandKW + entries.filter((entry) => slot.index >= entry.startSlot && slot.index < entry.endSlot).reduce((sum, entry) => sum + entry.powerKW, 0);
  const data = forecast.map((slot) => ({ time: slot.start, renewable: slot.renewableKW, demand: demandAt(slot, schedules), baseline: demandAt(slot, baselineSchedules) }));
  return <div style={{ width: "100%", height: 250, minWidth: 520 }} role="img" aria-label="Supply and demand chart in kilowatts"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -16 }}><CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="time" tick={{ fill: "var(--muted)", fontSize: 11 }} interval={7} /><YAxis unit=" kW" tick={{ fill: "var(--muted)", fontSize: 11 }} /><Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8 }} formatter={(value) => [value + " kW"]} /><Legend /><Area type="monotone" dataKey="renewable" name="Renewable availability" fill="var(--amber)" stroke="var(--amber)" fillOpacity={.18} /><Line type="monotone" dataKey="demand" name="Scheduled demand" stroke="var(--blue)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="baseline" name="Baseline demand" stroke="var(--muted)" strokeDasharray="5 4" dot={false} /></ComposedChart></ResponsiveContainer></div>;
}
