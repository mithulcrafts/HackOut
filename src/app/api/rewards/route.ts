import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET() {
  let db;
  try { db=await createClient(); } catch { return NextResponse.json({error:"Reward storage is not configured for this environment."},{status:503}); }
  const {data:{user}}=await db.auth.getUser(); if(!user)return NextResponse.json({error:"Sign in to view rewards."},{status:401});
  const {data,error}=await db.from("reward_ledger").select("id,points,illustrative_rupees,state,created_at").eq("owner_id",user.id).order("created_at",{ascending:false});
  if(error)return NextResponse.json({error:"Rewards storage is unavailable. Apply the consumer migration."},{status:503});
  const entries=data??[]; const verified=entries.filter(e=>e.state!=="pending").reduce((n,e)=>n+e.points,0); const pending=entries.filter(e=>e.state==="pending").reduce((n,e)=>n+e.points,0); return NextResponse.json({verified,pending,redeemable:verified,entries});
}
