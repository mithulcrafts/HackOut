import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to continue."},{status:401});
 const {error}=await db.rpc("mark_consumer_notifications_read");
 if(error)return NextResponse.json({error:"Unable to mark notifications read."},{status:503});
 return NextResponse.json({ok:true});
}
