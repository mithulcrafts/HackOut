"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export type EvidenceTraceRow = { time: string; cumulative: number };

export function EvidenceTrace({ rows }: { rows: EvidenceTraceRow[] }) {
  if (!rows.length) return null;
  return <section className="evidence-trace" aria-label="Uploaded cumulative energy trace">
    <h3>Uploaded trace</h3>
    <p className="chart-unit">Cumulative kWh · uploaded values · not trusted meter proof</p>
    <div className="consumer-chart-scroll"><div className="consumer-chart" role="img" aria-label="Uploaded cumulative energy trace in kilowatt-hours"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows}><CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="time" minTickGap={28} tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} /><YAxis unit=" kWh" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} /><Tooltip contentStyle={{ background: "var(--surface)", borderColor: "var(--line)", borderRadius: 12 }} formatter={(value) => [`${Number(value ?? 0).toFixed(3)} kWh`, "Cumulative energy"]} /><Line type="stepAfter" dataKey="cumulative" name="Cumulative energy" stroke="var(--blue)" dot={false} strokeWidth={2} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></div>
    <details className="evidence-readings"><summary>View uploaded rows</summary><div className="evidence-scroll" role="region" aria-label="Uploaded meter rows" tabIndex={0}><table><caption>Untrusted CSV values</caption><thead><tr><th scope="col">Time</th><th scope="col">Cumulative kWh</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.time}-${index}`}><td>{row.time}</td><td>{row.cumulative.toFixed(3)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
