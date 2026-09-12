import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rewardSummary } from "@/lib/consumer-metrics";

export async function GET() {
 const db=await createClient(); const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to view rewards."},{status:401});
 const [ledger,history]=await Promise.all([
 db.from("reward_ledger").select("id,offer_id,points,illustrative_rupees,state,created_at").eq("owner_id",user.id).order("created_at",{ascending:false}),
 db.from("verifications").select("id,offer_id,status,reason,recorded_kwh,eligible_kwh,baseline_kwh,created_at").eq("owner_id",user.id).order("created_at",{ascending:false})
 ]);
 if(ledger.error||history.error)return NextResponse.json({error:"Rewards are unavailable. Please retry."},{status:503});
 return NextResponse.json({...rewardSummary(ledger.data??[],history.data??[]),entries:ledger.data??[],history:history.data??[]});
}
export async function POST(request:Request) {
 const parsed=z.object({rewardId:z.string().uuid()}).strict().safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Choose a valid reward."},{status:400});
 const db=await createClient(); const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to continue."},{status:401});
 const {error}=await db.rpc("release_demo_reward",{target_reward:parsed.data.rewardId});
 if(error)return NextResponse.json({error:"Reward could not be released. Refresh and check that it is verified."},{status:409});
 return NextResponse.json({message:"Reward marked redeemable in the demo. No real payment was made."});
}
