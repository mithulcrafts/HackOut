import type { ConsumerState } from "./consumer";

export type ActivityRecord = {
  id: string; name: string; type: string; earliest_start: string; latest_finish: string;
  duration_minutes: number; interruptible: boolean; status: string; created_at: string; power_kw?: number; required_kwh?: number;
};

export type ActivityDetail = {
  activity: ActivityRecord;
  offers: {
    offer: NonNullable<ConsumerState["offer"]> & { source: string };
    readings: ConsumerState["readings"];
    verification: ConsumerState["verification"];
    rewards: ConsumerState["rewards"];
  }[];
};
