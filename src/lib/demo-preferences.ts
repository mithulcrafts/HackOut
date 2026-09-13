export type DemoProfile = {
  display_name: string;
  location: string;
  user_type: "household" | "EV owner" | "business" | "campus";
  device_status: "simulation";
  leaderboard_opt_in: boolean;
  leaderboard_alias: string;
  preferred_language: "en-IN" | "gu-IN" | "hi-IN" | "mr-IN" | "ta-IN" | "te-IN" | "bn-IN";
  reminder_channel: "in_app" | "email_sms" | "important_only" | "none";
  reminder_frequency: "all" | "important" | "quiet_hours";
  /** Empty means all enrolled activities; otherwise only these activity IDs
   * receive non-critical reminders. */
  reminder_activity_ids: string[];
  reward_program_opt_in: boolean;
  programme_name: string;
  site_name: string;
};

const defaultProfile: DemoProfile = {
  display_name: "Energy Participant",
  location: "Gandhinagar, Gujarat",
  user_type: "EV owner",
  device_status: "simulation",
  leaderboard_opt_in: false,
  leaderboard_alias: "Participant",
  preferred_language: "en-IN",
  reminder_channel: "in_app",
  reminder_frequency: "all",
  reminder_activity_ids: [],
  reward_program_opt_in: true,
  programme_name: "Demo renewable flexibility programme",
  site_name: "Gandhinagar participant site",
};

// This is a per-browser demo store, not a production account database. Keeping
// it on the server global also preserves preferences across development reloads.
const demoGlobal = globalThis as typeof globalThis & {
  vidyutSutraDemoProfiles?: Map<string, DemoProfile>;
  vidyutSutraDemoNotificationReads?: Map<string, Map<string, string>>;
};
const profiles = demoGlobal.vidyutSutraDemoProfiles ??= new Map<string, DemoProfile>();

const notificationReads = demoGlobal.vidyutSutraDemoNotificationReads ??= new Map<string, Map<string, string>>();

export function getDemoProfile(session: string): DemoProfile {
  return { ...(profiles.get(session) ?? defaultProfile) };
}

export function updateDemoProfile(session: string, changes: Partial<DemoProfile>): DemoProfile {
  const profile = { ...getDemoProfile(session), ...changes, device_status: "simulation" as const };
  profiles.set(session, profile);
  return { ...profile };
}

export function getDemoNotificationReads(session: string) {
  return new Map(notificationReads.get(session) ?? []);
}

export function markDemoNotificationsRead(session: string, ids: string[], readAt = new Date().toISOString()) {
  const current = notificationReads.get(session) ?? new Map<string, string>();
  for (const id of ids) current.set(id, readAt);
  notificationReads.set(session, current);
  return new Map(current);
}
