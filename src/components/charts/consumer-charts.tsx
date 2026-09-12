"use client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";
import type { OutlookSlot } from "@/lib/consumer-fixture";
import type { scheduleSeries, HistoryEntry } from "@/lib/consumer-metrics";
import { slotTime } from "@/lib/consumer";

type SeriesRow = { time: string; [key: string]: string | number };
function Plot({ data, series, unit, bar = false }: { data: SeriesRow[]; series: { key: string; name: string; color: string }[]; unit: string; bar?: boolean }) {
  const children = <><CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="time" minTickGap={32} tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis width={42} tick={{ fill: "var(--muted)", fontSize: 10 }} /><Tooltip contentStyle={{ background: "var(--surface)", borderColor: "var(--line)", borderRadius: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /></>;
  return <><p className="chart-unit">{unit} · times in IST · simulated data</p><div className="consumer-chart"><ResponsiveContainer width="100%" height="100%">{bar ? <BarChart data={data}>{children}{series.map(s => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} isAnimationActive={false} />)}</BarChart> : <LineChart data={data}>{children}{series.map(s => <Line key={s.key} type="stepAfter" dataKey={s.key} name={s.name} stroke={s.color} dot={false} strokeWidth={2} isAnimationActive={false} />)}</LineChart>}</ResponsiveContainer></div><details className="evidence-readings"><summary>View chart data</summary><div className="evidence-scroll" role="region" aria-label="Chart data" tabIndex={0}><table><caption>{unit} · simulated data</caption><thead><tr><th scope="col">Time (IST)</th>{series.map(s => <th scope="col" key={s.key}>{s.name} ({unit})</th>)}</tr></thead><tbody>{data.map((row, i) => <tr key={i}><td>{row.time}</td>{series.map(s => <td key={s.key}>{row[s.key]}</td>)}</tr>)}</tbody></table></div></details></>;
}
export function RenewableOutlook({ slots, source }: { slots: OutlookSlot[]; source?: string }) {
  return <article className="schedule-card"><h2>Renewable outlook</h2><p>{source ?? "Solar and wind availability for the selected day."} This is a labelled demonstration forecast, not a live grid commitment.</p>{slots.length ? <Plot data={slots.map(s => ({ ...s, time: slotTime(s.slot) }))} unit="kW" series={[{ key: "solarKW", name: "Solar", color: "var(--amber)" }, { key: "windKW", name: "Wind", color: "var(--blue)" }, { key: "renewableKW", name: "Combined", color: "var(--green)" }]} /> : <p>Forecast is unavailable. Retry when the forecast provider is connected.</p>}</article>;
}
export function ScheduleChart({ rows }: { rows: ReturnType<typeof scheduleSeries> }) {
  return <article className="schedule-card"><h2>Your load schedule</h2><p>Usual versus accepted power across the day. An unaccepted offer adds no committed load.</p>{rows.length ? <Plot data={rows} unit="kW" series={[{ key: "baseline", name: "Usual", color: "var(--muted)" }, { key: "accepted", name: "Accepted", color: "var(--blue)" }]} /> : <p>Accept an offer to see its schedule.</p>}</article>;
}
export function VerificationHistoryChart({ history }: { history: HistoryEntry[] }) {
  const rows = history.slice().reverse().map((entry, index) => ({ time: String(index + 1), recorded: Number(entry.recorded_kwh), eligible: Number(entry.eligible_kwh) }));
  return <article className="schedule-card"><h2>Verification history</h2><p>Each bar identifies a verification record below. Shifted energy is not energy saved.</p>{rows.length ? <Plot data={rows} unit="kWh" bar series={[{ key: "recorded", name: "Recorded", color: "var(--blue)" }, { key: "eligible", name: "Eligible shift", color: "var(--violet)" }]} /> : <p>No verifications yet.</p>}</article>;
}
