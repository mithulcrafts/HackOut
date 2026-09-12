import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readDemoSession } from "@/lib/demo-cookie";
import { getScenario } from "@/lib/demo-store";
import { demoNotifications } from "@/lib/consumer-server";
import { markDemoNotificationsRead } from "@/lib/demo-preferences";
export async function POST(){
 const demo=await readDemoSession(); if(demo&&(process.env.NODE_ENV!=="production"||process.env.DEMO_MODE==="true")) { const notifications=demoNotifications(demo, getScenario(demo)); markDemoNotificationsRead(demo, notifications.map(item => item.id)); return NextResponse.json({ok:true, read:notifications.length}); }
 let db;
 try { db=await createClient(); } catch { return NextResponse.json({error:"Notification storage is not configured for this environment."},{status:503}); }
 const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to continue."},{status:401});
 const {error}=await db.rpc("mark_consumer_notifications_read");
 if(error)return NextResponse.json({error:"Unable to mark notifications read."},{status:503});
 return NextResponse.json({ok:true});
}
