import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
export async function GET(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to view participation."},{status:401});
 const [board,profile]=await Promise.all([db.rpc("consumer_leaderboard"),db.from("profiles").select("leaderboard_opt_in,leaderboard_alias").eq("id",user.id).maybeSingle()]);
 if(board.error||profile.error)return NextResponse.json({error:"Participation board is unavailable."},{status:503});
 return NextResponse.json({rows:board.data??[],optIn:profile.data?.leaderboard_opt_in??false,alias:profile.data?.leaderboard_alias??"Participant"});
}
export async function PATCH(request:Request){
 const parsed=z.object({optIn:z.boolean(),alias:z.string().trim().min(1).max(30)}).strict().safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Choose an alias of 1–30 characters."},{status:400});
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to continue."},{status:401});
 const {error}=await db.from("profiles").upsert({id:user.id,leaderboard_opt_in:parsed.data.optIn,leaderboard_alias:parsed.data.alias});
 if(error)return NextResponse.json({error:"Unable to save participation preference."},{status:503});
 return NextResponse.json({ok:true});
}
