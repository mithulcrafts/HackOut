import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readDemoSession } from "@/lib/demo-cookie";
import { getDemoProfile, updateDemoProfile } from "@/lib/demo-preferences";
import { getScenario } from "@/lib/demo-store";
export async function GET(){
 const demo=await readDemoSession();
 if(demo&&(process.env.NODE_ENV!=="production"||process.env.DEMO_MODE==="true")) {
  const profile=getDemoProfile(demo), scenario=getScenario(demo);
  const accepted=scenario.offers.filter(offer=>offer.decision==="accept");
  const verified=accepted.filter(offer=>scenario.activities.some(activity=>activity.id===offer.activityId&&activity.status==="verified")).length;
  const rows=profile.leaderboard_opt_in&&accepted.length>0?[{alias:profile.leaderboard_alias,isYou:true,opportunities:accepted.length,verified,rate:Math.round(verified/accepted.length*1000)/10,rank:1}]:[];
  return NextResponse.json({rows,optIn:profile.leaderboard_opt_in,alias:profile.leaderboard_alias});
 }
 let db;
 try { db=await createClient(); } catch { return NextResponse.json({error:"Participation storage is not configured for this environment."},{status:503}); }
 const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to view participation."},{status:401});
 const [board,profile]=await Promise.all([db.rpc("consumer_leaderboard"),db.from("profiles").select("leaderboard_opt_in,leaderboard_alias").eq("id",user.id).maybeSingle()]);
 if(board.error||profile.error)return NextResponse.json({error:"Participation board is unavailable."},{status:503});
 return NextResponse.json({rows:board.data??[],optIn:profile.data?.leaderboard_opt_in??false,alias:profile.data?.leaderboard_alias??"Participant"});
}
export async function PATCH(request:Request){
 const parsed=z.object({optIn:z.boolean(),alias:z.string().trim().min(1).max(30)}).strict().safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Choose an alias of 1–30 characters."},{status:400});
 const demo=await readDemoSession();
 if(demo&&(process.env.NODE_ENV!=="production"||process.env.DEMO_MODE==="true")) {
  updateDemoProfile(demo,{leaderboard_opt_in:parsed.data.optIn,leaderboard_alias:parsed.data.alias});
  return NextResponse.json({ok:true});
 }
 let db;
 try { db=await createClient(); } catch { return NextResponse.json({error:"Participation storage is not configured for this environment."},{status:503}); }
 const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to continue."},{status:401});
 const {error}=await db.from("profiles").upsert({id:user.id,leaderboard_opt_in:parsed.data.optIn,leaderboard_alias:parsed.data.alias});
 if(error)return NextResponse.json({error:"Unable to save participation preference."},{status:503});
 return NextResponse.json({ok:true});
}
