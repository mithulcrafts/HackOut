"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ForecastSlot } from "@/domain/types";

export function SupplyDemandChart({ forecast }: { forecast: ForecastSlot[] }) {
  const data = forecast.map((slot) => ({ time: slot.start, renewable: slot.renewableKW, demand: slot.fixedDemandKW }));
  return <div style={{ width: "100%", height: 250, minWidth: 520 }} role="img" aria-label="Supply and demand chart in kilowatts"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -16 }}><CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="time" tick={{ fill: "var(--muted)", fontSize: 11 }} interval={7} /><YAxis unit=" kW" tick={{ fill: "var(--muted)", fontSize: 11 }} /><Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8 }} formatter={(value) => [value + " kW"]} /><Legend /><Area type="monotone" dataKey="renewable" name="Renewable availability" fill="var(--amber)" stroke="var(--amber)" fillOpacity={.18} /><Line type="monotone" dataKey="demand" name="Fixed demand" stroke="var(--blue)" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div>;
}
