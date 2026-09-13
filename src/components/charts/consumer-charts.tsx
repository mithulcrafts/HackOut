"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OutlookSlot } from "@/lib/consumer-fixture";
import type { scheduleSeries, HistoryEntry } from "@/lib/consumer-metrics";
import { slotTime } from "@/lib/consumer";

type SeriesRow = { time: string; [key: string]: string | number };
type ChartSeries = { key: string; name: string; color: string };
type ChartCurve = "monotone" | "stepAfter";
type HighlightWindow = { start: string; end: string };

type PlotProps = {
  data: SeriesRow[];
  series: ChartSeries[];
  unit: string;
  bar?: boolean;
  curve?: ChartCurve;
  areaKey?: string;
  highlight?: HighlightWindow | null;
  caption: string;
  ariaLabel: string;
};

function Plot({
  data,
  series,
  unit,
  bar = false,
  curve = "stepAfter",
  areaKey,
  highlight,
  caption,
  ariaLabel,
}: PlotProps) {
  const axes = (
    <>
      <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
      <XAxis
        dataKey="time"
        interval={data.length > 40 ? 5 : "preserveStartEnd"}
        minTickGap={22}
        tick={{ fill: "var(--muted)", fontSize: 10 }}
        tickLine={false}
        axisLine={{ stroke: "var(--line)" }}
      />
      <YAxis
        width={44}
        unit={` ${unit}`}
        tick={{ fill: "var(--muted)", fontSize: 10 }}
        tickLine={false}
        axisLine={{ stroke: "var(--line)" }}
      />
      <Tooltip
        contentStyle={{ background: "var(--surface)", borderColor: "var(--line)", borderRadius: 12 }}
        labelStyle={{ color: "var(--ink)", fontWeight: 700 }}
        labelFormatter={(label) => `${String(label)} IST`}
        formatter={(value, name) => [`${Number(value ?? 0).toFixed(2)} ${unit}`, String(name)]}
        cursor={{ stroke: "var(--primary)", strokeDasharray: "4 4" }}
      />
    </>
  );

  const chart = bar ? (
    <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
      {axes}
      {series.map((item) => (
        <Bar key={item.key} dataKey={item.key} name={item.name} fill={item.color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      ))}
    </BarChart>
  ) : (
    <ComposedChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
      {axes}
      {highlight && (
        <>
          <ReferenceArea x1={highlight.start} x2={highlight.end} fill="var(--amber)" fillOpacity={0.1} strokeOpacity={0} />
          <ReferenceLine x={highlight.start} stroke="var(--amber)" strokeDasharray="4 4" strokeOpacity={0.75} />
          <ReferenceLine x={highlight.end} stroke="var(--amber)" strokeDasharray="4 4" strokeOpacity={0.75} />
        </>
      )}
      {areaKey && <Area type={curve} dataKey={areaKey} name="Renewable profile" legendType="none" fill="var(--green)" stroke="none" fillOpacity={0.1} isAnimationActive={false} />}
      {series.map((item) => (
        <Line
          key={item.key}
          type={curve}
          dataKey={item.key}
          name={item.name}
          stroke={item.color}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }}
          strokeWidth={item.key === "renewableKW" ? 2.8 : 2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          isAnimationActive={false}
          connectNulls={false}
        />
      ))}
    </ComposedChart>
  );

  return (
    <>
      <p className="chart-unit">{unit} · {caption}</p>
      <div className="chart-legend" aria-label="Chart legend">
        {series.map((item) => (
          <span className="chart-legend-item" key={item.key}>
            <i aria-hidden="true" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
      <div className="consumer-chart-scroll">
        <div className="consumer-chart" role="img" aria-label={ariaLabel}>
          <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
        </div>
      </div>
      {data.length > 24 && <p className="chart-scroll-hint" aria-hidden="true">Swipe to explore the full day →</p>}
      {highlight && <p className="chart-highlight-note"><span aria-hidden="true" /> Shaded band: proposed renewable-aligned window ({highlight.start}–{highlight.end} IST).</p>}
      <details className="evidence-readings">
        <summary>View chart data</summary>
        <div className="evidence-scroll" role="region" aria-label="Chart data" tabIndex={0}>
          <table>
            <caption>{unit} · {caption}</caption>
            <thead>
              <tr>
                <th scope="col">Time (IST)</th>
                {series.map((item) => <th scope="col" key={item.key}>{item.name} ({unit})</th>)}
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={index}>
                  <td>{row.time}</td>
                  {series.map((item) => <td key={item.key}>{row[item.key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function RenewableMix({ peak }: { peak: OutlookSlot }) {
  const solar = Math.max(0, Number(peak.solarKW) || 0);
  const wind = Math.max(0, Number(peak.windKW) || 0);
  const total = solar + wind;
  if (!total) return <div className="renewable-mix-empty">Source mix unavailable</div>;

  const solarPercent = Math.round((solar / total) * 100);
  const windPercent = 100 - solarPercent;
  const data = [
    { name: "Solar", value: solar, color: "var(--amber)" },
    { name: "Wind", value: wind, color: "var(--blue)" },
  ];

  return (
    <div className="renewable-mix-insight" role="img" aria-label={`At the peak estimate, renewable supply is ${solarPercent}% solar and ${windPercent}% wind`}>
      <div className="mix-donut">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={26} outerRadius={40} paddingAngle={2} startAngle={90} endAngle={-270} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
              {data.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span aria-hidden="true">{solarPercent}%</span>
      </div>
      <div className="mix-copy">
        <strong>Peak source mix</strong>
        <span><i className="mix-dot solar" /> Solar {solarPercent}%</span>
        <span><i className="mix-dot wind" /> Wind {windPercent}%</span>
      </div>
    </div>
  );
}

export function DecisionPath() {
  const steps = [
    ["01", "Estimate", "Supply outlook"],
    ["02", "Match", "Safe activity"],
    ["03", "Act", "Your choice"],
    ["04", "Verify", "Reward earned"],
  ];
  return (
    <div className="decision-path" aria-label="How the recommendation is created">
      <span className="decision-path-label">How the timing decision is made</span>
      <ol>
        {steps.map(([number, title, detail]) => <li key={number}><span>{number}</span><strong>{title}</strong><small>{detail}</small></li>)}
      </ol>
    </div>
  );
}

export function RenewableOutlook({
  slots,
  source,
  highlightWindow,
}: {
  slots: OutlookSlot[];
  source?: string;
  highlightWindow?: { start: number; end: number } | null;
}) {
  if (!slots.length) {
    return <article className="schedule-card"><h2>Renewable outlook</h2><p>Forecast is unavailable. Retry when the forecast provider is connected.</p></article>;
  }

  const peak = slots.reduce((best, slot) => slot.renewableKW > best.renewableKW ? slot : best, slots[0]);
  const highlight = highlightWindow ? { start: slotTime(highlightWindow.start), end: slotTime(highlightWindow.end) } : null;
  const windowLabel = highlight ? `${highlight.start}–${highlight.end}` : `${slotTime(peak.slot)} slot`;
  const rows = slots.map((slot) => ({ ...slot, time: slotTime(slot.slot) }));

  return (
    <article className="schedule-card renewable-outlook-card">
      <div className="chart-heading-row">
        <div><span className="section-label">SUPPLY PROFILE</span><h2>Renewable outlook</h2></div>
        <span className="estimate-badge">Estimated</span>
      </div>
      <p>{source ?? "Solar and wind availability for the selected day."} Values are estimates, not guaranteed supply or a live grid commitment.</p>
      <div className="renewable-insights" aria-label="Renewable profile summary">
        <div className="renewable-insight"><span>Peak estimate</span><strong>{Number(peak.renewableKW).toFixed(1)} kW</strong><small>{slotTime(peak.slot)} IST · combined</small></div>
        <div className="renewable-insight"><span>{highlight ? "Proposed window" : "Highest slot"}</span><strong>{windowLabel}</strong><small>{highlight ? "marked on the profile" : "by estimated availability"}</small></div>
        <RenewableMix peak={peak} />
      </div>
      <Plot
        data={rows}
        unit="kW"
        caption="estimated availability · 30-minute slots · IST"
        ariaLabel="Smooth estimated solar, wind and combined renewable availability across the day"
        curve="monotone"
        areaKey="renewableKW"
        highlight={highlight}
        series={[{ key: "solarKW", name: "Solar", color: "var(--amber)" }, { key: "windKW", name: "Wind", color: "var(--blue)" }, { key: "renewableKW", name: "Combined", color: "var(--green)" }]}
      />
      <DecisionPath />
    </article>
  );
}

export function ScheduleChart({ rows }: { rows: ReturnType<typeof scheduleSeries> }) {
  return <article className="schedule-card"><h2>Your load schedule</h2><p>Usual versus accepted power across the day. Block edges represent discrete half-hour operating intervals.</p>{rows.length ? <Plot data={rows} unit="kW" caption="planned dispatch · half-hour intervals · IST" ariaLabel="Usual and accepted load schedule in kilowatts" curve="stepAfter" series={[{ key: "baseline", name: "Usual", color: "var(--muted)" }, { key: "accepted", name: "Accepted", color: "var(--blue)" }]} /> : <p>Accept an offer to see its schedule.</p>}</article>;
}

export function VerificationHistoryChart({ history }: { history: HistoryEntry[] }) {
  const rows = history.slice().reverse().map((entry, index) => ({ time: String(index + 1), recorded: Number(entry.recorded_kwh), eligible: Number(entry.eligible_kwh) }));
  return <article className="schedule-card"><h2>Verification history</h2><p>Each bar identifies a verification record below. Shifted energy is not energy saved.</p>{rows.length ? <Plot data={rows} unit="kWh" caption="recorded versus eligible energy · verified records" ariaLabel="Recorded and eligible energy for verification records" bar series={[{ key: "recorded", name: "Recorded", color: "var(--blue)" }, { key: "eligible", name: "Eligible shift", color: "var(--violet)" }]} /> : <p>No verifications yet.</p>}</article>;
}
