import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readDemoSession } from "@/lib/demo-cookie";
import { getDemoProfile, updateDemoProfile } from "@/lib/demo-preferences";

const columns = "display_name,location,user_type,device_status,leaderboard_opt_in,leaderboard_alias,preferred_language,reminder_channel,reminder_frequency,reminder_activity_ids,reward_program_opt_in,programme_name,site_name";
const baseColumns = "display_name,location,user_type,device_status,leaderboard_opt_in,leaderboard_alias,preferred_language";
const profileSchema = z.object({
  displayName: z.string().trim().max(80),
  location: z.string().trim().min(2).max(80),
  userType: z.enum(["household", "EV owner", "business", "campus"]),
  preferredLanguage: z.enum(["en-IN", "gu-IN", "hi-IN", "mr-IN", "ta-IN", "te-IN", "bn-IN"]).default("en-IN"),
  deviceStatus: z.literal("simulation"), leaderboardOptIn: z.boolean().optional(), leaderboardAlias: z.string().trim().min(1).max(30).optional(),
  reminderChannel: z.enum(["in_app", "email_sms", "important_only", "none"]).default("in_app"),
  reminderFrequency: z.enum(["all", "important", "quiet_hours"]).default("all"),
  reminderActivityIds: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
  rewardProgramOptIn: z.boolean().default(true),
  programmeName: z.string().trim().max(100).default("Demo renewable flexibility programme"),
  siteName: z.string().trim().max(100).default("Gandhinagar participant site"),
}).strict();

export async function GET() {
  const demo = await readDemoSession();
  if (demo && (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true")) return NextResponse.json({ email: "participant@vidyutsutra.local", profile: getDemoProfile(demo) });
  let db;
  try { db = await createClient(); } catch { return NextResponse.json({ error: "Profile storage is not configured for this environment." }, { status: 503 }); }
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your profile." }, { status: 401 });
  let { data, error } = await db.from("profiles").select(columns).eq("id", user.id).maybeSingle();
  if (error?.code === "42703") ({ data, error } = await db.from("profiles").select(baseColumns).eq("id", user.id).maybeSingle());
  if (error) return NextResponse.json({ error: "Profile storage is not ready. Apply the profile migration." }, { status: 503 });
  return NextResponse.json({ email: user.email ?? "", profile: data ?? {
    display_name: "", location: "", user_type: "household", device_status: "simulation", leaderboard_opt_in: false, leaderboard_alias: "Participant", preferred_language: "en-IN", reminder_channel: "in_app", reminder_frequency: "all", reminder_activity_ids: [], reward_program_opt_in: true, programme_name: "Demo renewable flexibility programme", site_name: "Gandhinagar participant site",
  } });
}

export async function PATCH(request: Request) {
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check your name, location and user type." }, { status: 400 });
  const v = parsed.data;
  const demo = await readDemoSession();
  if (demo && (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true")) {
    const profile = updateDemoProfile(demo, {
      display_name: v.displayName, location: v.location, user_type: v.userType,
      preferred_language: v.preferredLanguage,
      reminder_channel: v.reminderChannel,
      reminder_frequency: v.reminderFrequency,
      reminder_activity_ids: v.reminderActivityIds,
      reward_program_opt_in: v.rewardProgramOptIn,
      programme_name: v.programmeName,
      site_name: v.siteName,
      ...(v.leaderboardOptIn === undefined ? {} : { leaderboard_opt_in: v.leaderboardOptIn }),
      ...(v.leaderboardAlias === undefined ? {} : { leaderboard_alias: v.leaderboardAlias }),
    });
    return NextResponse.json({ profile });
  }
  let db;
  try { db = await createClient(); } catch { return NextResponse.json({ error: "Profile storage is not configured for this environment." }, { status: 503 }); }
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
  const payload = {
    id: user.id, display_name: v.displayName, location: v.location,
    user_type: v.userType, preferred_language: v.preferredLanguage, device_status: "simulation", leaderboard_opt_in: v.leaderboardOptIn ?? false, leaderboard_alias: v.leaderboardAlias ?? "Participant", reminder_channel: v.reminderChannel, reminder_frequency: v.reminderFrequency, reminder_activity_ids: v.reminderActivityIds, reward_program_opt_in: v.rewardProgramOptIn, programme_name: v.programmeName, site_name: v.siteName, updated_at: new Date().toISOString(),
  };
  let { data, error } = await db.from("profiles").upsert(payload).select(columns).single();
  if (error?.code === "42703") {
    const legacy = { id: user.id, display_name: v.displayName, location: v.location, user_type: v.userType, preferred_language: v.preferredLanguage, device_status: "simulation", leaderboard_opt_in: v.leaderboardOptIn ?? false, leaderboard_alias: v.leaderboardAlias ?? "Participant", updated_at: new Date().toISOString() };
    ({ data, error } = await db.from("profiles").upsert(legacy).select(baseColumns).single());
  }
  if (error) return NextResponse.json({ error: "Unable to save profile. Please retry." }, { status: 503 });
  return NextResponse.json({ profile: data });
}
