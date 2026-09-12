import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BalanceResult, ForecastSlot } from "@/domain/types";

function formatSlot(index: number) { const hour = Math.floor(index / 2); const minute = index % 2 ? "30" : "00"; return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`; }

export function OperatorSlotTable({ forecast, balances }: { forecast: ForecastSlot[]; balances: BalanceResult[] }) {
  return <Table><TableCaption className="label" style={{ textAlign: "left" }}>Selected simulated slots · slot-average kW</TableCaption><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Renewable</TableHead><TableHead>Demand</TableHead><TableHead>Mode</TableHead></TableRow></TableHeader><TableBody>{[12, 20, 26, 34, 42].map((index) => <TableRow key={index}><TableCell>{formatSlot(index)}</TableCell><TableCell>{forecast[index].renewableKW} kW</TableCell><TableCell>{(forecast[index].renewableKW - balances[index].balanceKW).toFixed(2)} kW</TableCell><TableCell>{balances[index].mode === "absorb" ? "Absorb" : "Protect"}</TableCell></TableRow>)}</TableBody></Table>;
}
