import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const columns = "display_name,location,user_type,device_status";
const profileSchema = z.object({
  displayName: z.string().trim().max(80),
  location: z.string().trim().min(2).max(80),
  userType: z.enum(["household", "EV owner", "business", "campus"]),
  deviceStatus: z.literal("simulation"),
}).strict();

export async function GET() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your profile." }, { status: 401 });
  const { data, error } = await db.from("profiles").select(columns).eq("id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Profile storage is not ready. Apply the profile migration." }, { status: 503 });
  return NextResponse.json({ email: user.email ?? "", profile: data ?? {
    display_name: "", location: "Gandhinagar, Gujarat", user_type: "household", device_status: "simulation",
  } });
}

export async function PATCH(request: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check your name, location and user type." }, { status: 400 });
  const v = parsed.data;
  const { data, error } = await db.from("profiles").upsert({
    id: user.id, display_name: v.displayName, location: v.location,
    user_type: v.userType, device_status: "simulation", updated_at: new Date().toISOString(),
  }).select(columns).single();
  if (error) return NextResponse.json({ error: "Unable to save profile. Please retry." }, { status: 503 });
  return NextResponse.json({ profile: data });
}
